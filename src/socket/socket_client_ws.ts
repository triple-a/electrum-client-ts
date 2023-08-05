import { w3cwebsocket as W3CWebSocket } from 'websocket';
import { SocketClient, SocketClientOptions } from './socket_client';
import { WsProtocol } from './types';

export class WebSocketClient extends SocketClient {
  private client: W3CWebSocket;
  constructor(
    private host: string,
    private port: number,
    private protocol: WsProtocol,
    options?: SocketClientOptions,
  ) {
    super();
    const url = `${this.protocol}://${this.host}:${this.port}`;

    // TODO: Add docs
    // https://github.com/theturtle32/WebSocket-Node/blob/master/docs/W3CWebSocket.md#constructor
    this.client = new W3CWebSocket(
      url,
      undefined,
      undefined,
      undefined,
      options,
    );
  }

  async _doConnect() {
    const client = this.client;

    return new Promise<boolean>((resolve, _reject) => {
      client.onerror = (error) => {
        this.emitError(error);
      };

      client.onclose = (event) => {
        this.emitClose();
        this.emitError(
          `websocket connection closed: code: [${event.code}], reason: [${event.reason}]`,
        );
      };

      client.onmessage = (message) => {
        this.emitMessage(message.data.toString('utf-8'));
      };

      client.onopen = () => {
        if (client.readyState === client.OPEN) {
          this.emitConnect();
          resolve(true);
        }
      };
    });
  }

  async _doClose() {
    this.client.close(1000, 'close connection');
  }

  // string
  send(data: Buffer | string) {
    this.client.send(data);
  }
}
