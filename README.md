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
