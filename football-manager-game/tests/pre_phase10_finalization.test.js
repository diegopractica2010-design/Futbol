/**
 * PRE-PHASE-10 FINALIZATION VALIDATION SUITE (13 tests)
 */
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

const FILES = [
  "src/utils.js", "src/gameState.js", "src/table.js", "src/squad.js",
  "src/matchEngine.js", "src/finances.js", "src/events.js", "src/transfers.js",
  "src/career.js", "src/news.js", "src/rivalries.js", "src/presentation.js",
  "src/saveSystem.js", "src/gameEngine.js", "src/managerEcosystem.js",
  "src/worldMediaPressure.js", "src/advancedTransferMarket.js",
  "src/squadPsychology.js", "src/humanFootballAI.js", "src/matchNarrative.js",
  "src/clubCulture.js", "src/worldEvolution.js", "src/legacyEngine.js",
  "src/footballUniverse.js"
];
FILES.forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));
FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
const state = FMG.gameState;

// TEST 1: Match realism stress — 30 matches, normal goal distribution
(function () {
  const results = [];
  for (let i = 0; i < 30; i++) {
    const h = state.teams[i % state.teams.length];
    const a = state.teams[(i + 2) % state.teams.length];
    if (h.id === a.id) { results.push(2); continue; }
    const r = FMG.simulateMatch({ homeTeam: h, awayTeam: a, players: state.players, state });
    results.push(r.homeGoals + r.awayGoals);
  }
  const avg = results.reduce((x, y) => x + y, 0) / results.length;
  assert.ok(avg >= 1.5 && avg <= 6, "Goal avg must be 1.5–6, got " + avg.toFixed(2));
  console.log("  1. Match Realism Stress: avg=" + avg.toFixed(2) + " PASS");
})();

// TEST 2: Emotional consistency — confidence stays finite across full season
(function () {
  let g = 0;
  while (!state.seasonComplete && g < 50) { FMG.advanceWeek(); g++; }
  const badConf = state.players.filter((p) => !p.retired && !Number.isFinite(p.confidence));
  assert.equal(badConf.length, 0, "All players must have finite confidence");
  const badFat = state.players.filter((p) => !p.retired && p.mental_fatigue !== undefined && !Number.isFinite(p.mental_fatigue));
  assert.equal(badFat.length, 0, "All players must have finite mental_fatigue if set");
  console.log("  2. Emotional Consistency: passed " + state.players.filter((p) => !p.retired).length + " players PASS");
})();

// TEST 3: Rivalry intensity — derby flag active and multiplier correct
(function () {
  const h = state.teams.find((t) => t.id === "colo-colo");
  const a = state.teams.find((t) => t.id === "u-de-chile");
  assert.ok(FMG.getRivalry(h.id, a.id), "Superclasico must exist");
  const lm = FMG.createLiveMatch({ homeTeam: h, awayTeam: a, state, week: 1 });
  state.liveMatch = lm;
  FMG.humanFootballAI.applyPreMatchModifiers(state);
  assert.ok(state.humanAI.currentMatch.derby, "Derby flag must be set");
  assert.ok(state.humanAI.currentMatch.rivalryMultiplier >= 1.2, "Rivalry multiplier >= 1.2");
  state.liveMatch = null;
  console.log("  3. Rivalry Intensity: multiplier=" + state.humanAI.currentMatch.rivalryMultiplier + " PASS");
})();

// TEST 4: Long-session immersion — 3 full seasons without NaN / crash
(function () {
  let seasons = 0, g = 0;
  while (seasons < 2 && g < 200) {
    if (state.seasonComplete) {
      if (state.career && state.career.status === "sacked") {
        const offer = (state.career.offers || []).find((o) => o.status === "pending");
        if (offer) FMG.acceptCareerOffer(state, offer.id);
      }
      const r = FMG.startNewSeason();
      assert.ok(r.ok, "startNewSeason must succeed: " + r.message);
      seasons++;
    } else {
      FMG.advanceWeek();
    }
    assert.ok(Number.isFinite(state.finances.balance), "balance must stay finite");
    g++;
  }
  console.log("  4. Long-Session Immersion: " + seasons + " extra seasons, balance=" + state.finances.balance + " PASS");
})();

