// юнит-тесты для wordService
// тестируют: pickWordFromPool, loadWordPool
// prisma и cacheService заменяются моками

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    userCard: { findMany: jest.fn(), count: jest.fn() },
    card: { count: jest.fn() },
  },
}));

jest.mock('../../src/services/cacheService', () => ({
  getDefaultCollectionWordsCached: jest.fn(),
  getGeneralWordsCached: jest.fn(),
}));

import { pickWordFromPool, loadWordPool } from '../../src/services/wordService';
import { prisma } from '../../src/db/prisma';
import { getDefaultCollectionWordsCached, getGeneralWordsCached } from '../../src/services/cacheService';
import type { RoomRecord } from '../../src/types/game';

const mockUserCardFindMany = prisma.userCard.findMany as jest.Mock;
const mockGetDefaultWords = getDefaultCollectionWordsCached as jest.Mock;
const mockGetGeneralWords = getGeneralWordsCached as jest.Mock;

function makeRoomRecord(overrides: Partial<RoomRecord> = {}): RoomRecord {
  return {
    room: { players: [], hostId: 'host1', settings: { timer: 60, winScore: 10, difficulty: 1, selectedCollections: [] } },
    started: false, startRequested: false, startedAt: null,
    connectedPlayerIds: new Set(), chatMessages: [],
    turnSecondsRemaining: 0, currentTurnPlayerId: null, currentWord: null,
    waitingForWordResolutionAtZero: false, usedWords: new Set(),
    wordPool: [], playerStats: new Map(), gameStartedAt: null, winner: null,
    ...overrides,
  } as RoomRecord;
}

// ======================================================================
describe('wordService — pickWordFromPool', () => {
  it('возвращает неиспользованное слово', () => {
    const record = makeRoomRecord({ wordPool: ['кот', 'дом', 'лес'], usedWords: new Set(['кот']) });
    expect(['дом', 'лес']).toContain(pickWordFromPool(record));
  });

  it('сбрасывает usedWords когда все слова использованы', () => {
    const record = makeRoomRecord({ wordPool: ['кот', 'дом'], usedWords: new Set(['кот', 'дом']) });
    const word = pickWordFromPool(record);
    expect(['кот', 'дом']).toContain(word);
    expect(record.usedWords.size).toBe(0);
  });

  it('возвращает запасное слово при пустом пуле', () => {
    const record = makeRoomRecord({ wordPool: [], usedWords: new Set() });
    expect(pickWordFromPool(record)).toBe('слово');
  });
});

// ======================================================================
describe('wordService — loadWordPool', () => {
  it('загружает слова из кастомной коллекции (из БД)', async () => {
    const record = makeRoomRecord();
    record.room.settings.selectedCollections = [{ id: 10, type: 'custom' }];
    mockUserCardFindMany.mockResolvedValueOnce([{ word: 'яблоко' }, { word: 'банан' }]);
    await loadWordPool(record);
    expect(record.wordPool).toEqual(expect.arrayContaining(['яблоко', 'банан']));
  });

  it('загружает слова из дефолтной коллекции (из кэша)', async () => {
    const record = makeRoomRecord();
    record.room.settings.selectedCollections = [{ id: 5, type: 'default' }];
    mockGetDefaultWords.mockResolvedValueOnce(['машина', 'поезд']);
    await loadWordPool(record);
    expect(mockGetDefaultWords).toHaveBeenCalledWith(5);
    expect(record.wordPool).toEqual(expect.arrayContaining(['машина', 'поезд']));
  });

  it('использует фолбэк по сложности, если коллекции не выбраны', async () => {
    const record = makeRoomRecord();
    record.room.settings.difficulty = 2;
    mockGetGeneralWords.mockResolvedValueOnce(['стол', 'стул']);
    await loadWordPool(record);
    expect(mockGetGeneralWords).toHaveBeenCalledWith(2);
    expect(record.wordPool).toEqual(expect.arrayContaining(['стол', 'стул']));
  });
});
