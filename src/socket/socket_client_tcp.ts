import { Socket } from 'net';
import tls from 'tls';
import { SocketClient, SocketClientOptions } from './socket_client';
import { TCPProtocol } from './types';
import { MessageParser } from './util';

const TIMEOUT = 10000;

export type SocketError = Error & {
  errorno: string;
  code: string;
  connect: boolean;
};

export class TCPSocketClient extends SocketClient {
  private client: Socket;
  private mp: MessageParser;

  constructor(
    private host: string,
    private port: number,
    private protocol: TCPProtocol,
    options?: SocketClientOptions,
  ) {
    super(options);

    switch (this.protocol) {
      case 'tcp':
        this.client = new Socket();
        break;
      case 'tls':
      case 'ssl':
        this.client = new tls.TLSSocket(
          undefined as any,
          options as tls.TLSSocketOptions,
        );
        break;
      default:
        throw new Error(`not supported protocol ${protocol}`);
    }

    this.mp = new MessageParser((body) => {
      this.emitMessage(body);
    });

    this.initialize();
  }

  async _doConnect(): Promise<boolean> {
    const client = this.client;

    return new Promise<boolean>((resolve, reject) => {
      const errorHandler = (e: unknown) => reject(e);
      client.connect(this.port, this.host, () => {
        client.removeListener('error', errorHandler);
        this.logger.info('connected');
        resolve(true);
      });
      client.on('error', errorHandler);
    });
  }

  _doClose() {
    this.client.end();
    this.client.destroy();
  }

  send(data: string | Uint8Array) {
    this.client.write(data);
  }

  initialize() {
    const conn = this.client;

    conn.setTimeout(TIMEOUT);
    conn.setEncoding('utf8');
    conn.setKeepAlive(true, 0);
    conn.setNoDelay(true);

    conn.on('connect', () => {
      conn.setTimeout(0);
      this.logger.debug('onConnect');
      this.emitConnect();
    });

    conn.on('close', (_hadError: boolean) => {
      this.logger.debug('onClose');
      this.emitClose();
    });

    conn.on('timeout', () => {
      const e = new Error('ETIMEDOUT') as SocketError;
      e.errorno = 'ETIMEDOUT';
      e.code = 'ETIMEDOUT';
      e.connect = false;
      conn.emit('error', e);
    });

    conn.on('data', (chunk) => {
      conn.setTimeout(0);
      this.logger.debug(`onData: [${chunk}]`);
      this.mp.run(chunk);
    });

    conn.on('end', () => {
      conn.setTimeout(0);
      this.emitEnd();
    });

    conn.on('error', (e: Error) => {
      this.logger.error(`onError: [${e}]`);
      this.emitError(e);
    });
  }
}
