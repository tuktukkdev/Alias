// нагрузочный тест — аутентификация
// инструмент: k6 (https://k6.io)
// тест проверяет эндпоинты /auth/register и /auth/login под нагрузкой
// запуск: k6 run apps/server/tests/load/auth-load.js
// этапы: 0–30с прогрев 10 VU, 30–90с стабильно, 90–120с пик 25 VU, 120–150с спад
// пороги: p95 < 500 мс, доля ошибок < 1%

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { fail } from 'k6';

// ---- кастомные метрики ------------------------------------------------
const registerErrors = new Counter('register_errors');
const loginErrors    = new Counter('login_errors');
const loginDuration  = new Trend('login_duration_ms', true);
const errorRate      = new Rate('error_rate');

// ---- конфигурация нагрузки --------------------------------------------
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
    // доля ошибок не более 1%
    error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// проверяем доступность сервера перед стартом теста
export function setup() {
  const res = http.get(`${BASE_URL}/`, { timeout: '5s' });
  if (res.status === 0) {
    fail(
      `сервер недоступен по адресу ${BASE_URL}\n` +
      `запустите сервер перед нагрузочным тестом\n` +
      `  cd apps/server && npm run dev`
    );
  }
}

// ---- сценарий виртуального пользователя --------------------------------
export default function () {
  // уникальные данные для каждой итерации (чтобы избежать конфликтов username)
  // username ≤ 15 символов, только [a-zA-Z0-9._/]
  const suffix   = Math.random().toString(36).slice(2, 11); // 9 символов base36
  const username = `ld_${suffix}`;           // 3 + 9 = 12 символов ≤ 15 ✓
  const email    = `ld.${suffix}@load.io`;
  const password = 'LoadPass1';

  // --- 1. регистрация ---
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

  // --- 2. вход (используем только что созданного пользователя) ---
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
