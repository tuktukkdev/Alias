// игрок в комнате
export interface Player {
  id: string
  name: string
  score: number
}

// выбранная коллекция слов (дефолтная или кастомная)
export interface SelectedCollection {
  id: number
  type: 'default' | 'custom'
}

// настройки игровой комнаты
export interface GameRoomSettings {
  timer: number
  winScore: number
  difficulty: number
  selectedCollections: SelectedCollection[]
}

// сама игровая комната
export interface GameRoom {
  players: Player[]
  hostId: string
  settings: GameRoomSettings
}

// состояние комнаты целиком
export interface RoomState {
  roomId: string
  room: GameRoom
  started?: boolean
  startRequested?: boolean
  startedAt?: string | null
  connectedPlayerIds?: string[]
  turnSecondsRemaining?: number | null
  currentTurnPlayerId?: string | null
  waitingForWordResolutionAtZero?: boolean
  winner?: { playerId: string; playerName: string } | null
}

// сообщение чата
export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  createdAt: string
}

// сохраненная сессия комнаты в localStorage
export interface StoredRoomSession {
  roomId: string
  playerId: string
  name: string
}

// состояние контекстного меню громкости
export interface VolumeMenuState {
  playerId: string
  playerName: string
  x: number
  y: number
}

// ответ при входе в комнату
export interface RoomJoinResponse extends RoomState {
  playerId: string
}

// сигнал голосового чата (webrtc)
export interface VoiceSignalMessage {
  type?: 'offer' | 'answer' | 'ice'
  sdp?: string
  candidate?: RTCIceCandidateInit
}

// пейлоад вебсокет сообщения
export interface WsPayload {
  type?: string
  message?: ChatMessage
  roomId?: string
  room?: GameRoom
  started?: boolean
  startRequested?: boolean
  startedAt?: string | null
  connectedPlayerIds?: string[]
  turnSecondsRemaining?: number | null
  currentTurnPlayerId?: string | null
  waitingForWordResolutionAtZero?: boolean
  winner?: { playerId: string; playerName: string } | null
  word?: string | null
  fromPlayerId?: string
  signal?: VoiceSignalMessage
}
