import { ROOM_PATH_PREFIX } from '../config/client'

export const getRoomCodeFromPath = (pathName: string): string => {
  if (!pathName.startsWith(ROOM_PATH_PREFIX)) {
    return ''
  }

  const rawCode = pathName.slice(ROOM_PATH_PREFIX.length)
  return decodeURIComponent(rawCode).trim()
}

export const pushRoomPath = (roomId: string): void => {
  const targetPath = `${ROOM_PATH_PREFIX}${encodeURIComponent(roomId)}`
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath)
  }
}
