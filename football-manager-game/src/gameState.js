export const ROUTES = {
  dashboard: "dashboard",
  squad: "squad",
  matches: "matches",
  market: "market",
  finances: "finances",
  table: "table"
};

export const gameState = {
  initialized: false,
  route: ROUTES.dashboard,
  selectionMode: true,
  teams: [],
  players: [],
  fixtures: [],
  currentWeek: 1,
  totalWeeks: 0,
  userTeamId: null,
  userClub: null,
  currentMatch: null,
  lastResults: [],
  standings: [],
  market: {
    listings: [],
    refreshCost: 2500000
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

export function replaceGameState(nextState) {
  Object.keys(gameState).forEach((key) => {
    delete gameState[key];
  });
  Object.assign(gameState, nextState);
}
