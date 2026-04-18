// базовый урл апи из env переменной
const _rawApiBase = import.meta.env.VITE_API_BASE as string | undefined

// в проде пустая строка (nginx проксирует), в деве localhost:3000
export const API_BASE = _rawApiBase ?? 'http://localhost:3000'

// вебсокет база, делаем из http -> ws, если пусто то null и берем из window.location
export const WS_BASE: string | null = API_BASE
  ? API_BASE.replace(/^https/, 'wss').replace(/^http/, 'ws')
  : null

// префикс пути комнаты в урле
export const ROOM_PATH_PREFIX = '/room/'

// ключ для хранения сессии комнаты в localStorage
export const SESSION_STORAGE_KEY = 'alias-room-session'
