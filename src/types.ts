export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
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

export type AddressHistory = (
  | ConfirmedTransactionOutput
  | UnconfirmedTransactionOutput
)[];

export type AddressMempool = UnconfirmedTransactionOutput[];

export interface UnspentOutput extends ConfirmedTransactionOutput {
  tx_pos: number;
  value: number;
}

export type ScriptHashStatus = string;

export type HeadersSubscribeOutput = {
  height: number;
  hex: string;
};
