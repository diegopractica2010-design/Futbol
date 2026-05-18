(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Repository = FMG.Core.Repository || {};

  /**
   * GameStateRepository
   * Handles persistence and retrieval of GameState objects
   * Uses local storage or IndexedDB for browser environment
   */
  function GameStateRepository(config) {
    config = config || {};
    this.storageKey = config.storageKey || ((FMG.CORE_STORAGE_PREFIX || "football-manager-game-core-") + "gamestate");
    this.legacyStorageKey = "FMG_GAMESTATE";
    this.useIndexedDB = config.useIndexedDB || false;
    this._memory = {};
  }

  /**
   * Save GameState to persistent storage
   */
  GameStateRepository.prototype.save = function (id, gameState) {
    if (!gameState) {
      throw new Error("GameState required");
    }

    try {
      const data = {
        id,
        gameState: gameState.toJSON(),
        timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(gameState.generation, 100)
      };

      if (this.useIndexedDB && window.indexedDB) {
        return this._saveToIndexedDB(data);
      } else if (window.localStorage) {
        return this._saveToLocalStorage(id, data);
      } else {
        // Fallback to memory storage
        this._memory[id] = data;
        return Promise.resolve(data);
      }
    } catch (err) {
      console.error("GameStateRepository.save error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * Load GameState from persistent storage
   */
  GameStateRepository.prototype.load = function (id) {
    try {
      if (this.useIndexedDB && window.indexedDB) {
        return this._loadFromIndexedDB(id);
      } else if (window.localStorage) {
        return this._loadFromLocalStorage(id);
      } else {
        // Fallback to memory storage
        const data = this._memory[id];
        return Promise.resolve(data ? data.gameState : null);
      }
    } catch (err) {
      console.error("GameStateRepository.load error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * Delete GameState from persistent storage
   */
  GameStateRepository.prototype.delete = function (id) {
    try {
      if (this.useIndexedDB && window.indexedDB) {
        return this._deleteFromIndexedDB(id);
      } else if (window.localStorage) {
        localStorage.removeItem(this.storageKey + "_" + id);
        localStorage.removeItem(this.legacyStorageKey + "_" + id);
        return Promise.resolve(true);
      } else {
        delete this._memory[id];
        return Promise.resolve(true);
      }
    } catch (err) {
      console.error("GameStateRepository.delete error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * List all saved GameStates
   */
  GameStateRepository.prototype.list = function () {
    try {
      if (this.useIndexedDB && window.indexedDB) {
        return this._listFromIndexedDB();
      } else if (window.localStorage) {
        return this._listFromLocalStorage();
      } else {
        return Promise.resolve(Object.keys(this._memory).map((id) => ({ id, timestamp: this._memory[id].timestamp })));
      }
    } catch (err) {
      console.error("GameStateRepository.list error:", err);
      return Promise.reject(err);
    }
  };

  // --- LocalStorage implementation ---
  GameStateRepository.prototype._saveToLocalStorage = function (id, data) {
    localStorage.setItem(this.storageKey + "_" + id, JSON.stringify(data));
    return Promise.resolve(data);
  };

  GameStateRepository.prototype._loadFromLocalStorage = function (id) {
    const data = localStorage.getItem(this.storageKey + "_" + id) || localStorage.getItem(this.legacyStorageKey + "_" + id);
    if (!data) return Promise.resolve(null);
    const parsed = JSON.parse(data);
    return Promise.resolve(parsed.gameState);
  };

  GameStateRepository.prototype._listFromLocalStorage = function () {
    const results = [];
    const prefixes = [this.storageKey + "_", this.legacyStorageKey + "_"];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const prefix = prefixes.find((candidate) => key.startsWith(candidate));
      if (prefix) {
        const data = JSON.parse(localStorage.getItem(key));
        results.push({
          id: key.replace(prefix, ""),
          timestamp: data.timestamp
        });
      }
    }
    return Promise.resolve(results);
  };

  // --- IndexedDB implementation ---
  const DB_NAME = "FMG_GAME_DB";
  const DB_VERSION = 1;
  const STORE_NAME = "gamestates";

  GameStateRepository.prototype._openIndexedDB = function () {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event.target.errorCode);
        reject(event.target.errorCode);
      };
    });
  };
  GameStateRepository.prototype._saveToIndexedDB = function (data) {
    return this._openIndexedDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data);

        request.onsuccess = () => resolve(data);
        request.onerror = (event) => reject(event.target.error);
      });
    });
  };

  GameStateRepository.prototype._loadFromIndexedDB = function (id) {
    return this._openIndexedDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
          const data = event.target.result;
          resolve(data ? data.gameState : null);
        };
        request.onerror = (event) => reject(event.target.error);
      });
    });
  };

  GameStateRepository.prototype._deleteFromIndexedDB = function (id) {
    return this._openIndexedDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject(event.target.error);
      });
    });
  };

  GameStateRepository.prototype._listFromIndexedDB = function () {
    return this._openIndexedDB().then((db) => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push({
              id: cursor.value.id,
              timestamp: cursor.value.timestamp
            });
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
    });
  };

  FMG.Core.Repository.GameStateRepository = GameStateRepository;
})();
