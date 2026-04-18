import { WebSocket } from "ws";

// игрок в комнате
export interface Player {
  id: string;
  name: string;
  score: number;
  userId?: number;
}

// статистика игрока за раунд
export interface PlayerGameStats {
  guessed: number;
  skipped: number;
}

// выбранная коллекция слов
export interface SelectedCollection {
  id: number;
  type: 'default' | 'custom';
}

// настройки комнаты
export interface GameRoomSettings {
  timer: number;
  winScore: number;
  difficulty: number;
  selectedCollections: SelectedCollection[];
}

// игровая комната
export interface GameRoom {
  players: Player[];
  hostId: string;
  settings: GameRoomSettings;
}

// сообщение в чате комнаты
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: string;
}

// информация о победителе
export interface WinnerInfo {
  playerId: string;
  playerName: string;
}

// запись комнаты со всем состоянием игры
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

// события броадкаста по вебсокетам
export interface ChatBroadcastEvent {
  type: "chat_message";
  roomId: string;
  message: ChatMessage;
}

// событие обновления состояния комнаты
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

// событие текущего слова
export interface ActiveWordBroadcastEvent {
  type: "active_word";
  roomId: string;
  word: string | null;
}

// событие голосового сигнала (webrtc)
export interface VoiceSignalBroadcastEvent {
  type: "voice_signal";
  roomId: string;
  fromPlayerId: string;
  signal: unknown;
}

// событие голосового сигнала от клиента
export interface VoiceSignalClientEvent {
  type: "voice_signal";
  toPlayerId: string;
  signal: unknown;
}

// тип-объединение всех броадкаст событий
export type RoomBroadcastEvent =
  | ChatBroadcastEvent
  | RoomStateBroadcastEvent
  | ActiveWordBroadcastEvent
  | VoiceSignalBroadcastEvent;

// интерфейс функций рассылки событий
export interface RoomBroadcasters {
  broadcastRoomState: (roomId: string, record: RoomRecord) => void;
  broadcastActiveWord: (roomId: string, record: RoomRecord) => void;
}

// привязка сокета к комнате
export interface SocketRoomMembership {
  socket: WebSocket;
  roomId: string;
  playerId: string;
}
