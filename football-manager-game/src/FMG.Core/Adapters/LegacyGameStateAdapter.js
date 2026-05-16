(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Adapters = FMG.Core.Adapters || {};

  /**
   * LegacyGameStateAdapter
   * Bidirectional transformation between legacy FMG.gameState and FMG.Core.GameState
   * Anti-corruption layer preventing mixing of old and new logic
   */
  function LegacyGameStateAdapter() {}

  /**
   * Convert legacy FMG.gameState → Core GameState
   * Reads from legacy state structure, creates immutable Core aggregates
   */
  LegacyGameStateAdapter.prototype.toCore = function () {
    if (!FMG.gameState || !FMG.gameState.teams) {
      throw new Error("Legacy gameState not initialized");
    }

    const Club = FMG.Core.Domain.Club.ClubAggregate;
    const Season = FMG.Core.Domain.Season.SeasonAggregate;
    const Manager = FMG.Core.Domain.Manager.ManagerAggregate;
    const GameState = FMG.Core.Engine.GameState;

    // Convert clubs
    const clubs = FMG.gameState.teams.map((team) => {
      const players = FMG.gameState.players.filter((p) => p.teamId === team.id);

      return new Club({
        teamId: team.id,
        name: team.name,
        budget: team.budget,
        fanBase: team.fanBase,
        squad: players,
        lineup: players.slice(0, 11),
        finances: FMG.gameState.finances || {
          balance: team.budget || 0,
          budgets: { transfers: 0, wages: 0, infrastructure: 0, operations: 0 },
          debt: 0,
          boardTrust: 65
        },
        tactics: {
          formation: "4-3-3",
          mentality: "balanced",
          pressing: "medium",
          tempo: "normal"
        },
        form: team.form || 10
      });
    });

    // Convert season
    const fixture = (FMG.gameState.fixtures || []).map((f) => ({
      week: f.week,
      matches: f.matches || []
    }));

    const season = new Season({
      number: FMG.gameState.seasonNumber || 1,
      week: FMG.gameState.currentWeek || 1,
      totalWeeks: FMG.gameState.totalWeeks || 38,
      fixture,
      standings: FMG.gameState.standings || [],
      matchResults: [],
      startSeed: FMG.gameState._startSeed || FMG.Core.Utils.Determinism.seed(["legacy-season", FMG.gameState.seasonNumber || 1, fixture.length])
    });

    // Convert manager
    const manager = new Manager({
      profile: FMG.gameState.managerProfile || {
        name: "Manager",
        nationality: "Chile",
        age: 40,
        style: "balanced"
      },
      career: FMG.gameState.career || {
        reputation: 45,
        achievements: [],
        objectives: [],
        offers: []
      }
    });

    // Build CoreGameState
    return new GameState({
      version: FMG.CURRENT_VERSION || 1,
      timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(FMG.gameState.currentWeek || 1),
      season,
      clubs,
      manager,
      metadata: {
        difficulty: FMG.gameState.settings?.difficulty || "normal",
        userTeamId: FMG.gameState.userTeamId,
        route: FMG.gameState.route
      }
    });
  };

  /**
   * Convert Core GameState → legacy FMG.gameState
   * Takes immutable Core state, updates legacy mutable state
   */
  LegacyGameStateAdapter.prototype.fromCore = function (coreGameState) {
    if (!coreGameState) {
      throw new Error("Core GameState required");
    }

    // Preserve existing legacy fields, update from Core
    const legacy = FMG.gameState || {};

    const previousTeams = legacy.teams || [];
    const previousPlayers = legacy.players || [];
    const previousPlayerById = new Map(previousPlayers.map((player) => [player.id, player]));

    // Update teams (read-only from Core clubs) without dropping legacy-only fields.
    legacy.teams = (coreGameState.clubs || []).map((club) => {
      const previous = previousTeams.find((team) => team.id === club.teamId) || {};
      return {
        ...previous,
        id: club.teamId,
        name: club.name || previous.name,
        budget: club.budget !== undefined ? club.budget : previous.budget,
        fanBase: club.fanBase !== undefined ? club.fanBase : previous.fanBase,
        form: club.form !== undefined ? club.form : (previous.form || 10)
      };
    });

    // Update players (read-only from Core clubs) without stripping legacy gameplay fields.
    legacy.players = (coreGameState.clubs || []).flatMap((club) => (club.squad || []).map((player) => ({
      ...(previousPlayerById.get(player.id) || {}),
      ...player,
      teamId: player.teamId || club.teamId
    })));

    // Update fixtures
    if (coreGameState.season) {
      legacy.fixtures = (coreGameState.season.fixture || []).map((f) => ({
        week: f.week,
        played: f.week < coreGameState.season.week,
        matches: f.matches || []
      }));

      legacy.standings = coreGameState.season.standings || [];
      legacy.currentWeek = coreGameState.season.week;
      legacy.seasonNumber = coreGameState.season.number;
      legacy.totalWeeks = coreGameState.season.totalWeeks || 38;
    }

    // Update manager
    if (coreGameState.manager) {
      legacy.managerProfile = { ...coreGameState.manager.profile };
      legacy.career = { ...coreGameState.manager.career };
    }

    // Preserve metadata
    if (coreGameState.metadata) {
      legacy.userTeamId = coreGameState.metadata.userTeamId;
      legacy.route = coreGameState.metadata.route || legacy.route;
      legacy._startSeed = coreGameState.season?.startSeed;
    }

    return legacy;
  };

  /**
   * One-way sync: update legacy state from Core
   * Does NOT mutate Core state
   */
  LegacyGameStateAdapter.prototype.syncFromCore = function (coreGameState) {
    const updated = this.fromCore(coreGameState);
    Object.assign(FMG.gameState, updated);
  };

  /**
   * One-way sync: read legacy state into Core
   * Does NOT mutate legacy state
   */
  LegacyGameStateAdapter.prototype.syncToCore = function () {
    return this.toCore();
  };

  /**
   * Validate roundtrip consistency
   * Legacy → Core → Legacy should preserve critical fields
   */
  LegacyGameStateAdapter.prototype.validateRoundtrip = function () {
    const original = Object.assign({}, FMG.gameState);
    const core = this.toCore();
    const restored = this.fromCore(core);

    const errors = [];

    if (original.seasonNumber !== restored.seasonNumber) {
      errors.push(`Season mismatch: ${original.seasonNumber} → ${restored.seasonNumber}`);
    }

    if (original.currentWeek !== restored.currentWeek) {
      errors.push(`Week mismatch: ${original.currentWeek} → ${restored.currentWeek}`);
    }

    if ((original.teams || []).length !== (restored.teams || []).length) {
      errors.push(`Teams count mismatch: ${original.teams.length} → ${restored.teams.length}`);
    }

    if ((original.players || []).length !== (restored.players || []).length) {
      errors.push(`Players count mismatch: ${original.players.length} → ${restored.players.length}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  };

  FMG.Core.Adapters.LegacyGameStateAdapter = LegacyGameStateAdapter;

  /**
   * Global instance
   */
  FMG.Core.Adapters.legacyAdapter = new LegacyGameStateAdapter();
})();
