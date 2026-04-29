import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfigFromString, normalize, type NormalizedConfig } from '@msgbusviz/core';
import type { ServerToClientMessage } from '@msgbusviz/protocol';
import { Hub, type ConnectionLike, type HubLogger } from './hub.js';

class FakeConn implements ConnectionLike {
  readonly id: string;
  sent: ServerToClientMessage[] = [];
  closed = false;
  bufferedAmount = 0;
  constructor(id: string) { this.id = id; }
  send(msg: ServerToClientMessage): void { this.sent.push(msg); }
  close(): void { this.closed = true; }
}

const silentLogger: HubLogger = { info: () => {}, warn: () => {} };

function loadConfig(yaml: string): NormalizedConfig {
  return normalize(loadConfigFromString(yaml).config);
}

const baseYaml = `
version: 1
layout: { mode: force }
nodes:
  Client: { model: client }
  Server: { model: server }
channels:
  webRequest: { publishers: [Client], subscribers: [Server] }
  fan: { publishers: [Server], subscribers: [Client] }
`;

describe('Hub', () => {
  let hub: Hub;
  let conn: FakeConn;

  beforeEach(() => {
    hub = new Hub(loadConfig(baseYaml), silentLogger);
    conn = new FakeConn('c1');
  });

  it('sends hello on attach', () => {
    hub.attach(conn);
    expect(conn.sent[0]?.type).toBe('hello');
  });

  it('expands a sendMessage with no `to` into one event per subscriber', () => {
    const yaml = `
version: 1
layout: { mode: force }
nodes:
  P: { model: cube }
  S1: { model: cube }
  S2: { model: cube }
  S3: { model: cube }
channels:
  evt: { publishers: [P], subscribers: [S1, S2, S3] }
`;
    hub = new Hub(loadConfig(yaml), silentLogger);
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'evt' });
    const sent = conn.sent.filter((m) => m.type === 'messageSent');
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((m) => m.type === 'messageSent' ? m.to : null))).toEqual(
      new Set(['S1', 'S2', 'S3']),
    );
  });

  it('targets a single subscriber when `to` is provided', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'webRequest', to: 'Server' });
    const sent = conn.sent.filter((m) => m.type === 'messageSent');
    expect(sent).toHaveLength(1);
  });

  it('rejects unknown channel', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'ghost' });
    expect(conn.sent[0]?.type).toBe('error');
    if (conn.sent[0]?.type === 'error') expect(conn.sent[0].code).toBe('unknown_channel');
  });

  it('rejects unknown subscriber', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'webRequest', to: 'Ghost' });
    expect(conn.sent[0]?.type).toBe('error');
    if (conn.sent[0]?.type === 'error') expect(conn.sent[0].code).toBe('unknown_subscriber');
  });

  it('requires from when channel has multiple publishers', () => {
    const yaml = `
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
  B: { model: cube }
  C: { model: cube }
channels:
  evt: { publishers: [A, B], subscribers: [C] }
`;
    hub = new Hub(loadConfig(yaml), silentLogger);
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'evt' });
    expect(conn.sent[0]?.type).toBe('error');
    if (conn.sent[0]?.type === 'error') expect(conn.sent[0].code).toBe('invalid_publisher');
  });

  it('rejects from not in publishers', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'webRequest', from: 'Mystery' });
    expect(conn.sent[0]?.type).toBe('error');
  });

  it('updateChannel broadcasts patch', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'updateChannel', channel: 'webRequest', patch: { color: '#abcdef' } });
    const found = conn.sent.find((m) => m.type === 'channelUpdated');
    expect(found).toBeTruthy();
  });

  it('saveConfig with edit disabled returns error', () => {
    hub.attach(conn);
    conn.sent = [];
    hub.handle('c1', { type: 'saveConfig', config: {} });
    expect(conn.sent[0]?.type).toBe('error');
    if (conn.sent[0]?.type === 'error') expect(conn.sent[0].code).toBe('edit_disabled');
  });

  it('drops messageSent under backpressure', () => {
    hub.attach(conn);
    conn.bufferedAmount = 2_000_000;
    conn.sent = [];
    hub.handle('c1', { type: 'sendMessage', channel: 'webRequest' });
    expect(conn.sent.filter((m) => m.type === 'messageSent')).toHaveLength(0);
  });
});
