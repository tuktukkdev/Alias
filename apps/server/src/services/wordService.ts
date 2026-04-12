import { prisma } from "../db/prisma";
import { getDefaultCollectionWordsCached, getGeneralWordsCached } from "./cacheService";
import type { RoomRecord, SelectedCollection } from "../types/game";

/**
 * Build the full word pool for a room at game-start time.
 * - Custom collection words are loaded directly from the DB.
 * - Default collection words are served from the Redis cache (DB fallback).
 * - If no collections are selected, the general cards pool is used instead.
 * The result is stored on the record so that all subsequent word picks
 * are pure in-memory operations with zero DB/Redis round-trips.
 */
export async function loadWordPool(record: RoomRecord): Promise<void> {
  const { selectedCollections, difficulty } = record.room.settings;
  const safeDifficulty = Math.max(1, Math.min(3, difficulty));
  const words = new Set<string>();

  const customIds = selectedCollections.filter((c) => c.type === "custom").map((c) => c.id);
  const defaultIds = selectedCollections.filter((c) => c.type === "default").map((c) => c.id);

  // Custom collections – always fresh from DB (user-owned data)
  if (customIds.length > 0) {
    const rows = await prisma.userCard.findMany({
      where: { userCollectionId: { in: customIds } },
      select: { word: true },
    });
    rows.forEach((r) => words.add(r.word));
  }

  // Default collections – served from Redis cache
  for (const id of defaultIds) {
    const colWords = await getDefaultCollectionWordsCached(id);
    colWords.forEach((w) => words.add(w));
  }

  // Fallback: no collections chosen – use general cards by difficulty
  if (words.size === 0) {
    const byDiff = await getGeneralWordsCached(safeDifficulty);
    byDiff.forEach((w) => words.add(w));
  }

  // Last resort: all cards
  if (words.size === 0) {
    const all = await getGeneralWordsCached(null);
    all.forEach((w) => words.add(w));
  }

  record.wordPool = [...words];
}

/**
 * Pick a random word from the pre-loaded in-memory pool, excluding already
 * used words.  When the pool is exhausted the used-word set is reset so the
 * game can continue seamlessly.
 */
export function pickWordFromPool(record: RoomRecord): string {
  const pool = record.wordPool;
  if (pool && pool.length > 0) {
    const available = pool.filter((w) => !record.usedWords.has(w));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // All words exhausted – recycle the pool
    record.usedWords.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return "слово";
}

/**
 * Count total words available across selected collections.
 */
export async function countCollectionWords(
  collections: SelectedCollection[],
): Promise<number> {
  const defaultIds = collections.filter((c) => c.type === "default").map((c) => c.id);
  const customIds = collections.filter((c) => c.type === "custom").map((c) => c.id);

  let total = 0;

  if (customIds.length > 0) {
    total += await prisma.userCard.count({
      where: { userCollectionId: { in: customIds } },
    });
  }

  if (defaultIds.length > 0) {
    total += await prisma.card.count({
      where: { links: { some: { collectionId: { in: defaultIds } } } },
    });
  }

  return total;
}
