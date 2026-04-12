import { WebSocket } from "ws";
import { RoomRecord } from "../types/game";

export const rooms = new Map<string, RoomRecord>();
export const roomSockets = new Map<string, Set<WebSocket>>();
export const socketRooms = new WeakMap<WebSocket, string>();
export const socketPlayers = new WeakMap<WebSocket, string>();
export const roomTickIntervals = new Map<string, NodeJS.Timeout>();
export const userRooms = new Map<string, { roomId: string; playerId: string }>();

export const GAME_START_DELAY_MS = 3000;

export const WORD_POOL = [
  "самолет",
  "дерево",
  "река",
  "облако",
  "молния",
  "велосипед",
  "чайник",
  "крокодил",
  "компас",
  "библиотека",
  "телескоп",
  "карандаш",
  "футбол",
  "радуга",
  "холодильник",
  "пианино",
  "космонавт",
  "шоколад",
  "фонарик",
  "остров",
  "шторм",
  "калькулятор",
  "подушка",
  "медуза",
  "картина",
  "вулкан",
  "чемодан",
  "метро",
  "гитара",
  "кактус",
  "пингвин",
  "песочные часы",
  "будильник",
  "водопад",
  "клавиатура",
  "вертолет",
  "пустыня",
  "корабль",
  "фейерверк",
  "мороженое",
] as const;
