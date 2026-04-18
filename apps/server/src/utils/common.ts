// генерация короткого id с префиксом
export const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// извлечение параметра из роута
export const getRouteParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

// нормализация слова (нижний регистр + ё → е)
export const normalizeWord = (value: string): string =>
  value.trim().toLowerCase().replace(/ё/g, "е");
