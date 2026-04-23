import { WebSocket } from "ws";
import { RoomRecord } from "../types/game";

// глобальное состояние сервера: комнаты, сокеты, игроки
export const rooms = new Map<string, RoomRecord>();
export const roomSockets = new Map<string, Set<WebSocket>>();
export const socketRooms = new WeakMap<WebSocket, string>();
export const socketPlayers = new WeakMap<WebSocket, string>();
export const roomTickIntervals = new Map<string, NodeJS.Timeout>();
export const userRooms = new Map<string, { roomId: string; playerId: string }>();

// таймеры кика игроков при долгом офлайне 
export const playerOfflineTimers = new Map<string, NodeJS.Timeout>();

// таймер закрытия комнаты когда все офлайн  roomId
export const roomAllOfflineTimers = new Map<string, NodeJS.Timeout>();

// задержка перед началом игры
export const GAME_START_DELAY_MS = 3000;

// через сколько секунд кикнуть игрока если он офлайн (180 с)
export const PLAYER_OFFLINE_KICK_MS = 180_000;

// через сколько секунд закрыть комнату если все офлайн (60 с)
export const ALL_OFFLINE_CLOSE_MS = 60_000;