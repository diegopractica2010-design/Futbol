(function () {
  const FMG = (window.FMG = window.FMG || {});

  const fallbackNames = [
    "Matias Navarro", "Felipe Bustos", "Rodrigo Parraguez", "Diego Loyola", "Cristian Caceres",
    "Martin Sepulveda", "Javier Astudillo", "Bruno Troncoso", "Matias Concha", "Carlos Inostroza",
    "Vicente Alarcon", "Bastian Retamal", "Sebastian Alveal", "Nicolas Chandia", "Franco Cifuentes"
  ];

  const expansionTeams = [
    { id: "nublense", name: "Nublense", city: "Chillan", stadium: "Nelson Oyarzun", style: "Presion", budget: 76000000, fanBase: 240000, sponsor: 28000000, infrastructureCost: 7600000, form: 9 },
    { id: "la-serena", name: "Deportes La Serena", city: "La Serena", stadium: "La Portada", style: "Vertical", budget: 74000000, fanBase: 220000, sponsor: 26000000, infrastructureCost: 7300000, form: 8 },
    { id: "cobresal", name: "Cobresal", city: "El Salvador", stadium: "El Cobre", style: "Posesion", budget: 82000000, fanBase: 210000, sponsor: 30000000, infrastructureCost: 8000000, form: 10 },
    { id: "ohiggins", name: "O'Higgins", city: "Rancagua", stadium: "El Teniente", style: "Presion", budget: 86000000, fanBase: 310000, sponsor: 34000000, infrastructureCost: 8500000, form: 10 },
    { id: "everton", name: "Everton", city: "Vina del Mar", stadium: "Sausalito", style: "Posesion", budget: 90000000, fanBase: 330000, sponsor: 36000000, infrastructureCost: 8900000, form: 11 },
    { id: "deportes-antofagasta", name: "Deportes Antofagasta", city: "Antofagasta", stadium: "Calvo y Bascunan", style: "Vertical", budget: 78000000, fanBase: 230000, sponsor: 27000000, infrastructureCost: 7600000, form: 8 }
  ];

  function ensureTeamDepth(teams) {
    const ids = new Set(teams.map((team) => team.id));
    return [...teams.map(FMG.cloneTeam), ...expansionTeams.filter((team) => !ids.has(team.id)).map(FMG.cloneTeam)];
  }

  function ensureSquadDepth(teams, players) {
    const enrichedPlayers = players.map(FMG.clonePlayer);
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

    while (typeof document !== "undefined" && enrichedPlayers.filter((player) => player.teamId === "free-agent").length < 20) {
      const index = enrichedPlayers.filter((player) => player.teamId === "free-agent").length;
      enrichedPlayers.push({
        id: `free-agent-${index + 1}`,
        name: `${fallbackNames[index % fallbackNames.length]} Libre`,
        teamId: "free-agent",
        position: positions[index % positions.length],
        age: 20 + (index % 14),
        overall: 62 + (index % 12),
        morale: 68,
        energy: 88,
        value: 1800000 + index * 320000,
        salary: 260000 + index * 24000,
        contractYears: 0
      });
    }

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
        const first = rotating[index];
        const second = rotating[rotating.length - 1 - index];
        if (!first || !second) continue;
        const flip = (round + index) % 2 === 1;
        matches.push(flip ? { homeTeamId: second, awayTeamId: first } : { homeTeamId: first, awayTeamId: second });
      }
      rounds.push(matches);
      rotating = [rotating[0], rotating[rotating.length - 1], ...rotating.slice(1, rotating.length - 1)];
    }

    return rounds;
  }

  function buildSeasonFixtures(teams, seasonOptions = {}) {
    const firstLeg = createRoundRobin(teams.map((team) => team.id));
    if (seasonOptions.format === "short") return firstLeg.map((matches, index) => ({ week: index + 1, played: false, matches }));
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
    let cupChampionId = state.competitions.nationalCup?.championTeamId || state.teams.find((team) => team.id !== championId)?.id;
    if (cupChampionId === championId) {
      cupChampionId = state.competitions.qualification?.find((entry) => entry.teamId !== championId)?.teamId || state.teams.find((team) => team.id !== championId)?.id;
    }
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
    const generous = state.settings?.seasonOptions?.marketWindows === "generous";
    const openWeeks = generous || state.currentWeek <= 3 || state.currentWeek >= Math.max(1, state.totalWeeks - 2) || state.seasonComplete;
    state.market.windowOpen = openWeeks;
  }

  function getCurrentFixture(state) {
    return state.fixtures.find((fixture) => !fixture.played && fixture.week === state.currentWeek) || getNextUnplayedFixture(state);
  }

  function prepareWeek(state, currentFixture) {
    state.currentWeek = currentFixture.week;
    if (FMG.generateFixturePreviews) FMG.generateFixturePreviews(state, currentFixture);
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
    if (userMatch) FMG.recordCareerMatchImpact(state, userMatch);
    if (FMG.generatePostMatchNews) results.forEach((result) => FMG.generatePostMatchNews(state, result));

    const event = FMG.applyWeeklyEvent(state);
    const financeReport = FMG.processWeeklyFinances(state);
    FMG.applyInfrastructureEffects(state);
    FMG.generateIncomingOffers(state);
    FMG.runRivalAIWeek(state, { afterMatches: true });
    if (FMG.simulationScheduler) FMG.simulationScheduler.runDue(state, { phase: "post-week" });
    state.teams.forEach((team) => FMG.autoSelectLineup(state, team.id));

    const userResultLabel = userMatch
      ? (userMatch.homeTeamId === state.userTeamId
        ? userMatch.homeGoals > userMatch.awayGoals ? "victoria" : userMatch.homeGoals < userMatch.awayGoals ? "derrota" : "empate"
        : userMatch.awayGoals > userMatch.homeGoals ? "victoria" : userMatch.awayGoals < userMatch.homeGoals ? "derrota" : "empate")
      : null;
    state.seasonLog.unshift({ week: state.currentWeek, headline: FMG.financeHeadline(financeReport), event, result: userResultLabel });
    state.seasonLog = state.seasonLog.slice(0, 10);
    state.completedWeeks = state.fixtures.filter((fixture) => fixture.played).length;
    FMG.updateSquadHappiness(state);
    updateCompetitionRankings(state);
    if (FMG.generateContextualWeeklyNews) FMG.generateContextualWeeklyNews(state, event);

    const nextFixture = getNextUnplayedFixture(state);
    if (nextFixture) {
      state.currentWeek = nextFixture.week;
    } else {
      state.seasonComplete = true;
      state.champion = getChampion(state);
      completeSeasonCompetitions(state);
      const seasonRecord = createSeasonRecord(state);
      state.seasonHistory.unshift(seasonRecord);
      state.seasonHistory = state.seasonHistory.slice(0, 8);
      FMG.evaluateCareerSeasonEnd(state, seasonRecord);
    }
    updateMarketWindow(state);

    const nextOpponent = FMG.getNextOpponent();
    const message = state.seasonComplete
      ? `La temporada ha terminado. Campeon: ${state.champion.name}.`
      : userMatch
        ? `Semana completada. Proximo rival: ${nextOpponent ? nextOpponent.name : "descanso"}.`
        : `Semana de descanso completada. Proximo rival: ${nextOpponent ? nextOpponent.name : "por definir"}.`;
    FMG.pushNotification(message);
    const lastUserResults = state.seasonLog.filter((entry) => entry.result).slice(0, 5);
    if (lastUserResults.length >= 4 && lastUserResults.filter((entry) => entry.result === "derrota").length >= 4) {
      FMG.updateBoardTrust(state, "Crisis deportiva", -15);
      FMG.pushNotification("El directorio convoca reunion de urgencia tras la racha negativa.", "warning");
      if (FMG.generateCareerDecision) FMG.generateCareerDecision(state, "board-crisis");
    }
    if (state.completedWeeks > 0 && state.completedWeeks % 5 === 0) {
      FMG.pushNotification("Recuerda exportar tu partida para no perder tu progreso.", "info");
    }
    if (FMG.emitGameEvent) {
      FMG.emitGameEvent(FMG.EventTypes.MATCH_ENDED, {
        source: "simulation",
        week: currentFixture.week,
        results: results.map((result) => ({
          homeTeamId: result.homeTeamId,
          awayTeamId: result.awayTeamId,
          homeGoals: result.homeGoals,
          awayGoals: result.awayGoals
        }))
      });
    }
    return { ok: true, message: "Fecha simulada correctamente." };
  }

  function reviveState(state) {
    const revived = FMG.deepClone(state);
    revived.version = FMG.CURRENT_VERSION;
    revived.route = revived.route || FMG.ROUTES.dashboard;
    revived.notifications = revived.notifications || [];
    revived.notificationLog = revived.notificationLog || [];
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
    FMG.ensureAdvancedFinances(revived);
    FMG.ensureCareerState(revived);
    FMG.ensureWorldNews(revived);
    FMG.ensureUIState(revived);
    FMG.ensureSettingsState(revived);
    if (revived.userTeamId && !revived.career.objectives.length) FMG.createBoardObjectives(revived);
    FMG.preparePlayersForSeason(revived.players);
    FMG.initializeTeamPlans(revived);
    FMG.initializeRivalAI(revived);
    updateMarketWindow(revived);
    if (FMG.ensureSeparatedState) FMG.ensureSeparatedState(revived);
    return revived;
  }

  FMG.initializeGame = function (teams, players) {
    FMG.validateSeedData(teams, players);
    const expandedTeams = typeof document !== "undefined" ? ensureTeamDepth(teams) : teams.map(FMG.cloneTeam);
    const fixtures = buildSeasonFixtures(expandedTeams);
    const seasonPlayers = ensureSquadDepth(expandedTeams, players);
    FMG.preparePlayersForSeason(seasonPlayers);
    FMG.replaceGameState({
      version: FMG.CURRENT_VERSION,
      initialized: true,
      route: FMG.ROUTES.dashboard,
      selectionMode: true,
      teams: expandedTeams,
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
      standings: FMG.createInitialStandings(expandedTeams),
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
      managerProfile: { name: "Manager Local", nationality: "Chile", age: 36, style: "balanced" },
      career: {
        status: "unemployed",
        reputation: 45,
        history: [],
        objectives: [],
        offers: [],
        achievements: [],
        trophies: [],
        decisions: [],
        narrativeLog: [],
        relations: { fans: 60, players: 60, press: 55 },
        record: { wins: 0, draws: 0, losses: 0 },
        spendingThisSeason: 0,
        transferProfitThisSeason: 0,
        developedPlayersThisSeason: 0,
        currentClubStartedSeason: 1,
        lastEvaluation: null,
        sackingHistory: []
      },
      worldNews: { items: [], rivalries: [], streaks: {}, pressQuestions: [], weeklyEvents: [], filter: "all" },
      ui: { selectedRivalId: null, tableSort: "points", tableFilter: "all", calendarFilter: "all", reducedMotion: false },
      settings: FMG.deepClone(FMG.defaultGameSettings),
      saveMeta: { activeSlotId: "slot-1", lastSavedAt: null, lastLoadedAt: null, autosaveWeek: 0 },
      systemErrors: [],
      eventsLog: [],
      notifications: [],
      notificationLog: [],
      seasonLog: []
    });
    FMG.initializeTeamPlans(FMG.gameState);
    FMG.initializeRivalAI(FMG.gameState);
    FMG.ensureAdvancedFinances(FMG.gameState);
    FMG.ensureCareerState(FMG.gameState);
    FMG.ensureWorldNews(FMG.gameState);
    FMG.ensureUIState(FMG.gameState);
    FMG.ensureSettingsState(FMG.gameState);
    updateMarketWindow(FMG.gameState);
    if (FMG.ensureSeparatedState) FMG.ensureSeparatedState(FMG.gameState);
  };

  FMG.selectClub = function (teamId) {
    const team = FMG.gameState.teams.find((item) => item.id === teamId);
    if (!team) return;
    FMG.gameState.userTeamId = team.id;
    FMG.gameState.userClub = team;
    FMG.gameState.selectionMode = false;
    FMG.gameState.route = FMG.ROUTES.dashboard;
    FMG.gameState.career.status = "employed";
    FMG.gameState.career.currentClubStartedSeason = FMG.gameState.seasonNumber;
    FMG.gameState.finances.balance = 0;
    FMG.ensureAdvancedFinances(FMG.gameState);
    FMG.registerFinanceEntry(FMG.gameState.finances, "income", "Capital inicial de temporada", team.budget);
    FMG.createBoardObjectives(FMG.gameState);
    FMG.autoSelectLineup(FMG.gameState, team.id);
    FMG.buildTransferMarket(FMG.gameState);
    FMG.ensureUIState(FMG.gameState);
    FMG.generateMarketRumors(FMG.gameState);
    FMG.addNewsItem(FMG.gameState, {
      type: "career",
      title: `${team.name} presenta a ${FMG.gameState.managerProfile.name}`,
      body: `${FMG.gameState.managerProfile.name} toma el mando de ${team.name} con presupuesto ${FMG.currency(team.budget)}, hinchada base de ${team.fanBase.toLocaleString("es-CL")} y estilo institucional ${team.style}.`,
      tags: ["carrera"],
      importance: 80,
      entities: { teamId: team.id },
      dedupeKey: `manager-start-${FMG.gameState.seasonNumber}-${team.id}`
    });
    FMG.pushNotification(`Tomaste el control de ${team.name}.`);
    if (FMG.emitGameEvent) {
      FMG.emitGameEvent(FMG.EventTypes.BOARD_OBJECTIVE_UPDATED, {
        teamId: team.id,
        objectives: FMG.gameState.career.objectives
      });
    }
    FMG.autosaveIfNeeded(FMG.gameState, "select-club");
  };

  FMG.advanceWeek = function () {
    const state = FMG.gameState;
    if (state.career?.status === "sacked") return { ok: false, message: "Fuiste despedido. Acepta una oferta para continuar la carrera." };
    if (state.seasonComplete) return { ok: false, message: "La temporada ya termino." };
    if (state.liveMatch && !state.liveMatch.completed) return { ok: false, message: "Hay un partido en vivo pendiente." };

    // MIGRATION: Route through FMG.Core if initialized
    if (FMG.Core && FMG.Core.isInitialized && FMG.Core.isInitialized()) {
      console.log("[advanceWeek] Routing through FMG.Core");
      try {
        const weekSeed = FMG.deriveSeed(
          state._startSeed || FMG.gameState.season?.startSeed || 12345,
          state.currentWeek,
          Math.floor(Math.random() * 1000)
        );
        const coreResult = FMG.Core.advanceWeekFromLegacy(weekSeed);
        console.log("[advanceWeek] Core execution: " + coreResult.executionMs + "ms");
        FMG.autosaveIfNeeded(FMG.gameState, "advance-week");
        return { ok: true, message: "Semana completada.", coreResult };
      } catch (err) {
        console.error("[advanceWeek] Core error, falling back to legacy:", err);
        // Fall through to legacy code below
      }
    }

    // LEGACY FALLBACK: Use old implementation if Core not available
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
    const finished = finishFixture(state, currentFixture, results);
    FMG.autosaveIfNeeded(state, "advance-week");
    return finished;
  };

  FMG.startLiveUserMatch = function () {
    const state = FMG.gameState;
    if (state.career?.status === "sacked") return { ok: false, message: "Fuiste despedido. Acepta una oferta para volver al banco." };
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
    if (state.matchState) {
      state.matchState.status = "live";
      state.matchState.homeTeamId = homeTeam.id;
      state.matchState.awayTeamId = awayTeam.id;
      state.matchState.week = currentFixture.week;
    }
    state.liveMatch.speed = state.settings?.simulationSpeed || state.liveMatch.speed;
    state.route = FMG.ROUTES.matches;
    FMG.pushNotification(`Partido en vivo iniciado: ${homeTeam.name} vs ${awayTeam.name}.`);
    if (FMG.emitGameEvent) {
      FMG.emitGameEvent(FMG.EventTypes.MATCH_STARTED, {
        source: "manager-live",
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        week: currentFixture.week
      });
    }
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
    if (state.matchState) state.matchState.status = "idle";
    const finished = finishFixture(state, currentFixture, results);
    FMG.autosaveIfNeeded(state, "finish-live-match");
    return finished;
  };

  FMG.advanceLiveUserMatch = function (minutes) {
    const beforeTimelineLength = FMG.gameState.liveMatch?.result?.timeline?.length || 0;
    const result = FMG.advanceLiveMatch(FMG.gameState, minutes);
    if (result.ok && FMG.gameState.liveMatch && FMG.matchVisualController?.visualizer) {
      FMG.matchVisualController._seenTimelineLength = beforeTimelineLength;
      FMG.matchVisualController.syncLiveMatch(FMG.gameState.liveMatch);
    }
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
    liveMatch.tacticalBoost = liveMatch.tacticalBoost || { home: 0, away: 0 };
    liveMatch.tacticalBoost[userSide] = value;
    liveMatch.tacticBoost = liveMatch.tacticBoost || { home: 0, away: 0, homeTurns: 0, awayTurns: 0 };
    liveMatch.tacticBoost[userSide] = value;
    liveMatch.tacticBoost[`${userSide}Turns`] = 3;
    const tacticMessages = {
      attack: "El equipo adelanta lineas. Mas riesgo, mas llegada.",
      defend: "Bloque bajo activado. El equipo cede posesion pero cierra espacios.",
      balanced: "El equipo recupera forma equilibrada."
    };
    liveMatch.result.timeline.push({
      minute: liveMatch.minute,
      type: "tactical",
      teamId: FMG.gameState.userTeamId,
      text: tacticMessages[mode] || tacticMessages.balanced
    });
    return { ok: true, message: mode === "attack" ? "El equipo adelanta lineas." : mode === "defend" ? "El equipo protege mejor su area." : "El equipo vuelve al plan equilibrado." };
  };

  FMG.setLiveTeamOrder = function (group, value) {
    const liveMatch = FMG.gameState.liveMatch;
    if (!liveMatch || liveMatch.completed) return { ok: false, message: "No hay partido en vivo activo." };
    const userSide = liveMatch.homeTeamId === FMG.gameState.userTeamId ? "home" : "away";
    liveMatch.liveOrders = liveMatch.liveOrders || {};
    liveMatch.liveOrders[userSide] = liveMatch.liveOrders[userSide] || { mentality: "balanced", press: "normal", tempo: "normal", risk: "normal" };
    const allowed = {
      mentality: ["attack", "balanced", "defend"],
      press: ["high", "normal", "low"],
      tempo: ["fast", "normal", "slow"],
      risk: ["direct", "normal", "safe"]
    };
    if (!allowed[group] || !allowed[group].includes(value)) return { ok: false, message: "Orden no disponible." };
    liveMatch.liveOrders[userSide][group] = value;
    const labels = { attack: "Atacar", balanced: "Equilibrar", defend: "Defender", high: "Presion alta", low: "Bloque bajo", normal: "Normal", fast: "Ritmo alto", slow: "Pausar", direct: "Directo", safe: "Seguro" };
    return { ok: true, message: `Orden aplicada: ${labels[value] || value}.` };
  };

  FMG.setLivePlayerOrder = function (playerId, order) {
    const liveMatch = FMG.gameState.liveMatch;
    if (!liveMatch || liveMatch.completed) return { ok: false, message: "No hay partido en vivo activo." };
    const userSide = liveMatch.homeTeamId === FMG.gameState.userTeamId ? "home" : "away";
    const lineup = userSide === "home" ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
    if (!lineup.includes(playerId)) return { ok: false, message: "Jugador no esta en cancha." };
    const allowed = ["normal", "shoot", "safe", "press", "free", "run"];
    if (!allowed.includes(order)) return { ok: false, message: "Orden individual no disponible." };
    liveMatch.playerOrders = liveMatch.playerOrders || {};
    liveMatch.playerOrders[playerId] = order;
    const player = FMG.gameState.players.find((item) => item.id === playerId);
    const labels = { normal: "normal", shoot: "rematar mas", safe: "jugar simple", press: "presionar", free: "libertad", run: "picar al espacio" };
    return { ok: true, message: `${player ? player.name : "Jugador"}: ${labels[order]}.` };
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
    if (state.career?.status === "sacked") return { ok: false, message: "Acepta una oferta antes de iniciar otra temporada." };
    if (!state.seasonComplete) return { ok: false, message: "Debes terminar la temporada actual antes de iniciar otra." };
    const fixtures = buildSeasonFixtures(state.teams, state.settings?.seasonOptions || {});
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
    FMG.prepareCareerNewSeason(state);
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
    FMG.ensureWorldNews(state);
    updateMarketWindow(state);
    FMG.buildTransferMarket(state);
    playSuperCup(state);
    FMG.pushNotification(`Temporada ${state.seasonNumber} iniciada.`);
    if (FMG.ensureSeparatedState) FMG.ensureSeparatedState(state);
    FMG.autosaveIfNeeded(state, "new-season");
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

  FMG.pushNotification = function (message, type = "info") {
    const notification = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message, type, createdAt: new Date().toISOString() };
    FMG.gameState.notifications = FMG.gameState.notifications || [];
    FMG.gameState.notificationLog = FMG.gameState.notificationLog || [];
    FMG.gameState.notifications.push(notification);
    FMG.gameState.notifications = FMG.gameState.notifications.slice(-3);
    FMG.gameState.notificationLog.unshift(notification);
    FMG.gameState.notificationLog = FMG.gameState.notificationLog.slice(0, 50);
  };

  FMG.dismissNotification = function (id) {
    FMG.gameState.notifications = FMG.gameState.notifications.filter((item) => item.id !== id);
  };

  FMG.migrateSaveState = reviveState;

  FMG.saveGame = function () {
    if (typeof document === "undefined") {
      const result = FMG.saveToSlot(FMG.gameState, FMG.gameState.saveMeta?.activeSlotId || "slot-1", { overwrite: true });
      if (result.ok) FMG.pushNotification("Partida guardada en el navegador.");
      return result;
    }
    console.warn("[FMG] FMG.saveGame() esta deprecado. Usa saveToSlot(n) desde Configuracion.");
    FMG.gameState.route = FMG.ROUTES.settings;
    return { ok: true, message: "Abre Configuracion para gestionar guardados." };
  };

  FMG.loadGame = function () {
    if (typeof document === "undefined") {
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
    }
    console.warn("[FMG] FMG.loadGame() esta deprecado. Usa el sistema de slots en Configuracion.");
    FMG.gameState.route = FMG.ROUTES.settings;
    FMG.render?.();
    return { ok: true, message: "Gestiona tus guardados desde Configuracion." };
  };
})();
