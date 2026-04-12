"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRoomGame = exports.resolveCurrentWord = exports.startRoomTickLoop = exports.allPlayersConnected = exports.getNextTurnPlayerId = exports.getRandomWord = exports.clearRoomTickInterval = exports.buildRoomStatePayload = void 0;
const serverState_1 = require("../state/serverState");
const buildRoomStatePayload = (roomId, record) => ({
    roomId,
    room: record.room,
    started: record.started,
    startRequested: record.startRequested,
    startedAt: record.startedAt,
    connectedPlayerIds: [...record.connectedPlayerIds],
    turnSecondsRemaining: record.turnSecondsRemaining,
    currentTurnPlayerId: record.currentTurnPlayerId,
    waitingForWordResolutionAtZero: record.waitingForWordResolutionAtZero,
});
exports.buildRoomStatePayload = buildRoomStatePayload;
const clearRoomTickInterval = (roomId) => {
    const interval = serverState_1.roomTickIntervals.get(roomId);
    if (!interval) {
        return;
    }
    clearInterval(interval);
    serverState_1.roomTickIntervals.delete(roomId);
};
exports.clearRoomTickInterval = clearRoomTickInterval;
const getRandomWord = () => serverState_1.WORD_POOL[Math.floor(Math.random() * serverState_1.WORD_POOL.length)] ?? "слово";
exports.getRandomWord = getRandomWord;
const getNextTurnPlayerId = (record) => {
    const { players } = record.room;
    if (players.length === 0) {
        return null;
    }
    if (!record.currentTurnPlayerId) {
        return players[0].id;
    }
    const currentIndex = players.findIndex((player) => player.id === record.currentTurnPlayerId);
    if (currentIndex === -1) {
        return players[0].id;
    }
    const nextIndex = (currentIndex + 1) % players.length;
    return players[nextIndex].id;
};
exports.getNextTurnPlayerId = getNextTurnPlayerId;
const allPlayersConnected = (record) => {
    return record.room.players.every((player) => record.connectedPlayerIds.has(player.id));
};
exports.allPlayersConnected = allPlayersConnected;
const startRoomTickLoop = (roomId, broadcasters) => {
    if (serverState_1.roomTickIntervals.has(roomId)) {
        return;
    }
    const interval = setInterval(() => {
        const record = serverState_1.rooms.get(roomId);
        if (!record) {
            (0, exports.clearRoomTickInterval)(roomId);
            return;
        }
        if (!record.started || !record.startedAt) {
            return;
        }
        const startedAtMs = Date.parse(record.startedAt);
        if (Number.isNaN(startedAtMs) || Date.now() < startedAtMs) {
            return;
        }
        if (!record.currentTurnPlayerId) {
            record.currentTurnPlayerId = (0, exports.getNextTurnPlayerId)(record);
            record.turnSecondsRemaining = record.room.settings.timer;
            if (!record.currentWord) {
                record.currentWord = (0, exports.getRandomWord)();
            }
            record.waitingForWordResolutionAtZero = false;
            broadcasters.broadcastRoomState(roomId, record);
            broadcasters.broadcastActiveWord(roomId, record);
            return;
        }
        if (record.turnSecondsRemaining === null) {
            record.turnSecondsRemaining = record.room.settings.timer;
        }
        if (record.waitingForWordResolutionAtZero) {
            record.turnSecondsRemaining = 0;
            broadcasters.broadcastRoomState(roomId, record);
            return;
        }
        record.turnSecondsRemaining = Math.max(0, record.turnSecondsRemaining - 1);
        if (record.turnSecondsRemaining === 0) {
            record.waitingForWordResolutionAtZero = true;
        }
        broadcasters.broadcastRoomState(roomId, record);
    }, 1000);
    serverState_1.roomTickIntervals.set(roomId, interval);
};
exports.startRoomTickLoop = startRoomTickLoop;
const resolveCurrentWord = (roomId, record, broadcasters) => {
    const timedOut = record.turnSecondsRemaining === 0 || record.waitingForWordResolutionAtZero;
    if (timedOut) {
        record.currentTurnPlayerId = (0, exports.getNextTurnPlayerId)(record);
        record.turnSecondsRemaining = record.room.settings.timer;
    }
    record.currentWord = (0, exports.getRandomWord)();
    record.waitingForWordResolutionAtZero = false;
    if (record.turnSecondsRemaining === null) {
        record.turnSecondsRemaining = record.room.settings.timer;
    }
    broadcasters.broadcastRoomState(roomId, record);
    broadcasters.broadcastActiveWord(roomId, record);
};
exports.resolveCurrentWord = resolveCurrentWord;
const startRoomGame = (roomId, record, broadcasters) => {
    if (record.started) {
        return;
    }
    // Add a short lead time so all clients can render the start frame before timer ticks.
    record.started = true;
    record.startRequested = false;
    record.startedAt = new Date(Date.now() + serverState_1.GAME_START_DELAY_MS).toISOString();
    record.turnSecondsRemaining = record.room.settings.timer;
    record.currentTurnPlayerId = record.room.players[0]?.id ?? null;
    record.currentWord = (0, exports.getRandomWord)();
    record.waitingForWordResolutionAtZero = false;
    broadcasters.broadcastRoomState(roomId, record);
    broadcasters.broadcastActiveWord(roomId, record);
    (0, exports.startRoomTickLoop)(roomId, broadcasters);
};
exports.startRoomGame = startRoomGame;
//# sourceMappingURL=roomService.js.map