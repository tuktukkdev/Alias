/**
 * Юнит-тесты для authService
 * Тестируют: registerUser, loginUser, updatePassword, getUserStats
 * Prisma-клиент подменяется моком — база данных не нужна.
 */

import { promisify } from 'util';
import { randomBytes, scrypt } from 'crypto';

// ---- Мок prisma -------------------------------------------------------
jest.mock('../../src/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userStats: {
      findUnique: jest.fn(),
    },
    userPicture: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    emailToken: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import {
  registerUser,
  loginUser,
  updatePassword,
  getUserStats,
} from '../../src/services/authService';
import { prisma } from '../../src/db/prisma';

const mockUserFind = prisma.user.findUnique as jest.Mock;
const mockUserCreate = prisma.user.create as jest.Mock;
const mockUserUpdate = prisma.user.update as jest.Mock;
const mockStatsFind = prisma.userStats.findUnique as jest.Mock;

const scryptAsync = promisify(scrypt);
async function makePasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

function makeUserRecord(overrides: Partial<{
  id: number; username: string; email: string; password: string; emailVerified: boolean;
}> = {}) {
  return { id: 1, username: 'alice', email: 'alice@example.com', password: 'hash', emailVerified: false, createdAt: new Date(), ...overrides };
}

// ======================================================================
describe('authService — registerUser', () => {
  it('USERNAME_TAKEN если username уже занят', async () => {
    mockUserFind.mockResolvedValueOnce(makeUserRecord());
    const result = await registerUser('alice', 'new@example.com', 'pass123');
    expect(result).toEqual({ ok: false, code: 'USERNAME_TAKEN' });
  });

  it('ok: true при успешной регистрации', async () => {
    mockUserFind.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue(makeUserRecord({ id: 5, username: 'bob', email: 'bob@example.com' }));
    const result = await registerUser('bob', 'bob@example.com', 'securePass1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.username).toBe('bob');
  });
});

// ======================================================================
describe('authService — loginUser', () => {
  it('USER_NOT_FOUND если пользователь не существует', async () => {
    mockUserFind.mockResolvedValueOnce(null);
    const result = await loginUser('ghost', 'anyPass');
    expect(result).toEqual({ ok: false, code: 'USER_NOT_FOUND' });
  });

  it('INVALID_PASSWORD при неверном пароле', async () => {
    const hash = await makePasswordHash('correctPassword');
    mockUserFind.mockResolvedValueOnce(makeUserRecord({ password: hash }));
    const result = await loginUser('alice', 'wrongPassword');
    expect(result).toEqual({ ok: false, code: 'INVALID_PASSWORD' });
  });

  it('ok: true при правильном пароле', async () => {
    const password = 'validPass123';
    const hash = await makePasswordHash(password);
    mockUserFind.mockResolvedValueOnce(makeUserRecord({ password: hash, emailVerified: true }));
    const result = await loginUser('alice', password);
    expect(result.ok).toBe(true);
  });
});

// ======================================================================
describe('authService — updatePassword', () => {
  it('обновляет пароль при правильном текущем пароле', async () => {
    const currentPassword = 'current123';
    const hash = await makePasswordHash(currentPassword);
    mockUserFind.mockResolvedValueOnce(makeUserRecord({ password: hash }));
    mockUserUpdate.mockResolvedValueOnce(makeUserRecord());
    const result = await updatePassword(1, currentPassword, 'newSecurePass456');
    expect(result).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
  });

  it('INVALID_PASSWORD при неверном текущем пароле', async () => {
    const hash = await makePasswordHash('realPassword');
    mockUserFind.mockResolvedValueOnce(makeUserRecord({ password: hash }));
    const result = await updatePassword(1, 'wrongCurrent', 'newPass123');
    expect(result).toEqual({ ok: false, code: 'INVALID_PASSWORD' });
  });
});

// ======================================================================
describe('authService — getUserStats', () => {
  it('возвращает статистику пользователя', async () => {
    mockStatsFind.mockResolvedValueOnce({ userId: 1, guessed: 42, skipped: 5, wins: 10, losses: 3 });
    const result = await getUserStats(1);
    expect(result).toEqual({ guessed: 42, skipped: 5, wins: 10, losses: 3 });
  });
});
