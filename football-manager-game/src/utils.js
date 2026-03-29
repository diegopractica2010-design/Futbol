export const STORAGE_KEY = "football-manager-game-save";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sample(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function currency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
