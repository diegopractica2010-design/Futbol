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

function players(teamId, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${teamId}-${index}`,
    teamId,
    name: `Player ${index}`,
    position: index === 0 ? "POR" : "MED",
    age: 24,
    overall: 60 + index,
    morale: 70,
    energy: 90,
    suspendedWeeks: 0,
    injuryWeeks: 0
  }));
}

(async function run() {
  const rng = new FMG.Hardening.DeterministicRNGEngine(1234);
  const first = rng.next();
  const snapshot = rng.snapshot();
  const second = rng.next();
  rng.restore(snapshot);
  assert.equal(rng.next(), second, "RNG serializable debe reproducir el siguiente valor");
  assert.notEqual(first, second, "RNG debe avanzar estado");

  const club = new Club({ teamId: "colo-colo", name: "Colo-Colo", squad: players("colo-colo", 18) });
  const engine = new FMG.Core.Engine.SimulationEngine({ matchSimulator: { run: () => ({}) } });
  const withLineup = engine._autoSelectLineup(club);
  assert.equal(withLineup.squad.length, 18, "Core no debe reemplazar plantilla por lineup");
  assert.equal(withLineup.lineup.length, 11, "Core debe seleccionar XI inicial");

  const season = new Season({
    number: 1,
    week: 1,
    totalWeeks: 2,
    fixture: [{ week: 1, matches: [{ homeTeamId: "colo-colo", awayTeamId: "u-de-chile" }] }],
    standings: [
      { teamId: "colo-colo", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
      { teamId: "u-de-chile", played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
    ]
  });
  const state = new GameState({
    season,
    clubs: [
      club,
      new Club({ teamId: "u-de-chile", name: "U de Chile", squad: players("u-de-chile", 18) })
    ],
    manager: new Manager({ profile: { name: "Manager" } })
  });
  const changed = state.with({ season: season.withWeek ? season.withWeek(2) : { ...season, week: 2 } });
  assert.notEqual(state._calculateChecksum(), changed._calculateChecksum(), "Checksum debe detectar cambios de semana");

  const store = new FMG.Core.Engine.SnapshotStore();
  const snapshotId = store.save(state, "pre");
  const replay = new FMG.Core.Engine.ReplayEngine(store);
  const actions = [{ type: "ADVANCE_WEEK", payload: {} }];
  const expected = FMG.Core.Engine.Reducers.applyAction(state, actions[0])._calculateChecksum();
  assert.equal(FMG.deterministicReplayValidator.validate(replay, snapshotId, actions, expected).ok, true, "Replay validator debe validar secuencia de acciones");

  FMG.gameState = {
    seasonNumber: 1,
    currentWeek: 1,
    totalWeeks: 2,
    userTeamId: "colo-colo",
    route: "dashboard",
    teams: [{ id: "colo-colo", name: "Colo-Colo", city: "Santiago", style: "big-club", stadium: "Monumental", budget: 100, fanBase: 1000 }],
    players: players("colo-colo", 18),
    fixtures: [],
    standings: [],
    managerProfile: { name: "Manager" },
    career: { reputation: 45 }
  };
  const core = FMG.Core.Adapters.legacyAdapter.toCore();
  FMG.Core.Adapters.legacyAdapter.fromCore(core);
  assert.equal(FMG.gameState.teams[0].city, "Santiago", "Adaptador Core->legacy debe preservar campos legacy del equipo");
  assert.equal(FMG.gameState.players.length, 18, "Adaptador Core->legacy debe preservar jugadores");

  const persistenceResult = FMG.incrementalSavePipeline.enqueue("slot-hardening", {
    ...FMG.gameState,
    players: FMG.gameState.players.concat([{ id: "retired-1", name: "Retired", age: 39, isRetired: true }])
  });
  assert.equal(persistenceResult.queued, true, "Save incremental debe encolar escritura");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(FMG.incrementalSavePipeline.report().lastManifest, "Save incremental debe generar manifest");
  assert.equal(FMG.incrementalSavePipeline.report().lastManifest.archivedPlayers, 1, "Save incremental debe archivar retirados");

  const plan = FMG.layeredWorldSimulator.plan(FMG.gameState);
  assert.ok(plan.layers["active match"] > 0 || plan.layers["active league"] > 0, "World simulator debe clasificar entidades visibles");

  const fakeTarget = {
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    removeEventListener(type) { delete this.listeners[type]; }
  };
  const listenerId = FMG.listenerRegistry.add(fakeTarget, "click", () => {});
  assert.equal(FMG.listenerRegistry.count(), 1, "ListenerRegistry debe registrar listeners");
  FMG.listenerRegistry.remove(listenerId);
  assert.equal(FMG.listenerRegistry.count(), 0, "ListenerRegistry debe limpiar listeners");

  const app = {
    innerHTML: "",
    nodes: {},
    querySelector(selector) {
      this.nodes[selector] = this.nodes[selector] || { innerHTML: "" };
      return this.nodes[selector];
    }
  };
  const shell = new FMG.Hardening.PersistentUIShell(app, FMG.renderScheduler);
  shell.render({ nav: "<nav>Nav</nav>", route: "<section>Route</section>", overlay: "" });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(app.nodes[".fmg-route-root"].innerHTML, "<section>Route</section>", "PersistentUIShell debe actualizar panel retenido");

  assert.equal(FMG.runtimeAuthorityManager.report().authority, "FMG.Core", "FMG.Core debe ser autoridad runtime");
  assert.equal(FMG.saveIntegrityValidator.validate(FMG.gameState).valid, true, "SaveIntegrityValidator debe aceptar save valido");

  console.log("Architectural hardening tests passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
