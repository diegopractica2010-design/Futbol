/**
 * PRE-PHASE-10 CONSOLIDATION VALIDATION SUITE
 * Tests: match realism, emotional consistency, derby intensity, comeback probability,
 *        narrative repetition, dressing-room stability, transfer psychology,
 *        long-term world memory, crowd pressure, immersion regression
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

[
  "src/utils.js", "src/gameState.js", "src/table.js", "src/squad.js",
  "src/matchEngine.js", "src/finances.js", "src/events.js", "src/transfers.js",
  "src/career.js", "src/news.js", "src/rivalries.js", "src/presentation.js",
  "src/saveSystem.js", "src/gameEngine.js", "src/managerEcosystem.js",
  "src/worldMediaPressure.js", "src/advancedTransferMarket.js",
  "src/squadPsychology.js", "src/humanFootballAI.js", "src/matchNarrative.js",
  "src/clubCulture.js", "src/worldEvolution.js", "src/legacyEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
const state = FMG.gameState;

// ─── TEST 1: MATCH REALISM ─────────────────────────────────────────────────
(function testMatchRealism() {
  const home = state.teams.find((t) => t.id === "colo-colo");
  const away = state.teams.find((t) => t.id === "u-de-chile");
  const results = [];
  for (let i = 0; i < 20; i++) {
    const r = FMG.simulateMatch({ homeTeam: home, awayTeam: away, players: state.players, state });
    results.push(r.homeGoals + r.awayGoals);
  }
  const avgGoals = results.reduce((a, b) => a + b, 0) / results.length;
  assert.ok(avgGoals >= 1.5 && avgGoals <= 5.5, "Average goals per match should be 1.5–5.5, got " + avgGoals.toFixed(2));
  const zeroBoth = results.filter((g) => g === 0).length;
  assert.ok(zeroBoth <= 6, "Too many 0-0 matches: " + zeroBoth + "/20");
  console.log("  Match Realism: avgGoals=" + avgGoals.toFixed(2) + " PASS");
})();

// ─── TEST 2: EMOTIONAL CONSISTENCY ────────────────────────────────────────
(function testEmotionalConsistency() {
  const humanAI = FMG.humanFootballAI;
  assert.ok(humanAI, "humanFootballAI must be exported");
  assert.ok(typeof humanAI.applyPreMatchModifiers === "function", "applyPreMatchModifiers must exist");
  assert.ok(typeof humanAI.applyPostMatchModifiers === "function", "applyPostMatchModifiers must exist");

  const p = state.players.filter((x) => x.teamId === "colo-colo")[0];
  assert.ok(p, "Must have at least one player");
  const initialConf = p.confidence;
  const live = FMG.createLiveMatch({
    homeTeam: state.teams.find((t) => t.id === "colo-colo"),
    awayTeam: state.teams.find((t) => t.id === "u-de-chile"),
    state, week: 1
  });
  state.liveMatch = live;
  humanAI.applyPreMatchModifiers(state);
  assert.ok(Number.isFinite(p.confidence), "confidence must remain finite after pre-match");
  state.liveMatch = null;
  console.log("  Emotional Consistency: confidence=" + initialConf + "→" + p.confidence + " PASS");
})();

// ─── TEST 3: DERBY INTENSITY ───────────────────────────────────────────────
(function testDerbyIntensity() {
  const home = state.teams.find((t) => t.id === "colo-colo");
  const away = state.teams.find((t) => t.id === "u-de-chile");
  const rivalry = FMG.getRivalry(home.id, away.id);
  assert.ok(rivalry, "Superclasico rivalry must exist");
  assert.ok(rivalry.intensity >= 80, "Derby intensity must be >= 80, got " + rivalry.intensity);
  const live = FMG.createLiveMatch({ homeTeam: home, awayTeam: away, state, week: 1 });
  state.liveMatch = live;
  FMG.humanFootballAI.applyPreMatchModifiers(state);
  const matchState = state.humanAI && state.humanAI.currentMatch;
  assert.ok(matchState && matchState.derby === true, "Derby flag must be set");
  assert.ok(matchState.rivalryMultiplier >= 1.2, "Rivalry multiplier must be >= 1.2");
  state.liveMatch = null;
  console.log("  Derby Intensity: rivalryMultiplier=" + matchState.rivalryMultiplier + " PASS");
})();

// ─── TEST 4: COMEBACK PROBABILITY ─────────────────────────────────────────
(function testComebackProbability() {
  let comebacks = 0;
  const trials = 50;
  for (let i = 0; i < trials; i++) {
    const homeTeam = state.teams[i % state.teams.length];
    const awayTeam = state.teams[(i + 1) % state.teams.length];
    if (homeTeam.id === awayTeam.id) continue;
    const r = FMG.simulateMatch({ homeTeam, awayTeam, players: state.players, state });
    const tl = r.timeline || [];
    const goals = tl.filter((e) => e.type === "goal").sort((a, b) => a.minute - b.minute);
    let h = 0, a = 0, wasDown2 = false;
    goals.forEach((g) => {
      if (g.teamId === homeTeam.id) h++; else a++;
      if (a - h >= 2) wasDown2 = true;
    });
    if (wasDown2 && h >= a) comebacks++;
  }
  assert.ok(comebacks <= 8, "Comebacks from 2+ should be rare (<= 8/50), got " + comebacks);
  console.log("  Comeback Probability: " + comebacks + "/50 PASS");
})();

// ─── TEST 5: NARRATIVE REPETITION ─────────────────────────────────────────
(function testNarrativeRepetition() {
  const results = [];
  for (let i = 0; i < 10; i++) {
    const home = state.teams[i % state.teams.length];
    const away = state.teams[(i + 3) % state.teams.length];
    if (home.id === away.id) continue;
    const r = FMG.simulateMatch({ homeTeam: home, awayTeam: away, players: state.players, state });
    r.week = i + 1;
    FMG.generatePostMatchNews(state, r);
    results.push(r.narrativeArc);
  }
  const arcs = results.filter(Boolean);
  assert.ok(arcs.length > 0, "Some matches must have narrative arcs");
  const unique = new Set(arcs);
  assert.ok(unique.size >= 2, "Narrative arcs must have variety (>= 2 distinct types), got " + unique.size);
  const news = state.worldNews && state.worldNews.items || [];
  const titles = news.slice(0, 20).map((n) => n.title);
  const uniqueTitles = new Set(titles);
  assert.ok(uniqueTitles.size >= titles.length * 0.6, "At least 60% of news titles should be unique");
  console.log("  Narrative Repetition: " + unique.size + " arc types, " + uniqueTitles.size + "/" + titles.length + " unique titles PASS");
})();

// ─── TEST 6: DRESSING ROOM STABILITY ──────────────────────────────────────
(function testDressingRoomStability() {
  FMG.ensureSquadPsychologyState(state);
  const psych = state.psychology;
  assert.ok(psych, "psychology state must exist");
  assert.ok(Array.isArray(psych.hierarchy), "hierarchy must be an array");
  FMG.runManagerEcosystemWeek(state, { phase: "weekly" });
  const chemistry = psych.chemistry;
  assert.ok(Number.isFinite(chemistry.cohesion), "cohesion must be finite");
  assert.ok(chemistry.cohesion >= 0 && chemistry.cohesion <= 100, "cohesion must be 0-100");
  const events = state.dressingRoomEvents || [];
  assert.ok(events.length <= 20, "dressingRoomEvents bounded at 20, got " + events.length);
  console.log("  Dressing Room Stability: cohesion=" + Math.round(chemistry.cohesion) + " events=" + events.length + " PASS");
})();

// ─── TEST 7: TRANSFER PSYCHOLOGY ──────────────────────────────────────────
(function testTransferPsychology() {
  FMG.ensureAdvancedTransferMarket(state);
  FMG.buildTransferMarket(state);
  const adv = state.market.advanced;
  assert.ok(adv.players && Object.keys(adv.players).length > 0, "PlayerAmbitionEngine must have profiles");
  const samplePlayerId = Object.keys(adv.players)[0];
  const profile = adv.players[samplePlayerId];
  assert.ok(Number.isFinite(profile.ambition) && profile.ambition >= 0 && profile.ambition <= 100, "ambition must be 0-100");
  assert.ok(Number.isFinite(profile.loyalty) && profile.loyalty >= 0 && profile.loyalty <= 100, "loyalty must be 0-100");
  // Agents are created lazily on first negotiation - ensure at least one is created
  const squadPlayer = state.players.find((p) => p.teamId === state.userTeamId && !p.retired);
  if (squadPlayer) FMG.AdvancedTransferMarket.AgentRelationshipManager.ensureAgent(state, squadPlayer);
  const agentKeys = Object.keys(adv.agents || {});
  assert.ok(agentKeys.length > 0, "Agents must be created for squad players");
  const agent = adv.agents[agentKeys[0]];
  const validPersonalities = ["duro", "relacional", "mediatico", "pragmatico", "protector"];
  assert.ok(validPersonalities.includes(agent.personality), "agent personality must be valid type");
  console.log("  Transfer Psychology: agents=" + agentKeys.length + " firstPersonality=" + agent.personality + " PASS");
})();

// ─── TEST 8: LONG-TERM WORLD MEMORY ───────────────────────────────────────
(function testLongTermWorldMemory() {
  let g = 0;
  while (!state.seasonComplete && g < 50) { FMG.advanceWeek(); g++; }
  FMG.evaluateCareerSeasonEnd(state, state.seasonHistory[0]);
  const wh = state.worldHistory;
  assert.ok(wh, "worldHistory must exist");
  assert.ok(wh.dynasties && Object.keys(wh.dynasties).length > 0, "dynasties must be tracked");
  const legacy = state.legacy;
  assert.ok(legacy, "legacy must exist");
  assert.ok(Array.isArray(legacy.seasonDocumentaries), "seasonDocumentaries must be array");
  assert.ok(legacy.seasonDocumentaries.length > 0, "At least 1 documentary must be generated");
  const doc = legacy.seasonDocumentaries[0];
  assert.ok(doc.paragraphs && doc.paragraphs.length === 3, "Documentary must have 3 paragraphs");
  assert.ok((state.legendaryMoments || []).length <= 50, "legendaryMoments must be bounded at 50");
  console.log("  World Memory: dynasties=" + Object.keys(wh.dynasties).length + " docs=" + legacy.seasonDocumentaries.length + " moments=" + (state.legendaryMoments || []).length + " PASS");
})();

// ─── TEST 9: CROWD PRESSURE ────────────────────────────────────────────────
(function testCrowdPressure() {
  const cc = FMG.ensureClubCultureState(state);
  assert.ok(cc, "clubCulture state must exist");
  const dna = FMG.ClubCulture.getDNA("colo-colo");
  assert.ok(dna, "Colo-Colo must have club DNA");
  assert.equal(dna.fanExpectation, "champion", "Colo-Colo must have champion expectation");
  assert.ok(dna.prestige >= 90, "Colo-Colo prestige must be >= 90");
  const stadium = FMG.ClubCulture.getStadium("colo-colo");
  assert.ok(stadium, "Colo-Colo must have stadium data");
  assert.ok(stadium.intimidationFactor >= 10, "Monumental intimidation must be >= 10");
  const pressure = FMG.ClubCulture.getPressureLevel(dna, 5, 16);
  assert.equal(pressure, "crisis", "Colo-Colo in 5th should trigger crisis pressure");
  console.log("  Crowd Pressure: prestige=" + dna.prestige + " intimid=" + stadium.intimidationFactor + " pos5=" + pressure + " PASS");
})();

// ─── TEST 10: IMMERSION REGRESSION ────────────────────────────────────────
(function testImmersionRegression() {
  const newsItems = state.worldNews && state.worldNews.items || [];
  assert.ok(newsItems.length > 0, "News items must exist after a season");
  const roboticPatterns = [/\bEl club\b/, /\bel protagonista\b/, /Event[oe] emocional/i, /X\/100/];
  const roboticFound = newsItems.filter((n) => roboticPatterns.some((p) => p.test(n.title) || p.test(n.body)));
  assert.ok(roboticFound.length === 0, "No news items should contain robotic patterns, found " + roboticFound.length + ": " + (roboticFound[0] ? roboticFound[0].title : ""));
  const shortTitles = newsItems.filter((n) => (n.title || "").length < 10);
  assert.ok(shortTitles.length === 0, "No news titles should be < 10 chars");
  const pressureNarrative = FMG.matchNarrative.getPressureNarrative(state, { seed: 1, minute: 88, result: { homeGoals: 1, awayGoals: 1 }, homeTeamId: "colo-colo", awayTeamId: "u-de-chile" }, 88);
  assert.ok(pressureNarrative && pressureNarrative.length > 10, "Pressure narrative must be non-trivial");
  console.log("  Immersion Regression: " + newsItems.length + " news, 0 robotic, pressureNarrative OK PASS");
})();

console.log("\nAll PRE-PHASE-10 validation tests passed.");
