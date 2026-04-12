export interface User {
  id: number;
  username: string;
  createdAt: Date;
  password: string;
  email: string;
}

export interface UserPicture {
  userId: number;
  picturePath: string;
  format: string;
}

export interface UserFriend {
  userId: number;
  friendId: number;
}

export interface UserFriendRequest {
  userIdFrom: number;
  userIdTo: number;
}

export interface UserStats {
  userId: number;
  guessed: number;
  skipped: number;
  wins: number;
  losses: number;
}

export interface DefaultCollection {
  id: number;
  name: string;
  description: string;
  amountOfCards: number;
  difficulty: number;
}

export interface Tag {
  id: number;
  name: string;
}

export interface CollectionTag {
  collectionId: number;
  tagId: number;
}

export interface UserCollection {
  id: number;
  name: string;
  description: string;
  difficulty: number;
  amountOfCards: number;
  creatorId: number;
}

export interface UserCard {
  id: number;
  word: string;
  difficulty: number;
  userCollectionId: number;
}

export interface Card {
  id: number;
  word: string;
  difficulty: number;
}

export interface CardsCollection {
  collectionId: number;
  cardId: number;
}

export interface Game {
  gameId: number;
  startedDt: Date;
  endedDt: Date | null;
  players: string;
  roomOwnerId: number;
  score: string;
  winnerId: number | null;
}
