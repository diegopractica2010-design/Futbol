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

  function reviveState(state) {
    const revived = FMG.deepClone(state);
    revived.route = revived.route || FMG.ROUTES.dashboard;
    revived.notifications = revived.notifications || [];
    revived.market = revived.market || { listings: [], refreshCost: 2500000 };
    revived.finances = revived.finances || { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] };
    revived.eventsLog = revived.eventsLog || [];
    revived.lastResults = revived.lastResults || [];
    revived.seasonLog = revived.seasonLog || [];
    revived.selectionMode = !revived.userTeamId;
    return revived;
  }

  FMG.initializeGame = function (teams, players) {
    const fixtures = buildSeasonFixtures(teams);
    const seasonPlayers = ensureSquadDepth(teams, players);
    FMG.replaceGameState({
      initialized: true,
      route: FMG.ROUTES.dashboard,
      selectionMode: true,
      teams: FMG.deepClone(teams),
      players: seasonPlayers,
      fixtures,
      currentWeek: 1,
      totalWeeks: fixtures.length,
      userTeamId: null,
      userClub: null,
      currentMatch: null,
      lastResults: [],
      standings: FMG.createInitialStandings(teams),
      market: { listings: [], refreshCost: 2500000 },
      finances: { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] },
      eventsLog: [],
      notifications: [],
      seasonLog: []
    });
  };

  FMG.selectClub = function (teamId) {
    const team = FMG.gameState.teams.find((item) => item.id === teamId);
    if (!team) return;
    FMG.gameState.userTeamId = team.id;
    FMG.gameState.userClub = team;
    FMG.gameState.selectionMode = false;
    FMG.gameState.finances.balance = 0;
    FMG.registerFinanceEntry(FMG.gameState.finances, "income", "Capital inicial de temporada", team.budget);
    FMG.buildTransferMarket(FMG.gameState);
    FMG.pushNotification(`Tomaste el control de ${team.name}.`);
  };

  FMG.advanceWeek = function () {
    const state = FMG.gameState;
    const currentFixture = state.fixtures.find((fixture) => fixture.week === state.currentWeek);
    if (!currentFixture || currentFixture.played) return { ok: false, message: "No quedan fechas por disputar." };

    const results = currentFixture.matches.map((match) => {
      const homeTeam = state.teams.find((team) => team.id === match.homeTeamId);
      const awayTeam = state.teams.find((team) => team.id === match.awayTeamId);
      const result = FMG.simulateMatch({ homeTeam, awayTeam, players: state.players });
      FMG.updateStandings(state.standings, result);
      homeTeam.form = FMG.clamp(homeTeam.form + (result.homeGoals >= result.awayGoals ? 1 : -1), 0, 20);
      awayTeam.form = FMG.clamp(awayTeam.form + (result.awayGoals >= result.homeGoals ? 1 : -1), 0, 20);
      return result;
    });

    currentFixture.played = true;
    state.lastResults = results;
    state.standings = FMG.sortStandings(state.standings);
    state.currentMatch = results.find((result) => result.homeTeamId === state.userTeamId || result.awayTeamId === state.userTeamId) || null;

    const event = FMG.applyWeeklyEvent(state);
    const financeReport = FMG.processWeeklyFinances(state);
    state.players.filter((player) => player.teamId === state.userTeamId).forEach((player) => {
      player.energy = FMG.clamp(player.energy + FMG.randomInt(4, 8), 0, 100);
    });

    state.seasonLog.unshift({ week: state.currentWeek, headline: FMG.financeHeadline(financeReport), event });
    state.seasonLog = state.seasonLog.slice(0, 10);

    if (state.currentWeek < state.totalWeeks) state.currentWeek += 1;
    const nextOpponent = FMG.getNextOpponent();
    FMG.pushNotification(nextOpponent ? `Semana completada. Proximo rival: ${nextOpponent.name}.` : "La temporada ha terminado.");
    return { ok: true, message: "Fecha simulada correctamente." };
  };

  FMG.getNextOpponent = function () {
    const state = FMG.gameState;
    const upcoming = state.fixtures.find((fixture) => !fixture.played && fixture.week === state.currentWeek);
    if (!upcoming) return null;
    const match = upcoming.matches.find((item) => item.homeTeamId === state.userTeamId || item.awayTeamId === state.userTeamId);
    if (!match) return null;
    const opponentId = match.homeTeamId === state.userTeamId ? match.awayTeamId : match.homeTeamId;
    return state.teams.find((team) => team.id === opponentId) || null;
  };

  FMG.getUpcomingFixture = function () {
    const state = FMG.gameState;
    const nextFixture = state.fixtures.find((fixture) => !fixture.played && fixture.week === state.currentWeek);
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
    localStorage.setItem(FMG.STORAGE_KEY, JSON.stringify(FMG.gameState));
    FMG.pushNotification("Partida guardada en el navegador.");
  };

  FMG.loadGame = function () {
    const raw = localStorage.getItem(FMG.STORAGE_KEY);
    if (!raw) return { ok: false, message: "No hay una partida guardada disponible." };
    FMG.replaceGameState(reviveState(JSON.parse(raw)));
    FMG.pushNotification("Partida cargada correctamente.");
    return { ok: true, message: "Partida cargada." };
  };
})();
