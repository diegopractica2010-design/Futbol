(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * Immutable GameState for FMG.Core
   * All mutations return new instances (copy-on-write)
   */
  function GameState(config) {
    config = config || {};

    this.version = config.version || 1;
    this.timestamp = config.timestamp || new Date().toISOString();
    this.season = config.season || null;
    this.clubs = config.clubs || []; // Club[] (immutable list)
    this.manager = config.manager || null;
    this.metadata = config.metadata || {};

    Object.freeze(this.clubs);
    Object.freeze(this.metadata);
    Object.freeze(this);
  }

  /**
   * Create modified copy of GameState
   * Returns new instance with frozen state
   */
  GameState.prototype.with = function (changes) {
    if (!changes || Object.keys(changes).length === 0) {
      return this;
    }

    const newState = new GameState({
      version: changes.version !== undefined ? changes.version : this.version,
      timestamp: changes.timestamp !== undefined ? changes.timestamp : new Date().toISOString(),
      season: changes.season !== undefined ? changes.season : this.season,
      clubs: changes.clubs !== undefined ? changes.clubs : this.clubs,
      manager: changes.manager !== undefined ? changes.manager : this.manager,
      metadata: changes.metadata !== undefined ? { ...this.metadata, ...changes.metadata } : this.metadata
    });

    return newState;
  };

  /**
   * Serialize GameState to JSON
   * Includes version for migrations
   */
  GameState.prototype.toJSON = function () {
    return {
      version: this.version,
      timestamp: this.timestamp,
      season: this.season,
      clubs: this.clubs,
      manager: this.manager,
      metadata: this.metadata
    };
  };

  /**
   * Deserialize GameState from JSON
   */
  GameState.fromJSON = function (json) {
    if (!json) return null;
    return new GameState({
      version: json.version,
      timestamp: json.timestamp,
      season: json.season,
      clubs: json.clubs,
      manager: json.manager,
      metadata: json.metadata
    });
  };

  /**
   * StateBuilder: fluent API for constructing GameState
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

  /**
   * StateValidator: check invariants
   */
  function StateValidator() {}

  StateValidator.prototype.validate = function (gameState) {
    const errors = [];

    if (!gameState) {
      errors.push("GameState is null");
      return errors;
    }

    if (!gameState.season) {
      errors.push("Season is required");
    }

    if (!Array.isArray(gameState.clubs)) {
      errors.push("Clubs must be an array");
    } else if (gameState.clubs.length === 0) {
      errors.push("At least one club is required");
    } else {
      gameState.clubs.forEach((club, i) => {
        if (!club.teamId) errors.push(`Club ${i} missing teamId`);
        if (!club.squad || !Array.isArray(club.squad)) errors.push(`Club ${i} missing squad`);
      });
    }

    if (!gameState.manager) {
      errors.push("Manager is required");
    }

    return errors;
  };

  StateValidator.prototype.isValid = function (gameState) {
    return this.validate(gameState).length === 0;
  };

  FMG.Core.Engine.GameState = GameState;
  FMG.Core.Engine.StateBuilder = StateBuilder;
  FMG.Core.Engine.StateValidator = StateValidator;
})();
