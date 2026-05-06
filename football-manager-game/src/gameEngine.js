(function () {
  const FMG = (window.FMG = window.FMG || {});

  const fallbackNames = [
    "Matias Navarro", "Felipe Bustos", "Rodrigo Parraguez", "Diego Loyola", "Cristian Caceres",
    "Martin Sepulveda", "Javier Astudillo", "Bruno Troncoso", "Matias Concha", "Carlos Inostroza",
    "Vicente Alarcon", "Bastian Retamal", "Sebastian Alveal", "Nicolas Chandia", "Franco Cifuentes"
  ];

  function ensureSquadDepth(teams, players) {
    const enrichedPlayers = [...FMG.deepClone(players)];
    const positions = ["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "EXT", "EXT", "DEL", "POR", "DEF", "DEF", "MED", "MED", "EXT", "DEL"];

    teams.forEach((team, teamIndex) => {
      const squad = enrichedPlayers.filter((player) => player.teamId === team.id);
      while (squad.length < 18) {
        const squadIndex = squad.length;
        const player = {
          id: `${team.id}-gen-${squadIndex + 1}`,
          name: fallbackNames[(teamIndex * 4 + squadIndex) % fallbackNames.length],
          teamId: team.id,
          position: positions[squadIndex],
          age: 19 + ((teamIndex + squadIndex) % 11),
          overall: 64 + ((teamIndex + squadIndex) % 9),
          morale: 70 + ((teamIndex + squadIndex) % 12),
          energy: 82 + ((teamIndex + squadIndex) % 15),
          value: 3500000 + squadIndex * 420000,
          salary: 420000 + squadIndex * 32000
        };
        squad.push(player);
        enrichedPlayers.push(player);
      }
    });

    return enrichedPlayers;
  }

  function createRoundRobin(teamIds) {
    const ids = [...teamIds];
    if (ids.length % 2 !== 0) ids.push(null);
    const rounds = [];
    let rotating = [...ids];

    for (let round = 0; round < rotating.length - 1; round += 1) {
      const matches = [];
      for (let index = 0; index < rotating.length / 2; index += 1) {
        const home = rotating[index];
        const away = rotating[rotating.length - 1 - index];
        if (home && away) matches.push(round % 2 === 0 ? { homeTeamId: home, awayTeamId: away } : { homeTeamId: away, awayTeamId: home });
      }
      rounds.push(matches);
      rotating = [rotating[0], rotating[rotating.length - 1], ...rotating.slice(1, rotating.length - 1)];
    }

    return rounds;
  }

  function buildSeasonFixtures(teams) {
    const firstLeg = createRoundRobin(teams.map((team) => team.id));
    const secondLeg = firstLeg.map((round) => round.map((match) => ({ homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId })));
    return [...firstLeg, ...secondLeg].map((matches, index) => ({ week: index + 1, played: false, matches }));
  }

  function getNextUnplayedFixture(state) {
    return state.fixtures
      .filter((fixture) => !fixture.played)
      .sort((left, right) => left.week - right.week)[0] || null;
  }

  function getChampion(state) {
    const sorted = FMG.sortStandings(state.standings);
    return sorted[0] || null;
  }

  function ensureCompetitions(state) {
    state.competitions = state.competitions || {};
    state.competitions.nationalCup = state.competitions.nationalCup || null;
    state.competitions.superCup = state.competitions.superCup || null;
    state.competitions.international = state.competitions.international || null;
    state.competitions.rankings = state.competitions.rankings || { scorers: [], shooters: [], cards: [], keepers: [] };
    state.competitions.qualification = state.competitions.qualification || [];
    state.competitions.relegation = state.competitions.relegation || null;
    state.competitions.prizeLog = state.competitions.prizeLog || [];
  }

  function knockoutWinner(state, firstTeamId, secondTeamId, competitionName, roundName) {
    const homeTeam = state.teams.find((team) => team.id === firstTeamId);
    const awayTeam = state.teams.find((team) => team.id === secondTeamId);
    const result = FMG.simulateMatch({ homeTeam, awayTeam, players: state.players, state });
    let winnerId = result.homeGoals > result.awayGoals ? firstTeamId : result.awayGoals > result.homeGoals ? secondTeamId : null;
    if (!winnerId) {
      const homeStrength = FMG.computeTeamStrength(homeTeam, state.players, state);
      const awayStrength = FMG.computeTeamStrength(awayTeam, state.players, state);
      winnerId = homeStrength + FMG.randomInt(0, 8) >= awayStrength + FMG.randomInt(0, 8) ? firstTeamId : secondTeamId;
    }
    return {
      competitionName,
      roundName,
      homeTeamId: firstTeamId,
      awayTeamId: secondTeamId,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      winnerTeamId: winnerId,
      winnerName: state.teams.find((team) => team.id === winnerId).name
    };
  }

  function simulateKnockout(state, entrants, competitionName) {
    let current = entrants.map((team) => team.id).filter(Boolean);
    if (current.length % 2 !== 0) current = current.slice(0, -1);
    const rounds = [];
    while (current.length > 1) {
      const roundName = current.length > 4 ? "Cuartos" : current.length > 2 ? "Semifinal" : "Final";
      const next = [];
      const matches = [];
      const paired = current.length % 2 === 0 ? current : current.slice(0, -1);
      if (paired.length !== current.length) next.push(current[current.length - 1]);
      for (let index = 0; index < paired.length; index += 2) {
        const match = knockoutWinner(state, paired[index], paired[index + 1], competitionName, roundName);
        matches.push(match);
        next.push(match.winnerTeamId);
      }
      rounds.push({ name: roundName, matches });
      current = next;
    }
    return { rounds, championTeamId: current[0], championName: state.teams.find((team) => team.id === current[0]).name };
  }

  function updateCompetitionRankings(state) {
    ensureCompetitions(state);
    const activePlayers = state.players.filter((player) => !player.retired);
    state.competitions.rankings = {
      scorers: [...activePlayers].sort((left, right) => (right.seasonStats?.goals || 0) - (left.seasonStats?.goals || 0)).slice(0, 10).map((player) => ({
        playerId: player.id,
        name: player.name,
        teamName: state.teams.find((team) => team.id === player.teamId)?.name || "Libre",
        value: player.seasonStats?.goals || 0
      })),
      shooters: [...activePlayers].sort((left, right) => (right.seasonStats?.shots || 0) - (left.seasonStats?.shots || 0)).slice(0, 10).map((player) => ({
        playerId: player.id,
        name: player.name,
        teamName: state.teams.find((team) => team.id === player.teamId)?.name || "Libre",
        value: player.seasonStats?.shots || 0
      })),
      cards: [...activePlayers].sort((left, right) => (right.seasonStats?.cards || 0) - (left.seasonStats?.cards || 0)).slice(0, 10).map((player) => ({
        playerId: player.id,
        name: player.name,
        teamName: state.teams.find((team) => team.id === player.teamId)?.name || "Libre",
        value: player.seasonStats?.cards || 0
      })),
      keepers: [...activePlayers].filter((player) => player.position === "POR").sort((left, right) => (right.seasonStats?.appearances || 0) - (left.seasonStats?.appearances || 0)).slice(0, 8).map((player) => ({
        playerId: player.id,
        name: player.name,
        teamName: state.teams.find((team) => team.id === player.teamId)?.name || "Libre",
        value: player.seasonStats?.appearances || 0
      }))
    };
  }

  function awardPrize(state, label, amount) {
    FMG.registerFinanceEntry(state.finances, amount >= 0 ? "income" : "expense", label, amount);
    state.competitions.prizeLog.unshift({ week: state.currentWeek, label, amount });
    state.competitions.prizeLog = state.competitions.prizeLog.slice(0, 10);
  }

  function completeSeasonCompetitions(state) {
    ensureCompetitions(state);
    const sorted = FMG.sortStandings(state.standings);
    const cupEntrants = [...state.teams].sort((left, right) => right.form - left.form).slice(0, 8);
    const nationalCup = simulateKnockout(state, cupEntrants, "Copa Chile");
    state.competitions.nationalCup = { seasonNumber: state.seasonNumber, ...nationalCup };

    const internationalEntrants = sorted.slice(0, Math.min(4, sorted.length)).map((entry) => state.teams.find((team) => team.id === entry.teamId));
    state.competitions.international = {
      seasonNumber: state.seasonNumber,
      ...simulateKnockout(state, internationalEntrants.length % 2 === 0 ? internationalEntrants : internationalEntrants.slice(0, -1), "Copa Internacional")
    };

    state.competitions.qualification = sorted.map((entry, index) => ({
      teamId: entry.teamId,
      teamName: entry.name,
      position: index + 1,
      competition: index === 0 ? "Copa Libertadores" : index <= 2 ? "Copa Sudamericana" : "Liga local"
    }));
    const bottom = sorted[sorted.length - 1];
    state.competitions.relegation = {
      relegatedTeamId: bottom.teamId,
      relegatedTeamName: bottom.name,
      promotedTeamId: `ascenso-${state.seasonNumber + 1}`,
      promotedTeamName: `Deportes del Valle ${state.seasonNumber + 1}`
    };

    const userPosition = sorted.findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const leaguePrize = userPosition === 1 ? 38000000 : userPosition <= 3 ? 22000000 : userPosition <= 5 ? 12000000 : 5000000;
    awardPrize(state, `Premio liga posicion ${userPosition}`, leaguePrize);
    if (state.competitions.nationalCup.championTeamId === state.userTeamId) awardPrize(state, "Premio campeon Copa Chile", 18000000);
    if (state.competitions.international.championTeamId === state.userTeamId) awardPrize(state, "Premio campeon internacional", 26000000);
    updateCompetitionRankings(state);
  }

  function playSuperCup(state) {
    ensureCompetitions(state);
    const previous = state.seasonHistory[0];
    const championId = previous?.championTeamId || FMG.sortStandings(state.standings)[0]?.teamId || state.teams[0].id;
    const cupChampionId = state.competitions.nationalCup?.championTeamId || state.teams.find((team) => team.id !== championId)?.id;
    if (!championId || !cupChampionId || championId === cupChampionId) return null;
    const match = knockoutWinner(state, championId, cupChampionId, "Supercopa", "Final");
    state.competitions.superCup = { seasonNumber: state.seasonNumber, match, championTeamId: match.winnerTeamId, championName: match.winnerName };
    if (match.winnerTeamId === state.userTeamId) awardPrize(state, "Premio Supercopa", 9000000);
    return state.competitions.superCup;
  }

  function createSeasonRecord(state) {
    const champion = state.champion || getChampion(state);
    const userStanding = state.standings.find((entry) => entry.teamId === state.userTeamId);
    return {
      seasonNumber: state.seasonNumber,
      championTeamId: champion ? champion.teamId : null,
      championName: champion ? champion.name : "Sin campeon",
      cupChampionName: state.competitions?.nationalCup?.championName || "Sin campeon",
      internationalChampionName: state.competitions?.international?.championName || "Sin campeon",
      userTeamId: state.userTeamId,
      userTeamName: state.userClub ? state.userClub.name : "Sin club",
      userPosition: state.standings.findIndex((entry) => entry.teamId === state.userTeamId) + 1,
      userPoints: userStanding ? userStanding.points : 0,
      completedAt: new Date().toISOString()
    };
  }

  function updateMarketWindow(state) {
    const openWeeks = state.currentWeek <= 3 || state.currentWeek >= Math.max(1, state.totalWeeks - 2) || state.seasonComplete;
    state.market.windowOpen = openWeeks;
  }

  function getCurrentFixture(state) {
    return state.fixtures.find((fixture) => !fixture.played && fixture.week === state.currentWeek) || getNextUnplayedFixture(state);
  }

  function prepareWeek(state, currentFixture) {
    state.currentWeek = currentFixture.week;
    FMG.tickPlayerAvailability(state);
    state.players.forEach((player) => {
      player.energy = FMG.clamp(player.energy + FMG.randomInt(4, 8), 0, 100);
    });
    FMG.runRivalAIWeek(state, { beforeMatches: true });
    state.teams.forEach((team) => FMG.autoSelectLineup(state, team.id));
  }

  function registerMatchIncidents(state, currentFixture, result) {
    [...(result.cards || []), ...(result.injuries || [])].forEach((incident) => {
      const isInjury = Boolean(incident.duration);
      state.eventsLog.unshift({
        week: currentFixture.week,
        title: isInjury ? "Lesion de partido" : incident.color === "red" ? "Tarjeta roja" : "Tarjeta amarilla",
        detail: isInjury
          ? `${incident.playerName} estara fuera ${incident.duration} semana(s).`
          : `${incident.playerName} recibe ${incident.color === "red" ? "roja y queda suspendido" : "amarilla"}.`
      });
    });
    state.eventsLog = state.eventsLog.slice(0, 12);
  }

  function finishFixture(state, currentFixture, results) {
    results.forEach((result) => {
      FMG.updateStandings(state.standings, result);
      FMG.applyMatchSquadStats(state, result);
      registerMatchIncidents(state, currentFixture, result);
      const homeTeam = state.teams.find((team) => team.id === result.homeTeamId);
      const awayTeam = state.teams.find((team) => team.id === result.awayTeamId);
      homeTeam.form = FMG.clamp(homeTeam.form + (result.homeGoals >= result.awayGoals ? 1 : -1), 0, 20);
      awayTeam.form = FMG.clamp(awayTeam.form + (result.awayGoals >= result.homeGoals ? 1 : -1), 0, 20);
    });

    currentFixture.played = true;
    state.lastResults = results;
    state.standings = FMG.sortStandings(state.standings);
    const userMatch = results.find((result) => result.homeTeamId === state.userTeamId || result.awayTeamId === state.userTeamId) || null;
    if (userMatch) state.currentMatch = userMatch;

    const event = FMG.applyWeeklyEvent(state);
    const financeReport = FMG.processWeeklyFinances(state);
    FMG.generateIncomingOffers(state);
    FMG.runRivalAIWeek(state, { afterMatches: true });
    state.teams.forEach((team) => FMG.autoSelectLineup(state, team.id));

    state.seasonLog.unshift({ week: state.currentWeek, headline: FMG.financeHeadline(financeReport), event });
    state.seasonLog = state.seasonLog.slice(0, 10);
    state.completedWeeks = state.fixtures.filter((fixture) => fixture.played).length;
    FMG.updateSquadHappiness(state);
    updateCompetitionRankings(state);

    const nextFixture = getNextUnplayedFixture(state);
    if (nextFixture) {
      state.currentWeek = nextFixture.week;
    } else {
      state.seasonComplete = true;
      state.champion = getChampion(state);
      completeSeasonCompetitions(state);
      state.seasonHistory.unshift(createSeasonRecord(state));
      state.seasonHistory = state.seasonHistory.slice(0, 8);
    }
    updateMarketWindow(state);

    const nextOpponent = FMG.getNextOpponent();
    const message = state.seasonComplete
      ? `La temporada ha terminado. Campeon: ${state.champion.name}.`
      : userMatch
        ? `Semana completada. Proximo rival: ${nextOpponent ? nextOpponent.name : "descanso"}.`
        : `Semana de descanso completada. Proximo rival: ${nextOpponent ? nextOpponent.name : "por definir"}.`;
    FMG.pushNotification(message);
    return { ok: true, message: "Fecha simulada correctamente." };
  }

  function reviveState(state) {
    const revived = FMG.deepClone(state);
    revived.version = Math.max(revived.version || 1, 8);
    revived.route = revived.route || FMG.ROUTES.dashboard;
    revived.notifications = revived.notifications || [];
    revived.market = revived.market || { listings: [], refreshCost: 2500000, windowOpen: true };
    revived.market.negotiations = revived.market.negotiations || [];
    revived.market.incomingOffers = revived.market.incomingOffers || [];
    revived.market.transferHistory = revived.market.transferHistory || [];
    revived.market.windowOpen = revived.market.windowOpen !== false;
    revived.finances = revived.finances || { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] };
    revived.eventsLog = revived.eventsLog || [];
    revived.lastResults = revived.lastResults || [];
    revived.seasonLog = revived.seasonLog || [];
    revived.seasonNumber = revived.seasonNumber || 1;
    revived.seasonHistory = revived.seasonHistory || [];
    revived.completedWeeks = revived.fixtures ? revived.fixtures.filter((fixture) => fixture.played).length : 0;
    revived.seasonComplete = revived.seasonComplete || (revived.fixtures && revived.fixtures.every((fixture) => fixture.played));
    revived.champion = revived.champion || (revived.seasonComplete ? getChampion(revived) : null);
    revived.liveMatch = revived.liveMatch || null;
    revived.squadView = revived.squadView || { selectedPlayerId: null, filter: "all", sort: "overall" };
    revived.rivalAI = revived.rivalAI || { log: [], budgets: {}, profiles: {} };
    ensureCompetitions(revived);
    revived.selectionMode = !revived.userTeamId;
    revived.userClub = revived.teams.find((team) => team.id === revived.userTeamId) || null;
    FMG.preparePlayersForSeason(revived.players);
    FMG.initializeTeamPlans(revived);
    FMG.initializeRivalAI(revived);
    updateMarketWindow(revived);
    return revived;
  }

  FMG.initializeGame = function (teams, players) {
    FMG.validateSeedData(teams, players);
    const fixtures = buildSeasonFixtures(teams);
    const seasonPlayers = ensureSquadDepth(teams, players);
    FMG.preparePlayersForSeason(seasonPlayers);
    FMG.replaceGameState({
      version: 8,
      initialized: true,
      route: FMG.ROUTES.dashboard,
      selectionMode: true,
      teams: FMG.deepClone(teams),
      players: seasonPlayers,
      fixtures,
      currentWeek: 1,
      totalWeeks: fixtures.length,
      completedWeeks: 0,
      seasonComplete: false,
      champion: null,
      seasonNumber: 1,
      seasonHistory: [],
      userTeamId: null,
      userClub: null,
      currentMatch: null,
      liveMatch: null,
      lastResults: [],
      standings: FMG.createInitialStandings(teams),
      market: { listings: [], negotiations: [], incomingOffers: [], transferHistory: [], refreshCost: 2500000, windowOpen: true },
      tactics: { teamSettings: {}, trainingUsedWeek: 0 },
      squadView: { selectedPlayerId: null, filter: "all", sort: "overall" },
      rivalAI: { log: [], budgets: {}, profiles: {} },
      competitions: {
        nationalCup: null,
        superCup: null,
        international: null,
        rankings: { scorers: [], shooters: [], cards: [], keepers: [] },
        qualification: [],
        relegation: null,
        prizeLog: []
      },
      finances: { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] },
      eventsLog: [],
      notifications: [],
      seasonLog: []
    });
    FMG.initializeTeamPlans(FMG.gameState);
    FMG.initializeRivalAI(FMG.gameState);
    updateMarketWindow(FMG.gameState);
  };

  FMG.selectClub = function (teamId) {
    const team = FMG.gameState.teams.find((item) => item.id === teamId);
    if (!team) return;
    FMG.gameState.userTeamId = team.id;
    FMG.gameState.userClub = team;
    FMG.gameState.selectionMode = false;
    FMG.gameState.finances.balance = 0;
    FMG.registerFinanceEntry(FMG.gameState.finances, "income", "Capital inicial de temporada", team.budget);
    FMG.autoSelectLineup(FMG.gameState, team.id);
    FMG.buildTransferMarket(FMG.gameState);
    FMG.pushNotification(`Tomaste el control de ${team.name}.`);
  };

  FMG.advanceWeek = function () {
    const state = FMG.gameState;
    if (state.seasonComplete) return { ok: false, message: "La temporada ya termino." };
    if (state.liveMatch && !state.liveMatch.completed) return { ok: false, message: "Hay un partido en vivo pendiente." };

    const currentFixture = getCurrentFixture(state);
    if (!currentFixture) {
      state.seasonComplete = true;
      state.champion = getChampion(state);
      return { ok: false, message: "No quedan fechas por disputar." };
    }
    prepareWeek(state, currentFixture);

    const results = currentFixture.matches.map((match) => {
      const homeTeam = state.teams.find((team) => team.id === match.homeTeamId);
      const awayTeam = state.teams.find((team) => team.id === match.awayTeamId);
      const result = FMG.simulateMatch({ homeTeam, awayTeam, players: state.players, state });
      result.week = currentFixture.week;
      return result;
    });
    return finishFixture(state, currentFixture, results);
  };

  FMG.startLiveUserMatch = function () {
    const state = FMG.gameState;
    if (state.seasonComplete) return { ok: false, message: "La temporada ya termino." };
    if (state.liveMatch && !state.liveMatch.completed) return { ok: false, message: "Ya hay un partido en vivo." };

    const currentFixture = getCurrentFixture(state);
    if (!currentFixture) return { ok: false, message: "No quedan fechas por disputar." };
    const userMatch = currentFixture.matches.find((match) => match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId);
    if (!userMatch) return { ok: false, message: "Tu club descansa esta semana." };

    prepareWeek(state, currentFixture);
    const homeTeam = state.teams.find((team) => team.id === userMatch.homeTeamId);
    const awayTeam = state.teams.find((team) => team.id === userMatch.awayTeamId);
    const otherMatches = currentFixture.matches.filter((match) => match !== userMatch);
    state.liveMatch = FMG.createLiveMatch({ homeTeam, awayTeam, state, week: currentFixture.week, otherMatches });
    state.route = FMG.ROUTES.matches;
    FMG.pushNotification(`Partido en vivo iniciado: ${homeTeam.name} vs ${awayTeam.name}.`);
    return { ok: true, message: "Partido en vivo iniciado." };
  };

  FMG.finishLiveUserMatch = function () {
    const state = FMG.gameState;
    const liveMatch = state.liveMatch;
    if (!liveMatch) return { ok: false, message: "No hay partido en vivo." };
    if (!liveMatch.completed) return { ok: false, message: "El partido todavia no termina." };

    const currentFixture = state.fixtures.find((fixture) => !fixture.played && fixture.week === liveMatch.week);
    if (!currentFixture) return { ok: false, message: "La fecha ya fue cerrada." };
    const results = liveMatch.otherMatches.map((match) => {
      const homeTeam = state.teams.find((team) => team.id === match.homeTeamId);
      const awayTeam = state.teams.find((team) => team.id === match.awayTeamId);
      const result = FMG.simulateMatch({ homeTeam, awayTeam, players: state.players, state });
      result.week = currentFixture.week;
      return result;
    });
    liveMatch.result.week = currentFixture.week;
    results.push(liveMatch.result);
    state.liveMatch = null;
    return finishFixture(state, currentFixture, results);
  };

  FMG.advanceLiveUserMatch = function (minutes) {
    const result = FMG.advanceLiveMatch(FMG.gameState, minutes);
    if (result.ok && FMG.gameState.liveMatch && FMG.gameState.liveMatch.completed) {
      FMG.pushNotification("Final del partido. Cierra la fecha para procesar tabla y finanzas.");
    }
    return result;
  };

  FMG.setLiveMatchSpeed = function (speed) {
    const liveMatch = FMG.gameState.liveMatch;
    if (!liveMatch) return { ok: false, message: "No hay partido en vivo." };
    liveMatch.speed = FMG.clamp(Number(speed) || 5, 1, 30);
    return { ok: true, message: `Velocidad fijada en ${liveMatch.speed} minutos.` };
  };

  FMG.applyLiveTacticalShift = function (mode) {
    const liveMatch = FMG.gameState.liveMatch;
    if (!liveMatch || liveMatch.completed) return { ok: false, message: "No hay partido en vivo activo." };
    const userSide = liveMatch.homeTeamId === FMG.gameState.userTeamId ? "home" : "away";
    const value = mode === "attack" ? 4 : mode === "defend" ? -3 : 0;
    liveMatch.tacticalBoost[userSide] = value;
    return { ok: true, message: mode === "attack" ? "El equipo adelanta lineas." : mode === "defend" ? "El equipo protege mejor su area." : "El equipo vuelve al plan equilibrado." };
  };

  FMG.makeLiveSubstitution = function (outPlayerId, inPlayerId) {
    const state = FMG.gameState;
    const liveMatch = state.liveMatch;
    if (!liveMatch || liveMatch.completed) return { ok: false, message: "No hay partido en vivo activo." };
    const userSide = liveMatch.homeTeamId === state.userTeamId ? "home" : "away";
    const lineupKey = userSide === "home" ? "homeLineupIds" : "awayLineupIds";
    const benchKey = userSide === "home" ? "homeBenchIds" : "awayBenchIds";
    if (liveMatch.substitutions[userSide] >= 5) return { ok: false, message: "Ya usaste los cinco cambios." };
    if (!liveMatch[lineupKey].includes(outPlayerId) || !liveMatch[benchKey].includes(inPlayerId)) {
      return { ok: false, message: "Cambio no disponible." };
    }

    liveMatch[lineupKey] = liveMatch[lineupKey].map((id) => id === outPlayerId ? inPlayerId : id);
    liveMatch[benchKey] = liveMatch[benchKey].map((id) => id === inPlayerId ? outPlayerId : id);
    liveMatch.substitutions[userSide] += 1;
    const incoming = state.players.find((player) => player.id === inPlayerId);
    const outgoing = state.players.find((player) => player.id === outPlayerId);
    if (incoming) incoming.energy = FMG.clamp(incoming.energy + 8, 0, 100);
    return { ok: true, message: `${incoming ? incoming.name : "Jugador"} entra por ${outgoing ? outgoing.name : "un titular"}.` };
  };

  FMG.startNewSeason = function () {
    const state = FMG.gameState;
    if (!state.seasonComplete) return { ok: false, message: "Debes terminar la temporada actual antes de iniciar otra." };
    const fixtures = buildSeasonFixtures(state.teams);
    state.seasonNumber += 1;
    state.fixtures = fixtures;
    state.currentWeek = 1;
    state.totalWeeks = fixtures.length;
    state.completedWeeks = 0;
    state.seasonComplete = false;
    state.champion = null;
    state.currentMatch = null;
    state.liveMatch = null;
    state.lastResults = [];
    state.standings = FMG.createInitialStandings(state.teams);
    state.seasonLog = [];
    state.eventsLog = [];
    state.tactics.trainingUsedWeek = 0;
    ensureCompetitions(state);
    state.teams.forEach((team) => {
      team.form = FMG.clamp(9 + FMG.randomInt(0, 5), 0, 20);
    });
    state.players.forEach((player) => {
      if (player.retired) return;
      player.age += 1;
      player.contractYears = Math.max(0, (player.contractYears || 1) - 1);
      player.energy = FMG.clamp(84 + FMG.randomInt(0, 12), 0, 100);
      player.morale = FMG.clamp(66 + FMG.randomInt(0, 18), 0, 100);
    });
    FMG.progressPlayersForNewSeason(state);
    FMG.preparePlayersForSeason(state.players, { newSeason: true });
    FMG.initializeTeamPlans(state);
    FMG.initializeRivalAI(state);
    updateMarketWindow(state);
    FMG.buildTransferMarket(state);
    playSuperCup(state);
    FMG.pushNotification(`Temporada ${state.seasonNumber} iniciada.`);
    return { ok: true, message: "Nueva temporada iniciada." };
  };

  FMG.getNextOpponent = function () {
    const state = FMG.gameState;
    const upcoming = state.fixtures
      .filter((fixture) => !fixture.played)
      .sort((left, right) => left.week - right.week)
      .find((fixture) => fixture.matches.some((item) => item.homeTeamId === state.userTeamId || item.awayTeamId === state.userTeamId));
    if (!upcoming) return null;
    const match = upcoming.matches.find((item) => item.homeTeamId === state.userTeamId || item.awayTeamId === state.userTeamId);
    const opponentId = match.homeTeamId === state.userTeamId ? match.awayTeamId : match.homeTeamId;
    const opponent = state.teams.find((team) => team.id === opponentId) || null;
    return opponent ? { ...opponent, week: upcoming.week } : null;
  };

  FMG.getUpcomingFixture = function () {
    const state = FMG.gameState;
    const nextFixture = state.fixtures.find((fixture) => !fixture.played && fixture.week === state.currentWeek) || getNextUnplayedFixture(state);
    if (!nextFixture) return null;
    return nextFixture.matches.map((match) => ({
      ...match,
      homeTeam: state.teams.find((team) => team.id === match.homeTeamId),
      awayTeam: state.teams.find((team) => team.id === match.awayTeamId)
    }));
  };

  FMG.pushNotification = function (message) {
    FMG.gameState.notifications.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message });
    FMG.gameState.notifications = FMG.gameState.notifications.slice(-3);
  };

  FMG.dismissNotification = function (id) {
    FMG.gameState.notifications = FMG.gameState.notifications.filter((item) => item.id !== id);
  };

  FMG.saveGame = function () {
    try {
      localStorage.setItem(FMG.STORAGE_KEY, JSON.stringify(FMG.gameState));
      FMG.pushNotification("Partida guardada en el navegador.");
      return { ok: true, message: "Partida guardada." };
    } catch (error) {
      return { ok: false, message: "No se pudo guardar la partida." };
    }
  };

  FMG.loadGame = function () {
    try {
      const raw = localStorage.getItem(FMG.STORAGE_KEY);
      if (!raw) return { ok: false, message: "No hay una partida guardada disponible." };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.teams) || !Array.isArray(parsed.players) || !Array.isArray(parsed.fixtures)) {
        return { ok: false, message: "La partida guardada no es compatible." };
      }
      FMG.replaceGameState(reviveState(parsed));
      FMG.pushNotification("Partida cargada correctamente.");
      return { ok: true, message: "Partida cargada." };
    } catch (error) {
      return { ok: false, message: "La partida guardada esta danada." };
    }
  };
})();
