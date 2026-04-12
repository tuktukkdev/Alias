import { SESSION_STORAGE_KEY } from '../config/client'
import type { StoredRoomSession } from '../types/game'

export const getStoredRoomSession = (): StoredRoomSession | null => {
  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredRoomSession>
    if (!parsed.roomId || !parsed.playerId || !parsed.name) {
      return null
    }

    return {
      roomId: parsed.roomId,
      playerId: parsed.playerId,
      name: parsed.name,
    }
  } catch {
    return null
  }
}

export const setStoredRoomSession = (session: StoredRoomSession): void => {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export const clearStoredRoomSession = (): void => {
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}
