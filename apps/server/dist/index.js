"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const app = (0, express_1.default)();
const rooms = new Map();
const roomSockets = new Map();
const socketRooms = new WeakMap();
const socketPlayers = new WeakMap();
const roomTickIntervals = new Map();
const GAME_START_DELAY_MS = 3000;
app.use(express_1.default.json());
app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    next();
});
app.options(/.*/, (_, res) => {
    res.sendStatus(204);
});
const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const getRouteParam = (value) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
const addSocketToRoom = (roomId, socket) => {
    const sockets = roomSockets.get(roomId);
    if (sockets) {
        sockets.add(socket);
        return;
    }
    roomSockets.set(roomId, new Set([socket]));
};
const removeSocketFromRoom = (socket) => {
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
const buildRoomStatePayload = (roomId, record) => ({
    roomId,
    room: record.room,
    started: record.started,
    startRequested: record.startRequested,
    startedAt: record.startedAt,
    connectedPlayerIds: [...record.connectedPlayerIds],
    turnSecondsRemaining: record.turnSecondsRemaining,
    currentTurnPlayerId: record.currentTurnPlayerId,
});
const clearRoomTickInterval = (roomId) => {
    const interval = roomTickIntervals.get(roomId);
    if (!interval) {
        return;
    }
    clearInterval(interval);
    roomTickIntervals.delete(roomId);
};
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
const startRoomTickLoop = (roomId) => {
    if (roomTickIntervals.has(roomId)) {
        return;
    }
    const interval = setInterval(() => {
        const record = rooms.get(roomId);
        if (!record) {
            clearRoomTickInterval(roomId);
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
            record.currentTurnPlayerId = getNextTurnPlayerId(record);
            record.turnSecondsRemaining = record.room.settings.timer;
            broadcastRoomState(roomId, record);
            return;
        }
        if (record.turnSecondsRemaining === null) {
            record.turnSecondsRemaining = record.room.settings.timer;
        }
        record.turnSecondsRemaining = Math.max(0, record.turnSecondsRemaining - 1);
        if (record.turnSecondsRemaining === 0) {
            record.currentTurnPlayerId = getNextTurnPlayerId(record);
            record.turnSecondsRemaining = record.room.settings.timer;
        }
        broadcastRoomState(roomId, record);
    }, 1000);
    roomTickIntervals.set(roomId, interval);
};
const allPlayersConnected = (record) => {
    return record.room.players.every((player) => record.connectedPlayerIds.has(player.id));
};
const hasAnotherSocketForPlayer = (roomId, playerId, ignoredSocket) => {
    const sockets = roomSockets.get(roomId);
    if (!sockets) {
        return false;
    }
    for (const socket of sockets) {
        if (socket === ignoredSocket) {
            continue;
        }
        if (socketPlayers.get(socket) === playerId && socket.readyState === ws_1.WebSocket.OPEN) {
            return true;
        }
    }
    return false;
};
const broadcastToRoom = (roomId, event) => {
    const sockets = roomSockets.get(roomId);
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
const broadcastRoomState = (roomId, record) => {
    broadcastToRoom(roomId, {
        type: "room_state",
        ...buildRoomStatePayload(roomId, record),
    });
};
const startRoomGame = (roomId, record) => {
    if (record.started) {
        return;
    }
    // Add a short lead time so all clients can render the start frame before timer ticks.
    record.started = true;
    record.startRequested = false;
    record.startedAt = new Date(Date.now() + GAME_START_DELAY_MS).toISOString();
    record.turnSecondsRemaining = record.room.settings.timer;
    record.currentTurnPlayerId = record.room.players[0]?.id ?? null;
    broadcastRoomState(roomId, record);
    startRoomTickLoop(roomId);
};
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
        id: createId("player"),
        name,
        score: 0,
    };
    const roomId = createId("room");
    const room = {
        players: [player],
        hostId: player.id,
        settings: {
            timer: Number.isFinite(timer) ? Math.max(10, Math.min(300, timer)) : 60,
            winScore: Number.isFinite(winScore) ? Math.max(1, winScore) : 10,
        },
    };
    rooms.set(roomId, {
        room,
        started: false,
        startRequested: false,
        startedAt: null,
        connectedPlayerIds: new Set(),
        chatMessages: [],
        turnSecondsRemaining: null,
        currentTurnPlayerId: null,
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
    });
});
app.post("/rooms/:roomId/join", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
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
                ...buildRoomStatePayload(roomId, record),
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
        id: createId("player"),
        name,
        score: 0,
    };
    record.room.players.push(player);
    broadcastRoomState(roomId, record);
    return res.status(201).json({
        playerId: player.id,
        ...buildRoomStatePayload(roomId, record),
    });
});
app.get("/rooms/:roomId", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
    if (!record) {
        return res.status(404).json({ error: "room not found" });
    }
    return res.json(buildRoomStatePayload(roomId, record));
});
app.patch("/rooms/:roomId/settings", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
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
    broadcastRoomState(roomId, record);
    return res.json(buildRoomStatePayload(roomId, record));
});
app.post("/rooms/:roomId/start", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
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
    if (allPlayersConnected(record)) {
        startRoomGame(roomId, record);
    }
    else {
        broadcastRoomState(roomId, record);
    }
    return res.json(buildRoomStatePayload(roomId, record));
});
app.get("/rooms/:roomId/chat", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
    if (!record) {
        return res.status(404).json({ error: "room not found" });
    }
    return res.json({ roomId, messages: record.chatMessages });
});
app.post("/rooms/:roomId/chat", (req, res) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
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
        id: createId("msg"),
        playerId: player.id,
        playerName: player.name,
        text,
        createdAt: new Date().toISOString(),
    };
    record.chatMessages.push(message);
    broadcastToRoom(roomId, { type: "chat_message", roomId, message });
    return res.status(201).json({ roomId, message });
});
const server = app.listen(3000, () => {
    console.log("Server running on port 3000");
});
const wss = new ws_1.WebSocketServer({ server, path: "/ws" });
wss.on("connection", (socket, req) => {
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
        startRoomGame(roomId, record);
    }
    else {
        broadcastRoomState(roomId, record);
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
});
//# sourceMappingURL=index.js.map