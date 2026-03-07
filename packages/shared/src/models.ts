export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameRoomSettings {
  timer: number;
  winScore: number;
}

export interface GameRoom {
  players: Player[];
  hostId: Player["id"];
  settings: GameRoomSettings;
}
