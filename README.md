# Alias Online

Многопользовательская онлайн-версия игры «Алиас»: игроки создают комнату, по очереди объясняют слова, остальные угадывают в чате. Работает в реальном времени через WebSocket.

**Демо:** [bluefieldapps.com](https://bluefieldapps.com)

## Возможности

- Регистрация с подтверждением email, вход, восстановление пароля по ссылке из письма.
- Игровые комнаты в реальном времени: таймер хода, счёт, пропуск слова, экран победителя.
- Голосовой чат между игроками.
- Готовые коллекции слов по уровням сложности и собственные коллекции.
- Друзья: заявки, принятие, удаление.
- Профиль: аватар, смена имени и пароля, статистика игр.

## Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Node.js, Express 5, WebSocket (ws), TypeScript |
| Данные | PostgreSQL + Prisma ORM, Redis (кэш коллекций) |
| Email | Resend |
| Инфраструктура | Docker Compose, nginx, CI/CD через GitHub Actions, VPS |
| Тестирование | Jest, Supertest, Postman / Newman, k6 |

## Документация

| Документ | Что внутри |
|---|---|
| [TEST_CASES.md](TEST_CASES.md) | Стратегия тестирования, ручные тест-кейсы TC_01–TC_05, итоги, дефекты, скриншоты прогонов |
| [apps/server/tests/TEST_REPORT.md](apps/server/tests/TEST_REPORT.md) | Полный отчёт о тестировании: unit, интеграционные, ручные, нагрузочные, API (Postman) |
| [REPORT.md](REPORT.md) | Курсовой проект в Markdown |
| [Alias_kursovoy_proekt.pdf](Alias_kursovoy_proekt.pdf) | Курсовой проект (PDF) |

## Тестирование

Подробный отчёт: [`apps/server/tests/TEST_REPORT.md`](apps/server/tests/TEST_REPORT.md), ручные тест-кейсы: [`TEST_CASES.md`](TEST_CASES.md)

| Вид | Инструмент | Объём | Результат |
|---|---|---|---|
| Unit-тесты | Jest | 19 тест-кейсов | все проходят |
| Интеграционные тесты API | Jest + Supertest | 7 тест-кейсов | все проходят |
| API-тесты | Postman / Newman | 24 запроса, 53 проверки | все проходят |
| Нагрузочное тестирование | k6 | 2 сценария, до 25 виртуальных пользователей | — |
| Ручное тестирование | тест-кейсы | 12 кейсов, включая XSS, SQL-инъекции, доступ без прав | — |

Найдено и исправлено 5 дефектов — описаны в разделе 8 отчёта.

```bash
cd apps/server
npm test                 # unit + интеграционные
npm run test:coverage    # с покрытием
newman run tests/postman/Alias.postman_collection.json
```

---

# Запуск проекта

**Требования:** Node.js 18+, PostgreSQL (порт 5432), Redis (порт 6379)

---

## Порядок запуска

1. Запустить PostgreSQL
2. Запустить Redis
3. `npm run dev` в папке `server`
4. `npm run dev` в папке `client`

---

## 1. PostgreSQL

Создать базу данных:

```sql
CREATE DATABASE alias;
```

Убедиться, что в `server/.env` указаны верные данные:

```
DATABASE_URL="postgresql://postgres:admin@localhost:5432/alias?schema=public"
```

---

## 2. Redis

**2.1.** Установить Redis (один раз):

```powershell
winget install Redis.Redis --accept-package-agreements --accept-source-agreements
```

**2.2.** После установки перезапустить терминал.

**2.3.** Запустить Redis-сервер:

```powershell
Start-Process -FilePath "C:\Program Files\Redis\redis-server.exe" -ArgumentList "--port 6379" -WindowStyle Hidden
```

**2.4.** Проверить соединение (ожидается ответ `PONG`):

```powershell
& "C:\Program Files\Redis\redis-cli.exe" ping
```

**2.5.** Необязательно — зарегистрировать Redis как службу Windows (запускается автоматически при включении ПК). Открыть PowerShell от имени Администратора:

```powershell
& "C:\Program Files\Redis\redis-server.exe" --service-install
Start-Service Redis
```

---

## 3. Server (`apps/server`)

```powershell
cd server
npm install                    # один раз
npx prisma migrate deploy      # один раз
npm run dev
```

Сервер будет доступен на `http://localhost:3000`.  
При старте автоматически подключается к Redis и прогревает кэш стандартных коллекций.

---

## 4. Client (`apps/client`)

```powershell
cd client
npm install    # один раз
npm run dev
```

Клиент будет доступен на `http://localhost:5173`.

---

## 5. Переменные окружения (`server/.env`)

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `REDIS_URL` | Строка подключения к Redis (`redis://localhost:6379`) |
| `RESEND_API_KEY` | API-ключ сервиса отправки email (Resend) |
| `EMAIL_FROM` | Адрес отправителя писем |
| `FRONTEND_URL` | URL фронтенда (`http://localhost:5173`) |
