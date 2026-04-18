// сервис для работы с пользовательскими коллекциями слов
import { prisma } from "../db/prisma";

export interface CollectionEntry {
  id: number;
  name: string;
  description: string | null;
  difficulty: number;
  amountOfCards: number;
}

export interface WordEntry {
  id: number;
  word: string;
}

// получаем все коллекции пользователя
export async function getCollections(userId: number): Promise<CollectionEntry[]> {
  return prisma.userCollection.findMany({
    where: { creatorId: userId },
    select: { id: true, name: true, description: true, difficulty: true, amountOfCards: true },
    orderBy: { id: "asc" },
  });
}

// создаём новую коллекцию
export async function createCollection(
  userId: number,
  name: string,
  description: string | null,
  difficulty: number
): Promise<CollectionEntry> {
  return prisma.userCollection.create({
    data: { name, description, difficulty, amountOfCards: 0, creatorId: userId },
    select: { id: true, name: true, description: true, difficulty: true, amountOfCards: true },
  });
}

// удаляем коллекцию (только свою)
export async function deleteCollection(
  userId: number,
  collectionId: number
): Promise<{ ok: true } | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" }> {
  const col = await prisma.userCollection.findUnique({
    where: { id: collectionId },
    select: { creatorId: true },
  });
  if (!col) return { ok: false, code: "NOT_FOUND" };
  if (col.creatorId !== userId) return { ok: false, code: "FORBIDDEN" };
  await prisma.userCollection.delete({ where: { id: collectionId } });
  return { ok: true };
}

// получаем слова из коллекции
export async function getCollectionWords(
  collectionId: number,
  userId: number
): Promise<WordEntry[] | null> {
  const col = await prisma.userCollection.findUnique({
    where: { id: collectionId },
    select: { creatorId: true },
  });
  if (!col || col.creatorId !== userId) return null;
  return prisma.userCard.findMany({
    where: { userCollectionId: collectionId },
    select: { id: true, word: true },
    orderBy: { id: "asc" },
  });
}

// сохраняем слова в коллекцию (транзакция: удаляем старые, добавляем новые)
export async function saveCollectionWords(
  collectionId: number,
  userId: number,
  words: string[]
): Promise<{ count: number } | null> {
  const col = await prisma.userCollection.findUnique({
    where: { id: collectionId },
    select: { creatorId: true, difficulty: true },
  });
  if (!col || col.creatorId !== userId) return null;

  await prisma.$transaction(async (tx) => {
    await tx.userCard.deleteMany({ where: { userCollectionId: collectionId } });
    if (words.length > 0) {
      await tx.userCard.createMany({
        data: words.map((word) => ({
          word,
          difficulty: col.difficulty,
          userCollectionId: collectionId,
        })),
      });
    }
    await tx.userCollection.update({
      where: { id: collectionId },
      data: { amountOfCards: words.length },
    });
  });

  return { count: words.length };
}
