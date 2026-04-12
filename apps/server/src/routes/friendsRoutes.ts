import { Express, Request, Response } from "express";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getFriendsData,
  getPendingCount,
  removeFriend,
  sendFriendRequest,
} from "../services/friendsService";

export const registerFriendsRoutes = (app: Express): void => {
  /** GET /friends/:userId — full friends/pending/sent lists */
  app.get("/friends/:userId", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const data = await getFriendsData(userId);
    return res.json(data);
  });

  /** GET /friends/:userId/pending-count — just the pending count */
  app.get("/friends/:userId/pending-count", async (req: Request, res: Response) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const count = await getPendingCount(userId);
    return res.json({ count });
  });

  /** POST /friends/request — send a friend request by target username */
  app.post("/friends/request", async (req: Request, res: Response) => {
    const fromId = Number(req.body?.userId);
    const toUsername = String(req.body?.username ?? "").trim();

    if (!fromId || !toUsername) {
      return res.status(400).json({ error: "userId and username are required" });
    }

    const result = await sendFriendRequest(fromId, toUsername);

    if (!result.ok) {
      if (result.code === "USER_NOT_FOUND") {
        return res.status(404).json({ error: "User not found" });
      }
      if (result.code === "SELF") {
        return res.status(400).json({ error: "Cannot send request to yourself" });
      }
      if (result.code === "ALREADY_FRIENDS") {
        return res.status(409).json({ error: "Already friends" });
      }
      if (result.code === "REQUEST_EXISTS") {
        return res.status(409).json({ error: "Friend request already sent" });
      }
    }

    return res.status(201).json({ ok: true });
  });

  /** POST /friends/accept — accept a pending request */
  app.post("/friends/accept", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const fromId = Number(req.body?.fromId);

    if (!userId || !fromId) {
      return res.status(400).json({ error: "userId and fromId are required" });
    }

    const result = await acceptFriendRequest(userId, fromId);
    if (!result.ok) return res.status(404).json({ error: "Request not found" });
    return res.json({ ok: true });
  });

  /** POST /friends/decline — decline a pending request */
  app.post("/friends/decline", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const fromId = Number(req.body?.fromId);

    if (!userId || !fromId) {
      return res.status(400).json({ error: "userId and fromId are required" });
    }

    const result = await declineFriendRequest(userId, fromId);
    if (!result.ok) return res.status(404).json({ error: "Request not found" });
    return res.json({ ok: true });
  });

  /** POST /friends/cancel — cancel a sent request */
  app.post("/friends/cancel", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const toId = Number(req.body?.toId);

    if (!userId || !toId) {
      return res.status(400).json({ error: "userId and toId are required" });
    }

    const result = await cancelFriendRequest(userId, toId);
    if (!result.ok) return res.status(404).json({ error: "Request not found" });
    return res.json({ ok: true });
  });

  /** DELETE /friends/remove — remove a friend */
  app.delete("/friends/remove", async (req: Request, res: Response) => {
    const userId = Number(req.body?.userId);
    const friendId = Number(req.body?.friendId);

    if (!userId || !friendId) {
      return res.status(400).json({ error: "userId and friendId are required" });
    }

    const result = await removeFriend(userId, friendId);
    if (!result.ok) return res.status(404).json({ error: "Not friends" });
    return res.json({ ok: true });
  });
};
