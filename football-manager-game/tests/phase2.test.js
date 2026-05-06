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

const homeTeam = FMG.gameState.teams[0];
const awayTeam = FMG.gameState.teams[1];
const result = FMG.simulateMatch({ homeTeam, awayTeam, players: FMG.gameState.players, state: FMG.gameState });

assert.ok(FMG.gameState.version >= 3, "fase 2 debe usar estado versionado desde 3");
assert.ok(result.stats, "el partido debe incluir estadisticas");
assert.ok(result.timeline.length > 0, "el partido debe incluir relato minuto a minuto");
assert.ok(Number.isFinite(result.stats.home.xg), "xG local debe ser numerico");
assert.ok(Number.isFinite(result.stats.away.xg), "xG visita debe ser numerico");
assert.equal(result.stats.home.possession + result.stats.away.possession, 100, "posesion debe sumar 100");
assert.equal(result.homeGoals, result.homeEvents.length, "goles locales deben salir de eventos");
assert.equal(result.awayGoals, result.awayEvents.length, "goles visita deben salir de eventos");
assert.ok(result.stats.home.shots >= result.homeGoals, "remates locales deben cubrir goles");
assert.ok(result.stats.away.shots >= result.awayGoals, "remates visita deben cubrir goles");

FMG.applyMatchSquadStats(FMG.gameState, result);
const goalScorers = [...result.homeEvents, ...result.awayEvents].map((event) => event.playerId);
goalScorers.forEach((playerId) => {
  const player = FMG.gameState.players.find((item) => item.id === playerId);
  assert.ok(player.seasonStats.goals > 0, "los goleadores deben sumar goles en temporada");
});

let totalGoals = 0;
let totalShots = 0;
let totalTimeline = 0;
const sampleMatches = 220;
for (let index = 0; index < sampleMatches; index += 1) {
  const home = FMG.gameState.teams[index % FMG.gameState.teams.length];
  const away = FMG.gameState.teams[(index + 2) % FMG.gameState.teams.length];
  const sampled = FMG.simulateMatch({ homeTeam: home, awayTeam: away, players: FMG.gameState.players, state: FMG.gameState });
  totalGoals += sampled.homeGoals + sampled.awayGoals;
  totalShots += sampled.stats.home.shots + sampled.stats.away.shots;
  totalTimeline += sampled.timeline.length;
}

const averageGoals = totalGoals / sampleMatches;
const averageShots = totalShots / sampleMatches;
const averageTimeline = totalTimeline / sampleMatches;
assert.ok(averageGoals >= 1.5 && averageGoals <= 4.2, `promedio de goles fuera de rango: ${averageGoals}`);
assert.ok(averageShots >= 12 && averageShots <= 34, `promedio de remates fuera de rango: ${averageShots}`);
assert.ok(averageTimeline >= 12, `relato demasiado pobre: ${averageTimeline}`);

console.log("Phase 2 tests passed");
