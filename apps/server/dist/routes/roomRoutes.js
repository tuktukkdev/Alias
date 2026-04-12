"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoomRoutes = void 0;
const broadcast_1 = require("../ws/broadcast");
const serverState_1 = require("../state/serverState");
const roomService_1 = require("../services/roomService");
const common_1 = require("../utils/common");
const broadcasters = {
    broadcastRoomState: broadcast_1.broadcastRoomState,
    broadcastActiveWord: broadcast_1.broadcastActiveWord,
};
const registerRoomRoutes = (app) => {
    app.get("/", (_, res) => {
        res.send("Server works");
    });
    app.post("/rooms", (req, res) => {
        const name = String(req.body?.name ?? "").trim();
        const timer = Number(req.body?.timer ?? 60);
        const winScore = Number(req.body?.winScore ?? 10);
        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        const player = {
            id: (0, common_1.createId)("player"),
            name,
            score: 0,
        };
        const roomId = (0, common_1.createId)("room");
        const room = {
            players: [player],
            hostId: player.id,
            settings: {
                timer: Number.isFinite(timer) ? Math.max(10, Math.min(300, timer)) : 60,
                winScore: Number.isFinite(winScore) ? Math.max(1, winScore) : 10,
            },
        };
        serverState_1.rooms.set(roomId, {
            room,
            started: false,
            startRequested: false,
            startedAt: null,
            connectedPlayerIds: new Set(),
            chatMessages: [],
            turnSecondsRemaining: null,
            currentTurnPlayerId: null,
            currentWord: null,
            waitingForWordResolutionAtZero: false,
        });
        return res.status(201).json({
            roomId,
            playerId: player.id,
            room,
            started: false,
            startRequested: false,
            startedAt: null,
            connectedPlayerIds: [],
            turnSecondsRemaining: null,
            currentTurnPlayerId: null,
            waitingForWordResolutionAtZero: false,
        });
    });
    app.post("/rooms/:roomId/join", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        const name = String(req.body?.name ?? "").trim();
        const requestedPlayerId = String(req.body?.playerId ?? "").trim();
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        if (requestedPlayerId) {
            const existingPlayer = record.room.players.find((roomPlayer) => roomPlayer.id === requestedPlayerId);
            if (existingPlayer) {
                if (name) {
                    existingPlayer.name = name;
                }
                return res.json({
                    playerId: existingPlayer.id,
                    ...(0, roomService_1.buildRoomStatePayload)(roomId, record),
                });
            }
            if (record.started) {
                return res.status(403).json({ error: "game already started; invalid playerId" });
            }
        }
        if (record.started) {
            return res
                .status(403)
                .json({ error: "game already started; only existing players can reconnect" });
        }
        if (!name) {
            return res.status(400).json({ error: "name is required" });
        }
        const player = {
            id: (0, common_1.createId)("player"),
            name,
            score: 0,
        };
        record.room.players.push(player);
        (0, broadcast_1.broadcastRoomState)(roomId, record);
        return res.status(201).json({
            playerId: player.id,
            ...(0, roomService_1.buildRoomStatePayload)(roomId, record),
        });
    });
    app.get("/rooms/:roomId", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        return res.json((0, roomService_1.buildRoomStatePayload)(roomId, record));
    });
    app.patch("/rooms/:roomId/settings", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        const playerId = String(req.body?.playerId ?? "");
        const timer = Number(req.body?.timer);
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        if (record.room.hostId !== playerId) {
            return res.status(403).json({ error: "only host can update settings" });
        }
        if (!Number.isFinite(timer)) {
            return res.status(400).json({ error: "timer must be a number" });
        }
        record.room.settings.timer = Math.max(10, Math.min(300, timer));
        if (record.turnSecondsRemaining !== null && !record.waitingForWordResolutionAtZero) {
            record.turnSecondsRemaining = Math.min(record.turnSecondsRemaining, record.room.settings.timer);
        }
        (0, broadcast_1.broadcastRoomState)(roomId, record);
        return res.json((0, roomService_1.buildRoomStatePayload)(roomId, record));
    });
    app.post("/rooms/:roomId/start", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        const playerId = String(req.body?.playerId ?? "");
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        if (record.room.hostId !== playerId) {
            return res.status(403).json({ error: "only host can start the game" });
        }
        if (record.room.players.length < 2) {
            return res.status(400).json({ error: "at least 2 players are required to start" });
        }
        record.startRequested = true;
        if ((0, roomService_1.allPlayersConnected)(record)) {
            (0, roomService_1.startRoomGame)(roomId, record, broadcasters);
        }
        else {
            (0, broadcast_1.broadcastRoomState)(roomId, record);
        }
        return res.json((0, roomService_1.buildRoomStatePayload)(roomId, record));
    });
    app.get("/rooms/:roomId/chat", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        return res.json({ roomId, messages: record.chatMessages });
    });
    app.post("/rooms/:roomId/chat", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        const playerId = String(req.body?.playerId ?? "");
        const text = String(req.body?.text ?? "").trim();
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        if (!record.started) {
            return res.status(400).json({ error: "game has not started" });
        }
        const player = record.room.players.find((roomPlayer) => roomPlayer.id === playerId);
        if (!player) {
            return res.status(403).json({ error: "player is not in this room" });
        }
        if (!text) {
            return res.status(400).json({ error: "text is required" });
        }
        const message = {
            id: (0, common_1.createId)("msg"),
            playerId: player.id,
            playerName: player.name,
            text,
            createdAt: new Date().toISOString(),
        };
        record.chatMessages.push(message);
        (0, broadcast_1.broadcastToRoom)(roomId, { type: "chat_message", roomId, message });
        const isActivePlayer = player.id === record.currentTurnPlayerId;
        const hasWordToGuess = Boolean(record.currentWord);
        const attemptedSelfGuess = isActivePlayer && hasWordToGuess && (0, common_1.normalizeWord)(text) === (0, common_1.normalizeWord)(record.currentWord ?? "");
        const guessedWord = !isActivePlayer &&
            hasWordToGuess &&
            (0, common_1.normalizeWord)(text) === (0, common_1.normalizeWord)(record.currentWord ?? "");
        if (attemptedSelfGuess) {
            const rejectedGuessMessage = {
                id: (0, common_1.createId)("msg"),
                playerId: "system",
                playerName: "System",
                text: `${player.name} cannot guess their own word.`,
                createdAt: new Date().toISOString(),
            };
            record.chatMessages.push(rejectedGuessMessage);
            (0, broadcast_1.broadcastToRoom)(roomId, { type: "chat_message", roomId, message: rejectedGuessMessage });
        }
        if (guessedWord) {
            player.score += 1;
            const activePlayer = record.room.players.find((roomPlayer) => roomPlayer.id === record.currentTurnPlayerId);
            if (activePlayer) {
                activePlayer.score += 1;
            }
            const solvedMessage = {
                id: (0, common_1.createId)("msg"),
                playerId: "system",
                playerName: "System",
                text: `${player.name} guessed the word. +1 point for guesser and active player.`,
                createdAt: new Date().toISOString(),
            };
            record.chatMessages.push(solvedMessage);
            (0, broadcast_1.broadcastToRoom)(roomId, { type: "chat_message", roomId, message: solvedMessage });
            (0, roomService_1.resolveCurrentWord)(roomId, record, broadcasters);
        }
        return res.status(201).json({ roomId, message });
    });
    app.post("/rooms/:roomId/skip", (req, res) => {
        const roomId = (0, common_1.getRouteParam)(req.params.roomId);
        const record = serverState_1.rooms.get(roomId);
        const playerId = String(req.body?.playerId ?? "");
        if (!record) {
            return res.status(404).json({ error: "room not found" });
        }
        if (!record.started) {
            return res.status(400).json({ error: "game has not started" });
        }
        if (!record.currentTurnPlayerId || record.currentTurnPlayerId !== playerId) {
            return res.status(403).json({ error: "only active player can skip the word" });
        }
        const activePlayer = record.room.players.find((roomPlayer) => roomPlayer.id === playerId);
        if (!activePlayer) {
            return res.status(403).json({ error: "player is not in this room" });
        }
        const skippedMessage = {
            id: (0, common_1.createId)("msg"),
            playerId: "system",
            playerName: "System",
            text: `${activePlayer.name} skipped the word.`,
            createdAt: new Date().toISOString(),
        };
        record.chatMessages.push(skippedMessage);
        (0, broadcast_1.broadcastToRoom)(roomId, { type: "chat_message", roomId, message: skippedMessage });
        (0, roomService_1.resolveCurrentWord)(roomId, record, broadcasters);
        return res.status(200).json((0, roomService_1.buildRoomStatePayload)(roomId, record));
    });
};
exports.registerRoomRoutes = registerRoomRoutes;
//# sourceMappingURL=roomRoutes.js.map