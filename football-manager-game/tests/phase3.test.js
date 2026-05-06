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

let guard = 0;
while (!FMG.getUpcomingFixture().some((match) => match.homeTeamId === FMG.gameState.userTeamId || match.awayTeamId === FMG.gameState.userTeamId) && guard < 8) {
  const restWeek = FMG.advanceWeek();
  assert.equal(restWeek.ok, true, "debe poder avanzar semanas de descanso antes del partido en vivo");
  guard += 1;
}

const initialWeek = FMG.gameState.currentWeek;
const completedBeforeLive = FMG.gameState.completedWeeks;
const start = FMG.startLiveUserMatch();
assert.equal(start.ok, true, "debe iniciar partido en vivo del usuario");
assert.ok(FMG.gameState.liveMatch, "el estado debe guardar el partido en vivo");
assert.equal(FMG.gameState.liveMatch.minute, 0, "el partido debe partir en minuto cero");
assert.equal(FMG.gameState.liveMatch.result.stats.home.possession + FMG.gameState.liveMatch.result.stats.away.possession, 100, "posesion inicial debe sumar 100");

const liveMatch = FMG.gameState.liveMatch;
const userSide = liveMatch.homeTeamId === FMG.gameState.userTeamId ? "home" : "away";
const lineupKey = userSide === "home" ? "homeLineupIds" : "awayLineupIds";
const benchKey = userSide === "home" ? "homeBenchIds" : "awayBenchIds";
const outPlayerId = liveMatch[lineupKey][0];
const inPlayerId = liveMatch[benchKey][0];
const sub = FMG.makeLiveSubstitution(outPlayerId, inPlayerId);
assert.equal(sub.ok, true, "debe permitir cambios durante el partido");
assert.ok(FMG.gameState.liveMatch[lineupKey].includes(inPlayerId), "el suplente debe entrar a la cancha");
assert.equal(FMG.gameState.liveMatch.substitutions[userSide], 1, "debe contar el cambio usado");

assert.equal(FMG.applyLiveTacticalShift("attack").ok, true, "debe permitir ajuste tactico ofensivo");
assert.equal(FMG.setLiveMatchSpeed(10).ok, true, "debe permitir cambiar velocidad");
assert.equal(FMG.gameState.liveMatch.speed, 10, "la velocidad debe quedar guardada");

const advance = FMG.advanceLiveUserMatch(15);
assert.equal(advance.ok, true, "debe avanzar el partido en vivo");
assert.equal(FMG.gameState.liveMatch.minute, 15, "debe avanzar hasta el minuto solicitado");
assert.equal(FMG.gameState.liveMatch.result.stats.home.possession + FMG.gameState.liveMatch.result.stats.away.possession, 100, "posesion en vivo debe sumar 100");

const blockedWeek = FMG.advanceWeek();
assert.equal(blockedWeek.ok, false, "no debe simular fecha mientras hay partido en vivo");

const finishSimulation = FMG.advanceLiveUserMatch(90);
assert.equal(finishSimulation.ok, true, "debe simular hasta el final");
assert.equal(FMG.gameState.liveMatch.completed, true, "el partido debe quedar completado");
assert.equal(FMG.gameState.liveMatch.result.homeGoals, FMG.gameState.liveMatch.result.homeEvents.length, "goles locales deben salir de eventos en vivo");
assert.equal(FMG.gameState.liveMatch.result.awayGoals, FMG.gameState.liveMatch.result.awayEvents.length, "goles visita deben salir de eventos en vivo");

const close = FMG.finishLiveUserMatch();
assert.equal(close.ok, true, "debe cerrar fecha despues del partido en vivo");
assert.equal(FMG.gameState.liveMatch, null, "el partido en vivo debe limpiarse al cerrar fecha");
assert.equal(FMG.gameState.completedWeeks, completedBeforeLive + 1, "debe registrar la fecha jugada");
assert.ok(FMG.gameState.currentMatch, "el ultimo partido del usuario debe quedar guardado");
assert.equal(FMG.gameState.fixtures.find((fixture) => fixture.week === initialWeek).played, true, "la fecha debe quedar marcada como jugada");

console.log("Phase 3 tests passed");
