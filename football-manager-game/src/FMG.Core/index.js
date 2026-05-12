(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};

  /**
   * FMG.Core initialization and public API
   */
  FMG.Core.initialize = function (config) {
    config = config || {};

    // Verify dependencies loaded
    const missing = [];
    if (!FMG.Core.Utils || !FMG.Core.Utils.RNG) missing.push("FMG.Core.Utils.RNG");
    if (!FMG.Core.Events || !FMG.Core.Events.EventBus) missing.push("FMG.Core.Events.EventBus");
    if (!FMG.Core.Engine || !FMG.Core.Engine.GameState) missing.push("FMG.Core.Engine.GameState");
    if (!FMG.Core.Domain || !FMG.Core.Domain.Club) missing.push("FMG.Core.Domain.Club");
    if (!FMG.Core.Services || !FMG.Core.Services.MatchSimulator) missing.push("FMG.Core.Services.MatchSimulator");
    if (!FMG.Core.Adapters || !FMG.Core.Adapters.LegacyGameStateAdapter) missing.push("FMG.Core.Adapters.LegacyGameStateAdapter");

    if (missing.length > 0) {
      throw new Error("FMG.Core missing dependencies: " + missing.join(", "));
    }

    // Create instances
    const eventBus = new FMG.Core.Events.EventBus();
    const matchSimulator = new FMG.Core.Services.MatchSimulator(config);
    const stateValidator = new FMG.Core.Engine.StateValidator();
    const simulationEngine = new FMG.Core.Engine.SimulationEngine({
      eventBus,
      matchSimulator,
      stateValidator
    });

    FMG.Core.eventBus = eventBus;
    FMG.Core.engine = simulationEngine;
    FMG.Core.adapter = new FMG.Core.Adapters.LegacyGameStateAdapter();

    FMG.Core._initialized = true;

    console.log("✓ FMG.Core initialized");

    return {
      engine: simulationEngine,
      eventBus,
      adapter: FMG.Core.adapter
    };
  };

  /**
   * Convenience method: advanceWeek using legacy state
   * This is the main integration point between legacy UI and Core engine
   */
  FMG.Core.advanceWeekFromLegacy = function (weekSeed) {
    if (!FMG.Core._initialized) {
      FMG.Core.initialize();
    }

    // Convert legacy → Core
    const coreState = FMG.Core.adapter.toCore();

    // Execute week simulation
    const result = FMG.Core.engine.advanceWeek(coreState, { weekSeed });

    // Convert Core → legacy and sync
    FMG.Core.adapter.syncFromCore(result.gameState);

    // Emit legacy-compatible event
    if (FMG.emitGameEvent) {
      FMG.emitGameEvent("CORE_WEEK_ADVANCED", {
        week: coreState.season.week,
        events: result.events,
        executionMs: result.executionMs
      });
    }

    return result;
  };

  /**
   * Get Core GameState from legacy state
   */
  FMG.Core.getCurrentState = function () {
    if (!FMG.Core.adapter) return null;
    return FMG.Core.adapter.toCore();
  };

  /**
   * Status check
   */
  FMG.Core.isInitialized = function () {
    return FMG.Core._initialized === true;
  };

  console.log("FMG.Core module loaded (not yet initialized)");
})();
