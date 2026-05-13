(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * Immutable GameState Root — Central authority for all game state
   * - All mutations return new instances (copy-on-write)
   * - Thread-safe snapshot generation
   * - Deterministic state lifecycle
   * - Transactional state updates
   */
  function GameState(config) {
    config = config || {};

    // Core structure
    this.version = config.version || 1;
    this.timestamp = config.timestamp || new Date().toISOString();
    this.season = config.season || null;
    this.clubs = Object.freeze(config.clubs || []);
    this.manager = config.manager || null;
    this.metadata = Object.freeze(config.metadata || {});

    // State tracking
    this.stateId = config.stateId || this._generateStateId();
    this.parentStateId = config.parentStateId || null;
    this.generation = config.generation || 0;

    // Immutability guarantee
    Object.freeze(this);
  }

  /**
   * Generate unique state ID
   * format: "state_<timestamp>_<random>"
   */
  GameState.prototype._generateStateId = function () {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return "state_" + timestamp + "_" + random;
  };

  /**
   * Create modified copy of GameState via Copy-on-Write
   * Immutable, traceable state transitions
   */
  GameState.prototype.with = function (changes) {
    if (!changes || Object.keys(changes).length === 0) {
      return this;
    }

    const newState = new GameState({
      version: changes.version !== undefined ? changes.version : this.version,
      timestamp: changes.timestamp !== undefined ? changes.timestamp : new Date().toISOString(),
      season: changes.season !== undefined ? changes.season : this.season,
      clubs: changes.clubs !== undefined ? Object.freeze(changes.clubs) : this.clubs,
      manager: changes.manager !== undefined ? changes.manager : this.manager,
      metadata: changes.metadata !== undefined ? Object.freeze({ ...this.metadata, ...changes.metadata }) : this.metadata,
      parentStateId: this.stateId,
      generation: this.generation + 1
    });

    return newState;
  };

  /**
   * Validate state invariants
   * Ensures consistency across aggregates
   */
  GameState.prototype.validate = function () {
    const errors = [];

    if (!this.season) {
      errors.push("Season is required");
    }

    if (!Array.isArray(this.clubs)) {
      errors.push("Clubs must be array");
    } else if (this.clubs.length === 0) {
      errors.push("At least one club required");
    } else {
      this.clubs.forEach((club, i) => {
        if (!club.teamId) errors.push(`Club ${i} missing teamId`);
        if (!Array.isArray(club.squad)) errors.push(`Club ${i} squad not array`);
      });
    }

    if (!this.manager) {
      errors.push("Manager is required");
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  };

  /**
   * Generate immutable snapshot for persistence/replay
   * Includes state lineage for audit trail
   */
  GameState.prototype.snapshot = function () {
    return Object.freeze({
      stateId: this.stateId,
      parentStateId: this.parentStateId,
      generation: this.generation,
      version: this.version,
      timestamp: this.timestamp,
      season: this.season,
      clubs: this.clubs,
      manager: this.manager,
      metadata: this.metadata,
      checksum: this._calculateChecksum()
    });
  };

  /**
   * Calculate state checksum for determinism verification
   * Used to validate replay consistency
   */
  GameState.prototype._calculateChecksum = function () {
    // Simple hash of critical state values
    const parts = [
      this.version,
      this.season ? this.season.week : "no_season",
      this.season ? this.season.number : "no_season",
      this.clubs.length,
      this.manager ? this.manager.profile.name : "no_manager"
    ];
    return this._hash(parts.join("|"));
  };

  /**
   * Simple hash function for checksums
   */
  GameState.prototype._hash = function (str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  /**
   * Serialize GameState to JSON (for storage)
   */
  GameState.prototype.toJSON = function () {
    return {
      version: this.version,
      timestamp: this.timestamp,
      season: this.season,
      clubs: this.clubs,
      manager: this.manager,
      metadata: this.metadata,
      stateId: this.stateId,
      parentStateId: this.parentStateId,
      generation: this.generation
    };
  };

  /**
   * Deserialize GameState from JSON (from storage)
   */
  GameState.fromJSON = function (json) {
    if (!json) return null;
    return new GameState({
      version: json.version,
      timestamp: json.timestamp,
      season: json.season,
      clubs: json.clubs,
      manager: json.manager,
      metadata: json.metadata,
      stateId: json.stateId,
      parentStateId: json.parentStateId,
      generation: json.generation
    });
  };

  /**
   * Create state from snapshot (for replay)
   */
  GameState.fromSnapshot = function (snapshot) {
    if (!snapshot) return null;
    return new GameState({
      version: snapshot.version,
      timestamp: snapshot.timestamp,
      season: snapshot.season,
      clubs: snapshot.clubs,
      manager: snapshot.manager,
      metadata: snapshot.metadata,
      stateId: snapshot.stateId,
      parentStateId: snapshot.parentStateId,
      generation: snapshot.generation
    });
  };

  /**
   * Get state lineage (parent chain for audit/replay)
   * Only available if state history is tracked
   */
  GameState.prototype.getLineage = function () {
    return {
      stateId: this.stateId,
      parentStateId: this.parentStateId,
      generation: this.generation
    };
  };

  /**
   * Check if state is valid before using
   */
  GameState.prototype.isValid = function () {
    return this.validate().valid;
  };

  FMG.Core.Engine.GameState = GameState;

  /**
   * GameStateBuilder: Fluent API for constructing GameState
   * (Preserved from original for backward compatibility)
   */
  function StateBuilder() {
    this._config = {
      version: 1,
      timestamp: new Date().toISOString(),
      season: null,
      clubs: [],
      manager: null,
      metadata: {}
    };
  }

  StateBuilder.prototype.withVersion = function (version) {
    this._config.version = version;
    return this;
  };

  StateBuilder.prototype.withTimestamp = function (timestamp) {
    this._config.timestamp = timestamp;
    return this;
  };

  StateBuilder.prototype.withSeason = function (season) {
    this._config.season = season;
    return this;
  };

  StateBuilder.prototype.withClubs = function (clubs) {
    this._config.clubs = Array.isArray(clubs) ? clubs : [];
    return this;
  };

  StateBuilder.prototype.withManager = function (manager) {
    this._config.manager = manager;
    return this;
  };

  StateBuilder.prototype.withMetadata = function (metadata) {
    this._config.metadata = { ...this._config.metadata, ...metadata };
    return this;
  };

  StateBuilder.prototype.build = function () {
    return new GameState(this._config);
  };

  FMG.Core.Engine.StateBuilder = StateBuilder;

  /**
   * StateValidator: Check state invariants
   */
  function StateValidator() {}

  StateValidator.prototype.validate = function (gameState) {
    if (!gameState) {
      return ["GameState is null"];
    }
    return gameState.validate().errors;
  };

  StateValidator.prototype.isValid = function (gameState) {
    return this.validate(gameState).length === 0;
  };

  FMG.Core.Engine.StateValidator = StateValidator;
})();
