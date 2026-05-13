export function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  Object.freeze(obj);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const prop = obj[key];
      if (typeof prop === 'object' && prop !== null && !Object.isFrozen(prop)) {
        deepFreeze(prop);
      }
    }
  }
  return obj;
}
