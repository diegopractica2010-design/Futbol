(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  /**
   * Player Progression Integration
   * Hooks into simulation scheduler and match system for weekly/match updates
   */

  /**
   * Register player progression job with simulation scheduler
   */
  function registerPlayerProgressionJobs(scheduler) {
    if (!scheduler) return false;

    // Weekly player growth and aging
    const registered = scheduler.register({
      id: "player-progression-weekly",
      group: "player-development",
      intervalWeeks: 1,
      budgetMs: 5,
      run(state) {
        if (!FMG.PlayerProgression) return { status: "error", message: "PlayerProgression not loaded" };
        
        // Get training focus by team
        const trainingFocus = {};
        if (state.tactics?.teamSettings) {
          Object.keys(state.tactics.teamSettings).forEach((teamId) => {
            const settings = state.tactics.teamSettings[teamId];
            trainingFocus[teamId] = settings.trainingFocus || "balanced";
          });
        }

        const result = FMG.PlayerProgression.processWeeklyPlayerProgression(state, trainingFocus);
        return {
          processed: result.processed,
          errors: result.errors,
          sampleProgression: result.results[0] || null
        };
      }
    });

    return registered;
  }

  /**
   * Register player morale recovery job
   */
  function registerMoraleRecoveryJob(scheduler) {
    if (!scheduler) return false;

    return scheduler.register({
      id: "player-morale-recovery",
      group: "player-development",
      intervalWeeks: 1,
      budgetMs: 3,
      run(state) {
        if (!FMG.PlayerAttributes) return { status: "error" };

        let totalRecovery = 0;
        let affectedCount = 0;

        (state.players || []).forEach((player) => {
          if (player.retired || player.morale >= 95) return;

          FMG.PlayerAttributes.ensurePersonalityState(player);
          const rate = FMG.PlayerAttributes.getMoraleRecoveryRate(player.personality);
          const recovery = Math.min(3, 2 * rate); // 2-5 morale per week naturally

          player.morale = Math.min(100, player.morale + recovery);
          totalRecovery += recovery;
          affectedCount++;
        });

        return { recoveryPoints: Math.round(totalRecovery), affectedPlayers: affectedCount };
      }
    });
  }

  /**
   * Apply match performance impact to player morale (call after match simulation)
   */
  function applyMatchPerformanceImpact(state, matchReport) {
    if (!matchReport || !matchReport.playerStats) return { impacted: 0 };

    const players = state.players || [];
    let impactedCount = 0;

    Object.keys(matchReport.playerStats).forEach((playerId) => {
      const player = players.find((p) => p.id === playerId);
      if (!player) return;

      const stats = matchReport.playerStats[playerId];
      const result = matchReport.result || "draw"; // "win", "draw", "loss"

      if (FMG.PlayerProgression && FMG.PlayerProgression.applyMoraleImpact) {
        FMG.PlayerProgression.applyMoraleImpact(player, stats, result);
        impactedCount++;
      }
    });

    return { impacted: impactedCount };
  }

  /**
   * Apply leadership impact within team (call after matches)
   */
  function applyLeadershipBoosts(state, teamId) {
    if (!teamId) return { boosted: 0 };

    const teamPlayers = (state.players || []).filter((p) => p.teamId === teamId && !p.retired);
    if (teamPlayers.length < 2) return { boosted: 0 };

    let totalBoosted = 0;

    // Find potential leaders (high rating, significant minutes)
    teamPlayers
      .filter((p) => (p.seasonStats?.minutes || 0) >= 1000 && (p.seasonStats?.rating || 0) >= 7.0)
      .forEach((leader) => {
        if (!FMG.PlayerProgression?.applyLeadershipImpact) return;

        const boosted = FMG.PlayerProgression.applyLeadershipImpact(leader, teamPlayers, state);
        totalBoosted += boosted.length;
      });

    return { boosted: totalBoosted, teamId };
  }

  /**
   * Reducer-compatible function for updating player progression state
   * Pure function for replay safety and state snapshots
   */
  function updatePlayerProgressionState(state, action) {
    if (!state.players) return state;

    const updated = FMG.deepClone(state);

    switch (action.type) {
      case "INITIALIZE_PERSONALITIES":
        (updated.players || []).forEach((player) => {
          if (!player.personality) {
            FMG.PlayerAttributes?.ensurePersonalityState(player, action.seed || 0);
          }
        });
        return updated;

      case "APPLY_WEEKLY_PROGRESSION":
        const trainingFocus = action.trainingFocusByTeam || {};
        if (FMG.PlayerProgression) {
          (updated.players || []).forEach((player) => {
            if (player.retired) return;
            const focus = trainingFocus[player.teamId] || "balanced";
            FMG.PlayerProgression.applyWeeklyProgression(
              player,
              updated,
              focus,
              updated.currentWeek
            );
          });
        }
        return updated;

      case "APPLY_MORALE_RECOVERY":
        (updated.players || []).forEach((player) => {
          if (player.retired || player.morale >= 95) return;
          FMG.PlayerAttributes?.ensurePersonalityState(player);
          const rate = FMG.PlayerAttributes.getMoraleRecoveryRate(player.personality);
          player.morale = Math.min(100, player.morale + Math.min(3, 2 * rate));
        });
        return updated;

      case "APPLY_MATCH_IMPACT":
        return applyMatchPerformanceImpact(updated, action.matchReport);

      case "APPLY_LEADERSHIP":
        applyLeadershipBoosts(updated, action.teamId);
        return updated;

      default:
        return updated;
    }
  }

  /**
   * Initialize player progression system for a save file
   */
  function initializeProgressionForGameState(state) {
    if (!state.players) return;

    (state.players || []).forEach((player) => {
      FMG.PlayerAttributes?.ensurePersonalityState(player);
      FMG.PlayerProgression?.ensurePlayerProgressionState(player);
      
      // Ensure base potential is set
      if (!player.basePotential) {
        player.basePotential = player.potential || player.overall;
      }
    });
  }

  /**
   * Get player progression summary for UI display
   */
  function getPlayerProgressionSummary(player) {
    if (!player.progressionHistory) return null;

    const recent = player.progressionHistory.slice(-4);
    const avgProgression = recent.length ? 
      recent.reduce((sum, entry) => sum + entry.progression, 0) / recent.length : 0;

    return {
      currentOverall: player.overall,
      potential: player.potential,
      personalityType: player.personalityType || "Desconocido",
      personality: player.personality || {},
      recentProgression: avgProgression,
      progressionTrend: recent.map((e) => e.progression),
      historyLength: player.progressionHistory.length
    };
  }

  // Export functions
  FMG.PlayerProgressionIntegration = {
    registerPlayerProgressionJobs,
    registerMoraleRecoveryJob,
    applyMatchPerformanceImpact,
    applyLeadershipBoosts,
    updatePlayerProgressionState,
    initializeProgressionForGameState,
    getPlayerProgressionSummary
  };
})();
