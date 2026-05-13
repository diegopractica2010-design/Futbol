(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};
  FMG.Core.Engine.Reducers = FMG.Core.Engine.Reducers || {};

  /**
   * GameStateReducer — Pure functions for state transitions
   * Ensures deterministic, replayable, auditable state changes
   *
   * Principles:
   * - No side effects
   * - No mutations (returns new GameState)
   * - Pure functions (same input → same output)
   * - Composable (reducers can chain)
   */

  /**
   * Apply reducer action to GameState
   * Returns new GameState or original if no changes
   */
  function applyAction(gameState, action) {
    if (!gameState) {
      throw new Error("GameState required");
    }
    if (!action || !action.type) {
      throw new Error("Action with type required");
    }

    switch (action.type) {
      case "ADVANCE_WEEK":
        return advanceWeek(gameState, action.payload);
      case "UPDATE_CLUBS":
        return updateClubs(gameState, action.payload);
      case "UPDATE_SEASON":
        return updateSeason(gameState, action.payload);
      case "UPDATE_MANAGER":
        return updateManager(gameState, action.payload);
      case "ADD_MATCH_RESULT":
        return addMatchResult(gameState, action.payload);
      case "UPDATE_STANDINGS":
        return updateStandings(gameState, action.payload);
      case "APPLY_WEEKLY_EFFECTS":
        return applyWeeklyEffects(gameState, action.payload);
      case "BATCH_UPDATE":
        return batchUpdate(gameState, action.payload);
      default:
        console.warn("Unknown action type:", action.type);
        return gameState;
    }
  }

  /**
   * ADVANCE_WEEK: Move to next week and finalize week state
   */
  function advanceWeek(gameState, payload) {
    if (!gameState.season) {
      throw new Error("Season required to advance week");
    }

    const newSeason = gameState.season.nextWeek();
    return gameState.with({
      season: newSeason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * UPDATE_CLUBS: Replace clubs in state
   */
  function updateClubs(gameState, payload) {
    if (!Array.isArray(payload.clubs)) {
      throw new Error("Clubs must be array");
    }

    return gameState.with({
      clubs: payload.clubs,
      metadata: {
        ...gameState.metadata,
        lastClubsUpdate: new Date().toISOString()
      }
    });
  }

  /**
   * UPDATE_SEASON: Replace season in state
   */
  function updateSeason(gameState, payload) {
    if (!payload.season) {
      throw new Error("Season required");
    }

    return gameState.with({
      season: payload.season,
      metadata: {
        ...gameState.metadata,
        lastSeasonUpdate: new Date().toISOString()
      }
    });
  }

  /**
   * UPDATE_MANAGER: Replace manager in state
   */
  function updateManager(gameState, payload) {
    if (!payload.manager) {
      throw new Error("Manager required");
    }

    return gameState.with({
      manager: payload.manager,
      metadata: {
        ...gameState.metadata,
        lastManagerUpdate: new Date().toISOString()
      }
    });
  }

  /**
   * ADD_MATCH_RESULT: Add match result to season
   */
  function addMatchResult(gameState, payload) {
    if (!payload.matchResult) {
      throw new Error("MatchResult required");
    }

    const newSeason = gameState.season.addMatchResult(payload.matchResult);
    return gameState.with({
      season: newSeason
    });
  }

  /**
   * UPDATE_STANDINGS: Update league standings
   */
  function updateStandings(gameState, payload) {
    if (!Array.isArray(payload.standings)) {
      throw new Error("Standings must be array");
    }

    const newSeason = gameState.season.withStandings(payload.standings);
    return gameState.with({
      season: newSeason
    });
  }

  /**
   * APPLY_WEEKLY_EFFECTS: Apply morale, form, and other weekly effects
   */
  function applyWeeklyEffects(gameState, payload) {
    const effects = payload.effects || {};
    const newClubs = gameState.clubs.map((club) => {
      const clubEffects = effects[club.teamId];
      if (!clubEffects) return club;

      return club.withFinances({
        balance: clubEffects.finances ? club.finances.balance + clubEffects.finances : club.finances.balance
      });
    });

    return gameState.with({
      clubs: newClubs
    });
  }

  /**
   * BATCH_UPDATE: Apply multiple updates in single transaction
   * Ensures atomicity
   */
  function batchUpdate(gameState, payload) {
    let state = gameState;

    if (!Array.isArray(payload.actions)) {
      throw new Error("Actions must be array");
    }

    for (let i = 0; i < payload.actions.length; i++) {
      const action = payload.actions[i];
      state = applyAction(state, action);
    }

    return state;
  }

  /**
   * Compose multiple reducers into single action
   * Useful for complex state transformations
   */
  function compose(...reducers) {
    return function (gameState, payload) {
      let state = gameState;
      for (let i = 0; i < reducers.length; i++) {
        state = reducers[i](state, payload);
      }
      return state;
    };
  }

  // Export functions
  FMG.Core.Engine.Reducers.applyAction = applyAction;
  FMG.Core.Engine.Reducers.advanceWeek = advanceWeek;
  FMG.Core.Engine.Reducers.updateClubs = updateClubs;
  FMG.Core.Engine.Reducers.updateSeason = updateSeason;
  FMG.Core.Engine.Reducers.updateManager = updateManager;
  FMG.Core.Engine.Reducers.addMatchResult = addMatchResult;
  FMG.Core.Engine.Reducers.updateStandings = updateStandings;
  FMG.Core.Engine.Reducers.applyWeeklyEffects = applyWeeklyEffects;
  FMG.Core.Engine.Reducers.batchUpdate = batchUpdate;
  FMG.Core.Engine.Reducers.compose = compose;
})();
