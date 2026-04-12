import { Express, Request, Response } from "express";
import {
  getCollections,
  createCollection,
  deleteCollection,
  getCollectionWords,
  saveCollectionWords,
} from "../services/collectionsService";
import { prisma } from "../db/prisma";

export function registerCollectionsRoutes(app: Express): void {
  /** GET /collections/:userId — list user's collections */
  app.get("/collections/:userId", async (req: Request, res: Response) => {
    const userId = parseInt(String(req.params.userId), 10);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const collections = await getCollections(userId);
    return res.json(collections);
  });

  /** POST /collections — create a collection */
  app.post("/collections", async (req: Request, res: Response) => {
    const { userId, name, description, difficulty } = req.body as {
      userId?: unknown;
      name?: unknown;
      description?: unknown;
      difficulty?: unknown;
    };
    const uid = parseInt(String(userId ?? ""), 10);
    if (isNaN(uid)) return res.status(400).json({ error: "userId is required" });
    if (typeof name !== "string" || name.trim().length === 0) {
      return res.status(400).json({ error: "name is required" });
    }
    if (name.trim().length > 128) return res.status(400).json({ error: "Name too long" });
    const diff =
      typeof difficulty === "number" ? Math.max(1, Math.min(3, Math.round(difficulty))) : 1;
    const desc =
      typeof description === "string" && description.trim().length > 0
        ? description.trim().slice(0, 500)
        : null;
    const collection = await createCollection(uid, name.trim(), desc, diff);
    return res.status(201).json(collection);
  });

  /** DELETE /collections/:collectionId — delete a collection */
  app.delete("/collections/:collectionId", async (req: Request, res: Response) => {
    const collectionId = parseInt(String(req.params.collectionId), 10);
    const userId = parseInt(String(req.body?.userId ?? ""), 10);
    if (isNaN(collectionId) || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid params" });
    }
    const result = await deleteCollection(userId, collectionId);
    if (!result.ok) {
      return res
        .status(result.code === "NOT_FOUND" ? 404 : 403)
        .json({ error: result.code });
    }
    return res.json({ ok: true });
  });

  /** GET /collections/:collectionId/words — get words for a collection */
  app.get("/collections/:collectionId/words", async (req: Request, res: Response) => {
    const collectionId = parseInt(String(req.params.collectionId), 10);
    const userId = parseInt(String(req.query.userId ?? ""), 10);
    if (isNaN(collectionId) || isNaN(userId)) {
      return res.status(400).json({ error: "Invalid params" });
    }
    const words = await getCollectionWords(collectionId, userId);
    if (words === null) return res.status(403).json({ error: "Forbidden" });
    return res.json(words);
  });

  /** PUT /collections/:collectionId/words — replace all words */
  app.put("/collections/:collectionId/words", async (req: Request, res: Response) => {
    const collectionId = parseInt(String(req.params.collectionId), 10);
    const { userId, words } = req.body as { userId?: unknown; words?: unknown };
    const uid = parseInt(String(userId ?? ""), 10);
    if (isNaN(collectionId) || isNaN(uid) || !Array.isArray(words)) {
      return res.status(400).json({ error: "Invalid params" });
    }
    const clean = words
      .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
      .map((w) => w.trim().slice(0, 128));
    const result = await saveCollectionWords(collectionId, uid, clean);
    if (result === null) return res.status(403).json({ error: "Forbidden" });
    return res.json(result);
  });

  /** GET /default-collections — list all default collections */
  app.get("/default-collections", async (_req: Request, res: Response) => {
    const collections = await prisma.defaultCollection.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        difficulty: true,
        amountOfCards: true,
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: { id: "asc" },
    });
    const result = collections.map((c) => ({
      ...c,
      tags: c.tags.map((t) => t.tag.name),
    }));
    return res.json(result);
  });
}
