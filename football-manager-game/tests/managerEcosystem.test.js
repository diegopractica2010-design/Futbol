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
  "src/matchEngine.js",
  "src/finances.js",
  "src/events.js",
  "src/transfers.js",
  "src/career.js",
  "src/news.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/managerEcosystem.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const ecosystem = FMG.gameState.managerEcosystem;
assert.ok(ecosystem, "ecosystem state should be created on club selection");
assert.ok(ecosystem.clubs["colo-colo"], "selected club should have identity state");
assert.ok(ecosystem.culture.country, "country football culture should be initialized");
assert.ok(ecosystem.media.journalists.length >= 3, "media should include journalists");
assert.ok(ecosystem.scouting.networks.length >= 3, "scouting networks should be initialized");
assert.ok(ecosystem.squad.hierarchy.length > 0, "squad hierarchy should be calculated");
assert.ok(Number.isFinite(ecosystem.squad.dressingRoom.atmosphere), "dressing room atmosphere should be numeric");

FMG.gameState.currentWeek = 6;
const firstRun = FMG.runManagerEcosystemWeek(FMG.gameState, { phase: "test" });
assert.ok(firstRun.conference, "even weeks should produce a press conference state");
assert.ok(firstRun.report, "scouting should produce a weekly report on week 6");
assert.ok(firstRun.youth.length > 0, "youth intake should produce prospects on week 6");
assert.ok(ecosystem.worldMemory.events.some((event) => event.id && event.type === "ecosystem-week" && event.phase === "test"), "world memory should store deterministic weekly hooks");
assert.ok(ecosystem.media.rumors.length > 0, "media should produce contextual rumors");
assert.ok(ecosystem.youth.generated.length > 0, "youth system should store generated prospects");
assert.ok(Number.isFinite(ecosystem.manager.pressure), "manager pressure should stay numeric");
assert.ok(Number.isFinite(ecosystem.manager.burnout), "manager burnout should stay numeric");

const memoryCount = ecosystem.worldMemory.events.length;
const reportCount = ecosystem.scouting.reports.length;
const rumorCount = ecosystem.media.rumors.length;
FMG.runManagerEcosystemWeek(FMG.gameState, { phase: "test" });
assert.equal(ecosystem.worldMemory.events.length, memoryCount, "same-week world memory should upsert instead of duplicating");
assert.equal(ecosystem.scouting.reports.length, reportCount, "same-week scout reports should upsert instead of duplicating");
assert.equal(ecosystem.media.rumors.length, rumorCount, "same-week rumors should upsert instead of duplicating");

const legacy = FMG.deepClone(FMG.gameState);
delete legacy.managerEcosystem;
const migrated = FMG.migrateSaveState(legacy);
assert.ok(migrated.managerEcosystem, "save migration should hydrate manager ecosystem state");
assert.ok(migrated.managerEcosystem.clubs["colo-colo"], "migrated ecosystem should retain club identity");

FMG.gameState.market.windowOpen = true;
FMG.buildTransferMarket(FMG.gameState);
const target = FMG.gameState.players.find((player) => player.teamId !== FMG.gameState.userTeamId && !player.retired);
const offer = FMG.createTransferOffer(FMG.gameState, target.id, { transferType: "buy" });
assert.equal(offer.ok, true, "transfer offer should be created");
assert.ok(offer.negotiation.agent, "agent context should be attached to negotiations");
assert.ok(offer.negotiation.promises.length > 0, "contract promise context should be attached to negotiations");

console.log("Manager ecosystem tests passed");
