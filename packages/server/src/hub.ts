import type {
  ServerToClientMessage,
  ClientToServerMessage,
  ChannelPatch,
  HexColor,
} from '@msgbusviz/protocol';
import type { NormalizedConfig, NormalizedChannel } from '@msgbusviz/core';

const BACKPRESSURE_BYTES = 1_000_000;

export interface ConnectionLike {
  readonly id: string;
  send(msg: ServerToClientMessage): void;
  close(): void;
  readonly bufferedAmount: number;
}

export interface HubLogger {
  info(msg: string): void;
  warn(msg: string): void;
  verbose?(msg: string): void;
}

export class Hub {
  private connections = new Map<string, ConnectionLike>();
  private channelPatches = new Map<string, ChannelPatch>();
  private idCounter = 0;
  private editEnabled: boolean;
  private onSaveConfig?: (config: unknown) => void;

  constructor(
    private config: NormalizedConfig,
    private logger: HubLogger,
    options: { editEnabled?: boolean; onSaveConfig?: (config: unknown) => void } = {},
  ) {
    this.editEnabled = options.editEnabled ?? false;
    this.onSaveConfig = options.onSaveConfig;
  }

  setConfig(config: NormalizedConfig): void {
    this.config = config;
    this.channelPatches.clear();
    this.broadcast({ type: 'configUpdated', config });
  }

  getConfig(): NormalizedConfig {
    return this.config;
  }

  isEditEnabled(): boolean {
    return this.editEnabled;
  }

  attach(conn: ConnectionLike): void {
    this.connections.set(conn.id, conn);
    conn.send({ type: 'hello', protocolVersion: 1, config: this.config });
  }

  detach(connId: string): void {
    this.connections.delete(connId);
  }

  handle(connId: string, msg: ClientToServerMessage): void {
    this.logger.verbose?.(`recv ${msg.type} from ${connId}`);
    const conn = this.connections.get(connId);
    if (!conn) return;

    switch (msg.type) {
      case 'sendMessage':
        this.handleSendMessage(conn, msg);
        break;
      case 'updateChannel':
        this.handleUpdateChannel(conn, msg);
        break;
      case 'saveConfig':
        this.handleSaveConfig(conn, msg);
        break;
    }
  }

  private handleSendMessage(
    conn: ConnectionLike,
    msg: Extract<ClientToServerMessage, { type: 'sendMessage' }>,
  ): void {
    const channel = this.config.channels[msg.channel];
    if (!channel) {
      conn.send({ type: 'error', code: 'unknown_channel', message: `unknown channel "${msg.channel}"` });
      return;
    }

    const fromOk = this.resolveFrom(msg.channel, channel, msg.from);
    if (fromOk.ok === false) {
      conn.send({ type: 'error', code: 'invalid_publisher', message: fromOk.message });
      return;
    }
    const from = fromOk.value;

    let subscribers: string[];
    if (msg.to !== undefined) {
      if (!channel.subscribers.includes(msg.to)) {
        conn.send({
          type: 'error',
          code: 'unknown_subscriber',
          message: `subscriber "${msg.to}" not in channel "${msg.channel}"`,
        });
        return;
      }
      subscribers = [msg.to];
    } else {
      subscribers = channel.subscribers;
    }

    const color = msg.color ?? this.effectiveColor(msg.channel, channel);
    const spawnedAt = Date.now();
    for (const to of subscribers) {
      const id = `m_${++this.idCounter}`;
      const out: ServerToClientMessage = {
        type: 'messageSent',
        id,
        channel: msg.channel,
        from,
        to,
        color,
        spawnedAt,
        ...(msg.label !== undefined ? { label: msg.label } : {}),
      };
      this.broadcast(out, { droppable: true });
    }
  }

  private handleUpdateChannel(
    conn: ConnectionLike,
    msg: Extract<ClientToServerMessage, { type: 'updateChannel' }>,
  ): void {
    if (!this.config.channels[msg.channel]) {
      conn.send({ type: 'error', code: 'unknown_channel', message: `unknown channel "${msg.channel}"` });
      return;
    }
    const merged = { ...this.channelPatches.get(msg.channel), ...msg.patch };
    this.channelPatches.set(msg.channel, merged);
    this.broadcast({ type: 'channelUpdated', channel: msg.channel, patch: msg.patch });
  }

  private handleSaveConfig(
    conn: ConnectionLike,
    msg: Extract<ClientToServerMessage, { type: 'saveConfig' }>,
  ): void {
    if (!this.editEnabled) {
      conn.send({ type: 'error', code: 'edit_disabled', message: 'server not started with --edit' });
      return;
    }
    if (!this.onSaveConfig) {
      conn.send({ type: 'error', code: 'save_failed', message: 'no save handler configured' });
      return;
    }
    try {
      this.onSaveConfig(msg.config);
    } catch (err) {
      conn.send({
        type: 'error',
        code: 'save_failed',
        message: `save failed: ${(err as Error).message}`,
      });
    }
  }

  effectiveColor(channelKey: string, channel: NormalizedChannel): HexColor {
    return (this.channelPatches.get(channelKey)?.color ?? channel.color) as HexColor;
  }

  private resolveFrom(
    channelKey: string,
    channel: NormalizedChannel,
    from: string | undefined,
  ): { ok: true; value: string } | { ok: false; message: string } {
    if (from !== undefined) {
      if (!channel.publishers.includes(from)) {
        return {
          ok: false,
          message: `publisher "${from}" not in channel "${channelKey}"`,
        };
      }
      return { ok: true, value: from };
    }
    if (channel.publishers.length === 1) {
      return { ok: true, value: channel.publishers[0]! };
    }
    return {
      ok: false,
      message: `channel "${channelKey}" has multiple publishers; "from" is required`,
    };
  }

  private broadcast(msg: ServerToClientMessage, opts: { droppable?: boolean } = {}): void {
    for (const conn of this.connections.values()) {
      if (opts.droppable && conn.bufferedAmount > BACKPRESSURE_BYTES) {
        this.logger.warn(`dropping ${msg.type} for ${conn.id} (backpressure)`);
        continue;
      }
      conn.send(msg);
    }
  }
}
