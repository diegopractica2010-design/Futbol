(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  /**
   * Dynamic Rivalry System
   * Tracks rivalry relationships, tension, and dramatic moments
   */

  const RIVALRY_IMPACT_MODIFIERS = {
    consecutiveClassics: 1.3, // Multiple derbies increase tension
    dramaticResults: 1.25, // 3+ goal margins
    lowScoring: 1.15, // 0-0, 1-0 create tension
    highScoring: 0.9, // 5+ goals reduce tension slightly
    longTimeNoMeet: 1.1, // Long gap between matches
    recentMeetings: 1.2, // Recent history matters
    directCompetition: 1.4 // Fighting for same position
  };

  const RIVALRY_TEMPLATES = {
    superclasico: {
      name: "Superclásico",
      intensity: 95,
      historical: true,
      keywords: ["rivalidad clasica", "historia", "tradition"],
      context: "Dos gigantes de la historia del futbol local"
    },
    regional: {
      name: "Rivalidad Regional",
      intensity: 70,
      historical: false,
      keywords: ["region", "zona", "ciudades"],
      context: "Clubes de la misma region luchan por dominio local"
    },
    budgetary: {
      name: "Duelo de Presupuestos",
      intensity: 55,
      historical: false,
      keywords: ["presupuesto", "ambicion", "proyecto"],
      context: "Dos proyectos amiciosos compiten por recursos"
    },
    championship: {
      name: "Batalla por el Titulo",
      intensity: 80,
      historical: false,
      keywords: ["campeonato", "puntos", "tabla"],
      context: "La tabla define antagonismo temporal"
    }
  };

  /**
   * Create rivalry between two teams
   */
  function createRivalry(teamA, teamB, type = "superclasico") {
    const template = RIVALRY_TEMPLATES[type] || RIVALRY_TEMPLATES.regional;

    return {
      id: `rivalry-${[teamA.id, teamB.id].sort().join("-")}`,
      teamAId: teamA.id,
      teamAName: teamA.name,
      teamBId: teamB.id,
      teamBName: teamB.name,
      type,
      name: template.name,
      intensity: template.intensity,
      historical: template.historical,
      meetingsCount: 0,
      lastMeetingWeek: null,
      recentResults: [],
      dramaticMoments: [],
      headToHead: { teamAWins: 0, teamBWins: 0, draws: 0 },
      emotionalState: "neutral" // neutral, simmering, heated, explosive
    };
  }

  /**
   * Calculate current rivalry tension level
   */
  function calculateRivalryTension(rivalry, state) {
    let tension = rivalry.intensity || 50;

    // Reduce tension with time gap
    const weekGap = (state.currentWeek || 1) - (rivalry.lastMeetingWeek || 0);
    if (weekGap > 10) tension *= 0.8;
    if (weekGap > 20) tension *= 0.6;

    // Recent results create tension
    if (rivalry.recentResults.length >= 3) {
      const margin = rivalry.recentResults.reduce((sum, r) => sum + Math.abs(r.margin), 0) / rivalry.recentResults.length;
      if (margin >= 3) tension *= RIVALRY_IMPACT_MODIFIERS.dramaticResults;
      if (margin <= 1) tension *= RIVALRY_IMPACT_MODIFIERS.lowScoring;
    }

    // Head-to-head records
    const totalMatches = rivalry.headToHead.teamAWins + rivalry.headToHead.teamBWins + rivalry.headToHead.draws;
    if (totalMatches > 0) {
      const difference = Math.abs(rivalry.headToHead.teamAWins - rivalry.headToHead.teamBWins);
      if (difference === 0) tension *= 1.2; // Even records are tense
      if (difference >= 5) tension *= 0.7; // Lopsided reduces tension
    }

    return Math.round(Math.min(100, Math.max(10, tension)));
  }

  /**
   * Update rivalry after match
   */
  function updateRivalryAfterMatch(rivalry, result, state) {
    const teamAGoals = rivalry.teamAId === result.homeTeamId ? result.homeGoals : result.awayGoals;
    const teamBGoals = rivalry.teamAId === result.homeTeamId ? result.awayGoals : result.homeGoals;
    const margin = Math.abs(teamAGoals - teamBGoals);

    // Update head-to-head
    if (teamAGoals > teamBGoals) rivalry.headToHead.teamAWins++;
    else if (teamBGoals > teamAGoals) rivalry.headToHead.teamBWins++;
    else rivalry.headToHead.draws++;

    // Track recent results
    rivalry.recentResults.unshift({ week: state.currentWeek, margin, score: `${teamAGoals}-${teamBGoals}` });
    rivalry.recentResults = rivalry.recentResults.slice(0, 5);

    // Update meeting info
    rivalry.meetingsCount++;
    rivalry.lastMeetingWeek = state.currentWeek;

    // Generate dramatic moment if applicable
    if (margin >= 3) {
      rivalry.dramaticMoments.push({
        week: state.currentWeek,
        type: "emphatic",
        description: `${margin}-goal thrashing`
      });
    }

    // Update emotional state
    const currentTension = calculateRivalryTension(rivalry, state);
    if (currentTension >= 85) rivalry.emotionalState = "explosive";
    else if (currentTension >= 70) rivalry.emotionalState = "heated";
    else if (currentTension >= 50) rivalry.emotionalState = "simmering";
    else rivalry.emotionalState = "neutral";

    return rivalry;
  }

  /**
   * Get rivalry summary for UI
   */
  function getRivalrySummary(rivalry, state) {
    const tension = calculateRivalryTension(rivalry, state);
    const lastResult = rivalry.recentResults[0];

    return {
      id: rivalry.id,
      name: rivalry.name,
      teamAName: rivalry.teamAName,
      teamBName: rivalry.teamBName,
      intensity: rivalry.intensity,
      tension,
      emotionalState: rivalry.emotionalState,
      headToHead: rivalry.headToHead,
      lastMeeting: lastResult,
      dramaticMoments: rivalry.dramaticMoments.length,
      nextMeetingWeek: null // Calculate from fixtures
    };
  }

  /**
   * Generate rivalry narrative for news
   */
  function generateRivalryNarrative(rivalry, state, matchResult) {
    const tension = calculateRivalryTension(rivalry, state);
    const teamA = rivalry.teamAName;
    const teamB = rivalry.teamBName;

    const emotionalDescriptions = {
      explosive: "El fuego del clásico se desató con intensidad máxima",
      heated: "La rivalidad llegó a su punto de ebullición",
      simmering: "La tensión acumulada entre ambos clubes se hizo presente",
      neutral: "Un encuentro entre rivales históricos"
    };

    const narratives = {
      decisive: `${emotionalDescriptions[rivalry.emotionalState]}. ${rivalry.emotionalState === "explosive" || rivalry.emotionalState === "heated" ? `El marcador ${matchResult.homeGoals}-${matchResult.awayGoals} refleja la diferencia en juego.` : "Ambos buscaron imponer su fuerza."}`,
      close: `La rivalidad mostró su verdadera cara en un duelo cerrado. Tensión ${tension}/100 reinó en la cancha.`,
      dominant: `${teamA} impuso su superioridad sobre ${teamB} en una demostración de calidad. La rivalidad quedó con cicatrices.`
    };

    let narrativeType = "close";
    const margin = Math.abs(matchResult.homeGoals - matchResult.awayGoals);
    if (margin >= 3) narrativeType = "dominant";
    if (margin === 1) narrativeType = "close";
    if (margin >= 2) narrativeType = "decisive";

    return {
      type: "rivalry",
      narrative: narratives[narrativeType],
      tension,
      emotionalState: rivalry.emotionalState,
      importance: 75 + (tension - 50) * 0.3
    };
  }

  /**
   * Get upcoming rivalry matches
   */
  function getUpcomingRivalries(state, rivalries = []) {
    const upcoming = [];

    (state.fixtures || [])
      .filter((fixture) => !fixture.played)
      .forEach((fixture) => {
        (fixture.matches || []).forEach((match) => {
          const rivalry = rivalries.find(
            (r) =>
              (r.teamAId === match.homeTeamId && r.teamBId === match.awayTeamId) ||
              (r.teamAId === match.awayTeamId && r.teamBId === match.homeTeamId)
          );

          if (rivalry) {
            upcoming.push({
              fixture: fixture.week,
              rivalry: rivalry.name,
              teamAName: rivalry.teamAName,
              teamBName: rivalry.teamBName,
              tension: calculateRivalryTension(rivalry, state)
            });
          }
        });
      });

    return upcoming.slice(0, 5);
  }

  /**
   * Ensure rivalry system state
   */
  function ensureRivalryState(state) {
    state.rivalries = state.rivalries || [];

    // Initialize predefined rivalries if missing
    if (!state.rivalries.length && state.teams) {
      const predefinedPairs = [
        { teams: ["colo-colo", "u-de-chile"], type: "superclasico" },
        { teams: ["colo-colo", "u-catolica"], type: "superclasico" },
        { teams: ["u-de-chile", "u-catolica"], type: "championship" },
        { teams: ["cobreloa", "colo-colo"], type: "regional" }
      ];

      predefinedPairs.forEach(({ teams, type }) => {
        const teamA = state.teams.find((t) => t.id === teams[0]);
        const teamB = state.teams.find((t) => t.id === teams[1]);

        if (teamA && teamB) {
          state.rivalries.push(createRivalry(teamA, teamB, type));
        }
      });
    }

    return state.rivalries;
  }

  // Export
  FMG.Rivalries = {
    RIVALRY_IMPACT_MODIFIERS,
    RIVALRY_TEMPLATES,
    createRivalry,
    calculateRivalryTension,
    updateRivalryAfterMatch,
    getRivalrySummary,
    generateRivalryNarrative,
    getUpcomingRivalries,
    ensureRivalryState
  };
})();
