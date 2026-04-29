import {
  PROTOCOL_VERSION,
  type ChannelPatch,
  type ClientToServerMessage,
  type ErrorMessage,
  type HelloMessage,
  type HexColor,
  type ServerToClientMessage,
} from '@msgbusviz/protocol';
import { defaultWsFactory, type WsFactory, type WsLike } from './wsAdapter.js';

export interface ClientOptions {
  url: string;
  reconnect?: boolean;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  maxQueue?: number;
  wsFactory?: WsFactory;
  onError?: (err: ClientError) => void;
  onConfig?: (config: unknown) => void;
}

export interface SendMessageOptions {
  from?: string;
  to?: string;
  label?: string;
  color?: HexColor;
}

export class ClientError extends Error {
  override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ClientError';
    if (cause !== undefined) this.cause = cause;
  }
}

type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export class Client {
  private opts: Required<Pick<ClientOptions, 'reconnect' | 'initialBackoffMs' | 'maxBackoffMs' | 'maxQueue'>>
    & ClientOptions;
  private ws: WsLike | null = null;
  private state: ConnectionState = 'idle';
  private queue: ClientToServerMessage[] = [];
  private backoffMs: number;
  private connectResolve: (() => void) | undefined = undefined;
  private connectReject: ((err: Error) => void) | undefined = undefined;
  private wantedClose = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: ClientOptions) {
    const reconnect = opts.reconnect ?? true;
    const initialBackoffMs = opts.initialBackoffMs ?? 250;
    const maxBackoffMs = opts.maxBackoffMs ?? 30_000;
    const maxQueue = opts.maxQueue ?? 1000;
    this.opts = {
      ...opts,
      reconnect,
      initialBackoffMs,
      maxBackoffMs,
      maxQueue,
    };
    this.backoffMs = this.opts.initialBackoffMs;
  }

  async connect(): Promise<void> {
    if (this.state === 'open') return;
    this.wantedClose = false;
    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openSocket();
    });
  }

  close(): void {
    this.wantedClose = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.state = 'closed';
  }

  sendMessage(channel: string, options: SendMessageOptions = {}): void {
    const msg: ClientToServerMessage = {
      type: 'sendMessage',
      channel,
      ...(options.from  !== undefined ? { from:  options.from  } : {}),
      ...(options.to    !== undefined ? { to:    options.to    } : {}),
      ...(options.label !== undefined ? { label: options.label } : {}),
      ...(options.color !== undefined ? { color: options.color } : {}),
    };
    this.send(msg);
  }

  updateChannel(channel: string, patch: ChannelPatch): void {
    this.send({ type: 'updateChannel', channel, patch });
  }

  saveConfig(config: unknown): void {
    this.send({ type: 'saveConfig', config });
  }

  private send(msg: ClientToServerMessage): void {
    if (this.state === 'open' && this.ws) {
      this.ws.send(JSON.stringify(msg));
      return;
    }
    if (this.queue.length >= this.opts.maxQueue) {
      this.queue.shift();
      this.opts.onError?.(new ClientError('queue overflow; dropped oldest message'));
    }
    this.queue.push(msg);
  }

  private openSocket(): void {
    this.state = 'connecting';
    const factory = this.opts.wsFactory ?? defaultWsFactory;
    let ws: WsLike;
    try {
      ws = factory(this.opts.url);
    } catch (err) {
      this.connectReject?.(err as Error);
      this.connectReject = undefined;
      this.connectResolve = undefined;
      return;
    }
    this.ws = ws;

    const onOpen = () => { /* wait for hello */ };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage = (ev: any) => {
      let data: ServerToClientMessage;
      try { data = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); }
      catch { this.opts.onError?.(new ClientError('non-JSON frame')); return; }

      if (data.type === 'hello') {
        const hello = data as HelloMessage;
        if (hello.protocolVersion !== PROTOCOL_VERSION) {
          const err = new ClientError(
            `protocol version mismatch: server=${hello.protocolVersion}, client=${PROTOCOL_VERSION}`,
          );
          this.opts.onError?.(err);
          this.connectReject?.(err);
          this.connectReject = undefined;
          this.connectResolve = undefined;
          this.close();
          return;
        }
        this.state = 'open';
        this.backoffMs = this.opts.initialBackoffMs;
        this.opts.onConfig?.(hello.config);
        this.flushQueue();
        if (this.connectResolve) {
          this.connectResolve();
          this.connectResolve = undefined;
          this.connectReject = undefined;
        }
      } else if (data.type === 'error') {
        const err = data as ErrorMessage;
        this.opts.onError?.(new ClientError(`${err.code}: ${err.message}`));
      } else if (data.type === 'configUpdated') {
        this.opts.onConfig?.(data.config);
      }
    };
    const onClose = () => {
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('message', onMessage);
      ws.removeEventListener('close', onClose);
      ws.removeEventListener('error', onError);
      this.ws = null;
      if (this.wantedClose || !this.opts.reconnect) {
        this.state = 'closed';
        return;
      }
      this.scheduleReconnect();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onError = (ev: any) => {
      this.opts.onError?.(new ClientError('socket error', ev));
    };

    ws.addEventListener('open', onOpen);
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    ws.addEventListener('error', onError);
  }

  private scheduleReconnect(): void {
    this.state = 'reconnecting';
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs);
    this.timer = setTimeout(() => this.openSocket(), delay);
  }

  private flushQueue(): void {
    if (!this.ws || this.state !== 'open') return;
    while (this.queue.length > 0) {
      const m = this.queue.shift()!;
      this.ws.send(JSON.stringify(m));
    }
  }
}
