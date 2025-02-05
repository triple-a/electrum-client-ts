import EventEmitter from 'events';
import { addressToScriptHash } from '../btc/util';
import {
  DefaultLogger,
  Logger,
  Protocol,
  SocketClient,
  SocketClientOptions,
} from '../socket/socket_client';
import { TCPSocketClient } from '../socket/socket_client_tcp';
import { WebSocketClient } from '../socket/socket_client_ws';
import {
  AddressDetailedHistoryItem,
  BalanceOutput,
  BlockHeader,
  BlockHeaders,
  BlockHeadersDetail,
  FeeHistogram,
  HeadersSubscribeOutput,
  JsonRpcResponse,
  MerkleOutput,
  PeersSubscribeResult,
  ScriptHashMempool,
  ScriptHashStatus,
  Transaction,
  TransactionDetail,
  TransactionOutput,
  UnspentOutput,
  VersionOutput,
} from '../types';
import { ScriptHashHistory } from '../types';
import * as util from './util';

const keepAliveInterval = 120 * 1000; // 2 minutes

export interface PersistencePolicy {
  maxRetry: number;
  callback: () => void;
}

export type ElectrumClientOptions = {
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  logger?: Logger;
  nextMsgId?: () => string;
  showBanner?: boolean;
  callBanner?: boolean;
  clientName?: string;
  protocolVersion?: string;
};

type CallbackMessageQueue<T> = Map<string, util.PromiseResult<T>>;

export type DetailedHistoryOption = {
  afterHeight?: number;
  beforeHeight?: number;
  inclusive?: boolean;
  retreiveVin?: boolean;
  excludeUnconfirmedTxs?: boolean;
};

export class ElectrumClient {
  private timeLastCall: number = 0;
  private clientName: string = 'electrum-client-js';
  private protocolVersion: string = '1.4.2';
  private persistencePolicy?: PersistencePolicy;
  private timeout: NodeJS.Timeout | number = 0;

  private socketClient: SocketClient;

  private _reqId: number = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private callbackMessageQueue: CallbackMessageQueue<any>;
  private nextReqId: () => string;
  private logger: Logger;
  private reconnectWhenClose: boolean = false;

  public subscribe: EventEmitter;

  constructor(
    private host: string,
    private port: number,
    private protocol: Protocol,
    private options?: ElectrumClientOptions,
  ) {
    this.subscribe = new EventEmitter();
    this.callbackMessageQueue = new Map();

    const logLevel = options?.logLevel || 'info';

    this.nextReqId = options?.nextMsgId || (() => String(++this._reqId));
    this.logger = new DefaultLogger(options?.logger, logLevel);

    this.options = {
      ...options,
      logger: this.logger,
      showBanner: options?.showBanner ?? false,
      logLevel,
      nextMsgId: this.nextReqId,
    };

    if (this.options.clientName) {
      this.clientName = this.options.clientName;
    }
    if (this.options.protocolVersion) {
      this.protocolVersion = this.options.protocolVersion;
    }

    this.socketClient = this._createSocketClient();
  }

  private _createSocketClient() {
    let socketClient: TCPSocketClient | WebSocketClient;
    switch (this.protocol) {
      case 'tcp':
      case 'tls':
      case 'ssl':
        socketClient = new TCPSocketClient(
          this.host,
          this.port,
          this.protocol,
          this.options as SocketClientOptions,
        );
        break;
      case 'ws':
      case 'wss':
        socketClient = new WebSocketClient(
          this.host,
          this.port,
          this.protocol,
          this.options as SocketClientOptions,
        );
        break;
      default:
        throw new Error(`invalid protocol: [${this.protocol}]`);
    }

    socketClient.on('socket.message', this.onSocketMessage.bind(this));
    socketClient.on('socket.close', this.onSocketClose.bind(this));
    return socketClient;
  }

  isConnected(): boolean {
    return this.socketClient.isConnected();
  }

