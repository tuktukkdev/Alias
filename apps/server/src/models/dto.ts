import {
  Card,
  CardsCollection,
  CollectionTag,
  DefaultCollection,
  Game,
  Tag,
  User,
  UserCard,
  UserCollection,
  UserFriend,
  UserFriendRequest,
  UserPicture,
  UserStats,
} from "./domain";

// константы валидации полей
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SAFE_TEXT_RE = /^[\p{L}\p{N} _.,!?@#:/+\-()'\"]+$/u;
// dto пользователя (publiчные данные)
export interface UserPublicDto{
  id: number;
  username: string;
  createdAt: string;
  email: string;
}

// dto создания пользователя
export interface CreateUserDto {
  username: string;
  password: string;
  email: string;
}

// dto обновления пользователя
export interface UpdateUserDto {
  username?: string;
  password?: string;
  email?: string;
}

// dto для аватарки
export interface UpsertUserPictureDto {
  userId: number;
  picturePath: string;
  format: string;
}

// dto дружбы
export interface CreateUserFriendDto {
  userId: number;
  friendId: number;
}

// dto заявки в друзья
export interface CreateUserFriendRequestDto {
  userIdFrom: number;
  userIdTo: number;
}

// dto статистики
export interface UpsertUserStatsDto {
  userId: number;
  guessed: number;
  skipped: number;
  wins: number;
  losses: number;
}

// dto стандартной коллекции
export interface CreateDefaultCollectionDto {
  name: string;
  description: string;
  amountOfCards: number;
  difficulty: number;
}

// dto тега
export interface CreateTagDto {
  name: string;
}

// dto привязки тега к коллекции
export interface AttachCollectionTagDto {
  collectionId: number;
  tagId: number;
}

// dto пользовательской коллекции
export interface CreateUserCollectionDto {
  name: string;
  description: string;
  difficulty: number;
  amountOfCards: number;
  creatorId: number;
}

// dto карточки пользователя
export interface CreateUserCardDto {
  word: string;
  difficulty: number;
  userCollectionId: number;
}

// dto карточки
export interface CreateCardDto {
  word: string;
  difficulty: number;
}

// dto привязки карточки к коллекции
export interface AttachCardCollectionDto {
  collectionId: number;
  cardId: number;
}

// dto создания игры
export interface CreateGameDto {
  startedDt: string;
  endedDt?: string | null;
  players: string;
  roomOwnerId: number;
  score: string;
  winnerId?: number | null;
}

// вспомогательные функции валидации полей
const ensureRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
};

const sanitizeText = (value: string): string => value.trim().replace(/\s+/g, " ");

const ensureSafeText = (value: string, field: string): string => {
  if (!SAFE_TEXT_RE.test(value)) {
    throw new Error(`${field} contains unsupported characters`);
  }

  return value;
};

const requireString = (
  source: Record<string, unknown>,
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

  return safe ? ensureSafeText(value, field) : value;
};

const optionalString = (
  source: Record<string, unknown>,
  field: string,
  minLen: number,
  maxLen: number,
  safe: boolean,
): string | undefined => {
  if (source[field] === undefined) {
    return undefined;
  }

  return requireString(source, field, minLen, maxLen, safe);
};

const requireId = (source: Record<string, unknown>, field: string): number => {
  const raw = source[field];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }

  return raw;
};

const optionalIdOrNull = (source: Record<string, unknown>, field: string): number | null | undefined => {
  const raw = source[field];

  if (raw === undefined) {
    return undefined;
  }

  if (raw === null) {
    return null;
  }

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(`${field} must be a positive integer or null`);
  }

  return raw;
};

const requireCounter = (source: Record<string, unknown>, field: string): number => {
  const raw = source[field];
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }

  return raw;
};

const requireDifficulty = (source: Record<string, unknown>, field: string): number => {
  const value = requireCounter(source, field);
  if (value > MAX_DIFFICULTY) {
    throw new Error(`${field} cannot be greater than ${MAX_DIFFICULTY}`);
  }

  return value;
};

