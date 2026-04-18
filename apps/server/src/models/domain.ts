// модель пользователя
export interface User {
  id: number;
  username: string;
  createdAt: Date;
  password: string;
  email: string;
}

// аватарка пользователя
export interface UserPicture {
  userId: number;
  picturePath: string;
  format: string;
}

// связь дружбы между пользователями
export interface UserFriend {
  userId: number;
  friendId: number;
}

// заявка в друзья
export interface UserFriendRequest {
  userIdFrom: number;
  userIdTo: number;
}

// статистика пользователя
export interface UserStats {
  userId: number;
  guessed: number;
  skipped: number;
  wins: number;
  losses: number;
}

// стандартная коллекция слов
export interface DefaultCollection {
  id: number;
  name: string;
  description: string;
  amountOfCards: number;
  difficulty: number;
}

// тег коллекции
export interface Tag {
  id: number;
  name: string;
}

// связь коллекции и тега
export interface CollectionTag {
  collectionId: number;
  tagId: number;
}

// пользовательская коллекция
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

// карточка слова
export interface Card {
  id: number;
  word: string;
  difficulty: number;
}

// связь карточки и коллекции
export interface CardsCollection {
  collectionId: number;
  cardId: number;
}

// запись об игре
export interface Game {
  gameId: number;
  startedDt: Date;
  endedDt: Date | null;
  players: string;
  roomOwnerId: number;
  score: string;
  winnerId: number | null;
}
