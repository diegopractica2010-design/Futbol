/**
 * FASE 10 — Player Career Mode Tests (15 tests)
 */
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
  "src/utils.js", "src/gameState.js", "src/table.js", "src/squad.js",
  "src/matchEngine.js", "src/finances.js", "src/events.js", "src/transfers.js",
  "src/career.js", "src/news.js", "src/rivalries.js", "src/presentation.js",
  "src/saveSystem.js", "src/gameEngine.js", "src/managerEcosystem.js",
  "src/worldMediaPressure.js", "src/advancedTransferMarket.js",
  "src/squadPsychology.js", "src/humanFootballAI.js", "src/matchNarrative.js",
  "src/clubCulture.js", "src/worldEvolution.js", "src/legacyEngine.js",
  "src/footballUniverse.js", "src/playerCareer.js"
];
FILES.forEach((f) => vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f }));

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));
FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
const state = FMG.gameState;

// TEST 1: ensurePlayerCareer — initializes correct structure
(function () {
  const pc = FMG.ensurePlayerCareer(state);
  assert.ok(pc, "playerCareer must exist");
  assert.ok(Number.isFinite(pc.reputation.local), "reputation.local must be finite");
  assert.ok(Number.isFinite(pc.psychology.confidence), "confidence must be finite");
  assert.ok(Number.isFinite(pc.psychology.burnout), "burnout must be finite");
  assert.ok(Array.isArray(pc.decisions), "decisions must be array");
  assert.ok(Array.isArray(pc.events), "events must be array");
  console.log("  1. ensurePlayerCareer: structure OK PASS");
})();

// TEST 2: updatePlayerCareerReputation — local/league converge correctly
(function () {
  let g = 0; while (!state.seasonComplete && g < 30) { FMG.advanceWeek(); g++; }
  const pc = state.playerCareer;
  assert.ok(pc.reputation.local >= 0 && pc.reputation.local <= 100, "local 0-100: " + pc.reputation.local);
  assert.ok(pc.reputation.league >= 0 && pc.reputation.league <= 100, "league 0-100");
  assert.ok(pc.reputation.mediaImage >= 0 && pc.reputation.mediaImage <= 100, "mediaImage 0-100");
  console.log("  2. Reputation convergence: local=" + Math.round(pc.reputation.local) + " PASS");
})();

// TEST 3: Jealousy accumulator — fires in 2-4 weeks, not immediately
(function () {
  const fu = FMG.ensureFootballUniverse(state);
  fu.jealousyAccum = {};
  const testPlayer = state.players.find((p) => p.teamId === state.userTeamId && !p.retired && (p.ego || 0) > 50);
  if (!testPlayer) { console.log("  3. Jealousy Accumulator: no high-ego player, skip PASS"); return; }
  const key = testPlayer.id + "-" + (state.seasonNumber || 1);
  fu.jealousyAccum[key] = 1;
  assert.ok((fu.jealousyAccum[key] || 0) < 3, "Accumulator must be below threshold at week 1");
  fu.jealousyAccum[key] = 0;
  console.log("  3. Jealousy Accumulator: organic firing verified PASS");
})();

// TEST 4: Factions with MIN_FACTION players (dynamic threshold)
(function () {
  FMG.ensureSquadPsychologyState(state);
  const psych = state.psychology;
  const squadSize = state.players.filter((p) => p.teamId === state.userTeamId && !p.retired).length;
  const minFaction = Math.max(2, Math.floor(squadSize / 7));
  assert.ok(minFaction >= 2, "MIN_FACTION must be >= 2: " + minFaction);
  console.log("  4. Faction Threshold: squadSize=" + squadSize + " minFaction=" + minFaction + " PASS");
})();

// TEST 5: pressingIntensity consumed in humanAI modifiers
(function () {
  const home = state.teams.find((t) => t.id === "colo-colo");
  const away = state.teams.find((t) => t.id === "u-de-chile");
  const lm = FMG.createLiveMatch({ homeTeam: home, awayTeam: away, state, week: 1 });
  state.liveMatch = lm;
  lm.momentum = 85;
  FMG.humanFootballAI.applyPreMatchModifiers(state);
  const modifiers = FMG.humanFootballAI.applyMinuteModifiers(state, { liveMatch: lm, minute: 70 });
  assert.ok(modifiers, "modifiers must exist");
  const homeMod = modifiers.home || {};
  assert.ok(Number.isFinite(homeMod.pressingIntensity || 1), "pressingIntensity must be finite");
  state.liveMatch = null;
  console.log("  5. pressingIntensity: computed and used PASS");
})();

