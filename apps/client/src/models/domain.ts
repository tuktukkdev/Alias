// публичные данные юзера
export interface UserPublic {
  id: number;
  username: string;
  createdAt: string;
  email: string;
}

// аватарка юзера
export interface UserPicture {
  userId: number;
  picturePath: string;
  format: string;
}

// связь дружбы между юзерами
export interface UserFriend {
  userId: number;
  friendId: number;
}

// запрос на дружбу
export interface UserFriendRequest {
  userIdFrom: number;
  userIdTo: number;
}

// статистика юзера
export interface UserStats {
  userId: number;
  guessed: number;
  skipped: number;
  wins: number;
  losses: number;
}

// дефолтная коллекция слов
export interface DefaultCollection {
  id: number;
  name: string;
  description: string;
  amountOfCards: number;
  difficulty: number;
}

// тег для коллекций
export interface Tag {
  id: number;
  name: string;
}

// связь коллекции и тега
export interface CollectionTag {
  collectionId: number;
  tagId: number;
}

// пользовательская коллекция слов
export interface UserCollection {
  id: number;
  name: string;
  description: string;
  difficulty: number;
  amountOfCards: number;
  creatorId: number;
}

// карточка из пользовательской коллекции
export interface UserCard {
  id: number;
  word: string;
  difficulty: number;
  userCollectionId: number;
}

// карточка из дефолтной коллекции
export interface Card {
  id: number;
  word: string;
  difficulty: number;
}

// связь коллекции и карточки
export interface CardsCollection {
  collectionId: number;
  cardId: number;
}

// запись об игре
export interface Game {
  gameId: number;
  startedDt: string;
  endedDt: string | null;
  players: string;
  roomOwnerId: number;
  score: string;
  winnerId: number | null;
}
