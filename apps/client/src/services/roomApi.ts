import { API_BASE } from '../config/client'
import type { ChatMessage, RoomJoinResponse, RoomState, SelectedCollection } from '../types/game'

// общие заголовки для json запросов
const JSON_HEADERS = { 'Content-Type': 'application/json' }

// маппим данные комнаты в наш формат стейта
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
  winner: data.winner,
})

// создание новой комнаты
export const createRoomRequest = async (name: string, userId?: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ name, userId }),
  })
}

// присоединение к существующей комнате
export const joinRoomRequest = async (roomId: string, name: string, playerId?: string, userId?: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/join`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name,
      playerId,
      userId,
    }),
  })
}

// получение текущего состояния комнаты
export const fetchRoomStateRequest = async (roomId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}`)
}

// получение сообщений чата комнаты
export const fetchRoomChatRequest = async (roomId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/chat`)
}

// обновление таймера хода
export const updateTimerRequest = async (roomId: string, playerId: string, timer: number): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/settings`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId, timer }),
  })
}

// обновление настроек комнаты (сложность, очки для победы итд)
export const updateSettingsRequest = async (
  roomId: string,
  playerId: string,
  settings: { timer?: number; difficulty?: number; winScore?: number },
): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/settings`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId, ...settings }),
  })
}

// обновление выбранных коллекций слов в комнате
export const updateCollectionsRequest = async (
  roomId: string,
  playerId: string,
  collections: SelectedCollection[],
): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/collections`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId, collections }),
  })
}

// получение списка дефолтных коллекций
export const fetchDefaultCollectionsRequest = async (): Promise<Response> => {
  return fetch(`${API_BASE}/default-collections`)
}

// запуск игры хостом
export const startGameRequest = async (roomId: string, playerId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/start`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId }),
  })
}

// отправка сообщения в чат (угадывание слова)
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

// пропуск текущего слова
export const skipWordRequest = async (roomId: string, playerId: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/skip`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ playerId }),
  })
}

// выход игрока из комнаты
export const exitRoomRequest = async (roomId: string, playerId: string, userId?: string): Promise<Response> => {
  return fetch(`${API_BASE}/rooms/${roomId}/players/${playerId}`, {
    method: 'DELETE',
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId }),
  })
}

// поиск комнаты юзера (для автореконнекта)
export const findMyRoomRequest = async (userId: string): Promise<Response> => {
  return fetch(`${API_BASE}/players/${userId}/room`)
}

// парсим ответ при входе в комнату
export const parseRoomJoinResponse = async (response: Response): Promise<RoomJoinResponse> => {
  return (await response.json()) as RoomJoinResponse
}

// парсим состояние комнаты
export const parseRoomStateResponse = async (response: Response): Promise<RoomState> => {
  return (await response.json()) as RoomState
}

// парсим список сообщений чата
export const parseChatListResponse = async (response: Response): Promise<{ messages: ChatMessage[] }> => {
  return (await response.json()) as { messages: ChatMessage[] }
}

// парсим одно сообщение чата
export const parseChatMessageResponse = async (response: Response): Promise<{ message: ChatMessage }> => {
  return (await response.json()) as { message: ChatMessage }
}
