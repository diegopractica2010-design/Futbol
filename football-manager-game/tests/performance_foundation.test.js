const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
function noop() {}

function makeContext(canvas) {
  return new Proxy({ canvas, fillStyle: "", strokeStyle: "", font: "", textAlign: "", lineWidth: 1, globalAlpha: 1 }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: noop });
      if (prop === "measureText") return (text) => ({ width: String(text).length * 7 });
      return noop;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function makeCanvas(width = 780, height = 520) {
  return {
    width,
    height,
    style: {},
    getContext() {
      if (!this._ctx) this._ctx = makeContext(this);
      return this._ctx;
    }
  };
}

global.window = global;
global.document = { createElement: () => makeCanvas() };
global.addEventListener = noop;
global.removeEventListener = noop;
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = noop;
global.performance = { _now: 0, now() { return this._now; } };
window.FMG = {};

[
  "src/performance.js",
  "src/phase16/constants.js",
  "src/phase16/InputSystem.js",
  "src/phase16/BallSystem.js",
  "src/phase16/MatchSystem.js",
  "src/phase16/AISystem.js",
  "src/phase16/AnimationSystem.js",
  "src/phase16/CameraSystem.js",
  "src/phase16/HUDSystem.js",
  "src/phase16/AudioSystem.js",
  "src/phase16/index.js",
  "src/phase18/Formation.js",
  "src/phase18/PlayerRole.js",
  "src/phase18/DecisionSystem.js",
  "src/phase18/MovementSystem.js",
  "src/phase18/TeamBrain.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;

const profiler = new FMG.Performance.Profiler();
performance._now = 0;
profiler.beginFrame();
profiler.begin("logic");
performance._now = 4;
profiler.end("logic");
performance._now = 16;
profiler.endFrame();
assert.equal(profiler.snapshot().fps, 63, "profiler debe calcular FPS aproximado");
assert.ok(profiler.sections.logic.avgMs >= 4, "profiler debe medir secciones");

let resetCount = 0;
const pool = new FMG.Performance.ObjectPool(() => ({ value: 0 }), (item) => { item.value = 0; resetCount++; }, 1, 2);
const pooled = pool.acquire();
pooled.value = 9;
assert.equal(pool.size(), 0, "pool debe entregar objetos precreados");
pool.release(pooled);
assert.equal(resetCount, 1, "pool debe resetear objetos liberados");
assert.equal(pool.acquire().value, 0, "pool debe reutilizar objetos");

const renderOpt = new FMG.Performance.RenderOptimizer();
renderOpt.beginFrame({ width: 200, height: 100 }, { x: 100, y: 50, zoom: 1 }, 780, 520);
assert.equal(renderOpt.shouldDrawWorld(100, 50, 5), true, "culling debe aceptar objetos visibles");
assert.equal(renderOpt.shouldDrawWorld(500, 500, 5), false, "culling debe rechazar objetos fuera de camara");

const match = new FMG.Phase16.MatchSystem();
assert.strictEqual(match.allPlayers(), match.allPlayers(), "allPlayers debe reutilizar cache y no allocar arrays por tick");

const brain = new FMG.Phase18.TeamBrain(0, true);
brain.init();
brain.tick(match.userTeam, match.aiTeam, new FMG.Phase16.BallSystem(), match, 1);
const nearDecision = brain._decisions[match.userTeam[0].id];
brain.tick(match.userTeam, match.aiTeam, new FMG.Phase16.BallSystem(), match, 2);
assert.ok(nearDecision, "IA debe generar decisiones con throttling activo");
assert.ok(brain._formation && brain._movSys, "IA debe conservar sistemas reutilizables");

console.log("Performance foundation tests passed");
