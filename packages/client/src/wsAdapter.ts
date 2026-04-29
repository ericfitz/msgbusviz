export interface WsLike {
  send(data: string): void;
  close(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (ev: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
