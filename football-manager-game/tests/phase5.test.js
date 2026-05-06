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

assert.ok(FMG.gameState.version >= 5, "fase 5 debe usar estado versionado desde 5");

const player = FMG.gameState.players.find((item) => item.teamId === "colo-colo");
assert.ok(player.attributes, "jugador debe tener atributos detallados");
["speed", "passing", "shooting", "defense", "physical", "technique", "mentality"].forEach((key) => {
  assert.ok(Number.isFinite(player.attributes[key]), `atributo ${key} debe existir`);
});
assert.ok(Number.isFinite(player.leadership), "jugador debe tener liderazgo");
assert.ok(FMG.SQUAD_ROLES[player.squadRole], "jugador debe tener rol de plantilla");
assert.ok(Array.isArray(player.moraleLog), "jugador debe tener historial de moral");
assert.ok(Array.isArray(player.injuryHistory), "jugador debe tener historial medico");

assert.equal(FMG.setSquadRole(FMG.gameState, player.id, "key").ok, true, "debe cambiar rol de plantilla");
assert.equal(player.squadRole, "key", "rol de plantilla debe quedar guardado");
assert.equal(FMG.setCaptain(FMG.gameState, player.id).ok, true, "debe nombrar capitan");
assert.equal(FMG.getTeamPlan(FMG.gameState, "colo-colo").captainId, player.id, "capitan debe quedar guardado");
assert.equal(FMG.selectSquadPlayer(FMG.gameState, player.id).ok, true, "debe abrir ficha de jugador");
assert.equal(FMG.gameState.squadView.selectedPlayerId, player.id, "ficha seleccionada debe quedar en estado");
assert.equal(FMG.setSquadView(FMG.gameState, "filter", "MED").ok, true, "debe filtrar plantilla");
assert.equal(FMG.setSquadView(FMG.gameState, "sort", "minutes").ok, true, "debe ordenar plantilla");

const homeTeam = FMG.gameState.teams.find((team) => team.id === "colo-colo");
const awayTeam = FMG.gameState.teams.find((team) => team.id === "u-de-chile");
const starter = FMG.getMatchSquad(FMG.gameState, "colo-colo")[0];
const result = FMG.simulateMatch({ homeTeam, awayTeam, players: FMG.gameState.players, state: FMG.gameState });
result.week = FMG.gameState.currentWeek;
FMG.applyMatchSquadStats(FMG.gameState, result);
assert.ok(starter.seasonStats.minutes >= 90, "titular debe sumar minutos");
assert.ok(starter.seasonStats.starts >= 1, "titular debe sumar titularidad");

const injured = FMG.getMatchSquad(FMG.gameState, "colo-colo")[1];
FMG.applyMatchSquadStats(FMG.gameState, {
  homeTeamId: "colo-colo",
  awayTeamId: "u-de-chile",
  homeGoals: 0,
  awayGoals: 0,
  homeEvents: [],
  awayEvents: [],
  cards: [],
  injuries: [{ playerId: injured.id, duration: 3 }],
  timeline: [],
  week: 2
});
assert.equal(injured.injuredWeeks, 3, "lesion debe aplicar semanas fuera");
assert.ok(injured.injuryHistory.length > 0, "lesion debe guardarse en historial medico");

const unhappy = FMG.gameState.players.find((item) => item.teamId === "colo-colo" && item.id !== starter.id);
unhappy.squadRole = "key";
unhappy.seasonStats.starts = 0;
unhappy.happiness = 80;
FMG.gameState.completedWeeks = 6;
FMG.updateSquadHappiness(FMG.gameState);
assert.ok(unhappy.happiness < 80, "figura sin minutos debe bajar felicidad");
assert.equal(unhappy.moraleReason, "Quiere mas minutos", "debe explicar baja de moral");

const prospect = FMG.gameState.players.find((item) => item.teamId === "colo-colo" && item.age <= 24) || starter;
prospect.age = 21;
prospect.overall = 60;
prospect.potential = 75;
prospect.seasonStats.minutes = 2600;
let grew = false;
for (let index = 0; index < 20 && !grew; index += 1) {
  const before = prospect.overall;
  FMG.progressPlayersForNewSeason(FMG.gameState);
  grew = prospect.overall > before;
}
assert.equal(grew, true, "juvenil con minutos debe poder progresar");

const veteran = FMG.gameState.players.find((item) => item.teamId === "colo-colo" && !item.retired);
veteran.age = 41;
let retired = [];
for (let index = 0; index < 20 && !veteran.retired; index += 1) {
  retired = FMG.progressPlayersForNewSeason(FMG.gameState);
}
assert.equal(veteran.retired, true, "veterano debe poder retirarse");
assert.ok(retired.some((item) => item.id === veteran.id) || FMG.gameState.eventsLog.some((entry) => entry.title === "Retiro profesional"), "retiro debe registrarse");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar datos avanzados de jugador");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 4;
delete parsed.squadView;
delete parsed.players[0].attributes;
delete parsed.players[0].squadRole;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save de fase anterior");
assert.ok(FMG.gameState.version >= 5, "save debe migrar a version 5 o superior");
assert.ok(FMG.gameState.players[0].attributes, "save migrado debe reconstruir atributos");
assert.ok(FMG.gameState.squadView, "save migrado debe crear vista de plantilla");

console.log("Phase 5 tests passed");
