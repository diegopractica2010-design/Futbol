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

FMG.validateSeedData(teams, players);
FMG.initializeGame(teams, players);

assert.equal(FMG.gameState.teams.length, 7, "debe cargar siete equipos");
assert.equal(FMG.gameState.fixtures.length, 14, "la liga ida/vuelta debe tener catorce semanas con siete equipos");
assert.equal(FMG.gameState.players.length, 126, "cada equipo debe quedar con dieciocho jugadores tras completar planteles");

FMG.selectClub("colo-colo");
assert.equal(FMG.gameState.selectionMode, false, "seleccionar club debe salir del selector");
assert.ok(FMG.gameState.finances.balance > 0, "el club debe recibir presupuesto inicial");
assert.ok(FMG.gameState.market.listings.length > 0, "el mercado debe generarse al seleccionar club");

let sampledGoals = 0;
const sampleMatches = 500;
for (let index = 0; index < sampleMatches; index += 1) {
  const homeTeam = FMG.gameState.teams[index % FMG.gameState.teams.length];
  const awayTeam = FMG.gameState.teams[(index + 1) % FMG.gameState.teams.length];
  const result = FMG.simulateMatch({ homeTeam, awayTeam, players: FMG.gameState.players });
  sampledGoals += result.homeGoals + result.awayGoals;
}

const averageGoals = sampledGoals / sampleMatches;
assert.ok(averageGoals >= 1.4 && averageGoals <= 3.8, `promedio de goles fuera de rango: ${averageGoals}`);

let guard = 0;
while (!FMG.gameState.seasonComplete && guard < 30) {
  const result = FMG.advanceWeek();
  assert.equal(result.ok, true, "cada fecha pendiente debe poder simularse");
  guard += 1;
}

assert.equal(FMG.gameState.seasonComplete, true, "la temporada debe marcarse como completada");
assert.ok(FMG.gameState.champion, "la temporada debe declarar campeon");
assert.equal(FMG.gameState.fixtures.filter((fixture) => !fixture.played).length, 0, "no deben quedar fechas pendientes");
assert.ok(FMG.gameState.finances.balance < 1000000000, "el balance no debe crecer hasta cifras absurdas en una temporada");

const saveResult = FMG.saveGame();
assert.equal(saveResult.ok, true, "guardar partida debe devolver ok");
const loadResult = FMG.loadGame();
assert.equal(loadResult.ok, true, "cargar partida guardada debe devolver ok");

localStorage.data[FMG.STORAGE_KEY] = "{bad json";
const brokenLoad = FMG.loadGame();
assert.equal(brokenLoad.ok, false, "una partida corrupta no debe romper la app");

console.log("Phase 0 tests passed");
