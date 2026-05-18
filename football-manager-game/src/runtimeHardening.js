(function () {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const FMG = (root.FMG = root.FMG || {});
  const Hardening = (FMG.Hardening = FMG.Hardening || {});

  const stableStringify = FMG.stableStringify;

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

  function deterministicNow() {
    if (FMG.simulationClock && typeof FMG.simulationClock.now === "function") return FMG.simulationClock.now();
    if (FMG.nowMs) return FMG.nowMs();
    return Date.UTC(2025, 0, 1, 12, 0, 0);
  }

  function deterministicTick(label) {
    if (FMG.simulationClock && typeof FMG.simulationClock.tick === "function") return FMG.simulationClock.tick(label || "runtime");
    if (FMG.tickMs) return FMG.tickMs(label || "runtime");
    return deterministicNow();
  }

  function deterministicISO(label) {
    return new Date(deterministicTick(label || "time")).toISOString();
  }

  function deterministicRandom(label) {
    let value;
    if (FMG.deterministicRNG && typeof FMG.deterministicRNG.next === "function") value = FMG.deterministicRNG.next();
    else if (FMG.rng) value = FMG.rng();
    else value = 0.5;
    if (FMG.runtimeRandomnessAudit && typeof FMG.runtimeRandomnessAudit.record === "function") {
      FMG.runtimeRandomnessAudit.record(label || "rng", value);
    }
    return value;
  }

  function stableEntityKey(entity, fallbackIndex) {
    if (entity && typeof entity === "object") {
      const id = entity.id || entity.playerId || entity.teamId || entity.fixtureId || entity.stateId || entity.name;
      if (id !== undefined && id !== null) return String(id);
      if (entity.homeTeamId || entity.awayTeamId || entity.week) {
        return [entity.week || 0, entity.homeTeamId || "", entity.awayTeamId || ""].join(":");
      }
    }
    return String(fallbackIndex || 0);
  }

  function deterministicSort(items, comparator) {
    return (items || []).map((item, index) => ({ item, index })).sort((left, right) => {
      const result = comparator ? comparator(left.item, right.item) : 0;
      if (result) return result;
      const leftKey = stableEntityKey(left.item, left.index);
      const rightKey = stableEntityKey(right.item, right.index);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : left.index - right.index;
    }).map((entry) => entry.item);
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

  class RNGStateSerializer {
    serialize(rng) {
      const target = rng || FMG.deterministicRNG;
      const snapshot = target && typeof target.snapshot === "function"
        ? target.snapshot()
        : { seed: FMG._currentSeed || 1, state: FMG._fallbackRngState || 1, counter: 0 };
      const payload = {
        schema: "fmg-rng-state",
        version: 1,
        snapshot,
        checksum: hashString(stableStringify(snapshot))
      };
      return payload;
    }

    restore(payload, rng) {
      if (!payload || !payload.snapshot) throw new Error("RNG snapshot required");
      const checksum = hashString(stableStringify(payload.snapshot));
      if (payload.checksum && payload.checksum !== checksum) throw new Error("RNG snapshot checksum mismatch");
      const target = rng || FMG.deterministicRNG || new DeterministicRNGEngine(payload.snapshot.seed || 1);
      if (typeof target.restore === "function") target.restore(payload.snapshot);
      if (!FMG.deterministicRNG) FMG.deterministicRNG = target;
      return target.snapshot ? target.snapshot() : payload.snapshot;
    }

    clone(rng) {
      const serialized = this.serialize(rng);
      const clone = new DeterministicRNGEngine(serialized.snapshot.seed || 1);
      clone.restore(serialized.snapshot);
      return clone;
    }

    compare(left, right) {
      const leftState = this.serialize(left).snapshot;
      const rightState = this.serialize(right).snapshot;
      const leftHash = hashString(stableStringify(leftState));
      const rightHash = hashString(stableStringify(rightState));
      return { equal: leftHash === rightHash, leftHash, rightHash };
    }
  }

  class ReplayHashEngine {
    constructor() {
      this.history = [];
    }

    canonicalize(value, options) {
      options = options || {};
      if (value === null || typeof value !== "object") return value;
      if (Array.isArray(value)) {
        const mapped = value.map((entry) => this.canonicalize(entry, options));
        if (options.sortEntityArrays && mapped.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) {
          return deterministicSort(mapped);
        }
        return mapped;
      }
      const out = {};
      Object.keys(value).sort().forEach((key) => {
        if (typeof value[key] !== "function" && key !== "__fmgRuntimePath" && key !== "__runtimeOwnership") {
          out[key] = this.canonicalize(value[key], options);
        }
      });
      return out;
    }

    hash(value, options) {
      const canonical = this.canonicalize(value, options || {});
      return hashString(stableStringify(canonical));
    }

    hashState(state) {
      if (state && typeof state._calculateChecksum === "function") return state._calculateChecksum();
      return this.hash(state || null, { sortEntityArrays: true });
    }

    hashReplay(ticks) {
      return this.hash(ticks || [], { sortEntityArrays: false });
    }

    record(label, value, options) {
      const entry = {
        label: label || "hash",
        hash: this.hash(value, options || {}),
        at: deterministicNow()
      };
      this.history.unshift(entry);
      this.history = this.history.slice(0, 100);
      return entry;
    }

    compare(left, right, options) {
      const leftHash = this.hash(left, options || {});
      const rightHash = this.hash(right, options || {});
      return { equal: leftHash === rightHash, leftHash, rightHash };
    }
  }

  class RuntimeRandomnessAudit {
    constructor() {
      this.calls = [];
      this.unsafeSources = [];
    }

    record(label, value) {
      const entry = { label: label || "rng", counter: FMG.deterministicRNG ? FMG.deterministicRNG.counter : null, value };
      this.calls.unshift(entry);
      this.calls = this.calls.slice(0, 200);
      return entry;
    }

    flag(source, detail) {
      const entry = { source, detail: detail || "", at: deterministicNow() };
      this.unsafeSources.unshift(entry);
      this.unsafeSources = this.unsafeSources.slice(0, 100);
      return entry;
    }

    report() {
      return {
        rngCalls: this.calls.slice(0, 100),
        unsafeSources: this.unsafeSources.slice(0, 100),
        rngState: FMG.rngStateSerializer ? FMG.rngStateSerializer.serialize(FMG.deterministicRNG) : null,
        clock: FMG.simulationClock && FMG.simulationClock.snapshot ? FMG.simulationClock.snapshot() : null
      };
    }
  }

  class RuntimeAuthorityManager {
    constructor() {
      this.systems = new Map();
      this.authority = "FMG.Core";
      this.runtimeId = "fmg-runtime-" + hashString("runtime:" + deterministicNow() + ":" + (FMG.deterministicRNG ? FMG.deterministicRNG.counter : 0));
      this.status = "created";
      this.authoritativeState = null;
      this.authoritativeChecksum = null;
      this.authoritativeGeneration = 0;
      this.metadataByPath = new Map();
      this.divergences = [];
      this.stateWrites = [];
      this.lifecycle = [];
      this.migrationReport = { migratedSystems: [], remainingLegacyDependencies: [], unsafeLegacyCalls: [] };
      this.declareOwnership("FMG.Core", "FMG.Core", "authoritative-runtime");
      [
        "teams", "players", "fixtures", "currentWeek", "totalWeeks", "completedWeeks",
        "seasonComplete", "champion", "seasonNumber", "seasonHistory", "userTeamId",
        "userClub", "currentMatch", "liveMatch", "lastResults", "standings",
        "market", "tactics", "competitions", "finances", "career"
      ].forEach((path) => this.declareOwnership(path, "FMG.Core", "core-gameplay-state"));
      [
        "route", "selectionMode", "squadView", "rivalAI", "worldNews", "ui", "settings",
        "saveMeta", "systemErrors", "eventsLog", "notifications", "notificationLog",
        "seasonLog", "managerProfile"
      ].forEach((path) => this.declareOwnership(path, "legacy-compatibility-facade", "legacy-ui-compatibility"));
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

    declareOwnership(path, owner, reason) {
      const entry = {
        path: String(path || "$"),
        owner: owner || this.authority,
        reason: reason || "runtime",
        declaredAt: deterministicNow()
      };
      this.metadataByPath.set(entry.path, entry);
      return entry;
    }

    ownershipFor(path) {
      const parts = String(path || "$").split(".");
      while (parts.length) {
        const candidate = parts.join(".");
        if (this.metadataByPath.has(candidate)) return this.metadataByPath.get(candidate);
        parts.pop();
      }
      return this.metadataByPath.get("FMG.Core") || { owner: this.authority, path: "$" };
    }

    isAuthoritative(system) {
      const entry = this.systems.get(system);
      return !entry || entry.owner === this.authority;
    }

    start(reason) {
      this.status = "running";
      this.lifecycle.push({ type: "startup", reason: reason || "install", at: deterministicNow() });
      return this.status;
    }

    shutdown(reason) {
      this.status = "stopped";
      this.lifecycle.push({ type: "shutdown", reason: reason || "manual", at: deterministicNow() });
      if (FMG.masterRuntimeLoop && FMG.masterRuntimeLoop.stop) FMG.masterRuntimeLoop.stop();
      return this.status;
    }

    setAuthoritativeState(coreState, reason) {
      if (!coreState) return null;
      this.authoritativeState = coreState;
      this.authoritativeChecksum = typeof coreState._calculateChecksum === "function" ? coreState._calculateChecksum() : hashString(stableStringify(coreState));
      this.authoritativeGeneration = coreState.generation || this.authoritativeGeneration;
      this.stateWrites.push({
        source: this.authority,
        reason: reason || "core-state",
        checksum: this.authoritativeChecksum,
        generation: this.authoritativeGeneration
      });
      this.stateWrites = this.stateWrites.slice(-100);
      return this.authoritativeState;
    }

    captureCoreStateFromLegacy(reason) {
      if (!FMG.Core || !FMG.Core.Adapters || !FMG.Core.Adapters.legacyAdapter || !FMG.gameState || !FMG.gameState.teams) return null;
      try {
        return this.setAuthoritativeState(FMG.Core.Adapters.legacyAdapter.toCore(), reason || "legacy-projection");
      } catch (error) {
        this.migrationReport.unsafeLegacyCalls.push("capture-core-state:" + error.message);
        return null;
      }
    }

    validateNoDivergence(coreState, legacyState, validator) {
      const state = coreState || this.authoritativeState;
      if (!validator || !state || !legacyState) return { valid: true, skipped: true };
      const result = validator.validate(state, legacyState);
      if (!result.valid) {
        this.divergences.push({
          at: deterministicNow(),
          errors: result.errors.slice(),
          coreChecksum: typeof state._calculateChecksum === "function" ? state._calculateChecksum() : hashString(stableStringify(state)),
          legacyChecksum: hashString(stableStringify(legacyState))
        });
        this.divergences = this.divergences.slice(-50);
      }
      return result;
    }

    reports() {
      const authority = this.report();
      return {
        runtimeAuthorityReport: authority,
        remainingLegacyDependencyReport: {
          dependencies: authority.remainingLegacyDependencies,
          unsafeLegacyCalls: authority.unsafeLegacyCalls,
          stranglerStage: authority.remainingLegacyDependencies.length ? "compatibility-facade-active" : "core-only"
        },
        unsafeMutationReport: FMG.runtimeMutationGuard ? FMG.runtimeMutationGuard.report() : null
      };
    }

    report() {
      const unique = (items) => Array.from(new Set(items));
      return {
        authority: this.authority,
        authorityConfig: FMG.getRuntimeAuthorityConfig ? FMG.getRuntimeAuthorityConfig() : null,
        runtimeId: this.runtimeId,
        status: this.status,
        authoritativeChecksum: this.authoritativeChecksum,
        authoritativeGeneration: this.authoritativeGeneration,
        systems: Array.from(this.systems.values()),
        ownership: Array.from(this.metadataByPath.values()),
        migratedSystems: unique(this.migrationReport.migratedSystems),
        remainingLegacyDependencies: unique(this.migrationReport.remainingLegacyDependencies),
        unsafeLegacyCalls: unique(this.migrationReport.unsafeLegacyCalls),
        lifecycle: this.lifecycle.slice(-20),
        stateWrites: this.stateWrites.slice(-25),
        divergences: this.divergences.slice(-25)
      };
    }
  }

  class RuntimeMutationGuard {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
      this.current = null;
      this.history = [];
      this.violations = [];
      this.hiddenMutations = [];
      this.invalidStateWrites = [];
      this.duplicateWrites = [];
      this.suppressionDepth = 0;
      this.legacyProxy = null;
      this.rawToProxy = typeof WeakMap !== "undefined" ? new WeakMap() : null;
      this.proxyToRaw = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    }

    checksum(value) {
      return hashString(stableStringify(value || null));
    }

    begin(system, context) {
      const beforeState = FMG.gameState ? this.checksum(FMG.gameState) : null;
      this.current = {
        system,
        context: context || {},
        writes: new Set(),
        startedAt: deterministicNow(),
        beforeState
      };
      return this.current;
    }

    record(path, options) {
      options = options || {};
      const key = String(path || "unknown");
      const system = options.system || (this.current && this.current.system) || "legacy-runtime";
      const owner = this.authorityManager.ownershipFor(key);
      const suppressed = this.suppressionDepth > 0 || options.suppressed;
      if (this.current && this.current.writes.has(key)) {
        const violation = { type: "duplicate-write", system, path: key, owner: owner.owner };
        this.duplicateWrites.push(violation);
        this.violations.push(violation);
      }
      if (!this.authorityManager.isAuthoritative(system)) {
        const violation = { type: "legacy-write", system, path: key, owner: owner.owner, suppressed };
        this.violations.push(violation);
        if (!suppressed) this.authorityManager.migrationReport.unsafeLegacyCalls.push(system + ":" + key);
      }
      if (owner.owner === this.authorityManager.authority && system !== this.authorityManager.authority && !suppressed) {
        const violation = { type: "invalid-state-write", system, path: key, owner: owner.owner };
        this.invalidStateWrites.push(violation);
        this.violations.push(violation);
      }
      if (this.current) this.current.writes.add(key);
      this.violations = this.violations.slice(-250);
      this.invalidStateWrites = this.invalidStateWrites.slice(-250);
      this.duplicateWrites = this.duplicateWrites.slice(-250);
    }

    suppress(label, fn) {
      this.suppressionDepth += 1;
      try {
        return fn();
      } finally {
        this.suppressionDepth -= 1;
      }
    }

    wrapLegacyState(state) {
      if (!state || typeof state !== "object" || !this.rawToProxy) return state;
      if (this.proxyToRaw.has(state)) return state;
      if (this.rawToProxy.has(state)) return this.rawToProxy.get(state);
      const self = this;
      const proxy = new Proxy(state, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (!value || typeof value !== "object" || typeof prop === "symbol") return value;
          const prefix = target.__fmgRuntimePath || "";
          const childPath = prefix ? prefix + "." + String(prop) : String(prop);
          try {
            if (!Object.prototype.hasOwnProperty.call(value, "__fmgRuntimePath")) {
              Object.defineProperty(value, "__fmgRuntimePath", { value: childPath, configurable: true, enumerable: false, writable: true });
            }
          } catch (error) {}
          return self.wrapLegacyState(value);
        },
        set(target, prop, value, receiver) {
          const prefix = target.__fmgRuntimePath || "";
          const path = prefix ? prefix + "." + String(prop) : String(prop);
          self.record(path, { system: self.suppressionDepth ? "legacy-compatibility-facade" : "legacy-runtime", suppressed: self.suppressionDepth > 0 });
          return Reflect.set(target, prop, value, receiver);
        },
        deleteProperty(target, prop) {
          const prefix = target.__fmgRuntimePath || "";
          const path = prefix ? prefix + "." + String(prop) : String(prop);
          self.record(path, { system: self.suppressionDepth ? "legacy-compatibility-facade" : "legacy-runtime", suppressed: self.suppressionDepth > 0 });
          return Reflect.deleteProperty(target, prop);
        }
      });
      try {
        Object.defineProperty(state, "__fmgRuntimePath", { value: state.__fmgRuntimePath || "", configurable: true, enumerable: false, writable: true });
      } catch (error) {}
      this.rawToProxy.set(state, proxy);
      this.proxyToRaw.set(proxy, state);
      return proxy;
    }

    installLegacyObserver() {
      if (!FMG.gameState || this.legacyProxy === FMG.gameState) return FMG.gameState;
      try {
        Object.defineProperty(FMG.gameState, "__runtimeOwnership", {
          value: {
            authority: this.authorityManager.authority,
            role: "legacy-compatibility-facade",
            runtimeId: this.authorityManager.runtimeId
          },
          configurable: true,
          enumerable: false,
          writable: true
        });
      } catch (error) {}
      this.legacyProxy = this.wrapLegacyState(FMG.gameState);
      FMG.gameState = this.legacyProxy;
      return FMG.gameState;
    }

    end() {
      if (!this.current) return null;
      const afterState = FMG.gameState ? this.checksum(FMG.gameState) : null;
      if (this.current.beforeState && afterState && this.current.beforeState !== afterState && this.current.writes.size === 0) {
        const violation = { type: "hidden-state-mutation", system: this.current.system, before: this.current.beforeState, after: afterState };
        this.hiddenMutations.push(violation);
        this.violations.push(violation);
      }
      const result = {
        system: this.current.system,
        context: this.current.context,
        writes: Array.from(this.current.writes),
        beforeState: this.current.beforeState,
        afterState
      };
      this.history.push(result);
      this.current = null;
      return result;
    }

    report() {
      return {
        recentTransactions: this.history.slice(-50),
        violations: this.violations.slice(-100),
        duplicateWrites: this.duplicateWrites.slice(-100),
        hiddenMutations: this.hiddenMutations.slice(-100),
        invalidStateWrites: this.invalidStateWrites.slice(-100)
      };
    }
  }

  class LegacyCompatibilityFacade {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
      this.syncLog = [];
    }

    toCore() {
      if (!FMG.Core || !FMG.Core.Adapters || !FMG.Core.Adapters.legacyAdapter) return null;
      const coreState = FMG.Core.Adapters.legacyAdapter.toCore();
      this.authorityManager.setAuthoritativeState(coreState, "legacy-read-projection");
      return coreState;
    }

    syncFromCore(coreState) {
      if (!FMG.Core || !FMG.Core.Adapters || !FMG.Core.Adapters.legacyAdapter) return null;
      this.authorityManager.declare("legacy-compatibility-facade", { owner: "legacy", stateAuthority: "FMG.Core", mode: "facade" });
      this.authorityManager.setAuthoritativeState(coreState, "core-to-legacy-sync");
      const sync = () => FMG.Core.Adapters.legacyAdapter.syncFromCore(coreState);
      const result = FMG.runtimeMutationGuard ? FMG.runtimeMutationGuard.suppress("core-to-legacy-sync", sync) : sync();
      if (FMG.runtimeMutationGuard) FMG.runtimeMutationGuard.installLegacyObserver();
      this.syncLog.unshift({
        direction: "core-to-legacy",
        checksum: this.authorityManager.authoritativeChecksum,
        generation: coreState && coreState.generation,
        at: deterministicNow()
      });
      this.syncLog = this.syncLog.slice(0, 50);
      this.authorityManager.validateNoDivergence(coreState, FMG.gameState, FMG.runtimeOwnershipValidator);
      return result;
    }

    refreshAuthoritativeState(reason) {
      const coreState = this.toCore();
      this.syncLog.unshift({
        direction: "legacy-to-core-projection",
        checksum: this.authorityManager.authoritativeChecksum,
        generation: coreState && coreState.generation,
        reason: reason || "refresh",
        at: deterministicNow()
      });
      this.syncLog = this.syncLog.slice(0, 50);
      return coreState;
    }

    report() {
      return { syncLog: this.syncLog.slice(0, 50), mode: "compatibility-facade", authority: this.authorityManager.authority };
    }
  }

  class RuntimeOwnershipValidator {
    constructor(authorityManager) {
      this.authorityManager = authorityManager;
      this.lastResult = null;
    }

    validate(coreState, legacyState) {
      const errors = [];
      if (!coreState || !legacyState) return { valid: true, skipped: true, errors };
      if (coreState.season && coreState.season.week !== legacyState.currentWeek) errors.push("Core/legacy week divergence");
      if (coreState.season && coreState.season.number !== legacyState.seasonNumber) errors.push("Core/legacy season divergence");
      if ((coreState.clubs || []).length !== (legacyState.teams || []).length) errors.push("Core/legacy club count divergence");
      const corePlayers = (coreState.clubs || []).reduce((sum, club) => sum + ((club.squad || []).length), 0);
      if (corePlayers !== (legacyState.players || []).length) errors.push("Core/legacy player count divergence");
      const duplicatePlayers = {};
      (legacyState.players || []).forEach((player) => {
        if (player && player.id) duplicatePlayers[player.id] = (duplicatePlayers[player.id] || 0) + 1;
      });
      Object.keys(duplicatePlayers).forEach((id) => {
        if (duplicatePlayers[id] > 1) errors.push("Duplicate player id in legacy facade: " + id);
      });
      const ownershipErrors = [];
      Array.from(this.authorityManager.metadataByPath.values()).forEach((entry) => {
        if (entry.owner !== this.authorityManager.authority && entry.reason === "core-gameplay-state") {
          ownershipErrors.push("Invalid ownership for " + entry.path);
        }
      });
      errors.push.apply(errors, ownershipErrors);
      this.lastResult = {
        valid: errors.length === 0,
        errors,
        authority: this.authorityManager.authority,
        coreChecksum: typeof coreState._calculateChecksum === "function" ? coreState._calculateChecksum() : hashString(stableStringify(coreState)),
        legacyChecksum: hashString(stableStringify(legacyState))
      };
      return this.lastResult;
    }

    report() {
      return this.lastResult || { valid: true, skipped: true, authority: this.authorityManager.authority };
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
    constructor(hashEngine) {
      this.ticks = [];
      this.hashEngine = hashEngine || new ReplayHashEngine();
    }

    record(tick, state, context) {
      const checksum = this.hashEngine.hashState(state);
      this.ticks.push({ tick, checksum, context: context || null, rng: FMG.rngStateSerializer ? FMG.rngStateSerializer.serialize(FMG.deterministicRNG).snapshot : null });
      return checksum;
    }

    firstDivergence(otherTicks) {
      const max = Math.max(this.ticks.length, (otherTicks || []).length);
      for (let i = 0; i < max; i++) {
        if (!this.ticks[i] || !otherTicks[i] || this.ticks[i].checksum !== otherTicks[i].checksum) return i;
      }
      return -1;
    }

    divergenceReport(otherTicks) {
      const index = this.firstDivergence(otherTicks || []);
      return {
        ok: index === -1,
        divergenceTick: index,
        left: index >= 0 ? this.ticks[index] || null : null,
        right: index >= 0 ? (otherTicks || [])[index] || null : null,
        leftHash: this.hashEngine.hashReplay(this.ticks),
        rightHash: this.hashEngine.hashReplay(otherTicks || [])
      };
    }
  }

  class DeterministicReplayValidator {
    constructor() {
      this.diffEngine = new ReplayDiffEngine();
      this.hashEngine = new ReplayHashEngine();
      this.divergenceReports = [];
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

    validateReplayLoop(replayEngine, snapshotId, actions, loops) {
      if (!replayEngine || !snapshotId) return { ok: false, skipped: true, reason: "missing replay engine or snapshot" };
      const count = Math.max(2, loops || 2);
      const runs = [];
      for (let index = 0; index < count; index += 1) {
        const result = replayEngine.replay(snapshotId, actions || []);
        const finalHash = this.hashEngine.hashState(result.finalState);
        runs.push({ index, finalHash, actionsProcessed: result.actionsProcessed });
      }
      const expected = runs[0].finalHash;
      const divergent = runs.filter((run) => run.finalHash !== expected);
      this.lastReport = {
        ok: divergent.length === 0,
        snapshotId,
        actionCount: (actions || []).length,
        loops: count,
        expectedHash: expected,
        runs,
        divergent
      };
      if (divergent.length) this.divergenceReports.unshift(this.lastReport);
      this.divergenceReports = this.divergenceReports.slice(0, 50);
      return this.lastReport;
    }

    validateSaveLoadCycle(state, serialize, deserialize) {
      const beforeHash = this.hashEngine.hash(state, { sortEntityArrays: true });
      const payload = serialize ? serialize(state) : JSON.stringify(state);
      const restored = deserialize ? deserialize(payload) : JSON.parse(payload);
      const afterHash = this.hashEngine.hash(restored, { sortEntityArrays: true });
      return {
        ok: beforeHash === afterHash,
        beforeHash,
        afterHash,
        diff: beforeHash === afterHash ? null : this.diffEngine.diff(state, restored)
      };
    }

    validateRollback(snapshotStore, snapshotId, expectedState) {
      if (!snapshotStore || !snapshotId) return { ok: false, skipped: true, reason: "missing snapshot store or snapshot" };
      const restored = snapshotStore.load(snapshotId);
      const restoredHash = this.hashEngine.hashState(restored);
      const expectedHash = this.hashEngine.hashState(expectedState || restored);
      return { ok: restoredHash === expectedHash, snapshotId, restoredHash, expectedHash };
    }

    report() {
      return {
        lastReport: this.lastReport,
        divergenceReports: this.divergenceReports.slice(0, 25)
      };
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
      this.consequences.push({ ...consequence, recordedAt: FMG.nowISO ? FMG.nowISO("consequence") : deterministicISO("consequence") });
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

    serialize(scope, state) {
      return this.diff(scope, state);
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

    apply(base, deltaRecord) {
      const next = JSON.parse(JSON.stringify(base || {}));
      const delta = deltaRecord && deltaRecord.delta ? deltaRecord.delta : {};
      Object.keys(delta).forEach((key) => {
        next[key] = delta[key];
      });
      return next;
    }
  }

  class HistoricalArchiveSystem {
    stateFor(entity, context) {
      context = context || {};
      if (!entity || typeof entity !== "object") return "background";
      if (entity.persistenceState && ["active", "visible", "background", "archived"].includes(entity.persistenceState)) {
        return entity.persistenceState;
      }
      if (entity.isRetired || entity.retired || entity.age >= 38) return "archived";
      if (entity.teamId && entity.teamId === context.userTeamId) return "active";
      if (entity.inLineup || entity.inLiveMatch || entity.isSelected) return "active";
      if (entity.overall >= 78 || entity.mediaRelevance || entity.relationshipProximity) return "visible";
      return "background";
    }

    classify(state) {
      const players = state && state.players ? state.players : [];
      const activePlayers = [];
      const visiblePlayers = [];
      const backgroundPlayers = [];
      const archivedPlayers = [];
      const context = { userTeamId: state && state.userTeamId };
      players.forEach((player) => {
        const persistenceState = this.stateFor(player, context);
        if (persistenceState === "archived") {
          archivedPlayers.push({
            id: player.id,
            name: player.name,
            age: player.age,
            lastTeamId: player.teamId,
            overall: player.overall,
            persistenceState
          });
        } else {
          const decorated = { ...player, persistenceState };
          if (persistenceState === "active") activePlayers.push(decorated);
          else if (persistenceState === "visible") visiblePlayers.push(decorated);
          else backgroundPlayers.push(decorated);
        }
      });
      return {
        activePlayers,
        visiblePlayers,
        backgroundPlayers,
        archivedPlayers,
        counts: {
          active: activePlayers.length,
          visible: visiblePlayers.length,
          background: backgroundPlayers.length,
          archived: archivedPlayers.length
        }
      };
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

    putMany(records) {
      records = records || [];
      return this.open().then((db) => {
        if (!db) {
          records.forEach((entry) => this.memoryStore.set(entry.storeName + ":" + entry.record.id, entry.record));
          return records.map((entry) => entry.record);
        }
        return new Promise((resolve, reject) => {
          const stores = Array.from(new Set(records.map((entry) => entry.storeName)));
          const tx = db.transaction(stores, "readwrite");
          records.forEach((entry) => tx.objectStore(entry.storeName).put(entry.record));
          tx.oncomplete = () => resolve(records.map((entry) => entry.record));
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
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

    getAllByPrefix(storeName, prefix) {
      return this.open().then((db) => {
        if (!db) {
          const needle = storeName + ":" + prefix;
          return Array.from(this.memoryStore.entries())
            .filter((entry) => entry[0].startsWith(needle))
            .map((entry) => entry[1]);
        }
        return new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readonly");
          const request = tx.objectStore(storeName).openCursor();
          const records = [];
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
              resolve(records);
              return;
            }
            if (String(cursor.value.id || "").startsWith(prefix)) records.push(cursor.value);
            cursor.continue();
          };
          request.onerror = () => reject(request.error);
        });
      });
    }

    delete(storeName, id) {
      return this.open().then((db) => {
        if (!db) {
          this.memoryStore.delete(storeName + ":" + id);
          return true;
        }
        return new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, "readwrite");
          tx.objectStore(storeName).delete(id);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
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
      this.lastError = null;
      this.chunkSize = 250000;
    }

    enqueue(slotId, state) {
      const job = { slotId, state: JSON.parse(JSON.stringify(state || {})), enqueuedAt: FMG.nowISO ? FMG.nowISO("save-enqueue") : deterministicISO("save-enqueue") };
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
        players: archive.activePlayers.concat(archive.visiblePlayers, archive.backgroundPlayers),
        persistenceMeta: {
          schema: "incremental-v1",
          entityStates: archive.counts,
          savedFromSlot: job.slotId
        },
        archiveSummary: { archivedPlayers: archive.archivedPlayers.length }
      };
      const serialized = JSON.stringify(checkpoint);
      const chunks = splitChunks(serialized, this.chunkSize);
      const delta = this.deltaSerializer.diff(job.slotId, checkpoint);
      const manifest = {
        id: job.slotId,
        slotId: job.slotId,
        version: FMG.CURRENT_VERSION || "0.1.0",
        savedAt: FMG.nowISO ? FMG.nowISO("save-manifest") : deterministicISO("save-manifest"),
        status: "committed",
        schema: "incremental-v1",
        chunkCount: chunks.length,
        byteLength: serialized.length,
        checksum: hashString(serialized),
        deltaId: job.slotId + ":" + hashString(delta.checksum + ":" + job.enqueuedAt),
        archivedPlayers: archive.archivedPlayers.length,
        entityStates: archive.counts
      };
      this.lastManifest = manifest;
      const pendingManifest = { ...manifest, status: "pending" };
      const records = [{ storeName: "manifests", record: pendingManifest }];
      chunks.forEach((chunk, index) => {
        records.push({ storeName: "chunks", record: { id: job.slotId + ":" + index, slotId: job.slotId, index, checksum: hashString(chunk), data: chunk } });
      });
      records.push({ storeName: "deltas", record: { id: manifest.deltaId, slotId: job.slotId, savedAt: manifest.savedAt, ...delta } });
      if (archive.archivedPlayers.length) records.push({ storeName: "archives", record: { id: job.slotId + ":players", slotId: job.slotId, players: archive.archivedPlayers } });
      records.push({ storeName: "manifests", record: manifest });
      return this.engine.putMany(records)
        .then(() => this._processNext())
        .catch((error) => {
          this.lastError = error && error.message ? error.message : String(error);
          this.processing = false;
          throw error;
        });
    }

    load(slotId) {
      return this.engine.get("manifests", slotId).then((manifest) => {
        if (!manifest || manifest.status !== "committed") return null;
        return this.engine.getAllByPrefix("chunks", slotId + ":").then((chunks) => {
          const ordered = chunks.slice().sort((left, right) => left.index - right.index);
          const integrity = this.validateManifest(manifest, ordered);
          if (!integrity.ok) {
            const error = new Error("Incomplete incremental save: " + integrity.errors.join("; "));
            error.validation = integrity;
            throw error;
          }
          return JSON.parse(ordered.map((chunk) => chunk.data).join(""));
        });
      });
    }

    validateManifest(manifest, chunks) {
      const errors = [];
      if (!manifest) errors.push("manifest missing");
      if (manifest && manifest.status !== "committed") errors.push("manifest not committed");
      if (manifest && chunks.length !== manifest.chunkCount) errors.push("chunk count mismatch");
      chunks.forEach((chunk, index) => {
        if (chunk.index !== index) errors.push("chunk index gap at " + index);
        if (chunk.checksum && chunk.checksum !== hashString(chunk.data || "")) errors.push("chunk checksum mismatch at " + index);
      });
      const serialized = chunks.map((chunk) => chunk.data).join("");
      if (manifest && serialized && hashString(serialized) !== manifest.checksum) errors.push("manifest checksum mismatch");
      return { ok: errors.length === 0, errors, chunkCount: chunks.length };
    }

    report() {
      return { queueLength: this.queue.length, processing: this.processing, lastManifest: this.lastManifest, lastError: this.lastError };
    }
  }

  class ReplayDeltaStorage {
    constructor(engine) {
      this.engine = engine;
    }

    saveReplay(id, events) {
      const payload = { id, savedAt: FMG.nowISO ? FMG.nowISO("replay-save") : deterministicISO("replay-save"), checksum: hashString(stableStringify(events || [])), events: events || [] };
      return this.engine.put("replays", payload);
    }

    loadReplay(id) {
      return this.engine.get("replays", id).then((payload) => {
        if (!payload) return null;
        const validation = this.validate(payload);
        if (!validation.ok) {
          const error = new Error("Replay persistence integrity failed: " + validation.errors.join("; "));
          error.validation = validation;
          throw error;
        }
        return payload.events || [];
      });
    }

    validate(payload) {
      const errors = [];
      if (!payload || typeof payload !== "object") errors.push("replay payload missing");
      if (payload && !Array.isArray(payload.events)) errors.push("replay events missing");
      if (payload && payload.checksum !== hashString(stableStringify(payload.events || []))) errors.push("replay checksum mismatch");
      return { ok: errors.length === 0, errors };
    }
  }

  class SaveIntegrityValidator {
    validate(state) {
      const errors = [];
      if (!state || typeof state !== "object") errors.push("Save payload missing");
      if (state && !Array.isArray(state.teams)) errors.push("Save teams missing");
      if (state && !Array.isArray(state.players)) errors.push("Save players missing");
      if (state && !Array.isArray(state.fixtures)) errors.push("Save fixtures missing");
      if (state && !state.seasonNumber) errors.push("Save season number missing");
      if (state && state.persistenceMeta && state.persistenceMeta.schema !== "incremental-v1") errors.push("Unknown persistence schema");
      return { valid: errors.length === 0, ok: errors.length === 0, errors, checksum: hashString(stableStringify(state || {})) };
    }

    validateEnvelope(envelope) {
      const errors = [];
      if (!envelope || typeof envelope !== "object") errors.push("Save envelope missing");
      if (envelope && envelope.__fmgPersistence === "incremental-v1" && !envelope.slotId) errors.push("Incremental envelope slot missing");
      if (envelope && envelope.__fmgPersistence === "incremental-v1" && !envelope.checksum) errors.push("Incremental envelope checksum missing");
      return { ok: errors.length === 0, valid: errors.length === 0, errors };
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

  class RenderLoopAnalyzer {
    constructor() {
      this.pending = new Map();
      this.frames = [];
      this.duplicates = [];
      this.activeLoops = new Map();
      this.sequence = 1;
      this.installed = false;
      this.nativeRaf = null;
      this.nativeCancel = null;
    }

    install(target) {
      target = target || root;
      if (this.installed || !target || typeof target.requestAnimationFrame !== "function") return false;
      this.nativeRaf = target.requestAnimationFrame.bind(target);
      this.nativeCancel = typeof target.cancelAnimationFrame === "function" ? target.cancelAnimationFrame.bind(target) : null;
      const analyzer = this;
      target.requestAnimationFrame = function (callback) {
        const owner = callback && (callback.__fmgLoopOwner || callback.name) || "anonymous";
        if (Array.from(analyzer.pending.values()).some((entry) => entry.owner === owner)) {
          analyzer.duplicates.push({ type: "duplicate-raf", owner, at: deterministicNow() });
          analyzer.duplicates = analyzer.duplicates.slice(-50);
        }
        const id = "raf:" + analyzer.sequence++;
        const nativeId = analyzer.nativeRaf(function (timestamp) {
          analyzer.pending.delete(id);
          analyzer.recordFrame(owner, timestamp);
          return callback(timestamp);
        });
        analyzer.pending.set(id, { id, nativeId, owner, at: deterministicNow() });
        return id;
      };
      target.cancelAnimationFrame = function (id) {
        const entry = analyzer.pending.get(id);
        if (entry) {
          analyzer.pending.delete(id);
          if (analyzer.nativeCancel) analyzer.nativeCancel(entry.nativeId);
          return;
        }
        if (analyzer.nativeCancel) analyzer.nativeCancel(id);
      };
      this.installed = true;
      return true;
    }

    registerLoop(id) {
      const entry = this.activeLoops.get(id) || { id, starts: 0, frames: 0, active: false };
      if (entry.active) this.duplicates.push({ type: "duplicate-loop", owner: id, at: deterministicNow() });
      entry.starts += 1;
      entry.active = true;
      this.activeLoops.set(id, entry);
      return entry;
    }

    unregisterLoop(id) {
      const entry = this.activeLoops.get(id);
      if (entry) entry.active = false;
    }

    recordFrame(owner, timestamp) {
      const at = Number.isFinite(timestamp) ? timestamp : deterministicNow();
      const previous = this.frames.length ? this.frames[this.frames.length - 1] : null;
      const delta = previous ? Math.max(0, at - previous.at) : 0;
      this.frames.push({ owner: owner || "unknown", at, delta });
      this.frames = this.frames.slice(-180);
      const loop = this.activeLoops.get(owner);
      if (loop) loop.frames += 1;
    }

    fps() {
      const deltas = this.frames.map((frame) => frame.delta).filter((delta) => delta > 0);
      if (!deltas.length) return null;
      const average = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
      return average ? Math.round(1000 / average) : null;
    }

    report() {
      const latest = this.frames.length ? this.frames[this.frames.length - 1].at : deterministicNow();
      const recentFrames = this.frames.filter((frame) => latest - frame.at <= 1000).length;
      return {
        installed: this.installed,
        pendingRaf: this.pending.size,
        activeLoopCount: Array.from(this.activeLoops.values()).filter((entry) => entry.active).length,
        activeLoops: Array.from(this.activeLoops.values()),
        duplicateWarnings: this.duplicates.slice(-20),
        fps: this.fps(),
        rerenderStorm: { storm: recentFrames > 30, frames: recentFrames, limit: 30, windowMs: 1000 }
      };
    }
  }

  class RenderScheduler {
    constructor(masterLoop) {
      this.masterLoop = masterLoop;
      this.queue = new Map();
      this.scheduled = false;
      this.flushCount = 0;
      this.jobCount = 0;
      this.history = [];
      this.stormWarnings = [];
    }

    schedule(key, fn) {
      this.queue.set(key, fn);
      this.jobCount += 1;
      if (this.scheduled) return;
      this.scheduled = true;
      const flush = () => this.flush();
      if (root.requestAnimationFrame) root.requestAnimationFrame(flush);
      else Promise.resolve().then(flush);
    }

    flush() {
      const startedAt = deterministicNow();
      const jobs = Array.from(this.queue.values());
      const keys = Array.from(this.queue.keys());
      this.queue.clear();
      this.scheduled = false;
      this.flushCount += 1;
      jobs.forEach((job) => job());
      const entry = { at: startedAt, jobs: jobs.length, keys };
      this.history.push(entry);
      this.history = this.history.slice(-120);
      if (jobs.length > 50) this.stormWarnings.push({ ...entry, type: "large-flush" });
      if (FMG.renderLoopAnalyzer) FMG.renderLoopAnalyzer.recordFrame("render-scheduler", startedAt);
      return entry;
    }

    report() {
      return {
        scheduled: this.scheduled,
        queuedJobs: this.queue.size,
        flushCount: this.flushCount,
        jobCount: this.jobCount,
        stormWarnings: this.stormWarnings.slice(-10),
        history: this.history.slice(-20)
      };
    }
  }

  class PersistentUIShell {
    constructor(app, scheduler) {
      this.app = app;
      this.scheduler = scheduler;
      this.nodes = {};
      this.hashes = {};
      this.renderCount = 0;
      this.staleReferences = [];
      this.ensure();
    }

    ensure() {
      if (!this.app) return;
      if (this.nodes.route && this._isConnected(this.nodes.route)) return;
      if (this.nodes.route && !this._isConnected(this.nodes.route)) this.staleReferences.push({ key: "route", at: deterministicNow() });
      this.app.innerHTML = '<div class="fmg-shell-root"><div class="fmg-nav-root"></div><main class="fmg-route-root"></main><aside class="fmg-overlay-root"></aside></div>';
      this.nodes.nav = this.app.querySelector(".fmg-nav-root");
      this.nodes.route = this.app.querySelector(".fmg-route-root");
      this.nodes.overlay = this.app.querySelector(".fmg-overlay-root");
      if (FMG.detachedDOMDetector) {
        FMG.detachedDOMDetector.track("ui-shell-app", this.app, "persistent-ui-shell");
        Object.keys(this.nodes).forEach((key) => FMG.detachedDOMDetector.track("ui-shell-" + key, this.nodes[key], "persistent-ui-shell"));
      }
    }

    _isConnected(node) {
      if (!node) return false;
      if (typeof node.isConnected === "boolean") return node.isConnected;
      if (!root.document || !root.document.documentElement || !root.document.documentElement.contains) return true;
      return root.document.documentElement.contains(node);
    }

    render(parts) {
      this.ensure();
      this.renderCount += 1;
      ["nav", "route", "overlay"].forEach((key) => {
        const html = parts[key] || "";
        const hash = hashString(html);
        if (this.hashes[key] === hash || !this.nodes[key]) return;
        this.scheduler.schedule("ui:" + key, () => {
          if (!this._isConnected(this.nodes[key])) this.ensure();
          this.nodes[key].innerHTML = html;
          this.hashes[key] = hash;
          if (key === "overlay" && FMG.overlayManager) FMG.overlayManager.markRendered(html);
        });
      });
    }

    report() {
      return { renderCount: this.renderCount, staleReferences: this.staleReferences.slice(-20), hashes: { ...this.hashes } };
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
      this.renderedHash = null;
      this.history = [];
    }

    set(id, html) {
      if (!html) this.overlays.delete(id);
      else this.overlays.set(id, { id, html, updatedAt: deterministicNow() });
    }

    render() {
      const html = Array.from(this.overlays.values()).map((entry) => entry.html).join("");
      this.markRendered(html);
      return html;
    }

    markRendered(html) {
      this.renderedHash = hashString(html || "");
      this.history.push({ at: deterministicNow(), hash: this.renderedHash, active: this.overlays.size });
      this.history = this.history.slice(-60);
    }

    clear(id) {
      if (id) this.overlays.delete(id);
      else this.overlays.clear();
    }

    report() {
      return {
        activeOverlays: this.overlays.size,
        renderedHash: this.renderedHash,
        possibleLeak: this.overlays.size > 5,
        overlays: Array.from(this.overlays.keys()),
        history: this.history.slice(-20)
      };
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
      this.duplicates = [];
      this.targetCounts = new Map();
      this.accumulationWarnings = [];
    }

    add(target, type, handler, options) {
      if (!target || !target.addEventListener) return null;
      const id = "listener:" + this.nextId++;
      target.addEventListener(type, handler, options);
      const targetName = target.id || target.className || target.name || target.nodeName || "target";
      const signature = [targetName, type, handler && (handler.name || String(handler).slice(0, 40))].join(":");
      if (Array.from(this.listeners.values()).some((entry) => entry.signature === signature)) {
        this.duplicates.push({ id, signature, at: deterministicNow() });
        this.duplicates = this.duplicates.slice(-50);
      }
      const count = (this.targetCounts.get(targetName) || 0) + 1;
      this.targetCounts.set(targetName, count);
      if (count > 50) this.accumulationWarnings.push({ target: targetName, count, at: deterministicNow() });
      this.listeners.set(id, { id, target, targetName, type, handler, options, signature });
      return id;
    }

    remove(id) {
      const entry = this.listeners.get(id);
      if (!entry) return false;
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
      this.listeners.delete(id);
      this.targetCounts.set(entry.targetName, Math.max(0, (this.targetCounts.get(entry.targetName) || 1) - 1));
      return true;
    }

    count() {
      return this.listeners.size;
    }

    report() {
      return {
        currentListeners: this.listeners.size,
        duplicates: this.duplicates.slice(-20),
        accumulationWarnings: this.accumulationWarnings.slice(-20),
        byTarget: Array.from(this.targetCounts.entries()).reduce((acc, entry) => {
          acc[entry[0]] = entry[1];
          return acc;
        }, {})
      };
    }
  }

  class EventLeakDetector {
    constructor(registry) {
      this.registry = registry;
      this.samples = [];
    }

    sample() {
      const sample = { listeners: this.registry.count(), at: deterministicTick("listener-sample") };
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

  class DetachedDOMDetector {
    constructor() {
      this.tracked = new Map();
      this.samples = [];
    }

    track(id, node, owner) {
      if (!node) return null;
      const key = id || "node:" + this.tracked.size;
      this.tracked.set(key, { id: key, node, owner: owner || "unknown", detachedSince: null });
      return key;
    }

    untrack(id) {
      this.tracked.delete(id);
    }

    isDetached(node) {
      if (!node) return false;
      if (typeof node.isConnected === "boolean") return !node.isConnected;
      if (!root.document || !root.document.documentElement || !root.document.documentElement.contains) return false;
      return !root.document.documentElement.contains(node);
    }

    sample() {
      const nodes = [];
      this.tracked.forEach((entry) => {
        if (this.isDetached(entry.node)) {
          if (!entry.detachedSince) entry.detachedSince = deterministicNow();
          nodes.push({ id: entry.id, owner: entry.owner, detachedSince: entry.detachedSince });
        } else {
          entry.detachedSince = null;
        }
      });
      const sample = { at: deterministicNow(), tracked: this.tracked.size, detached: nodes.length, nodes };
      this.samples.push(sample);
      this.samples = this.samples.slice(-60);
      return sample;
    }

    report() {
      const latest = this.sample();
      return { tracked: latest.tracked, detached: latest.detached, staleReferences: latest.nodes, samples: this.samples.slice(-20) };
    }
  }

  class RuntimeMemoryDiagnostics {
    constructor(listenerRegistry, lifecycleTracker, detachedDetector, renderLoopAnalyzer) {
      this.listenerRegistry = listenerRegistry;
      this.lifecycleTracker = lifecycleTracker;
      this.detachedDetector = detachedDetector;
      this.renderLoopAnalyzer = renderLoopAnalyzer;
      this.samples = [];
    }

    sample(state) {
      const memory = root.performance && root.performance.memory ? root.performance.memory.usedJSHeapSize : null;
      const sample = {
        at: deterministicNow(),
        heapBytes: memory,
        entityCount: state && state.players ? state.players.length : 0,
        listeners: this.listenerRegistry.count(),
        listenerReport: this.listenerRegistry.report ? this.listenerRegistry.report() : null,
        lifecycle: this.lifecycleTracker.report(),
        detachedDOM: this.detachedDetector ? this.detachedDetector.report() : null,
        renderLoop: this.renderLoopAnalyzer ? this.renderLoopAnalyzer.report() : null,
        overlay: FMG.overlayManager ? FMG.overlayManager.report() : null
      };
      this.samples.push(sample);
      this.samples = this.samples.slice(-120);
      return sample;
    }

    trend() {
      const first = this.samples[0];
      const last = this.samples[this.samples.length - 1];
      return {
        samples: this.samples.length,
        heapDelta: first && last && Number.isFinite(first.heapBytes) && Number.isFinite(last.heapBytes) ? last.heapBytes - first.heapBytes : null,
        listenerDelta: first && last ? last.listeners - first.listeners : 0,
        detachedDelta: first && last ? (last.detachedDOM?.detached || 0) - (first.detachedDOM?.detached || 0) : 0
      };
    }

    report() {
      const latest = this.samples.length ? this.samples[this.samples.length - 1] : this.sample(FMG.gameState || {});
      const trend = this.trend();
      return { latest, trend, stable: trend.listenerDelta <= 2 && trend.detachedDelta <= 0 };
    }
  }

  function stressOutcome(name, startedAt, checks, errors, details) {
    errors = errors || [];
    return {
      name,
      ok: errors.length === 0,
      startedAt,
      finishedAt: FMG.nowISO ? FMG.nowISO(name + "-finished") : deterministicISO(name + "-finished"),
      checks: checks || {},
      errors,
      details: details || {}
    };
  }

  class ReplayStressHarness {
    constructor(config) {
      config = config || {};
      this.replayEngine = config.replayEngine || null;
      this.snapshotId = config.snapshotId || null;
      this.actions = config.actions || [];
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("replay-stress-start") : deterministicISO("replay-stress-start");
      const loops = Math.max(1, Number(options.loops || 25));
      const checksums = [];
      const errors = [];
      for (let index = 0; index < loops; index += 1) {
        try {
          if (this.replayEngine && this.snapshotId && typeof this.replayEngine.replay === "function") {
            const result = this.replayEngine.replay(this.snapshotId, this.actions);
            checksums.push(result.finalState && typeof result.finalState._calculateChecksum === "function" ? result.finalState._calculateChecksum() : hashString(stableStringify(result)));
          } else {
            checksums.push(hashString("synthetic-replay:" + index));
          }
        } catch (error) {
          errors.push("loop " + index + ": " + error.message);
        }
      }
      const unique = Array.from(new Set(checksums));
      if (this.replayEngine && unique.length > 1) errors.push("Replay checksum diverged across loops");
      this.lastReport = stressOutcome("replay-stress", startedAt, { loops, checksumStable: !this.replayEngine || unique.length <= 1, checksums: unique.slice(0, 5) }, errors);
      return this.lastReport;
    }
  }

  class SaveStressHarness {
    constructor(config) {
      config = config || {};
      this.slotId = config.slotId || "stress-slot";
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("save-stress-start") : deterministicISO("save-stress-start");
      const loops = Math.max(1, Number(options.loops || 10));
      const errors = [];
      for (let index = 0; index < loops; index += 1) {
        try {
          if (!FMG.saveToSlot || !FMG.loadFromSlot) {
            errors.push("save/load API missing");
            break;
          }
          const saved = FMG.saveToSlot(FMG.gameState || {}, this.slotId, { overwrite: true, reason: "stress-" + index });
          if (!saved || saved.ok === false) errors.push("save failed at " + index + ": " + (saved && saved.message));
          const loaded = FMG.loadFromSlot(this.slotId);
          if (!loaded || loaded.ok === false) errors.push("load failed at " + index + ": " + (loaded && loaded.message));
        } catch (error) {
          errors.push("loop " + index + ": " + error.message);
        }
      }
      const corruption = this.injectCorruption(options);
      if (!corruption.ok) errors.push(...corruption.errors);
      this.lastReport = stressOutcome("save-stress", startedAt, { loops, corruptionRecovered: corruption.recovered }, errors, { corruption, pipeline: FMG.incrementalSavePipeline && FMG.incrementalSavePipeline.report() });
      return this.lastReport;
    }

    injectCorruption(options) {
      if (options && options.corruption === false) return { ok: true, skipped: true, recovered: false, errors: [] };
      if (!root.localStorage || !FMG.SAVE_SLOT_PREFIX || !FMG.loadFromSlot) return { ok: true, skipped: true, recovered: false, errors: [] };
      const key = FMG.SAVE_SLOT_PREFIX + this.slotId;
      const raw = root.localStorage.getItem(key);
      if (!raw) return { ok: true, skipped: true, recovered: false, errors: [] };
      root.localStorage.setItem(key, "{corrupted-stress-payload");
      const loaded = FMG.loadFromSlot(this.slotId);
      root.localStorage.setItem(key, raw);
      const recovered = Boolean(loaded && loaded.ok);
      return { ok: recovered, recovered, errors: recovered ? [] : ["corrupted save did not recover"] };
    }
  }

  class UINavStressHarness {
    constructor(config) {
      config = config || {};
      this.routes = config.routes || null;
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("ui-stress-start") : deterministicISO("ui-stress-start");
      const loops = Math.max(1, Number(options.loops || 50));
      const routes = this.routes || Object.values(FMG.ROUTES || { dashboard: "dashboard", settings: "settings" });
      const errors = [];
      for (let index = 0; index < loops; index += 1) {
        try {
          if (FMG.gameState) FMG.gameState.route = routes[index % routes.length];
          if (typeof FMG.render === "function") FMG.render();
          else if (FMG.persistentUIShell) FMG.persistentUIShell.render({ nav: "<nav>stress</nav>", route: "<section>" + index + "</section>", overlay: "" });
          if (FMG.renderScheduler && typeof FMG.renderScheduler.flush === "function") FMG.renderScheduler.flush();
        } catch (error) {
          errors.push("nav loop " + index + ": " + error.message);
        }
      }
      this.lastReport = stressOutcome("ui-nav-stress", startedAt, { loops, routes: routes.length }, errors, { ui: FMG.generateUILifecycleReport && FMG.generateUILifecycleReport(), render: FMG.generateRenderStabilityReport && FMG.generateRenderStabilityReport() });
      return this.lastReport;
    }
  }

  class MemoryStressHarness {
    constructor() {
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("memory-stress-start") : deterministicISO("memory-stress-start");
      const loops = Math.max(1, Number(options.loops || 20));
      const transient = [];
      for (let index = 0; index < loops; index += 1) {
        if (options.allocate) transient.push(new Array(64).fill("stress-" + index));
        if (FMG.runtimeMemoryDiagnostics) FMG.runtimeMemoryDiagnostics.sample(FMG.gameState || {});
      }
      transient.length = 0;
      const memory = FMG.generateMemoryLeakReport ? FMG.generateMemoryLeakReport() : null;
      const trend = memory && memory.diagnostics ? memory.diagnostics.trend : null;
      const errors = [];
      if (trend && trend.listenerDelta > 5) errors.push("listener count grew during memory stress");
      if (trend && trend.detachedDelta > 0) errors.push("detached DOM grew during memory stress");
      this.lastReport = stressOutcome("memory-stress", startedAt, { loops, stable: !memory || memory.ok, trend }, errors, { memory });
      return this.lastReport;
    }
  }

  class WorldSimulationHarness {
    constructor() {
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("world-stress-start") : deterministicISO("world-stress-start");
      const weeks = Math.max(0, Number(options.weeks || 8));
      const matchLoops = Math.max(0, Number(options.matchLoops || 3));
      const errors = [];
      let advancedWeeks = 0;
      let matchAttempts = 0;
      for (let index = 0; index < weeks; index += 1) {
        try {
          if (typeof FMG.advanceWeek !== "function") break;
          const result = FMG.advanceWeek();
          if (!result || result.ok === false) {
            if (options.failOnBlockedWeek) errors.push("advanceWeek failed: " + (result && result.message));
            break;
          }
          advancedWeeks += 1;
        } catch (error) {
          errors.push("advanceWeek exception: " + error.message);
          break;
        }
      }
      for (let index = 0; index < matchLoops; index += 1) {
        try {
          if (typeof FMG.startLiveUserMatch !== "function") break;
          const result = FMG.startLiveUserMatch();
          matchAttempts += 1;
          if (result && result.ok && FMG.gameState && FMG.gameState.liveMatch) {
            FMG.gameState.liveMatch.completed = true;
            if (FMG.finishLiveUserMatch) FMG.finishLiveUserMatch();
          }
        } catch (error) {
          errors.push("match spam exception: " + error.message);
        }
      }
      this.lastReport = stressOutcome("world-simulation-stress", startedAt, { requestedWeeks: weeks, advancedWeeks, matchAttempts }, errors, { worldPlan: FMG.layeredWorldSimulator && FMG.layeredWorldSimulator.plan(FMG.gameState || {}) });
      return this.lastReport;
    }
  }

  class WorldEntropyAnalyzer {
    constructor() {
      this.history = [];
    }

    analyze(state) {
      state = state || {};
      const players = Array.isArray(state.players) ? state.players : [];
      const activePlayers = players.filter((player) => !player.retired && !player.isRetired);
      const teams = Array.isArray(state.teams) ? state.teams : [];
      const byTeam = new Map();
      activePlayers.forEach((player) => {
        const key = player.teamId || "free-agent";
        byTeam.set(key, (byTeam.get(key) || 0) + 1);
      });
      const overalls = activePlayers.map((player) => Number(player.overall) || 0).filter(Boolean);
      const ages = activePlayers.map((player) => Number(player.age) || 0).filter(Boolean);
      const entropy = this._distributionEntropy(Array.from(byTeam.values()));
      const report = {
        at: FMG.nowISO ? FMG.nowISO("world-entropy") : deterministicISO("world-entropy"),
        teams: teams.length,
        players: players.length,
        activePlayers: activePlayers.length,
        retiredPlayers: players.length - activePlayers.length,
        freeAgents: byTeam.get("free-agent") || 0,
        teamDistributionEntropy: entropy,
        averageOverall: this._average(overalls),
        overallStdDev: this._stdDev(overalls),
        averageAge: this._average(ages),
        ageStdDev: this._stdDev(ages),
        entityExplosion: teams.length ? activePlayers.length > teams.length * 45 : activePlayers.length > 1000,
        worldHomogenization: overalls.length > 5 && this._stdDev(overalls) < 2 && entropy < Math.max(1, Math.log2(Math.max(2, teams.length)) * 0.6),
        squadImbalance: teams.length ? Array.from(byTeam.values()).some((count) => count > 55) : false
      };
      this.history.push(report);
      this.history = this.history.slice(-120);
      return report;
    }

    _average(values) {
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    }

    _stdDev(values) {
      if (!values.length) return 0;
      const average = this._average(values);
      return Math.sqrt(values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length);
    }

    _distributionEntropy(values) {
      const total = values.reduce((sum, value) => sum + value, 0);
      if (!total) return 0;
      return values.reduce((sum, value) => {
        const p = value / total;
        return p > 0 ? sum - (p * Math.log2(p)) : sum;
      }, 0);
    }

    report() {
      return { latest: this.history[this.history.length - 1] || null, history: this.history.slice(-20) };
    }
  }

  class FootballEvolutionAnalyzer {
    constructor() {
      this.history = [];
    }

    analyze(state) {
      state = state || {};
      const players = Array.isArray(state.players) ? state.players.filter((player) => !player.retired && !player.isRetired) : [];
      const teams = Array.isArray(state.teams) ? state.teams : [];
      const tactics = state.tactics && state.tactics.teamSettings ? Object.values(state.tactics.teamSettings) : [];
      const formations = tactics.map((entry) => entry.formation || entry.shape || "unknown").filter((item) => item !== "unknown");
      const styles = teams.map((team) => team.style || "unknown");
      const marketHistory = state.market && Array.isArray(state.market.transferHistory) ? state.market.transferHistory : [];
      const balances = [];
      if (state.finances && Number.isFinite(state.finances.balance)) balances.push(state.finances.balance);
      if (state.rivalAI && state.rivalAI.budgets) {
        Object.values(state.rivalAI.budgets).forEach((budget) => {
          if (Number.isFinite(budget)) balances.push(budget);
          else if (budget && Number.isFinite(budget.transfer)) balances.push(budget.transfer);
        });
      }
      const report = {
        at: FMG.nowISO ? FMG.nowISO("football-evolution") : deterministicISO("football-evolution"),
        seasonNumber: state.seasonNumber || 1,
        averageOverall: this._average(players.map((player) => Number(player.overall) || 0)),
        elitePlayers: players.filter((player) => (Number(player.overall) || 0) >= 80).length,
        youthPlayers: players.filter((player) => (Number(player.age) || 0) <= 22).length,
        veteranPlayers: players.filter((player) => (Number(player.age) || 0) >= 34).length,
        transferVolume: marketHistory.length,
        formationDiversity: new Set(formations).size,
        styleDiversity: new Set(styles).size,
        economicSpread: this._stdDev(balances),
        footballRealismDecay: this._detectRealismDecay(players),
        tacticalStagnation: formations.length > 3 && new Set(formations).size <= 1,
        economicInstability: balances.some((value) => Math.abs(value) > 5000000000),
        worldHomogenization: new Set(styles).size <= 1 && teams.length > 3
      };
      this.history.push(report);
      this.history = this.history.slice(-120);
      return report;
    }

    _average(values) {
      const clean = values.filter((value) => Number.isFinite(value));
      return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
    }

    _stdDev(values) {
      const clean = values.filter((value) => Number.isFinite(value));
      if (!clean.length) return 0;
      const average = this._average(clean);
      return Math.sqrt(clean.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / clean.length);
    }

    _detectRealismDecay(players) {
      if (!players.length) return false;
      const impossibleRatings = players.filter((player) => player.overall < 35 || player.overall > 99).length;
      const impossibleAges = players.filter((player) => player.age < 15 || player.age > 45).length;
      const averageOverall = this._average(players.map((player) => Number(player.overall) || 0));
      return impossibleRatings > 0 || impossibleAges > 0 || averageOverall < 45 || averageOverall > 88;
    }

    report() {
      return { latest: this.history[this.history.length - 1] || null, history: this.history.slice(-20) };
    }
  }

  class LongTermSimulationRunner {
    constructor(config) {
      config = config || {};
      this.entropyAnalyzer = config.entropyAnalyzer || new WorldEntropyAnalyzer();
      this.evolutionAnalyzer = config.evolutionAnalyzer || new FootballEvolutionAnalyzer();
      this.priorityManager = config.priorityManager || null;
      this.history = [];
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const years = Math.max(1, Number(options.years || 10));
      const startedAt = FMG.nowISO ? FMG.nowISO("long-term-simulation-start") : deterministicISO("long-term-simulation-start");
      const snapshots = [];
      const errors = [];
      for (let year = 1; year <= years; year += 1) {
        try {
          if (options.accelerated !== false) this._acceleratedSeason(FMG.gameState || {}, year, options);
          else this._realSeason(FMG.gameState || {}, options);
          if (year === 1 || year % Math.max(1, Number(options.sampleEveryYears || 5)) === 0 || year === years) {
            snapshots.push(this._sample(FMG.gameState || {}, year));
          }
        } catch (error) {
          errors.push("year " + year + ": " + error.message);
          if (options.stopOnError) break;
        }
      }
      const latest = snapshots[snapshots.length - 1] || this._sample(FMG.gameState || {}, years);
      const detections = this._detect(latest);
      Object.keys(detections).forEach((key) => {
        if (detections[key] === true) errors.push(key);
      });
      this.lastReport = {
        name: "long-term-simulation",
        ok: errors.length === 0,
        startedAt,
        finishedAt: FMG.nowISO ? FMG.nowISO("long-term-simulation-finished") : deterministicISO("long-term-simulation-finished"),
        years,
        accelerated: options.accelerated !== false,
        snapshots,
        detections,
        errors
      };
      this.history.push(this.lastReport);
      this.history = this.history.slice(-20);
      return this.lastReport;
    }

    runDecadeSet(options) {
      options = options || {};
      return {
        tenYear: this.run({ ...options, years: 10, accelerated: true }),
        twentyFiveYear: this.run({ ...options, years: 25, accelerated: true }),
        fiftyYear: this.run({ ...options, years: 50, accelerated: true })
      };
    }

    _realSeason(state, options) {
      const maxWeeks = Math.max(1, Number(options.maxWeeksPerYear || state.totalWeeks || 30));
      for (let week = 0; week < maxWeeks; week += 1) {
        if (!FMG.advanceWeek) break;
        const result = FMG.advanceWeek();
        if (!result || result.ok === false) break;
      }
      if (state.seasonComplete && FMG.startNewSeason) FMG.startNewSeason();
    }

    _acceleratedSeason(state, year, options) {
      if (!state || !Array.isArray(state.players)) return;
      state.seasonNumber = (state.seasonNumber || 1) + 1;
      this._massiveTransferSimulation(state, year, options);
      this._massiveRetirementCycle(state, year, options);
      state.players.forEach((player, index) => {
        if (player.retired || player.isRetired) return;
        player.age = Math.min(45, (Number(player.age) || 24) + 1);
        const development = player.age <= 23 ? 1 : player.age >= 32 ? -1 : 0;
        player.overall = FMG.clamp ? FMG.clamp((Number(player.overall) || 60) + development + ((year + index) % 3 === 0 ? 1 : 0), 35, 99) : Math.max(35, Math.min(99, (Number(player.overall) || 60) + development));
        player.contractYears = Math.max(0, (Number(player.contractYears) || 1) - 1);
      });
      if (state.finances) {
        const drift = ((year % 5) - 2) * 1500000;
        state.finances.balance = Number(state.finances.balance || 0) + drift;
        if (state.finances.budgets && Number.isFinite(state.finances.budgets.transfers)) {
          state.finances.budgets.transfers = Math.max(0, state.finances.budgets.transfers + drift);
        }
      }
      if (FMG.layeredWorldSimulator) FMG.layeredWorldSimulator.plan(state);
    }

    _massiveTransferSimulation(state, year, options) {
      const transferLoops = Math.max(0, Number(options.transferLoopsPerYear || 12));
      state.market = state.market || {};
      state.market.transferHistory = state.market.transferHistory || [];
      const activePlayers = state.players.filter((player) => !player.retired && !player.isRetired);
      const teams = (state.teams || []).filter((team) => team.id);
      if (!teams.length) return;
      for (let index = 0; index < transferLoops && activePlayers.length; index += 1) {
        const player = activePlayers[(year * 17 + index * 7) % activePlayers.length];
        const target = teams[(year + index) % teams.length];
        const oldTeamId = player.teamId;
        if (target && oldTeamId !== target.id) {
          player.teamId = target.id;
          player.contractYears = 1 + ((year + index) % 4);
          state.market.transferHistory.unshift({
            week: state.currentWeek || 1,
            season: state.seasonNumber || year,
            type: "stress-ai-transfer",
            playerId: player.id,
            playerName: player.name,
            fromTeamId: oldTeamId,
            toTeamId: target.id,
            fee: Math.max(0, Number(player.value || player.overall * 100000))
          });
        }
      }
      state.market.transferHistory = state.market.transferHistory.slice(0, Math.max(200, transferLoops * 10));
    }

    _massiveRetirementCycle(state, year, options) {
      const retired = [];
      state.players.forEach((player, index) => {
        if (player.retired || player.isRetired) return;
        const age = Number(player.age) || 24;
        if (age >= 38 || (age >= 34 && (year + index) % 6 === 0)) {
          player.retired = true;
          player.retiredSeason = state.seasonNumber || year;
          retired.push(player);
        }
      });
      const regenLimit = Math.min(retired.length, Math.max(0, Number(options.maxRegensPerYear || 18)));
      for (let index = 0; index < regenLimit; index += 1) {
        const source = retired[index];
        state.players.push({
          id: "stress-regen-" + (state.seasonNumber || year) + "-" + index + "-" + hashString(source.id || source.name || index),
          name: "Regen " + (source.name || index),
          teamId: source.teamId || "free-agent",
          position: source.position || "MED",
          age: 17 + ((year + index) % 4),
          overall: Math.max(45, Math.min(72, (Number(source.overall) || 62) - 12)),
          potential: Math.max(Number(source.potential || source.overall || 70), 70),
          value: Math.max(100000, Number(source.value || 1000000) * 0.2),
          salary: Math.max(50000, Number(source.salary || 250000) * 0.4),
          morale: 65,
          energy: 90,
          contractYears: 3,
          lineageParentId: source.id
        });
      }
    }

    _sample(state, year) {
      const entropy = this.entropyAnalyzer.analyze(state);
      const evolution = this.evolutionAnalyzer.analyze(state);
      const memory = FMG.runtimeMemoryDiagnostics ? FMG.runtimeMemoryDiagnostics.sample(state) : null;
      const layers = FMG.layeredWorldSimulator ? FMG.layeredWorldSimulator.plan(state) : null;
      return { year, entropy, evolution, memory, layers };
    }

    _detect(snapshot) {
      const entropy = snapshot.entropy || {};
      const evolution = snapshot.evolution || {};
      const memory = snapshot.memory || {};
      return {
        entityExplosion: Boolean(entropy.entityExplosion),
        memoryCollapse: Boolean(memory.heapBytes && memory.heapBytes > 900000000),
        footballRealismDecay: Boolean(evolution.footballRealismDecay),
        tacticalStagnation: Boolean(evolution.tacticalStagnation),
        economicInstability: Boolean(evolution.economicInstability),
        worldHomogenization: Boolean(entropy.worldHomogenization || evolution.worldHomogenization)
      };
    }

    report() {
      return this.lastReport || { ok: true, history: this.history };
    }
  }

  class RuntimeStressHarness {
    constructor(config) {
      config = config || {};
      this.replay = config.replay || new ReplayStressHarness();
      this.save = config.save || new SaveStressHarness();
      this.ui = config.ui || new UINavStressHarness();
      this.memory = config.memory || new MemoryStressHarness();
      this.world = config.world || new WorldSimulationHarness();
      this.history = [];
      this.lastReport = null;
    }

    run(options) {
      options = options || {};
      const startedAt = FMG.nowISO ? FMG.nowISO("runtime-stress-start") : deterministicISO("runtime-stress-start");
      const details = {
        browser: this.runBrowserExecution(options.browser || {}),
        replay: this.replay.run(options.replay || {}),
        save: this.save.run(options.save || {}),
        ui: this.ui.run(options.ui || {}),
        memory: this.memory.run(options.memory || {}),
        world: this.world.run(options.world || {})
      };
      const errors = [];
      Object.keys(details).forEach((key) => {
        (details[key].errors || []).forEach((error) => errors.push(key + ": " + error));
      });
      this.lastReport = stressOutcome("runtime-stress", startedAt, {
        browserOk: details.browser.ok,
        replayOk: details.replay.ok,
        saveOk: details.save.ok,
        uiOk: details.ui.ok,
        memoryOk: details.memory.ok,
        worldOk: details.world.ok
      }, errors, details);
      this.history.push(this.lastReport);
      this.history = this.history.slice(-20);
      return this.lastReport;
    }

    runBrowserExecution(options) {
      const startedAt = FMG.nowISO ? FMG.nowISO("browser-stress-start") : deterministicISO("browser-stress-start");
      const errors = [];
      const hasDocument = Boolean(root.document);
      const hasApp = Boolean(hasDocument && root.document.querySelector && root.document.querySelector("#app"));
      if (options.requireDocument && !hasDocument) errors.push("document missing");
      if (options.requireApp && !hasApp) errors.push("#app missing");
      if (typeof FMG.render === "function") {
        try { FMG.render(); } catch (error) { errors.push("render failed: " + error.message); }
      }
      return stressOutcome("browser-execution-stress", startedAt, { hasDocument, hasApp, hasRender: typeof FMG.render === "function" }, errors);
    }

    report() {
      return this.lastReport || { ok: true, history: this.history };
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
    FMG.rng = () => deterministicRandom("FMG.rng");
    FMG.randomFloat = (label) => deterministicRandom(label || "random-float");
    FMG.randomInt = (min, max) => Math.floor(FMG.randomFloat("random-int") * (max - min + 1)) + min;
    FMG.sample = (items) => {
      if (!items || !items.length) return null;
      return items[FMG.randomInt(0, items.length - 1)];
    };
    FMG.uid = (prefix) => (prefix || "id") + "-" + hashString([prefix, FMG.deterministicRNG.counter, FMG.randomFloat("uid")].join(":"));
    FMG.nowMs = () => FMG.simulationClock.now();
    FMG.tickMs = (label) => FMG.simulationClock.tick(label || "runtime");
    FMG.nowISO = (label) => {
      FMG.simulationClock.tick(label || "time");
      return FMG.simulationClock.iso();
    };
    FMG.deterministicSort = deterministicSort;
    FMG.stableEntityKey = stableEntityKey;
    return { clock: FMG.simulationClock.snapshot(), rng: FMG.deterministicRNG.snapshot() };
  }

  function install() {
    installDeterminism();
    FMG.rngStateSerializer = FMG.rngStateSerializer || new RNGStateSerializer();
    FMG.replayHashEngine = FMG.replayHashEngine || new ReplayHashEngine();
    FMG.runtimeRandomnessAudit = FMG.runtimeRandomnessAudit || new RuntimeRandomnessAudit();
    FMG.runtimeAuthorityManager = FMG.runtimeAuthorityManager || new RuntimeAuthorityManager();
    FMG.runtimeAuthorityManager.start("hardening-install");
    FMG.runtimeAuthorityManager.declare("FMG.Core", { owner: "FMG.Core", stateAuthority: "FMG.Core" });
    FMG.runtimeAuthorityManager.declare("legacy-runtime", { owner: "legacy", stateAuthority: "FMG.Core", mode: "facade" });
    FMG.legacyCompatibilityFacade = FMG.legacyCompatibilityFacade || new LegacyCompatibilityFacade(FMG.runtimeAuthorityManager);
    FMG.runtimeMutationGuard = FMG.runtimeMutationGuard || new RuntimeMutationGuard(FMG.runtimeAuthorityManager);
    FMG.runtimeOwnershipValidator = FMG.runtimeOwnershipValidator || new RuntimeOwnershipValidator(FMG.runtimeAuthorityManager);
    FMG.deterministicReplayValidator = FMG.deterministicReplayValidator || new DeterministicReplayValidator();
    FMG.tickReplayInspector = FMG.tickReplayInspector || new TickReplayInspector(FMG.replayHashEngine);
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
    FMG.renderLoopAnalyzer = FMG.renderLoopAnalyzer || new RenderLoopAnalyzer();
    FMG.renderLoopAnalyzer.install(root);
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
    FMG.detachedDOMDetector = FMG.detachedDOMDetector || new DetachedDOMDetector();
    FMG.runtimeMemoryDiagnostics = FMG.runtimeMemoryDiagnostics || new RuntimeMemoryDiagnostics(FMG.listenerRegistry, FMG.entityLifecycleTracker, FMG.detachedDOMDetector, FMG.renderLoopAnalyzer);
    FMG.replayStressHarness = FMG.replayStressHarness || new ReplayStressHarness();
    FMG.saveStressHarness = FMG.saveStressHarness || new SaveStressHarness();
    FMG.uiNavStressHarness = FMG.uiNavStressHarness || new UINavStressHarness();
    FMG.memoryStressHarness = FMG.memoryStressHarness || new MemoryStressHarness();
    FMG.worldSimulationHarness = FMG.worldSimulationHarness || new WorldSimulationHarness();
    FMG.worldEntropyAnalyzer = FMG.worldEntropyAnalyzer || new WorldEntropyAnalyzer();
    FMG.footballEvolutionAnalyzer = FMG.footballEvolutionAnalyzer || new FootballEvolutionAnalyzer();
    FMG.longTermSimulationRunner = FMG.longTermSimulationRunner || new LongTermSimulationRunner({
      entropyAnalyzer: FMG.worldEntropyAnalyzer,
      evolutionAnalyzer: FMG.footballEvolutionAnalyzer,
      priorityManager: FMG.simulationPriorityManager
    });
    FMG.runtimeStressHarness = FMG.runtimeStressHarness || new RuntimeStressHarness({
      replay: FMG.replayStressHarness,
      save: FMG.saveStressHarness,
      ui: FMG.uiNavStressHarness,
      memory: FMG.memoryStressHarness,
      world: FMG.worldSimulationHarness
    });
    FMG.lowSpecModeController = FMG.lowSpecModeController || new LowSpecModeController();
    FMG.adaptivePerformanceScaler = FMG.adaptivePerformanceScaler || new AdaptivePerformanceScaler(FMG.lowSpecModeController, FMG.renderBudgetController);
    FMG.runtimeOverlay = FMG.runtimeOverlay || new RuntimeOverlay();
    FMG.runtimeDiagnosticsPanel = FMG.runtimeDiagnosticsPanel || new RuntimeDiagnosticsPanel(FMG.runtimeOverlay);
    FMG.adaptivePerformanceScaler.apply();
    FMG.runtimeMutationGuard.installLegacyObserver();
    if (FMG.gameState && FMG.gameState.teams && FMG.gameState.teams.length) {
      FMG.runtimeAuthorityManager.captureCoreStateFromLegacy("install-existing-state");
    }
    FMG.generateRuntimeAuthorityReport = () => FMG.runtimeAuthorityManager.reports().runtimeAuthorityReport;
    FMG.generateRemainingLegacyDependencyReport = () => FMG.runtimeAuthorityManager.reports().remainingLegacyDependencyReport;
    FMG.generateUnsafeMutationReport = () => FMG.runtimeAuthorityManager.reports().unsafeMutationReport;
    FMG.generateRuntimeHardeningReports = () => FMG.runtimeAuthorityManager.reports();
    FMG.generateDeterministicIntegrityReport = () => ({
      clock: FMG.simulationClock && FMG.simulationClock.snapshot(),
      rng: FMG.rngStateSerializer && FMG.rngStateSerializer.serialize(FMG.deterministicRNG),
      replayHashHistory: FMG.replayHashEngine && FMG.replayHashEngine.history.slice(0, 50),
      replay: FMG.deterministicReplayValidator && FMG.deterministicReplayValidator.report()
    });
    FMG.generateReplayDivergenceReport = () => ({
      validator: FMG.deterministicReplayValidator && FMG.deterministicReplayValidator.report(),
      tickInspector: FMG.tickReplayInspector && FMG.tickReplayInspector.divergenceReport(FMG.tickReplayInspector.ticks)
    });
    FMG.generatePersistenceIntegrityReport = () => {
      const pipeline = FMG.incrementalSavePipeline && FMG.incrementalSavePipeline.report();
      const stateValidation = FMG.saveIntegrityValidator && FMG.saveIntegrityValidator.validate(FMG.gameState || {});
      const manifest = pipeline && pipeline.lastManifest;
      return {
        ok: Boolean((!stateValidation || stateValidation.ok) && (!pipeline || !pipeline.lastError)),
        stateValidation,
        lastManifest: manifest || null,
        replayStorage: FMG.replayDeltaStorage ? "available" : "missing",
        compatibility: {
          localStorageSlots: Boolean(root.localStorage),
          indexedDB: Boolean(root.indexedDB),
          legacyLoadPath: typeof FMG.loadFromSlot === "function"
        }
      };
    };
    FMG.generateScalabilityReport = () => {
      const manifest = FMG.incrementalSavePipeline && FMG.incrementalSavePipeline.report().lastManifest;
      const layerPlan = FMG.layeredWorldSimulator ? FMG.layeredWorldSimulator.plan(FMG.gameState || {}) : null;
      return {
        chunkedPersistence: Boolean(manifest && manifest.chunkCount >= 1),
        chunkCount: manifest ? manifest.chunkCount : 0,
        byteLength: manifest ? manifest.byteLength : 0,
        entityStates: manifest ? manifest.entityStates : null,
        layers: layerPlan,
        localStorageRisk: manifest && manifest.byteLength > 4000000 ? "high" : "managed"
      };
    };
    FMG.generateMigrationRiskReport = () => ({
      strategy: "dual-write localStorage compatibility with IndexedDB chunk mirror",
      backwardsCompatible: typeof FMG.migrateSaveState === "function" && typeof FMG.loadFromSlot === "function",
      risks: [
        "Synchronous UI load path still depends on localStorage compatibility payload",
        "IndexedDB availability varies in private browsing and older embedded browsers",
        "Large archived worlds need periodic compaction policy"
      ],
      mitigations: [
        "Legacy slot payload remains readable",
        "Committed manifests reject incomplete chunk sets",
        "Backup localStorage key remains available for parse recovery"
      ]
    });
    FMG.generateRemainingPersistenceRisks = () => ({
      risks: [
        "Existing UI load action is synchronous, so full IndexedDB-first loading needs a future async UI flow",
        "Replay frame persistence is available but live match systems do not yet auto-flush every buffer",
        "Archive retention limits are not yet configurable per career length"
      ]
    });
    FMG.generateUILifecycleReport = () => {
      const memory = FMG.runtimeMemoryDiagnostics && FMG.runtimeMemoryDiagnostics.sample(FMG.gameState || {});
      return {
        ok: Boolean(memory && (!memory.listenerReport || !memory.listenerReport.accumulationWarnings.length) && (!memory.detachedDOM || memory.detachedDOM.detached === 0)),
        shell: FMG.persistentUIShell && FMG.persistentUIShell.report ? FMG.persistentUIShell.report() : null,
        listeners: FMG.listenerRegistry && FMG.listenerRegistry.report(),
        detachedDOM: FMG.detachedDOMDetector && FMG.detachedDOMDetector.report(),
        overlays: FMG.overlayManager && FMG.overlayManager.report(),
        memoryTrend: FMG.runtimeMemoryDiagnostics && FMG.runtimeMemoryDiagnostics.trend()
      };
    };
    FMG.generateRenderStabilityReport = () => ({
      scheduler: FMG.renderScheduler && FMG.renderScheduler.report(),
      renderLoop: FMG.renderLoopAnalyzer && FMG.renderLoopAnalyzer.report(),
      stableFps: !(FMG.renderLoopAnalyzer && FMG.renderLoopAnalyzer.report().rerenderStorm.storm),
      duplicateRenderLoops: FMG.renderLoopAnalyzer ? FMG.renderLoopAnalyzer.report().duplicateWarnings : []
    });
    FMG.generateMemoryLeakReport = () => {
      const report = FMG.runtimeMemoryDiagnostics && FMG.runtimeMemoryDiagnostics.report();
      return {
        ok: Boolean(report && report.stable),
        diagnostics: report,
        leakSignals: {
          listenerAccumulation: FMG.listenerRegistry ? FMG.listenerRegistry.report().accumulationWarnings : [],
          detachedDOM: FMG.detachedDOMDetector ? FMG.detachedDOMDetector.report().staleReferences : [],
          overlayLeak: FMG.overlayManager ? FMG.overlayManager.report().possibleLeak : false,
          duplicateRafLoops: FMG.renderLoopAnalyzer ? FMG.renderLoopAnalyzer.report().duplicateWarnings : []
        }
      };
    };
    FMG.runRuntimeStress = (options) => FMG.runtimeStressHarness && FMG.runtimeStressHarness.run(options || {});
    FMG.generateRuntimeStressReport = () => FMG.runtimeStressHarness && FMG.runtimeStressHarness.report();
    FMG.generateReplayStabilityReport = () => FMG.replayStressHarness && (FMG.replayStressHarness.lastReport || FMG.replayStressHarness.run({ loops: 1 }));
    FMG.generateSaveStabilityReport = () => FMG.saveStressHarness && (FMG.saveStressHarness.lastReport || FMG.saveStressHarness.run({ loops: 1, corruption: false }));
    FMG.generateUIStabilityReport = () => FMG.uiNavStressHarness && (FMG.uiNavStressHarness.lastReport || FMG.uiNavStressHarness.run({ loops: 1 }));
    FMG.generateStressMemoryReport = () => FMG.memoryStressHarness && (FMG.memoryStressHarness.lastReport || FMG.memoryStressHarness.run({ loops: 1 }));
    FMG.runLongTermSimulation = (options) => FMG.longTermSimulationRunner && FMG.longTermSimulationRunner.run(options || {});
    FMG.runLongTermSimulationSet = (options) => FMG.longTermSimulationRunner && FMG.longTermSimulationRunner.runDecadeSet(options || {});
    FMG.generateWorldScalingReport = () => ({
      runner: FMG.longTermSimulationRunner && FMG.longTermSimulationRunner.report(),
      entropy: FMG.worldEntropyAnalyzer && FMG.worldEntropyAnalyzer.report(),
      priority: FMG.layeredWorldSimulator && FMG.layeredWorldSimulator.plan(FMG.gameState || {})
    });
    FMG.generateFootballEvolutionReport = () => ({
      runner: FMG.longTermSimulationRunner && FMG.longTermSimulationRunner.report(),
      evolution: FMG.footballEvolutionAnalyzer && FMG.footballEvolutionAnalyzer.report()
    });
    FMG.generateLongTermStabilityReport = () => {
      const runner = FMG.longTermSimulationRunner && FMG.longTermSimulationRunner.report();
      const latest = runner && runner.snapshots && runner.snapshots[runner.snapshots.length - 1];
      return {
        ok: Boolean(!runner || runner.ok !== false),
        runner,
        detections: runner && runner.detections,
        memory: latest && latest.memory,
        scalableWorld: !(runner && runner.detections && runner.detections.entityExplosion),
        realismPreserved: !(runner && runner.detections && runner.detections.footballRealismDecay),
        runtimeStable: !(runner && runner.detections && runner.detections.memoryCollapse)
      };
    };
    FMG.generateRuntimeRandomnessAudit = () => FMG.runtimeRandomnessAudit && FMG.runtimeRandomnessAudit.report();
    FMG.shutdownRuntimeAuthority = (reason) => FMG.runtimeAuthorityManager.shutdown(reason);
    return FMG.Hardening.report();
  }

  function report() {
    const state = FMG.gameState || {};
    const layerPlan = FMG.layeredWorldSimulator ? FMG.layeredWorldSimulator.plan(state) : null;
    const memory = FMG.runtimeMemoryDiagnostics ? FMG.runtimeMemoryDiagnostics.sample(state) : {};
    return {
      deterministic: {
        clock: FMG.simulationClock && FMG.simulationClock.snapshot(),
        rng: FMG.rngStateSerializer ? FMG.rngStateSerializer.serialize(FMG.deterministicRNG) : (FMG.deterministicRNG && FMG.deterministicRNG.snapshot()),
        integrity: FMG.generateDeterministicIntegrityReport && FMG.generateDeterministicIntegrityReport(),
        randomnessAudit: FMG.generateRuntimeRandomnessAudit && FMG.generateRuntimeRandomnessAudit()
      },
      authority: FMG.runtimeAuthorityManager && FMG.runtimeAuthorityManager.report(),
      mutationGuard: FMG.runtimeMutationGuard && FMG.runtimeMutationGuard.report(),
      ownership: FMG.runtimeOwnershipValidator && FMG.runtimeOwnershipValidator.report(),
      legacyFacade: FMG.legacyCompatibilityFacade && FMG.legacyCompatibilityFacade.report(),
      generatedReports: FMG.runtimeAuthorityManager && FMG.runtimeAuthorityManager.reports(),
      replay: FMG.deterministicReplayValidator && FMG.deterministicReplayValidator.report(),
      replayDivergence: FMG.generateReplayDivergenceReport && FMG.generateReplayDivergenceReport(),
      persistence: FMG.incrementalSavePipeline && FMG.incrementalSavePipeline.report(),
      persistenceIntegrity: FMG.generatePersistenceIntegrityReport && FMG.generatePersistenceIntegrityReport(),
      scalability: FMG.generateScalabilityReport && FMG.generateScalabilityReport(),
      migrationRisk: FMG.generateMigrationRiskReport && FMG.generateMigrationRiskReport(),
      remainingPersistenceRisks: FMG.generateRemainingPersistenceRisks && FMG.generateRemainingPersistenceRisks(),
      uiLifecycle: FMG.generateUILifecycleReport && FMG.generateUILifecycleReport(),
      renderStability: FMG.generateRenderStabilityReport && FMG.generateRenderStabilityReport(),
      memoryLeak: FMG.generateMemoryLeakReport && FMG.generateMemoryLeakReport(),
      runtimeStress: FMG.generateRuntimeStressReport && FMG.generateRuntimeStressReport(),
      replayStability: FMG.generateReplayStabilityReport && FMG.generateReplayStabilityReport(),
      saveStability: FMG.generateSaveStabilityReport && FMG.generateSaveStabilityReport(),
      uiStability: FMG.generateUIStabilityReport && FMG.generateUIStabilityReport(),
      stressMemory: FMG.generateStressMemoryReport && FMG.generateStressMemoryReport(),
      worldScaling: FMG.generateWorldScalingReport && FMG.generateWorldScalingReport(),
      footballEvolution: FMG.generateFootballEvolutionReport && FMG.generateFootballEvolutionReport(),
      longTermStability: FMG.generateLongTermStabilityReport && FMG.generateLongTermStabilityReport(),
      layers: layerPlan,
      memory,
      causalReplay: FMG.causalReplayEngine && FMG.causalReplayEngine.report(),
      worldMemory: FMG.worldMemoryGraph && FMG.worldMemoryGraph.report(),
      lowSpec: FMG.lowSpecModeController && FMG.lowSpecModeController.evaluate()
    };
  }

  Hardening.SimulationClock = SimulationClock;
  Hardening.DeterministicRNGEngine = DeterministicRNGEngine;
  Hardening.RNGStateSerializer = RNGStateSerializer;
  Hardening.ReplayHashEngine = ReplayHashEngine;
  Hardening.RuntimeRandomnessAudit = RuntimeRandomnessAudit;
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
  Hardening.RenderLoopAnalyzer = RenderLoopAnalyzer;
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
  Hardening.DetachedDOMDetector = DetachedDOMDetector;
  Hardening.RuntimeMemoryDiagnostics = RuntimeMemoryDiagnostics;
  Hardening.RuntimeStressHarness = RuntimeStressHarness;
  Hardening.ReplayStressHarness = ReplayStressHarness;
  Hardening.SaveStressHarness = SaveStressHarness;
  Hardening.UINavStressHarness = UINavStressHarness;
  Hardening.MemoryStressHarness = MemoryStressHarness;
  Hardening.WorldSimulationHarness = WorldSimulationHarness;
  Hardening.LongTermSimulationRunner = LongTermSimulationRunner;
  Hardening.WorldEntropyAnalyzer = WorldEntropyAnalyzer;
  Hardening.FootballEvolutionAnalyzer = FootballEvolutionAnalyzer;
  Hardening.LowSpecModeController = LowSpecModeController;
  Hardening.AdaptivePerformanceScaler = AdaptivePerformanceScaler;
  Hardening.RuntimeOverlay = RuntimeOverlay;
  Hardening.RuntimeDiagnosticsPanel = RuntimeDiagnosticsPanel;
  Hardening.stableStringify = stableStringify;
  Hardening.hashString = hashString;
  Hardening.deterministicSort = deterministicSort;
  Hardening.stableEntityKey = stableEntityKey;
  Hardening.installDeterminism = installDeterminism;
  Hardening.install = install;
  Hardening.report = report;

  install();
})();
