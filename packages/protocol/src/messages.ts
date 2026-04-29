export type HexColor = `#${string}`;

export type ErrorCode =
  | 'unknown_channel'
  | 'invalid_publisher'
  | 'unknown_subscriber'
  | 'schema'
  | 'edit_disabled'
  | 'save_failed';

export interface ChannelPatch {
  color?: HexColor;
  speed?: number;
  size?: number;
  messageModel?: string;
}

export interface HelloMessage {
  type: 'hello';
  protocolVersion: 1;
  config: unknown;
}

export interface ConfigUpdatedMessage {
  type: 'configUpdated';
  config: unknown;
}

export interface MessageSentMessage {
  type: 'messageSent';
  id: string;
  channel: string;
  from: string;
  to: string;
  label?: string;
  color: HexColor;
  spawnedAt: number;
}

export interface ChannelUpdatedMessage {
  type: 'channelUpdated';
  channel: string;
  patch: ChannelPatch;
}

export interface ErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface SendMessageMessage {
  type: 'sendMessage';
  channel: string;
  from?: string;
  to?: string;
  label?: string;
  color?: HexColor;
}

export interface UpdateChannelMessage {
  type: 'updateChannel';
  channel: string;
  patch: ChannelPatch;
}

export interface SaveConfigMessage {
  type: 'saveConfig';
  config: unknown;
}

export type ServerToClientMessage =
  | HelloMessage
  | ConfigUpdatedMessage
  | MessageSentMessage
  | ChannelUpdatedMessage
  | ErrorMessage;

export type ClientToServerMessage =
  | SendMessageMessage
  | UpdateChannelMessage
  | SaveConfigMessage;

export type AnyProtocolMessage = ServerToClientMessage | ClientToServerMessage;
