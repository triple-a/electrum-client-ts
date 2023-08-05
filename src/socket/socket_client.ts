import { EventEmitter } from 'events';
import { ISocketClient, Logger } from './types';
import tls from 'tls';

export { Protocol, Logger } from './types';

export type SocketClientOptions = {
  logger?: Logger;
} & tls.TLSSocketOptions;

export class DefaultLogger implements Logger {
  public level: string = 'info';
  private levels: { [key: string]: number } = {
    error: 40,
    warn: 20,
    info: 10,
    debug: 0,
  };
  _log(level: string, ...args: any[]) {
    if (this.levels[level] >= this.levels[this.level]) {
      console.log(`${new Date().toISOString()} [${level}]`, ...args);
    }
  }
  error(...args: any[]) {
    this._log('error', ...args);
  }
  warn(...args: any[]) {
    this._log('warn', ...args);
  }
  info(...args: any[]) {
    this._log('info', ...args);
  }
  debug(...args: any[]) {
    this._log('debug', ...args);
  }
}

export abstract class SocketClient implements ISocketClient {
  protected id: number = 0;
  protected connected: boolean = false;
  protected subscribe: EventEmitter;
  protected logger: Logger;

  constructor(protected options?: SocketClientOptions) {
    this.subscribe = new EventEmitter();
    this.logger = options?.logger || new DefaultLogger();
  }

  abstract _doConnect(): Promise<boolean>;

  async connect(): Promise<boolean> {
    if (this.connected) {
      return Promise.resolve(true);
    }

    this.connected = await this._doConnect();

    return this.connected;
  }

  abstract _doClose(): void;

  close(): void {
    if (!this.connected) {
      return;
    }

    this._doClose();

    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  on(eventName: string, listener: (...args: any[]) => void) {
    this.subscribe.on(eventName, listener);
  }

  emit(eventName: string, ...args: any[]) {
    this.subscribe.emit(eventName, ...args);
  }

  abstract send(data: string | Uint8Array): void;

  emitMessage(body: string) {
    this.subscribe.emit('socket.message', body);
  }

  emitConnect() {
    this.subscribe.emit('socket.connect');
  }

  emitReady() {
    this.subscribe.emit('socket.ready');
  }

  emitClose() {
    this.connected = false;
    this.subscribe.emit('socket.close');
  }

  emitEnd(error?: Error | unknown) {
    this.subscribe.emit('socket.end', error);
  }

  emitError(error: Error | unknown) {
    this.subscribe.emit('socket.error', `onError: [${error}]`);
  }
}
