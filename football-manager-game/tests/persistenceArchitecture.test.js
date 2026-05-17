const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function createIndexedDBMock() {
  const databases = new Map();
  return {
    open(name) {
      const request = { result: null, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      process.nextTick(() => {
        if (!databases.has(name)) {
          const stores = new Map();
          const db = {
            objectStoreNames: { contains: (storeName) => stores.has(storeName) },
            createObjectStore(storeName) {
              if (!stores.has(storeName)) stores.set(storeName, new Map());
              return stores.get(storeName);
            },
            transaction(storeNames) {
              const names = Array.isArray(storeNames) ? storeNames : [storeNames];
              const tx = {
                error: null,
                oncomplete: null,
                onerror: null,
                onabort: null,
                objectStore(storeName) {
                  if (!names.includes(storeName)) throw new Error("Store not in transaction");
                  if (!stores.has(storeName)) stores.set(storeName, new Map());
                  const store = stores.get(storeName);
                  return {
                    put(record) {
                      store.set(record.id, record);
                    },
                    get(id) {
                      const getRequest = { result: undefined, error: null, onsuccess: null, onerror: null };
                      process.nextTick(() => {
                        getRequest.result = store.get(id);
                        if (getRequest.onsuccess) getRequest.onsuccess({ target: getRequest });
                      });
                      return getRequest;
                    },
                    delete(id) {
                      store.delete(id);
                    },
                    openCursor() {
                      const cursorRequest = { result: null, error: null, onsuccess: null, onerror: null };
                      const values = Array.from(store.values());
                      let index = 0;
                      function emit() {
                        const value = values[index];
                        cursorRequest.result = value ? {
                          value,
                          continue() {
                            index += 1;
                            process.nextTick(emit);
                          }
                        } : null;
                        if (cursorRequest.onsuccess) cursorRequest.onsuccess({ target: cursorRequest });
                      }
                      process.nextTick(emit);
                      return cursorRequest;
                    }
                  };
                }
              };
              process.nextTick(() => {
                if (tx.oncomplete) tx.oncomplete();
              });
              return tx;
            }
          };
          databases.set(name, db);
          request.result = db;
          if (request.onupgradeneeded) request.onupgradeneeded({ target: request });
        }
        request.result = databases.get(name);
        if (request.onsuccess) request.onsuccess({ target: request });
      });
      return request;
    }
  };
}

global.window = global;
global.document = undefined;
global.navigator = { deviceMemory: 4, hardwareConcurrency: 4 };
global.performance = { now: () => 10 };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.indexedDB = createIndexedDBMock();
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = String(value); },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; },
  key(index) { return Object.keys(this.data)[index] || null; },
  get length() { return Object.keys(this.data).length; }
};

[
  "src/utils.js",
  "src/architecture.js",
  "src/gameState.js",
  "src/table.js",
  "src/squad.js",
  "src/matchEngine.js",
  "src/finances.js",
  "src/events.js",
  "src/transfers.js",
  "src/career.js",
  "src/news.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/managerEcosystem.js",
  "src/worldMediaPressure.js",
  "src/advancedTransferMarket.js",
  "src/advancedYouthAcademy.js",
  "src/squadPsychology.js",
  "src/gameEngine.js",
  "src/runtimeHardening.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

function waitForPipeline() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    function check() {
      const report = FMG.incrementalSavePipeline.report();
      if (!report.processing && report.queueLength === 0) {
        resolve(report);
        return;
      }
      if (Date.now() - started > 2000) {
        reject(new Error("Pipeline did not drain"));
        return;
      }
      setTimeout(check, 10);
    }
    check();
  });
}

