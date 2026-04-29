import { describe, it, expect } from 'vitest';
import { loadConfigFromString } from './load.js';
import { normalize } from './normalize.js';
import { ConfigError } from './errors.js';

const yaml = (s: string) => loadConfigFromString(s).config;

describe('normalize', () => {
  it('applies built-in node defaults', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
channels: {}
`);
    const n = normalize(raw);
    expect(n.nodes.A?.scale).toBe(1);
    expect(n.nodes.A?.color).toBe('#888888');
    expect(n.nodes.A?.label).toBe('A');
  });

  it('uses node label when provided', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube, label: "Hello" }
channels: {}
`);
    expect(normalize(raw).nodes.A?.label).toBe('Hello');
  });

  it('overrides defaults from defaults.node', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
defaults:
  node: { color: "#123456", scale: 2 }
nodes:
  A: { model: cube }
channels: {}
`);
    const n = normalize(raw);
    expect(n.nodes.A?.color).toBe('#123456');
    expect(n.nodes.A?.scale).toBe(2);
  });

  it('rejects channel referring to undefined publisher', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
channels:
  c1: { publishers: [Ghost], subscribers: [A] }
`);
    expect(() => normalize(raw)).toThrow(ConfigError);
  });

  it('rejects channel referring to undefined subscriber', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
channels:
  c1: { publishers: [A], subscribers: [Ghost] }
`);
    expect(() => normalize(raw)).toThrow(ConfigError);
  });

  it('rejects manual layout when a node lacks position', () => {
    const raw = yaml(`
version: 1
layout: { mode: manual }
nodes:
  A: { model: cube, position: [0,0,0] }
  B: { model: cube }
channels: {}
`);
    expect(() => normalize(raw)).toThrow(/B.*position/);
  });

  it('applies channel defaults', () => {
    const raw = yaml(`
version: 1
layout: { mode: force }
nodes:
  A: { model: cube }
  B: { model: cube }
channels:
  c1: { publishers: [A], subscribers: [B] }
`);
    const n = normalize(raw);
    expect(n.channels.c1?.speed).toBe(500);
    expect(n.channels.c1?.color).toBe('#cccccc');
    expect(n.channels.c1?.messageModel).toBe('sphere');
  });
});
