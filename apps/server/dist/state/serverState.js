"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORD_POOL = exports.GAME_START_DELAY_MS = exports.roomTickIntervals = exports.socketPlayers = exports.socketRooms = exports.roomSockets = exports.rooms = void 0;
exports.rooms = new Map();
exports.roomSockets = new Map();
exports.socketRooms = new WeakMap();
exports.socketPlayers = new WeakMap();
exports.roomTickIntervals = new Map();
exports.GAME_START_DELAY_MS = 3000;
exports.WORD_POOL = [
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
];
//# sourceMappingURL=serverState.js.map