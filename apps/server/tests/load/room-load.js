// нагрузочный тест — игровые комнаты
// инструмент: k6 (https://k6.io)
// тест проверяет эндпоинты создания комнат, подключения, состояния и чата под нагрузкой
// запуск: k6 run apps/server/tests/load/room-load.js
// этапы: 0–20с прогрев 5 VU, 20–80с стабильно 20 VU, 80–100с спад
// пороги: p95 < 400 мс, доля ошибок < 2%

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { fail } from 'k6';

// ---- кастомные метрики ------------------------------------------------
const roomCreateErrors = new Counter('room_create_errors');
const roomJoinErrors   = new Counter('room_join_errors');
const errorRate        = new Rate('error_rate');
const stateLatency     = new Trend('room_state_latency_ms', true);

// ---- конфигурация нагрузки --------------------------------------------
export const options = {
  stages: [
    { duration: '20s', target: 5  },  // прогрев
    { duration: '60s', target: 20 },  // стабильная нагрузка
    { duration: '20s', target: 0  },  // спад
  ],
  thresholds: {
    http_req_duration: ['p(95)<400'],
    error_rate:        ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

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
  const uid  = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const name = `LoadPlayer_${uid}`;

  // --- 1. создание комнаты ---
  const createRes = http.post(
    `${BASE_URL}/rooms`,
    JSON.stringify({ name }),   // поле называется "name", не "playerName"
    JSON_HEADERS,
  );

  const createOk = check(createRes, {
    'создание комнаты: статус 201':   (r) => r.status === 201,
    'создание комнаты: есть roomId':  (r) => {
      try { return typeof JSON.parse(r.body).roomId === 'string'; } catch { return false; }
    },
    'создание комнаты: есть playerId': (r) => {
      try { return typeof JSON.parse(r.body).playerId === 'string'; } catch { return false; }
    },
  });

  if (!createOk) {
    roomCreateErrors.add(1);
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  let roomId, playerId;
  try {
    const body = JSON.parse(createRes.body);
    roomId   = body.roomId;
    playerId = body.playerId;
  } catch {
    roomCreateErrors.add(1);
    errorRate.add(1);
    return;
  }

  sleep(0.3);

  // --- 2. получение состояния комнаты ---
  const stateStart = Date.now();
  const stateRes   = http.get(`${BASE_URL}/rooms/${roomId}`);
  stateLatency.add(Date.now() - stateStart);

  check(stateRes, {
    'состояние комнаты: статус 200':   (r) => r.status === 200,
    'состояние комнаты: есть players': (r) => {
      try { return Array.isArray(JSON.parse(r.body).room?.players); } catch { return false; }
    },
  });

  sleep(0.3);

  // --- 3. второй игрок подключается к комнате ---
  const joinName = `Guest_${uid}`;
  const joinRes  = http.post(
    `${BASE_URL}/rooms/${roomId}/join`,
    JSON.stringify({ name: joinName }),   // поле называется "name"
    JSON_HEADERS,
  );

  const joinOk = check(joinRes, {
    'подключение к комнате: статус 200 или 201': (r) => r.status === 200 || r.status === 201,
    'подключение к комнате: есть playerId':      (r) => {
      try { return typeof JSON.parse(r.body).playerId === 'string'; } catch { return false; }
    },
  });

  if (!joinOk) {
    roomJoinErrors.add(1);
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.3);

  // --- 4. получение истории чата ---
  const chatHistoryRes = http.get(`${BASE_URL}/rooms/${roomId}/chat`);
  check(chatHistoryRes, {
    'история чата: статус 200':      (r) => r.status === 200,
    'история чата: есть messages':   (r) => {
      try { return Array.isArray(JSON.parse(r.body).messages); } catch { return false; }
    },
  });

  sleep(0.3);

  // --- 5. выход из комнаты ---
  http.del(`${BASE_URL}/rooms/${roomId}/players/${playerId}`);

  sleep(0.2);
}
