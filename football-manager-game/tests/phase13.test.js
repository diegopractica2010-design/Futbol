const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; },
  removeItem(key) { delete this.data[key]; }
};

[
  "src/utils.js",
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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.equal(FMG.gameState.version, 13, "fase 13 debe usar estado version 13");
assert.ok(FMG.gameState.settings, "debe tener configuracion");
assert.ok(FMG.gameState.saveMeta, "debe tener metadata de guardado");

const slot1 = FMG.saveToSlot(FMG.gameState, "slot-1", { overwrite: true });
assert.equal(slot1.ok, true, "debe guardar en slot 1");
const slot2 = FMG.saveToSlot(FMG.gameState, "slot-2", { overwrite: true });
assert.equal(slot2.ok, true, "debe guardar en slot 2");
assert.ok(FMG.listSaveSlots().some((slot) => slot.slotId === "slot-1"), "slot 1 debe aparecer en indice");
assert.ok(FMG.listSaveSlots().some((slot) => slot.slotId === "slot-2"), "slot 2 debe aparecer en indice");
const blockedOverwrite = FMG.saveToSlot(FMG.gameState, "slot-1", { overwrite: false });
assert.equal(blockedOverwrite.ok, false, "debe requerir confirmacion logica antes de sobrescribir");

FMG.updateGameSetting(FMG.gameState, "autosave.enabled", "true");
FMG.updateGameSetting(FMG.gameState, "autosave.intervalWeeks", "1");
FMG.gameState.currentWeek += 1;
const autosave = FMG.autosaveIfNeeded(FMG.gameState, "test");
assert.equal(autosave.ok, true, "autosave debe guardar cuando corresponde");
assert.ok(localStorage.data[`${FMG.SAVE_SLOT_PREFIX}autosave`], "autosave debe escribir slot dedicado");

FMG.updateGameSetting(FMG.gameState, "difficulty", "hard");
FMG.updateGameSetting(FMG.gameState, "simulationSpeed", "10");
FMG.updateGameSetting(FMG.gameState, "season.format", "short");
FMG.updateGameSetting(FMG.gameState, "season.marketWindows", "generous");
FMG.updateGameSetting(FMG.gameState, "season.financialPressure", "strict");
assert.equal(FMG.gameState.settings.difficulty, "hard", "debe configurar dificultad");
assert.equal(FMG.gameState.settings.simulationSpeed, 10, "debe configurar velocidad");
assert.equal(FMG.gameState.settings.seasonOptions.format, "short", "debe configurar formato de temporada");

const exported = FMG.exportSave(FMG.gameState);
assert.ok(exported.includes("\"game\""), "export debe envolver partida");
const imported = FMG.importSave(exported, "slot-3");
assert.equal(imported.ok, true, "debe importar partida exportada");
assert.ok(FMG.listSaveSlots().some((slot) => slot.slotId === "slot-3"), "import debe crear slot destino");

const legacy = JSON.parse(exported).game;
legacy.version = 4;
delete legacy.settings;
delete legacy.saveMeta;
delete legacy.worldNews;
delete legacy.ui;
const migrated = FMG.migrateSaveState(legacy);
assert.equal(migrated.version, 13, "migracion debe llevar saves antiguos a version actual");
assert.ok(migrated.settings, "migracion debe crear configuracion");
assert.ok(migrated.saveMeta, "migracion debe crear metadata");

assert.equal(FMG.loadFromSlot("slot-1").ok, true, "debe cargar slot existente");
assert.equal(FMG.gameState.saveMeta.activeSlotId, "slot-1", "carga debe fijar slot activo");

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
FMG.updateGameSetting(FMG.gameState, "season.format", "short");
FMG.updateGameSetting(FMG.gameState, "season.marketWindows", "generous");
let seasonsCompleted = 0;
let guard = 0;
while (seasonsCompleted < 3 && guard < 120) {
  if (FMG.gameState.seasonComplete) {
    const started = FMG.startNewSeason();
    assert.equal(started.ok, true, "debe iniciar temporada larga sin romperse");
    seasonsCompleted += 1;
  } else {
    const result = FMG.advanceWeek();
    assert.equal(result.ok, true, "avance largo debe completar semanas");
  }
  assert.ok(Number.isFinite(FMG.gameState.finances.balance), "economia larga debe mantener balance numerico");
  assert.ok(Array.isArray(FMG.gameState.market.transferHistory), "mercado largo debe mantener historial");
  assert.ok(FMG.gameState.players.filter((player) => !player.retired).length >= FMG.gameState.teams.length * 15, "temporadas largas deben mantener planteles viables");
  guard += 1;
}
assert.ok(seasonsCompleted >= 3, "debe soportar multiples temporadas");
assert.ok(FMG.gameState.seasonHistory.length >= 3, "debe registrar historial largo");
assert.ok(FMG.gameState.finances.weeklyReport.length > 0, "economia largo plazo debe registrar reportes");
assert.ok(FMG.gameState.market.transferHistory.length > 0, "mercado largo plazo debe producir movimientos");

console.log("Phase 13 tests passed");
