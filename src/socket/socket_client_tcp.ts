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
  private readyStateTimer: NodeJS.Timeout | null = null;

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
  }

  _close() {
    if (this.readyStateTimer) {
      clearInterval(this.readyStateTimer);
    }
    this.client.destroy();
  }

  send(data: string | Uint8Array) {
    this.client.write(data);
  }

  async initialize() {
    await new Promise((resolve) => {
      this.client.connect(this.port, this.host, () => {
        this.logger.info('connected');
        this.emitConnect();
        resolve(true);
      });
    });

    this.client.setTimeout(TIMEOUT);
    this.client.setEncoding('utf8');
    this.client.setKeepAlive(true, 0);
    this.client.setNoDelay(true);

    // on connect
    this.client.on('connect', () => {
      this.client.setTimeout(0);
      this.logger.debug('onConnect');
      this.emitConnect();
    });

    // on close
    this.client.on('close', (hadError: boolean) => {
      this.logger.debug(`onClose: ${hadError}`);
      this.emitClose();
    });

    // on timeout
    this.client.on('timeout', () => {
      const e = new Error('ETIMEDOUT') as SocketError;
      e.errorno = 'ETIMEDOUT';
      e.code = 'ETIMEDOUT';
      e.connect = false;
      this.client.emit('error', e);
    });

    // on data
    this.client.on('data', (chunk) => {
      this.client.setTimeout(0);
      this.logger.debug(`onData: [${chunk}]`);
      this.mp.run(chunk);
    });

    // on end
    this.client.on('end', () => {
      this.client.setTimeout(0);
      this.emitEnd();
    });

    // on error
    this.client.on('error', (e: Error) => {
      this.logger.error(`onError: [${e}]`);
      this.emitError(e);
    });

    this.readyStateTimer = setInterval(() => {
      this.logger.debug('readyState: ', this.client.readyState);
    }, 1000);
  }
}
