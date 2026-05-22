(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.MANAGER_STYLES = {
    balanced: { label: "Equilibrado", fans: 1, players: 1, press: 1, development: 1 },
    developer: { label: "Formador", fans: 0, players: 2, press: 0, development: 2 },
    disciplinarian: { label: "Disciplinario", fans: 0, players: -1, press: 1, development: 0 },
    charismatic: { label: "Carismatico", fans: 2, players: 1, press: 2, development: 0 },
    pragmatic: { label: "Pragmatico", fans: 1, players: 0, press: -1, development: 0 }
  };

  const achievementDefinitions = [
    { id: "first-win", title: "Primera victoria", detail: "Ganar un partido oficial." },
    { id: "league-champion", title: "Campeon de liga", detail: "Levantar la liga nacional." },
    { id: "cup-champion", title: "Campeon de copa", detail: "Ganar la Copa Chile." },
    { id: "international-champion", title: "Titulo internacional", detail: "Ganar la copa internacional." },
    { id: "developer", title: "Cantera viva", detail: "Desarrollar tres jugadores en una temporada." },
    { id: "financial-control", title: "Gestion sostenible", detail: "Cerrar temporada cumpliendo el presupuesto." },
    { id: "new-job", title: "Nuevo desafio", detail: "Aceptar una oferta de otro club." }
  ];

  function teamName(state, teamId) {
    return state.teams.find((team) => team.id === teamId)?.name || "Sin club";
  }

  function userStanding(state) {
    const position = state.standings.findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const standing = state.standings.find((entry) => entry.teamId === state.userTeamId) || null;
    return { position, standing };
  }

  function pushCareerLog(state, title, detail) {
    FMG.ensureCareerState(state);
    state.career.narrativeLog.unshift({
      week: state.currentWeek,
      seasonNumber: state.seasonNumber,
      title,
      detail
    });
    state.career.narrativeLog = state.career.narrativeLog.slice(0, 18);
  }

  function updateRelation(career, key, amount) {
    career.relations[key] = FMG.clamp((career.relations[key] || 50) + amount, 0, 100);
  }

  function reputationLabel(value) {
    if (value >= 85) return "Elite continental";
    if (value >= 70) return "Muy reconocido";
    if (value >= 55) return "Consolidado";
    if (value >= 40) return "En crecimiento";
    return "Cuestionado";
  }

  function adjustReputation(state, amount, reason) {
    FMG.ensureCareerState(state);
    const career = state.career;
    const before = career.reputation;
    career.reputation = FMG.clamp(Math.round(career.reputation + amount), 0, 100);
    if (career.reputation !== before) {
      pushCareerLog(state, "Reputacion", `${reason}: ${before} -> ${career.reputation}.`);
    }
    return career.reputation;
  }

  function objectiveStatusLabel(objective) {
    if (objective.status === "completed") return "Cumplido";
    if (objective.status === "failed") return "Fallido";
    return "En curso";
  }

  function createObjective(id, type, title, detail, target, weight) {
    return {
      id,
      type,
      title,
      detail,
      target,
      weight,
      progress: 0,
      status: "active"
    };
  }

  function makeOffer(state, team, source) {
    const ambition = team.budget >= 130000000 ? "Pelear titulos" : team.budget >= 85000000 ? "Clasificar a copas" : "Desarrollar plantilla";
    return {
      id: FMG.uid("job"),
      teamId: team.id,
      teamName: team.name,
      seasonNumber: state.seasonNumber,
      week: state.currentWeek,
      reputationRequired: Math.max(25, Math.round((team.budget / 3000000) + (team.form || 10))),
      salary: Math.round(1800000 + team.budget * 0.018),
      ambition,
      source,
      status: "pending"
    };
  }

  function setClubFinancesForCareerMove(state, team) {
    state.finances.balance = 0;
    FMG.ensureAdvancedFinances(state);
    FMG.registerFinanceEntry(state.finances, "income", `Presupuesto inicial con ${team.name}`, team.budget);
    state.finances.boardTrust = FMG.clamp(58 + Math.round(state.career.reputation / 5), 0, 100);
  }

  FMG.reputationLabel = reputationLabel;
  FMG.objectiveStatusLabel = objectiveStatusLabel;

  FMG.ensureCareerState = function (state) {
    state.managerProfile = state.managerProfile || {};
    state.managerProfile.name = state.managerProfile.name || "Manager Local";
    state.managerProfile.nationality = state.managerProfile.nationality || "Chile";
    state.managerProfile.age = Number.isFinite(state.managerProfile.age) ? state.managerProfile.age : 36;
    state.managerProfile.style = FMG.MANAGER_STYLES[state.managerProfile.style] ? state.managerProfile.style : "balanced";

    state.career = state.career || {};
    state.career.status = state.career.status || (state.userTeamId ? "employed" : "unemployed");
    state.career.reputation = Number.isFinite(state.career.reputation) ? state.career.reputation : 45;
    state.career.history = state.career.history || [];
    state.career.objectives = state.career.objectives || [];
    state.career.offers = state.career.offers || [];
    state.career.achievements = state.career.achievements || [];
    state.career.trophies = state.career.trophies || [];
    state.career.decisions = state.career.decisions || [];
    state.career.narrativeLog = state.career.narrativeLog || [];
    state.career.relations = state.career.relations || {};
    state.career.relations.fans = Number.isFinite(state.career.relations.fans) ? state.career.relations.fans : 60;
    state.career.relations.players = Number.isFinite(state.career.relations.players) ? state.career.relations.players : 60;
    state.career.relations.press = Number.isFinite(state.career.relations.press) ? state.career.relations.press : 55;
    state.career.record = state.career.record || { wins: 0, draws: 0, losses: 0 };
    state.career.record.wins = state.career.record.wins || 0;
    state.career.record.draws = state.career.record.draws || 0;
    state.career.record.losses = state.career.record.losses || 0;
    state.career.spendingThisSeason = state.career.spendingThisSeason || 0;
    state.career.transferProfitThisSeason = state.career.transferProfitThisSeason || 0;
    state.career.developedPlayersThisSeason = state.career.developedPlayersThisSeason || 0;
    state.career.currentClubStartedSeason = state.career.currentClubStartedSeason || state.seasonNumber || 1;
    state.career.lastEvaluation = state.career.lastEvaluation || null;
    state.career.sackingHistory = state.career.sackingHistory || [];
    return state.career;
  };

  FMG.createBoardObjectives = function (state) {
    FMG.ensureCareerState(state);
    const team = state.userClub || state.teams.find((item) => item.id === state.userTeamId);
    if (!team) return [];
    const teamsCount = Math.max(1, state.teams.length);
    const sortedBudgets = [...state.teams].sort((left, right) => right.budget - left.budget);
    const budgetRank = sortedBudgets.findIndex((item) => item.id === team.id) + 1;
    const targetPosition = budgetRank <= 2 ? 2 : budgetRank <= 4 ? 4 : Math.max(5, teamsCount - 2);
    const developmentTarget = team.budget < 90000000 ? 2 : 1;
    const spendLimit = Math.round(team.budget * (budgetRank <= 2 ? 0.9 : 0.72));
    state.career.objectives = [
      createObjective(`obj-league-${state.seasonNumber}`, "league-position", `Terminar top ${targetPosition}`, `El directorio espera una posicion ${targetPosition} o mejor.`, targetPosition, 42),
      createObjective(`obj-development-${state.seasonNumber}`, "player-development", `Desarrollar ${developmentTarget} jugador(es)`, "Subir el overall de jovenes o proyectos del plantel.", developmentTarget, 24),
      createObjective(`obj-spending-${state.seasonNumber}`, "spending-control", "Controlar gasto de mercado", `No superar ${FMG.currency(spendLimit)} en fichajes netos.`, spendLimit, 20),
      createObjective(`obj-relations-${state.seasonNumber}`, "relationship", "Mantener entorno estable", "Hinchas, jugadores y prensa deben sostener confianza media.", 52, 14)
    ];
    pushCareerLog(state, "Objetivos del directorio", `La directiva de ${team.name} fijo metas para la temporada ${state.seasonNumber}.`);
    return state.career.objectives;
  };

  FMG.unlockCareerAchievement = function (state, id) {
    FMG.ensureCareerState(state);
    if (state.career.achievements.some((achievement) => achievement.id === id)) return null;
    const definition = achievementDefinitions.find((item) => item.id === id);
    if (!definition) return null;
    const achievement = { ...definition, seasonNumber: state.seasonNumber, week: state.currentWeek };
    state.career.achievements.unshift(achievement);
    adjustReputation(state, 2, `Logro desbloqueado: ${definition.title}`);
    FMG.pushNotification?.(`LOGRO: ${achievement.title} - ${achievement.detail}`, "achievement");
    return achievement;
  };

  FMG.recordCareerMatchImpact = function (state, result) {
    if (!result || !state.userTeamId) return null;
    FMG.ensureCareerState(state);
    const isHome = result.homeTeamId === state.userTeamId;
    const userGoals = isHome ? result.homeGoals : result.awayGoals;
    const rivalGoals = isHome ? result.awayGoals : result.homeGoals;
    const career = state.career;
    const style = FMG.MANAGER_STYLES[state.managerProfile.style] || FMG.MANAGER_STYLES.balanced;

    if (userGoals > rivalGoals) {
      career.record.wins += 1;
      adjustReputation(state, 2, "Victoria oficial");
      FMG.updateBoardTrust(state, "Victoria oficial", 2);
      updateRelation(career, "fans", 3 + style.fans);
      updateRelation(career, "players", 2 + style.players);
      updateRelation(career, "press", 1 + style.press);
      FMG.unlockCareerAchievement(state, "first-win");
    } else if (userGoals === rivalGoals) {
      career.record.draws += 1;
      adjustReputation(state, 0, "Empate oficial");
      FMG.updateBoardTrust(state, "Empate oficial", 0);
      updateRelation(career, "fans", 0);
      updateRelation(career, "players", 1);
      updateRelation(career, "press", 0);
    } else {
      career.record.losses += 1;
      adjustReputation(state, -2, "Derrota oficial");
      FMG.updateBoardTrust(state, "Derrota oficial", -3);
      updateRelation(career, "fans", -4);
      updateRelation(career, "players", -2);
      updateRelation(career, "press", -3);
    }

    FMG.evaluateBoardObjectives(state, { seasonEnd: false });
    return { userGoals, rivalGoals, record: { ...career.record } };
  };

  FMG.recordCareerTransferImpact = function (state, options = {}) {
    FMG.ensureCareerState(state);
    const career = state.career;
    const amount = Number(options.amount || 0);
    if (options.type === "purchase" || options.type === "loan") {
      career.spendingThisSeason += amount;
      updateRelation(career, "fans", amount > 0 ? 1 : 0);
      updateRelation(career, "press", amount > (state.userClub?.budget || 0) * 0.25 ? -2 : 1);
      if (amount > (state.userClub?.budget || 0) * 0.45) FMG.updateBoardTrust(state, "Gasto alto en mercado", -4);
    }
    if (options.type === "sale") {
      career.transferProfitThisSeason += amount;
      updateRelation(career, "fans", options.important ? -4 : -1);
      updateRelation(career, "players", -1);
      FMG.updateBoardTrust(state, "Venta de jugador", amount > 0 ? 2 : 0);
    }
    FMG.evaluateBoardObjectives(state, { seasonEnd: false });
  };

  FMG.recordCareerDevelopment = function (state, amount, reason) {
    FMG.ensureCareerState(state);
    const gained = Math.max(0, Number(amount || 0));
    if (!gained) return;
    const career = state.career;
    const style = FMG.MANAGER_STYLES[state.managerProfile.style] || FMG.MANAGER_STYLES.balanced;
    career.developedPlayersThisSeason += gained;
    updateRelation(career, "players", gained + style.development);
    adjustReputation(state, gained, reason || "Desarrollo de jugadores");
    if (career.developedPlayersThisSeason >= 3) FMG.unlockCareerAchievement(state, "developer");
    FMG.evaluateBoardObjectives(state, { seasonEnd: false });
  };

  FMG.evaluateBoardObjectives = function (state, options = {}) {
    FMG.ensureCareerState(state);
    if (!state.career.objectives.length && state.userTeamId) FMG.createBoardObjectives(state);
    const career = state.career;
    const standing = userStanding(state);
    let score = 0;
    let failedWeight = 0;

    career.objectives.forEach((objective) => {
      if (objective.type === "league-position") {
        const position = standing.position || state.teams.length;
        objective.progress = Math.max(0, Math.round(((state.teams.length - position + 1) / state.teams.length) * 100));
        if (options.seasonEnd) objective.status = position <= objective.target ? "completed" : "failed";
      }
      if (objective.type === "player-development") {
        objective.progress = FMG.clamp(Math.round((career.developedPlayersThisSeason / objective.target) * 100), 0, 100);
        if (options.seasonEnd) objective.status = career.developedPlayersThisSeason >= objective.target ? "completed" : "failed";
      }
      if (objective.type === "spending-control") {
        const netSpend = Math.max(0, career.spendingThisSeason - career.transferProfitThisSeason);
        objective.progress = netSpend <= objective.target ? 100 : Math.max(0, Math.round(100 - ((netSpend - objective.target) / objective.target) * 100));
        if (options.seasonEnd) objective.status = netSpend <= objective.target ? "completed" : "failed";
      }
      if (objective.type === "relationship") {
        objective.progress = Math.round(FMG.average([career.relations.fans, career.relations.players, career.relations.press]));
        if (options.seasonEnd) objective.status = objective.progress >= objective.target ? "completed" : "failed";
      }

      const completeRatio = objective.status === "completed" ? 1 : objective.status === "failed" ? 0 : objective.progress / 100;
      score += objective.weight * completeRatio;
      if (objective.status === "failed") failedWeight += objective.weight;
    });

    const boardTrust = state.finances?.boardTrust ?? 50;
    career.lastEvaluation = {
      seasonNumber: state.seasonNumber,
      week: state.currentWeek,
      score: Math.round(score),
      boardTrust,
      failedWeight,
      summary: `${Math.round(score)}/100 | Directorio ${boardTrust}/100`
    };

    if (options.seasonEnd) {
      if (score >= 76) {
        adjustReputation(state, 6, "Objetivos cumplidos");
        FMG.updateBoardTrust(state, "Objetivos cumplidos", 8);
      } else if (score < 45) {
        adjustReputation(state, -7, "Objetivos fallidos");
        FMG.updateBoardTrust(state, "Objetivos fallidos", -12);
      }
      if ((score < 34 && state.finances.boardTrust < 30) || state.finances.boardTrust < 12 || (failedWeight >= 80 && state.finances.boardTrust < 30)) {
        FMG.sackManager(state, "La directiva considera insuficiente el rendimiento de la temporada.");
      }
    }
    return career.lastEvaluation;
  };

  FMG.evaluateCareerSeasonEnd = function (state, seasonRecord) {
    FMG.ensureCareerState(state);
    const career = state.career;
    const record = seasonRecord || state.seasonHistory[0] || null;
    const champion = state.champion || null;
    if (champion && champion.teamId === state.userTeamId) {
      career.trophies.unshift({ type: "league", title: "Liga nacional", seasonNumber: state.seasonNumber, teamName: teamName(state, state.userTeamId) });
      FMG.unlockCareerAchievement(state, "league-champion");
      adjustReputation(state, 10, "Titulo de liga");
      updateRelation(career, "fans", 12);
    }
    if (state.competitions?.nationalCup?.championTeamId === state.userTeamId) {
      career.trophies.unshift({ type: "cup", title: "Copa Chile", seasonNumber: state.seasonNumber, teamName: teamName(state, state.userTeamId) });
      FMG.unlockCareerAchievement(state, "cup-champion");
    }
    if (state.competitions?.international?.championTeamId === state.userTeamId) {
      career.trophies.unshift({ type: "international", title: "Copa Internacional", seasonNumber: state.seasonNumber, teamName: teamName(state, state.userTeamId) });
      FMG.unlockCareerAchievement(state, "international-champion");
      adjustReputation(state, 12, "Titulo internacional");
    }
    if (career.spendingThisSeason <= career.transferProfitThisSeason + (state.userClub?.budget || 0) * 0.2) {
      FMG.unlockCareerAchievement(state, "financial-control");
    }
    const evaluation = FMG.evaluateBoardObjectives(state, { seasonEnd: true });
    career.history.unshift({
      seasonNumber: state.seasonNumber,
      teamId: state.userTeamId,
      teamName: teamName(state, state.userTeamId),
      position: record ? record.userPosition : userStanding(state).position,
      points: record ? record.userPoints : userStanding(state).standing?.points || 0,
      reputation: career.reputation,
      boardTrust: state.finances.boardTrust,
      trophies: career.trophies.filter((trophy) => trophy.seasonNumber === state.seasonNumber).map((trophy) => trophy.title),
      objectiveScore: evaluation.score
    });
    career.history = career.history.slice(0, 12);
    FMG.generateCareerOffers(state, { reason: "season-end" });
    pushCareerLog(state, "Cierre de temporada", `${teamName(state, state.userTeamId)} cerro con evaluacion ${evaluation.summary}.`);
    return evaluation;
  };

  FMG.generateCareerOffers = function (state, options = {}) {
    FMG.ensureCareerState(state);
    const career = state.career;
    const reputation = career.reputation;
    const candidates = state.teams
      .filter((team) => team.id !== state.userTeamId)
      .map((team) => ({
        team,
        score: Math.abs((team.budget / 2500000 + team.form) - reputation) + FMG.randomInt(0, 16)
      }))
      .sort((left, right) => left.score - right.score)
      .slice(0, options.force ? 3 : 2)
      .map((item) => makeOffer(state, item.team, options.reason || "reputation"))
      .filter((offer) => options.force || reputation + 12 >= offer.reputationRequired || career.status === "sacked");
    career.offers = [...candidates, ...career.offers.filter((offer) => offer.status === "pending")].slice(0, 6);
    if (candidates.length) pushCareerLog(state, "Ofertas de clubes", `Llegaron ${candidates.length} propuesta(s) para continuar tu carrera.`);
    return candidates;
  };

  FMG.acceptCareerOffer = function (state, offerId) {
    FMG.ensureCareerState(state);
    const offer = state.career.offers.find((item) => item.id === offerId);
    if (!offer || offer.status !== "pending") return { ok: false, message: "Oferta no disponible." };
    if (!state.seasonComplete && state.career.status !== "sacked") {
      return { ok: false, message: "Solo puedes cambiar de club al cierre de temporada o tras un despido." };
    }
    const team = state.teams.find((item) => item.id === offer.teamId);
    if (!team) return { ok: false, message: "Club no encontrado." };
    offer.status = "accepted";
    state.career.offers.forEach((item) => {
      if (item.id !== offerId && item.status === "pending") item.status = "expired";
    });
    state.userTeamId = team.id;
    state.userClub = team;
    state.selectionMode = false;
    state.career.status = "employed";
    state.career.currentClubStartedSeason = state.seasonNumber;
    state.career.spendingThisSeason = 0;
    state.career.transferProfitThisSeason = 0;
    state.career.developedPlayersThisSeason = 0;
    state.career.record = { wins: 0, draws: 0, losses: 0 };
    setClubFinancesForCareerMove(state, team);
    FMG.createBoardObjectives(state);
    FMG.autoSelectLineup(state, team.id);
    FMG.buildTransferMarket(state);
    FMG.unlockCareerAchievement(state, "new-job");
    pushCareerLog(state, "Cambio de club", `Aceptaste dirigir a ${team.name}.`);
    if (FMG.addNewsItem) {
      FMG.addNewsItem(state, {
        type: "career",
        title: `${state.managerProfile.name} cambia de banco y llega a ${team.name}`,
        body: `${team.name} contrato a ${state.managerProfile.name} con reputacion ${state.career.reputation}/100. El nuevo objetivo publico del club es ${offer.ambition}.`,
        tags: ["carrera"],
        importance: 86,
        entities: { teamId: team.id },
        dedupeKey: `career-move-${state.seasonNumber}-${team.id}`
      });
    }
    return { ok: true, message: `Ahora diriges a ${team.name}.` };
  };

  FMG.sackManager = function (state, reason) {
    FMG.ensureCareerState(state);
    if (state.career.status === "sacked") return { ok: false, message: "El manager ya fue despedido." };
    const team = teamName(state, state.userTeamId);
    const sacking = {
      seasonNumber: state.seasonNumber,
      week: state.currentWeek,
      teamId: state.userTeamId,
      teamName: team,
      reason
    };
    state.career.status = "sacked";
    state.career.sackingHistory.unshift(sacking);
    state.career.sackingHistory = state.career.sackingHistory.slice(0, 8);
    adjustReputation(state, -8, "Despido");
    updateRelation(state.career, "press", -10);
    pushCareerLog(state, "Despido", `${team}: ${reason}`);
    if (FMG.addNewsItem) {
      FMG.addNewsItem(state, {
        type: "career",
        title: `${state.managerProfile.name} es despedido de ${team}`,
        body: `${team} decide cortar el ciclo en semana ${state.currentWeek}. La reputacion del manager queda en ${state.career.reputation}/100 y la razon oficial fue: ${reason}`,
        tags: ["carrera", "crisis"],
        importance: 90,
        entities: { teamId: state.userTeamId },
        dedupeKey: `sacking-${state.seasonNumber}-${state.currentWeek}-${state.userTeamId}`
      });
    }
    FMG.generateCareerOffers(state, { force: true, reason: "sacked" });
    return { ok: true, message: `Fuiste despedido de ${team}.` };
  };

  FMG.createNarrativeDecision = function (state, kind) {
    FMG.ensureCareerState(state);
    const decisionKind = kind || FMG.sample(["press", "locker-room", "academy", "budget"]);
    const templates = {
      press: {
        title: "Rueda de prensa tensa",
        detail: "La prensa pregunta si el equipo esta por debajo de lo esperado.",
        choices: [
          { id: "protect", label: "Proteger al plantel", effects: { players: 5, press: -2, fans: 1, reputation: 1, trust: 0 } },
          { id: "demand", label: "Exigir mas publicamente", effects: { players: -4, press: 3, fans: 2, reputation: 0, trust: 1 } }
        ]
      },
      "locker-room": {
        title: "Reunion de vestuario",
        detail: "Los referentes piden claridad sobre roles y minutos.",
        choices: [
          { id: "listen", label: "Escuchar al grupo", effects: { players: 6, press: 0, fans: 0, reputation: 1, trust: 0 } },
          { id: "discipline", label: "Marcar autoridad", effects: { players: -3, press: 1, fans: 1, reputation: 1, trust: 2 } }
        ]
      },
      academy: {
        title: "Plan de juveniles",
        detail: "El cuerpo tecnico propone dar mas minutos a proyectos del club.",
        choices: [
          { id: "promote", label: "Priorizar juveniles", effects: { players: 3, press: 1, fans: 2, reputation: 1, trust: 1, development: 1 } },
          { id: "wait", label: "Mantener titulares", effects: { players: 0, press: -1, fans: -1, reputation: 0, trust: 0 } }
        ]
      },
      budget: {
        title: "Ajuste presupuestario",
        detail: "El directorio pide moderar gastos para proteger caja.",
        choices: [
          { id: "accept", label: "Aceptar austeridad", effects: { players: -1, press: 1, fans: -1, reputation: 1, trust: 5 } },
          { id: "push", label: "Pedir ambicion", effects: { players: 2, press: 2, fans: 3, reputation: 1, trust: -4 } }
        ]
      }
    };
    const source = templates[decisionKind];
    const decision = {
      id: FMG.uid("decision"),
      kind: decisionKind,
      title: source.title,
      detail: source.detail,
      choices: source.choices,
      status: "pending",
      createdWeek: state.currentWeek,
      seasonNumber: state.seasonNumber
    };
    state.career.decisions.unshift(decision);
    state.career.decisions = state.career.decisions.slice(0, 8);
    pushCareerLog(state, "Decision narrativa", source.title);
    return decision;
  };

  FMG.resolveNarrativeDecision = function (state, decisionId, choiceId) {
    FMG.ensureCareerState(state);
    const decision = state.career.decisions.find((item) => item.id === decisionId);
    if (!decision || decision.status !== "pending") return { ok: false, message: "Decision no disponible." };
    const choice = decision.choices.find((item) => item.id === choiceId) || decision.choices[0];
    const effects = choice.effects || {};
    updateRelation(state.career, "fans", effects.fans || 0);
    updateRelation(state.career, "players", effects.players || 0);
    updateRelation(state.career, "press", effects.press || 0);
    if (effects.trust) FMG.updateBoardTrust(state, `Decision: ${choice.label}`, effects.trust);
    if (effects.reputation) adjustReputation(state, effects.reputation, `Decision: ${choice.label}`);
    if (effects.development) FMG.recordCareerDevelopment(state, effects.development, "Impulso narrativo a juveniles");
    if (FMG.recordVisibleConsequence) {
      const actor = effects.trust < 0
        ? "Presidente"
        : effects.players < 0
        ? "Referente del plantel"
        : effects.press > 0
        ? "Prensa"
        : "Vestuario";
      const detail = effects.trust < 0
        ? "La directiva te llama esa misma noche: quiere ambicion, pero no a cualquier costo."
        : effects.players < 0
        ? "Un jugador importante se molesta y avisa que no entrenara igual si el rol no queda claro."
        : effects.press > 0
        ? "La conferencia prende titulares y el ambiente alrededor del club se calienta."
        : "El grupo responde al gesto y la charla se nota en el entrenamiento siguiente.";
      FMG.recordVisibleConsequence(state, {
        actor,
        title: choice.label,
        detail,
        tone: effects.trust < 0 || effects.players < 0 ? "danger" : "neutral",
        stat: effects.trust ? "boardTrust" : effects.players ? "players" : "press"
      });
    }
    decision.status = "resolved";
    decision.selectedChoiceId = choice.id;
    decision.result = {
      label: choice.label,
      effects
    };
    pushCareerLog(state, "Consecuencia", `${decision.title}: ${choice.label}.`);
    return { ok: true, message: `Decision resuelta: ${choice.label}.`, decision };
  };

  FMG.prepareCareerNewSeason = function (state) {
    FMG.ensureCareerState(state);
    state.career.spendingThisSeason = 0;
    state.career.transferProfitThisSeason = 0;
    state.career.developedPlayersThisSeason = 0;
    state.career.record = { wins: 0, draws: 0, losses: 0 };
    state.career.decisions = state.career.decisions.filter((decision) => decision.status === "pending").slice(0, 3);
    if (state.career.status !== "sacked" && state.userTeamId) {
      FMG.createBoardObjectives(state);
    }
  };
})();
