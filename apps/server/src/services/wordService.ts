// сервис для работы со словами — загрузка пула и выбор слов
import { prisma } from "../db/prisma";
import { getDefaultCollectionWordsCached, getGeneralWordsCached } from "./cacheService";
import type { RoomRecord, SelectedCollection } from "../types/game";

// загружаем пул слов для комнаты (кастомные из бд, дефолтные из кеша)
export async function loadWordPool(record: RoomRecord): Promise<void> {
  const { selectedCollections, difficulty } = record.room.settings;
  const safeDifficulty = Math.max(1, Math.min(3, difficulty));
  const words = new Set<string>();

  const customIds = selectedCollections.filter((c) => c.type === "custom").map((c) => c.id);
  const defaultIds = selectedCollections.filter((c) => c.type === "default").map((c) => c.id);

  // кастомные коллекции — всегда из базы
  if (customIds.length > 0) {
    const rows = await prisma.userCard.findMany({
      where: { userCollectionId: { in: customIds } },
      select: { word: true },
    });
    rows.forEach((r) => words.add(r.word));
  }

  // дефолтные коллекции — из redis кеша
  for (const id of defaultIds) {
    const colWords = await getDefaultCollectionWordsCached(id);
    colWords.forEach((w) => words.add(w));
  }

  // фолбэк: ничего не выбрано — берём общие карточки по сложности
  if (words.size === 0) {
    const byDiff = await getGeneralWordsCached(safeDifficulty);
    byDiff.forEach((w) => words.add(w));
  }

  // последний вариант: вообще все карточки
  if (words.size === 0) {
    const all = await getGeneralWordsCached(null);
    all.forEach((w) => words.add(w));
  }

  record.wordPool = [...words];
}

// выбираем случайное слово из пула (неиспользованное)
export function pickWordFromPool(record: RoomRecord): string {
  const pool = record.wordPool;
  if (pool && pool.length > 0) {
    const available = pool.filter((w) => !record.usedWords.has(w));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // слова кончились — сбрасываем и идём по новой
    record.usedWords.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return "слово";
}

// считаем общее кол-во слов в выбранных коллекциях
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
