"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.closePlayerSockets = exports.broadcastActiveWord = exports.broadcastRoomState = exports.broadcastToRoom = exports.removeSocketFromRoom = exports.addSocketToRoom = void 0;
const ws_1 = require("ws");
const serverState_1 = require("../state/serverState");
const roomService_1 = require("../services/roomService");
// добавить сокет в комнату
const addSocketToRoom = (roomId, socket) => {
    const sockets = serverState_1.roomSockets.get(roomId);
    if (sockets) {
        sockets.add(socket);
        return;
    }
    serverState_1.roomSockets.set(roomId, new Set([socket]));
};
exports.addSocketToRoom = addSocketToRoom;
// удалить сокет из комнаты при отключении
const removeSocketFromRoom = (socket) => {
    const roomId = serverState_1.socketRooms.get(socket);
    if (!roomId) {
        return;
    }
    const sockets = serverState_1.roomSockets.get(roomId);
    if (!sockets) {
        return;
    }
    sockets.delete(socket);
    if (sockets.size === 0) {
        serverState_1.roomSockets.delete(roomId);
    }
};
exports.removeSocketFromRoom = removeSocketFromRoom;
// отправка события всем сокетам комнаты
const broadcastToRoom = (roomId, event) => {
    const sockets = serverState_1.roomSockets.get(roomId);
    if (!sockets) {
        return;
    }
    const payload = JSON.stringify(event);
    for (const socket of sockets) {
        if (socket.readyState === ws_1.WebSocket.OPEN) {
            socket.send(payload);
        }
    }
};
exports.broadcastToRoom = broadcastToRoom;
// разослать актуальное состояние комнаты
const broadcastRoomState = (roomId, record) => {
    (0, exports.broadcastToRoom)(roomId, {
        type: "room_state",
        ...(0, roomService_1.buildRoomStatePayload)(roomId, record),
    });
};
exports.broadcastRoomState = broadcastRoomState;
// отправка текущего слова (только объясняющему игроку)
const broadcastActiveWord = (roomId, record) => {
    const sockets = serverState_1.roomSockets.get(roomId);
    if (!sockets) {
        return;
    }
    for (const socket of sockets) {
        if (socket.readyState !== ws_1.WebSocket.OPEN) {
            continue;
        }
        const socketPlayerId = serverState_1.socketPlayers.get(socket);
        const wordForSocket = socketPlayerId && socketPlayerId === record.currentTurnPlayerId ? record.currentWord : null;
        socket.send(JSON.stringify({
            type: "active_word",
            roomId,
            word: wordForSocket,
        }));
    }
};
exports.broadcastActiveWord = broadcastActiveWord;
// закрыть все сокеты игрока (при кике или выходе)
const closePlayerSockets = (roomId, playerId) => {
    const sockets = serverState_1.roomSockets.get(roomId);
    if (!sockets) {
        return;
    }
    for (const socket of sockets) {
        if (serverState_1.socketPlayers.get(socket) === playerId) {
            socket.close(4001, "player exited");
        }
    }
};
exports.closePlayerSockets = closePlayerSockets;
//# sourceMappingURL=broadcast.js.map