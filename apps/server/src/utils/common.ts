export const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const getRouteParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

export const normalizeWord = (value: string): string =>
  value.trim().toLowerCase().replace(/ё/g, "е");
