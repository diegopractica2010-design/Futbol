(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * StateBuilder: fluent API for constructing the authoritative GameState.
   * GameState itself is defined only in Engine/GameState.js.
   */
  function StateBuilder() {
    this._config = {};
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
    this._config.metadata = { ...(this._config.metadata || {}), ...metadata };
    return this;
  };

  StateBuilder.prototype.build = function () {
    const GameState = FMG.Core.Engine.GameState;
    if (typeof GameState !== "function") {
      throw new Error("FMG.Core.Engine.GameState must be loaded before StateBuilder.build()");
    }
    return new GameState(this._config);
  };

  FMG.Core.Engine.StateBuilder = StateBuilder;
})();
