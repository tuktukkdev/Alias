/**
 * Нагрузочный тест — аутентификация
 * Инструмент: k6 (https://k6.io)
 *
 * Тест проверяет эндпоинты /auth/register и /auth/login под нагрузкой.
 *
 * Запуск:
 *   k6 run apps/server/tests/load/auth-load.js
 *   k6 run --out json=results/auth-load.json apps/server/tests/load/auth-load.js
 *
 * Этапы нагрузки:
 *   0–30 с  : плавный разгон до 10 VU
 *   30–90 с : стабильная нагрузка 10 VU
 *   90–120 с: пиковая нагрузка 25 VU
 *   120–150 с: спад до 0
 *
 * Пороговые значения (thresholds):
 *   - 95-й перцентиль времени ответа < 500 мс
 *   - Доля ошибок < 1 %
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { fail } from 'k6';

// ---- Кастомные метрики ------------------------------------------------
const registerErrors = new Counter('register_errors');
const loginErrors    = new Counter('login_errors');
const loginDuration  = new Trend('login_duration_ms', true);
const errorRate      = new Rate('error_rate');

// ---- Конфигурация нагрузки --------------------------------------------
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // прогрев
    { duration: '60s', target: 10 },  // стабильная нагрузка
    { duration: '30s', target: 25 },  // пиковая нагрузка
    { duration: '30s', target: 0  },  // спад
  ],
  thresholds: {
    // 95% запросов должны отвечать быстрее 500 мс
    http_req_duration: ['p(95)<500'],
    // Доля ошибок не более 1%
    error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Проверяем доступность сервера перед стартом теста
export function setup() {
  const res = http.get(`${BASE_URL}/`, { timeout: '5s' });
  if (res.status === 0) {
    fail(
      `Сервер недоступен по адресу ${BASE_URL}.\n` +
      `Запустите сервер перед нагрузочным тестом:\n` +
      `  cd apps/server && npm run dev`
    );
  }
}

// ---- Сценарий виртуального пользователя --------------------------------
export default function () {
  // Уникальные данные для каждой итерации (чтобы избежать конфликтов username)
  // username ≤ 15 символов, только [a-zA-Z0-9._/]
  const suffix   = Math.random().toString(36).slice(2, 11); // 9 символов base36
  const username = `ld_${suffix}`;           // 3 + 9 = 12 символов ≤ 15 ✓
  const email    = `ld.${suffix}@load.io`;
  const password = 'LoadPass1';

  // --- 1. Регистрация ---
  const regPayload = JSON.stringify({ username, email, password });
  const regParams  = { headers: { 'Content-Type': 'application/json' } };

  const regRes = http.post(`${BASE_URL}/auth/register`, regPayload, regParams);

  const regOk = check(regRes, {
    'регистрация: статус 201':  (r) => r.status === 201,
    'регистрация: есть id':     (r) => {
      try { return JSON.parse(r.body).id > 0; } catch { return false; }
    },
  });

  if (!regOk) {
    registerErrors.add(1);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.5);

  // --- 2. Вход (используем только что созданного пользователя) ---
  const loginPayload = JSON.stringify({ username, password });
  const loginStart   = Date.now();
  const loginRes     = http.post(`${BASE_URL}/auth/login`, loginPayload, regParams);
  loginDuration.add(Date.now() - loginStart);

  const loginOk = check(loginRes, {
    'вход: статус 200':          (r) => r.status === 200,
    'вход: содержит username':   (r) => {
      try { return JSON.parse(r.body).username === username; } catch { return false; }
    },
  });

  if (!loginOk) {
    loginErrors.add(1);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(1);
}
