"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWord = exports.getRouteParam = exports.createId = void 0;
const createId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
exports.createId = createId;
const getRouteParam = (value) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
exports.getRouteParam = getRouteParam;
const normalizeWord = (value) => value.trim().toLowerCase().replace(/ё/g, "е");
exports.normalizeWord = normalizeWord;
//# sourceMappingURL=common.js.map