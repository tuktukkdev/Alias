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
  startRequested: boolean;
  startedAt: string | null;
  connectedPlayerIds: Set<string>;
  chatMessages: ChatMessage[];
  turnSecondsRemaining: number | null;
  currentTurnPlayerId: string | null;
  currentWord: string | null;
  waitingForWordResolutionAtZero: boolean;
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

interface RoomStateBroadcastEvent {
  type: "room_state";
  roomId: string;
  room: GameRoom;
  started: boolean;
  startRequested: boolean;
  startedAt: string | null;
  connectedPlayerIds: string[];
  turnSecondsRemaining: number | null;
  currentTurnPlayerId: string | null;
  waitingForWordResolutionAtZero: boolean;
}

interface ActiveWordBroadcastEvent {
  type: "active_word";
  roomId: string;
  word: string | null;
}

type RoomBroadcastEvent = ChatBroadcastEvent | RoomStateBroadcastEvent | ActiveWordBroadcastEvent;

const app = express();
const rooms = new Map<string, RoomRecord>();
const roomSockets = new Map<string, Set<WebSocket>>();
const socketRooms = new WeakMap<WebSocket, string>();
const socketPlayers = new WeakMap<WebSocket, string>();
const roomTickIntervals = new Map<string, NodeJS.Timeout>();
const GAME_START_DELAY_MS = 3000;
const WORD_POOL = [
  "самолет",
  "дерево",
  "река",
  "облако",
  "молния",
  "велосипед",
  "чайник",
  "крокодил",
  "компас",
  "библиотека",
  "телескоп",
  "карандаш",
  "футбол",
  "радуга",
  "холодильник",
  "пианино",
  "космонавт",
  "шоколад",
  "фонарик",
  "остров",
  "шторм",
  "калькулятор",
  "подушка",
  "медуза",
  "картина",
  "вулкан",
  "чемодан",
  "метро",
  "гитара",
  "кактус",
  "пингвин",
  "песочные часы",
  "будильник",
  "водопад",
  "клавиатура",
  "вертолет",
  "пустыня",
  "корабль",
  "фейерверк",
  "мороженое",
] as const;

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

const normalizeWord = (value: string): string => value.trim().toLowerCase().replace(/ё/g, "е");

const getRandomWord = (): string => WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)] ?? "слово";

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

const buildRoomStatePayload = (
  roomId: string,
  record: RoomRecord,
): Omit<RoomStateBroadcastEvent, "type"> => ({
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

const clearRoomTickInterval = (roomId: string): void => {
  const interval = roomTickIntervals.get(roomId);
  if (!interval) {
    return;
  }

  clearInterval(interval);
  roomTickIntervals.delete(roomId);
};

const getNextTurnPlayerId = (record: RoomRecord): string | null => {
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

const startRoomTickLoop = (roomId: string): void => {
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
      if (!record.currentWord) {
        record.currentWord = getRandomWord();
      }
      record.waitingForWordResolutionAtZero = false;
      broadcastRoomState(roomId, record);
      broadcastActiveWord(roomId, record);
      return;
    }

    if (record.turnSecondsRemaining === null) {
      record.turnSecondsRemaining = record.room.settings.timer;
    }

    if (record.waitingForWordResolutionAtZero) {
      record.turnSecondsRemaining = 0;
      broadcastRoomState(roomId, record);
      return;
    }

    record.turnSecondsRemaining = Math.max(0, record.turnSecondsRemaining - 1);

    if (record.turnSecondsRemaining === 0) {
      record.waitingForWordResolutionAtZero = true;
    }

    broadcastRoomState(roomId, record);
  }, 1000);

  roomTickIntervals.set(roomId, interval);
};

const allPlayersConnected = (record: RoomRecord): boolean => {
  return record.room.players.every((player) => record.connectedPlayerIds.has(player.id));
};