(async function run() {
  FMG.initializeGame(teams, players);
  FMG.selectClub("colo-colo");
  FMG.gameState.players[0].mediaRelevance = 20;
  FMG.gameState.players.push({ id: "retired-test", name: "Retired Test", teamId: "colo-colo", age: 39, overall: 61, isRetired: true });

  for (let index = 0; index < 5; index += 1) {
    FMG.gameState.currentWeek += 1;
    const save = FMG.saveToSlot(FMG.gameState, "slot-persist", { overwrite: true });
    assert.equal(save.ok, true, "rapid save loop debe guardar");
    assert.equal(FMG.loadFromSlot("slot-persist").ok, true, "rapid load loop debe cargar");
  }

  const pipelineReport = await waitForPipeline();
  assert.ok(pipelineReport.lastManifest, "pipeline incremental debe producir manifest");
  assert.equal(pipelineReport.lastManifest.status, "committed", "manifest debe quedar committed");
  assert.ok(pipelineReport.lastManifest.chunkCount >= 1, "save debe persistirse en chunks");
  assert.ok(pipelineReport.lastManifest.entityStates.archived >= 1, "entidades archivadas deben clasificarse");

  const asyncLoad = await FMG.loadFromSlotAsync("slot-persist");
  assert.equal(asyncLoad.ok, true, "load async debe recuperar desde IndexedDB/chunks");
  assert.ok(["indexedDB", undefined].includes(asyncLoad.storage), "load async debe conservar fallback compatible");

  const raw = localStorage.getItem(`${FMG.SAVE_SLOT_PREFIX}slot-persist`);
  localStorage.setItem(`${FMG.SAVE_SLOT_PREFIX}slot-persist`, "{broken");
  const recovered = FMG.loadFromSlot("slot-persist");
  assert.equal(recovered.ok, true, "load debe recuperar desde backup si el save principal se corrompe");
  localStorage.setItem(`${FMG.SAVE_SLOT_PREFIX}slot-persist`, raw);

  await FMG.worldPersistenceEngine.put("manifests", {
    id: "slot-interrupted",
    slotId: "slot-interrupted",
    status: "pending",
    chunkCount: 2,
    checksum: "missing"
  });
  const interrupted = await FMG.incrementalSavePipeline.load("slot-interrupted");
  assert.equal(interrupted, null, "manifest pending debe rechazarse como save incompleto");

  await FMG.replayDeltaStorage.saveReplay("replay-ok", [{ tick: 1, type: "goal", payload: { teamId: "colo-colo" } }]);
  const replay = await FMG.replayDeltaStorage.loadReplay("replay-ok");
  assert.equal(replay.length, 1, "replay persistido debe cargar");
  await FMG.worldPersistenceEngine.put("replays", { id: "replay-bad", checksum: "bad", events: [{ tick: 2 }] });
  let replayRejected = false;
  try {
    await FMG.replayDeltaStorage.loadReplay("replay-bad");
  } catch (error) {
    replayRejected = true;
  }
  assert.equal(replayRejected, true, "replay corrupto debe fallar validacion");

  const legacy = JSON.parse(FMG.exportSave(FMG.gameState)).game;
  legacy.version = 4;
  delete legacy.saveMeta;
  delete legacy.settings;
  const migrated = FMG.migrateSaveState(legacy);
  assert.equal(migrated.version, FMG.CURRENT_VERSION, "migracion debe conservar compatibilidad");
  assert.equal(FMG.saveIntegrityValidator.validate(migrated).ok, true, "save migrado debe validar");

  const integrity = FMG.generatePersistenceIntegrityReport();
  const scalability = FMG.generateScalabilityReport();
  const migrationRisk = FMG.generateMigrationRiskReport();
  const remaining = FMG.generateRemainingPersistenceRisks();
  assert.equal(integrity.ok, true, "reporte de integridad debe quedar ok");
  assert.equal(scalability.chunkedPersistence, true, "reporte de escalabilidad debe detectar chunks");
  assert.equal(migrationRisk.backwardsCompatible, true, "reporte de migracion debe declarar compatibilidad");
  assert.ok(remaining.risks.length > 0, "reporte de riesgos restantes debe listar riesgos reales");

  console.log("Persistence architecture tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
