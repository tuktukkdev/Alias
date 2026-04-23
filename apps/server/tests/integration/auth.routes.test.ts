// интеграционные тесты для /auth/* роутов
// supertest + jest-моки сервисов, база данных не нужна

jest.mock('../../src/services/authService', () => ({
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  updateUsername: jest.fn(),
  updatePassword: jest.fn(),
  getUserStats: jest.fn(),
  getUserAvatarUrl: jest.fn(),
  getUserEmail: jest.fn(),
  getUserEmailVerified: jest.fn(),
  getExistingPicturePath: jest.fn(),
  upsertUserPicture: jest.fn(),
  resendVerificationEmail: jest.fn(),
  verifyEmailToken: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPasswordViaToken: jest.fn(),
  createEmailVerificationToken: jest.fn().mockResolvedValue('fake-token'),
}));

jest.mock('../../src/services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/db/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userPicture: { findUnique: jest.fn(), upsert: jest.fn(), delete: jest.fn() },
  },
}));

import express from 'express';
import request from 'supertest';
import { registerAuthRoutes } from '../../src/routes/authRoutes';
import { registerUser, loginUser, getUserAvatarUrl, getUserStats, createEmailVerificationToken, getUserEmail } from '../../src/services/authService';

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));
  registerAuthRoutes(app);
  return app;
}

const app = createTestApp();
const mockRegisterUser = registerUser as jest.Mock;
const mockLoginUser = loginUser as jest.Mock;
const mockGetAvatarUrl = getUserAvatarUrl as jest.Mock;
const mockGetStats = getUserStats as jest.Mock;
const mockCreateToken = createEmailVerificationToken as jest.Mock;
const mockGetEmail = getUserEmail as jest.Mock;

// ======================================================================
describe('POST /auth/register', () => {
  it('400 — отсутствуют обязательные поля', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('400 — невалидный email', async () => {
    const res = await request(app).post('/auth/register').send({ username: 'alice', email: 'notanemail', password: 'pass123' });
    expect(res.status).toBe(400);
  });

  it('409 — username занят', async () => {
    mockRegisterUser.mockResolvedValueOnce({ ok: false, code: 'USERNAME_TAKEN' });
    const res = await request(app).post('/auth/register').send({ username: 'taken', email: 'free@example.com', password: 'pass123' });
    expect(res.status).toBe(409);
  });

  it('201 — успешная регистрация', async () => {
    mockRegisterUser.mockResolvedValueOnce({ ok: true, id: 42, username: 'alice', email: 'alice@example.com', emailVerified: false });
    mockCreateToken.mockResolvedValueOnce('token');
    mockGetEmail.mockResolvedValueOnce('alice@example.com');
    const res = await request(app).post('/auth/register').send({ username: 'alice', email: 'alice@example.com', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    expect(res.body.username).toBe('alice');
  });
});

// ======================================================================
describe('POST /auth/login', () => {
  it('401 — неверные credentials', async () => {
    mockLoginUser.mockResolvedValueOnce({ ok: false, code: 'USER_NOT_FOUND' });
    const res = await request(app).post('/auth/login').send({ username: 'ghost', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('200 — успешный вход с данными пользователя', async () => {
    mockLoginUser.mockResolvedValueOnce({ ok: true, id: 1, username: 'alice', email: 'alice@example.com', emailVerified: true });
    mockGetAvatarUrl.mockResolvedValueOnce(null);
    const res = await request(app).post('/auth/login').send({ username: 'alice', password: 'correctPass' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });
});

// ======================================================================
describe('GET /auth/stats/:userId', () => {
  it('200 — возвращает статистику игрока', async () => {
    mockGetStats.mockResolvedValueOnce({ guessed: 20, skipped: 3, wins: 5, losses: 2 });
    const res = await request(app).get('/auth/stats/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ guessed: 20, wins: 5 });
  });
});
