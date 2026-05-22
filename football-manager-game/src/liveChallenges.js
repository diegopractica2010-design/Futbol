(function () {
  const FMG = (window.FMG = window.FMG || {});

  function ensureLiveChallenges(state) {
    state.liveChallenges = state.liveChallenges || { manager: [], player: [], completed: [] };
    state.liveChallenges.manager = state.liveChallenges.manager || [];
    state.liveChallenges.player = state.liveChallenges.player || [];
    state.liveChallenges.completed = state.liveChallenges.completed || [];
    return state.liveChallenges;
  }

  function challengeId(scope, type, state) {
    return FMG.deterministicId
      ? FMG.deterministicId("challenge", [scope, type, state.seasonNumber || 1, state.currentWeek || 1])
      : `challenge-${scope}-${type}-${state.seasonNumber || 1}-${state.currentWeek || 1}`;
  }

  function upsertChallenge(list, challenge) {
    if (list.some((item) => item.id === challenge.id || (item.type === challenge.type && item.status === "active"))) return null;
    list.unshift(challenge);
    list.length = Math.min(list.length, 5);
    return challenge;
  }

  function createChallenge(scope, type, state, source) {
    return {
      id: challengeId(scope, type, state),
      scope,
      type,
      title: source.title,
      detail: source.detail,
      reward: source.reward,
      target: source.target,
      progress: 0,
      status: "active",
      createdWeek: state.currentWeek || 1,
      seasonNumber: state.seasonNumber || 1
    };
  }

  FMG.generateManagerLiveChallenges = function (state, options = {}) {
    const hub = ensureLiveChallenges(state);
    if (!state.userTeamId) return [];
    const active = hub.manager.filter((challenge) => challenge.status === "active");
    if (active.length >= 3 && !options.force) return active;
    const position = (state.standings || []).findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const avgEnergy = (state.players || []).filter((player) => player.teamId === state.userTeamId && !player.retired)
      .reduce((sum, player, index, squad) => sum + (player.energy || 75) / Math.max(1, squad.length), 0);
    const templates = [
      {
        type: "three-match-run",
        title: "Racha de autoridad",
        detail: "Suma 7 puntos en los proximos 3 partidos para calmar al directorio.",
        target: 7,
        reward: "Confianza del directorio +6"
      },
      {
        type: "clean-sheet",
        title: "Cerrar el arco",
        detail: "Deja el arco en cero en el proximo partido oficial.",
        target: 1,
        reward: "Moral defensiva +5"
      },
      {
        type: "podium-push",
        title: position <= 4 ? "Defender el podio" : "Asaltar el podio",
        detail: "Termina la proxima fecha dentro del top 3.",
        target: 1,
        reward: "Hinchas +6"
      },
      {
        type: "fresh-legs",
        title: "Plantel fresco",
        detail: "Llega a la proxima fecha con energia media de plantilla sobre 72.",
        target: 72,
        reward: "Riesgo de lesion reducido"
      }
    ];
    const seed = FMG.hashText(`manager-challenge-${state.seasonNumber || 1}-${state.currentWeek || 1}-${position}-${Math.round(avgEnergy)}`);
    const ordered = templates.slice(seed % templates.length).concat(templates.slice(0, seed % templates.length));
    const created = [];
    ordered.forEach((template) => {
      if (hub.manager.filter((challenge) => challenge.status === "active").length >= 3) return;
      const challenge = createChallenge("manager", template.type, state, template);
      if (upsertChallenge(hub.manager, challenge)) created.push(challenge);
    });
    return created.length ? created : hub.manager.filter((challenge) => challenge.status === "active");
  };

  FMG.generatePlayerLiveChallenges = function (state, options = {}) {
    const hub = ensureLiveChallenges(state);
    const pm = state.playerMode;
    if (!pm?.created) return [];
    const active = hub.player.filter((challenge) => challenge.status === "active");
    if (active.length >= 3 && !options.force) return active;
    const isKeeper = pm.player?.position === "POR";
    const templates = [
      {
        type: "rating",
        title: "Convencer al DT",
        detail: "Consigue rating 7.0 o superior en tu proxima aparicion.",
        target: 7,
        reward: "Confianza DT +5"
      },
      {
        type: isKeeper ? "clean-sheet-player" : "goal-involvement",
        title: isKeeper ? "Partido seguro" : "Influir en el marcador",
        detail: isKeeper ? "Deja el arco en cero o supera rating 7.4." : "Marca o asiste en uno de tus proximos partidos.",
        target: 1,
        reward: isKeeper ? "Fan love +5" : "Fan love +6"
      },
      {
        type: "training-week",
        title: "Semana profesional",
        detail: "Completa dos entrenamientos antes de avanzar demasiado la temporada.",
        target: 2,
        reward: "Forma +5"
      }
    ];
    templates.forEach((template) => {
      if (hub.player.filter((challenge) => challenge.status === "active").length >= 3) return;
      const challenge = createChallenge("player", template.type, state, template);
      if (upsertChallenge(hub.player, challenge)) challenge.progress = template.type === "rating" ? 0 : challenge.progress;
    });
    return hub.player.filter((challenge) => challenge.status === "active");
  };

  function completeChallenge(state, challenge) {
    if (!challenge || challenge.status === "completed") return;
    const hub = ensureLiveChallenges(state);
    challenge.status = "completed";
    challenge.completedWeek = state.currentWeek || state.playerMode?.week || 1;
    hub.completed.unshift({ ...challenge });
    hub.completed = hub.completed.slice(0, 20);
    if (challenge.scope === "manager") {
      if (challenge.type === "three-match-run" && state.finances) state.finances.boardTrust = FMG.clamp((state.finances.boardTrust || 50) + 6, 0, 100);
      if (challenge.type === "podium-push" && state.career?.relations) state.career.relations.fans = FMG.clamp((state.career.relations.fans || 50) + 6, 0, 100);
      if (challenge.type === "clean-sheet") {
        (state.players || []).filter((player) => player.teamId === state.userTeamId && ["POR", "DEF"].includes(player.position)).forEach((player) => {
          player.morale = FMG.clamp((player.morale || 60) + 5, 0, 100);
        });
      }
    }
    if (challenge.scope === "player" && state.playerMode?.personality) {
      const p = state.playerMode.personality;
      if (challenge.type === "rating") p.managerTrust = FMG.clamp((p.managerTrust || 50) + 5, 0, 100);
      if (challenge.type === "goal-involvement" || challenge.type === "clean-sheet-player") p.fanLove = FMG.clamp((p.fanLove || 35) + 6, 0, 100);
      if (challenge.type === "training-week") p.form = FMG.clamp((p.form || 50) + 5, 0, 100);
    }
    if (FMG.pushNotification) FMG.pushNotification(`Desafio completado: ${challenge.title}`, "achievement");
  }

  FMG.updateManagerChallengeProgress = function (state, userMatch) {
    const hub = ensureLiveChallenges(state);
    FMG.generateManagerLiveChallenges(state);
    const userSide = userMatch?.homeTeamId === state.userTeamId ? "home" : userMatch?.awayTeamId === state.userTeamId ? "away" : null;
    const goalsFor = userSide === "home" ? userMatch.homeGoals : userSide === "away" ? userMatch.awayGoals : 0;
    const goalsAgainst = userSide === "home" ? userMatch.awayGoals : userSide === "away" ? userMatch.homeGoals : 0;
    const points = goalsFor > goalsAgainst ? 3 : goalsFor === goalsAgainst ? 1 : 0;
    const position = (state.standings || []).findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const avgEnergy = (state.players || []).filter((player) => player.teamId === state.userTeamId && !player.retired)
      .reduce((sum, player, index, squad) => sum + (player.energy || 75) / Math.max(1, squad.length), 0);
    hub.manager.filter((challenge) => challenge.status === "active").forEach((challenge) => {
      if (challenge.type === "three-match-run") challenge.progress = FMG.clamp((challenge.progress || 0) + points, 0, challenge.target);
      if (challenge.type === "clean-sheet" && userSide) challenge.progress = goalsAgainst === 0 ? 1 : challenge.progress;
      if (challenge.type === "podium-push") challenge.progress = position > 0 && position <= 3 ? 1 : 0;
      if (challenge.type === "fresh-legs") challenge.progress = Math.round(avgEnergy);
      if (challenge.progress >= challenge.target) completeChallenge(state, challenge);
    });
  };

  FMG.updatePlayerChallengeProgress = function (state, match) {
    const hub = ensureLiveChallenges(state);
    FMG.generatePlayerLiveChallenges(state);
    hub.player.filter((challenge) => challenge.status === "active").forEach((challenge) => {
      if (challenge.type === "rating") challenge.progress = Math.max(challenge.progress || 0, match?.rating || 0);
      if (challenge.type === "goal-involvement") challenge.progress = (match?.goals || 0) + (match?.assists || 0) > 0 ? 1 : challenge.progress;
      if (challenge.type === "clean-sheet-player") challenge.progress = match?.cleanSheet || match?.rating >= 7.4 ? 1 : challenge.progress;
      if (challenge.progress >= challenge.target) completeChallenge(state, challenge);
    });
  };

  FMG.recordPlayerTrainingChallenge = function (state) {
    const hub = ensureLiveChallenges(state);
    FMG.generatePlayerLiveChallenges(state);
    hub.player.filter((challenge) => challenge.status === "active" && challenge.type === "training-week").forEach((challenge) => {
      challenge.progress = FMG.clamp((challenge.progress || 0) + 1, 0, challenge.target);
      if (challenge.progress >= challenge.target) completeChallenge(state, challenge);
    });
  };

  FMG.LiveChallenges = { ensure: ensureLiveChallenges };
  FMG.ensureLiveChallenges = ensureLiveChallenges;
})();
