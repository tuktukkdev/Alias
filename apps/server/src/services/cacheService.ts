// сервис кеширования — загружаем слова в redis чтобы не дёргать базу
import { prisma } from "../db/prisma";
import { getRedisClient } from "../db/redis";

const COL_DEFAULT_KEY = (id: number) => `col:default:${id}`;
const COL_GENERAL_KEY = (difficulty: number | null) =>
  difficulty !== null ? `col:general:${difficulty}` : "col:general:all";

// предзагрузка дефолтных коллекций в redis при старте сервера
export async function preloadDefaultCollections(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn("[Cache] Redis unavailable – default collections will not be preloaded");
    return;
  }

  const collections = await prisma.defaultCollection.findMany({ select: { id: true } });

  // проходим по коллекциям и кладём слова в кеш
  for (const col of collections) {
    const rows = await prisma.card.findMany({
      where: { links: { some: { collectionId: col.id } } },
      select: { word: true },
    });
    await redis.set(COL_DEFAULT_KEY(col.id), JSON.stringify(rows.map((r) => r.word)));
  }

  // кешируем слова по сложностям 1, 2, 3
  for (const diff of [1, 2, 3] as const) {
    const rows = await prisma.card.findMany({
      where: { difficulty: diff },
      select: { word: true },
    });
    await redis.set(COL_GENERAL_KEY(diff), JSON.stringify(rows.map((r) => r.word)));
  }

  const allRows = await prisma.card.findMany({ select: { word: true } });
  await redis.set(COL_GENERAL_KEY(null), JSON.stringify(allRows.map((r) => r.word)));

  console.log(`[Cache] Preloaded ${collections.length} default collections into Redis`);
}

// берём слова коллекции из кеша, если нет — из базы
export async function getDefaultCollectionWordsCached(collectionId: number): Promise<string[]> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(COL_DEFAULT_KEY(collectionId));
      if (cached) return JSON.parse(cached) as string[];
    } catch (err) {
      console.error("[Cache] Redis read error:", err);
    }
  }

  const rows = await prisma.card.findMany({
    where: { links: { some: { collectionId } } },
    select: { word: true },
  });
  return rows.map((r) => r.word);
}

// берём общие слова по сложности из кеша или базы
export async function getGeneralWordsCached(difficulty: number | null): Promise<string[]> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(COL_GENERAL_KEY(difficulty));
      if (cached) return JSON.parse(cached) as string[];
    } catch (err) {
      console.error("[Cache] Redis read error:", err);
    }
  }

  const rows = await prisma.card.findMany({
    where: difficulty !== null ? { difficulty } : {},
    select: { word: true },
  });
  return rows.map((r) => r.word);
}
