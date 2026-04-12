import { prisma } from "../db/prisma";
import type { SelectedCollection } from "../types/game";

/**
 * Pick a random word from the selected collections, falling back to the
 * general `cards` table filtered by difficulty when collections are empty
 * or exhausted.  Never returns a word already in `usedWords`.
 */
export async function pickWord(
  selectedCollections: SelectedCollection[],
  difficulty: number,
  usedWords: Set<string>,
): Promise<string> {
  const safeDifficulty = Math.max(1, Math.min(3, difficulty));

  // 1. Try selected collections
  if (selectedCollections.length > 0) {
    const word = await pickFromSelectedCollections(selectedCollections, usedWords);
    if (word) return word;
  }

  // 2. Fall back to general cards table filtered by difficulty
  const fallback = await pickFromCardsTable(safeDifficulty, usedWords);
  if (fallback) return fallback;

  // 3. Last resort – pick any card ignoring difficulty
  const any = await pickFromCardsTable(null, usedWords);
  if (any) return any;

  // 4. Absolute fallback
  return "слово";
}

async function pickFromSelectedCollections(
  collections: SelectedCollection[],
  usedWords: Set<string>,
): Promise<string | null> {
  const defaultIds = collections.filter((c) => c.type === "default").map((c) => c.id);
  const customIds = collections.filter((c) => c.type === "custom").map((c) => c.id);
  const excludedWords = [...usedWords];

  // Try custom collections first (user-created content takes priority)
  if (customIds.length > 0) {
    const word = await pickRandomUserCard(customIds, excludedWords);
    if (word) return word;
  }

  // Then default collections
  if (defaultIds.length > 0) {
    const word = await pickRandomDefaultCard(defaultIds, excludedWords);
    if (word) return word;
  }

  return null;
}

async function pickRandomUserCard(
  collectionIds: number[],
  excludedWords: string[],
): Promise<string | null> {
  const rows = await prisma.userCard.findMany({
    where: {
      userCollectionId: { in: collectionIds },
      ...(excludedWords.length > 0 ? { word: { notIn: excludedWords } } : {}),
    },
    select: { word: true },
  });

  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)].word;
}

async function pickRandomDefaultCard(
  collectionIds: number[],
  excludedWords: string[],
): Promise<string | null> {
  const rows = await prisma.card.findMany({
    where: {
      links: { some: { collectionId: { in: collectionIds } } },
      ...(excludedWords.length > 0 ? { word: { notIn: excludedWords } } : {}),
    },
    select: { word: true },
  });

  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)].word;
}

async function pickFromCardsTable(
  difficulty: number | null,
  usedWords: Set<string>,
): Promise<string | null> {
  const excludedWords = [...usedWords];
  const rows = await prisma.card.findMany({
    where: {
      ...(difficulty !== null ? { difficulty } : {}),
      ...(excludedWords.length > 0 ? { word: { notIn: excludedWords } } : {}),
    },
    select: { word: true },
  });

  if (rows.length === 0) return null;
  return rows[Math.floor(Math.random() * rows.length)].word;
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
