(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Diagnostics = FMG.Core.Diagnostics || {};

  function nowMs() {
    if (typeof performance !== "undefined" && performance.now) return performance.now();
    return FMG.nowMs ? FMG.nowMs() : Date.UTC(2025, 0, 1, 12, 0, 0);
  }

  function stableStringify(value) {
    const seen = [];
    return JSON.stringify(value, function (key, item) {
      if (item && typeof item === "object") {
        if (seen.indexOf(item) >= 0) return "[Circular]";
        seen.push(item);
        if (!Array.isArray(item)) {
          const sorted = {};
          Object.keys(item).sort().forEach((name) => {
            if (typeof item[name] !== "function") sorted[name] = item[name];
          });
          return sorted;
        }
      }
      return item;
    });
  }

  function hashString(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36);
  }

  function byteLength(value) {
    try {
      return stableStringify(value).length * 2;
    } catch (error) {
      return 0;
    }
  }

  function RuntimeValidationSystem() {}

  RuntimeValidationSystem.prototype.validateState = function (state) {
    const errors = [];
    const warnings = [];

    if (!state) errors.push("State is required");
    if (state && typeof state.validate === "function") {
      const result = state.validate();
      if (!result.valid) errors.push.apply(errors, result.errors);
    }
    if (state && Array.isArray(state.clubs)) {
      const ids = {};
      state.clubs.forEach((club, index) => {
        const id = club.teamId || club.id;
        if (!id) errors.push("Club " + index + " missing id");
        if (id && ids[id]) errors.push("Duplicate club id " + id);
        ids[id] = true;
        if (club.squad && club.squad.length > 80) warnings.push("Large squad on " + id);
      });
    }
    if (state && state.season && Array.isArray(state.season.fixtures)) {
      state.season.fixtures.forEach((fixture, index) => {
        if (!Array.isArray(fixture.matches)) errors.push("Fixture " + index + " missing matches");
      });
    }
    if (state && Number.isFinite(state.generation) && state.generation < 0) errors.push("Generation cannot be negative");

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      checksum: state && typeof state._calculateChecksum === "function" ? state._calculateChecksum() : hashString(stableStringify(state || null))
    };
  };

  RuntimeValidationSystem.prototype.validateLegacyState = function (state) {
    const errors = [];
    const warnings = [];
    if (!state || typeof state !== "object") errors.push("Legacy state is required");
    if (state && !Array.isArray(state.teams)) errors.push("teams must be array");
    if (state && !Array.isArray(state.players)) errors.push("players must be array");
    if (state && !Array.isArray(state.fixtures)) errors.push("fixtures must be array");
    if (state && state.players) {
      const playerIds = {};
      state.players.forEach((player) => {
        if (!player.id) errors.push("Player missing id");
        if (player.id && playerIds[player.id]) errors.push("Duplicate player id " + player.id);
        playerIds[player.id] = true;
        if (player.overall < 1 || player.overall > 120) errors.push("Player overall out of range " + player.id);
      });
    }
    if (state && state.notifications && state.notifications.length > 20) warnings.push("Notification queue is larger than expected");
    return { ok: errors.length === 0, errors, warnings, checksum: hashString(stableStringify(state || null)) };
  };

  function SnapshotValidator() {
    this.lastResult = null;
  }

  SnapshotValidator.prototype.validateSnapshot = function (snapshot) {
    const data = snapshot && (snapshot.data || snapshot);
    const errors = [];
    if (!data) errors.push("Snapshot data is required");
    if (data && !data.stateId) errors.push("Snapshot missing stateId");
    if (data && !Number.isFinite(data.generation)) errors.push("Snapshot missing generation");
    if (data && data.checksum && FMG.Core.Engine && FMG.Core.Engine.GameState) {
      const restored = FMG.Core.Engine.GameState.fromSnapshot(data);
      const checksum = restored && restored._calculateChecksum();
      if (checksum !== data.checksum) errors.push("Snapshot checksum mismatch");
    }
    this.lastResult = { ok: errors.length === 0, errors, generation: data ? data.generation : null };
    return this.lastResult;
  };

  SnapshotValidator.prototype.validateStore = function (store) {
    const errors = [];
    const list = store && typeof store.list === "function" ? store.list() : [];
    for (let index = 0; index < list.length; index += 1) {
      const entry = list[index];
      const snapshot = store.snapshots && store.snapshots[entry.id];
      const result = this.validateSnapshot(snapshot);
      if (!result.ok) errors.push(entry.id + ": " + result.errors.join("; "));
    }
    return { ok: errors.length === 0, errors, count: list.length };
  };

  function ReplayValidator() {
    this.lastResult = null;
  }

  ReplayValidator.prototype.validate = function (replayEngine, snapshotId, actions, expectedChecksum) {
    if (!replayEngine || typeof replayEngine.replay !== "function") {
      return { ok: false, errors: ["ReplayEngine required"] };
    }
    const startedAt = nowMs();
    try {
      const result = replayEngine.replay(snapshotId, actions || []);
      const actualChecksum = result.finalState && result.finalState._calculateChecksum ? result.finalState._calculateChecksum() : null;
      const ok = expectedChecksum === undefined || expectedChecksum === null || actualChecksum === expectedChecksum;
      this.lastResult = {
        ok,
        errors: ok ? [] : ["Replay checksum mismatch"],
        actionsProcessed: result.actionsProcessed,
        expectedChecksum: expectedChecksum || actualChecksum,
        actualChecksum,
        elapsedMs: Math.round((nowMs() - startedAt) * 100) / 100
      };
      return this.lastResult;
    } catch (error) {
      this.lastResult = { ok: false, errors: [error.message], actionsProcessed: 0, elapsedMs: Math.round((nowMs() - startedAt) * 100) / 100 };
      return this.lastResult;
    }
  };

  function TransactionValidator() {}

  TransactionValidator.prototype.validateContext = function (context) {
    const errors = [];
    if (!context || !context.action || !context.action.type) errors.push("Transition action missing type");
    if (context && context.previousState && context.newState) {
      if (context.newState.generation <= context.previousState.generation) errors.push("Generation did not advance");
      if (context.newState.parentStateId !== context.previousState.stateId) errors.push("Parent state lineage mismatch");
    }
    return { ok: errors.length === 0, errors };
  };

  function DeterministicConsistencyChecker() {
    this.history = [];
  }

  DeterministicConsistencyChecker.prototype.record = function (label, state) {
    const checksum = state && typeof state._calculateChecksum === "function" ? state._calculateChecksum() : hashString(stableStringify(state || null));
    const record = { label, checksum, generation: state && state.generation, at: nowMs() };
    this.history.unshift(record);
    this.history = this.history.slice(0, 120);
    return record;
  };

  DeterministicConsistencyChecker.prototype.compare = function (left, right) {
    const leftHash = hashString(stableStringify(left || null));
    const rightHash = hashString(stableStringify(right || null));
    return { ok: leftHash === rightHash, leftHash, rightHash };
  };

  function StateDiffDebugger() {}

  StateDiffDebugger.prototype.diff = function (before, after, limit) {
    const changes = [];
    limit = limit || 80;
    walk("", before, after);
    return changes;

    function walk(path, left, right) {
      if (changes.length >= limit) return;
      if (left === right) return;
      if (!left || !right || typeof left !== "object" || typeof right !== "object") {
        changes.push({ path: path || "$", before: left, after: right });
        return;
      }
      const keys = {};
      Object.keys(left).forEach((key) => { keys[key] = true; });
      Object.keys(right).forEach((key) => { keys[key] = true; });
      Object.keys(keys).sort().forEach((key) => walk(path ? path + "." + key : key, left[key], right[key]));
    }
  };

  function MemoryTracker(options) {
    options = options || {};
    this.samples = [];
    this.maxSamples = options.maxSamples || 120;
    this.warningBytes = options.warningBytes || 220 * 1024 * 1024;
  }

  MemoryTracker.prototype.sample = function (state) {
    const performanceMemory = typeof performance !== "undefined" && performance.memory ? performance.memory : null;
    const sample = {
      at: nowMs(),
      usedJSHeapSize: performanceMemory ? performanceMemory.usedJSHeapSize : 0,
      totalJSHeapSize: performanceMemory ? performanceMemory.totalJSHeapSize : 0,
      stateBytes: byteLength(state),
      warning: false
    };
    sample.warning = (sample.usedJSHeapSize && sample.usedJSHeapSize > this.warningBytes) || sample.stateBytes > 32 * 1024 * 1024;
    this.samples.unshift(sample);
    this.samples = this.samples.slice(0, this.maxSamples);
    return sample;
  };

  MemoryTracker.prototype.snapshot = function () {
    return this.samples[0] || { usedJSHeapSize: 0, totalJSHeapSize: 0, stateBytes: 0, warning: false };
  };

  function EventListenerLeakDetector(options) {
    options = options || {};
    this.warningThreshold = options.warningThreshold || 40;
    this.samples = [];
  }

  EventListenerLeakDetector.prototype.inspectEventBus = function (bus) {
    const handlers = bus && bus._handlers ? bus._handlers : {};
    const counts = {};
    let total = 0;
    Object.keys(handlers).forEach((type) => {
      counts[type] = handlers[type].length;
      total += counts[type];
    });
    const leaks = Object.keys(counts).filter((type) => counts[type] > this.warningThreshold);
    const result = { ok: leaks.length === 0, total, counts, leaks };
    this.samples.unshift(result);
    this.samples = this.samples.slice(0, 60);
    return result;
  };

  function BrowserRuntimeSafetyLayer() {
    this.errors = [];
    this.installed = false;
  }

  BrowserRuntimeSafetyLayer.prototype.install = function () {
    if (this.installed || typeof window === "undefined" || !window.addEventListener) return false;
    this.installed = true;
    window.addEventListener("error", (event) => {
      this.capture(event.error || event.message, "window.error");
    });
    window.addEventListener("unhandledrejection", (event) => {
      this.capture(event.reason || "Unhandled rejection", "unhandledrejection");
    });
    return true;
  };

  BrowserRuntimeSafetyLayer.prototype.capture = function (error, source) {
    const message = error && error.message ? error.message : String(error);
    const record = { source, message, at: FMG.nowISO ? FMG.nowISO("runtime-error") : "2025-01-01T12:00:00.000Z" };
    this.errors.unshift(record);
    this.errors = this.errors.slice(0, 20);
    if (FMG.gameState && FMG.pushSystemError) FMG.pushSystemError(FMG.gameState, "Error de runtime capturado.", message);
    return record;
  };

  BrowserRuntimeSafetyLayer.prototype.safe = function (label, fn, fallback) {
    try {
      return fn();
    } catch (error) {
      this.capture(error, label);
      return typeof fallback === "function" ? fallback(error) : fallback;
    }
  };

  function UISynchronizationValidator() {
    this.lastResult = null;
  }

  UISynchronizationValidator.prototype.validate = function (state) {
    const errors = [];
    if (!state) errors.push("State missing");
    if (state && state.uiState && state.ui && state.uiState.route !== state.ui.route) errors.push("uiState route diverged from ui route");
    if (state && state.currentWeek && state.simulationState && state.currentWeek !== state.simulationState.week) errors.push("simulationState week diverged");
    this.lastResult = { ok: errors.length === 0, errors };
    return this.lastResult;
  };

  function SimulationProfiler() {
    this.frames = [];
    this.sections = {};
  }

  SimulationProfiler.prototype.time = function (name, fn) {
    const startedAt = nowMs();
    try {
      return fn();
    } finally {
      this.record(name, nowMs() - startedAt);
    }
  };

  SimulationProfiler.prototype.record = function (name, elapsedMs) {
    const section = this.sections[name] || (this.sections[name] = { calls: 0, avgMs: 0, maxMs: 0, lastMs: 0 });
    section.calls += 1;
    section.lastMs = Math.round(elapsedMs * 100) / 100;
    section.avgMs += (elapsedMs - section.avgMs) / Math.min(section.calls, 120);
    section.maxMs = Math.max(section.maxMs * 0.99, elapsedMs);
    return section;
  };

  SimulationProfiler.prototype.snapshot = function () {
    return { sections: this.sections };
  };

  function EntityPriorityManager() {}

  EntityPriorityManager.prototype.score = function (entity, context) {
    context = context || {};
    let score = 10;
    const id = entity && (entity.id || entity.teamId || entity.playerId);
    if (context.userTeamId && entity && (entity.teamId === context.userTeamId || entity.id === context.userTeamId)) score += 80;
    if (entity && entity.active === false) score -= 20;
    if (entity && entity.injuredWeeks > 0) score -= 8;
    if (entity && entity.overall) score += Math.round(entity.overall / 10);
    return { id, score };
  };

  EntityPriorityManager.prototype.rank = function (entities, context) {
    return (entities || []).map((entity) => ({ entity, priority: this.score(entity, context).score }))
      .sort((left, right) => right.priority - left.priority);
  };

  function PerformanceScalingController(options) {
    options = options || {};
    this.profile = options.profile || "balanced";
    this.hardware = { cpu: "amd-fx-safe", ramGb: 16, storage: "hdd-friendly", gpu: "low-end-safe" };
    this.budgets = { frameMs: 16.7, simulationMs: 8, backgroundJobsPerTick: 4, maxActiveEntities: 420 };
    this.lastDecision = null;
  }

  PerformanceScalingController.prototype.evaluate = function (metrics) {
    metrics = metrics || {};
    let tier = "normal";
    if ((metrics.avgFrameMs || 0) > 24 || (metrics.stateBytes || 0) > 28 * 1024 * 1024) tier = "conservative";
    if ((metrics.avgFrameMs || 0) > 34 || metrics.memoryWarning) tier = "survival";
    this.lastDecision = {
      tier,
      budgets: {
        frameMs: tier === "normal" ? 16.7 : tier === "conservative" ? 24 : 34,
        simulationMs: tier === "normal" ? 8 : tier === "conservative" ? 5 : 3,
        backgroundJobsPerTick: tier === "normal" ? 4 : tier === "conservative" ? 2 : 1,
        maxActiveEntities: tier === "normal" ? 420 : tier === "conservative" ? 260 : 140
      }
    };
    return this.lastDecision;
  };

  function WorldSimulationOptimizer() {
    this.priorityManager = new EntityPriorityManager();
  }

  WorldSimulationOptimizer.prototype.chunkWorld = function (entities, options) {
    options = options || {};
    const chunkSize = options.chunkSize || 128;
    const ranked = this.priorityManager.rank(entities || [], options);
    const chunks = [];
    for (let index = 0; index < ranked.length; index += chunkSize) {
      chunks.push({
        id: "chunk-" + (chunks.length + 1),
        priority: ranked[index] ? ranked[index].priority : 0,
        entities: ranked.slice(index, index + chunkSize).map((item) => item.entity)
      });
    }
    return chunks;
  };

  WorldSimulationOptimizer.prototype.abstractInactiveNPCs = function (players, context) {
    const ranked = this.priorityManager.rank(players || [], context || {});
    const activeLimit = (context && context.maxActiveEntities) || 260;
    return {
      active: ranked.slice(0, activeLimit).map((item) => item.entity),
      abstracted: ranked.slice(activeLimit).map((item) => ({
        id: item.entity.id,
        teamId: item.entity.teamId,
        overall: item.entity.overall,
        morale: item.entity.morale,
        energy: item.entity.energy
      }))
    };
  };

  WorldSimulationOptimizer.prototype.planBackgroundSimulation = function (state, scalingDecision) {
    const jobs = state && state.simulationState ? state.simulationState.pendingJobs || [] : [];
    const budget = scalingDecision && scalingDecision.budgets ? scalingDecision.budgets.backgroundJobsPerTick : 2;
    return { immediate: jobs.slice(0, budget), deferred: jobs.slice(budget), budget };
  };

  function AsyncSafeWorldUpdater() {
    this._busy = false;
    this._queue = [];
  }

  AsyncSafeWorldUpdater.prototype.enqueue = function (label, update) {
    this._queue.push({ label, update });
    return this._queue.length;
  };

  AsyncSafeWorldUpdater.prototype.flush = function (state, budgetMs) {
    if (this._busy) return { ok: false, reason: "busy", processed: 0 };
    this._busy = true;
    const startedAt = nowMs();
    let processed = 0;
    try {
      while (this._queue.length && nowMs() - startedAt < (budgetMs || 4)) {
        const item = this._queue.shift();
        item.update(state);
        processed += 1;
      }
      return { ok: true, processed, remaining: this._queue.length };
    } finally {
      this._busy = false;
    }
  };

  function EventCompressor() {}

  EventCompressor.prototype.compress = function (events, limit) {
    const output = [];
    const seen = {};
    (events || []).forEach((event) => {
      const key = event.type + "|" + hashString(stableStringify(event.payload || {}));
      if (seen[key]) {
        seen[key].count += 1;
        return;
      }
      const item = { type: event.type, payload: event.payload, timestamp: event.timestamp || event.createdAt, count: 1 };
      seen[key] = item;
      output.push(item);
    });
    return output.slice(0, limit || 200);
  };

  function ReplayCompressor() {}

  ReplayCompressor.prototype.compress = function (actions) {
    return (actions || []).map((action) => ({
      t: action.type,
      p: action.payload || {},
      c: hashString(stableStringify(action.payload || {}))
    }));
  };

  ReplayCompressor.prototype.expand = function (packed) {
    return (packed || []).map((action) => ({ type: action.t, payload: action.p || {} }));
  };

  function SaveValidationSystem() {}

  SaveValidationSystem.prototype.validate = function (save) {
    const game = save && (save.game || save);
    const errors = [];
    if (!game) errors.push("Save payload missing game state");
    if (game && !Array.isArray(game.teams)) errors.push("Save missing teams");
    if (game && !Array.isArray(game.players)) errors.push("Save missing players");
    if (game && !Array.isArray(game.fixtures)) errors.push("Save missing fixtures");
    if (game && game.version && game.version > (FMG.CURRENT_VERSION || 1)) errors.push("Save version is newer than runtime");
    return { ok: errors.length === 0, errors, version: game && game.version ? game.version : 1 };
  };

  function MigrationSafePersistenceSystem() {
    this.currentVersion = FMG.CURRENT_VERSION || 1;
  }

  MigrationSafePersistenceSystem.prototype.wrap = function (state) {
    const payload = FMG.deepClone ? FMG.deepClone(state) : JSON.parse(JSON.stringify(state));
    payload.version = FMG.CURRENT_VERSION || payload.version || 1;
    payload.persistence = {
      schema: "fmg-save",
      version: payload.version,
      checksum: hashString(stableStringify(payload)),
      createdAt: FMG.nowISO ? FMG.nowISO("persistence-wrap") : "2025-01-01T12:00:00.000Z"
    };
    return payload;
  };

  MigrationSafePersistenceSystem.prototype.verify = function (state) {
    if (!state || !state.persistence) return { ok: true, warning: "legacy-save" };
    const copy = Object.assign({}, state);
    const persistence = copy.persistence;
    delete copy.persistence;
    return { ok: Boolean(persistence.checksum), version: persistence.version, checksum: persistence.checksum };
  };

  function LongTermSimulationStressTester() {}

  LongTermSimulationStressTester.prototype.runLegacyWeeks = function (state, weeks, advanceFn) {
    const report = { ok: true, weeksRun: 0, errors: [] };
    for (let index = 0; index < weeks; index += 1) {
      const result = advanceFn(state);
      if (!result || result.ok === false) {
        report.ok = false;
        report.errors.push(result ? result.message : "advance failed");
        break;
      }
      report.weeksRun += 1;
    }
    return report;
  };

  function DebugOverlay(controller) {
    this.controller = controller;
    this.enabled = false;
    this.node = null;
    this.timer = 0;
  }

  DebugOverlay.prototype.mount = function () {
    if (typeof document === "undefined" || this.node) return false;
    this.node = document.createElement("aside");
    this.node.className = "debug-overlay";
    this.node.setAttribute("aria-label", "FMG runtime diagnostics");
    document.body.appendChild(this.node);
    return true;
  };

  DebugOverlay.prototype.setEnabled = function (enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled) {
      this.mount();
      this.start();
    } else {
      this.stop();
      if (this.node) this.node.style.display = "none";
    }
  };

  DebugOverlay.prototype.start = function () {
    if (this.timer || typeof window === "undefined") return;
    const tick = () => {
      this.render();
      this.timer = window.setTimeout(tick, 1000);
    };
    tick();
  };

  DebugOverlay.prototype.stop = function () {
    if (this.timer && typeof window !== "undefined") window.clearTimeout(this.timer);
    this.timer = 0;
  };

  DebugOverlay.prototype.render = function () {
    if (!this.enabled || !this.node) return;
    this.node.style.display = "block";
    const snapshot = this.controller.snapshot();
    this.node.innerHTML = [
      "<strong>FMG Diagnostics</strong>",
      "<span>Health: " + (snapshot.health.ok ? "OK" : "WARN") + "</span>",
      "<span>Scale: " + snapshot.scaling.tier + "</span>",
      "<span>State: " + Math.round((snapshot.memory.stateBytes || 0) / 1024) + " KB</span>",
      "<span>Listeners: " + snapshot.listeners.total + "</span>",
      "<span>Replay: " + (snapshot.replay && snapshot.replay.ok !== false ? "OK" : "pending") + "</span>"
    ].join("");
  };

  function RuntimeDiagnosticsController(options) {
    options = options || {};
    this.validation = new RuntimeValidationSystem();
    this.snapshotValidator = new SnapshotValidator();
    this.replayValidator = new ReplayValidator();
    this.transactionValidator = new TransactionValidator();
    this.determinism = new DeterministicConsistencyChecker();
    this.diffDebugger = new StateDiffDebugger();
    this.memoryTracker = new MemoryTracker(options.memory);
    this.listenerLeakDetector = new EventListenerLeakDetector(options.listeners);
    this.browserSafety = new BrowserRuntimeSafetyLayer();
    this.uiSyncValidator = new UISynchronizationValidator();
    this.profiler = new SimulationProfiler();
    this.scalingController = new PerformanceScalingController(options.scaling);
    this.worldOptimizer = new WorldSimulationOptimizer();
    this.entityPriorityManager = new EntityPriorityManager();
    this.asyncWorldUpdater = new AsyncSafeWorldUpdater();
    this.eventCompressor = new EventCompressor();
    this.replayCompressor = new ReplayCompressor();
    this.saveValidator = new SaveValidationSystem();
    this.persistence = new MigrationSafePersistenceSystem();
    this.stressTester = new LongTermSimulationStressTester();
    this.overlay = new DebugOverlay(this);
    this.health = { ok: true, errors: [], warnings: [] };
    this.engine = null;
  }

  RuntimeDiagnosticsController.prototype.attachEngine = function (engine) {
    this.engine = engine;
    this.browserSafety.install();
    return this;
  };

  RuntimeDiagnosticsController.prototype.beforeTransition = function (context) {
    const validation = this.validation.validateState(context.currentState);
    if (!validation.ok) throw new Error("Runtime validation failed: " + validation.errors.join("; "));
    this.determinism.record("before:" + context.action.type, context.currentState);
  };

  RuntimeDiagnosticsController.prototype.afterTransition = function (context) {
    const transaction = this.transactionValidator.validateContext(context);
    const validation = this.validation.validateState(context.newState);
    const snapshotDiff = this.diffDebugger.diff(context.previousState.snapshot ? context.previousState.snapshot() : context.previousState, context.newState.snapshot ? context.newState.snapshot() : context.newState, 24);
    this.determinism.record("after:" + context.action.type, context.newState);
    this.memoryTracker.sample(context.newState);
    this.health = {
      ok: transaction.ok && validation.ok,
      errors: transaction.errors.concat(validation.errors),
      warnings: validation.warnings,
      lastDiffCount: snapshotDiff.length
    };
    return this.health;
  };

  RuntimeDiagnosticsController.prototype.captureError = function (error, source) {
    this.health.ok = false;
    this.health.errors.unshift((source || "runtime") + ": " + (error && error.message ? error.message : error));
    this.health.errors = this.health.errors.slice(0, 20);
    this.browserSafety.capture(error, source || "runtime");
  };

  RuntimeDiagnosticsController.prototype.validateReplay = function () {
    if (!this.engine || !this.engine.snapshotStore || !this.engine.replayEngine) return { ok: true, skipped: true, reason: "engine not attached" };
    const snapshots = this.engine.snapshotStore.list();
    if (!snapshots.length) return { ok: true, skipped: true, reason: "no snapshots" };
    const latest = snapshots[snapshots.length - 1];
    const state = this.engine.snapshotStore.load(latest.id);
    return this.replayValidator.validate(this.engine.replayEngine, latest.id, [], state._calculateChecksum());
  };

  RuntimeDiagnosticsController.prototype.snapshot = function () {
    const state = this.engine && this.engine.getState ? this.engine.getState() : (FMG.gameState || null);
    const memory = this.memoryTracker.sample(state);
    const listeners = this.listenerLeakDetector.inspectEventBus(this.engine && this.engine.eventBus ? this.engine.eventBus : FMG.eventBus);
    const ui = this.uiSyncValidator.validate(FMG.gameState || null);
    const scaling = this.scalingController.evaluate({
      stateBytes: memory.stateBytes,
      memoryWarning: memory.warning,
      avgFrameMs: FMG.Performance && FMG.Performance.globalProfiler ? FMG.Performance.globalProfiler.avgFrameMs : 0
    });
    return {
      health: this.health,
      memory,
      listeners,
      ui,
      scaling,
      profiler: this.profiler.snapshot(),
      replay: this.replayValidator.lastResult
    };
  };

  RuntimeDiagnosticsController.prototype.enableOverlay = function (enabled) {
    this.overlay.setEnabled(enabled !== false);
    return this.overlay;
  };

  FMG.Core.Diagnostics.RuntimeValidationSystem = RuntimeValidationSystem;
  FMG.Core.Diagnostics.ReplayValidator = ReplayValidator;
  FMG.Core.Diagnostics.SnapshotValidator = SnapshotValidator;
  FMG.Core.Diagnostics.TransactionValidator = TransactionValidator;
  FMG.Core.Diagnostics.DeterministicConsistencyChecker = DeterministicConsistencyChecker;
  FMG.Core.Diagnostics.StateDiffDebugger = StateDiffDebugger;
  FMG.Core.Diagnostics.MemoryTracker = MemoryTracker;
  FMG.Core.Diagnostics.EventListenerLeakDetector = EventListenerLeakDetector;
  FMG.Core.Diagnostics.BrowserRuntimeSafetyLayer = BrowserRuntimeSafetyLayer;
  FMG.Core.Diagnostics.UISynchronizationValidator = UISynchronizationValidator;
  FMG.Core.Diagnostics.SimulationProfiler = SimulationProfiler;
  FMG.Core.Diagnostics.PerformanceScalingController = PerformanceScalingController;
  FMG.Core.Diagnostics.WorldSimulationOptimizer = WorldSimulationOptimizer;
  FMG.Core.Diagnostics.EntityPriorityManager = EntityPriorityManager;
  FMG.Core.Diagnostics.AsyncSafeWorldUpdater = AsyncSafeWorldUpdater;
  FMG.Core.Diagnostics.EventCompressor = EventCompressor;
  FMG.Core.Diagnostics.ReplayCompressor = ReplayCompressor;
  FMG.Core.Diagnostics.SaveValidationSystem = SaveValidationSystem;
  FMG.Core.Diagnostics.MigrationSafePersistenceSystem = MigrationSafePersistenceSystem;
  FMG.Core.Diagnostics.LongTermSimulationStressTester = LongTermSimulationStressTester;
  FMG.Core.Diagnostics.RuntimeDiagnosticsController = RuntimeDiagnosticsController;
})();
