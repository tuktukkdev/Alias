import { ROOM_PATH_PREFIX } from '../config/client'

// достаем код комнаты из урла браузера
export const getRoomCodeFromPath = (pathName: string): string => {
  if (!pathName.startsWith(ROOM_PATH_PREFIX)) {
    return ''
  }

  const rawCode = pathName.slice(ROOM_PATH_PREFIX.length)
  return decodeURIComponent(rawCode).trim()
}

// пушим в историю браузера путь комнаты чтоб урл обновился
export const pushRoomPath = (roomId: string): void => {
  const targetPath = `${ROOM_PATH_PREFIX}${encodeURIComponent(roomId)}`
  if (window.location.pathname !== targetPath) {
    window.history.pushState({}, '', targetPath)
  }
}
