import { WebSocket } from "ws";
import { roomSockets, socketPlayers, socketRooms } from "../state/serverState";
import { ActiveWordBroadcastEvent, RoomBroadcastEvent, RoomRecord } from "../types/game";
import { buildRoomStatePayload } from "../services/roomService";

export const addSocketToRoom = (roomId: string, socket: WebSocket): void => {
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.add(socket);
    return;
  }

  roomSockets.set(roomId, new Set([socket]));
};

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

export const broadcastRoomState = (roomId: string, record: RoomRecord): void => {
  broadcastToRoom(roomId, {
    type: "room_state",
    ...buildRoomStatePayload(roomId, record),
  });
};

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
