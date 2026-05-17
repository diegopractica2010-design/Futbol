const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = global;
global.navigator = { deviceMemory: 4, hardwareConcurrency: 4 };
global.performance = { now: () => 0 };
global.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = String(value); },
  getItem(key) { return this.data[key] || null; },
  removeItem(key) { delete this.data[key]; }
};

window.FMG = {
  CURRENT_VERSION: 24,
  deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
};

[
  "src/utils.js",
  "src/FMG.Core/Utils/RNG.js",
  "src/FMG.Core/Events/EventBus.js",
  "src/FMG.Core/Domain/Club/ClubAggregate.js",
  "src/FMG.Core/Domain/Season/SeasonAggregate.js",
  "src/FMG.Core/Domain/Manager/ManagerAggregate.js",
  "src/FMG.Core/Engine/GameState.js",
  "src/FMG.Core/Engine/Reducers.js",
  "src/FMG.Core/Engine/StateTransition.js",
  "src/FMG.Core/Engine/StateSnapshot.js",
  "src/FMG.Core/Services/MatchSimulator.js",
  "src/FMG.Core/Engine/SimulationEngine.js",
  "src/FMG.Core/Adapters/LegacyGameStateAdapter.js",
  "src/runtimeHardening.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const Club = FMG.Core.Domain.Club.ClubAggregate;
const Season = FMG.Core.Domain.Season.SeasonAggregate;
const Manager = FMG.Core.Domain.Manager.ManagerAggregate;
const GameState = FMG.Core.Engine.GameState;

function players(teamId) {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `${teamId}-${index}`,
    teamId,
    name: `${teamId} Player ${index}`,
    position: index === 0 ? "POR" : "MED",
    age: 23 + index,
    overall: 60 + index,
    morale: 70,
    energy: 90
  }));
}

function makeState() {
  const season = new Season({
    number: 1,
    week: 1,
    totalWeeks: 3,
    fixture: [
      { week: 1, matches: [{ homeTeamId: "alpha", awayTeamId: "beta" }] },
      { week: 2, matches: [{ homeTeamId: "beta", awayTeamId: "alpha" }] }
    ],
    standings: [
      { teamId: "alpha", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
      { teamId: "beta", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
    ]
  });
  return new GameState({
    season,
    clubs: [
      new Club({ teamId: "alpha", name: "Alpha", squad: players("alpha") }),
      new Club({ teamId: "beta", name: "Beta", squad: players("beta") })
    ],
    manager: new Manager({ profile: { name: "Deterministic Manager" } }),
    metadata: { route: "dashboard", userTeamId: "alpha" }
  });
}

const serializer = new FMG.Hardening.RNGStateSerializer();
const rng = new FMG.Hardening.DeterministicRNGEngine(991);
const first = rng.next();
const serialized = serializer.serialize(rng);
const second = rng.next();
serializer.restore(serialized, rng);
assert.equal(rng.next(), second, "RNG restore debe reproducir el siguiente valor");
assert.notEqual(first, second, "RNG debe avanzar de forma serializable");

const hashEngine = new FMG.Hardening.ReplayHashEngine();
assert.equal(
  hashEngine.hash({ b: 2, a: 1 }),
  hashEngine.hash({ a: 1, b: 2 }),
  "ReplayHashEngine debe normalizar orden de claves"
);
assert.equal(
  hashEngine.hash([{ id: "b", value: 2 }, { id: "a", value: 1 }], { sortEntityArrays: true }),
  hashEngine.hash([{ id: "a", value: 1 }, { id: "b", value: 2 }], { sortEntityArrays: true }),
  "ReplayHashEngine debe ordenar entidades por clave estable cuando se solicita"
);

const state = makeState();
const store = new FMG.Core.Engine.SnapshotStore();
const snapshotId = store.save(state, "deterministic-start");
const replay = new FMG.Core.Engine.ReplayEngine(store);
const actions = [{ type: "ADVANCE_WEEK", payload: {} }];
const loopReport = FMG.deterministicReplayValidator.validateReplayLoop(replay, snapshotId, actions, 4);
assert.equal(loopReport.ok, true, "Replay loop debe producir hashes identicos");

const finalState = replay.replay(snapshotId, actions).finalState;
const inspectorA = new FMG.Hardening.TickReplayInspector(hashEngine);
const inspectorB = new FMG.Hardening.TickReplayInspector(hashEngine);
inspectorA.record(0, state, { label: "start" });
inspectorA.record(1, finalState, { label: "advance" });
inspectorB.record(0, state, { label: "start" });
inspectorB.record(1, state.with({ metadata: { divergence: true } }), { label: "diverged" });
const divergence = inspectorA.divergenceReport(inspectorB.ticks);
assert.equal(divergence.ok, false, "Replay inspector debe detectar divergencia");
assert.equal(divergence.divergenceTick, 1, "Divergencia debe ubicarse en el tick correcto");

const saveCycle = FMG.deterministicReplayValidator.validateSaveLoadCycle(
  { teams: [{ id: "b" }, { id: "a" }], players: [{ id: "p2" }, { id: "p1" }], currentWeek: 1 },
  (value) => JSON.stringify(value),
  (payload) => JSON.parse(payload)
);
assert.equal(saveCycle.ok, true, "Save/load determinista debe conservar hash");

const rollback = FMG.deterministicReplayValidator.validateRollback(store, snapshotId, state);
assert.equal(rollback.ok, true, "Rollback desde snapshot debe conservar hash");

const runtimeSources = [];
function collect(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith(".js")) runtimeSources.push(full);
  });
}
collect(path.join(root, "src"));
const forbidden = [];
runtimeSources.forEach((file) => {
  const content = fs.readFileSync(file, "utf8");
  if (/Math\.random\s*\(/.test(content)) forbidden.push(path.relative(root, file) + ": Math.random");
  if (/Date\.now\s*\(/.test(content)) forbidden.push(path.relative(root, file) + ": Date.now");
});
assert.deepEqual(forbidden, [], "runtime no debe contener Math.random() ni Date.now()");

assert.ok(FMG.generateDeterministicIntegrityReport().rng, "debe generar reporte de integridad determinista");
assert.ok(FMG.generateReplayDivergenceReport().validator, "debe generar reporte de divergencia replay");
assert.ok(FMG.generateRuntimeRandomnessAudit().rngState, "debe generar auditoria de randomness runtime");

console.log("Deterministic runtime tests passed");
