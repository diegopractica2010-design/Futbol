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
    this.storageKey = config.storageKey || "FMG_GAMESTATE";
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
    const data = localStorage.getItem(this.storageKey + "_" + id);
    if (!data) return Promise.resolve(null);
    const parsed = JSON.parse(data);
    return Promise.resolve(parsed.gameState);
  };

  GameStateRepository.prototype._listFromLocalStorage = function () {
    const results = [];
    const prefix = this.storageKey + "_";
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        const data = JSON.parse(localStorage.getItem(key));
        results.push({
          id: key.replace(prefix, ""),
          timestamp: data.timestamp
        });
      }
    }
    return Promise.resolve(results);
  };

  // --- IndexedDB implementation (stubbed) ---
  GameStateRepository.prototype._saveToIndexedDB = function (data) {
    // TODO: Implement IndexedDB persistence
    return Promise.resolve(data);
  };

  GameStateRepository.prototype._loadFromIndexedDB = function (id) {
    // TODO: Implement IndexedDB retrieval
    return Promise.resolve(null);
  };

  GameStateRepository.prototype._deleteFromIndexedDB = function (id) {
    // TODO: Implement IndexedDB deletion
    return Promise.resolve(true);
  };

  GameStateRepository.prototype._listFromIndexedDB = function () {
    // TODO: Implement IndexedDB listing
    return Promise.resolve([]);
  };

  FMG.Core.Repository.GameStateRepository = GameStateRepository;
})();
