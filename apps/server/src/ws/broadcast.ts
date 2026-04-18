import { WebSocket } from "ws";
import { roomSockets, socketPlayers, socketRooms } from "../state/serverState";
import { ActiveWordBroadcastEvent, RoomBroadcastEvent, RoomRecord } from "../types/game";
import { buildRoomStatePayload } from "../services/roomService";

// добавить сокет в комнату
export const addSocketToRoom = (roomId: string, socket: WebSocket): void => {
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.add(socket);
    return;
  }

  roomSockets.set(roomId, new Set([socket]));
};

// удалить сокет из комнаты при отключении
export const removeSocketFromRoom = (socket: WebSocket): void => {
  const roomId = socketRooms.get(socket);
  if (!roomId) {
    return;
  }

  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }

  sockets.delete(socket);
  if (sockets.size === 0) {
    roomSockets.delete(roomId);
  }
};

// отправка события всем сокетам комнаты
export const broadcastToRoom = (roomId: string, event: RoomBroadcastEvent): void => {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
};

// разослать актуальное состояние комнаты
export const broadcastRoomState = (roomId: string, record: RoomRecord): void => {
  broadcastToRoom(roomId, {
    type: "room_state",
    ...buildRoomStatePayload(roomId, record),
  });
};

// отправка текущего слова (только объясняющему игроку)
export const broadcastActiveWord = (roomId: string, record: RoomRecord): void => {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    const socketPlayerId = socketPlayers.get(socket);
    const wordForSocket =
      socketPlayerId && socketPlayerId === record.currentTurnPlayerId ? record.currentWord : null;

    socket.send(
      JSON.stringify({
        type: "active_word",
        roomId,
        word: wordForSocket,
      } satisfies ActiveWordBroadcastEvent),
    );
  }
};

// закрыть все сокеты игрока (при кике или выходе)
export const closePlayerSockets = (roomId: string, playerId: string): void => {
  const sockets = roomSockets.get(roomId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    if (socketPlayers.get(socket) === playerId) {
      socket.close(4001, "player exited");
    }
  }
};
