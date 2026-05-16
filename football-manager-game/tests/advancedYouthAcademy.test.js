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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const academy = FMG.ensureFootballGenerationState(FMG.gameState);
assert.ok(academy.academies["colo-colo"], "selected club academy should be initialized");
assert.ok(academy.academies["colo-colo"].philosophy, "academy philosophy should exist");
assert.ok(academy.culture.tacticalInfluence, "football culture inheritance should be initialized");

FMG.gameState.currentWeek = 5;
const beforePlayers = FMG.gameState.players.length;
const weekly = FMG.runFootballGenerationWeek(FMG.gameState, { phase: "test" });
assert.ok(weekly.academy, "weekly generation layer should return academy state");
assert.ok(FMG.gameState.players.length >= beforePlayers, "weekly academy should keep or increase player count");
assert.ok(academy.prospects.some((item) => item.teamId === "colo-colo"), "weekly emergence should track prospects");
assert.ok(academy.narratives.length > 0, "prospect narratives should be generated");

const retired = FMG.gameState.players.find((player) => player.teamId === "colo-colo" && !player.retired);
retired.retired = true;
retired.retiredSeason = FMG.gameState.seasonNumber;
retired.age = 38;
retired.overall = 78;
retired.potential = 82;
const rollover = FMG.runFootballGenerationSeasonRollover(FMG.gameState, { retired: [retired] });
assert.ok(rollover.regens.length >= 1, "retired players should produce regen foundations");
const regen = rollover.regens[0];
assert.ok(regen.lineageParentId === retired.id, "regen should retain parent lineage");
assert.ok(academy.regens.some((item) => item.playerId === regen.id), "regen record should persist");
assert.ok(academy.lineages.some((item) => item.playerId === regen.id && item.parentPlayerId === retired.id), "lineage should connect regen and retired player");
assert.ok(academy.dynasties.length > 0, "dynasty foundations should be tracked");
assert.ok(["wonderkid", "late-bloomer", "prospect", "late-bloomer-risk"].includes(regen.developmentState), "regen should have generation identity");

const playerCountAfterRollover = FMG.gameState.players.length;
FMG.runFootballGenerationSeasonRollover(FMG.gameState, { retired: [retired] });
assert.equal(FMG.gameState.players.length, playerCountAfterRollover, "same rollover should not duplicate deterministic regens");

const legacy = FMG.deepClone(FMG.gameState);
delete legacy.youthAcademy;
const migrated = FMG.migrateSaveState(legacy);
FMG.ensureFootballGenerationState(migrated);
assert.ok(migrated.youthAcademy, "save migration should hydrate youth academy state");
assert.ok(migrated.youthAcademy.academies[migrated.userTeamId], "migrated academy should retain selected club identity");

console.log("Advanced youth academy tests passed");
