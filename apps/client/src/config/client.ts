const _rawApiBase = import.meta.env.VITE_API_BASE as string | undefined

// In production (Docker): VITE_API_BASE='' → empty string, nginx proxies API on same domain.
// In development:         VITE_API_BASE=http://localhost:3000 (set via .env.development).
export const API_BASE = _rawApiBase ?? 'http://localhost:3000'

// WebSocket base: derives ws(s):// from API_BASE.
// If API_BASE is empty (production), WS_BASE is null → App.tsx uses window.location.host.
export const WS_BASE: string | null = API_BASE
  ? API_BASE.replace(/^https/, 'wss').replace(/^http/, 'ws')
  : null

export const ROOM_PATH_PREFIX = '/room/'
export const SESSION_STORAGE_KEY = 'alias-room-session'
