import { type ServerToClientMessage } from '@msgbusviz/protocol';
export interface ViewerWsHandlers {
    onHello(config: unknown): void;
    onConfigUpdated(config: unknown): void;
    onMessageSent(msg: Extract<ServerToClientMessage, {
        type: 'messageSent';
    }>): void;
    onChannelUpdated(channel: string, patch: unknown): void;
    onError(message: string): void;
}
export declare class ViewerWs {
    private ws;
    private handlers;
    private url;
    private wantedClose;
    private reconnectMs;
    constructor(url: string, handlers: ViewerWsHandlers);
    start(): void;
    send(obj: unknown): void;
    close(): void;
    private open;
}
//# sourceMappingURL=viewerWs.d.ts.map