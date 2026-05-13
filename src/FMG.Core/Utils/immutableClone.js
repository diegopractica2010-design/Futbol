import { deepFreeze } from './deepFreeze';

export function immutableClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  let clone;
  if (Array.isArray(obj)) {
    clone = [];
    for (let i = 0; i < obj.length; i++) {
      clone[i] = immutableClone(obj[i]);
    }
  } else {
    clone = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clone[key] = immutableClone(obj[key]);
      }
    }
  }

  return deepFreeze(clone);
}
