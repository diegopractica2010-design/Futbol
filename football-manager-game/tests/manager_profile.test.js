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

assert.ok(FMG.gameState.version >= 10, "fase 10 debe usar estado versionado desde 10");
assert.ok(FMG.gameState.managerProfile, "debe existir perfil del manager");
assert.ok(FMG.gameState.career, "debe existir carrera");
assert.ok(FMG.gameState.career.objectives.length >= 4, "debe crear objetivos del directorio al tomar club");
assert.ok(Number.isFinite(FMG.gameState.career.reputation), "debe tener reputacion numerica");

const reputationBeforeWin = FMG.gameState.career.reputation;
FMG.recordCareerMatchImpact(FMG.gameState, {
  homeTeamId: FMG.gameState.userTeamId,
  awayTeamId: "u-catolica",
  homeGoals: 3,
  awayGoals: 0
});
assert.ok(FMG.gameState.career.reputation > reputationBeforeWin, "ganar debe subir reputacion");
assert.equal(FMG.gameState.career.record.wins, 1, "victoria debe quedar en historial de carrera");
assert.ok(FMG.gameState.career.achievements.some((achievement) => achievement.id === "first-win"), "primera victoria debe desbloquear logro");

const reputationBeforeLoss = FMG.gameState.career.reputation;
FMG.recordCareerMatchImpact(FMG.gameState, {
  homeTeamId: FMG.gameState.userTeamId,
  awayTeamId: "u-catolica",
  homeGoals: 0,
  awayGoals: 4
});
assert.ok(FMG.gameState.career.reputation < reputationBeforeLoss, "perder debe bajar reputacion");
assert.equal(FMG.gameState.career.record.losses, 1, "derrota debe quedar en historial de carrera");

const spendingBefore = FMG.gameState.career.spendingThisSeason;
FMG.recordCareerTransferImpact(FMG.gameState, { type: "purchase", amount: 50000000 });
assert.ok(FMG.gameState.career.spendingThisSeason > spendingBefore, "gastar en fichajes debe impactar carrera");
const developmentBefore = FMG.gameState.career.developedPlayersThisSeason;
FMG.recordCareerDevelopment(FMG.gameState, 2, "Test desarrollo");
assert.equal(FMG.gameState.career.developedPlayersThisSeason, developmentBefore + 2, "desarrollar jugadores debe impactar carrera");

FMG.gameState.standings = FMG.gameState.standings.map((entry, index) => ({
  ...entry,
  points: entry.teamId === FMG.gameState.userTeamId ? 0 : 40 - index,
  goalDifference: entry.teamId === FMG.gameState.userTeamId ? -30 : 12 - index
}));
FMG.gameState.standings = FMG.sortStandings(FMG.gameState.standings);
FMG.gameState.career.spendingThisSeason = 999999999;
FMG.gameState.career.transferProfitThisSeason = 0;
FMG.gameState.career.developedPlayersThisSeason = 0;
FMG.gameState.career.relations.fans = 10;
FMG.gameState.career.relations.players = 10;
FMG.gameState.career.relations.press = 10;
FMG.gameState.finances.boardTrust = 10;
const evaluation = FMG.evaluateBoardObjectives(FMG.gameState, { seasonEnd: true });
assert.ok(evaluation.score < 45, "objetivos fallidos deben dar evaluacion baja");
assert.equal(FMG.gameState.career.status, "sacked", "evaluacion critica debe despedir al manager");
assert.ok(FMG.gameState.career.sackingHistory.length > 0, "despido debe quedar registrado");
assert.ok(FMG.gameState.career.offers.length > 0, "despido debe generar ofertas de otros clubes");

const pendingOffer = FMG.gameState.career.offers.find((offer) => offer.status === "pending");
const oldTeamId = FMG.gameState.userTeamId;
const accepted = FMG.acceptCareerOffer(FMG.gameState, pendingOffer.id);
assert.equal(accepted.ok, true, "debe aceptar oferta tras despido");
assert.notEqual(FMG.gameState.userTeamId, oldTeamId, "aceptar oferta debe cambiar de club");
assert.equal(FMG.gameState.career.status, "employed", "tras aceptar oferta debe volver a estar empleado");
assert.ok(FMG.gameState.career.objectives.length >= 4, "nuevo club debe crear objetivos propios");

const decision = FMG.createNarrativeDecision(FMG.gameState, "academy");
const playersRelationBefore = FMG.gameState.career.relations.players;
const resolved = FMG.resolveNarrativeDecision(FMG.gameState, decision.id, "promote");
assert.equal(resolved.ok, true, "debe resolver decisiones narrativas");
assert.ok(FMG.gameState.career.relations.players >= playersRelationBefore, "decision narrativa debe tener consecuencias en relaciones");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar carrera");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 9;
delete parsed.managerProfile;
delete parsed.career;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin carrera");
assert.ok(FMG.gameState.version >= 10, "save debe migrar a version 10 o superior");
assert.ok(FMG.gameState.managerProfile, "save migrado debe crear perfil");
assert.ok(FMG.gameState.career, "save migrado debe crear carrera");

console.log("Phase 10 tests passed");
