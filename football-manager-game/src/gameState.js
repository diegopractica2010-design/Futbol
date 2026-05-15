(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.ROUTES = {
    dashboard: "dashboard", squad: "squad", matches: "matches", market: "market",
    finances: "finances", career: "career", news: "news", player: "player",
    rival: "rival", calendar: "calendar", settings: "settings", table: "table",
    onboarding: "onboarding", credits: "credits",
    phase15: "phase15", phase16: "phase16", phase17: "phase17",
    phase18: "phase18", phase19: "phase19", phase20: "phase20", phase21: "phase21",
    phase22: "phase22", phase23: "phase23", phase24: "phase24"
  };

  FMG.gameState = {
    version: 13, initialized: false, route: FMG.ROUTES.dashboard, selectionMode: true,
    teams: [], players: [], fixtures: [], currentWeek: 1, totalWeeks: 0,
    seed: Math.floor(Math.random() * 0xffffffff), // Add seed for determinism
    completedWeeks: 0, seasonComplete: false, champion: null, seasonNumber: 1,
    seasonHistory: [], userTeamId: null, userClub: null, currentMatch: null,
    liveMatch: null, lastResults: [], standings: [],
    market: { listings: [], negotiations: [], incomingOffers: [], transferHistory: [], refreshCost: 2500000, windowOpen: true },
    tactics: { teamSettings: {}, trainingUsedWeek: 0 },
    squadView: { selectedPlayerId: null, filter: "all", sort: "overall" },
    rivalAI: { log: [], budgets: {}, profiles: {} },
    competitions: {
      nationalCup: null, superCup: null, international: null,
      rankings: { scorers: [], shooters: [], cards: [], keepers: [] },
      qualification: [], relegation: null, prizeLog: []
    },
    finances: {
      balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [],
      budgets: { transfers: 0, wages: 0, infrastructure: 0, operations: 0 },
      debt: 0, loans: [], sponsorDeal: null, tvDeal: null,
      infrastructure: { stadium: 1, training: 1, medical: 1 },
      staff: { coaching: 1, scouting: 1, medical: 1 }, boardTrust: 65,
      financialFairPlay: { wageLimit: 0, status: "ok", warnings: [] }, crisis: null
    },
    managerProfile: { name: "Manager Local", nationality: "Chile", age: 36, style: "balanced" },
    career: {
      status: "employed", reputation: 45, history: [], objectives: [], offers: [],
      achievements: [], trophies: [], decisions: [], narrativeLog: [],
      relations: { fans: 60, players: 60, press: 55 },
      record: { wins: 0, draws: 0, losses: 0 },
      spendingThisSeason: 0, transferProfitThisSeason: 0, developedPlayersThisSeason: 0,
      currentClubStartedSeason: 1, lastEvaluation: null, sackingHistory: []
    },
    worldNews: { items: [], rivalries: [], streaks: {}, pressQuestions: [], weeklyEvents: [], filter: "all" },
    ui: { selectedRivalId: null, tableSort: "points", tableFilter: "all", calendarFilter: "all", reducedMotion: false },
    settings: {
      difficulty: "normal", simulationSpeed: 5,
      autosave: { enabled: true, slotId: "autosave", intervalWeeks: 1 },
      seasonOptions: { format: "full", marketWindows: "standard", financialPressure: "normal" }
    },
    saveMeta: { activeSlotId: "slot-1", lastSavedAt: null, lastLoadedAt: null, autosaveWeek: 0 },
    systemErrors: [], eventsLog: [], notifications: [], seasonLog: []
  };

  FMG.replaceGameState = function (nextState) {
    if (FMG.ensureSeparatedState) FMG.ensureSeparatedState(nextState);
    Object.keys(FMG.gameState).forEach((key) => { delete FMG.gameState[key]; });
    Object.assign(FMG.gameState, nextState);
    if (FMG.syncLegacyStateFacets) FMG.syncLegacyStateFacets(FMG.gameState);
  };
})();