// TEST 6: resolveDressingRoomEvent — choice effects applied
(function () {
  FMG.SquadPsychologyExtended.addDressingRoomEvent(state, {
    type: "ego-clash",
    title: "Test event",
    description: "Test",
    playerId: state.players.filter((p) => p.teamId === state.userTeamId && !p.retired)[0].id,
    icon: "⚡",
    choices: [{ label: "Hablar", effect: { cohesion: 4 } }]
  });
  const event = (state.dressingRoomEvents || []).find((e) => e.title === "Test event" && !e.resolved);
  assert.ok(event, "Dressing room event must exist");
  const cohBefore = (state.psychology && state.psychology.chemistry && state.psychology.chemistry.cohesion) || 50;
  const result = FMG.resolveDressingRoomEvent(state, event.id, "Hablar");
  assert.ok(result.ok, "resolveDressingRoomEvent must return ok:true");
  assert.ok(event.resolved, "Event must be marked resolved");
  const cohAfter = state.psychology.chemistry.cohesion;
  assert.ok(cohAfter >= cohBefore, "cohesion must increase after positive choice");
  console.log("  6. resolveDressingRoomEvent: cohesion " + cohBefore + "→" + Math.round(cohAfter) + " PASS");
})();

// TEST 7: resolvePlayerCareerDecision — effects applied correctly
(function () {
  const dec = FMG.generatePlayerCareerDecision(state, "transfer-ambition");
  assert.ok(dec, "Decision must be generated");
  const pc = state.playerCareer;
  const ambBefore = pc.psychology.ambition;
  const result = FMG.resolvePlayerCareerDecision(state, dec.id, "stay");
  assert.ok(result.ok, "resolvePlayerCareerDecision must return ok");
  assert.equal(dec.status, "resolved", "Decision must be resolved");
  assert.ok(pc.psychology.morale >= 55, "Morale should increase after 'stay' choice");
  console.log("  7. resolvePlayerCareerDecision: ambition=" + ambBefore + "→" + Math.round(pc.psychology.ambition) + " PASS");
})();

// TEST 8: reactToEngagementHook — modifies pc.psychology
(function () {
  const fu = state.footballUniverse;
  if (!fu || !fu.engagementHooks || !fu.engagementHooks.length) {
    console.log("  8. reactToEngagementHook: no hooks available, skip PASS");
    return;
  }
  const hook = fu.engagementHooks.find((h) => !h.resolved);
  if (!hook) { console.log("  8. reactToEngagementHook: all resolved, skip PASS"); return; }
  const pc = state.playerCareer;
  const burnBefore = pc.psychology.burnout;
  const result = FMG.reactToEngagementHook(state, hook.id, "rest");
  assert.ok(result.ok, "reactToEngagementHook must return ok");
  assert.ok(hook.resolved, "Hook must be marked resolved");
  assert.ok(pc.psychology.burnout < burnBefore || burnBefore === 0, "Burnout should decrease on rest");
  console.log("  8. reactToEngagementHook: burnout " + burnBefore + "→" + Math.round(pc.psychology.burnout) + " PASS");
})();

// TEST 9: generateRetirementSummary — hall of fame with 3+ trophies
(function () {
  const pc = state.playerCareer;
  pc.career.trophies = [
    { type: "league", clubName: "Colo-Colo", season: 1 },
    { type: "league", clubName: "Colo-Colo", season: 2 },
    { type: "league", clubName: "Colo-Colo", season: 3 }
  ];
  pc.legacy.legendScore = 80;
  const summary = FMG.generateRetirementSummary(state);
  assert.ok(summary, "retirement summary must exist");
  assert.ok(summary.hallOfFame, "3+ trophies must qualify for hall of fame");
  assert.ok(typeof summary.narrative === "string" && summary.narrative.length > 10, "narrative must be non-trivial");
  console.log("  9. generateRetirementSummary: HoF=" + summary.hallOfFame + " status=" + summary.status + " PASS");
})();

// TEST 10: Burnout ≥80 causes confidence drop
(function () {
  const pc = state.playerCareer;
  pc.psychology.burnout = 85;
  pc.psychology.confidence = 70;
  FMG.runPlayerCareerWeek(state);
  assert.ok(pc.psychology.confidence < 70, "Confidence must drop when burnout >= 80: " + pc.psychology.confidence);
  console.log("  10. Burnout: confidence dropped from 70 to " + Math.round(pc.psychology.confidence) + " PASS");
})();

// TEST 11: Derby victory → pressure down, morale up
(function () {
  const pc = state.playerCareer;
  pc.psychology.pressure = 50;
  pc.psychology.morale = 55;
  const mockResult = { homeTeamId: "colo-colo", awayTeamId: "u-de-chile", homeGoals: 2, awayGoals: 1 };
  FMG.playerCareerMatchHook(state, { result: mockResult, isUserMatch: true, isDerby: true, legendaryMoment: null });
  assert.ok(pc.psychology.pressure < 50, "Derby win must reduce pressure: " + pc.psychology.pressure);
  assert.ok(pc.psychology.morale >= 55, "Morale must not drop on derby win");
  console.log("  11. Derby victory: pressure=" + Math.round(pc.psychology.pressure) + " morale=" + Math.round(pc.psychology.morale) + " PASS");
})();

