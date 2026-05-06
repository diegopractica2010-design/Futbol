const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; }
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

assert.equal(FMG.gameState.version, 8, "fase 8 debe usar estado version 8");
assert.ok(FMG.gameState.competitions, "debe existir estado de competencias");
assert.ok(FMG.gameState.competitions.rankings, "debe existir estado de rankings");

let guard = 0;
while (!FMG.gameState.seasonComplete && guard < 40) {
  const result = FMG.advanceWeek();
  assert.equal(result.ok, true, "la temporada debe avanzar hasta cerrar competencias");
  guard += 1;
}

assert.equal(FMG.gameState.seasonComplete, true, "temporada debe quedar cerrada");
assert.ok(FMG.gameState.competitions.nationalCup?.championTeamId, "copa nacional debe tener campeon");
assert.ok(FMG.gameState.competitions.nationalCup.rounds.length > 0, "copa nacional debe guardar rondas");
assert.ok(FMG.gameState.competitions.international?.championTeamId, "copa internacional debe tener campeon");
assert.ok(FMG.gameState.competitions.qualification.length === FMG.gameState.standings.length, "debe registrar clasificacion por tabla");
assert.ok(FMG.gameState.competitions.qualification.some((entry) => entry.competition === "Copa Libertadores"), "campeon debe clasificar a copa principal");
assert.ok(FMG.gameState.competitions.relegation?.relegatedTeamId, "debe registrar descenso");
assert.ok(FMG.gameState.competitions.relegation?.promotedTeamName, "debe registrar ascenso sintetico");
assert.ok(FMG.gameState.competitions.prizeLog.length > 0, "debe pagar premios de temporada");
assert.ok(Array.isArray(FMG.gameState.competitions.rankings.scorers), "debe calcular ranking de goleadores");
assert.ok(Array.isArray(FMG.gameState.competitions.rankings.shooters), "debe calcular ranking de rematadores");
assert.ok(Array.isArray(FMG.gameState.competitions.rankings.cards), "debe calcular ranking de tarjetas");
assert.ok(Array.isArray(FMG.gameState.competitions.rankings.keepers), "debe calcular ranking de arqueros");
assert.ok(FMG.gameState.seasonHistory[0].cupChampionName, "historial debe guardar campeon de copa");
assert.ok(FMG.gameState.seasonHistory[0].internationalChampionName, "historial debe guardar campeon internacional");

const newSeason = FMG.startNewSeason();
assert.equal(newSeason.ok, true, "debe iniciar nueva temporada tras cierre");
assert.ok(FMG.gameState.competitions.superCup?.championTeamId, "supercopa debe jugarse al iniciar nueva temporada");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar competencias");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 7;
delete parsed.competitions;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin competencias");
assert.equal(FMG.gameState.version, 8, "save debe migrar a version 8");
assert.ok(FMG.gameState.competitions.rankings, "save migrado debe crear rankings");

console.log("Phase 8 tests passed");
