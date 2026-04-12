import { GAME_START_DELAY_MS, WORD_POOL, roomSockets, roomTickIntervals, rooms } from "../state/serverState";
import { RoomBroadcasters, RoomRecord, RoomStateBroadcastEvent } from "../types/game";

export const buildRoomStatePayload = (
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

export const clearRoomTickInterval = (roomId: string): void => {
  const interval = roomTickIntervals.get(roomId);
  if (!interval) {
    return;
  }

  clearInterval(interval);
  roomTickIntervals.delete(roomId);
};

export const getRandomWord = (): string =>
  WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)] ?? "слово";

export const getNextTurnPlayerId = (record: RoomRecord): string | null => {
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

export const allPlayersConnected = (record: RoomRecord): boolean => {
  return record.room.players.every((player) => record.connectedPlayerIds.has(player.id));
};

export const startRoomTickLoop = (roomId: string, broadcasters: RoomBroadcasters): void => {
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

  roomTickIntervals.set(roomId, interval);
};

export const resolveCurrentWord = (
  roomId: string,
  record: RoomRecord,
  broadcasters: RoomBroadcasters,
): void => {
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

  broadcasters.broadcastRoomState(roomId, record);
  broadcasters.broadcastActiveWord(roomId, record);
};

export const removePlayerPermanently = (
  roomId: string,
  playerId: string,
  broadcasters: RoomBroadcasters,
): void => {
  const record = rooms.get(roomId);
  if (!record) {
    return;
  }

  record.room.players = record.room.players.filter((p) => p.id !== playerId);
  record.connectedPlayerIds.delete(playerId);

  if (record.started && record.currentTurnPlayerId === playerId && record.room.players.length > 0) {
    record.currentTurnPlayerId = getNextTurnPlayerId(record);
    record.currentWord = getRandomWord();
    record.waitingForWordResolutionAtZero = false;
    record.turnSecondsRemaining = record.room.settings.timer;
    broadcasters.broadcastActiveWord(roomId, record);
  }

  if (record.room.hostId === playerId && record.room.players.length > 0) {
    record.room.hostId = record.room.players[0].id;
  }

  if (record.room.players.length === 0) {
    clearRoomTickInterval(roomId);
    rooms.delete(roomId);
    roomSockets.delete(roomId);
    return;
  }

  broadcasters.broadcastRoomState(roomId, record);
};

export const startRoomGame = (
  roomId: string,
  record: RoomRecord,
  broadcasters: RoomBroadcasters,
): void => {
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
  broadcasters.broadcastRoomState(roomId, record);
  broadcasters.broadcastActiveWord(roomId, record);
  startRoomTickLoop(roomId, broadcasters);
};
