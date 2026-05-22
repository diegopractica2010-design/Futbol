(function () {
  const FMG = (window.FMG = window.FMG || {});

  function ensureSeasonDramaState(state) {
    state.seasonDrama = state.seasonDrama || {
      moments: [],
      consequences: [],
      lastTablePodium: [],
      preMatchTension: null,
      seasonMomentCount: {}
    };
    state.seasonDrama.moments = state.seasonDrama.moments || [];
    state.seasonDrama.consequences = state.seasonDrama.consequences || [];
    state.seasonDrama.lastTablePodium = state.seasonDrama.lastTablePodium || [];
    state.seasonDrama.seasonMomentCount = state.seasonDrama.seasonMomentCount || {};
    return state.seasonDrama;
  }

  function teamName(state, teamId) {
    return (state.teams || []).find((team) => team.id === teamId)?.name || "Equipo";
  }

  function userResult(state, result) {
    if (!result || !state.userTeamId) return null;
    const goalsFor = result.homeTeamId === state.userTeamId ? result.homeGoals : result.awayGoals;
    const goalsAgainst = result.homeTeamId === state.userTeamId ? result.awayGoals : result.homeGoals;
    return {
      goalsFor,
      goalsAgainst,
      won: goalsFor > goalsAgainst,
      lost: goalsFor < goalsAgainst,
      draw: goalsFor === goalsAgainst,
      diff: goalsFor - goalsAgainst
    };
  }

  function addMoment(state, moment) {
    const drama = ensureSeasonDramaState(state);
    const seasonKey = String(state.seasonNumber || 1);
    drama.seasonMomentCount[seasonKey] = drama.seasonMomentCount[seasonKey] || 0;
    if (drama.seasonMomentCount[seasonKey] >= 3) return null;
    const id = FMG.deterministicId
      ? FMG.deterministicId("wow", [state.seasonNumber || 1, state.currentWeek || 1, moment.type, moment.title])
      : `${state.seasonNumber || 1}-${state.currentWeek || 1}-${moment.type}`;
    if (drama.moments.some((item) => item.id === id)) return null;
    const entry = {
      id,
      seasonNumber: state.seasonNumber || 1,
      week: state.currentWeek || 1,
      type: moment.type,
      title: moment.title,
      detail: moment.detail,
      urgency: moment.urgency || 70,
      route: moment.route || FMG.ROUTES?.matches || "matches"
    };
    drama.moments.unshift(entry);
    drama.moments = drama.moments.slice(0, 18);
    drama.seasonMomentCount[seasonKey] += 1;
    if (FMG.pushNotification) FMG.pushNotification(entry.title, "achievement");
    if (FMG.addNewsItem) {
      FMG.addNewsItem(state, {
        type: "wow",
        title: entry.title,
        body: entry.detail,
        tags: ["momento", "temporada"],
        importance: Math.max(82, entry.urgency),
        dedupeKey: `wow-${entry.id}`
      });
    }
    return entry;
  }

  FMG.recordVisibleConsequence = function (state, consequence) {
    const drama = ensureSeasonDramaState(state);
    const entry = {
      id: FMG.uid ? FMG.uid("consequence") : FMG.deterministicId("consequence", [state.seasonNumber || 1, state.currentWeek || 1, consequence.title || ""]),
      week: state.currentWeek || 1,
      seasonNumber: state.seasonNumber || 1,
      actor: consequence.actor || "Club",
      title: consequence.title || "Consecuencia inmediata",
      detail: consequence.detail || "",
      tone: consequence.tone || "neutral",
      stat: consequence.stat || null
    };
    drama.consequences.unshift(entry);
    drama.consequences = drama.consequences.slice(0, 16);
    state.eventsLog = state.eventsLog || [];
    state.eventsLog.unshift({ week: entry.week, title: entry.title, detail: entry.detail });
    state.eventsLog = state.eventsLog.slice(0, 12);
    if (FMG.pushNotification) FMG.pushNotification(`${entry.actor}: ${entry.title}`, entry.tone === "danger" ? "warning" : "info");
    return entry;
  };

  FMG.updatePreMatchTension = function (state, userMatch) {
    const drama = ensureSeasonDramaState(state);
    if (!userMatch) {
      drama.preMatchTension = null;
      return null;
    }
    const home = (state.teams || []).find((team) => team.id === userMatch.homeTeamId);
    const away = (state.teams || []).find((team) => team.id === userMatch.awayTeamId);
    const opponentId = userMatch.homeTeamId === state.userTeamId ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponent = (state.teams || []).find((team) => team.id === opponentId);
    const position = (state.standings || []).findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const opponentPosition = (state.standings || []).findIndex((entry) => entry.teamId === opponentId) + 1;
    const isTopClash = position > 0 && opponentPosition > 0 && position <= 4 && opponentPosition <= 5;
    const isCrisis = (state.seasonLog || []).slice(0, 3).filter((entry) => entry.result === "derrota").length >= 2;
    const rivalry = FMG.getRivalry ? FMG.getRivalry(userMatch.homeTeamId, userMatch.awayTeamId) : null;
    const tension = FMG.clamp(
      45 +
      (isTopClash ? 22 : 0) +
      (isCrisis ? 18 : 0) +
      (rivalry ? 20 : 0) +
      Math.max(0, 12 - Math.abs((position || 8) - (opponentPosition || 8))),
      0,
      100
    );
    drama.preMatchTension = {
      week: state.currentWeek || 1,
      homeTeamName: home?.name || "Local",
      awayTeamName: away?.name || "Visita",
      opponentName: opponent?.name || "Rival",
      tension,
      label: rivalry ? "Clasico cargado" : isTopClash ? "Duelo de cima" : isCrisis ? "Partido bajo presion" : "Previa competitiva",
      detail: isCrisis
        ? "El presidente espera una reaccion visible esta semana."
        : isTopClash
        ? "La tabla puede girar con este resultado."
        : rivalry
        ? "La ciudad no va a olvidar este marcador."
        : "La previa ya se siente en el vestuario."
    };
    return drama.preMatchTension;
  };

  FMG.evaluateSeasonWowMoments = function (state, userMatch) {
    const drama = ensureSeasonDramaState(state);
    const result = userResult(state, userMatch);
    const standings = state.standings || [];
    const topThree = standings.slice(0, 3).map((entry) => entry.teamId);
    const previousPodium = drama.lastTablePodium || [];
    const podiumChanged = previousPodium.length && topThree.join("|") !== previousPodium.join("|");
    drama.lastTablePodium = topThree;

    if (!userMatch || !result) return null;
    const position = standings.findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const opponentId = userMatch.homeTeamId === state.userTeamId ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponentName = teamName(state, opponentId);
    const lastGoal = [...(userMatch.timeline || [])].reverse().find((event) => event.type === "goal");
    const lateUserGoal = lastGoal && lastGoal.teamId === state.userTeamId && lastGoal.minute >= 84;
    const rivalry = FMG.getRivalry ? FMG.getRivalry(userMatch.homeTeamId, userMatch.awayTeamId) : null;

    if (lateUserGoal && result.won) {
      return addMoment(state, {
        type: "last-minute-winner",
        title: "Gol agonico que cambia la semana",
        detail: `${state.userClub?.name || "Tu equipo"} le gana a ${opponentName} con un golpe al final. El vestuario explota y la prensa abre con el minuto ${lastGoal.minute}.`,
        urgency: 95
      });
    }
    if (result.diff >= 3 && position <= 4) {
      return addMoment(state, {
        type: "statement-win",
        title: "Golpe de autoridad en la tabla",
        detail: `Una victoria por ${result.goalsFor}-${result.goalsAgainst} deja al club con olor a candidato. La hinchada ya hace cuentas.`,
        urgency: 90,
        route: FMG.ROUTES?.table || "table"
      });
    }
    if (rivalry && result.won) {
      return addMoment(state, {
        type: "derby",
        title: "El clasico queda en tu memoria",
        detail: `Ganarle a ${opponentName} dispara camisetas, portadas y mensajes de ex jugadores. No fue una fecha mas.`,
        urgency: 92
      });
    }
    if (podiumChanged && topThree.includes(state.userTeamId)) {
      return addMoment(state, {
        type: "podium-shift",
        title: "El podio de la liga se mueve en vivo",
        detail: `${state.userClub?.name || "Tu club"} entra al top 3 y la tabla deja de ser decorado: ahora todos miran tu resultado.`,
        urgency: 88,
        route: FMG.ROUTES?.table || "table"
      });
    }
    return null;
  };

  FMG.ensureSeasonDramaState = ensureSeasonDramaState;
})();
