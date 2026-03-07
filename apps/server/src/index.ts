import express, { Request, Response } from "express";
import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";

interface Player {
  id: string;
  name: string;
  score: number;
}

interface GameRoomSettings {
  timer: number;
  winScore: number;
}

interface GameRoom {
  players: Player[];
  hostId: string;
  settings: GameRoomSettings;
}

interface RoomRecord {
  room: GameRoom;
  started: boolean;
  chatMessages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: string;
}

interface ChatBroadcastEvent {
  type: "chat_message";
  roomId: string;
  message: ChatMessage;
}

const app = express();
const rooms = new Map<string, RoomRecord>();
const roomSockets = new Map<string, Set<WebSocket>>();
const socketRooms = new WeakMap<WebSocket, string>();

app.use(express.json());
app.use((_: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  next();
});

app.options(/.*/, (_: Request, res: Response) => {
  res.sendStatus(204);
});

const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const getRouteParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const addSocketToRoom = (roomId: string, socket: WebSocket): void => {
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    sockets.add(socket);
    return;
  }

  roomSockets.set(roomId, new Set([socket]));
};

const removeSocketFromRoom = (socket: WebSocket): void => {
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

const broadcastToRoom = (roomId: string, event: ChatBroadcastEvent): void => {
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

app.get("/", (_: Request, res: Response) => {
  res.send("Server works");
});

app.post("/rooms", (req: Request, res: Response) => {
  const name = String(req.body?.name ?? "").trim();
  const timer = Number(req.body?.timer ?? 60);
  const winScore = Number(req.body?.winScore ?? 10);

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const player: Player = {
    id: createId("player"),
    name,
    score: 0,
  };

  const roomId = createId("room");
  const room: GameRoom = {
    players: [player],
    hostId: player.id,
    settings: {
      timer: Number.isFinite(timer) ? Math.max(10, Math.min(300, timer)) : 60,
      winScore: Number.isFinite(winScore) ? Math.max(1, winScore) : 10,
    },
  };

  rooms.set(roomId, { room, started: false, chatMessages: [] });
  return res.status(201).json({ roomId, playerId: player.id, room });
});

app.post("/rooms/:roomId/join", (req: Request, res: Response) => {
  const roomId = getRouteParam(req.params.roomId);
  const record = rooms.get(roomId);
  const name = String(req.body?.name ?? "").trim();
  const requestedPlayerId = String(req.body?.playerId ?? "").trim();

  if (!record) {
    return res.status(404).json({ error: "room not found" });
  }

  if (requestedPlayerId) {
    const existingPlayer = record.room.players.find(
      (roomPlayer) => roomPlayer.id === requestedPlayerId,
    );

    if (existingPlayer) {
      if (name) {
        existingPlayer.name = name;
      }

      return res.json({
        roomId,
        playerId: existingPlayer.id,
        room: record.room,
        started: record.started,
      });
    }
  }

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const player: Player = {
    id: createId("player"),
    name,
    score: 0,
  };

  record.room.players.push(player);
  return res.status(201).json({ roomId, playerId: player.id, room: record.room });
});

app.get("/rooms/:roomId", (req: Request, res: Response) => {
  const roomId = getRouteParam(req.params.roomId);
  const record = rooms.get(roomId);

  if (!record) {
    return res.status(404).json({ error: "room not found" });
  }

  return res.json({ roomId, room: record.room, started: record.started });
});

app.patch("/rooms/:roomId/settings", (req: Request, res: Response) => {
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
  return res.json({ roomId, room: record.room });
});

app.post("/rooms/:roomId/start", (req: Request, res: Response) => {
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

  record.started = true;
  return res.json({ roomId, room: record.room, started: record.started });
});

app.get("/rooms/:roomId/chat", (req: Request, res: Response) => {
  const roomId = getRouteParam(req.params.roomId);
  const record = rooms.get(roomId);

  if (!record) {
    return res.status(404).json({ error: "room not found" });
  }

  return res.json({ roomId, messages: record.chatMessages });
});

app.post("/rooms/:roomId/chat", (req: Request, res: Response) => {
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

  const message: ChatMessage = {
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
  addSocketToRoom(roomId, socket);

  socket.on("close", () => {
    removeSocketFromRoom(socket);
  });
});