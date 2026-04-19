// сервис игровой комнаты — основная логика игры
import { WebSocket } from "ws";
import { prisma } from "../db/prisma";
import {
  ALL_OFFLINE_CLOSE_MS,
  GAME_START_DELAY_MS,
  PLAYER_OFFLINE_KICK_MS,
  playerOfflineTimers,
  roomAllOfflineTimers,
  roomSockets,
  roomTickIntervals,
  rooms,
  userRooms,
} from "../state/serverState";
import { Player, PlayerGameStats, RoomBroadcasters, RoomRecord, RoomStateBroadcastEvent, WinnerInfo } from "../types/game";
import { loadWordPool, pickWordFromPool } from "./wordService";

// экспортируем константы чтобы socketPresenceService мог их использовать
export { PLAYER_OFFLINE_KICK_MS, ALL_OFFLINE_CLOSE_MS };

// собираем объект состояния комнаты для отправки клиентам
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
  winner: record.winner,
});

// останавливаем таймер комнаты
export const clearRoomTickInterval = (roomId: string): void => {
  const interval = roomTickIntervals.get(roomId);
  if (!interval) {
    return;
  }

  clearInterval(interval);
  roomTickIntervals.delete(roomId);
};

// полностью закрыть комнату: отменить таймеры, закрыть сокеты, удалить из state
export const closeRoomFully = (roomId: string): void => {
  const record = rooms.get(roomId);

  clearRoomTickInterval(roomId);

  // отменяем таймеры офлайна для всех игроков и чистим userRooms
  if (record) {
    for (const player of record.room.players) {
      const offlineKey = `${roomId}:${player.id}`;
      const offlineTimer = playerOfflineTimers.get(offlineKey);
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        playerOfflineTimers.delete(offlineKey);
      }
      if (player.userId) {
        userRooms.delete(String(player.userId));
      }
    }
  }

  // отменяем общий таймер «все офлайн»
  const allOfflineTimer = roomAllOfflineTimers.get(roomId);
  if (allOfflineTimer) {
    clearTimeout(allOfflineTimer);
    roomAllOfflineTimers.delete(roomId);
  }

  // удаляем комнату ДО закрытия сокетов — close-хендлеры увидят отсутствие комнаты и выйдут
  rooms.delete(roomId);

  // закрываем все сокеты
  const sockets = roomSockets.get(roomId);
  if (sockets) {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        try { socket.close(4010, "room closed"); } catch { }
      }
    }
    roomSockets.delete(roomId);
  }
};

// получаем следующее слово из пула
export const getNextWord = async (record: RoomRecord): Promise<string> => {
  const word = pickWordFromPool(record);
  record.usedWords.add(word);
  return word;
};

// определяем кто ходит следующим (по кругу)
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

// все ли игроки подключены
export const allPlayersConnected = (record: RoomRecord): boolean => {
  return record.room.players.every((player) => record.connectedPlayerIds.has(player.id));
};

