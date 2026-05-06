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

assert.ok(FMG.gameState.version >= 7, "fase 7 debe usar estado versionado desde 7");
assert.ok(FMG.gameState.rivalAI, "debe existir estado IA rival");
assert.ok(Object.keys(FMG.gameState.rivalAI.budgets).length >= FMG.gameState.teams.length, "IA debe presupuestar clubes");

const rivalId = "u-de-chile";
const needs = FMG.getRivalSquadNeeds(FMG.gameState, rivalId);
assert.equal(needs.teamId, rivalId, "debe calcular necesidades por club");
assert.ok(needs.squadSize > 0, "necesidades deben leer plantilla real");
assert.ok(needs.targetPosition, "debe elegir posicion objetivo");

const rivalPlan = FMG.getTeamPlan(FMG.gameState, rivalId);
rivalPlan.lineup = FMG.getMatchSquad(FMG.gameState, rivalId).map((player) => player.id);
const tired = FMG.gameState.players.find((player) => player.teamId === rivalId && rivalPlan.lineup.includes(player.id));
tired.energy = 20;
const prepActions = FMG.runRivalAIWeek(FMG.gameState, { beforeMatches: true });
assert.ok(prepActions.some((action) => action.teamId === rivalId), "IA debe preparar partidos");
assert.ok(FMG.gameState.rivalAI.log.some((entry) => entry.title === "Rotacion" || entry.title === "Ajuste tactico"), "IA debe registrar preparacion");

const expiring = FMG.gameState.players.find((player) => player.teamId === rivalId && player.overall >= 70);
expiring.contractYears = 1;
const budgetBefore = FMG.gameState.rivalAI.budgets[rivalId];
FMG.runRivalAIWeek(FMG.gameState, { afterMatches: true });
assert.ok(expiring.contractYears > 1 || FMG.gameState.rivalAI.budgets[rivalId] <= budgetBefore, "IA debe intentar renovar contratos importantes");

const freeAgent = FMG.gameState.players.find((player) => player.teamId !== FMG.gameState.userTeamId && player.teamId !== rivalId && !player.retired);
freeAgent.teamId = "free-agent";
freeAgent.contractYears = 0;
freeAgent.position = needs.targetPosition;
freeAgent.overall = 79;
freeAgent.value = 4000000;
FMG.gameState.rivalAI.budgets[rivalId] = 100000000;
let marketMoved = false;
for (let index = 0; index < 12 && !marketMoved; index += 1) {
  FMG.runRivalAIWeek(FMG.gameState, { afterMatches: true });
  marketMoved = freeAgent.teamId === rivalId || FMG.gameState.market.transferHistory.some((entry) => entry.type.startsWith("ai-"));
}
assert.equal(marketMoved, true, "IA rival debe poder fichar en mercado");
assert.ok(FMG.gameState.market.transferHistory.some((entry) => entry.type.startsWith("ai-")), "movimientos IA deben quedar en historial");
assert.ok(FMG.gameState.rivalAI.log.some((entry) => entry.title === "Agente libre" || entry.title === "Compra rival" || entry.title === "Venta rival"), "movimientos IA deben quedar en log");

let advanced = 0;
while (advanced < 3) {
  const result = FMG.advanceWeek();
  assert.equal(result.ok, true, "la temporada debe avanzar con IA rival activa");
  advanced += 1;
}
assert.ok(FMG.gameState.rivalAI.log.length > 0, "avance semanal debe ejecutar IA rival");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar IA rival");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 6;
delete parsed.rivalAI;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin IA");
assert.ok(FMG.gameState.version >= 7, "save debe migrar a version 7 o superior");
assert.ok(FMG.gameState.rivalAI.budgets, "save migrado debe crear presupuestos IA");

console.log("Phase 7 tests passed");