  async connect(persistencePolicy?: PersistencePolicy) {
    this.persistencePolicy = persistencePolicy;

    this.timeLastCall = 0;
    this.persistencePolicy = persistencePolicy;

    if (!this.isConnected()) {
      await this.socketClient.initialize();

      // Negotiate protocol version.
      const version = await this.server_version(
        this.clientName,
        this.protocolVersion,
      );
      this.logger.info(`Negotiated version: [${version}]`);

      // this.onReady();

      // Get banner.
      if (this.options?.callBanner) {
        const banner = await this.server_banner();

        if (this.options?.showBanner) {
          this.logger.info(banner);
        }
      }

      this.keepAlive();
    }
  }

  onSocketClose() {
    this.logger.debug('socket.close');

    this.callbackMessageQueue.forEach((_v, key, map) => {
      this.socketClient.emitError('close connection');
      map.delete(key);
    });

    // Stop keep alive.
    clearInterval(this.timeout);

    if (!this.reconnectWhenClose) {
      return;
    }
    setTimeout(async () => {
      if (
        this.persistencePolicy != null &&
        this.persistencePolicy.maxRetry > 0
      ) {
        await this.reconnect();
        this.persistencePolicy.maxRetry -= 1;
      } else if (
        this.persistencePolicy != null &&
        this.persistencePolicy.callback != null
      ) {
        this.persistencePolicy.callback();
      } else if (this.persistencePolicy == null) {
        await this.reconnect();
      }
    }, 1000);
  }

  async request<T>(method: string, params: unknown[]): Promise<T> {
    if (!this.isConnected()) {
      throw new Error('connection not established');
    }

    this.timeLastCall = new Date().getTime();

    const response = new Promise((resolve, reject) => {
      const msgId = this.nextReqId();

      const content = util.makeRequest(method, params, msgId);

      this.logger.debug(`request: [${content}]`);

      this.callbackMessageQueue.set(
        msgId,
        util.createPromiseResult<T>(resolve, reject) as util.PromiseResult<T>,
      );

      this.socketClient.send(content + '\n');
    }) as Promise<T>;

    return await response;
  }

  response(msg: JsonRpcResponse) {
    const callback = this.callbackMessageQueue.get(msg.id);

    if (callback) {
      this.callbackMessageQueue.delete(msg.id);
      if (msg.error) {
        if (typeof msg.error === 'string') {
          callback(msg.error, null);
        } else {
          callback(msg.error.message, null);
        }
      } else {
        callback(null, msg.result);
      }
    } else {
      this.logger.warn("Can't get callback");
    }
  }

  onSocketMessage(body: string) {
    this.logger.debug(`socket.message: [${body}]`);
    const msg = JSON.parse(body);
    if (msg instanceof Array) {
      // don't support batch request
      throw new Error('batch request is not supported');
    } else {
      if (msg.id !== void 0) {
        this.response(msg);
      } else {
        this.subscribe.emit(msg.method, msg.params);
      }
    }
  }

  /**
   * Ping the server to ensure it is responding, and to keep the session alive.
   * The server may disconnect clients that have sent no requests for roughly 10
   * minutes. It sends a ping request every 2 minutes. If the request fails it
   * logs an error and closes the connection.
   */
  async keepAlive() {
    if (this.timeout != null) {
      clearTimeout(this.timeout);
    }
    this.timeout = setTimeout(() => {
      if (
        this.timeLastCall !== 0 &&
        new Date().getTime() > this.timeLastCall + 5000
      ) {
        const pingTimer = setTimeout(() => {
          this.socketClient.emitError(new Error('keepalive ping timeout'));
        }, keepAliveInterval);
        if (!this.isConnected()) {
          clearTimeout(pingTimer);
          return;
        }
        this.server_ping()
          .catch((reason) => {
            this.logger.error('keepalive ping failed because of', reason);
            clearTimeout(pingTimer);
          })
          .then(() => clearTimeout(pingTimer));
      }
    }, 5000);
  }

