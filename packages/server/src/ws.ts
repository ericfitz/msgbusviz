import type { WebSocket, WebSocketServer } from 'ws';
import { validateMessage } from '@msgbusviz/protocol';
import type { ServerToClientMessage } from '@msgbusviz/protocol';
import type { ConnectionLike, Hub, HubLogger } from './hub.js';

export function attachWebSocketServer(wss: WebSocketServer, hub: Hub, logger: HubLogger): void {
  let counter = 0;
  wss.on('connection', (socket: WebSocket) => {
    const id = `c${++counter}`;
    const conn: ConnectionLike = {
      id,
      send(msg: ServerToClientMessage) {
        try { socket.send(JSON.stringify(msg)); } catch (err) { logger.warn(`send failed: ${(err as Error).message}`); }
      },
      close() { try { socket.close(); } catch { /* ignore */ } },
      get bufferedAmount() { return socket.bufferedAmount; },
    };
    hub.attach(conn);

    socket.on('message', (raw) => {
      let parsed: unknown;
      try { parsed = JSON.parse(raw.toString()); }
      catch {
        conn.send({ type: 'error', code: 'schema', message: 'invalid JSON' });
        return;
      }
      const valid = validateMessage(parsed);
      if (!valid.ok) {
        conn.send({ type: 'error', code: 'schema', message: valid.errors?.join('; ') ?? 'invalid message' });
        return;
      }
      const msg = parsed as { type: string };
      if (msg.type === 'sendMessage' || msg.type === 'updateChannel' || msg.type === 'saveConfig') {
        hub.handle(id, parsed as Parameters<Hub['handle']>[1]);
      } else {
        conn.send({ type: 'error', code: 'schema', message: `unsupported message type "${msg.type}"` });
      }
    });

    socket.on('close', () => { hub.detach(id); });
    socket.on('error', (err) => { logger.warn(`socket error: ${err.message}`); hub.detach(id); });
  });
}
