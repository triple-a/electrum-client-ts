import { w3cwebsocket as W3CWebSocket } from 'websocket';
import { WsProtocol } from '../types';
import { SocketClient, SocketClientOptions } from './socket_client';

const sleep = (ms: number) =>
  new Promise((resolve, _) => setTimeout(() => resolve(true), ms));

export class WebSocketClient extends SocketClient {
  private client: W3CWebSocket;
  constructor(
    private host: string,
    private port: number,
    private protocol: WsProtocol,
    options?: SocketClientOptions,
  ) {
    super(options);
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

  async initialize() {
    // on error
    this.client.onerror = (error) => {
      this.emitError(error);
    };

    // on close
    this.client.onclose = (event) => {
      this.emitClose();
      this.emitError(
        `websocket connection closed: code: [${event.code}], reason: [${event.reason}]`,
      );
    };

    // on message
    this.client.onmessage = (message) => {
      this.emitMessage(message.data.toString('utf-8'));
    };

    // on connect
    this.client.onopen = () => {
      if (this.client.readyState === this.client.OPEN) {
        this.logger.info('connected');
        this.emitConnect();
      }
    };

    await new Promise((resolve) => {
      (async () => {
        while (this.client.readyState !== this.client.OPEN) {
          await sleep(100);
        }
        resolve(true);
      })();
    });
  }

  _close() {
    this.client.close(1000, 'close connection');
  }

  // string
  send(data: Buffer | string) {
    this.client.send(data);
  }
}