const hasAnotherSocketForPlayer = (
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

const broadcastToRoom = (roomId: string, event: RoomBroadcastEvent): void => {
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

const broadcastRoomState = (roomId: string, record: RoomRecord): void => {
  broadcastToRoom(roomId, {
    type: "room_state",
    ...buildRoomStatePayload(roomId, record),
  });
};

const broadcastActiveWord = (roomId: string, record: RoomRecord): void => {
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

const resolveCurrentWord = (roomId: string, record: RoomRecord): void => {
  const timedOut = record.turnSecondsRemaining === 0 || record.waitingForWordResolutionAtZero;

  if (timedOut) {
    record.currentTurnPlayerId = getNextTurnPlayerId(record);
    record.turnSecondsRemaining = record.room.settings.timer;
  }

  record.currentWord = getRandomWord();
  record.waitingForWordResolutionAtZero = false;

  if (record.turnSecondsRemaining === null) {
    record.turnSecondsRemaining = record.room.settings.timer;
  }

  broadcastRoomState(roomId, record);
  broadcastActiveWord(roomId, record);
};

const startRoomGame = (roomId: string, record: RoomRecord): void => {
  if (record.started) {
    return;
  }

  // Add a short lead time so all clients can render the start frame before timer ticks.
  record.started = true;
  record.startRequested = false;
  record.startedAt = new Date(Date.now() + GAME_START_DELAY_MS).toISOString();
  record.turnSecondsRemaining = record.room.settings.timer;
  record.currentTurnPlayerId = record.room.players[0]?.id ?? null;
  record.currentWord = getRandomWord();
  record.waitingForWordResolutionAtZero = false;
  broadcastRoomState(roomId, record);
  broadcastActiveWord(roomId, record);
  startRoomTickLoop(roomId);
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

  rooms.set(roomId, {
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

  const player: Player = {
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

app.get("/rooms/:roomId", (req: Request, res: Response) => {
  const roomId = getRouteParam(req.params.roomId);
  const record = rooms.get(roomId);

  if (!record) {
    return res.status(404).json({ error: "room not found" });
  }

  return res.json(buildRoomStatePayload(roomId, record));
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
  if (record.turnSecondsRemaining !== null && !record.waitingForWordResolutionAtZero) {
    record.turnSecondsRemaining = Math.min(record.turnSecondsRemaining, record.room.settings.timer);
  }
  broadcastRoomState(roomId, record);
  return res.json(buildRoomStatePayload(roomId, record));
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

  record.startRequested = true;

  if (allPlayersConnected(record)) {
    startRoomGame(roomId, record);
  } else {
    broadcastRoomState(roomId, record);
  }

  return res.json(buildRoomStatePayload(roomId, record));
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

  const isActivePlayer = player.id === record.currentTurnPlayerId;
  const hasWordToGuess = Boolean(record.currentWord);
  const attemptedSelfGuess =
    isActivePlayer && hasWordToGuess && normalizeWord(text) === normalizeWord(record.currentWord ?? "");
  const guessedWord =
    !isActivePlayer &&
    hasWordToGuess &&
    normalizeWord(text) === normalizeWord(record.currentWord ?? "");

  if (attemptedSelfGuess) {
    const rejectedGuessMessage: ChatMessage = {
      id: createId("msg"),
      playerId: "system",
      playerName: "System",
      text: `${player.name} cannot guess their own word.`,
      createdAt: new Date().toISOString(),
    };

    record.chatMessages.push(rejectedGuessMessage);
    broadcastToRoom(roomId, { type: "chat_message", roomId, message: rejectedGuessMessage });
  }

  if (guessedWord) {
    player.score += 1;

    const activePlayer = record.room.players.find(
      (roomPlayer) => roomPlayer.id === record.currentTurnPlayerId,
    );
    if (activePlayer) {
      activePlayer.score += 1;
    }

    const solvedMessage: ChatMessage = {
      id: createId("msg"),
      playerId: "system",
      playerName: "System",
      text: `${player.name} guessed the word. +1 point for guesser and active player.`,
      createdAt: new Date().toISOString(),
    };

    record.chatMessages.push(solvedMessage);
    broadcastToRoom(roomId, { type: "chat_message", roomId, message: solvedMessage });
    resolveCurrentWord(roomId, record);
  }

  return res.status(201).json({ roomId, message });
});

app.post("/rooms/:roomId/skip", (req: Request, res: Response) => {
  const roomId = getRouteParam(req.params.roomId);
  const record = rooms.get(roomId);
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

  const skippedMessage: ChatMessage = {
    id: createId("msg"),
    playerId: "system",
    playerName: "System",
    text: `${activePlayer.name} skipped the word.`,
    createdAt: new Date().toISOString(),
  };

  record.chatMessages.push(skippedMessage);
  broadcastToRoom(roomId, { type: "chat_message", roomId, message: skippedMessage });
  resolveCurrentWord(roomId, record);

  return res.status(200).json(buildRoomStatePayload(roomId, record));
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
  socketPlayers.set(socket, playerId);
  addSocketToRoom(roomId, socket);

  record.connectedPlayerIds.add(playerId);

  if (record.startRequested && !record.started && allPlayersConnected(record)) {
    startRoomGame(roomId, record);
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
});