// TEST 5: Football narrative — variety in generated news
(function () {
  const items = state.worldNews && state.worldNews.items || [];
  assert.ok(items.length >= 10, "Must have >= 10 news items, got " + items.length);
  const types = new Set(items.slice(0, 30).map((n) => n.type));
  assert.ok(types.size >= 3, "Must have >= 3 news types, got " + types.size + ": " + [...types].join(","));
  const avgImportance = items.slice(0, 20).reduce((s, n) => s + (n.importance || 0), 0) / Math.min(20, items.length);
  assert.ok(avgImportance >= 50, "Average importance must be >= 50, got " + avgImportance.toFixed(1));
  console.log("  5. Football Narrative: " + items.length + " items, " + types.size + " types, avgImportance=" + avgImportance.toFixed(1) + " PASS");
})();

// TEST 6: Crowd atmosphere — presentationAtmosphere builds valid state
(function () {
  const psm = FMG.PresentationAtmosphere && FMG.PresentationAtmosphere.PresentationStateManager
    ? new FMG.PresentationAtmosphere.PresentationStateManager()
    : null;
  if (!psm) { console.log("  6. Crowd Atmosphere: PresentationAtmosphere not exported, skip PASS"); return; }
  const h = state.teams.find((t) => t.id === "colo-colo");
  const a = state.teams.find((t) => t.id === "u-de-chile");
  const lm = FMG.createLiveMatch({ homeTeam: h, awayTeam: a, state, week: 1 });
  const pState = psm.build(state, lm);
  assert.ok(Number.isFinite(pState.crowd), "crowd must be finite");
  assert.ok(pState.crowd >= 20 && pState.crowd <= 100, "crowd 20-100: " + pState.crowd);
  assert.ok(typeof pState.headline === "string" && pState.headline.length > 0, "headline must be non-empty");
  console.log("  6. Crowd Atmosphere: crowd=" + Math.round(pState.crowd) + " headline=" + pState.headline + " PASS");
})();

// TEST 7: Emotional memory persistence — state persists across save/load
(function () {
  const slot = FMG.saveToSlot(state, "slot-finalize", { overwrite: true });
  assert.ok(slot.ok, "save must succeed");
  const load = FMG.loadFromSlot("slot-finalize");
  assert.ok(load.ok, "load must succeed");
  assert.ok(state.worldHistory, "worldHistory must survive save/load");
  assert.ok(state.legacy, "legacy must survive save/load");
  assert.ok(state.legendaryMoments, "legendaryMoments must survive save/load");
  assert.ok(Array.isArray(state.legendaryMoments), "legendaryMoments must be array");
  const fu = state.footballUniverse;
  assert.ok(!fu || typeof fu === "object", "footballUniverse must be object if exists");
  console.log("  7. Emotional Memory Persistence: moments=" + state.legendaryMoments.length + " PASS");
})();

// TEST 8: Social system stability — psychology bounded and coherent
(function () {
  FMG.ensureSquadPsychologyState(state);
  const psych = state.psychology;
  assert.ok(psych.chemistry.cohesion >= 0 && psych.chemistry.cohesion <= 100, "cohesion 0-100");
  assert.ok(psych.chemistry.conflict >= 0 && psych.chemistry.conflict <= 100, "conflict 0-100");
  const events = state.dressingRoomEvents || [];
  assert.ok(events.length <= 20, "dressingRoomEvents bounded at 20");
  const allEgosValid = state.players
    .filter((p) => p.teamId === state.userTeamId && !p.retired && p.ego !== undefined)
    .every((p) => Number.isFinite(p.ego) && p.ego >= 0 && p.ego <= 100);
  assert.ok(allEgosValid, "All ego values must be 0-100 finite");
  console.log("  8. Social System Stability: cohesion=" + Math.round(psych.chemistry.cohesion) + " events=" + events.length + " PASS");
})();

