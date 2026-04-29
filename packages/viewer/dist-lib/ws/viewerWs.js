import { PROTOCOL_VERSION, validateMessage } from '@msgbusviz/protocol';
export class ViewerWs {
    ws = null;
    handlers;
    url;
    wantedClose = false;
    reconnectMs = 250;
    constructor(url, handlers) {
        this.url = url;
        this.handlers = handlers;
    }
    start() { this.open(); }
    send(obj) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(obj));
        }
    }
    close() {
        this.wantedClose = true;
        this.ws?.close();
    }
    open() {
        const ws = new WebSocket(this.url);
        this.ws = ws;
        ws.addEventListener('message', (ev) => {
            let parsed;
            try {
                parsed = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data));
            }
            catch {
                this.handlers.onError('non-JSON frame');
                return;
            }
            const v = validateMessage(parsed);
            if (!v.ok) {
                this.handlers.onError(v.errors?.join('; ') ?? 'invalid message');
                return;
            }
            switch (parsed.type) {
                case 'hello':
                    if (parsed.protocolVersion !== PROTOCOL_VERSION) {
                        this.handlers.onError(`protocol version mismatch (server=${parsed.protocolVersion})`);
                        return;
                    }
                    this.reconnectMs = 250;
                    this.handlers.onHello(parsed.config);
                    break;
                case 'configUpdated':
                    this.handlers.onConfigUpdated(parsed.config);
                    break;
                case 'messageSent':
                    this.handlers.onMessageSent(parsed);
                    break;
                case 'channelUpdated':
                    this.handlers.onChannelUpdated(parsed.channel, parsed.patch);
                    break;
                case 'error':
                    this.handlers.onError(`${parsed.code}: ${parsed.message}`);
                    break;
            }
        });
        ws.addEventListener('close', () => {
            if (this.wantedClose)
                return;
            setTimeout(() => this.open(), this.reconnectMs);
            this.reconnectMs = Math.min(this.reconnectMs * 2, 30_000);
        });
        ws.addEventListener('error', () => this.handlers.onError('socket error'));
    }
}
//# sourceMappingURL=viewerWs.js.map