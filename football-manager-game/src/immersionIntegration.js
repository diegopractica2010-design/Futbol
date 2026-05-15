(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  /**
   * Immersion Integration System
   * Hooks narrative systems into simulation and match processing
   */

  /**
   * Register immersion jobs with simulation scheduler
   */
  function registerImmersionJobs(scheduler) {
    if (!scheduler) return false;

    // Weekly immersion updates
    const registered = scheduler.register({
      id: "immersion-weekly",
      group: "narrative",
      intervalWeeks: 1,
      budgetMs: 3,
      run(state) {
        if (!FMG.Immersion) return { status: "error" };
        
        // Create deterministic RNG for this week's processing
        const seed = FMG.Core.Utils.deriveSeed(state.seed || 0, state.currentWeek || 1, 1001);
        const rng = FMG.Core.Utils.createRNG(seed);

        const result = FMG.Immersion.processWeeklyImmersion(state, rng);
        return {
          pressQuestions: result.questions,
          rumors: result.rumors,
          declarations: result.declarations
        };
      }
    });

    // Rivalry updates (every 2 weeks)
    const rivalryJob = scheduler.register({
      id: "rivalries-update",
      group: "narrative",
      intervalWeeks: 2,
      budgetMs: 2,
      run(state) {
        if (!FMG.Rivalries) return { status: "error" };

        FMG.Rivalries.ensureRivalryState(state);
        const upcoming = FMG.Rivalries.getUpcomingRivalries(state, state.rivalries || []);

        return {
          upcomingRivalries: upcoming.length,
          totalRivalries: state.rivalries?.length || 0
        };
      }
    });

    return registered && rivalryJob;
  }

  /**
   * Process immersion impact after match completion
   */
  function applyMatchImmersionImpact(state, matchResult) {
    if (!matchResult) return { updates: 0 };

    FMG.Immersion?.ensureImmersionState(state);
    FMG.Rivalries?.ensureRivalryState(state);

    let updates = 0;

    // Update rivalries involved in match
    if (state.rivalries) {
      state.rivalries.forEach((rivalry) => {
        if (
          (rivalry.teamAId === matchResult.homeTeamId && rivalry.teamBId === matchResult.awayTeamId) ||
          (rivalry.teamAId === matchResult.awayTeamId && rivalry.teamBId === matchResult.homeTeamId)
        ) {
          FMG.Rivalries.updateRivalryAfterMatch(rivalry, matchResult, state);

          // Generate rivalry news
          if (FMG.addNewsItem) {
            const narrative = FMG.Rivalries.generateRivalryNarrative(rivalry, state, matchResult);
            const homeTeam = state.teams.find((t) => t.id === matchResult.homeTeamId);
            const awayTeam = state.teams.find((t) => t.id === matchResult.awayTeamId);

            FMG.addNewsItem(state, {
              type: "rivalry",
              title: `${rivalry.name}: ${homeTeam?.name} ${matchResult.homeGoals}-${matchResult.awayGoals} ${awayTeam?.name}`,
              body: narrative.narrative,
              tags: ["rivalidad", "clasico"],
              importance: narrative.importance,
              entities: { homeTeamId: matchResult.homeTeamId, awayTeamId: matchResult.awayTeamId }
            });

            updates++;
          }
        }
      });
    }

    return { updates, rivalriesUpdated: updates };
  }

  /**
   * Reducer-compatible immersion state updates
   */
  function updateImmersionState(state, action) {
    if (!state) return state;

    const updated = FMG.deepClone(state);

    switch (action.type) {
      case "INITIALIZE_IMMERSION":
        FMG.Immersion?.ensureImmersionState(updated);
        FMG.Rivalries?.ensureRivalryState(updated);
        return updated;

      case "PROCESS_WEEKLY_IMMERSION":
        FMG.Immersion?.processWeeklyImmersion(updated);
        return updated;

      case "APPLY_MATCH_IMMERSION":
        applyMatchImmersionImpact(updated, action.matchResult);
        return updated;

      case "ADD_PRESS_QUESTION":
        FMG.Immersion?.ensureImmersionState(updated);
        updated.immersion.pressQuestions.push({
          week: updated.currentWeek,
          question: action.question,
          status: "open"
        });
        updated.immersion.pressQuestions = updated.immersion.pressQuestions.slice(-8);
        return updated;

      case "GENERATE_RUMOR":
        FMG.Immersion?.ensureImmersionState(updated);
        const rumor = FMG.Immersion?.generatePlayerRumor(updated);
        if (rumor) {
          updated.immersion.rumors.push(rumor);
          updated.immersion.rumors = updated.immersion.rumors.slice(-12);
        }
        return updated;

      case "UPDATE_RIVALRY_TENSION":
        FMG.Rivalries?.ensureRivalryState(updated);
        const rivalry = updated.rivalries?.find((r) => r.id === action.rivalryId);
        if (rivalry) {
          const tension = FMG.Rivalries?.calculateRivalryTension(rivalry, updated);
          rivalry.intensity = Math.min(100, tension || rivalry.intensity);
        }
        return updated;

      default:
        return updated;
    }
  }

  /**
   * Initialize immersion systems for game state
   */
  function initializeImmersionForGameState(state) {
    if (!state) return;

    FMG.Immersion?.ensureImmersionState(state);
    FMG.Rivalries?.ensureRivalryState(state);

    // Evaluate initial narrative arc
    if (FMG.Immersion?.evaluateSeasonNarrative) {
      const arc = FMG.Immersion.evaluateSeasonNarrative(state);
      if (arc && state.immersion) {
        state.immersion.narrativeArc = arc;
      }
    }
  }

  /**
   * Get immersion summary for UI
   */
  function getImmersionSummary(state) {
    const immersion = state.immersion || {};
    const rivalries = state.rivalries || [];

    return {
      narrativeArc: immersion.narrativeArc,
      pendingQuestions: immersion.pressQuestions?.filter((q) => q.status === "open").length || 0,
      activeRumors: immersion.rumors?.length || 0,
      recentDeclarations: immersion.declarations?.slice(0, 3) || [],
      upcomingRivalries: FMG.Rivalries?.getUpcomingRivalries(state, rivalries) || [],
      reputationTrend: immersion.reputationHistory?.slice(-5) || []
    };
  }

  /**
   * Generate immersion narrative for season end
   */
  function generateSeasonEndNarrative(state, seasonRecord) {
    const immersion = state.immersion || {};
    const arc = immersion.narrativeArc;

    let narrative = "Una temporada más pasa a la historia.";

    if (arc) {
      if (arc.arcId === "underdog-rise" && state.standings?.[0]?.teamId === state.userTeamId) {
        narrative = "Contra todos los pronósticos, el sueño imposible se hizo realidad. El ascenso del outsider culminó en gloria.";
      } else if (arc.arcId === "dominant-season" && state.standings?.[0]?.teamId === state.userTeamId) {
        narrative = "La campaña dominante terminó como se esperaba: en lo más alto. La superioridad fue evidente en cada paso.";
      } else if (arc.arcId === "dominant-season") {
        narrative = "La temporada vio cómo el proyecto esperanzador no llegó a concretar sus ambiciones en la recta final.";
      }
    }

    // Add rivalry impact
    if (state.rivalries?.length) {
      const rivalriesData = state.rivalries
        .map((r) => FMG.Rivalries?.getRivalrySummary(r, state))
        .filter((s) => s && s.tension > 70);

      if (rivalriesData.length > 0) {
        narrative += ` Las rivalidades marcaron la campaña con ${rivalriesData.length} enfrentamiento(s) de alta tensión.`;
      }
    }

    return narrative;
  }

  // Export
  FMG.ImmersionIntegration = {
    registerImmersionJobs,
    applyMatchImmersionImpact,
    updateImmersionState,
    initializeImmersionForGameState,
    getImmersionSummary,
    generateSeasonEndNarrative
  };
})();
