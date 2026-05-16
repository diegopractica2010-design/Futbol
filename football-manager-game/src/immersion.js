(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  /**
   * Narrative Immersion System
   * Deterministic storylines, milestones, and season narratives
   */

  const MILESTONE_TEMPLATES = {
    // Player milestones
    "player-debut": {
      category: "player",
      trigger: "minutes",
      threshold: 1,
      label: "Debut",
      narrative: (player) => `${player.name} hizo su debut oficial con ${player.teamId}.`,
      importance: 45,
      reputationImpact: 0
    },
    "player-10goals": {
      category: "player",
      trigger: "goals",
      threshold: 10,
      label: "10 Goles",
      narrative: (player) => `${player.name} alcanzó 10 goles en la temporada, consolidándose como amenaza letal.`,
      importance: 72,
      reputationImpact: 3
    },
    "player-50games": {
      category: "player",
      trigger: "appearances",
      threshold: 50,
      label: "50 Partidos",
      narrative: (player) => `${player.name} ya suma 50 apariciones, transformándose en eje de su equipo.`,
      importance: 60,
      reputationImpact: 2
    },
    // Team milestones
    "team-5wins": {
      category: "team",
      trigger: "wins",
      threshold: 5,
      label: "5 Victorias",
      narrative: (team) => `${team.name} acumula 5 triunfos, consolidando su proyecto de temporada.`,
      importance: 65,
      reputationImpact: 2
    },
    "team-champion": {
      category: "team",
      trigger: "champion",
      threshold: 1,
      label: "Campeón",
      narrative: (team) => `¡${team.name} campeón! El título se define en favor de ${team.name}.`,
      importance: 100,
      reputationImpact: 15
    },
    "team-unbeaten-10": {
      category: "team",
      trigger: "unbeaten",
      threshold: 10,
      label: "10 Invictos",
      narrative: (team) => `${team.name} acumula 10 partidos sin perder; una racha excepcional.`,
      importance: 78,
      reputationImpact: 4
    },
    // Manager milestones
    "manager-first-win": {
      category: "manager",
      trigger: "managerWins",
      threshold: 1,
      label: "Primera Victoria",
      narrative: () => "Primera victoria como manager; el proyecto comienza su andar.",
      importance: 52,
      reputationImpact: 2
    },
    "manager-10wins": {
      category: "manager",
      trigger: "managerWins",
      threshold: 10,
      label: "10 Victorias",
      narrative: () => "10 victorias en el cargo; la confianza crece entre jugadores y directiva.",
      importance: 68,
      reputationImpact: 5
    },
    "manager-undefeated-5": {
      category: "manager",
      trigger: "managerUnbeaten",
      threshold: 5,
      label: "5 Invicto",
      narrative: () => "5 partidos invictos; el equipo comienza a responder al proyecto.",
      importance: 62,
      reputationImpact: 3
    }
  };

  const SEASON_NARRATIVE_ARCS = [
    {
      id: "underdog-rise",
      title: "Ascenso del Outsider",
      trigger: (state, season) => {
        const userStanding = state.standings.find((s) => s.teamId === state.userTeamId);
        return season.completedWeeks === 1 && userStanding && userStanding.position > 8;
      },
      acts: [
        { week: "early", narrative: "Contra todos los pronósticos, el equipo sorprende con sus primeros resultados." },
        { week: "mid", narrative: "La sorpresa comienza a consolidarse; los rivales empiezan a tomar nota." },
        { week: "late", narrative: "El sueño está a un paso; una última batalla definirá el destino." }
      ]
    },
    {
      id: "dominant-season",
      title: "Campaña Dominante",
      trigger: (state, season) => {
        const userStanding = state.standings.find((s) => s.teamId === state.userTeamId);
        return season.completedWeeks === 1 && userStanding && userStanding.position <= 3;
      },
      acts: [
        { week: "early", narrative: "Desde el inicio, la superioridad es evidente en cada partido." },
        { week: "mid", narrative: "El equipo controla la liga; los rivales luchan por restos." },
        { week: "late", narrative: "Solo queda coronar lo evidente; la gloria está al alcance." }
      ]
    },
    {
      id: "championship-decider",
      title: "Final Dramático",
      trigger: (state, season) => {
        return season.completedWeeks >= season.totalWeeks - 3;
      },
      acts: [
        { week: "climax", narrative: "La tensión es máxima; cada resultado define historias y destinos." }
      ]
    }
  ];

  /**
   * Track major milestones for players and team
   */
  function trackMilestone(player, stat, value) {
    if (!player.milestonesSeen) player.milestonesSeen = {};

    const key = `${stat}-${value}`;
    if (player.milestonesSeen[key]) return null;

    player.milestonesSeen[key] = true;

    for (const [mileId, milestone] of Object.entries(MILESTONE_TEMPLATES)) {
      if (milestone.category === "player" && milestone.trigger === stat && milestone.threshold === value) {
        return { mileId, milestone, player };
      }
    }
    return null;
  }

  /**
   * Generate dynamic narrative arc for season
   */
  function evaluateSeasonNarrative(state) {
    if (!state.userTeamId) return null;

    const seasonData = {
      completedWeeks: state.completedWeeks || 0,
      totalWeeks: state.totalWeeks || 38,
      seasonNumber: state.seasonNumber || 1
    };

    for (const arc of SEASON_NARRATIVE_ARCS) {
      if (arc.trigger(state, seasonData)) {
        return { arcId: arc.id, title: arc.title, acts: arc.acts };
      }
    }

    return null;
  }

  /**
   * Generate manager press question based on context
   */
  function generatePressQuestion(state, context = "general", rng = null) {
    const templates = {
      general: [
        "¿Qué análisis hace de estos primeros pasos en {club}?",
        "¿Cómo se propone recuperar confianza con la afición?",
        "Resultados desapercibidos; ¿dónde está el error táctico?"
      ],
      winning: [
        "¿Hasta dónde cree que puede llegar {club} esta temporada?",
        "Estos resultados, ¿justifican el presupuesto invertido?",
        "¿Siente que el equipo ya tiene la liga?"
      ],
      losing: [
        "La racha negativa acumula presión; ¿cómo se sale de esto?",
        "Algunos piden su salida; ¿qué le dice a los críticos?",
        "¿Considera que debe haber cambios en el equipo?"
      ],
      transfer: [
        "Rumores de salida de {player}; ¿qué hay de cierto?",
        "¿Cómo afecta la incertidumbre de mercado al rendimiento?",
        "¿Buscará refuerzos antes de que cierre la ventana?"
      ],
      injury: [
        "Sin {player}, ¿cambia la estrategia de partido?",
        "Las lesiones llegan en el peor momento; ¿hay alternativa?",
        "¿Confia en los suplentes para mantener el nivel?"
      ]
    };

    const questions = templates[context] || templates.general;
    const baseQuestion = rng ? rng.choice(questions) : FMG.sample(questions);

    // Substitute placeholders
    let question = baseQuestion.replace("{club}", state.userClub?.name || "su equipo");

    if (baseQuestion.includes("{player}")) {
      const topPlayer = (state.players || [])
        .filter((p) => p.teamId === state.userTeamId && !p.retired)
        .sort((a, b) => (b.overall || 0) - (a.overall || 0))[0];
      question = question.replace("{player}", topPlayer?.name || "su estrella");
    }

    return question;
  }

  /**
   * Generate dynamic rumor about player movement
   */
  function generatePlayerRumor(state, rng = null) {
    if (!state.players || !state.teams) return null;

    const activePlayers = state.players.filter((p) => !p.retired && p.overall >= 70).slice(0, 20);
    if (!activePlayers.length) return null;

    const player = rng ? rng.choice(activePlayers) : FMG.sample(activePlayers);
    const currentTeam = state.teams.find((t) => t.id === player.teamId);
    const targetTeams = state.teams.filter((t) => t.id !== player.teamId && t.budget > 80000000).slice(0, 5);
    const targetTeam = rng ? rng.choice(targetTeams) : FMG.sample(targetTeams);

    if (!currentTeam || !targetTeam) return null;

    const rumors = [
      `${player.name} habría rechazado propuesta de ${targetTeam.name} por mantener proyecto en ${currentTeam.name}.`,
      `Fuentes cercanas a ${targetTeam.name} confirman sondeo por ${player.name}; ${currentTeam.name} pide ${FMG.currency(player.value)}.`,
      `${player.name} estaría en la órbita de ${targetTeam.name}; conversaciones avanzadas según agentes.`,
      `${currentTeam.name} habría rechazado propuesta por ${player.name}; considera un titular indiscutible.`
    ];

    return {
      playerId: player.id,
      playerName: player.name,
      fromTeamId: currentTeam.id,
      fromTeamName: currentTeam.name,
      toTeamId: targetTeam.id,
      toTeamName: targetTeam.name,
      content: rng ? rng.choice(rumors) : FMG.sample(rumors),
      probability: rng ? rng.nextFloat(0.3, 0.7) : FMG.rng() * 0.4 + 0.3, // 30-70% chance
      week: state.currentWeek
    };
  }

  /**
   * Generate dramatic player declaration
   */
  function generatePlayerDeclaration(state, rng = null) {
    if (!state.players) return null;

    const userTeamPlayers = state.players.filter((p) => p.teamId === state.userTeamId && !p.retired && (p.morale || 70) >= 75);
    if (!userTeamPlayers.length) return null;

    const player = rng ? rng.choice(userTeamPlayers) : FMG.sample(userTeamPlayers);
    const declarations = [
      `"Este equipo tiene potencial para ganar el título. Creemos en el proyecto."`,
      `"El grupo está unido; hay buena energía en el vestuario."`,
      `"Queremos competir en todas las competencias; el hambre está presente."`,
      `"Estamos focalizados en seguir sumando. Cada detalle cuenta."`,
      `"La afición merece competencia de élite; vamos a darlo todo."`,
      `"Este es mi lugar; quiero ayudar a ${state.userClub.name} a conseguir títulos."`
    ];

    return {
      playerId: player.id,
      playerName: player.name,
      playerPosition: player.position,
      content: rng ? rng.choice(declarations) : FMG.sample(declarations),
      importance: 58
    };
  }

  /**
   * Generate milestone news
   */
  function generateMilestoneNews(state, milestone, entity) {
    return {
      type: "milestone",
      title: `${entity.name}: ${milestone.label}`,
      body: milestone.narrative(entity),
      tags: ["hito", "historia"],
      importance: milestone.importance,
      entities: { playerId: entity.id }
    };
  }

  /**
   * Calculate reputation impact from season events
   */
  function evaluateReputationShift(state) {
    if (!state.career) return 0;

    const userStanding = state.standings.find((s) => s.teamId === state.userTeamId);
    const seasonProgress = state.completedWeeks / (state.totalWeeks || 38);

    let shift = 0;

    // Position-based impact
    if (userStanding) {
      if (userStanding.position <= 3 && seasonProgress >= 0.5) shift += 5;
      if (userStanding.position > 15 && seasonProgress >= 0.5) shift -= 3;
    }

    // Streak impact
    const recentResults = state.seasonLog?.slice(0, 5) || [];
    const recentWins = recentResults.filter((r) => r.result === "victoria").length;
    if (recentWins >= 3) shift += 2;

    // Board trust impact
    if (state.finances?.boardTrust) {
      if (state.finances.boardTrust >= 75) shift += 2;
      if (state.finances.boardTrust <= 40) shift -= 2;
    }

    return shift;
  }

  /**
   * Ensure immersion state exists
   */
  function ensureImmersionState(state) {
    state.immersion = state.immersion || {};
    state.immersion.milestones = state.immersion.milestones || [];
    state.immersion.narrativeArc = state.immersion.narrativeArc || null;
    state.immersion.pressQuestions = state.immersion.pressQuestions || [];
    state.immersion.rumors = state.immersion.rumors || [];
    state.immersion.declarations = state.immersion.declarations || [];
    state.immersion.reputationHistory = state.immersion.reputationHistory || [];
    return state.immersion;
  }

  /**
   * Process weekly immersion updates
   */
  function processWeeklyImmersion(state, rng = null) {
    ensureImmersionState(state);
    const results = { milestones: 0, questions: 0, rumors: 0, declarations: 0 };
    const randomValue = () => (rng ? rng.next() : FMG.rng());

    // Generate press questions
    if (randomValue() < 0.6) {
      const question = generatePressQuestion(state, "general", rng);
      state.immersion.pressQuestions.push({
        week: state.currentWeek,
        question,
        status: "open"
      });
      state.immersion.pressQuestions = state.immersion.pressQuestions.slice(-8);
      results.questions++;
    }

    // Generate rumors
    if (randomValue() < 0.4) {
      const rumor = generatePlayerRumor(state, rng);
      if (rumor) {
        state.immersion.rumors.push(rumor);
        state.immersion.rumors = state.immersion.rumors.slice(-12);
        results.rumors++;
      }
    }

    // Generate declarations
    if (randomValue() < 0.3) {
      const decl = generatePlayerDeclaration(state, rng);
      if (decl) {
        state.immersion.declarations.push(decl);
        state.immersion.declarations = state.immersion.declarations.slice(-10);
        results.declarations++;
      }
    }

    // Evaluate narrative arc
    const arc = evaluateSeasonNarrative(state);
    if (arc && (!state.immersion.narrativeArc || state.immersion.narrativeArc.arcId !== arc.arcId)) {
      state.immersion.narrativeArc = arc;
    }

    // Track reputation impact
    const reputationShift = evaluateReputationShift(state);
    if (reputationShift !== 0 && state.career) {
      state.career.reputation = FMG.clamp(state.career.reputation + reputationShift, 0, 100);
      state.immersion.reputationHistory.push({
        week: state.currentWeek,
        shift: reputationShift,
        reputation: state.career.reputation
      });
      state.immersion.reputationHistory = state.immersion.reputationHistory.slice(-26);
    }

    return results;
  }

  // Export
  FMG.Immersion = {
    MILESTONE_TEMPLATES,
    SEASON_NARRATIVE_ARCS,
    trackMilestone,
    evaluateSeasonNarrative,
    generatePressQuestion,
    generatePlayerRumor,
    generatePlayerDeclaration,
    generateMilestoneNews,
    evaluateReputationShift,
    ensureImmersionState,
    processWeeklyImmersion
  };
})();