  close() {
    this.reconnectWhenClose = false;
    return this.socketClient.close();
  }

  async reconnect() {
    if (!this.reconnectWhenClose) {
      return;
    }
    this.logger.info('electrum reconnect');
    this.socketClient = this._createSocketClient();
    try {
      return await this.connect(this.persistencePolicy);
    } catch (e) {
      this.logger.error('Failed to reconnect: ' + e);
    }
  }

  async getAddressBalance(
    address: string,
    network: 'bitcoin' | 'testnet' = 'bitcoin',
  ): Promise<BalanceOutput> {
    const scriptHash = addressToScriptHash(address, network);
    return await this.blockchain_scripthash_getBalance(scriptHash);
  }

  async getTransactionOutput(
    txHash: string,
    index: number,
  ): Promise<TransactionOutput> {
    const tx = await this.blockchain_transaction_get(txHash, true);
    return tx.vout[index];
  }

  async getDetailedTransaction(
    txHash: string,
    retreiveVin = true,
  ): Promise<TransactionDetail> {
    const tx = await this.blockchain_transaction_get(txHash, true);

    if (!retreiveVin) {
      return tx;
    }

    await Promise.all(
      tx.vin.map(async (input) => {
        if (input.txid) {
          const previousOutput = await this.getTransactionOutput(
            input.txid,
            input.vout,
          );
          input.prevout = previousOutput;
        }
      }),
    );

    return tx;
  }

  async getAddressDetailedHistory(
    address: string,
    network: 'bitcoin' | 'testnet' = 'bitcoin',
    options?: DetailedHistoryOption,
  ): Promise<Array<AddressDetailedHistoryItem>> {
    const {
      afterHeight,
      beforeHeight,
      retreiveVin,
      excludeUnconfirmedTxs,
      inclusive,
    } = options || {};

    const scriptHash = addressToScriptHash(address, network);

    if (afterHeight && beforeHeight && afterHeight > beforeHeight) {
      throw new Error('afterHeight must be less than beforeHeight');
    }

    const history = await this.blockchain_scripthash_getHistory(scriptHash);

    // skip transactions before beforeHeight or after afterHeight
    const filteredHistory = history.filter((item) => {
      if (item.height <= 0) {
        return excludeUnconfirmedTxs ? false : true;
      }
      if (
        afterHeight &&
        ((!inclusive && item.height <= afterHeight) ||
          (inclusive && item.height < afterHeight))
      ) {
        return false;
      }
      if (
        beforeHeight &&
        ((!inclusive && item.height >= beforeHeight) ||
          (inclusive && item.height > beforeHeight))
      ) {
        return false;
      }
      return true;
    });

    return await Promise.all(
      filteredHistory.map(async (item) => {
        const tx = await this.getDetailedTransaction(item.tx_hash, retreiveVin);

        let totalIncoming = 0;
        let totalOutgoing = 0;
        let receivedAmount = 0;
        let sentAmount = 0;
        let isIncoming = false;
        tx.vout.forEach((output) => {
          const outputAddresses = output.scriptPubKey.addresses || [
            output.scriptPubKey.address,
          ];
          // find address in output
          if (address && outputAddresses.includes(address)) {
            isIncoming = true;
            receivedAmount += output.value;
          }
          totalOutgoing += output.value;
        });

        if (retreiveVin) {
          tx.vin.forEach((input) => {
            const inputAddresses = input.prevout?.scriptPubKey.addresses || [
              input.prevout?.scriptPubKey.address,
            ];
            // find address in input
            if (address && inputAddresses.includes(address)) {
              isIncoming = false;
              sentAmount += input.prevout?.value || 0;
            }
            totalIncoming += input.prevout?.value || 0;
          });
        }

        const fee = Number((totalIncoming - totalOutgoing).toFixed(8));

        return {
          height: item.height,
          direction: isIncoming ? 'incoming' : 'outgoing',
          ...tx,
          ...(isIncoming ? { amount: receivedAmount } : { amount: sentAmount }),
          total_outgoing: totalOutgoing,
          ...(retreiveVin ? { total_incoming: totalIncoming } : {}),
          fee,
          fee_sats: Number(fee) * 1e8,
        };
      }),
    );
  }

