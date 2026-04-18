"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketServer = void 0;
const ws_1 = require("ws");
const socketPresenceService_1 = require("../services/socketPresenceService");
const roomService_1 = require("../services/roomService");
const serverState_1 = require("../state/serverState");
const broadcast_1 = require("./broadcast");
// коллбэки для рассылки событий
const broadcasters = {
    broadcastRoomState: broadcast_1.broadcastRoomState,
    broadcastActiveWord: broadcast_1.broadcastActiveWord,
};
// регистрация websocket сервера
const registerSocketServer = (server) => {
    const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
    wss.on("connection", (socket, req) => {
        // парсим roomId и playerId из query-параметров
        const wsUrl = new URL(req.url ?? "/ws", "http://localhost");
        const roomId = wsUrl.searchParams.get("roomId") ?? "";
        const playerId = wsUrl.searchParams.get("playerId") ?? "";
        const record = serverState_1.rooms.get(roomId);
        const player = record?.room.players.find((roomPlayer) => roomPlayer.id === playerId);
        if (!record || !player) {
            socket.close(1008, "invalid room or player");
            return;
        }
        serverState_1.socketRooms.set(socket, roomId);
        serverState_1.socketPlayers.set(socket, playerId);
        (0, broadcast_1.addSocketToRoom)(roomId, socket);
        record.connectedPlayerIds.add(playerId);
        // если все подключились и старт запрошен — начинаем игру
        if (record.startRequested && !record.started && (0, roomService_1.allPlayersConnected)(record)) {
            void (0, roomService_1.startRoomGame)(roomId, record, broadcasters);
        }
        else {
            (0, broadcast_1.broadcastRoomState)(roomId, record);
            if (record.started) {
                (0, broadcast_1.broadcastActiveWord)(roomId, record);
            }
        }
        // ping каждые 30с чтобы cloudflare не дропнул сокет
        const pingInterval = setInterval(() => {
            if (socket.readyState === ws_1.WebSocket.OPEN) {
                socket.ping();
            }
        }, 30000);
        // обработка отключения сокета
        socket.on("close", () => {
            clearInterval(pingInterval);
            const closedRoomId = serverState_1.socketRooms.get(socket);
            const closedPlayerId = serverState_1.socketPlayers.get(socket);
            (0, broadcast_1.removeSocketFromRoom)(socket);
            if (!closedRoomId || !closedPlayerId) {
                return;
            }
            const roomRecord = serverState_1.rooms.get(closedRoomId);
            if (!roomRecord) {
                return;
            }
            if (!(0, socketPresenceService_1.hasAnotherSocketForPlayer)(closedRoomId, closedPlayerId, socket)) {
                roomRecord.connectedPlayerIds.delete(closedPlayerId);
                (0, broadcast_1.broadcastRoomState)(closedRoomId, roomRecord);
            }
        });
        // обработка входящих сообщений (голосовые сигналы)
        socket.on("message", (rawPayload) => {
            const sourceRoomId = serverState_1.socketRooms.get(socket);
            const sourcePlayerId = serverState_1.socketPlayers.get(socket);
            if (!sourceRoomId || !sourcePlayerId) {
                return;
            }
            let parsedPayload = null;
            try {
                const incoming = JSON.parse(rawPayload.toString());
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
            }
            catch {
                return;
            }
            const roomRecord = serverState_1.rooms.get(sourceRoomId);
            if (!roomRecord) {
                return;
            }
            const targetPlayer = roomRecord.room.players.find((roomPlayer) => roomPlayer.id === parsedPayload.toPlayerId);
            if (!targetPlayer) {
                return;
            }
            const sockets = serverState_1.roomSockets.get(sourceRoomId);
            if (!sockets) {
                return;
            }
            const event = {
                type: "voice_signal",
                roomId: sourceRoomId,
                fromPlayerId: sourcePlayerId,
                signal: parsedPayload.signal,
            };
            for (const targetSocket of sockets) {
                if (targetSocket.readyState !== ws_1.WebSocket.OPEN) {
                    continue;
                }
                if (serverState_1.socketPlayers.get(targetSocket) !== parsedPayload.toPlayerId) {
                    continue;
                }
                targetSocket.send(JSON.stringify(event));
            }
        });
    });
    return wss;
};
exports.registerSocketServer = registerSocketServer;
//# sourceMappingURL=socketServer.js.map