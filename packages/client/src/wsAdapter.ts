export interface WsLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (ev: any) => void): void;
  removeEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (ev: any) => void): void;
}

export type WsFactory = (url: string) => WsLike;

export const defaultWsFactory: WsFactory = (url) => {
  const g = globalThis as { WebSocket?: new (u: string) => WsLike };
  if (g.WebSocket) return new g.WebSocket(url);
  throw new Error(
    'No global WebSocket. In Node, install `ws` and pass `wsFactory: (u) => new WebSocket(u)`.',
  );
};
