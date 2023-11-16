import { EventEmitter } from 'events';
import tls from 'tls';
import { Logger } from '../types';

export { Protocol, Logger } from '../types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export type SocketClientOptions = {
  logLevel?: LogLevel;
  logger?: Logger;
} & tls.TLSSocketOptions;

export class DefaultLogger implements Logger {
  private level: string = process.env.SOCKET_LOG_LEVEL || 'info';
  private levels: { [key: string]: number } = {
    none: 100,
    error: 40,
    warn: 20,
    info: 10,
    debug: 0,
  };
  private logger: Logger;
  constructor(logger?: Logger, level?: LogLevel) {
    if (level) {
      this.level = level;
    }
    this.logger = logger || console;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _log(level: string, ...args: any[]) {
    if (this.levels[level] >= this.levels[this.level]) {
      if (this.logger === console) {
        console.log(`${new Date().toISOString()} [${level}]`, ...args);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.logger as any)[level](...args);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(...args: any[]) {
    this._log('error', ...args);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(...args: any[]) {
    this._log('warn', ...args);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(...args: any[]) {
    this._log('info', ...args);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(...args: any[]) {
    this._log('debug', ...args);
  }
}

export abstract class SocketClient {
  protected id: number = 0;
  protected connected: boolean = false;
  protected subscribe: EventEmitter;
  protected logger: Logger;

  constructor(protected options?: SocketClientOptions) {
    this.subscribe = new EventEmitter();
    this.logger = new DefaultLogger(options?.logger, options?.logLevel);
  }

  abstract initialize(): Promise<void>;

  abstract _close(): void;

  close(): void {
    if (!this.connected) {
      return;
    }

    this._close();

    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(eventName: string, listener: (...args: any[]) => void) {
    this.subscribe.on(eventName, listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit(eventName: string, ...args: any[]) {
    this.subscribe.emit(eventName, ...args);
  }

  abstract send(data: string | Uint8Array): void;

  emitConnect() {
    this.connected = true;
    this.subscribe.emit('socket.connect');
  }

  emitMessage(message: string) {
    this.subscribe.emit('socket.message', message);
  }

  emitReady() {
    this.subscribe.emit('socket.ready');
  }

  emitClose() {
    this.connected = false;
    this.subscribe.emit('socket.close');
  }

  emitEnd(error?: Error | unknown) {
    this.connected = false;
    this.subscribe.emit('socket.end', error);
  }

  emitError(error: Error | unknown) {
    this.subscribe.emit('socket.error', `onError: [${error}]`);
  }
}
