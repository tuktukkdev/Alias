import { Express, Request, Response } from "express";
import { loginUser, registerUser } from "../services/authService";

export const registerAuthRoutes = (app: Express): void => {
  app.post("/auth/register", async (req: Request, res: Response) => {
    const username = String(req.body?.username ?? "").trim();
    const email = String(req.body?.email ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }

    if (username.length < 2 || username.length > 64) {
      return res.status(400).json({ error: "Username must be 2–64 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const result = await registerUser(username, email, password);

    if (!result.ok && result.code === "USERNAME_TAKEN") {
      return res.status(409).json({ error: "Username is already taken" });
    }

    if (!result.ok && result.code === "EMAIL_TAKEN") {
      return res.status(409).json({ error: "Email is already registered" });
    }

    if (!result.ok) {
      return res.status(500).json({ error: "Registration failed" });
    }

    return res.status(201).json({ id: result.id, username: result.username });
  });

  app.post("/auth/login", async (req: Request, res: Response) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const result = await loginUser(username, password);

    if (!result.ok) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    return res.status(200).json({ id: result.id, username: result.username });
  });
};
