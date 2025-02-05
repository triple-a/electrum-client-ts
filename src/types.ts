export interface Logger {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (...args: any[]) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (...args: any[]) => void;
}

export type TCPProtocol = 'tcp' | 'ssl' | 'tls';
export type WsProtocol = 'ws' | 'wss';
export type Protocol = WsProtocol | TCPProtocol;

export interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: unknown[];
  id?: string;
}

export interface JsonRpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?:
    | string
    | {
        code: number;
        message: string;
      };
  id: string;
}

export type VersionOutput = [
  string, // client version
  string, // protocol version
];

export type PeersSubscribeResult = Array<
  [string, string, [string, string, string, string]]
>;

export type BalanceOutput = {
  confirmed: number;
  unconfirmed: number;
};

export interface ConfirmedTransactionOutput {
  height: number;
  tx_hash: string;
}

export interface UnconfirmedTransactionOutput
  extends ConfirmedTransactionOutput {
  fee: number;
}

export type ScriptHashHistoryItem =
  | ConfirmedTransactionOutput
  | UnconfirmedTransactionOutput;

export type ScriptHashHistory = ScriptHashHistoryItem[];

export type AddressDetailedHistoryItem = Transaction<true> & {
  height: number;
  direction?: 'outgoing' | 'incoming';
  amount?: number;
  fee?: number;
  fee_sats?: number;
};

export type ScriptHashMempool = UnconfirmedTransactionOutput[];

export interface UnspentOutput extends ConfirmedTransactionOutput {
  tx_pos: number;
  value: number;
}

export type ScriptHashStatus = string;

export type HeadersSubscribeOutput = {
  height: number;
  hex: string;
};

export type ScriptSig = {
  asm: string;
  hex: string;
};

export interface BlockHeader {
  branch: string[];
  header: string;
  root: string;
}

export interface BlockHeaders {
  count: number;
  hex: string;
  max: number;
}

export interface BlockHeadersDetail extends BlockHeaders {
  root: string;
  branch: string[];
}

export type TransactionInput = {
  txid: string;
  vout: number;
  scriptSig: ScriptSig;
  sequence: number;
  prevout?: TransactionOutput;
  txinwitness?: string[];
};

export interface ScriptPubkey extends ScriptSig {
  reqSigs: number;
  type: string;
  addresses?: Array<string>;
  address?: string;
  desc?: string;
}

export type TransactionOutput = {
  value: number;
  n: number;
  scriptPubKey: ScriptPubkey;
};

export interface TransactionDetail {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  weight: number;
  locktime: number;
  vin: Array<TransactionInput>;
  vout: Array<TransactionOutput>;
  hex: string;
  blockhash: string;
  confirmations: number;
  time: number;
  blocktime: number;
}

export type Transaction<T extends boolean> = T extends true
  ? TransactionDetail
  : string;

export interface MerkleOutput {
  block_height: number;
  merkle: string[];
  pos: number;
}

export type FeeHistogram = Array<[number, number]>;
