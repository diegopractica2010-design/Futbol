(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * StateSnapshot — Immutable snapshot for persistence and replay
   * Includes full lineage for audit trail
   */
  function StateSnapshot(gameState) {
    if (!gameState) {
      throw new Error("GameState required");
    }
    if (!FMG.Core.Engine.GameState || typeof gameState.snapshot !== "function") {
      throw new Error("GameState snapshot support required");
    }

    this.data = gameState.snapshot();
    this.timestamp = FMG.Core.Utils.Determinism.timestampForGeneration(this.data.generation, 60);
    this.id = this._generateSnapshotId();
  }

  StateSnapshot.prototype._generateSnapshotId = function () {
    return FMG.Core.Utils.Determinism.id("snap", [this.data.stateId, this.data.generation, this.data.checksum]);
  };

  /**
   * Restore GameState from snapshot
   */
  StateSnapshot.prototype.restore = function () {
    if (!FMG.Core.Engine.GameState || typeof FMG.Core.Engine.GameState.fromSnapshot !== "function") {
      throw new Error("GameState.fromSnapshot required to restore snapshot");
    }
    return FMG.Core.Engine.GameState.fromSnapshot(this.data);
  };

  /**
   * Get snapshot metadata
   */
  StateSnapshot.prototype.getMetadata = function () {
    return {
      id: this.id,
      timestamp: this.timestamp,
      stateId: this.data.stateId,
      parentStateId: this.data.parentStateId,
      generation: this.data.generation,
      checksum: this.data.checksum
    };
  };

  /**
   * Serialize for storage
   */
  StateSnapshot.prototype.toJSON = function () {
    return {
      id: this.id,
      timestamp: this.timestamp,
      data: this.data
    };
  };

  /**
   * Deserialize from storage
   */
  StateSnapshot.fromJSON = function (json) {
    if (!json || !json.data) {
      throw new Error("Snapshot JSON data required");
    }
    if (!FMG.Core.Engine.GameState || typeof FMG.Core.Engine.GameState.fromSnapshot !== "function") {
      throw new Error("GameState.fromSnapshot required to deserialize snapshot");
    }
    const snapshot = new StateSnapshot(FMG.Core.Engine.GameState.fromSnapshot(json.data));
    snapshot.id = json.id;
    snapshot.timestamp = json.timestamp;
    return snapshot;
  };

  FMG.Core.Engine.StateSnapshot = StateSnapshot;

  /**
   * SnapshotStore — Manages collection of snapshots
   * Enables rollback, replay, and audit trail
   */
  function SnapshotStore() {
    this.snapshots = {};
    this.index = [];
    this.maxSnapshots = 100;
  }

  /**
   * Save snapshot
   */
  SnapshotStore.prototype.save = function (gameState, label) {
    const snapshot = new StateSnapshot(gameState);
    this.snapshots[snapshot.id] = snapshot;
    this.index.push({
      id: snapshot.id,
      label: label || "",
      timestamp: snapshot.timestamp,
      generation: snapshot.data.generation
    });

    // Enforce max snapshots
    if (this.index.length > this.maxSnapshots) {
      const oldest = this.index.shift();
      delete this.snapshots[oldest.id];
    }

    return snapshot.id;
  };

  /**
   * Load snapshot by ID
   */
  SnapshotStore.prototype.load = function (snapshotId) {
    const snapshot = this.snapshots[snapshotId];
    if (!snapshot) {
      throw new Error("Snapshot not found: " + snapshotId);
    }
    return snapshot.restore();
  };

  /**
   * Get latest snapshot
   */
  SnapshotStore.prototype.getLatest = function () {
    if (this.index.length === 0) {
      return null;
    }
    const latest = this.index[this.index.length - 1];
    return this.snapshots[latest.id].restore();
  };

  /**
   * Get snapshot at generation
   */
  SnapshotStore.prototype.getAtGeneration = function (generation) {
    for (let i = this.index.length - 1; i >= 0; i--) {
      if (this.index[i].generation <= generation) {
        return this.snapshots[this.index[i].id].restore();
      }
    }
    return null;
  };

  /**
   * List all snapshots
   */
  SnapshotStore.prototype.list = function () {
    return this.index.slice().map((entry) => ({
      id: entry.id,
      label: entry.label,
      timestamp: entry.timestamp,
      generation: entry.generation
    }));
  };

  /**
   * Delete snapshot
   */
  SnapshotStore.prototype.delete = function (snapshotId) {
    delete this.snapshots[snapshotId];
    this.index = this.index.filter((entry) => entry.id !== snapshotId);
  };

  /**
   * Clear all snapshots
   */
  SnapshotStore.prototype.clear = function () {
    this.snapshots = {};
    this.index = [];
  };

  /**
   * Get store size (count)
   */
  SnapshotStore.prototype.size = function () {
    return this.index.length;
  };

  /**
   * Export snapshots (for backup)
   */
  SnapshotStore.prototype.export = function () {
    return {
      snapshots: Object.keys(this.snapshots).map((id) => this.snapshots[id].toJSON()),
      index: this.index.slice(),
      exportedAt: FMG.Core.Utils.Determinism.nextTimestamp()
    };
  };

  /**
   * Import snapshots (from backup)
   */
  SnapshotStore.prototype.import = function (backup) {
    if (!Array.isArray(backup.snapshots)) {
      throw new Error("Invalid backup format");
    }

    this.clear();

    for (let i = 0; i < backup.snapshots.length; i++) {
      const snapshot = StateSnapshot.fromJSON(backup.snapshots[i]);
      this.snapshots[snapshot.id] = snapshot;
    }

    this.index = backup.index.slice();
  };

  FMG.Core.Engine.SnapshotStore = SnapshotStore;

  /**
   * ReplayEngine — Replay state transitions deterministically
   * Validates that replay produces identical states
   */
  function ReplayEngine(snapshotStore) {
    if (!snapshotStore || typeof snapshotStore.load !== "function") {
      throw new Error("SnapshotStore required for ReplayEngine");
    }
    if (!FMG.Core.Engine.Reducers || typeof FMG.Core.Engine.Reducers.applyAction !== "function") {
      throw new Error("Reducers.applyAction required for ReplayEngine");
    }

    this.snapshotStore = snapshotStore;
    this.validations = [];
  }

  /**
   * Replay from snapshot through action sequence
   */
  ReplayEngine.prototype.replay = function (snapshotId, actions) {
    if (!Array.isArray(actions)) {
      throw new Error("Replay actions must be array");
    }
    if (!FMG.Core.Engine.Reducers || typeof FMG.Core.Engine.Reducers.applyAction !== "function") {
      throw new Error("Reducers.applyAction required for replay");
    }

    const startState = this.snapshotStore.load(snapshotId);
    let state = startState;
    const Reducers = FMG.Core.Engine.Reducers;

    for (let i = 0; i < actions.length; i++) {
      state = Reducers.applyAction(state, actions[i]);
    }

    return {
      initialState: startState,
      finalState: state,
      actionsProcessed: actions.length
    };
  };

  /**
   * Validate replay produces consistent results
   */
  ReplayEngine.prototype.validateDeterminism = function (snapshotId, actions, expectedChecksum) {
    const result = this.replay(snapshotId, actions);
    const finalChecksum = result.finalState._calculateChecksum();

    const isValid = finalChecksum === expectedChecksum;
    const validation = {
      snapshotId: snapshotId,
      actionCount: actions.length,
      expectedChecksum: expectedChecksum,
      actualChecksum: finalChecksum,
      isDeterministic: isValid,
      timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(result.finalState.generation, 70)
    };

    this.validations.push(validation);

    if (!isValid) {
      console.warn("Determinism validation failed", validation);
    }

    return validation;
  };

  /**
   * Get validation history
   */
  ReplayEngine.prototype.getValidationHistory = function () {
    return this.validations.slice();
  };

  FMG.Core.Engine.ReplayEngine = ReplayEngine;
})();
