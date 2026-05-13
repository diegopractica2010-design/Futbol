(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Engine = FMG.Core.Engine || {};

  /**
   * SimulationEngine — Immutable, reducer-based simulation
   * Features:
   * - Atomic transactional state updates
   * - Full audit trail via transition log
   * - Deterministic (same seed = same output)
   * - Replayable (store actions, replay anytime)
   * - Multiplayer-ready (state versioning)
   */
  function SimulationEngine(config) {
    config = config || {};

    this.eventBus = config.eventBus || (FMG.Core.Events && new FMG.Core.Events.EventBus());
    this.matchSimulator = config.matchSimulator || (FMG.Core.Services && new FMG.Core.Services.MatchSimulator());
    this.stateValidator = config.stateValidator || new FMG.Core.Engine.StateValidator();

    // Immutable state management
    this.pipeline = null;
    this.snapshotStore = new FMG.Core.Engine.SnapshotStore();
    this.replayEngine = new FMG.Core.Engine.ReplayEngine(this.snapshotStore);

    // Execution log
    this._executionLog = [];
  }

  /**
   * Initialize simulation with initial GameState
   */
  SimulationEngine.prototype.initialize = function (gameState) {
    if (!gameState) {
      throw new Error("GameState required");
    }

    // Create transition pipeline
    this.pipeline = new FMG.Core.Engine.TransitionPipeline(gameState);

    // Setup hooks for logging
    this._setupHooks();

    // Store initial snapshot
    this.snapshotStore.save(gameState, "initial");

    console.log("✓ SimulationEngine initialized with state generation", gameState.generation);

    return gameState;
  };

  /**
   * Setup transition pipeline hooks
   */
  SimulationEngine.prototype._setupHooks = function () {
    const self = this;

    // Before hook: validate state
    this.pipeline.before(function (context) {
      const validation = context.currentState.validate();
      if (!validation.valid) {
        throw new Error("Invalid state before transition: " + validation.errors.join("; "));
      }
    });

    // After hook: emit event and log
    this.pipeline.after(function (context) {
      self._logTransition(context);

      // Emit typed event
      self.eventBus.emit("STATE_TRANSITION", {
        action: context.action.type,
        description: context.description,
        fromGeneration: context.previousState.generation,
        toGeneration: context.newState.generation,
        timestamp: context.transaction.timestamp
      });
    });

    // Error hook: log error
    this.pipeline.onError(function (context) {
      console.error("State transition error:", context.error);
      self.eventBus.emit("STATE_TRANSITION_ERROR", {
        error: context.error.message,
        action: context.action.type,
        timestamp: new Date().toISOString()
      });
    });
  };

  /**
   * Log transition for audit trail
   */
  SimulationEngine.prototype._logTransition = function (context) {
    this._executionLog.push({
      action: context.action.type,
      description: context.description,
      timestamp: context.transaction.timestamp,
      fromGeneration: context.previousState.generation,
      toGeneration: context.newState.generation,
      stateId: context.newState.stateId
    });
  };

  /**
   * Execute AdvanceWeekCommand with transactional safety
   * Returns new state and audit trail
   */
  SimulationEngine.prototype.advanceWeek = function (gameState, command) {
    if (!gameState) {
      throw new Error("GameState required");
    }

    // Initialize pipeline if needed
    if (!this.pipeline) {
      this.initialize(gameState);
    } else {
      // Update pipeline state
      this.pipeline.gameState = gameState;
    }

    const commandId = Math.random().toString(36).slice(2, 8);
    const startTime = Date.now();

    try {
      // 1. VALIDATE current state
      const validation = gameState.validate();
      if (!validation.valid) {
        throw new Error("Invalid initial state: " + validation.errors.join("; "));
      }

      // 2. PREPARE lineups
      const clubsWithLineups = gameState.clubs.map((club) => this._autoSelectLineup(club));

      // 3. SIMULATE matches deterministically
      const currentFixture = gameState.season.currentFixture();
      if (!currentFixture) {
        throw new Error("No fixture for current week");
      }

      let season = gameState.season;
      const matchResults = [];
      const weekSeed = command.weekSeed || FMG.Core.Utils.deriveSeed(gameState.season.startSeed, gameState.season.week);

      let clubs = clubsWithLineups;

      for (let i = 0; i < currentFixture.matches.length; i++) {
        const match = currentFixture.matches[i];
        const homeClub = clubs.find((c) => c.teamId === match.homeTeamId);
        const awayClub = clubs.find((c) => c.teamId === match.awayTeamId);

        if (!homeClub || !awayClub) continue;

        const homeTeam = FMG.gameState.teams.find((t) => t.id === match.homeTeamId) || { id: match.homeTeamId, form: 10 };
        const awayTeam = FMG.gameState.teams.find((t) => t.id === match.awayTeamId) || { id: match.awayTeamId, form: 10 };

        const matchSeed = FMG.Core.Utils.deriveSeed(weekSeed, i, FMG.Core.Utils.hashSeed(match.homeTeamId + match.awayTeamId));

        // Run match simulation
        const result = this.matchSimulator.run(homeTeam, awayTeam, homeClub.squad, awayClub.squad, matchSeed);

        matchResults.push(result);

        // Update clubs with match stats (immutably)
        clubs = clubs.map((c) => {
          if (c.teamId === result.homeTeamId) {
            return this._applyMatchStats(c, result, true);
          } else if (c.teamId === result.awayTeamId) {
            return this._applyMatchStats(c, result, false);
          }
          return c;
        });

        // Update standings
        season = this._updateStandings(season, result);

        // Emit match completed event
        this.eventBus.emit(FMG.Core.Events.EventTypes.MATCH_COMPLETED, {
          matchResult: result,
          week: gameState.season.week
        });
      }

      // 4. CREATE UPDATE TRANSACTION
      let state = gameState;

      // Update clubs
      state = this.pipeline.transition(
        {
          type: "UPDATE_CLUBS",
          payload: { clubs: clubs }
        },
        "Update clubs after match simulations"
      ).gameState;

      // Update season
      state = this.pipeline.transition(
        {
          type: "UPDATE_SEASON",
          payload: { season: season }
        },
        "Update season standings"
      ).gameState;

      // Apply weekly effects
      state = this.pipeline.transition(
        {
          type: "APPLY_WEEKLY_EFFECTS",
          payload: { effects: {} }
        },
        "Apply weekly morale/form effects"
      ).gameState;

      // Advance week
      state = this.pipeline.transition(
        {
          type: "ADVANCE_WEEK",
          payload: {}
        },
        "Advance to next week"
      ).gameState;

      // 5. SAVE SNAPSHOT
      this.snapshotStore.save(state, "week_" + gameState.season.week);

      // 6. BUILD RESPONSE
      const response = {
        gameState: state,
        events: this.eventBus.history(),
        matchResults: matchResults,
        executionMs: Date.now() - startTime,
        commandId: commandId,
        transitionLog: this.pipeline.getTransitionLog(),
        auditTrail: this._executionLog.slice()
      };

      return response;
    } catch (err) {
      console.error(`SimulationEngine error (${commandId}):`, err);
      this.eventBus.emit("SIMULATION_ERROR", {
        commandId: commandId,
        error: err.message,
        timestamp: new Date().toISOString()
      });
      throw err;
    }
  };

  /**
   * Get current state from pipeline
   */
  SimulationEngine.prototype.getState = function () {
    if (!this.pipeline) {
      return null;
    }
    return this.pipeline.getState();
  };

  /**
   * Load snapshot and restore state
   */
  SimulationEngine.prototype.loadSnapshot = function (snapshotId) {
    const state = this.snapshotStore.load(snapshotId);
    this.pipeline = new FMG.Core.Engine.TransitionPipeline(state);
    this._setupHooks();
    return state;
  };

  /**
   * Get execution log
   */
  SimulationEngine.prototype.getExecutionLog = function () {
    return this._executionLog.slice();
  };

  /**
   * Get snapshot store
   */
  SimulationEngine.prototype.getSnapshotStore = function () {
    return this.snapshotStore;
  };

  /**
   * Auto-select lineup from available players
   */
  SimulationEngine.prototype._autoSelectLineup = function (club) {
    if (!club.squad || club.squad.length < 11) {
      return club;
    }

    const availablePlayers = club.squad.filter((p) => !p.isInjured && p.suspensionWeeks === 0);
    const lineup = availablePlayers.slice(0, 11);

    return club.withSquad ? club.withSquad(Object.freeze(lineup)) : club;
  };

  /**
   * Apply match stats to club (immutably)
   */
  SimulationEngine.prototype._applyMatchStats = function (club, result, isHome) {
    if (!club.withFinances) {
      return club;
    }

    const goals = isHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
    const points = isHome ? this._getPoints(result.homeGoals, result.awayGoals) : this._getPoints(result.awayGoals, result.homeGoals);

    // Update form based on result
    const formChange = points === 3 ? 2 : points === 1 ? 0 : -1;
    const newForm = Math.max(0, Math.min(20, (club.form || 10) + formChange));

    return club.withFinances({
      balance: club.finances.balance + goals * 50000 - goalsAgainst * 25000
    });
  };

  /**
   * Get points from goals
   */
  SimulationEngine.prototype._getPoints = function (goalsFor, goalsAgainst) {
    if (goalsFor > goalsAgainst) return 3;
    if (goalsFor === goalsAgainst) return 1;
    return 0;
  };

  /**
   * Update season standings (immutably)
   */
  SimulationEngine.prototype._updateStandings = function (season, result) {
    if (!season.standings) {
      return season;
    }

    const newStandings = season.standings.map((standing) => {
      if (standing.teamId === result.homeTeamId) {
        return {
          ...standing,
          played: standing.played + 1,
          wins: standing.wins + (result.homeGoals > result.awayGoals ? 1 : 0),
          draws: standing.draws + (result.homeGoals === result.awayGoals ? 1 : 0),
          losses: standing.losses + (result.homeGoals < result.awayGoals ? 1 : 0),
          goalsFor: standing.goalsFor + result.homeGoals,
          goalsAgainst: standing.goalsAgainst + result.awayGoals,
          goalDifference: standing.goalDifference + result.homeGoals - result.awayGoals,
          points: standing.points + this._getPoints(result.homeGoals, result.awayGoals)
        };
      } else if (standing.teamId === result.awayTeamId) {
        return {
          ...standing,
          played: standing.played + 1,
          wins: standing.wins + (result.awayGoals > result.homeGoals ? 1 : 0),
          draws: standing.draws + (result.awayGoals === result.homeGoals ? 1 : 0),
          losses: standing.losses + (result.awayGoals < result.homeGoals ? 1 : 0),
          goalsFor: standing.goalsFor + result.awayGoals,
          goalsAgainst: standing.goalsAgainst + result.homeGoals,
          goalDifference: standing.goalDifference + result.awayGoals - result.homeGoals,
          points: standing.points + this._getPoints(result.awayGoals, result.homeGoals)
        };
      }
      return standing;
    });

    return season.withStandings(newStandings);
  };

  FMG.Core.Engine.SimulationEngine = SimulationEngine;
})();
