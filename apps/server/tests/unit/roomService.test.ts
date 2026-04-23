// юнит-тесты для roomService
// тестируют: getNextTurnPlayerId, buildRoomStatePayload, allPlayersConnected

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    userStats: { updateMany: jest.fn() },
    game: { create: jest.fn() },
  },
}));

jest.mock('../../src/services/wordService', () => ({
  loadWordPool: jest.fn(),
  pickWordFromPool: jest.fn().mockReturnValue('тест'),
}));

import {
  getNextTurnPlayerId,
  buildRoomStatePayload,
  allPlayersConnected,
} from '../../src/services/roomService';
import type { RoomRecord, Player } from '../../src/types/game';

function makePlayer(id: string, score = 0): Player {
  return { id, name: `Player_${id}`, score };
}

function makeRoomRecord(players: Player[], overrides: Partial<RoomRecord> = {}): RoomRecord {
  return {
    room: { players, hostId: players[0]?.id ?? 'host', settings: { timer: 60, winScore: 10, difficulty: 1, selectedCollections: [] } },
    started: false, startRequested: false, startedAt: null,
    connectedPlayerIds: new Set(), chatMessages: [],
    turnSecondsRemaining: null, currentTurnPlayerId: null, currentWord: null,
    waitingForWordResolutionAtZero: false, usedWords: new Set(),
    wordPool: [], playerStats: new Map(), gameStartedAt: null, winner: null,
    ...overrides,
  } as RoomRecord;
}

// ======================================================================
describe('roomService — getNextTurnPlayerId', () => {
  it('возвращает следующего игрока по кругу', () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const record = makeRoomRecord(players, { currentTurnPlayerId: 'p1' });
    expect(getNextTurnPlayerId(record)).toBe('p2');
  });

  it('переходит к первому игроку после последнего', () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const record = makeRoomRecord(players, { currentTurnPlayerId: 'p3' });
    expect(getNextTurnPlayerId(record)).toBe('p1');
  });

  it('возвращает null при пустом списке игроков', () => {
    expect(getNextTurnPlayerId(makeRoomRecord([]))).toBeNull();
  });
});

// ======================================================================
describe('roomService — buildRoomStatePayload', () => {
  it('возвращает корректную структуру и сериализует connectedPlayerIds в Array', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const record = makeRoomRecord(players, { started: true, currentTurnPlayerId: 'p1', turnSecondsRemaining: 45 });
    record.connectedPlayerIds = new Set(['p1']);

    const payload = buildRoomStatePayload('room-123', record);

    expect(payload.roomId).toBe('room-123');
    expect(payload.started).toBe(true);
    expect(payload.currentTurnPlayerId).toBe('p1');
    expect(Array.isArray(payload.connectedPlayerIds)).toBe(true);
    expect(payload.connectedPlayerIds).toContain('p1');
    expect(payload.connectedPlayerIds).not.toContain('p2');
  });
});

// ======================================================================
describe('roomService — allPlayersConnected', () => {
  it('возвращает true если все игроки онлайн', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const record = makeRoomRecord(players);
    record.connectedPlayerIds = new Set(['p1', 'p2']);
    expect(allPlayersConnected(record)).toBe(true);
  });

  it('возвращает false если хотя бы один игрок офлайн', () => {
    const players = [makePlayer('p1'), makePlayer('p2')];
    const record = makeRoomRecord(players);
    record.connectedPlayerIds = new Set(['p1']);
    expect(allPlayersConnected(record)).toBe(false);
  });
});
