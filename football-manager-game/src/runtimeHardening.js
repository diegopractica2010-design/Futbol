(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const FMG = (root.FMG = root.FMG || {});
  const Hardening = (FMG.Hardening = FMG.Hardening || {});

  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableStringify(value[key])).join(",") + "}";
  }

  function hashString(input) {
    const str = String(input || "");
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function splitChunks(value, maxChars) {
    const chunks = [];
    for (let i = 0; i < value.length; i += maxChars) chunks.push(value.slice(i, i + maxChars));
    return chunks;
  }

  class SimulationClock {
    constructor(config) {
      config = config || {};
      this.epochMs = config.epochMs || Date.UTC(2025, 0, 1, 12, 0, 0);
      this.tickMs = config.tickMs || 60000;
      this.tickIndex = config.tickIndex || 0;
      this.labels = [];
    }

    now() {
      return this.epochMs + this.tickIndex * this.tickMs;
    }

    iso() {
      return new Date(this.now()).toISOString();
    }

    tick(label) {
      this.labels.push(label || "tick");
      this.tickIndex += 1;
      return this.now();
    }

    snapshot() {
      return { epochMs: this.epochMs, tickMs: this.tickMs, tickIndex: this.tickIndex, labels: this.labels.slice(-50) };
    }

    restore(snapshot) {
      if (!snapshot) return;
      this.epochMs = snapshot.epochMs || this.epochMs;
      this.tickMs = snapshot.tickMs || this.tickMs;
      this.tickIndex = snapshot.tickIndex || 0;
      this.labels = (snapshot.labels || []).slice(-50);
    }
  }

  class DeterministicRNGEngine {
    constructor(seed) {
      this.seed = seed >>> 0 || 1;
      this.state = this.seed;
      this.counter = 0;
    }

    next() {
      this.state = (this.state + 0x6D2B79F5) >>> 0;
      let t = this.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      this.counter += 1;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    choice(items) {
      if (!items || !items.length) return null;
      return items[this.int(0, items.length - 1)];
    }

    snapshot() {
      return { seed: this.seed, state: this.state, counter: this.counter };
    }

    restore(snapshot) {
      if (!snapshot) return;
      this.seed = snapshot.seed >>> 0 || this.seed;
      this.state = snapshot.state >>> 0 || this.seed;
      this.counter = snapshot.counter || 0;
    }
  }

  class RuntimeAuthorityManager {
    constructor() {
      this.systems = new Map();
      this.authority = "FMG.Core";
      this.migrationReport = { migratedSystems: [], remainingLegacyDependencies: [], unsafeLegacyCalls: [] };
    }

    declare(system, config) {
      const entry = {
        system,
        owner: config.owner || this.authority,
        stateAuthority: config.stateAuthority || this.authority,
        mutationBoundary: config.mutationBoundary || "transaction",
        mode: config.mode || "authoritative"
      };
      this.systems.set(system, entry);
      if (entry.owner === this.authority) this.migrationReport.migratedSystems.push(system);
      if (entry.owner === "legacy") this.migrationReport.remainingLegacyDependencies.push(system);
      return entry;
    }

    isAuthoritative(system) {
      const entry = this.systems.get(system);
      return !entry || entry.owner === this.authority;
    }

    report() {
      const unique = (items) => Array.from(new Set(items));
      return {
        authority: this.authority,
        systems: Array.from(this.systems.values()),
        migratedSystems: unique(this.migrationReport.migratedSystems),
        remainingLegacyDependencies: unique(this.migrationReport.remainingLegacyDependencies),
        unsafeLegacyCalls: unique(this.migrationReport.unsafeLegacyCalls)
      };
    }
  }

  class RuntimeMutationGuard {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
      this.current = null;
      this.history = [];
      this.violations = [];
    }

    begin(system) {
      this.current = { system, writes: new Set(), startedAt: FMG.simulationClock ? FMG.simulationClock.now() : Date.now() };
      return this.current;
    }

    record(path) {
      if (!this.current) return;
      const key = String(path || "unknown");
      if (this.current.writes.has(key)) {
        this.violations.push({ type: "duplicate-write", system: this.current.system, path: key });
      }
      if (!this.authorityManager.isAuthoritative(this.current.system)) {
        this.violations.push({ type: "legacy-write", system: this.current.system, path: key });
        this.authorityManager.migrationReport.unsafeLegacyCalls.push(this.current.system + ":" + key);
      }
      this.current.writes.add(key);
    }

    end() {
      if (!this.current) return null;
      const result = { system: this.current.system, writes: Array.from(this.current.writes) };
      this.history.push(result);
      this.current = null;
      return result;
    }

    report() {
      return { recentTransactions: this.history.slice(-50), violations: this.violations.slice(-100) };
    }
  }

  class LegacyCompatibilityFacade {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
    }

    toCore() {
      if (!FMG.Core || !FMG.Core.Adapters || !FMG.Core.Adapters.legacyAdapter) return null;
      return FMG.Core.Adapters.legacyAdapter.toCore();
    }

    syncFromCore(coreState) {
      if (!FMG.Core || !FMG.Core.Adapters || !FMG.Core.Adapters.legacyAdapter) return null;
      this.authorityManager.declare("legacy-compatibility-facade", { owner: "legacy", stateAuthority: "FMG.Core", mode: "facade" });
      return FMG.Core.Adapters.legacyAdapter.syncFromCore(coreState);
    }
  }

  class RuntimeOwnershipValidator {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
    }

    validate(coreState, legacyState) {
      const errors = [];
      if (!coreState || !legacyState) return { valid: true, skipped: true, errors };
      if (coreState.season && coreState.season.week !== legacyState.currentWeek) errors.push("Core/legacy week divergence");
      if (coreState.season && coreState.season.number !== legacyState.seasonNumber) errors.push("Core/legacy season divergence");
      if ((coreState.clubs || []).length !== (legacyState.teams || []).length) errors.push("Core/legacy club count divergence");
      const corePlayers = (coreState.clubs || []).reduce((sum, club) => sum + ((club.squad || []).length), 0);
      if (corePlayers !== (legacyState.players || []).length) errors.push("Core/legacy player count divergence");
      return { valid: errors.length === 0, errors, authority: this.authorityManager.authority };
    }
  }

  class ReplayDiffEngine {
    diff(a, b) {
      const left = stableStringify(a);
      const right = stableStringify(b);
      if (left === right) return { equal: true, firstOffset: -1 };
      let index = 0;
      while (index < left.length && index < right.length && left[index] === right[index]) index += 1;
      return { equal: false, firstOffset: index, left: left.slice(index, index + 160), right: right.slice(index, index + 160) };
    }
  }

  class TickReplayInspector {
    constructor() {
      this.ticks = [];
    }

    record(tick, state, context) {
      const checksum = state && typeof state._calculateChecksum === "function" ? state._calculateChecksum() : hashString(stableStringify(state));
      this.ticks.push({ tick, checksum, context: context || null });
      return checksum;
    }

    firstDivergence(otherTicks) {
      const max = Math.max(this.ticks.length, (otherTicks || []).length);
      for (let i = 0; i < max; i++) {
        if (!this.ticks[i] || !otherTicks[i] || this.ticks[i].checksum !== otherTicks[i].checksum) return i;
      }
      return -1;
    }
  }

  class DeterministicReplayValidator {
    constructor() {
      this.diffEngine = new ReplayDiffEngine();
      this.lastReport = null;
    }

    validate(replayEngine, snapshotId, actions, expectedChecksum) {
      if (!replayEngine || !snapshotId) return { ok: false, skipped: true, reason: "missing replay engine or snapshot" };
      const result = replayEngine.validateDeterminism(snapshotId, actions || [], expectedChecksum);
      const valid = result.valid !== undefined ? result.valid : result.isDeterministic;
      this.lastReport = {
        ok: !!valid,
        snapshotId,
        actionCount: (actions || []).length,
        expectedChecksum,
        actualChecksum: result.actualChecksum || result.finalChecksum,
        divergenceTick: valid ? -1 : 0,
        errors: result.errors || []
      };
      return this.lastReport;
    }
  }

  class EventCausalityGraph {
    constructor() {
      this.nodes = new Map();
      this.edges = [];
    }

    addEvent(event) {
      const id = event.id || FMG.uid("cause");
      const node = {
        id,
        type: event.type || "event",
        cause: event.cause || null,
        context: event.context || {},
        systemChain: event.systemChain || [],
        emotionalState: event.emotionalState || null,
        tacticalContext: event.tacticalContext || null,
        mediaContext: event.mediaContext || null
      };
      this.nodes.set(id, node);
      (event.causedBy || []).forEach((from) => this.edges.push({ from, to: id }));
      return node;
    }

    explain(id) {
      const node = this.nodes.get(id);
      if (!node) return null;
      return { event: node, inbound: this.edges.filter((edge) => edge.to === id), outbound: this.edges.filter((edge) => edge.from === id) };
    }
  }

  class CausalReplayEngine {
    constructor(graph) {
      this.graph = graph || new EventCausalityGraph();
      this.events = [];
    }

    record(event) {
      const node = this.graph.addEvent(event);
      this.events.push(node);
      return node;
    }

    report() {
      return { events: this.events.length, graphNodes: this.graph.nodes.size, graphEdges: this.graph.edges.length };
    }
  }

  class HistoricalConsequenceTracker {
    constructor() {
      this.consequences = [];
    }

    record(consequence) {
      this.consequences.push({ ...consequence, recordedAt: FMG.nowISO ? FMG.nowISO("consequence") : new Date().toISOString() });
    }

    report() {
      return { count: this.consequences.length, recent: this.consequences.slice(-25) };
    }
  }

  class WorldMemoryGraph {
    constructor() {
      this.nodes = new Map();
      this.edges = new Map();
    }

    remember(entityId, memory) {
      const list = this.nodes.get(entityId) || [];
      list.push({ ...memory, tick: FMG.simulationClock ? FMG.simulationClock.tick("memory") : 0 });
      this.nodes.set(entityId, list.slice(-100));
    }

    relate(a, b, relation) {
      const key = [a, b].sort().join("::");
      const list = this.edges.get(key) || [];
      list.push({ ...relation, strength: relation.strength || 1 });
      this.edges.set(key, list.slice(-50));
    }

    report() {
      return { entitiesWithMemory: this.nodes.size, relationshipPairs: this.edges.size };
    }
  }

  class RelationshipMemorySystem {
    constructor(graph) {
      this.graph = graph;
    }

    record(entityA, entityB, type, context) {
      this.graph.relate(entityA, entityB, { type, context: context || {}, strength: context && context.strength });
    }
  }

  class PersistentReputationLayer {
    constructor() {
      this.reputations = new Map();
    }

    update(entityId, delta, reason) {
      const current = this.reputations.get(entityId) || { value: 50, history: [] };
      const next = Math.max(0, Math.min(100, current.value + delta));
      current.history.push({ delta, reason, next });
      current.value = next;
      this.reputations.set(entityId, current);
      return next;
    }
  }

  class ConsequenceMemoryEngine {
    constructor(graph, reputation) {
      this.graph = graph;
      this.reputation = reputation;
    }

    record(entityId, memory, reputationDelta) {
      this.graph.remember(entityId, memory);
      if (reputationDelta) this.reputation.update(entityId, reputationDelta, memory.type || "world-memory");
    }
  }

  class DeltaSerializer {
    constructor() {
      this.previousByScope = new Map();
    }

    diff(scope, state) {
      const current = JSON.parse(JSON.stringify(state || {}));
      const previous = this.previousByScope.get(scope) || {};
      const delta = {};
      Object.keys(current).forEach((key) => {
        if (stableStringify(current[key]) !== stableStringify(previous[key])) delta[key] = current[key];
      });
      this.previousByScope.set(scope, current);
      return { scope, checksum: hashString(stableStringify(current)), changedKeys: Object.keys(delta), delta };
    }
  }

  class HistoricalArchiveSystem {
    classify(state) {
      const players = state && state.players ? state.players : [];
      const activePlayers = [];
      const archivedPlayers = [];
      players.forEach((player) => {
        if (player.isRetired || player.age >= 38) archivedPlayers.push({ id: player.id, name: player.name, age: player.age, lastTeamId: player.teamId, overall: player.overall });
        else activePlayers.push(player);
      });
      return { activePlayers, archivedPlayers };
    }
  }

  class WorldPersistenceEngine {
    constructor(config) {
      config = config || {};
      this.dbName = config.dbName || "FMG_WORLD_PERSISTENCE";
      this.version = 1;
      this.memoryStore = new Map();
      this.dbPromise = null;
    }

    open() {
      if (this.dbPromise) return this.dbPromise;
      if (!root.indexedDB) {
        this.dbPromise = Promise.resolve(null);
        return this.dbPromise;
      }
      this.dbPromise = new Promise((resolve, reject) => {
        const request = root.indexedDB.open(this.dbName, this.version);
        request.onupgradeneeded = function () {
          const db = request.result;
          ["manifests", "chunks", "deltas", "archives", "replays"].forEach((store) => {
            if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
          });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return this.dbPromise;
    }

    put(storeName, record) {
      return this.open().then((db) => {
        if (!db) {
          this.memoryStore.set(storeName + ":" + record.id, record);
          return record;
        }
        return new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).put(record);
          tx.oncomplete = () => resolve(record);
          tx.onerror = () => reject(tx.error);
        });
      });
    }

    get(storeName, id) {
      return this.open().then((db) => {
        if (!db) return this.memoryStore.get(storeName + ":" + id) || null;
        return new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const request = tx.objectStore(storeName).get(id);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      });
    }
  }

  class IncrementalSavePipeline {
    constructor(engine, deltaSerializer, archiveSystem) {
      this.engine = engine;
      this.deltaSerializer = deltaSerializer;
      this.archiveSystem = archiveSystem;
      this.queue = [];
      this.processing = false;
      this.lastManifest = null;
    }

    enqueue(slotId, state) {
      const job = { slotId, state: JSON.parse(JSON.stringify(state || {})), enqueuedAt: FMG.nowISO ? FMG.nowISO("save-enqueue") : new Date().toISOString() };
      this.queue.push(job);
      this._pump();
      return { queued: true, queueLength: this.queue.length };
    }

    _pump() {
      if (this.processing) return;
      this.processing = true;
      Promise.resolve().then(() => this._processNext()).catch((err) => {
        this.processing = false;
        FMG.runtimeDiagnostics && FMG.runtimeDiagnostics.captureError && FMG.runtimeDiagnostics.captureError(err, "incremental-save");
      });
    }

    _processNext() {
      const job = this.queue.shift();
      if (!job) {
        this.processing = false;
        return null;
      }
      const archive = this.archiveSystem.classify(job.state);
      const checkpoint = {
        ...job.state,
        players: archive.activePlayers,
        archiveSummary: { archivedPlayers: archive.archivedPlayers.length }
      };
      const serialized = JSON.stringify(checkpoint);
      const chunks = splitChunks(serialized, 250000);
      const manifest = {
        id: job.slotId,
        slotId: job.slotId,
        version: FMG.CURRENT_VERSION || "0.1.0",
        savedAt: FMG.nowISO ? FMG.nowISO("save-manifest") : new Date().toISOString(),
        chunkCount: chunks.length,
        checksum: hashString(serialized),
        delta: this.deltaSerializer.diff(job.slotId, checkpoint),
        archivedPlayers: archive.archivedPlayers.length
      };
      this.lastManifest = manifest;
      const writes = [this.engine.put("manifests", manifest)];
      chunks.forEach((chunk, index) => writes.push(this.engine.put("chunks", { id: job.slotId + ":" + index, slotId: job.slotId, index, data: chunk })));
      if (archive.archivedPlayers.length) writes.push(this.engine.put("archives", { id: job.slotId + ":players", slotId: job.slotId, players: archive.archivedPlayers }));
      return Promise.all(writes).then(() => this._processNext());
    }

    report() {
      return { queueLength: this.queue.length, processing: this.processing, lastManifest: this.lastManifest };
    }
  }

  class ReplayDeltaStorage {
    constructor(engine) {
      this.engine = engine;
    }

    saveReplay(id, events) {
      const payload = { id, checksum: hashString(stableStringify(events || [])), events: events || [] };
      return this.engine.put("replays", payload);
    }
  }

  class SaveIntegrityValidator {
    validate(state) {
      const errors = [];
      if (!state || typeof state !== "object") errors.push("Save payload missing");
      if (state && !Array.isArray(state.teams)) errors.push("Save teams missing");
      if (state && !Array.isArray(state.players)) errors.push("Save players missing");
      if (state && !state.seasonNumber) errors.push("Save season number missing");
      return { valid: errors.length === 0, errors, checksum: hashString(stableStringify(state || {})) };
    }
  }

  class EntityRelevanceEngine {
    score(entity, context) {
      context = context || {};
      let score = 0;
      if (entity.teamId && entity.teamId === context.userTeamId) score += 80;
      if (entity.isSuperstar || entity.overall >= 80) score += 40;
      if (entity.mediaRelevance) score += entity.mediaRelevance;
      if (entity.relationshipProximity) score += entity.relationshipProximity;
      if (entity.isRetired) score -= 60;
      return Math.max(0, Math.min(100, score));
    }
  }

  class SimulationPriorityManager {
    constructor(relevanceEngine) {
      this.relevanceEngine = relevanceEngine;
    }

    classify(entity, context) {
      const score = this.relevanceEngine.score(entity, context);
      if (score >= 80) return "active match";
      if (score >= 55) return "active league";
      if (score >= 30) return "nearby world";
      if (score >= 10) return "distant world";
      return "archived world";
    }
  }

  class WorldPartitionSystem {
    partition(entities, priorityManager, context) {
      const layers = {
        "active match": [],
        "active league": [],
        "nearby world": [],
        "distant world": [],
        "archived world": []
      };
      (entities || []).forEach((entity) => layers[priorityManager.classify(entity, context)].push(entity));
      return layers;
    }
  }

  class LayeredWorldSimulator {
    constructor(priorityManager, partitionSystem) {
      this.priorityManager = priorityManager;
      this.partitionSystem = partitionSystem;
      this.lastPlan = null;
    }

    plan(state) {
      const entities = (state && state.players) || [];
      const layers = this.partitionSystem.partition(entities, this.priorityManager, { userTeamId: state && state.userTeamId });
      this.lastPlan = {
        layers: Object.keys(layers).reduce((acc, key) => {
          acc[key] = layers[key].length;
          return acc;
        }, {}),
        budgets: {
          "active match": { frequency: "tick", depth: "full" },
          "active league": { frequency: "week", depth: "full" },
          "nearby world": { frequency: "month", depth: "reduced" },
          "distant world": { frequency: "quarter", depth: "abstract" },
          "archived world": { frequency: "season", depth: "compressed" }
        }
      };
      return this.lastPlan;
    }
  }

  class MasterRuntimeLoop {
    constructor() {
      this.subscriptions = new Map();
      this.running = false;
      this.frameId = null;
      this.frame = this.frame.bind(this);
    }

    subscribe(id, fn) {
      this.subscriptions.set(id, fn);
      this.start();
      return () => this.unsubscribe(id);
    }

    unsubscribe(id) {
      this.subscriptions.delete(id);
      if (!this.subscriptions.size) this.stop();
    }

    start() {
      if (this.running || !root.requestAnimationFrame) return;
      this.running = true;
      this.frameId = root.requestAnimationFrame(this.frame);
    }

    stop() {
      if (this.frameId && root.cancelAnimationFrame) root.cancelAnimationFrame(this.frameId);
      this.frameId = null;
      this.running = false;
    }

    frame(now) {
      this.subscriptions.forEach((fn) => fn(now));
      if (this.running && root.requestAnimationFrame) this.frameId = root.requestAnimationFrame(this.frame);
    }
  }

  class RenderScheduler {
    constructor(masterLoop) {
      this.masterLoop = masterLoop;
      this.queue = new Map();
      this.scheduled = false;
    }

    schedule(key, fn) {
      this.queue.set(key, fn);
      if (this.scheduled) return;
      this.scheduled = true;
      const flush = () => this.flush();
      if (root.requestAnimationFrame) root.requestAnimationFrame(flush);
      else Promise.resolve().then(flush);
    }

    flush() {
      const jobs = Array.from(this.queue.values());
      this.queue.clear();
      this.scheduled = false;
      jobs.forEach((job) => job());
    }
  }

  class PersistentUIShell {
    constructor(app, scheduler) {
      this.app = app;
      this.scheduler = scheduler;
      this.nodes = {};
      this.hashes = {};
      this.ensure();
    }

    ensure() {
      if (!this.app || this.nodes.route) return;
      this.app.innerHTML = '<div class="fmg-shell-root"><div class="fmg-nav-root"></div><main class="fmg-route-root"></main><aside class="fmg-overlay-root"></aside></div>';
      this.nodes.nav = this.app.querySelector(".fmg-nav-root");
      this.nodes.route = this.app.querySelector(".fmg-route-root");
      this.nodes.overlay = this.app.querySelector(".fmg-overlay-root");
    }

    render(parts) {
      this.ensure();
      ["nav", "route", "overlay"].forEach((key) => {
        const html = parts[key] || "";
        const hash = hashString(html);
        if (this.hashes[key] === hash || !this.nodes[key]) return;
        this.scheduler.schedule("ui:" + key, () => {
          this.nodes[key].innerHTML = html;
          this.hashes[key] = hash;
        });
      });
    }
  }

  class UIPanelPool {
    constructor() {
      this.pool = new Map();
    }

    acquire(key, factory) {
      if (!this.pool.has(key)) this.pool.set(key, factory());
      return this.pool.get(key);
    }
  }

  class RetainedComponentSystem {
    constructor() {
      this.components = new Map();
    }

    register(id, component) {
      this.components.set(id, component);
    }

    dispose(id) {
      const component = this.components.get(id);
      if (component && component.dispose) component.dispose();
      this.components.delete(id);
    }
  }

  class OverlayManager {
    constructor() {
      this.overlays = new Map();
    }

    set(id, html) {
      this.overlays.set(id, html);
    }

    render() {
      return Array.from(this.overlays.values()).join("");
    }
  }

  class RenderSubscriptionManager {
    constructor(loop) {
      this.loop = loop;
      this.active = new Map();
    }

    subscribe(id, fn) {
      if (this.active.has(id)) this.active.get(id)();
      const unsubscribe = this.loop.subscribe(id, fn);
      this.active.set(id, unsubscribe);
      return unsubscribe;
    }
  }

  class RenderBudgetController {
    constructor() {
      this.targetFps = 60;
      this.frameBudgetMs = 16.7;
    }

    setLowSpec(enabled) {
      this.targetFps = enabled ? 30 : 60;
      this.frameBudgetMs = enabled ? 33.3 : 16.7;
    }
  }

  class ListenerRegistry {
    constructor() {
      this.listeners = new Map();
      this.nextId = 1;
    }

    add(target, type, handler, options) {
      if (!target || !target.addEventListener) return null;
      const id = "listener:" + this.nextId++;
      target.addEventListener(type, handler, options);
      this.listeners.set(id, { target, type, handler, options });
      return id;
    }

    remove(id) {
      const entry = this.listeners.get(id);
      if (!entry) return false;
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
      this.listeners.delete(id);
      return true;
    }

    count() {
      return this.listeners.size;
    }
  }

  class EventLeakDetector {
    constructor(registry) {
      this.registry = registry;
      this.samples = [];
    }

    sample() {
      const sample = { listeners: this.registry.count(), at: FMG.simulationClock ? FMG.simulationClock.tick("listener-sample") : Date.now() };
      this.samples.push(sample);
      return sample;
    }

    report() {
      return { currentListeners: this.registry.count(), samples: this.samples.slice(-20) };
    }
  }

  class EntityLifecycleTracker {
    constructor() {
      this.entities = new Map();
    }

    register(id, layer) {
      this.entities.set(id, { id, layer: layer || "active", disposed: false });
    }

    move(id, layer) {
      const entity = this.entities.get(id);
      if (entity) entity.layer = layer;
    }

    dispose(id) {
      const entity = this.entities.get(id);
      if (entity) entity.disposed = true;
    }

    report() {
      const counts = {};
      this.entities.forEach((entity) => {
        counts[entity.disposed ? "disposed" : entity.layer] = (counts[entity.disposed ? "disposed" : entity.layer] || 0) + 1;
      });
      return counts;
    }
  }

  class RuntimeMemoryDiagnostics {
    constructor(listenerRegistry, lifecycleTracker) {
      this.listenerRegistry = listenerRegistry;
      this.lifecycleTracker = lifecycleTracker;
    }

    sample(state) {
      const memory = root.performance && root.performance.memory ? root.performance.memory.usedJSHeapSize : null;
      return {
        heapBytes: memory,
        entityCount: state && state.players ? state.players.length : 0,
        listeners: this.listenerRegistry.count(),
        lifecycle: this.lifecycleTracker.report()
      };
    }
  }

  class LowSpecModeController {
    constructor() {
      this.enabled = false;
      this.reason = "manual";
    }

    evaluate() {
      const nav = root.navigator || {};
      const memory = nav.deviceMemory || 4;
      const cores = nav.hardwareConcurrency || 4;
      this.enabled = memory <= 4 || cores <= 4;
      this.reason = this.enabled ? "low hardware budget" : "normal hardware budget";
      return { enabled: this.enabled, reason: this.reason, memory, cores };
    }
  }

  class AdaptivePerformanceScaler {
    constructor(lowSpecController, renderBudget) {
      this.lowSpecController = lowSpecController;
      this.renderBudget = renderBudget;
      this.quality = "normal";
    }

    apply() {
      const result = this.lowSpecController.evaluate();
      this.quality = result.enabled ? "low" : "normal";
      this.renderBudget.setLowSpec(result.enabled);
      return { quality: this.quality, renderBudgetMs: this.renderBudget.frameBudgetMs, lowSpec: result };
    }
  }

  class RuntimeOverlay {
    constructor() {
      this.enabled = false;
      this.node = null;
    }

    mount() {
      if (this.node || !root.document) return;
      this.node = root.document.createElement("div");
      this.node.className = "runtime-overlay";
      this.node.setAttribute("aria-live", "polite");
      root.document.body.appendChild(this.node);
    }

    update(report) {
      if (!this.enabled || !root.document) return;
      this.mount();
      this.node.innerHTML = [
        "FPS: " + (report.fps || "n/a"),
        "RAM: " + (report.heapBytes ? Math.round(report.heapBytes / 1048576) + " MB" : "n/a"),
        "Entities: " + (report.entityCount || 0),
        "Listeners: " + (report.listeners || 0),
        "Replay: " + (report.replayState || "idle"),
        "Layers: " + stableStringify(report.layers || {}),
        "Persistence: " + (report.persistenceQueue || 0),
        "Warnings: " + (report.warnings || 0)
      ].join("<br>");
    }
  }

  class RuntimeDiagnosticsPanel {
    constructor(overlay) {
      this.overlay = overlay;
    }

    show(report) {
      this.overlay.enabled = true;
      this.overlay.update(report);
    }
  }

  function installDeterminism(seed) {
    FMG.simulationClock = FMG.simulationClock || new SimulationClock();
    FMG.deterministicRNG = FMG.deterministicRNG || new DeterministicRNGEngine(seed || FMG.gameState?.seed || 1);
    FMG.rng = () => FMG.deterministicRNG.next();
    FMG.randomInt = (min, max) => FMG.deterministicRNG.int(min, max);
    FMG.sample = (items) => FMG.deterministicRNG.choice(items);
    FMG.uid = (prefix) => (prefix || "id") + "-" + hashString([prefix, FMG.deterministicRNG.counter, FMG.deterministicRNG.next()].join(":"));
    FMG.nowISO = (label) => {
      FMG.simulationClock.tick(label || "time");
      return FMG.simulationClock.iso();
    };
    return { clock: FMG.simulationClock.snapshot(), rng: FMG.deterministicRNG.snapshot() };
  }

  function install() {
    installDeterminism();
    FMG.runtimeAuthorityManager = FMG.runtimeAuthorityManager || new RuntimeAuthorityManager();
    FMG.runtimeAuthorityManager.declare("FMG.Core", { owner: "FMG.Core", stateAuthority: "FMG.Core" });
    FMG.runtimeAuthorityManager.declare("legacy-runtime", { owner: "legacy", stateAuthority: "FMG.Core", mode: "facade" });
    FMG.legacyCompatibilityFacade = FMG.legacyCompatibilityFacade || new LegacyCompatibilityFacade(FMG.runtimeAuthorityManager);
    FMG.runtimeMutationGuard = FMG.runtimeMutationGuard || new RuntimeMutationGuard(FMG.runtimeAuthorityManager);
    FMG.runtimeOwnershipValidator = FMG.runtimeOwnershipValidator || new RuntimeOwnershipValidator(FMG.runtimeAuthorityManager);
    FMG.deterministicReplayValidator = FMG.deterministicReplayValidator || new DeterministicReplayValidator();
    FMG.causalReplayEngine = FMG.causalReplayEngine || new CausalReplayEngine();
    FMG.historicalConsequenceTracker = FMG.historicalConsequenceTracker || new HistoricalConsequenceTracker();
    FMG.worldMemoryGraph = FMG.worldMemoryGraph || new WorldMemoryGraph();
    FMG.relationshipMemorySystem = FMG.relationshipMemorySystem || new RelationshipMemorySystem(FMG.worldMemoryGraph);
    FMG.persistentReputationLayer = FMG.persistentReputationLayer || new PersistentReputationLayer();
    FMG.consequenceMemoryEngine = FMG.consequenceMemoryEngine || new ConsequenceMemoryEngine(FMG.worldMemoryGraph, FMG.persistentReputationLayer);
    FMG.worldPersistenceEngine = FMG.worldPersistenceEngine || new WorldPersistenceEngine();
    FMG.deltaSerializer = FMG.deltaSerializer || new DeltaSerializer();
    FMG.historicalArchiveSystem = FMG.historicalArchiveSystem || new HistoricalArchiveSystem();
    FMG.incrementalSavePipeline = FMG.incrementalSavePipeline || new IncrementalSavePipeline(FMG.worldPersistenceEngine, FMG.deltaSerializer, FMG.historicalArchiveSystem);
    FMG.replayDeltaStorage = FMG.replayDeltaStorage || new ReplayDeltaStorage(FMG.worldPersistenceEngine);
    FMG.saveIntegrityValidator = FMG.saveIntegrityValidator || new SaveIntegrityValidator();
    FMG.entityRelevanceEngine = FMG.entityRelevanceEngine || new EntityRelevanceEngine();
    FMG.simulationPriorityManager = FMG.simulationPriorityManager || new SimulationPriorityManager(FMG.entityRelevanceEngine);
    FMG.worldPartitionSystem = FMG.worldPartitionSystem || new WorldPartitionSystem();
    FMG.layeredWorldSimulator = FMG.layeredWorldSimulator || new LayeredWorldSimulator(FMG.simulationPriorityManager, FMG.worldPartitionSystem);
    FMG.masterRuntimeLoop = FMG.masterRuntimeLoop || new MasterRuntimeLoop();
    FMG.renderBudgetController = FMG.renderBudgetController || new RenderBudgetController();
    FMG.renderScheduler = FMG.renderScheduler || new RenderScheduler(FMG.masterRuntimeLoop);
    FMG.uiPanelPool = FMG.uiPanelPool || new UIPanelPool();
    FMG.retainedComponentSystem = FMG.retainedComponentSystem || new RetainedComponentSystem();
    FMG.overlayManager = FMG.overlayManager || new OverlayManager();
    FMG.renderSubscriptionManager = FMG.renderSubscriptionManager || new RenderSubscriptionManager(FMG.masterRuntimeLoop);
    FMG.listenerRegistry = FMG.listenerRegistry || new ListenerRegistry();
    FMG.eventLeakDetector = FMG.eventLeakDetector || new EventLeakDetector(FMG.listenerRegistry);
    FMG.entityLifecycleTracker = FMG.entityLifecycleTracker || new EntityLifecycleTracker();
    FMG.runtimeMemoryDiagnostics = FMG.runtimeMemoryDiagnostics || new RuntimeMemoryDiagnostics(FMG.listenerRegistry, FMG.entityLifecycleTracker);
    FMG.lowSpecModeController = FMG.lowSpecModeController || new LowSpecModeController();
    FMG.adaptivePerformanceScaler = FMG.adaptivePerformanceScaler || new AdaptivePerformanceScaler(FMG.lowSpecModeController, FMG.renderBudgetController);
    FMG.runtimeOverlay = FMG.runtimeOverlay || new RuntimeOverlay();
    FMG.runtimeDiagnosticsPanel = FMG.runtimeDiagnosticsPanel || new RuntimeDiagnosticsPanel(FMG.runtimeOverlay);
    FMG.adaptivePerformanceScaler.apply();
    return FMG.Hardening.report();
  }

  function report() {
    const state = FMG.gameState || {};
    const layerPlan = FMG.layeredWorldSimulator ? FMG.layeredWorldSimulator.plan(state) : null;
    const memory = FMG.runtimeMemoryDiagnostics ? FMG.runtimeMemoryDiagnostics.sample(state) : {};
    return {
      deterministic: {
        clock: FMG.simulationClock && FMG.simulationClock.snapshot(),
        rng: FMG.deterministicRNG && FMG.deterministicRNG.snapshot()
      },
      authority: FMG.runtimeAuthorityManager && FMG.runtimeAuthorityManager.report(),
      mutationGuard: FMG.runtimeMutationGuard && FMG.runtimeMutationGuard.report(),
      replay: FMG.deterministicReplayValidator && FMG.deterministicReplayValidator.lastReport,
      persistence: FMG.incrementalSavePipeline && FMG.incrementalSavePipeline.report(),
      layers: layerPlan,
      memory,
      causalReplay: FMG.causalReplayEngine && FMG.causalReplayEngine.report(),
      worldMemory: FMG.worldMemoryGraph && FMG.worldMemoryGraph.report(),
      lowSpec: FMG.lowSpecModeController && FMG.lowSpecModeController.evaluate()
    };
  }

  Hardening.SimulationClock = SimulationClock;
  Hardening.DeterministicRNGEngine = DeterministicRNGEngine;
  Hardening.RuntimeAuthorityManager = RuntimeAuthorityManager;
  Hardening.LegacyCompatibilityFacade = LegacyCompatibilityFacade;
  Hardening.RuntimeOwnershipValidator = RuntimeOwnershipValidator;
  Hardening.RuntimeMutationGuard = RuntimeMutationGuard;
  Hardening.DeterministicReplayValidator = DeterministicReplayValidator;
  Hardening.ReplayDiffEngine = ReplayDiffEngine;
  Hardening.TickReplayInspector = TickReplayInspector;
  Hardening.CausalReplayEngine = CausalReplayEngine;
  Hardening.EventCausalityGraph = EventCausalityGraph;
  Hardening.HistoricalConsequenceTracker = HistoricalConsequenceTracker;
  Hardening.WorldMemoryGraph = WorldMemoryGraph;
  Hardening.RelationshipMemorySystem = RelationshipMemorySystem;
  Hardening.PersistentReputationLayer = PersistentReputationLayer;
  Hardening.ConsequenceMemoryEngine = ConsequenceMemoryEngine;
  Hardening.WorldPersistenceEngine = WorldPersistenceEngine;
  Hardening.DeltaSerializer = DeltaSerializer;
  Hardening.IncrementalSavePipeline = IncrementalSavePipeline;
  Hardening.HistoricalArchiveSystem = HistoricalArchiveSystem;
  Hardening.ReplayDeltaStorage = ReplayDeltaStorage;
  Hardening.SaveIntegrityValidator = SaveIntegrityValidator;
  Hardening.EntityRelevanceEngine = EntityRelevanceEngine;
  Hardening.SimulationPriorityManager = SimulationPriorityManager;
  Hardening.WorldPartitionSystem = WorldPartitionSystem;
  Hardening.LayeredWorldSimulator = LayeredWorldSimulator;
  Hardening.MasterRuntimeLoop = MasterRuntimeLoop;
  Hardening.RenderScheduler = RenderScheduler;
  Hardening.PersistentUIShell = PersistentUIShell;
  Hardening.UIPanelPool = UIPanelPool;
  Hardening.RetainedComponentSystem = RetainedComponentSystem;
  Hardening.OverlayManager = OverlayManager;
  Hardening.RenderSubscriptionManager = RenderSubscriptionManager;
  Hardening.RenderBudgetController = RenderBudgetController;
  Hardening.ListenerRegistry = ListenerRegistry;
  Hardening.EventLeakDetector = EventLeakDetector;
  Hardening.EntityLifecycleTracker = EntityLifecycleTracker;
  Hardening.RuntimeMemoryDiagnostics = RuntimeMemoryDiagnostics;
  Hardening.LowSpecModeController = LowSpecModeController;
  Hardening.AdaptivePerformanceScaler = AdaptivePerformanceScaler;
  Hardening.RuntimeOverlay = RuntimeOverlay;
  Hardening.RuntimeDiagnosticsPanel = RuntimeDiagnosticsPanel;
  Hardening.stableStringify = stableStringify;
  Hardening.hashString = hashString;
  Hardening.installDeterminism = installDeterminism;
  Hardening.install = install;
  Hardening.report = report;

  install();
})();
