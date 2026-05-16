const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = global;
global.performance = { now: () => 10 };
global.addEventListener = () => {};
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
window.FMG = {
  CURRENT_VERSION: 1,
  deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }
};

[
  "src/FMG.Core/Utils/RNG.js",
  "src/FMG.Core/Events/EventBus.js",
  "src/FMG.Core/Domain/Club/ClubAggregate.js",
  "src/FMG.Core/Domain/Season/SeasonAggregate.js",
  "src/FMG.Core/Domain/Manager/ManagerAggregate.js",
  "src/FMG.Core/Engine/GameState.js",
  "src/FMG.Core/Engine/Reducers.js",
  "src/FMG.Core/Engine/StateTransition.js",
  "src/FMG.Core/Engine/StateSnapshot.js",
  "src/FMG.Core/Diagnostics/RuntimeDiagnostics.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const Club = FMG.Core.Domain.Club.ClubAggregate;
const Season = FMG.Core.Domain.Season.SeasonAggregate;
const Manager = FMG.Core.Domain.Manager.ManagerAggregate;
const GameState = FMG.Core.Engine.GameState;

function makePlayers(teamId) {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `${teamId}-${index}`,
    teamId,
    name: `Player ${index}`,
    overall: 60 + index,
    morale: 70,
    energy: 90,
    suspensionWeeks: 0
  }));
}

const clubs = [
  new Club({ teamId: "a", name: "A", squad: makePlayers("a") }),
  new Club({ teamId: "b", name: "B", squad: makePlayers("b") })
];
const season = new Season({
  week: 1,
  totalWeeks: 2,
  fixture: [{ week: 1, matches: [{ homeTeamId: "a", awayTeamId: "b" }] }],
  standings: [
    { teamId: "a", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
    { teamId: "b", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
  ]
});
const state = new GameState({ season, clubs, manager: new Manager() });

const diagnostics = new FMG.Core.Diagnostics.RuntimeDiagnosticsController();
assert.equal(diagnostics.validation.validateState(state).ok, true, "runtime validator debe aceptar GameState valido");

const store = new FMG.Core.Engine.SnapshotStore();
const snapshotId = store.save(state, "initial");
assert.equal(diagnostics.snapshotValidator.validateStore(store).ok, true, "snapshot validator debe verificar checksums");

const replay = new FMG.Core.Engine.ReplayEngine(store);
const replayResult = diagnostics.replayValidator.validate(replay, snapshotId, [], state._calculateChecksum());
assert.equal(replayResult.ok, true, "replay validator debe confirmar determinismo sin acciones");

const nextState = FMG.Core.Engine.Reducers.applyAction(state, { type: "ADVANCE_WEEK", payload: {} });
const transaction = diagnostics.transactionValidator.validateContext({
  previousState: state,
  newState: nextState,
  action: { type: "ADVANCE_WEEK" }
});
assert.equal(transaction.ok, true, "transaction validator debe validar linaje");
assert.ok(diagnostics.diffDebugger.diff(state.snapshot(), nextState.snapshot()).length > 0, "state diff debe reportar cambios");

const memory = diagnostics.memoryTracker.sample(state);
assert.ok(memory.stateBytes > 0, "memory tracker debe estimar tamano de estado");

const bus = new FMG.Core.Events.EventBus();
bus.on("x", () => {});
assert.equal(diagnostics.listenerLeakDetector.inspectEventBus(bus).total, 1, "leak detector debe contar listeners");

const scaling = diagnostics.scalingController.evaluate({ avgFrameMs: 35, memoryWarning: true });
assert.equal(scaling.tier, "survival", "scaling controller debe bajar calidad con frame alto");

const optimized = diagnostics.worldOptimizer.abstractInactiveNPCs(makePlayers("a").concat(makePlayers("b")), { userTeamId: "a", maxActiveEntities: 10 });
assert.equal(optimized.active.length, 10, "optimizer debe limitar entidades activas");
assert.ok(optimized.abstracted.length > 0, "optimizer debe abstraer NPCs inactivos");

const packed = diagnostics.replayCompressor.compress([{ type: "ADVANCE_WEEK", payload: {} }]);
assert.deepEqual(diagnostics.replayCompressor.expand(packed)[0], { type: "ADVANCE_WEEK", payload: {} }, "replay compression debe ser reversible");

assert.equal(diagnostics.saveValidator.validate({ teams: [], players: [], fixtures: [] }).ok, true, "save validator debe aceptar contrato minimo");

console.log("Stabilization diagnostics tests passed");
