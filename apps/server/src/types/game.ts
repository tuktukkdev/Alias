import { WebSocket } from "ws";

export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameRoomSettings {
  timer: number;
  winScore: number;
}

export interface GameRoom {
  players: Player[];
  hostId: string;
  settings: GameRoomSettings;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: string;
}

export interface RoomRecord {
  room: GameRoom;
  started: boolean;
  startRequested: boolean;
  startedAt: string | null;
  connectedPlayerIds: Set<string>;
  chatMessages: ChatMessage[];
  turnSecondsRemaining: number | null;
  currentTurnPlayerId: string | null;
  currentWord: string | null;
  waitingForWordResolutionAtZero: boolean;
}

export interface ChatBroadcastEvent {
  type: "chat_message";
  roomId: string;
  message: ChatMessage;
}

export interface RoomStateBroadcastEvent {
  type: "room_state";
  roomId: string;
  room: GameRoom;
  started: boolean;
  startRequested: boolean;
  startedAt: string | null;
  connectedPlayerIds: string[];
  turnSecondsRemaining: number | null;
  currentTurnPlayerId: string | null;
  waitingForWordResolutionAtZero: boolean;
}

export interface ActiveWordBroadcastEvent {
  type: "active_word";
  roomId: string;
  word: string | null;
}

export interface VoiceSignalBroadcastEvent {
  type: "voice_signal";
  roomId: string;
  fromPlayerId: string;
  signal: unknown;
}

export interface VoiceSignalClientEvent {
  type: "voice_signal";
  toPlayerId: string;
  signal: unknown;
}

export type RoomBroadcastEvent =
  | ChatBroadcastEvent
  | RoomStateBroadcastEvent
  | ActiveWordBroadcastEvent
  | VoiceSignalBroadcastEvent;

export interface RoomBroadcasters {
  broadcastRoomState: (roomId: string, record: RoomRecord) => void;
  broadcastActiveWord: (roomId: string, record: RoomRecord) => void;
}

export interface SocketRoomMembership {
  socket: WebSocket;
  roomId: string;
  playerId: string;
}
