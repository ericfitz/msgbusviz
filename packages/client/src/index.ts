export const CLIENT_VERSION = '0.1.0' as const;
export { Client, ClientError } from './client.js';
export type { ClientOptions, SendMessageOptions } from './client.js';
export type { WsFactory, WsLike } from './wsAdapter.js';
