const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) {
    this.data[key] = value;
  },
  getItem(key) {
    return this.data[key] || null;
  }
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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 2, "fase 1 debe usar estado versionado");
assert.equal(FMG.getMatchSquad(FMG.gameState, "colo-colo").length, 11, "debe existir once titular");
assert.ok(FMG.gameState.players.every((player) => Number.isFinite(player.contractYears)), "todos los jugadores deben tener contrato");

const formationResult = FMG.setFormation(FMG.gameState, "4-4-2");
assert.equal(formationResult.ok, true, "debe permitir cambiar formacion");
assert.equal(FMG.getTeamPlan(FMG.gameState, "colo-colo").formation, "4-4-2", "la formacion debe quedar guardada");

const trainingResult = FMG.setTrainingFocus(FMG.gameState, "fitness");
assert.equal(trainingResult.ok, true, "debe permitir cambiar entrenamiento");
const firstTraining = FMG.trainUserSquad(FMG.gameState);
assert.equal(firstTraining.ok, true, "debe entrenar una vez por semana");
const secondTraining = FMG.trainUserSquad(FMG.gameState);
assert.equal(secondTraining.ok, false, "no debe entrenar dos veces la misma semana");

const injuredPlayer = FMG.getMatchSquad(FMG.gameState, "colo-colo")[0];
injuredPlayer.injuredWeeks = 2;
FMG.autoSelectLineup(FMG.gameState, "colo-colo");
assert.ok(!FMG.getMatchSquad(FMG.gameState, "colo-colo").some((player) => player.id === injuredPlayer.id), "lesionados no deben ser titulares");

let advanced = 0;
while (!FMG.gameState.seasonComplete && advanced < 30) {
  const result = FMG.advanceWeek();
  assert.equal(result.ok, true, "la temporada debe avanzar");
  advanced += 1;
}

assert.equal(FMG.gameState.seasonComplete, true, "debe cerrar temporada");
assert.equal(FMG.gameState.seasonHistory.length, 1, "debe registrar historial de temporada");
assert.ok(FMG.gameState.seasonHistory[0].championName, "el historial debe registrar campeon");

const newSeason = FMG.startNewSeason();
assert.equal(newSeason.ok, true, "debe iniciar nueva temporada");
assert.equal(FMG.gameState.seasonNumber, 2, "debe incrementar numero de temporada");
assert.equal(FMG.gameState.seasonComplete, false, "nueva temporada debe quedar activa");
assert.equal(FMG.gameState.completedWeeks, 0, "nueva temporada debe partir sin fechas jugadas");
assert.equal(FMG.gameState.standings.every((entry) => entry.played === 0), true, "tabla debe reiniciarse");
assert.equal(FMG.gameState.market.windowOpen, true, "mercado debe abrir al inicio de temporada");

while (FMG.gameState.currentWeek < 5) {
  FMG.advanceWeek();
}
assert.equal(FMG.gameState.market.windowOpen, false, "mercado debe cerrarse tras las primeras semanas");
assert.equal(FMG.refreshTransferMarket(FMG.gameState).ok, false, "no debe refrescar scouting con mercado cerrado");

console.log("Phase 1 tests passed");
