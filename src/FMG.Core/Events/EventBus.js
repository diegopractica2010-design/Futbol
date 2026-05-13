export const EventBus = (() => {
  const listeners = {};

  const subscribe = (eventType, callback) => {
    if (!listeners[eventType]) {
      listeners[eventType] = [];
    }
    listeners[eventType].push(callback);
  };

  const publish = (eventType, data) => {
    if (listeners[eventType]) {
      listeners[eventType].forEach(callback => callback(data));
    }
  };

  return { subscribe, publish };
})();