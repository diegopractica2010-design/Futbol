(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.ROUTES = {
    dashboard: "dashboard",
    squad: "squad",
    matches: "matches",
    market: "market",
    finances: "finances",
    table: "table"
  };

  FMG.gameState = {
    version: 4,
    initialized: false,
    route: FMG.ROUTES.dashboard,
    selectionMode: true,
    teams: [],
    players: [],
    fixtures: [],
    currentWeek: 1,
    totalWeeks: 0,
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
    standings: [],
    market: {
      listings: [],
      refreshCost: 2500000,
      windowOpen: true
    },
    tactics: {
      teamSettings: {},
      trainingUsedWeek: 0
    },
    finances: {
      balance: 0,
      incomeHistory: [],
      expenseHistory: [],
      weeklyReport: []
    },
    eventsLog: [],
    notifications: [],
    seasonLog: []
  };

  FMG.replaceGameState = function (nextState) {
    Object.keys(FMG.gameState).forEach((key) => {
      delete FMG.gameState[key];
    });
    Object.assign(FMG.gameState, nextState);
  };
})();
