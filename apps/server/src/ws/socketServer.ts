import { IncomingMessage } from "http";
import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { hasAnotherSocketForPlayer } from "../services/socketPresenceService";
import { allPlayersConnected, startRoomGame } from "../services/roomService";
import { roomSockets, rooms, socketPlayers, socketRooms } from "../state/serverState";
import { RoomBroadcasters, VoiceSignalBroadcastEvent, VoiceSignalClientEvent } from "../types/game";
import { addSocketToRoom, broadcastActiveWord, broadcastRoomState, removeSocketFromRoom } from "./broadcast";

const broadcasters: RoomBroadcasters = {
  broadcastRoomState,
  broadcastActiveWord,
};

export const registerSocketServer = (server: Server): WebSocketServer => {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket: WebSocket, req: IncomingMessage) => {
    const wsUrl = new URL(req.url ?? "/ws", "http://localhost");
    const roomId = wsUrl.searchParams.get("roomId") ?? "";
    const playerId = wsUrl.searchParams.get("playerId") ?? "";

    const record = rooms.get(roomId);
    const player = record?.room.players.find((roomPlayer) => roomPlayer.id === playerId);
    if (!record || !player) {
      socket.close(1008, "invalid room or player");
      return;
    }

    socketRooms.set(socket, roomId);
    socketPlayers.set(socket, playerId);
    addSocketToRoom(roomId, socket);

    record.connectedPlayerIds.add(playerId);

    if (record.startRequested && !record.started && allPlayersConnected(record)) {
      startRoomGame(roomId, record, broadcasters);
    } else {
      broadcastRoomState(roomId, record);
      if (record.started) {
        broadcastActiveWord(roomId, record);
      }
    }

    socket.on("close", () => {
      const closedRoomId = socketRooms.get(socket);
      const closedPlayerId = socketPlayers.get(socket);
      removeSocketFromRoom(socket);

      if (!closedRoomId || !closedPlayerId) {
        return;
      }

      const roomRecord = rooms.get(closedRoomId);
      if (!roomRecord) {
        return;
      }

      if (!hasAnotherSocketForPlayer(closedRoomId, closedPlayerId, socket)) {
        roomRecord.connectedPlayerIds.delete(closedPlayerId);
        broadcastRoomState(closedRoomId, roomRecord);
      }
    });

    socket.on("message", (rawPayload) => {
      const sourceRoomId = socketRooms.get(socket);
      const sourcePlayerId = socketPlayers.get(socket);
      if (!sourceRoomId || !sourcePlayerId) {
        return;
      }

      let parsedPayload: VoiceSignalClientEvent | null = null;
      try {
        const incoming = JSON.parse(rawPayload.toString()) as Partial<VoiceSignalClientEvent>;
        if (incoming.type !== "voice_signal") {
          return;
        }

        if (!incoming.toPlayerId || incoming.toPlayerId === sourcePlayerId) {
          return;
        }

        parsedPayload = {
          type: "voice_signal",
          toPlayerId: incoming.toPlayerId,
          signal: incoming.signal,
        };
      } catch {
        return;
      }

      const roomRecord = rooms.get(sourceRoomId);
      if (!roomRecord) {
        return;
      }

      const targetPlayer = roomRecord.room.players.find(
        (roomPlayer) => roomPlayer.id === parsedPayload.toPlayerId,
      );
      if (!targetPlayer) {
        return;
      }

      const sockets = roomSockets.get(sourceRoomId);
      if (!sockets) {
        return;
      }

      const event: VoiceSignalBroadcastEvent = {
        type: "voice_signal",
        roomId: sourceRoomId,
        fromPlayerId: sourcePlayerId,
        signal: parsedPayload.signal,
      };

      for (const targetSocket of sockets) {
        if (targetSocket.readyState !== WebSocket.OPEN) {
          continue;
        }

        if (socketPlayers.get(targetSocket) !== parsedPayload.toPlayerId) {
          continue;
        }

        targetSocket.send(JSON.stringify(event));
      }
    });
  });

  return wss;
};
