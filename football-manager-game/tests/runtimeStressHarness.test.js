const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function makeNode(name) {
  return {
    nodeName: name.toUpperCase(),
    className: name,
    isConnected: true,
    innerHTML: "",
    children: [],
    setAttribute() {},
    appendChild(child) {
      child.isConnected = true;
      this.children.push(child);
    },
    contains(node) {
      return node === this || this.children.includes(node);
    },
    querySelector(selector) {
      this._nodes = this._nodes || {};
      this._nodes[selector] = this._nodes[selector] || makeNode(selector.replace(/[^a-z]/gi, "") || "node");
      return this._nodes[selector];
    }
  };
}

let rafId = 1;
const rafs = new Map();
const app = makeNode("app");

global.window = global;
global.document = {
  body: makeNode("body"),
  documentElement: makeNode("html"),
  createElement: (tag) => makeNode(tag),
  querySelector: (selector) => selector === "#app" ? app : null,
  addEventListener() {},
  removeEventListener() {}
};
global.document.documentElement.children = [app, global.document.body];
global.navigator = { deviceMemory: 8, hardwareConcurrency: 8 };
global.performance = { now: () => Date.now(), memory: { usedJSHeapSize: 2000000 } };
global.requestAnimationFrame = (fn) => {
  const id = rafId++;
  rafs.set(id, fn);
  setTimeout(() => {
    if (rafs.has(id)) {
      rafs.delete(id);
      fn(Date.now());
    }
  }, 0);
  return id;
};
global.cancelAnimationFrame = (id) => rafs.delete(id);
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = String(value); },
  getItem(key) { return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null; },
  removeItem(key) { delete this.data[key]; },
  clear() { this.data = {}; },
  key(index) { return Object.keys(this.data)[index] || null; },
  get length() { return Object.keys(this.data).length; }
};

[
  "src/utils.js",
  "src/architecture.js",
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
  "src/advancedTransferMarket.js",
  "src/advancedYouthAcademy.js",
  "src/squadPsychology.js",
  "src/gameEngine.js",
  "src/runtimeHardening.js"
].forEach((file) => vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file }));

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");
FMG.persistentUIShell = new FMG.Hardening.PersistentUIShell(app, FMG.renderScheduler);
FMG.render = function () {
  FMG.persistentUIShell.render({
    nav: "<nav>stress</nav>",
    route: `<section>${FMG.gameState.route}</section>`,
    overlay: ""
  });
};

const fakeReplay = {
  replay() {
    return { finalState: { _calculateChecksum: () => "stable-checksum" } };
  }
};
const replayHarness = new FMG.Hardening.ReplayStressHarness({
  replayEngine: fakeReplay,
  snapshotId: "snap-stress",
  actions: [{ type: "ADVANCE_WEEK", payload: {} }]
});

const replayReport = replayHarness.run({ loops: 30 });
assert.equal(replayReport.ok, true, "ReplayStressHarness debe mantener checksum estable");
assert.equal(replayReport.checks.loops, 30, "ReplayStressHarness debe ejecutar loops");

const saveReport = FMG.saveStressHarness.run({ loops: 4, corruption: true });
assert.equal(saveReport.ok, true, "SaveStressHarness debe soportar save/load/corrupcion");
assert.equal(saveReport.checks.corruptionRecovered, true, "SaveStressHarness debe recuperar corrupcion");

const uiReport = FMG.uiNavStressHarness.run({ loops: 60 });
assert.equal(uiReport.ok, true, "UINavStressHarness debe soportar spam de navegacion");
assert.ok(FMG.generateUIStabilityReport().checks.loops >= 60, "UI stability report debe exponer ultima corrida");

const memoryReport = FMG.memoryStressHarness.run({ loops: 25, allocate: true });
assert.equal(memoryReport.ok, true, "MemoryStressHarness no debe acumular listeners/detached nodes");

const worldReport = FMG.worldSimulationHarness.run({ weeks: 3, matchLoops: 2, failOnBlockedWeek: false });
assert.equal(worldReport.ok, true, "WorldSimulationHarness debe tolerar capas bloqueadas sin excepcion");
assert.ok(worldReport.checks.matchAttempts >= 0, "WorldSimulationHarness debe reportar match spam");

const runtimeReport = FMG.runRuntimeStress({
  browser: { requireDocument: true, requireApp: true },
  replay: { loops: 5 },
  save: { loops: 2, corruption: true },
  ui: { loops: 10 },
  memory: { loops: 5 },
  world: { weeks: 1, matchLoops: 1, failOnBlockedWeek: false }
});
assert.equal(runtimeReport.ok, true, "RuntimeStressHarness debe orquestar todas las capas");
assert.equal(FMG.generateRuntimeStressReport().name, "runtime-stress", "runtime stress report debe quedar disponible");
assert.ok(FMG.generateReplayStabilityReport().checks, "replay stability report debe existir");
assert.ok(FMG.generateSaveStabilityReport().checks, "save stability report debe existir");
assert.ok(FMG.generateStressMemoryReport().checks, "memory report debe existir");

console.log("Runtime stress harness tests passed");
