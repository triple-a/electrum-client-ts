import EventEmitter from 'events';
import {
  Protocol,
  SocketClient,
  Logger,
  SocketClientOptions,
  DefaultLogger,
} from '../socket/socket_client';
import { TCPSocketClient } from '../socket/socket_client_tcp';
import { WebSocketClient } from '../socket/socket_client_ws';
import { JsonRpcResponse } from '../socket/types';
import * as util from './util';

const keepAliveInterval = 120 * 1000; // 2 minutes

export interface PersistencePolicy {
  maxRetry: number;
  callback: () => void;
}

export type ElectrumClientOptions = {
  logger: Logger;
  nextReqId: () => string;
};

export class ElectrumClient {
  private timeLastCall: number = 0;
  private clientName: string = '';
  private protocolVersion: string = '1.4';
  private persistencePolicy?: PersistencePolicy;
  private timeout: NodeJS.Timeout | number = 0;
  private cache: Map<string, unknown> = new Map();

  private socketClient: SocketClient;

  private _reqId: number = 0;
  private callbackMessageQueue: Map<string, util.PromiseResult>;
  private nextReqId: () => string;
  private logger: Logger;
  private reconnectWhenClose: boolean = true;

  public subscribe: EventEmitter;

  constructor(
    private host: string,
    private port: number,
    private protocol: Protocol,
    private options?: ElectrumClientOptions,
  ) {
    this.subscribe = new EventEmitter();
    this.callbackMessageQueue = new Map();

    this.nextReqId = options?.nextReqId || (() => String(++this._reqId));
    this.logger = options?.logger || new DefaultLogger();

    this.socketClient = this._createSocketClient();
  }

  _createSocketClient() {
    let socketClient;
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

  async connect(
    clientName: string,
    electrumProtocolVersion: string,
    persistencePolicy?: PersistencePolicy,
  ) {
    this.persistencePolicy = persistencePolicy;

    this.timeLastCall = 0;
    this.clientName = clientName;
    this.protocolVersion = electrumProtocolVersion || '1.4';
    this.persistencePolicy = persistencePolicy;

    if (!this.isConnected()) {
      try {
        await this.socketClient.initialize();

        // Negotiate protocol version.
        const version = await this.server_version(
          clientName || 'electrum-js',
          electrumProtocolVersion || '1.4',
        );
        this.logger.info(`Negotiated version: [${version}]`);

        // this.onReady();

        // Get banner.
        const banner = await this.server_banner();
        this.logger.info(banner);
      } catch (err) {
        this.socketClient.emitError(
          `failed to connect to electrum server: [${err}]`,
        );
      }

      this.keepAlive();
    }
  }

  onSocketClose() {
    this.logger.debug('socket.close');

    this.cache.clear();

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

  async request(method: string, params: unknown[]) {
    if (!this.isConnected()) {
      throw new Error('connection not established');
    }

    this.timeLastCall = new Date().getTime();

    this.logger.debug(`request: [${method}]`);

    const response = new Promise((resolve, reject) => {
      const msgId = this.nextReqId();

      const content = util.makeRequest(method, params, msgId);

      this.callbackMessageQueue.set(
        msgId,
        util.createPromiseResult<unknown>(resolve, reject),
      );

      this.socketClient.send(content + '\n');
    });

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
      return await this.connect(
        this.clientName,
        this.protocolVersion,
        this.persistencePolicy,
      );
    } catch (e) {
      this.logger.error('Failed to reconnect: ' + e);
    }
  }

  // ElectrumX API
  //
  // Documentation:
  // https://electrumx.readthedocs.io/en/latest/protocol-methods.html
  //
  async server_version(clientName: string, protocolVersion: string) {
    if (this.cache.has('server.version')) {
      return this.cache.get('server.version');
    }
    const res = await this.request('server.version', [
      clientName,
      protocolVersion,
    ]);
    this.cache.set('server.version', res);
    return res;
  }
  async server_banner() {
    const res = await this.request('server.banner', []);
    console.log(res);
    return res;
  }
  server_ping() {
    return this.request('server.ping', []);
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
    return this.request('server.peers.subscribe', []);
  }
  blockchain_address_getProof(address: string) {
    return this.request('blockchain.address.get_proof', [address]);
  }
  blockchain_dotnav_resolveName(name: string, subdomains: string) {
    return this.request('blockchain.dotnav.resolve_name', [name, subdomains]);
  }
  blockchain_scripthash_getBalance(scripthash: string) {
    return this.request('blockchain.scripthash.get_balance', [scripthash]);
  }
  blockchain_scripthash_getHistory(
    scripthash: string,
    height = 0,
    to_height = -1,
  ) {
    if (this.protocolVersion == '1.5') {
      return this.request('blockchain.scripthash.get_history', [
        scripthash,
        height,
        to_height,
      ]);
    } else {
      return this.request('blockchain.scripthash.get_history', [scripthash]);
    }
  }
  blockchain_scripthash_getMempool(scripthash: string) {
    return this.request('blockchain.scripthash.get_mempool', [scripthash]);
  }
  blockchain_scripthash_listunspent(scripthash: string) {
    return this.request('blockchain.scripthash.listunspent', [scripthash]);
  }
  blockchain_scripthash_subscribe(scripthash: string) {
    return this.request('blockchain.scripthash.subscribe', [scripthash]);
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
    return this.request('blockchain.scripthash.unsubscribe', [scripthash]);
  }
  blockchain_outpoint_unsubscribe(hash: string, out: string) {
    return this.request('blockchain.outpoint.unsubscribe', [hash, out]);
  }
  blockchain_block_header(height: number, cpHeight = 0) {
    return this.request('blockchain.block.header', [height, cpHeight]);
  }
  blockchain_block_headers(startHeight: number, count: number, cpHeight = 0) {
    return this.request('blockchain.block.headers', [
      startHeight,
      count,
      cpHeight,
    ]);
  }
  blockchainEstimatefee(number: number) {
    return this.request('blockchain.estimatefee', [number]);
  }
  blockchain_headers_subscribe() {
    return this.request('blockchain.headers.subscribe', []);
  }
  blockchain_relayfee() {
    return this.request('blockchain.relayfee', []);
  }
  blockchain_transaction_broadcast(rawtx: string) {
    return this.request('blockchain.transaction.broadcast', [rawtx]);
  }
  blockchain_transaction_get(tx_hash: string, verbose: boolean) {
    return this.request('blockchain.transaction.get', [
      tx_hash,
      verbose ? verbose : false,
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
    return this.request('blockchain.transaction.get_merkle', [tx_hash, height]);
  }
  mempool_getFeeHistogram() {
    return this.request('mempool.get_fee_histogram', []);
  }
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
  /*
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
