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
  "src/playerProgression.js",
  "src/playerProgressionIntegration.js",
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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const psych = FMG.ensureSquadPsychologyState(FMG.gameState);
assert.ok(psych.players, "psychology player records should exist");
assert.ok(Object.keys(psych.players).length > 0, "squad players should receive psychology records");
assert.ok(Number.isFinite(psych.chemistry.cohesion), "cohesion should be numeric");
assert.ok(psych.hierarchy.length > 0, "emotional hierarchy should be calculated");

FMG.gameState.currentWeek = 4;
const weekly = FMG.runManagerEcosystemWeek(FMG.gameState, { phase: "psych-test" });
assert.ok(weekly.psychology, "weekly ecosystem should include psychology layer");
assert.ok(Object.keys(psych.relationships).length > 0, "relationship graph should be updated");
assert.ok(Number.isFinite(psych.manager.pressure), "manager pressure should be numeric");

const captain = FMG.gameState.players.find((player) => player.teamId === FMG.gameState.userTeamId && !player.retired);
const beforeMemory = psych.memory.length;
const captainResult = FMG.setCaptain(FMG.gameState, captain.id);
assert.equal(captainResult.ok, true, "captaincy should still work");
assert.ok(psych.memory.length > beforeMemory, "captaincy should create emotional memory");
assert.ok(psych.players[captain.id].managerTrust > 50, "captaincy should improve manager-player trust");

const roleResult = FMG.setSquadRole(FMG.gameState, captain.id, "key");
assert.equal(roleResult.ok, true, "role changes should still work");
assert.ok(psych.events.some((event) => event.type === "role-change"), "role changes should create emotional events");

const contractResult = FMG.renewPlayerContract(FMG.gameState, captain.id, { role: "key", years: 3, wage: captain.salary * 3 });
assert.equal(contractResult.ok, true, "contract renewal should still work");
assert.ok(psych.memory.some((event) => event.type === "contract"), "contract renewal should create trust memory");

const result = {
  week: FMG.gameState.currentWeek,
  homeTeamId: "colo-colo",
  awayTeamId: "u-de-chile",
  homeGoals: 0,
  awayGoals: 3,
  homeEvents: [],
  awayEvents: [{ minute: 11, scorer: "Rival Directo", playerId: "rival", xg: 0.4 }],
  stats: { home: { shotsOnTarget: 2, xg: 0.5 }, away: { shotsOnTarget: 8, xg: 2.2 } },
  cards: [],
  injuries: [],
  timeline: []
};
FMG.generatePostMatchNews(FMG.gameState, result);
assert.ok(psych.memory.some((event) => event.type === "loss"), "post-match loss should create emotional memory");
assert.ok(Number.isFinite(psych.chemistry.conflict), "post-match chemistry should stay numeric");

const legacy = FMG.deepClone(FMG.gameState);
delete legacy.psychology;
const migrated = FMG.migrateSaveState(legacy);
FMG.ensureSquadPsychologyState(migrated);
assert.ok(migrated.psychology, "save migration should hydrate psychology state");
assert.ok(migrated.psychology.hierarchy.length > 0, "migrated psychology should rebuild hierarchy");

console.log("Squad psychology tests passed");
