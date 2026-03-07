export type WordDifficulty = "easy" | "medium" | "hard";

export interface WordModel {
  id: string;
  text: string;
  language_id: string;
  difficulty: WordDifficulty;
  tags: string[];
}

// Plain hardcoded word data that can be reused by client/server.
export const WORDS: WordModel[] = [
  {
    id: "w-001",
    text: "apple",
    language_id: "en",
    difficulty: "easy",
    tags: ["food", "noun"],
  },
  {
    id: "w-002",
    text: "mountain",
    language_id: "en",
    difficulty: "easy",
    tags: ["nature", "noun"],
  },
  {
    id: "w-003",
    text: "algorithm",
    language_id: "en",
    difficulty: "medium",
    tags: ["tech", "noun"],
  },
  {
    id: "w-004",
    text: "volcano",
    language_id: "en",
    difficulty: "medium",
    tags: ["nature", "science"],
  },
  {
    id: "w-005",
    text: "photosynthesis",
    language_id: "en",
    difficulty: "hard",
    tags: ["science", "biology"],
  },
  {
    id: "w-006",
    text: "architecture",
    language_id: "en",
    difficulty: "hard",
    tags: ["design", "noun"],
  },
];