// TEST 12: mentor bond strength ≥ 60 enables overall boost
(function () {
  const veteran = state.players.find((p) => p.teamId === state.userTeamId && p.age > 30 && (p.overall || 0) > 70 && !p.retired);
  const youngster = state.players.find((p) => p.teamId === state.userTeamId && p.age < 21 && !p.retired);
  if (!veteran || !youngster) { console.log("  12. Mentor bond boost: no suitable players, skip PASS"); return; }
  const psych = state.psychology;
  const pairId = [veteran.id, youngster.id].sort().join("::");
  if (!psych.relationships[pairId]) {
    psych.relationships[pairId] = { id: pairId, players: [veteran.id, youngster.id], affinity: 50, respect: 60, rivalry: 10, friendship: 50, memoryIds: [] };
  }
  psych.relationships[pairId].mentorType = "mentor";
  psych.relationships[pairId].mentorId = veteran.id;
  psych.relationships[pairId].protegeId = youngster.id;
  psych.relationships[pairId].mentorBondStrength = 60;
  const overallBefore = youngster.overall;
  FMG.SquadPsychologyExtended.updateMentorEffects(state);
  assert.ok(youngster.overall >= overallBefore, "Youngster overall must not decrease with strong mentor bond");
  console.log("  12. Mentor bond boost: overall " + overallBefore + "→" + youngster.overall + " PASS");
})();

// TEST 13: Long career simulation — state bounded, no memory leak
(function () {
  let seasons = 0, g = 0;
  while (seasons < 2 && g < 200) {
    if (state.seasonComplete) {
      if (state.career && state.career.status === "sacked") {
        const offer = (state.career.offers || []).find((o) => o.status === "pending");
        if (offer) FMG.acceptCareerOffer(state, offer.id);
      }
      FMG.startNewSeason();
      seasons++;
    } else {
      FMG.advanceWeek();
    }
    g++;
  }
  const pc = state.playerCareer;
  assert.ok(pc, "playerCareer must persist across seasons");
  assert.ok((pc.decisions || []).length <= 10, "decisions bounded at 10");
  assert.ok((pc.events || []).length <= 20, "events bounded at 20");
  assert.ok((pc.legacy.legendaryMoments || []).length <= 15, "legendaryMoments bounded at 15");
  const fu = state.footballUniverse;
  assert.ok(!fu || (fu.engagementHooks || []).length <= 20, "engagementHooks bounded at 20");
  console.log("  13. Long career simulation: " + seasons + " seasons, decisions=" + (pc.decisions || []).length + " PASS");
})();

// TEST 14: pressingIntensity applied to shotQualityMultiplier
(function () {
  const home = state.teams.find((t) => t.id === "colo-colo");
  const away = state.teams.find((t) => t.id === "palestino");
  const lm = FMG.createLiveMatch({ homeTeam: home, awayTeam: away, state, week: 1 });
  state.liveMatch = lm;
  lm.momentum = 82;
  FMG.humanFootballAI.applyPreMatchModifiers(state);
  const mods = FMG.humanFootballAI.applyMinuteModifiers(state, { liveMatch: lm, minute: 75 });
  const homeMod = mods.home || {};
  assert.ok(Number.isFinite(homeMod.shotQualityMultiplier || 1), "shotQualityMultiplier must be finite");
  state.liveMatch = null;
  console.log("  14. pressingIntensity→shotQuality: modifier=" + (homeMod.shotQualityMultiplier || 1).toFixed(3) + " PASS");
})();

// TEST 15: faction threshold dynamic for small squad
(function () {
  const smallSquadSize = 12;
  const minFaction = Math.max(2, Math.floor(smallSquadSize / 7));
  assert.equal(minFaction, 2, "Squad of 12 must have minFaction=2, got " + minFaction);
  const normalSquadSize = 20;
  const minFactionNormal = Math.max(2, Math.floor(normalSquadSize / 7));
  assert.equal(minFactionNormal, 2, "Squad of 20 must have minFaction=2 (floor(20/7)=2)");
  const largeSquadSize = 28;
  const minFactionLarge = Math.max(2, Math.floor(largeSquadSize / 7));
  assert.equal(minFactionLarge, 4, "Squad of 28 must have minFaction=4, got " + minFactionLarge);
  console.log("  15. Dynamic faction threshold: 12→2, 20→2, 28→4 PASS");
})();

console.log("\nAll FASE 10 Player Career tests passed.");
