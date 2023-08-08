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

export interface AddressHistoryItem {
  fee: number;
  height: number;
  tx_hash: string;
}

export type AddressHistory = AddressHistoryItem[];
