// управление присутствием игроков: проверка сокетов, таймеры кика и закрытия комнаты
import { WebSocket } from "ws";
import {
  ALL_OFFLINE_CLOSE_MS,
  PLAYER_OFFLINE_KICK_MS,
  playerOfflineTimers,
  roomAllOfflineTimers,
  roomSockets,
  rooms,
  socketPlayers,
} from "../state/serverState";
import { RoomBroadcasters } from "../types/game";
import { broadcastActiveWord, broadcastRoomState } from "../ws/broadcast";
import { closeRoomFully, removePlayerPermanently } from "./roomService";

// объект broadcasters для использования внутри таймеров
const broadcasters: RoomBroadcasters = { broadcastRoomState, broadcastActiveWord };

// есть ли у игрока ещё один активный сокет (кроме текущего)
export const hasAnotherSocketForPlayer = (
  roomId: string,
  playerId: string,
  ignoredSocket: WebSocket,
): boolean => {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return false;
  }

  for (const socket of sockets) {
    if (socket === ignoredSocket) {
      continue;
    }

    if (socketPlayers.get(socket) === playerId && socket.readyState === WebSocket.OPEN) {
      return true;
    }
  }

  return false;
};

// запустить 180-секундный таймер кика игрока при офлайне
export const startPlayerOfflineTimer = (roomId: string, playerId: string): void => {
  const key = `${roomId}:${playerId}`;
  const existing = playerOfflineTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    playerOfflineTimers.delete(key);
    removePlayerPermanently(roomId, playerId, broadcasters);
  }, PLAYER_OFFLINE_KICK_MS);

  playerOfflineTimers.set(key, timer);
};

// отменить таймер кика игрока (при переподключении)
export const cancelPlayerOfflineTimer = (roomId: string, playerId: string): void => {
  const key = `${roomId}:${playerId}`;
  const timer = playerOfflineTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    playerOfflineTimers.delete(key);
  }
};

// запустить 60-секундный таймер закрытия комнаты когда все офлайн
export const startRoomAllOfflineTimer = (roomId: string): void => {
  const existing = roomAllOfflineTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    roomAllOfflineTimers.delete(roomId);
    closeRoomFully(roomId);
  }, ALL_OFFLINE_CLOSE_MS);

  roomAllOfflineTimers.set(roomId, timer);
};

// отменить таймер закрытия комнаты (кто-то вернулся онлайн)
export const cancelRoomAllOfflineTimer = (roomId: string): void => {
  const timer = roomAllOfflineTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomAllOfflineTimers.delete(roomId);
  }
};

// проверяем есть ли хоть один онлайн-игрок в комнате
export const hasAnyConnectedPlayer = (roomId: string): boolean => {
  const record = rooms.get(roomId);
  if (!record) return false;
  return record.connectedPlayerIds.size > 0;
};
