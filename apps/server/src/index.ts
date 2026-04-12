import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerFriendsRoutes } from "./routes/friendsRoutes";
import { registerRoomRoutes } from "./routes/roomRoutes";
import { registerSocketServer } from "./ws/socketServer";

const app = express();

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

app.use(express.json({ limit: "4mb" }));
app.use((_: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  next();
});

app.options(/.*/, (_: Request, res: Response) => {
  res.sendStatus(204);
});

registerAuthRoutes(app);
registerFriendsRoutes(app);
registerRoomRoutes(app);

const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});

registerSocketServer(server);