const requireIsoDate = (source: Record<string, unknown>, field: string): string => {
  const value = requireString(source, field, 1, 64, false);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be an ISO date string`);
  }

  return value;
};

const optionalIsoDateOrNull = (source: Record<string, unknown>, field: string): string | null | undefined => {
  const raw = source[field];
  if (raw === undefined) {
    return undefined;
  }

  if (raw === null) {
    return null;
  }

  const value = requireIsoDate(source, field);
  return value;
};

// парсеры входящих данных
export const parseCreateUserDto = (payload: unknown): CreateUserDto => {
  const source = ensureRecord(payload, "createUser");
  const email = requireString(source, "email", 5, EMAIL_MAX_LENGTH, false).toLowerCase();

  if (!EMAIL_RE.test(email)) {
    throw new Error("email has invalid format");
  }

  return {
    username: requireString(source, "username", USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, true),
    password: requireString(source, "password", PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, false),
    email,
  };
};

export const parseUpdateUserDto = (payload: unknown): UpdateUserDto => {
  const source = ensureRecord(payload, "updateUser");
  const dto: UpdateUserDto = {
    username: optionalString(source, "username", USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, true),
    password: optionalString(source, "password", PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, false),
    email: optionalString(source, "email", 5, EMAIL_MAX_LENGTH, false)?.toLowerCase(),
  };

  if (dto.email && !EMAIL_RE.test(dto.email)) {
    throw new Error("email has invalid format");
  }

  if (!dto.username && !dto.password && !dto.email) {
    throw new Error("at least one field must be provided");
  }

  return dto;
};

export const parseUpsertUserPictureDto = (payload: unknown): UpsertUserPictureDto => {
  const source = ensureRecord(payload, "upsertUserPicture");

  return {
    userId: requireId(source, "userId"),
    picturePath: requireString(source, "picturePath", 1, PATH_MAX_LENGTH, false),
    format: requireString(source, "format", 2, FORMAT_MAX_LENGTH, true).toLowerCase(),
  };
};

export const parseCreateUserFriendDto = (payload: unknown): CreateUserFriendDto => {
  const source = ensureRecord(payload, "createUserFriend");
  const userId = requireId(source, "userId");
  const friendId = requireId(source, "friendId");

  if (userId === friendId) {
    throw new Error("userId and friendId must be different");
  }

  return { userId, friendId };
};

export const parseCreateUserFriendRequestDto = (payload: unknown): CreateUserFriendRequestDto => {
  const source = ensureRecord(payload, "createUserFriendRequest");
  const userIdFrom = requireId(source, "userIdFrom");
  const userIdTo = requireId(source, "userIdTo");

  if (userIdFrom === userIdTo) {
    throw new Error("userIdFrom and userIdTo must be different");
  }

  return { userIdFrom, userIdTo };
};

export const parseUpsertUserStatsDto = (payload: unknown): UpsertUserStatsDto => {
  const source = ensureRecord(payload, "upsertUserStats");

  return {
    userId: requireId(source, "userId"),
    guessed: requireCounter(source, "guessed"),
    skipped: requireCounter(source, "skipped"),
    wins: requireCounter(source, "wins"),
    losses: requireCounter(source, "losses"),
  };
};

export const parseCreateDefaultCollectionDto = (payload: unknown): CreateDefaultCollectionDto => {
  const source = ensureRecord(payload, "createDefaultCollection");

  return {
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
    description: requireString(source, "description", 2, DESCRIPTION_MAX_LENGTH, true),
    amountOfCards: requireCounter(source, "amountOfCards"),
    difficulty: requireDifficulty(source, "difficulty"),
  };
};

export const parseCreateTagDto = (payload: unknown): CreateTagDto => {
  const source = ensureRecord(payload, "createTag");
  return {
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
  };
};

export const parseAttachCollectionTagDto = (payload: unknown): AttachCollectionTagDto => {
  const source = ensureRecord(payload, "attachCollectionTag");

  return {
    collectionId: requireId(source, "collectionId"),
    tagId: requireId(source, "tagId"),
  };
};

export const parseCreateUserCollectionDto = (payload: unknown): CreateUserCollectionDto => {
  const source = ensureRecord(payload, "createUserCollection");

  return {
    name: requireString(source, "name", 2, NAME_MAX_LENGTH, true),
    description: requireString(source, "description", 2, DESCRIPTION_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
    amountOfCards: requireCounter(source, "amountOfCards"),
    creatorId: requireId(source, "creatorId"),
  };
};

export const parseCreateUserCardDto = (payload: unknown): CreateUserCardDto => {
  const source = ensureRecord(payload, "createUserCard");

  return {
    word: requireString(source, "word", 1, WORD_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
    userCollectionId: requireId(source, "userCollectionId"),
  };
};

export const parseCreateCardDto = (payload: unknown): CreateCardDto => {
  const source = ensureRecord(payload, "createCard");

  return {
    word: requireString(source, "word", 1, WORD_MAX_LENGTH, true),
    difficulty: requireDifficulty(source, "difficulty"),
  };
};

export const parseAttachCardCollectionDto = (payload: unknown): AttachCardCollectionDto => {
  const source = ensureRecord(payload, "attachCardCollection");

  return {
    collectionId: requireId(source, "collectionId"),
    cardId: requireId(source, "cardId"),
  };
};

export const parseCreateGameDto = (payload: unknown): CreateGameDto => {
  const source = ensureRecord(payload, "createGame");

  return {
    startedDt: requireIsoDate(source, "startedDt"),
    endedDt: optionalIsoDateOrNull(source, "endedDt"),
    players: requireString(source, "players", 1, GAME_TEXT_MAX_LENGTH, false),
    roomOwnerId: requireId(source, "roomOwnerId"),
    score: requireString(source, "score", 1, GAME_TEXT_MAX_LENGTH, false),
    winnerId: optionalIdOrNull(source, "winnerId"),
  };
};

// конвертеры dto → модель и обратно
export const toUserPublicDto = (user: User): UserPublicDto => ({
  id: user.id,
  username: user.username,
  createdAt: user.createdAt.toISOString(),
  email: user.email,
});

export const toUserModel = (dto: CreateUserDto, id: number): User => ({
  id,
  username: dto.username,
  createdAt: new Date(),
  password: dto.password,
  email: dto.email,
});

export const toUserPictureModel = (dto: UpsertUserPictureDto): UserPicture => ({
  userId: dto.userId,
  picturePath: dto.picturePath,
  format: dto.format,
});

export const toUserFriendModel = (dto: CreateUserFriendDto): UserFriend => ({
  userId: dto.userId,
  friendId: dto.friendId,
});

export const toUserFriendRequestModel = (dto: CreateUserFriendRequestDto): UserFriendRequest => ({
  userIdFrom: dto.userIdFrom,
  userIdTo: dto.userIdTo,
});

export const toUserStatsModel = (dto: UpsertUserStatsDto): UserStats => ({
  userId: dto.userId,
  guessed: dto.guessed,
  skipped: dto.skipped,
  wins: dto.wins,
  losses: dto.losses,
});

export const toDefaultCollectionModel = (dto: CreateDefaultCollectionDto, id: number): DefaultCollection => ({
  id,
  name: dto.name,
  description: dto.description,
  amountOfCards: dto.amountOfCards,
  difficulty: dto.difficulty,
});

export const toTagModel = (dto: CreateTagDto, id: number): Tag => ({
  id,
  name: dto.name,
});

export const toCollectionTagModel = (dto: AttachCollectionTagDto): CollectionTag => ({
  collectionId: dto.collectionId,
  tagId: dto.tagId,
});

export const toUserCollectionModel = (dto: CreateUserCollectionDto, id: number): UserCollection => ({
  id,
  name: dto.name,
  description: dto.description,
  difficulty: dto.difficulty,
  amountOfCards: dto.amountOfCards,
  creatorId: dto.creatorId,
});

export const toUserCardModel = (dto: CreateUserCardDto, id: number): UserCard => ({
  id,
  word: dto.word,
  difficulty: dto.difficulty,
  userCollectionId: dto.userCollectionId,
});

export const toCardModel = (dto: CreateCardDto, id: number): Card => ({
  id,
  word: dto.word,
  difficulty: dto.difficulty,
});

export const toCardsCollectionModel = (dto: AttachCardCollectionDto): CardsCollection => ({
  collectionId: dto.collectionId,
  cardId: dto.cardId,
});

export const toGameModel = (dto: CreateGameDto, gameId: number): Game => ({
  gameId,
  startedDt: new Date(dto.startedDt),
  endedDt: dto.endedDt ? new Date(dto.endedDt) : null,
  players: dto.players,
  roomOwnerId: dto.roomOwnerId,
  score: dto.score,
  winnerId: dto.winnerId ?? null,
});
