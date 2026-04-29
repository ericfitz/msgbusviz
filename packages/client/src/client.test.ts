import { describe, it, expect, beforeEach } from 'vitest';
import { Client, type WsFactory, type WsLike } from './index.js';

class FakeWs implements WsLike {
  listeners = new Map<string, ((ev: any) => void)[]>();
  sent: string[] = [];
  closed = false;

  addEventListener(type: any, l: any): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(l);
    this.listeners.set(type, arr);
  }
  removeEventListener(type: any, l: any): void {
    const arr = this.listeners.get(type) ?? [];
    this.listeners.set(type, arr.filter((x) => x !== l));
  }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.closed = true; this.fire('close', {}); }

  fire(type: string, ev: any): void {
    for (const l of this.listeners.get(type) ?? []) l(ev);
  }
  open(): void { this.fire('open', {}); }
  receive(obj: unknown): void { this.fire('message', { data: JSON.stringify(obj) }); }
}

let fakes: FakeWs[] = [];
const factory: WsFactory = () => {
  const ws = new FakeWs();
  fakes.push(ws);
  return ws;
};

beforeEach(() => { fakes = []; });

describe('Client', () => {
  it('connect resolves on hello', async () => {
    const client = new Client({ url: 'ws://x', wsFactory: factory });
    const p = client.connect();
    fakes[0]!.open();
    fakes[0]!.receive({ type: 'hello', protocolVersion: 1, config: {} });
    await p;
  });

  it('connect rejects on protocol version mismatch', async () => {
    const client = new Client({ url: 'ws://x', wsFactory: factory, reconnect: false });
    const p = client.connect();
    fakes[0]!.open();
    fakes[0]!.receive({ type: 'hello', protocolVersion: 99, config: {} });
    await expect(p).rejects.toThrow(/protocol version mismatch/);
  });

  it('queues sendMessage when not yet connected and flushes on hello', async () => {
    const client = new Client({ url: 'ws://x', wsFactory: factory });
    client.sendMessage('orders', { from: 'A', to: 'B' });
    const p = client.connect();
    fakes[0]!.open();
    fakes[0]!.receive({ type: 'hello', protocolVersion: 1, config: {} });
    await p;
    expect(fakes[0]!.sent).toHaveLength(1);
    const m = JSON.parse(fakes[0]!.sent[0]!);
    expect(m.channel).toBe('orders');
  });

  it('drops oldest when queue exceeds maxQueue', () => {
    const errs: string[] = [];
    const client = new Client({
      url: 'ws://x',
      wsFactory: factory,
      maxQueue: 2,
      onError: (e) => errs.push(e.message),
    });
    client.sendMessage('a');
    client.sendMessage('b');
    client.sendMessage('c');
    expect(errs.some((e) => e.includes('overflow'))).toBe(true);
  });

  it('surfaces server error via onError', async () => {
    const errs: string[] = [];
    const client = new Client({
      url: 'ws://x', wsFactory: factory,
      onError: (e) => errs.push(e.message),
    });
    const p = client.connect();
    fakes[0]!.open();
    fakes[0]!.receive({ type: 'hello', protocolVersion: 1, config: {} });
    await p;
    fakes[0]!.receive({ type: 'error', code: 'unknown_channel', message: 'nope' });
    expect(errs[0]).toContain('unknown_channel');
  });

  it('reconnects after close when reconnect=true', async () => {
    const client = new Client({
      url: 'ws://x', wsFactory: factory, initialBackoffMs: 1, reconnect: true,
    });
    const p = client.connect();
    fakes[0]!.open();
    fakes[0]!.receive({ type: 'hello', protocolVersion: 1, config: {} });
    await p;
    fakes[0]!.fire('close', {});
    await new Promise((r) => setTimeout(r, 30));
    expect(fakes.length).toBeGreaterThan(1);
    fakes[1]!.open();
    fakes[1]!.receive({ type: 'hello', protocolVersion: 1, config: {} });
    client.close();
  });
});
