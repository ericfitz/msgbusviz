import type { NormalizedConfig, NormalizedNode, NormalizedChannel } from '../config/normalize.js';

export interface ChannelArc {
  channelKey: string;
  publisher: string;
  subscriber: string;
}

export class Graph {
  readonly nodes: ReadonlyMap<string, NormalizedNode>;
  readonly channels: ReadonlyMap<string, NormalizedChannel>;
  readonly arcs: readonly ChannelArc[];

  constructor(config: NormalizedConfig) {
    this.nodes = new Map(Object.entries(config.nodes));
    this.channels = new Map(Object.entries(config.channels));
    this.arcs = computeArcs(config);
  }

  arcsForChannel(key: string): ChannelArc[] {
    return this.arcs.filter((a) => a.channelKey === key);
  }

  arcsBetween(publisher: string, subscriber: string): ChannelArc[] {
    return this.arcs.filter((a) => a.publisher === publisher && a.subscriber === subscriber);
  }
}

function computeArcs(config: NormalizedConfig): ChannelArc[] {
  const out: ChannelArc[] = [];
  for (const [key, ch] of Object.entries(config.channels)) {
    for (const p of ch.publishers) {
      for (const s of ch.subscribers) {
        out.push({ channelKey: key, publisher: p, subscriber: s });
      }
    }
  }
  return out;
}
