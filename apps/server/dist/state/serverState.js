"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_START_DELAY_MS = exports.userRooms = exports.roomTickIntervals = exports.socketPlayers = exports.socketRooms = exports.roomSockets = exports.rooms = void 0;
// глобальное состояние сервера: комнаты, сокеты, игроки
exports.rooms = new Map();
exports.roomSockets = new Map();
exports.socketRooms = new WeakMap();
exports.socketPlayers = new WeakMap();
exports.roomTickIntervals = new Map();
exports.userRooms = new Map();
// задержка перед началом игры
exports.GAME_START_DELAY_MS = 3000;
//# sourceMappingURL=serverState.js.map