// запускаем тик каждую секунду — основной игровой цикл
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
        void getNextWord(record).then((word) => {
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

  roomTickIntervals.set(roomId, interval);
};

// обработка текущего слова (угадано/пропущено/время вышло)
export const resolveCurrentWord = (
  roomId: string,
  record: RoomRecord,
  broadcasters: RoomBroadcasters,
): void => {
  const timedOut = record.turnSecondsRemaining === 0 || record.waitingForWordResolutionAtZero;

  if (timedOut) {
    // проверяем нет ли победителя перед сменой хода
    const winScore = record.room.settings.winScore;
    const topPlayer = record.room.players.reduce<Player | null>(
      (best, p) => (!best || p.score > best.score ? p : best),
      null,
    );
    if (topPlayer && topPlayer.score >= winScore) {
      void endGame(roomId, record, topPlayer, broadcasters);
      return;
    }

    record.currentTurnPlayerId = getNextTurnPlayerId(record);
    record.turnSecondsRemaining = record.room.settings.timer;
  }

  record.currentWord = null;
  record.waitingForWordResolutionAtZero = false;

  if (record.turnSecondsRemaining === null) {
    record.turnSecondsRemaining = record.room.settings.timer;
  }

  void getNextWord(record).then((word) => {
    record.currentWord = word;
    broadcasters.broadcastRoomState(roomId, record);
    broadcasters.broadcastActiveWord(roomId, record);
  });

  broadcasters.broadcastRoomState(roomId, record);
};

// удаляем игрока из комнаты насовсем
export const removePlayerPermanently = (
  roomId: string,
  playerId: string,
  broadcasters: RoomBroadcasters,
): void => {
  const record = rooms.get(roomId);
  if (!record) {
    return;
  }

  // сохраняем игрока до фильтрации чтобы очистить userRooms
  const removedPlayer = record.room.players.find((p) => p.id === playerId);
  record.room.players = record.room.players.filter((p) => p.id !== playerId);
  record.connectedPlayerIds.delete(playerId);

  if (removedPlayer?.userId) {
    userRooms.delete(String(removedPlayer.userId));
  }

  if (record.started && record.currentTurnPlayerId === playerId && record.room.players.length > 0) {
    // проверяем победителя перед передачей хода
    const winScore = record.room.settings.winScore;
    const topPlayer = record.room.players.reduce<Player | null>(
      (best, p) => (!best || p.score > best.score ? p : best),
      null,
    );
    if (topPlayer && topPlayer.score >= winScore) {
      void endGame(roomId, record, topPlayer, broadcasters);
      return;
    }

    record.currentTurnPlayerId = getNextTurnPlayerId(record);
    record.currentWord = null;
    record.waitingForWordResolutionAtZero = false;
    record.turnSecondsRemaining = record.room.settings.timer;
    void getNextWord(record).then((word) => {
      record.currentWord = word;
      broadcasters.broadcastActiveWord(roomId, record);
    });
  }

  if (record.room.hostId === playerId && record.room.players.length > 0) {
    record.room.hostId = record.room.players[0].id;
  }

  // нет игроков → закрываем комнату
  if (record.room.players.length === 0) {
    closeRoomFully(roomId);
    return;
  }

  // в лобби остался 1 игрок → комната бессмысленна, закрываем
  if (!record.started && record.room.players.length === 1) {
    closeRoomFully(roomId);
    return;
  }

  broadcasters.broadcastRoomState(roomId, record);
};

// запуск новой игры в комнате
export const startRoomGame = async (
  roomId: string,
  record: RoomRecord,
  broadcasters: RoomBroadcasters,
): Promise<void> => {
  if (record.started) {
    return;
  }

  // отмечаем старт синхронно чтобы роуты сразу видели новое состояние
  record.started = true;
  record.startRequested = false;
  record.startedAt = new Date(Date.now() + GAME_START_DELAY_MS).toISOString();
  record.turnSecondsRemaining = record.room.settings.timer;
  record.currentTurnPlayerId = record.room.players[0]?.id ?? null;
  record.currentWord = null;
  record.waitingForWordResolutionAtZero = false;
  record.usedWords.clear();
  record.wordPool = null;
  record.playerStats = new Map();
  record.gameStartedAt = new Date();
  record.winner = null;

  broadcasters.broadcastRoomState(roomId, record);

  // загружаем пул слов в память
  await loadWordPool(record);

  const word = await getNextWord(record);
  record.currentWord = word;
  broadcasters.broadcastActiveWord(roomId, record);

  startRoomTickLoop(roomId, broadcasters);
};

// завершаем игру и сохраняем результаты
export const endGame = async (
  roomId: string,
  record: RoomRecord,
  winner: Player,
  broadcasters: RoomBroadcasters,
): Promise<void> => {
  clearRoomTickInterval(roomId);
  record.winner = { playerId: winner.id, playerName: winner.name };
  record.currentWord = null;
  record.waitingForWordResolutionAtZero = false;
  broadcasters.broadcastRoomState(roomId, record);
  broadcasters.broadcastActiveWord(roomId, record);
  await saveGameStats(record, record.winner);
};

// сохраняем статистику игры в базу
async function saveGameStats(record: RoomRecord, winner: WinnerInfo): Promise<void> {
  const hostPlayer = record.room.players.find((p) => p.id === record.room.hostId);
  const hostUserId = hostPlayer?.userId;
  const winnerPlayer = record.room.players.find((p) => p.id === winner.playerId);
  const winnerUserId = winnerPlayer?.userId ?? null;

  if (hostUserId) {
    try {
      await prisma.game.create({
        data: {
          startedDt: record.gameStartedAt ?? new Date(),
          endedDt: new Date(),
          players: JSON.stringify(record.room.players.map((p) => p.name)),
          roomOwnerId: hostUserId,
          score: JSON.stringify(
            Object.fromEntries(record.room.players.map((p) => [p.name, p.score])),
          ),
          winnerId: winnerUserId,
        },
      });
    } catch {
    }
  }

  // обновляем статы каждому игроку
  for (const player of record.room.players) {
    if (!player.userId) continue;
    const stats: PlayerGameStats = record.playerStats.get(player.id) ?? { guessed: 0, skipped: 0 };
    const isWinner = player.id === winner.playerId;
    try {
      await prisma.userStats.upsert({
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
    } catch {
    }
  }
}
