"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endGame = exports.startRoomGame = exports.removePlayerPermanently = exports.resolveCurrentWord = exports.startRoomTickLoop = exports.allPlayersConnected = exports.getNextTurnPlayerId = exports.getNextWord = exports.clearRoomTickInterval = exports.buildRoomStatePayload = void 0;
const prisma_1 = require("../db/prisma");
const serverState_1 = require("../state/serverState");
const wordService_1 = require("./wordService");
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
    winner: record.winner,
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
const getNextWord = async (record) => {
    const word = await (0, wordService_1.pickWord)(record.room.settings.selectedCollections, record.room.settings.difficulty, record.usedWords);
    record.usedWords.add(word);
    return word;
};
exports.getNextWord = getNextWord;
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
                void (0, exports.getNextWord)(record).then((word) => {
                    record.currentWord = word;
                    broadcasters.broadcastActiveWord(roomId, record);
                });
            }
            record.waitingForWordResolutionAtZero = false;
            broadcasters.broadcastRoomState(roomId, record);
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
        // Check for winner before advancing the turn
        const winScore = record.room.settings.winScore;
        const topPlayer = record.room.players.reduce((best, p) => (!best || p.score > best.score ? p : best), null);
        if (topPlayer && topPlayer.score >= winScore) {
            void (0, exports.endGame)(roomId, record, topPlayer, broadcasters);
            return;
        }
        record.currentTurnPlayerId = (0, exports.getNextTurnPlayerId)(record);
        record.turnSecondsRemaining = record.room.settings.timer;
    }
    record.currentWord = null;
    record.waitingForWordResolutionAtZero = false;
    if (record.turnSecondsRemaining === null) {
        record.turnSecondsRemaining = record.room.settings.timer;
    }
    void (0, exports.getNextWord)(record).then((word) => {
        record.currentWord = word;
        broadcasters.broadcastRoomState(roomId, record);
        broadcasters.broadcastActiveWord(roomId, record);
    });
    broadcasters.broadcastRoomState(roomId, record);
};
exports.resolveCurrentWord = resolveCurrentWord;
const removePlayerPermanently = (roomId, playerId, broadcasters) => {
    const record = serverState_1.rooms.get(roomId);
    if (!record) {
        return;
    }
    record.room.players = record.room.players.filter((p) => p.id !== playerId);
    record.connectedPlayerIds.delete(playerId);
    if (record.started && record.currentTurnPlayerId === playerId && record.room.players.length > 0) {
        // Check winner before giving next player a turn
        const winScore = record.room.settings.winScore;
        const topPlayer = record.room.players.reduce((best, p) => (!best || p.score > best.score ? p : best), null);
        if (topPlayer && topPlayer.score >= winScore) {
            void (0, exports.endGame)(roomId, record, topPlayer, broadcasters);
            return;
        }
        record.currentTurnPlayerId = (0, exports.getNextTurnPlayerId)(record);
        record.currentWord = null;
        record.waitingForWordResolutionAtZero = false;
        record.turnSecondsRemaining = record.room.settings.timer;
        void (0, exports.getNextWord)(record).then((word) => {
            record.currentWord = word;
            broadcasters.broadcastActiveWord(roomId, record);
        });
    }
    if (record.room.hostId === playerId && record.room.players.length > 0) {
        record.room.hostId = record.room.players[0].id;
    }
    if (record.room.players.length === 0) {
        (0, exports.clearRoomTickInterval)(roomId);
        serverState_1.rooms.delete(roomId);
        serverState_1.roomSockets.delete(roomId);
        return;
    }
    broadcasters.broadcastRoomState(roomId, record);
};
exports.removePlayerPermanently = removePlayerPermanently;
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
    record.currentWord = null;
    record.waitingForWordResolutionAtZero = false;
    record.usedWords.clear();
    record.playerStats = new Map();
    record.gameStartedAt = new Date();
    record.winner = null;
    void (0, exports.getNextWord)(record).then((word) => {
        record.currentWord = word;
        broadcasters.broadcastActiveWord(roomId, record);
    });
    broadcasters.broadcastRoomState(roomId, record);
    (0, exports.startRoomTickLoop)(roomId, broadcasters);
};
exports.startRoomGame = startRoomGame;
const endGame = async (roomId, record, winner, broadcasters) => {
    (0, exports.clearRoomTickInterval)(roomId);
    record.winner = { playerId: winner.id, playerName: winner.name };
    record.currentWord = null;
    record.waitingForWordResolutionAtZero = false;
    broadcasters.broadcastRoomState(roomId, record);
    broadcasters.broadcastActiveWord(roomId, record);
    await saveGameStats(record, record.winner);
};
exports.endGame = endGame;
async function saveGameStats(record, winner) {
    const hostPlayer = record.room.players.find((p) => p.id === record.room.hostId);
    const hostUserId = hostPlayer?.userId;
    const winnerPlayer = record.room.players.find((p) => p.id === winner.playerId);
    const winnerUserId = winnerPlayer?.userId ?? null;
    if (hostUserId) {
        try {
            await prisma_1.prisma.game.create({
                data: {
                    startedDt: record.gameStartedAt ?? new Date(),
                    endedDt: new Date(),
                    players: JSON.stringify(record.room.players.map((p) => p.name)),
                    roomOwnerId: hostUserId,
                    score: JSON.stringify(Object.fromEntries(record.room.players.map((p) => [p.name, p.score]))),
                    winnerId: winnerUserId,
                },
            });
        }
        catch {
            // non-critical
        }
    }
    for (const player of record.room.players) {
        if (!player.userId)
            continue;
        const stats = record.playerStats.get(player.id) ?? { guessed: 0, skipped: 0 };
        const isWinner = player.id === winner.playerId;
        try {
            await prisma_1.prisma.userStats.upsert({
                where: { userId: player.userId },
                update: {
                    guessed: { increment: stats.guessed },
                    skipped: { increment: stats.skipped },
                    wins: { increment: isWinner ? 1 : 0 },
                    losses: { increment: isWinner ? 0 : 1 },
                },
                create: {
                    userId: player.userId,
                    guessed: stats.guessed,
                    skipped: stats.skipped,
                    wins: isWinner ? 1 : 0,
                    losses: isWinner ? 0 : 1,
                },
            });
        }
        catch {
            // non-critical
        }
    }
}
//# sourceMappingURL=roomService.js.map