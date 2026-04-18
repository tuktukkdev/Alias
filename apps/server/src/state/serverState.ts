import { WebSocket } from "ws";
import { RoomRecord } from "../types/game";

// глобальное состояние сервера: комнаты, сокеты, игроки
export const rooms = new Map<string, RoomRecord>();
export const roomSockets = new Map<string, Set<WebSocket>>();
export const socketRooms = new WeakMap<WebSocket, string>();
export const socketPlayers = new WeakMap<WebSocket, string>();
export const roomTickIntervals = new Map<string, NodeJS.Timeout>();
export const userRooms = new Map<string, { roomId: string; playerId: string }>();

// задержка перед началом игры
export const GAME_START_DELAY_MS = 3000;