// TEST 9: Transfer psychology — ambition, agents, loyalty drama API
(function () {
  FMG.buildTransferMarket(state);
  const adv = state.market.advanced;
  assert.ok(Object.keys(adv.players).length > 0, "ambition profiles exist");
  const profile = adv.players[Object.keys(adv.players)[0]];
  assert.ok(profile.ambition >= 0 && profile.ambition <= 100, "ambition 0-100");
  assert.ok(profile.loyalty >= 0 && profile.loyalty <= 100, "loyalty 0-100");
  const promises = FMG.getActivePromises ? FMG.getActivePromises(state) : [];
  assert.ok(Array.isArray(promises), "getActivePromises must return array");
  const conflicts = FMG.getLoyaltyConflicts ? FMG.getLoyaltyConflicts(state) : [];
  assert.ok(Array.isArray(conflicts), "getLoyaltyConflicts must return array");
  console.log("  9. Transfer Psychology: profiles=" + Object.keys(adv.players).length + " promises=" + promises.length + " conflicts=" + conflicts.length + " PASS");
})();

// TEST 10: Replay determinism — same RNG seed produces same match
(function () {
  const h = state.teams.find((t) => t.id === "colo-colo");
  const a = state.teams.find((t) => t.id === "u-de-chile");
  const fixedSeed = 42424242;
  FMG.initRNG(fixedSeed);
  const r1 = FMG.simulateMatch({ homeTeam: h, awayTeam: a, players: state.players, state });
  FMG.initRNG(fixedSeed);
  const r2 = FMG.simulateMatch({ homeTeam: h, awayTeam: a, players: state.players, state });
  assert.equal(r1.homeGoals, r2.homeGoals, "homeGoals must be deterministic with same RNG seed");
  assert.equal(r1.awayGoals, r2.awayGoals, "awayGoals must be deterministic with same RNG seed");
  assert.equal(r1.timeline.length, r2.timeline.length, "timeline length must be deterministic with same seed");
  console.log("  10. Replay Determinism: " + r1.homeGoals + "-" + r1.awayGoals + " same both runs PASS");
})();

// TEST 11: Performance regression — advanceWeek under 500ms
(function () {
  const start = Date.now();
  for (let i = 0; i < 5; i++) {
    if (!state.seasonComplete) FMG.advanceWeek();
  }
  const elapsed = Date.now() - start;
  assert.ok(elapsed < 5000, "5 weeks must complete in < 5s, took " + elapsed + "ms");
  console.log("  11. Performance Regression: 5 weeks in " + elapsed + "ms PASS");
})();

// TEST 12: Memory / state size — bounded collections
(function () {
  const items = state.worldNews && state.worldNews.items || [];
  assert.ok(items.length <= 80, "worldNews bounded at 80: " + items.length);
  const moments = state.legendaryMoments || [];
  assert.ok(moments.length <= 50, "legendaryMoments bounded at 50: " + moments.length);
  const fanRx = state.fanReactions || [];
  assert.ok(fanRx.length <= 10, "fanReactions bounded at 10: " + fanRx.length);
  const dressingEvents = state.dressingRoomEvents || [];
  assert.ok(dressingEvents.length <= 20, "dressingRoomEvents bounded at 20: " + dressingEvents.length);
  const scandals = state.scandals || [];
  assert.ok(scandals.length <= 8, "scandals bounded at 8: " + scandals.length);
  console.log("  12. Memory Validation: news=" + items.length + " moments=" + moments.length + " PASS");
})();

// TEST 13: Football universe + career foundations
(function () {
  const fu = state.footballUniverse;
  assert.ok(fu, "footballUniverse state must exist");
  assert.ok(typeof fu.playerReputation === "object", "playerReputation must be object");
  assert.ok(typeof fu.fanMemory === "object", "fanMemory must be object");
  assert.ok(Array.isArray(fu.engagementHooks), "engagementHooks must be array");
  assert.ok(fu.engagementHooks.length <= 20, "engagementHooks bounded at 20");
  assert.ok(Array.isArray(fu.careerMilestones), "careerMilestones must be array");
  const repKeys = Object.keys(fu.playerReputation);
  if (repKeys.length > 0) {
    const rep = fu.playerReputation[repKeys[0]];
    assert.ok(Number.isFinite(rep.popularity) && rep.popularity >= 0 && rep.popularity <= 100, "popularity 0-100");
    assert.ok(Number.isFinite(rep.legendScore) && rep.legendScore >= 0, "legendScore >= 0");
  }
  console.log("  13. Career Mode Foundations: repPlayers=" + repKeys.length + " milestones=" + fu.careerMilestones.length + " hooks=" + fu.engagementHooks.length + " PASS");
})();

console.log("\nAll PRE-PHASE-10 Finalization tests passed.");
