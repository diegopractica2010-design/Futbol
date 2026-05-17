const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

// Mock IndexedDB
const indexedDBMock = {
  databases: () => Promise.resolve([{ name: "FMG_GAME_DB", version: 1 }]),
  open: (name, version) => {
    return {
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      result: {
        objectStoreNames: { contains: (name) => name === "gamestates" },
        createObjectStore: (name, options) => ({}),
        transaction: (storeNames, mode) => ({
          objectStore: (name) => ({
            _data: {},
            put: (data) => {
              this._data[data.id] = data;
              const request = { onsuccess: null, onerror: null };
              process.nextTick(() => request.onsuccess && request.onsuccess({ target: { result: data } }));
              return request;
            },
            get: (id) => {
              const result = this._data[id];
              const request = { onsuccess: null, onerror: null };
              process.nextTick(() => request.onsuccess && request.onsuccess({ target: { result } }));
              return request;
            },
            delete: (id) => {
              delete this._data[id];
              const request = { onsuccess: null, onerror: null };
              process.nextTick(() => request.onsuccess && request.onsuccess({ target: { result: undefined } }));
              return request;
            },
            openCursor: () => {
              const keys = Object.keys(this._data);
              let i = 0;
              const request = { onsuccess: null, onerror: null };

              const createCursor = (index) => {
                if (index < keys.length) {
                  const key = keys[index];
                  return {
                    key: key,
                    value: this._data[key],
                    continue: () => {
                      process.nextTick(() => request.onsuccess && request.onsuccess({ target: { result: createCursor(index + 1) } }));
                    }
                  };
                }
                return null;
              };

              process.nextTick(() => request.onsuccess && request.onsuccess({ target: { result: createCursor(0) } }));
              return request;
            },
          }),
          _data: {}, // Separate data store for each transaction mock
        }),
      },
    };
  },
  deleteDatabase: (name) => ({
    onsuccess: () => {},
    onerror: () => {},
  }),
};

global.window = global;
global.performance = { now: () => 10 };
global.addEventListener = () => {};
global.localStorage = {
  _data: {},
  getItem: function (key) { return this._data[key]; },
  setItem: function (key, value) { this._data[key] = value; },
  removeItem: function (key) { delete this._data[key]; },
  clear: function () { this._data = {}; },
  length: Object.keys(this._data).length,
  key: function (index) { return Object.keys(this._data)[index]; }
};
global.indexedDB = indexedDBMock;

window.FMG = {
  CURRENT_VERSION: 1,
  deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  },
  Core: {
    Utils: {
      Determinism: {
        timestampForGeneration: (generation, factor) => `timestamp-${generation}-${factor}`,
        id: (prefix = "", data = {}) => `${prefix}-${JSON.stringify(data)}-${Math.random()}`
      }
    }
  }
};

// Load required source files
[
  "src/FMG.Core/Engine/GameState.js",
  "src/FMG.Core/Repository/GameStateRepository.js",
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const GameState = FMG.Core.Engine.GameState;
const GameStateRepository = FMG.Core.Repository.GameStateRepository;

// Mock GameState toJSON
GameState.prototype.toJSON = function () {
  return {
    season: this.season,
    clubs: this.clubs,
    manager: this.manager,
    generation: this.generation,
  };
};

describe("GameStateRepository", () => {
  let repo;
  let mockGameState;

  beforeEach(() => {
    // Clear localStorage and IndexedDB mock data before each test
    global.localStorage.clear();
    // Reinitialize indexedDBMock._data for each test to ensure isolation
    indexedDBMock.open().result.transaction().objectStore()._data = {};

    repo = new GameStateRepository({ storageKey: "TEST_GAMESTATE", useIndexedDB: true });
    mockGameState = new GameState({
      season: { week: 1, totalWeeks: 2 },
      clubs: [{ id: "clubA", name: "Club A" }],
      manager: { name: "Manager B" },
      generation: 1
    });
  });

  describe("IndexedDB persistence", () => {
    it("should save and load a GameState", async () => {
      await repo.save("test-id-1", mockGameState);
      const loadedState = await repo.load("test-id-1");
      assert.deepStrictEqual(loadedState, mockGameState.toJSON());
    });

    it("should list saved GameStates", async () => {
      await repo.save("test-id-1", mockGameState);
      const anotherGameState = new GameState({
        season: { week: 2, totalWeeks: 2 },
        generation: 2
      });
      await repo.save("test-id-2", anotherGameState);

      const listed = await repo.list();
      assert.strictEqual(listed.length, 2);
      assert.ok(listed.some(item => item.id === "test-id-1" && item.timestamp === FMG.Core.Utils.Determinism.timestampForGeneration(1, 100)));
      assert.ok(listed.some(item => item.id === "test-id-2" && item.timestamp === FMG.Core.Utils.Determinism.timestampForGeneration(2, 100)));
    });

    it("should delete a GameState", async () => {
      await repo.save("test-id-to-delete", mockGameState);
      let loaded = await repo.load("test-id-to-delete");
      assert.deepStrictEqual(loaded, mockGameState.toJSON());

      await repo.delete("test-id-to-delete");
      loaded = await repo.load("test-id-to-delete");
      assert.strictEqual(loaded, null);
    });
  });

  describe("LocalStorage compatibility", () => {
    beforeEach(() => {
      repo = new GameStateRepository({ storageKey: "TEST_GAMESTATE", useIndexedDB: false });
      global.localStorage.clear();
    });

    it("should save and load a GameState using localStorage", async () => {
      await repo.save("local-test-id-1", mockGameState);
      const loadedState = await repo.load("local-test-id-1");
      assert.deepStrictEqual(loadedState, mockGameState.toJSON());
    });

    it("should list saved GameStates from localStorage", async () => {
      await repo.save("local-test-id-1", mockGameState);
      const anotherGameState = new GameState({
        season: { week: 2, totalWeeks: 2 },
        generation: 2
      });
      await repo.save("local-test-id-2", anotherGameState);

      const listed = await repo.list();
      assert.strictEqual(listed.length, 2);
      assert.ok(listed.some(item => item.id === "local-test-id-1" && item.timestamp === FMG.Core.Utils.Determinism.timestampForGeneration(1, 100)));
      assert.ok(listed.some(item => item.id === "local-test-id-2" && item.timestamp === FMG.Core.Utils.Determinism.timestampForGeneration(2, 100)));
    });

    it("should delete a GameState from localStorage", async () => {
      await repo.save("local-test-id-to-delete", mockGameState);
      let loaded = await repo.load("local-test-id-to-delete");
      assert.deepStrictEqual(loaded, mockGameState.toJSON());

      await repo.delete("local-test-id-to-delete");
      loaded = await repo.load("local-test-id-to-delete");
      assert.strictEqual(loaded, null);
    });
  });
});
