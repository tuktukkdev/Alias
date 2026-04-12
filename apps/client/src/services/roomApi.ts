import { API_BASE } from '../config/client'
import type { ChatMessage, RoomJoinResponse, RoomState } from '../types/game'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const mapRoomState = (data: RoomState): RoomState => ({
  roomId: data.roomId,
  room: data.room,
  started: data.started,
  startRequested: data.startRequested,
  startedAt: data.startedAt,
  connectedPlayerIds: data.connectedPlayerIds,
  turnSecondsRemaining: data.turnSecondsRemaining,
  currentTurnPlayerId: data.currentTurnPlayerId,
  waitingForWordResolutionAtZero: data.waitingForWordResolutionAtZero,
})

export const createRoomRequest = async (name: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  })
}

export const joinRoomRequest = async (roomId: string, name: string, playerId?: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name,
      playerId,
    }),
  })
}

export const fetchRoomStateRequest = async (roomId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}`)
}

export const fetchRoomChatRequest = async (roomId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/chat`)
}

export const updateTimerRequest = async (roomId: string, playerId: string, timer: number): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/settings`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId, timer }),
  })
}

export const startGameRequest = async (roomId: string, playerId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/start`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId }),
  })
}

export const sendChatMessageRequest = async (
  roomId: string,
  playerId: string,
  text: string,
): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/chat`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId, text }),
  })
}

export const skipWordRequest = async (roomId: string, playerId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/skip`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId }),
  })
}

export const parseRoomJoinResponse = async (response: Response): Promise<RoomJoinResponse> => {
  return (await response.json()) as RoomJoinResponse
}

export const parseRoomStateResponse = async (response: Response): Promise<RoomState> => {
  return (await response.json()) as RoomState
}

export const parseChatListResponse = async (response: Response): Promise<{ messages: ChatMessage[] }> => {
  return (await response.json()) as { messages: ChatMessage[] }
}

export const parseChatMessageResponse = async (response: Response): Promise<{ message: ChatMessage }> => {
  return (await response.json()) as { message: ChatMessage }
}
