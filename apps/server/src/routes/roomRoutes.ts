import { Express, Request, Response } from "express";
import { broadcastActiveWord, broadcastRoomState, broadcastToRoom, closePlayerSockets } from "../ws/broadcast";
import { rooms, userRooms } from "../state/serverState";
import {
  allPlayersConnected,
  buildRoomStatePayload,
  endGame,
  removePlayerPermanently,
  resolveCurrentWord,
  startRoomGame,
} from "../services/roomService";
import { createId, getRouteParam, normalizeWord } from "../utils/common";
import { ChatMessage, GameRoom, Player, RoomBroadcasters, SelectedCollection } from "../types/game";
import { countCollectionWords } from "../services/wordService";

const broadcasters: RoomBroadcasters = {
  broadcastRoomState,
  broadcastActiveWord,
};

// регистрация роутов для игровых комнат
export const registerRoomRoutes = (app: Express): void => {
  // проверка что сервер работает
  app.get("/", (_: Request, res: Response) => {
    res.send("Server works");
  });

  // эндпоинт для создания комнаты
  app.post("/rooms", (req: Request, res: Response) => {
    const name = String(req.body?.name ?? "").trim();
    const timer = Number(req.body?.timer ?? 60);
    const winScore = Number(req.body?.winScore ?? 50);
    const difficulty = Number(req.body?.difficulty ?? 1);
    const userId = String(req.body?.userId ?? "").trim() || null;
    const userIdNum = userId ? parseInt(userId, 10) : NaN;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    if (userId) {
      const existing = userRooms.get(userId);
      if (existing) {
        if (rooms.has(existing.roomId)) {
          return res.status(409).json({
            error: "already_in_room",
            roomId: existing.roomId,
            playerId: existing.playerId,
          });
        }
        userRooms.delete(userId);
      }
    }

    const player: Player = {
      id: createId("player"),
      name,
      score: 0,
      userId: !isNaN(userIdNum) ? userIdNum : undefined,
    };

    const roomId = createId("room");
    const room: GameRoom = {
      players: [player],
      hostId: player.id,
      settings: {
        timer: Number.isFinite(timer) ? Math.max(10, Math.min(300, timer)) : 60,
        winScore: Number.isFinite(winScore) ? Math.max(20, Math.min(200, winScore)) : 50,
        difficulty: Number.isFinite(difficulty) ? Math.max(1, Math.min(3, difficulty)) : 1,
        selectedCollections: [],
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
      usedWords: new Set(),
      wordPool: null,
      playerStats: new Map(),
      gameStartedAt: null,
      winner: null,
    });

    if (userId) {
      userRooms.set(userId, { roomId, playerId: player.id });
    }

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

  // присоединиться к комнате
  app.post("/rooms/:roomId/join", (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
    const name = String(req.body?.name ?? "").trim();
    const requestedPlayerId = String(req.body?.playerId ?? "").trim();
    const userId = String(req.body?.userId ?? "").trim() || null;

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

        if (userId) {
          userRooms.set(userId, { roomId, playerId: existingPlayer.id });
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

    if (record.room.players.length >= 10) {
      return res.status(403).json({ error: "room is full (max 10 players)" });
    }

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    if (userId) {
      const existing = userRooms.get(userId);
      if (existing) {
        if (rooms.has(existing.roomId)) {
          return res.status(409).json({
            error: "already_in_room",
            roomId: existing.roomId,
            playerId: existing.playerId,
          });
        }
        userRooms.delete(userId);
      }
    }

    const player: Player = {
      id: createId("player"),
      name,
      score: 0,
      userId: userId ? (parseInt(userId, 10) || undefined) : undefined,
    };

    record.room.players.push(player);

    if (userId) {
      userRooms.set(userId, { roomId, playerId: player.id });
    }

    broadcastRoomState(roomId, record);
    return res.status(201).json({
      playerId: player.id,
      ...buildRoomStatePayload(roomId, record),
    });
  });

  // получить состояние комнаты
  app.get("/rooms/:roomId", (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);

    if (!record) {
      return res.status(404).json({ error: "room not found" });
    }

    return res.json(buildRoomStatePayload(roomId, record));
  });

  // обновить настройки комнаты (только хост)
  app.patch("/rooms/:roomId/settings", (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
    const playerId = String(req.body?.playerId ?? "");
    const timer = req.body?.timer !== undefined ? Number(req.body.timer) : undefined;
    const difficulty = req.body?.difficulty !== undefined ? Number(req.body.difficulty) : undefined;
    const winScore = req.body?.winScore !== undefined ? Number(req.body.winScore) : undefined;

    if (!record) {
      return res.status(404).json({ error: "room not found" });
    }

    if (record.room.hostId !== playerId) {
      return res.status(403).json({ error: "only host can update settings" });
    }

    if (timer !== undefined) {
      if (!Number.isFinite(timer)) {
        return res.status(400).json({ error: "timer must be a number" });
      }
      record.room.settings.timer = Math.max(10, Math.min(300, timer));
      if (record.turnSecondsRemaining !== null && !record.waitingForWordResolutionAtZero) {
        record.turnSecondsRemaining = Math.min(record.turnSecondsRemaining, record.room.settings.timer);
      }
    }

    if (difficulty !== undefined) {
      if (!Number.isFinite(difficulty)) {
        return res.status(400).json({ error: "difficulty must be a number" });
      }
      record.room.settings.difficulty = Math.max(1, Math.min(3, difficulty));
    }

    if (winScore !== undefined) {
      if (!Number.isFinite(winScore)) {
        return res.status(400).json({ error: "winScore must be a number" });
      }
      record.room.settings.winScore = Math.max(20, Math.min(200, winScore));
    }

    broadcastRoomState(roomId, record);
    return res.json(buildRoomStatePayload(roomId, record));
  });

  // запустить игру в комнате
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
      void startRoomGame(roomId, record, broadcasters);
    } else {
      broadcastRoomState(roomId, record);
    }

    return res.json(buildRoomStatePayload(roomId, record));
  });

  // получить историю чата комнаты
  app.get("/rooms/:roomId/chat", (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);

    if (!record) {
      return res.status(404).json({ error: "room not found" });
    }

    return res.json({ roomId, messages: record.chatMessages });
  });

  // отправить сообщение в чат (и проверить угадано ли слово)
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

    if (text.length > 50) {
      return res.status(400).json({ error: "Message too long (max 50 characters)." });
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
        const activeStats = record.playerStats.get(activePlayer.id) ?? { guessed: 0, skipped: 0 };
        activeStats.guessed++;
        record.playerStats.set(activePlayer.id, activeStats);
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
      resolveCurrentWord(roomId, record, broadcasters);
    }

    return res.status(201).json({ roomId, message });
  });

  // пропустить слово (минус очко)
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

    activePlayer.score = Math.max(0, activePlayer.score - 1);

    const skipStats = record.playerStats.get(playerId) ?? { guessed: 0, skipped: 0 };
    skipStats.skipped++;
    record.playerStats.set(playerId, skipStats);

    const skippedMessage: ChatMessage = {
      id: createId("msg"),
      playerId: "system",
      playerName: "System",
      text: `${activePlayer.name} skipped the word. -1 point.`,
      createdAt: new Date().toISOString(),
    };

    record.chatMessages.push(skippedMessage);
    broadcastToRoom(roomId, { type: "chat_message", roomId, message: skippedMessage });
    resolveCurrentWord(roomId, record, broadcasters);

    return res.status(200).json(buildRoomStatePayload(roomId, record));
  });

  // удалить игрока из комнаты
  app.delete("/rooms/:roomId/players/:playerId", (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const playerId = getRouteParam(req.params.playerId);
    const userId = String(req.body?.userId ?? "").trim() || null;

    const record = rooms.get(roomId);
    if (!record) {
      return res.status(404).json({ error: "room not found" });
    }

    const player = record.room.players.find((p) => p.id === playerId);
    if (!player) {
      return res.status(404).json({ error: "player not found in room" });
    }

    if (userId) {
      userRooms.delete(userId);
    }

    closePlayerSockets(roomId, playerId);
    removePlayerPermanently(roomId, playerId, broadcasters);

    return res.status(200).json({ ok: true });
  });

  // обновить выбранные коллекции для комнаты
  app.put("/rooms/:roomId/collections", async (req: Request, res: Response) => {
    const roomId = getRouteParam(req.params.roomId);
    const record = rooms.get(roomId);
    const playerId = String(req.body?.playerId ?? "");
    const collections = req.body?.collections;

    if (!record) {
      return res.status(404).json({ error: "room not found" });
    }

    if (record.room.hostId !== playerId) {
      return res.status(403).json({ error: "only host can update collections" });
    }

    if (!Array.isArray(collections)) {
      return res.status(400).json({ error: "collections must be an array" });
    }

    const parsed: SelectedCollection[] = collections
      .filter(
        (c: unknown): c is { id: number; type: string } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).id === "number" &&
          ((c as Record<string, unknown>).type === "default" || (c as Record<string, unknown>).type === "custom"),
      )
      .map((c) => ({ id: c.id, type: c.type as "default" | "custom" }));

    record.room.settings.selectedCollections = parsed;

    const totalWords = await countCollectionWords(parsed);

    broadcastRoomState(roomId, record);
    return res.json({
      ...buildRoomStatePayload(roomId, record),
      totalCollectionWords: totalWords,
    });
  });

  // узнать в какой комнате сейчас игрок
  app.get("/players/:userId/room", (req: Request, res: Response) => {
    const userId = getRouteParam(req.params.userId);
    const entry = userRooms.get(userId);
    if (!entry) {
      return res.status(404).json({ error: "not in a room" });
    }

    if (!rooms.has(entry.roomId)) {
      userRooms.delete(userId);
      return res.status(404).json({ error: "not in a room" });
    }

    return res.json({ roomId: entry.roomId, playerId: entry.playerId });
  });
};
