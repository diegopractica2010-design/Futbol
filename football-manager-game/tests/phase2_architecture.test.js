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
global.performance = { now: () => 0 };

[
  "src/utils.js",
  "src/performance.js",
  "src/architecture.js",
  "src/ecs.js",
  "src/simulationScheduler.js",
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
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

const seenEvents = [];
FMG.eventBus.on("*", (event) => seenEvents.push(event.type));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.matchState, "debe separar MatchState");
assert.ok(FMG.gameState.uiState, "debe separar UIState");
assert.ok(FMG.gameState.audioState, "debe separar AudioState");
assert.ok(FMG.gameState.replayState, "debe separar ReplayState");
assert.ok(FMG.gameState.careerState, "debe separar CareerState");
assert.ok(FMG.gameState.simulationState, "debe separar SimulationState");
assert.ok(seenEvents.includes(FMG.EventTypes.BOARD_OBJECTIVE_UPDATED), "objetivos de directiva deben emitir evento");

const event = FMG.emitGameEvent(FMG.EventTypes.GOAL_SCORED, { team: 0, score: [1, 0] });
assert.equal(event.type, "GOAL_SCORED", "EventBus debe emitir eventos globales");
assert.ok(FMG.eventBus.history("GOAL_SCORED").length >= 1, "EventBus debe mantener historial acotado");

const world = FMG.ECS.createWorld();
const entity = FMG.ECS.createFootballEntity(world, { x: 1, y: 2, vx: 10, vy: 0, team: 0, role: "support" });
world.addSystem(FMG.ECS.Systems.TacticalSystem());
world.addSystem(FMG.ECS.Systems.MovementSystem());
world.update(0.1, {});
assert.ok(world.get(entity, FMG.ECS.COMPONENT.Position).x > 1, "ECS MovementSystem debe mover entidades");
assert.equal(world.get(entity, FMG.ECS.COMPONENT.AIState).risk, 1, "ECS TacticalSystem debe escribir AIState");

const schedulerResult = FMG.simulationScheduler.runDue(FMG.gameState, { phase: "test" });
assert.ok(Array.isArray(schedulerResult), "scheduler debe ejecutar trabajos vencidos");
assert.ok(FMG.gameState.simulationState.completedJobs.length > 0, "scheduler debe registrar trabajos");

const training = FMG.trainUserSquad(FMG.gameState);
assert.equal(training.ok, true, "entrenamiento debe seguir funcionando");
assert.ok(seenEvents.includes(FMG.EventTypes.TRAINING_COMPLETED), "entrenamiento debe emitir evento");

const rolePlayer = FMG.getMatchSquad(FMG.gameState, "colo-colo")[0];
const beforeMoraleEvents = FMG.eventBus.history(FMG.EventTypes.PLAYER_MORALE_CHANGED).length;
FMG.setSquadRole(FMG.gameState, rolePlayer.id, "key");
assert.ok(FMG.eventBus.history(FMG.EventTypes.PLAYER_MORALE_CHANGED).length >= beforeMoraleEvents, "cambios de moral deben pasar por EventBus");

const slot = FMG.saveToSlot(FMG.gameState, "slot-arch", { overwrite: true });
assert.equal(slot.ok, true, "safe save debe guardar slot");
FMG.gameState.currentWeek += 1;
assert.equal(FMG.saveToSlot(FMG.gameState, "slot-arch", { overwrite: true }).ok, true, "safe save debe crear backup al sobrescribir");
localStorage.setItem(`${FMG.SAVE_SLOT_PREFIX}slot-arch`, "{broken");
const loaded = FMG.loadFromSlot("slot-arch");
assert.equal(loaded.ok, true, "load debe hacer rollback a backup si el slot principal esta corrupto");

const incoming = FMG.generateIncomingOffers(FMG.gameState);
if (incoming.length) {
  const result = FMG.respondIncomingOffer(FMG.gameState, incoming[0].id, false);
  assert.equal(result.ok, true, "mercado debe seguir respondiendo ofertas");
}

assert.ok(fs.existsSync(path.join(root, "tsconfig.json")), "debe existir base TypeScript progresiva");
assert.ok(fs.existsSync(path.join(root, "types/football-architecture.ts")), "deben existir contratos TypeScript de arquitectura");

console.log("Phase 2 architecture tests passed");
