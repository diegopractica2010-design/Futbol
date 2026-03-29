import { applyWeeklyEvent } from "./events.js";
import { financeHeadline, processWeeklyFinances, registerFinanceEntry } from "./finances.js";
import { gameState, replaceGameState, ROUTES } from "./gameState.js";
import { simulateMatch } from "./matchEngine.js";
import { createInitialStandings, sortStandings, updateStandings } from "./table.js";
import { buildTransferMarket } from "./transfers.js";
import { clamp, deepClone, randomInt, STORAGE_KEY } from "./utils.js";

const fallbackNames = [
  "Matias Navarro", "Felipe Bustos", "Rodrigo Parraguez", "Diego Loyola", "Cristian Caceres",
  "Martin Sepulveda", "Javier Astudillo", "Bruno Troncoso", "Matias Concha", "Carlos Inostroza",
  "Vicente Alarcon", "Bastian Retamal", "Sebastian Alveal", "Nicolas Chandia", "Franco Cifuentes"
];

function ensureSquadDepth(teams, players) {
  const enrichedPlayers = [...deepClone(players)];
  const positions = ["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "EXT", "EXT", "DEL", "POR", "DEF", "DEF", "MED", "MED", "EXT", "DEL"];

  teams.forEach((team, teamIndex) => {
    const squad = enrichedPlayers.filter((player) => player.teamId === team.id);
    while (squad.length < 18) {
      const squadIndex = squad.length;
      const name = fallbackNames[(teamIndex * 4 + squadIndex) % fallbackNames.length];
      const position = positions[squadIndex];
      const player = {
        id: `${team.id}-gen-${squadIndex + 1}`,
        name,
        teamId: team.id,
        position,
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
  const totalRounds = rotating.length - 1;

  for (let round = 0; round < totalRounds; round += 1) {
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
  const revived = deepClone(state);
  revived.route = revived.route || ROUTES.dashboard;
  revived.notifications = revived.notifications || [];
  revived.market = revived.market || { listings: [], refreshCost: 2500000 };
  revived.finances = revived.finances || { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] };
  revived.eventsLog = revived.eventsLog || [];
  revived.lastResults = revived.lastResults || [];
  revived.seasonLog = revived.seasonLog || [];
  revived.selectionMode = !revived.userTeamId;
  return revived;
}

export function initializeGame(teams, players) {
  const fixtures = buildSeasonFixtures(teams);
  const seasonPlayers = ensureSquadDepth(teams, players);
  replaceGameState({
    initialized: true,
    route: ROUTES.dashboard,
    selectionMode: true,
    teams: deepClone(teams),
    players: seasonPlayers,
    fixtures,
    currentWeek: 1,
    totalWeeks: fixtures.length,
    userTeamId: null,
    userClub: null,
    currentMatch: null,
    lastResults: [],
    standings: createInitialStandings(teams),
    market: { listings: [], refreshCost: 2500000 },
    finances: { balance: 0, incomeHistory: [], expenseHistory: [], weeklyReport: [] },
    eventsLog: [],
    notifications: [],
    seasonLog: []
  });
}

export function selectClub(teamId) {
  const team = gameState.teams.find((item) => item.id === teamId);
  if (!team) return;
  gameState.userTeamId = team.id;
  gameState.userClub = team;
  gameState.selectionMode = false;
  gameState.finances.balance = 0;
  registerFinanceEntry(gameState.finances, "income", "Capital inicial de temporada", team.budget);
  buildTransferMarket(gameState);
  pushNotification(`Tomaste el control de ${team.name}.`);
}

export function advanceWeek() {
  const currentFixture = gameState.fixtures.find((fixture) => fixture.week === gameState.currentWeek);
  if (!currentFixture || currentFixture.played) return { ok: false, message: "No quedan fechas por disputar." };

  const results = currentFixture.matches.map((match) => {
    const homeTeam = gameState.teams.find((team) => team.id === match.homeTeamId);
    const awayTeam = gameState.teams.find((team) => team.id === match.awayTeamId);
    const result = simulateMatch({ homeTeam, awayTeam, players: gameState.players });
    updateStandings(gameState.standings, result);
    homeTeam.form = clamp(homeTeam.form + (result.homeGoals >= result.awayGoals ? 1 : -1), 0, 20);
    awayTeam.form = clamp(awayTeam.form + (result.awayGoals >= result.homeGoals ? 1 : -1), 0, 20);
    return result;
  });

  currentFixture.played = true;
  gameState.lastResults = results;
  gameState.standings = sortStandings(gameState.standings);
  gameState.currentMatch = results.find((result) => result.homeTeamId === gameState.userTeamId || result.awayTeamId === gameState.userTeamId) || null;

  const event = applyWeeklyEvent(gameState);
  const financeReport = processWeeklyFinances(gameState);
  gameState.players.filter((player) => player.teamId === gameState.userTeamId).forEach((player) => {
    player.energy = clamp(player.energy + randomInt(4, 8), 0, 100);
  });

  gameState.seasonLog.unshift({
    week: gameState.currentWeek,
    headline: financeHeadline(financeReport),
    event
  });
  gameState.seasonLog = gameState.seasonLog.slice(0, 10);

  if (gameState.currentWeek < gameState.totalWeeks) gameState.currentWeek += 1;
  const nextOpponent = getNextOpponent();
  pushNotification(nextOpponent ? `Semana completada. Proximo rival: ${nextOpponent.name}.` : "La temporada ha terminado.");
  return { ok: true, message: "Fecha simulada correctamente." };
}

export function getNextOpponent() {
  const upcoming = gameState.fixtures.find((fixture) => !fixture.played && fixture.week === gameState.currentWeek);
  if (!upcoming) return null;
  const match = upcoming.matches.find((item) => item.homeTeamId === gameState.userTeamId || item.awayTeamId === gameState.userTeamId);
  if (!match) return null;
  const opponentId = match.homeTeamId === gameState.userTeamId ? match.awayTeamId : match.homeTeamId;
  return gameState.teams.find((team) => team.id === opponentId) || null;
}

export function getUpcomingFixture() {
  const nextFixture = gameState.fixtures.find((fixture) => !fixture.played && fixture.week === gameState.currentWeek);
  if (!nextFixture) return null;
  return nextFixture.matches.map((match) => ({
    ...match,
    homeTeam: gameState.teams.find((team) => team.id === match.homeTeamId),
    awayTeam: gameState.teams.find((team) => team.id === match.awayTeamId)
  }));
}

export function pushNotification(message) {
  gameState.notifications.push({ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message });
  gameState.notifications = gameState.notifications.slice(-3);
}

export function dismissNotification(id) {
  gameState.notifications = gameState.notifications.filter((item) => item.id !== id);
}

export function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  pushNotification("Partida guardada en el navegador.");
}

export function loadGame() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ok: false, message: "No hay una partida guardada disponible." };
  replaceGameState(reviveState(JSON.parse(raw)));
  pushNotification("Partida cargada correctamente.");
  return { ok: true, message: "Partida cargada." };
}
