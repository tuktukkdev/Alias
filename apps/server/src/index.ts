import "dotenv/config";
import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerCollectionsRoutes } from "./routes/collectionsRoutes";
import { registerFriendsRoutes } from "./routes/friendsRoutes";
import { registerRoomRoutes } from "./routes/roomRoutes";
import { registerSocketServer } from "./ws/socketServer";
import { initRedis } from "./db/redis";
import { preloadDefaultCollections } from "./services/cacheService";

// инициализация express сервера
const app = express();

// папка для загруженных файлов (аватарки и т.д.)
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// настройка cors и json парсера
app.use(express.json({ limit: "4mb" }));
app.use((_: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  next();
});

app.options(/.*/, (_: Request, res: Response) => {
  res.sendStatus(204);
});

// подключение маршрутов
registerAuthRoutes(app);
registerCollectionsRoutes(app);
registerFriendsRoutes(app);
registerRoomRoutes(app);

// запуск сервера на порту 3000, подключение redis и вебсокетов
const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
  void initRedis().then(() => preloadDefaultCollections());
});

registerSocketServer(server);
