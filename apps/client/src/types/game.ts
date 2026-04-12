export interface Player {
  id: string
  name: string
  score: number
}

export interface SelectedCollection {
  id: number
  type: 'default' | 'custom'
}

export interface GameRoomSettings {
  timer: number
  winScore: number
  difficulty: number
  selectedCollections: SelectedCollection[]
}

export interface GameRoom {
  players: Player[]
  hostId: string
  settings: GameRoomSettings
}

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

export interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  text: string
  createdAt: string
}

export interface StoredRoomSession {
  roomId: string
  playerId: string
  name: string
}

export interface VolumeMenuState {
  playerId: string
  playerName: string
  x: number
  y: number
}

export interface RoomJoinResponse extends RoomState {
  playerId: string
}

export interface VoiceSignalMessage {
  type?: 'offer' | 'answer' | 'ice'
  sdp?: string
  candidate?: RTCIceCandidateInit
}

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
