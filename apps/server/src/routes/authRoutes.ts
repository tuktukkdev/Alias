import { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  getExistingPicturePath,
  getUserAvatarUrl,
  getUserStats,
  loginUser,
  registerUser,
  updatePassword,
  updateUsername,
  upsertUserPicture,
} from "../services/authService";

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

    return res.status(201).json({ id: result.id, username: result.username, avatarUrl: null });
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

    const avatarUrl = await getUserAvatarUrl(result.id);
    return res.status(200).json({ id: result.id, username: result.username, avatarUrl });
  });

  app.patch("/auth/profile/username", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const newUsername = String(req.body?.username ?? "").trim();

    if (!userId || !newUsername) {
      return res.status(400).json({ error: "userId and username are required" });
    }

    if (newUsername.length < 2 || newUsername.length > 64) {
      return res.status(400).json({ error: "Username must be 2–64 characters" });
    }

    const result = await updateUsername(userId, newUsername);

    if (!result.ok && result.code === "USERNAME_TAKEN") {
      return res.status(409).json({ error: "Username is already taken" });
    }

    if (!result.ok) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ username: result.username });
  });

  app.patch("/auth/profile/password", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: "userId, currentPassword and newPassword are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }

    const result = await updatePassword(userId, currentPassword, newPassword);

    if (!result.ok && result.code === "INVALID_PASSWORD") {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    if (!result.ok) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ ok: true });
  });

  app.get("/auth/stats/:userId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const stats = await getUserStats(userId);
    if (!stats) {
      return res.status(404).json({ error: "Stats not found" });
    }

    return res.json(stats);
  });

  app.post("/auth/profile/picture", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const imageData = String(req.body?.imageData ?? "");

    if (!userId || !imageData) {
      return res.status(400).json({ error: "userId and imageData are required" });
    }

    const match = imageData.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/s);
    if (!match) {
      return res.status(400).json({ error: "Invalid image. Must be JPEG, PNG, GIF or WebP." });
    }

    const base64Data = match[3];
    // ~2MB limit (base64 is ~4/3 larger than binary)
    if (base64Data.length > 2_800_000) {
      return res.status(413).json({ error: "Image too large. Maximum size is 2 MB." });
    }

    const subtype = match[2]; // jpeg | png | gif | webp
    const ext = subtype === "jpeg" ? "jpg" : subtype;
    const filename = `user_${userId}.${ext}`;
    const avatarsDir = path.join(__dirname, "..", "..", "uploads", "avatars");
    fs.mkdirSync(avatarsDir, { recursive: true });

    // Remove old file if it has a different extension
    const oldPath = await getExistingPicturePath(userId);
    if (oldPath && oldPath !== filename) {
      const oldFilePath = path.join(avatarsDir, oldPath);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    fs.writeFileSync(path.join(avatarsDir, filename), Buffer.from(base64Data, "base64"));
    await upsertUserPicture(userId, filename, ext);

    const avatarUrl = `http://localhost:3000/uploads/avatars/${filename}`;
    return res.json({ avatarUrl });
  });
};
