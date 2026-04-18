import type {
  Card,
  CardsCollection,
  CollectionTag,
  DefaultCollection,
  Game,
  Tag,
  UserCard,
  UserCollection,
  UserFriend,
  UserFriendRequest,
  UserPicture,
  UserPublic,
  UserStats,
} from "./domain";

// константы для валидации полей
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_MAX_LENGTH = 256;
const NAME_MAX_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 1000;
const WORD_MAX_LENGTH = 120;
const PATH_MAX_LENGTH = 512;
const FORMAT_MAX_LENGTH = 24;
const GAME_TEXT_MAX_LENGTH = 4000;
const MAX_DIFFICULTY = 10;

// регулярки для проверки email и безопасного текста
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_TEXT_RE = /^[\p{L}\p{N} _.,!?@#:/+\-()'\"]+ $/u;

type UnknownRecord = Record<string, unknown>;

// дто для регистрации
export interface SignupRequestDto {
  username: string;
  email: string;
  password: string;
}

// проверяем что значение это объект
const ensureRecord = (value: unknown, label: string): UnknownRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as UnknownRecord;
};

// убираем лишние пробелы из текста
const sanitizeText = (value: string): string => value.trim().replace(/\s+/g, " ");

// валидация строки с проверкой длины и безопасных символов
const requireString = (
  source: UnknownRecord,
  field: string,
  minLen: number,
  maxLen: number,
  safe: boolean,
): string => {
  const raw = source[field];

  if (typeof raw !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const value = sanitizeText(raw);
  if (value.length < minLen || value.length > maxLen) {
    throw new Error(`${field} must contain ${minLen}-${maxLen} characters`);
  }

  if (safe && !SAFE_TEXT_RE.test(value)) {
    throw new Error(`${field} contains unsupported characters`);
  }

  return value;
};

// проверка что число положительное целое
const requirePositiveInt = (source: UnknownRecord, field: string): number => {
  const raw = source[field];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return raw;
};

// проверка что число неотрицательное целое
const requireNonNegativeInt = (source: UnknownRecord, field: string): number => {
  const raw = source[field];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return raw;
};

// проверка сложности (0-10)
const requireDifficulty = (source: UnknownRecord, field: string): number => {
  const value = requireNonNegativeInt(source, field);
  if (value > MAX_DIFFICULTY) {
    throw new Error(`${field} cannot be greater than ${MAX_DIFFICULTY}`);
  }

  return value;
};

// проверка iso даты
const requireIsoDateString = (source: UnknownRecord, field: string): string => {
  const value = requireString(source, field, 1, 64, false);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date string`);
  }

  return value;
};

// опциональная iso дата или null
const optionalIsoDateOrNull = (source: UnknownRecord, field: string): string | null => {
  const raw = source[field];
  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
    throw new Error(`${field} must be an ISO date string or null`);
  }

  return raw;
};

// опциональное положительное число или null
const optionalPositiveIntOrNull = (source: UnknownRecord, field: string): number | null => {
  const raw = source[field];

  if (raw === null || raw === undefined) {
    return null;
  }

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(`${field} must be a positive integer or null`);
  }

  return raw;
};

// парсинг данных регистрации
export const parseSignupRequestDto = (payload: unknown): SignupRequestDto => {
  const source = ensureRecord(payload, "signupRequest");
  const email = requireString(source, "email", 5, EMAIL_MAX_LENGTH, false).toLowerCase();

  if (!EMAIL_RE.test(email)) {
    throw new Error("email has invalid format");
  }

  return {
    username: requireString(source, "username", USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, true),
    email,
    password: requireString(source, "password", PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, false),
  };
};

// парсинг публичных данных юзера
export const parseUserPublic = (payload: unknown): UserPublic => {
  const source = ensureRecord(payload, "userPublic");

  return {
    id: requirePositiveInt(source, "id"),
    username: requireString(source, "username", USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, true),
    createdAt: requireIsoDateString(source, "createdAt"),
    email: requireString(source, "email", 5, EMAIL_MAX_LENGTH, false).toLowerCase(),
  };
};

// парсинг аватарки юзера
export const parseUserPicture = (payload: unknown): UserPicture => {
  const source = ensureRecord(payload, "userPicture");

  return {
    userId: requirePositiveInt(source, "userId"),
    picturePath: requireString(source, "picturePath", 1, PATH_MAX_LENGTH, false),
    format: requireString(source, "format", 2, FORMAT_MAX_LENGTH, true),
  };
};

// парсинг связи дружбы
export const parseUserFriend = (payload: unknown): UserFriend => {
  const source = ensureRecord(payload, "userFriend");
  const userId = requirePositiveInt(source, "userId");
  const friendId = requirePositiveInt(source, "friendId");

  if (userId === friendId) {
    throw new Error("userId and friendId must be different");
  }

  return { userId, friendId };
};

// парсинг запроса на дружбу
export const parseUserFriendRequest = (payload: unknown): UserFriendRequest => {
  const source = ensureRecord(payload, "userFriendRequest");
  const userIdFrom = requirePositiveInt(source, "userIdFrom");
  const userIdTo = requirePositiveInt(source, "userIdTo");

  if (userIdFrom === userIdTo) {
    throw new Error("userIdFrom and userIdTo must be different");
  }

  return { userIdFrom, userIdTo };
};

// парсинг статистики юзера
export const parseUserStats = (payload: unknown): UserStats => {
  const source = ensureRecord(payload, "userStats");

  return {
    userId: requirePositiveInt(source, "userId"),
    guessed: requireNonNegativeInt(source, "guessed"),
    skipped: requireNonNegativeInt(source, "skipped"),
    wins: requireNonNegativeInt(source, "wins"),
    losses: requireNonNegativeInt(source, "losses"),
  };
};

// парсинг дефолтной коллекции
export const parseDefaultCollection = (payload: unknown): DefaultCollection => {
  const source = ensureRecord(payload, "defaultCollection");

  return {
    id: requirePositiveInt(source, "id"),
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
    description: requireString(source, "description", 2, DESCRIPTION_MAX_LENGTH, true),
    amountOfCards: requireNonNegativeInt(source, "amountOfCards"),
    difficulty: requireDifficulty(source, "difficulty"),
  };
};

// парсинг тега
export const parseTag = (payload: unknown): Tag => {
  const source = ensureRecord(payload, "tag");

  return {
    id: requirePositiveInt(source, "id"),
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
  };
};

// парсинг связи коллекции и тега
export const parseCollectionTag = (payload: unknown): CollectionTag => {
  const source = ensureRecord(payload, "collectionTag");

  return {
    collectionId: requirePositiveInt(source, "collectionId"),
    tagId: requirePositiveInt(source, "tagId"),
  };
};

// парсинг пользовательской коллекции
export const parseUserCollection = (payload: unknown): UserCollection => {
  const source = ensureRecord(payload, "userCollection");

  return {
    id: requirePositiveInt(source, "id"),
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
    description: requireString(source, "description", 2, DESCRIPTION_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
    amountOfCards: requireNonNegativeInt(source, "amountOfCards"),
    creatorId: requirePositiveInt(source, "creatorId"),
  };
};

// парсинг карточки из коллекции юзера
export const parseUserCard = (payload: unknown): UserCard => {
  const source = ensureRecord(payload, "userCard");

  return {
    id: requirePositiveInt(source, "id"),
    word: requireString(source, "word", 1, WORD_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
    userCollectionId: requirePositiveInt(source, "userCollectionId"),
  };
};

// парсинг карточки
export const parseCard = (payload: unknown): Card => {
  const source = ensureRecord(payload, "card");

  return {
    id: requirePositiveInt(source, "id"),
    word: requireString(source, "word", 1, WORD_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
  };
};

// парсинг связи карточки и коллекции
export const parseCardsCollection = (payload: unknown): CardsCollection => {
  const source = ensureRecord(payload, "cardsCollection");

  return {
    collectionId: requirePositiveInt(source, "collectionId"),
    cardId: requirePositiveInt(source, "cardId"),
  };
};

// парсинг записи об игре
export const parseGame = (payload: unknown): Game => {
  const source = ensureRecord(payload, "game");

  return {
    gameId: requirePositiveInt(source, "gameId"),
    startedDt: requireIsoDateString(source, "startedDt"),
    endedDt: optionalIsoDateOrNull(source, "endedDt"),
    players: requireString(source, "players", 1, GAME_TEXT_MAX_LENGTH, false),
    roomOwnerId: requirePositiveInt(source, "roomOwnerId"),
    score: requireString(source, "score", 1, GAME_TEXT_MAX_LENGTH, false),
    winnerId: optionalPositiveIntOrNull(source, "winnerId"),
  };
};

// парсинг массива с помощью переданного парсера
export const parseList = <T>(payload: unknown, parser: (item: unknown) => T, label: string): T[] => {
  if (!Array.isArray(payload)) {
    throw new Error(`${label} must be an array`);
  }

  return payload.map(parser);
};
