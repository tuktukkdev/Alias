import express, { Request, Response } from "express";
import { registerAuthRoutes } from "./routes/authRoutes";
import { registerRoomRoutes } from "./routes/roomRoutes";
import { registerSocketServer } from "./ws/socketServer";

const app = express();

app.use(express.json());
app.use((_: Request, res: Response, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  next();
});

app.options(/.*/, (_: Request, res: Response) => {
  res.sendStatus(204);
});

registerAuthRoutes(app);
registerRoomRoutes(app);

const server = app.listen(3000, () => {
  console.log("Server running on port 3000");
});

registerSocketServer(server);
