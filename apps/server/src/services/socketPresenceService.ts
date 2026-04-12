import { WebSocket } from "ws";
import { roomSockets, socketPlayers } from "../state/serverState";

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
