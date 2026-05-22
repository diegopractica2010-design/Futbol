const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
global.window = {};
global.localStorage = {
  data: {},
  setItem(k, v) { this.data[k] = v; },
  getItem(k) { return this.data[k] || null; },
  removeItem(k) { delete this.data[k]; }
};

const FILES = [
  "src/utils.js",
  "src/gameState.js",
  "src/table.js",
  "src/squad.js",
  "src/matchEngine.js",
  "src/finances.js",
  "src/events.js",
  "src/seasonDrama.js",
  "src/liveChallenges.js",
  "src/transfers.js",
  "src/career.js",
  "src/news.js",
  "src/rivalries.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/gameEngine.js",
  "src/playerMode.js"
];

FILES.forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
const state = FMG.gameState;

(function () {
  const result = FMG.createPlayerModeCareer(state, { name: "Tomas Rojas", archetype: "winger", clubId: "colo-colo" });
  assert.ok(result.ok, "createPlayerModeCareer should succeed");
  assert.ok(state.playerMode.created, "player mode should be marked created");
  assert.equal(state.playerMode.player.position, "EXT", "winger should create EXT player");
  assert.ok(state.playerMode.objectives.length >= 3, "career should create objectives");
  console.log("  1. createPlayerModeCareer: created EXT prospect PASS");
})();

(function () {
  const before = state.playerMode.player.overall;
  const train = FMG.trainPlayerMode(state, "athletic");
  assert.ok(train.ok, "training should succeed");
  assert.ok(state.playerMode.player.overall >= before, "training should not reduce OVR");
  assert.ok(state.playerMode.xp >= 12, "training should add XP");
  console.log("  2. trainPlayerMode: OVR " + before + " -> " + state.playerMode.player.overall + " PASS");
})();

(function () {
  const played = FMG.advancePlayerModeWeek(state);
  assert.ok(played.ok, "advancePlayerModeWeek should succeed");
  assert.equal(state.playerMode.matches.length, 1, "one player match should be logged");
  assert.ok(Number.isFinite(state.playerMode.matches[0].rating), "match rating should be finite");
  assert.ok(state.playerMode.week === 2, "week should advance");
  console.log("  3. advancePlayerModeWeek: " + state.playerMode.matches[0].headline + " PASS");
})();

(function () {
  state.playerMode.decisions = [];
  for (let i = 0; i < 4; i += 1) FMG.advancePlayerModeWeek(state);
  const decision = state.playerMode.decisions.find((item) => item.status === "pending");
  assert.ok(decision, "a pending decision should appear by week 4/5");
  const resolved = FMG.resolvePlayerModeDecision(state, decision.id, decision.choices[0].id);
  assert.ok(resolved.ok, "decision should resolve");
  assert.equal(decision.status, "resolved", "decision status should be resolved");
  assert.ok((state.seasonDrama.consequences || []).length >= 1, "visible consequence should be recorded");
  console.log("  4. resolvePlayerModeDecision: visible consequence PASS");
})();

(function () {
  const challenges = FMG.generatePlayerLiveChallenges(state, { force: true });
  assert.ok(challenges.length >= 1, "player live challenges should exist");
  FMG.trainPlayerMode(state, "balanced");
  FMG.trainPlayerMode(state, "balanced");
  const trainingChallenge = state.liveChallenges.player.find((challenge) => challenge.type === "training-week");
  assert.ok(trainingChallenge, "training challenge should exist");
  assert.equal(trainingChallenge.status, "completed", "training challenge should complete after two trainings");
  console.log("  5. Player live challenges: training challenge completed PASS");
})();

console.log("\nPlayer Mode tests passed.");