  // ElectrumX API
  //
  // Documentation:
  // https://electrumx.readthedocs.io/en/latest/protocol-methods.html
  //
  async server_version(
    clientName: string,
    protocolVersion: string,
  ): Promise<VersionOutput> {
    const res = await this.request<VersionOutput>('server.version', [
      clientName,
      protocolVersion,
    ]);
    return res;
  }
  async server_banner(): Promise<string> {
    const res = await this.request<string>('server.banner', []);
    return res;
  }
  server_ping(): Promise<null> {
    return this.request<null>('server.ping', []);
  }
  server_addPeer(features: Record<string, unknown>) {
    return this.request('server.add_peer', [features]);
  }
  server_donation_address() {
    return this.request('server.donation_address', []);
  }
  server_features() {
    return this.request('server.features', []);
  }
  server_peers_subscribe() {
    return this.request<PeersSubscribeResult>('server.peers.subscribe', []);
  }
  blockchain_address_getProof(address: string) {
    return this.request('blockchain.address.get_proof', [address]);
  }
  blockchain_dotnav_resolveName(name: string, subdomains: string) {
    return this.request('blockchain.dotnav.resolve_name', [name, subdomains]);
  }
  blockchain_scripthash_getBalance(scripthash: string): Promise<BalanceOutput> {
    return this.request<BalanceOutput>('blockchain.scripthash.get_balance', [
      scripthash,
    ]);
  }
  blockchain_scripthash_getHistory(
    scripthash: string,
    height = 0,
    to_height = -1,
  ): Promise<ScriptHashHistory> {
    if (this.protocolVersion == '1.5') {
      return this.request<ScriptHashHistory>(
        'blockchain.scripthash.get_history',
        [scripthash, height, to_height],
      );
    } else {
      return this.request<ScriptHashHistory>(
        'blockchain.scripthash.get_history',
        [scripthash],
      );
    }
  }
  blockchain_scripthash_getMempool(
    scripthash: string,
  ): Promise<ScriptHashMempool> {
    return this.request<ScriptHashMempool>(
      'blockchain.scripthash.get_mempool',
      [scripthash],
    );
  }
  blockchain_scripthash_listunspent(
    scripthash: string,
  ): Promise<UnspentOutput> {
    return this.request<UnspentOutput>('blockchain.scripthash.listunspent', [
      scripthash,
    ]);
  }
  blockchain_scripthash_subscribe(
    scripthash: string,
  ): Promise<ScriptHashStatus> {
    return this.request<ScriptHashStatus>('blockchain.scripthash.subscribe', [
      scripthash,
    ]);
  }
  blockchain_outpoint_subscribe(hash: string, out: string) {
    return this.request('blockchain.outpoint.subscribe', [hash, out]);
  }
  blockchain_stakervote_subscribe(scripthash: string) {
    return this.request('blockchain.stakervote.subscribe', [scripthash]);
  }
  blockchain_consensus_subscribe() {
    return this.request('blockchain.consensus.subscribe', []);
  }
  blockchain_dao_subscribe() {
    return this.request('blockchain.dao.subscribe', []);
  }
  blockchain_scripthash_unsubscribe(scripthash: string) {
    return this.request<boolean>('blockchain.scripthash.unsubscribe', [
      scripthash,
    ]);
  }
  blockchain_outpoint_unsubscribe(hash: string, out: string) {
    return this.request('blockchain.outpoint.unsubscribe', [hash, out]);
  }
  blockchain_block_header(
    height: number,
    cpHeight = 0,
  ): Promise<string | BlockHeader> {
    return this.request('blockchain.block.header', [height, cpHeight]);
  }
  blockchain_block_headers(
    startHeight: number,
    count: number,
    cpHeight = 0,
  ): Promise<BlockHeaders | BlockHeadersDetail> {
    return this.request('blockchain.block.headers', [
      startHeight,
      count,
      cpHeight,
    ]);
  }
  blockchain_estimatefee(number: number): Promise<number> {
    return this.request<number>('blockchain.estimatefee', [number]);
  }
  blockchain_headers_subscribe(): Promise<HeadersSubscribeOutput> {
    return this.request<HeadersSubscribeOutput>(
      'blockchain.headers.subscribe',
      [],
    );
  }
  blockchain_relayfee(): Promise<number> {
    return this.request('blockchain.relayfee', []);
  }
  blockchain_transaction_broadcast(rawtx: string): Promise<string> {
    return this.request<string>('blockchain.transaction.broadcast', [rawtx]);
  }
  async blockchain_transaction_get<B extends boolean>(
    tx_hash: string,
    verbose: B = false as B,
  ): Promise<Transaction<B>> {
    return await this.request<Transaction<B>>('blockchain.transaction.get', [
      tx_hash,
      verbose,
    ]);
  }
  blockchain_transaction_getKeys(tx_hash: string) {
    return this.request('blockchain.transaction.get_keys', [tx_hash]);
  }
  blockchain_staking_getKeys(spending_pkh: string) {
    return this.request('blockchain.staking.get_keys', [spending_pkh]);
  }
  blockchain_token_getToken(id: string) {
    return this.request('blockchain.token.get_token', [id]);
  }
  blockchain_token_getNft(id: string, subid: string, get_utxo: boolean) {
    return this.request('blockchain.token.get_nft', [
      id,
      subid,
      get_utxo ? get_utxo : false,
    ]);
  }
  blockchain_transaction_getMerkle(tx_hash: string, height: number) {
    return this.request<MerkleOutput>('blockchain.transaction.get_merkle', [
      tx_hash,
      height,
    ]);
  }
  mempool_getFeeHistogram() {
    return this.request<FeeHistogram>('mempool.get_fee_histogram', []);
  }
  /*
  // ---------------------------------
  // protocol 1.1 deprecated method
  // ---------------------------------
  blockchain_utxo_getAddress(tx_hash: string, index: number) {
    return this.request('blockchain.utxo.get_address', [tx_hash, index]);
  }
  blockchain_numblocks_subscribe() {
    return this.request('blockchain.numblocks.subscribe', []);
  }
  // ---------------------------------
  // protocol 1.2 deprecated method
  // ---------------------------------
  blockchain_block_getChunk(index: number) {
    return this.request('blockchain.block.get_chunk', [index]);
  }
  blockchain_address_getBalance(address: string) {
    return this.request('blockchain.address.get_balance', [address]);
  }
  blockchain_address_getHistory(address: string) {
    return this.request('blockchain.address.get_history', [address]);
  }
  blockchain_address_getMempool(address: string) {
    return this.request('blockchain.address.get_mempool', [address]);
  }
  blockchain_address_listunspent(address: string) {
    return this.request('blockchain.address.listunspent', [address]);
  }
  blockchain_address_subscribe(address: string) {
    return this.request('blockchain.address.subscribe', [address]);
  }
  blockchain_scripthash_getBalanceBatch(scripthash: string) {
    return this.requestBatch("blockchain.scripthash.get_balance", scripthash);
  }
  blockchain_scripthash_listunspentBatch(scripthash: string) {
    return this.requestBatch("blockchain.scripthash.listunspent", scripthash);
  }
  blockchain_scripthash_getHistoryBatch(scripthash: string) {
    return this.requestBatch("blockchain.scripthash.get_history", scripthash);
  }
  blockchain_transaction_getBatch(tx_hash: string, verbose: boolean) {
    return this.requestBatch("blockchain.transaction.get", tx_hash, verbose);
  }
  */
}
