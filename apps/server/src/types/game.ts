import { WebSocket } from "ws";

export interface Player {
  id: string;
  name: string;
  score: number;
  userId?: number;
}

export interface PlayerGameStats {
  guessed: number;
  skipped: number;
}

export interface SelectedCollection {
  id: number;
  type: 'default' | 'custom';
}

export interface GameRoomSettings {
  timer: number;
  winScore: number;
  difficulty: number;
  selectedCollections: SelectedCollection[];
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

export interface WinnerInfo {
  playerId: string;
  playerName: string;
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
  usedWords: Set<string>;
  wordPool: string[] | null;
  playerStats: Map<string, PlayerGameStats>;
  gameStartedAt: Date | null;
  winner: WinnerInfo | null;
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
  winner: WinnerInfo | null;
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
