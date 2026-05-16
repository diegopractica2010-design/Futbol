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
  "src/worldMediaPressure.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const world = FMG.ensureFootballWorldMediaState(FMG.gameState);
assert.ok(world.media.pundits.length >= 4, "pundit personalities should be initialized");
assert.ok(world.clubs["colo-colo"], "club fan identity should be initialized");
assert.ok(Number.isFinite(world.fans.pressure), "fan pressure should be numeric");
assert.ok(Number.isFinite(world.sponsors.relationship), "sponsor relationship should be numeric");

FMG.gameState.currentWeek = 9;
const first = FMG.runFootballWorldMediaWeek(FMG.gameState, { phase: "test" });
assert.ok(first.headline, "weekly world media should create a procedural headline");
assert.ok(first.storyline, "weekly world media should create a storyline");
assert.ok(first.reaction, "weekly world media should create a world reaction");
assert.ok(world.media.headlineMemory.length > 0, "headline memory should persist");
assert.ok(world.narratives.manager.length > 0, "manager narrative should persist");
assert.ok(world.history.events.length > 0, "world history should persist");
assert.ok(FMG.gameState.worldNews.items.some((item) => item.type === "world-reaction"), "world media should publish readable news");

const historyCount = world.history.events.length;
const headlineCount = world.media.headlineMemory.length;
FMG.runFootballWorldMediaWeek(FMG.gameState, { phase: "test" });
assert.equal(world.media.headlineMemory.length, headlineCount, "same-week headlines should upsert");
assert.equal(world.history.events.length, historyCount, "same-week world hooks should upsert");

const result = {
  week: FMG.gameState.currentWeek,
  homeTeamId: "colo-colo",
  awayTeamId: "u-de-chile",
  homeGoals: 0,
  awayGoals: 2,
  homeEvents: [],
  awayEvents: [{ minute: 19, scorer: "Rival Directo", playerId: "rival", xg: 0.3 }],
  stats: { home: { shotsOnTarget: 2, xg: 0.4 }, away: { shotsOnTarget: 7, xg: 1.9 } },
  cards: [{ minute: 76, teamId: "colo-colo", playerId: "test", playerName: "Jugador Test", color: "red" }],
  injuries: [],
  timeline: []
};
FMG.generatePostMatchNews(FMG.gameState, result);
assert.ok(world.media.reactions.some((item) => item.type === "fan-reaction"), "post-match should create persistent fan reactions");
assert.ok(world.history.rivalries.length > 0, "classic matches should persist rivalry escalation");
assert.ok(world.media.debates.length > 0, "post-match pressure should create football debates");
assert.ok(world.history.myths.length >= 0, "myth foundations should be present");

const legacy = FMG.deepClone(FMG.gameState);
delete legacy.managerEcosystem.worldMedia;
const migrated = FMG.migrateSaveState(legacy);
FMG.ensureFootballWorldMediaState(migrated);
assert.ok(migrated.managerEcosystem.worldMedia, "save migration should hydrate world media state");
assert.ok(migrated.managerEcosystem.worldMedia.clubs["colo-colo"], "migrated world media should retain club identity");

console.log("World media pressure tests passed");
