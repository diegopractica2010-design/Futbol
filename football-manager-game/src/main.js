import {
  advanceWeek,
  dismissNotification,
  getNextOpponent,
  getUpcomingFixture,
  initializeGame,
  loadGame,
  pushNotification,
  saveGame,
  selectClub
} from "./gameEngine.js";
import { gameState, ROUTES } from "./gameState.js";
import { refreshTransferMarket, buyPlayer, sellPlayer } from "./transfers.js";
import { currency } from "./utils.js";
import { renderDashboard } from "../ui/dashboard.js";
import { renderFinanceView } from "../ui/financeView.js";
import { renderMarketView } from "../ui/marketView.js";
import { renderMatchView } from "../ui/matchView.js";
import { renderTableView } from "../ui/tableView.js";
import { renderTeamView } from "../ui/teamView.js";

const app = document.querySelector("#app");

async function loadSeedData() {
  const [teamsResponse, playersResponse] = await Promise.all([fetch("./data/teams.json"), fetch("./data/players.json")]);
  if (!teamsResponse.ok || !playersResponse.ok) throw new Error("No se pudieron cargar los datos iniciales.");
  const [teams, players] = await Promise.all([teamsResponse.json(), playersResponse.json()]);
  return { teams, players };
}

function renderSelection() {
  return `
    <section class="panel">
      <span class="eyebrow">Seleccion inicial</span>
      <h1 class="hero-title">Elige tu club</h1>
      <p class="hero-copy">Cada institucion llega con presupuesto, hinchada y estilo propio. El arte del juego esta resuelto con CSS y SVG locales para mantener el proyecto portable y sin dependencias externas.</p>
      <div class="hero-actions">
        <button class="btn-secondary" data-action="load-game">Cargar partida guardada</button>
      </div>
      <div class="selector-grid">
        ${gameState.teams.map((team) => `
          <article class="selector-card">
            <h3>${team.name}</h3>
            <p class="muted">${team.city} | ${team.stadium}</p>
            <div class="meta">
              <span>Presupuesto ${currency(team.budget)}</span><span>Hinchas ${team.fanBase.toLocaleString("es-CL")}</span><span>${team.style}</span>
            </div>
            <div class="button-row" style="margin-top:18px;"><button class="btn-primary" data-action="select-club" data-team-id="${team.id}">Tomar mando</button></div>
          </article>`).join("")}
      </div>
    </section>
  `;
}

function renderNavigation() {
  const items = [
    [ROUTES.dashboard, "Dashboard"],
    [ROUTES.squad, "Plantilla"],
    [ROUTES.matches, "Partidos"],
    [ROUTES.market, "Mercado"],
    [ROUTES.finances, "Finanzas"],
    [ROUTES.table, "Tabla"]
  ];

  return `
    <nav class="nav">
      ${items.map(([route, label]) => `
        <button class="${gameState.route === route ? "active" : "btn-ghost"}" data-action="change-route" data-route="${route}">${label}</button>`).join("")}
    </nav>
  `;
}

function renderNotifications() {
  return gameState.notifications.map((notification) => `
    <div class="toast" data-id="${notification.id}">
      <strong>${notification.message}</strong>
      <div class="button-row" style="margin-top:10px;"><button class="btn-ghost" data-action="dismiss-toast" data-id="${notification.id}">Cerrar</button></div>
    </div>`).join("");
}

function renderRoute() {
  const helpers = { nextOpponent: getNextOpponent(), upcomingMatches: getUpcomingFixture() };
  switch (gameState.route) {
    case ROUTES.squad: return renderTeamView(gameState);
    case ROUTES.matches: return renderMatchView(gameState, helpers.upcomingMatches);
    case ROUTES.market: return renderMarketView(gameState);
    case ROUTES.finances: return renderFinanceView(gameState);
    case ROUTES.table: return renderTableView(gameState);
    default: return renderDashboard(gameState, helpers);
  }
}

function render() {
  app.innerHTML = gameState.selectionMode
    ? `${renderSelection()}${renderNotifications()}`
    : `<div class="shell">${renderNavigation()}${renderRoute()}</div>${renderNotifications()}`;
}

function handleAction(action, target) {
  if (!action) return;
  if (action === "select-club") selectClub(target.dataset.teamId);
  if (action === "change-route") gameState.route = target.dataset.route;
  if (action === "advance-week") {
    const result = advanceWeek();
    if (!result.ok) pushNotification(result.message);
  }
  if (action === "save-game") saveGame();
  if (action === "load-game") {
    const result = loadGame();
    if (!result.ok) pushNotification(result.message);
  }
  if (action === "refresh-market") {
    refreshTransferMarket(gameState);
    pushNotification("El area de scouting publico una nueva tanda de jugadores.");
  }
  if (action === "buy-player") pushNotification(buyPlayer(gameState, target.dataset.playerId).message);
  if (action === "sell-player") pushNotification(sellPlayer(gameState, target.dataset.playerId).message);
  if (action === "dismiss-toast") dismissNotification(target.dataset.id);
  render();
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (target) handleAction(target.dataset.action, target);
});

async function boot() {
  try {
    const { teams, players } = await loadSeedData();
    initializeGame(teams, players);
    render();
  } catch (error) {
    app.innerHTML = `
      <section class="panel">
        <h1>Error de carga</h1>
        <p class="hero-copy">${error.message}</p>
        <p class="hero-copy">Abre el proyecto desde un servidor local para permitir la carga de JSON.</p>
      </section>`;
    console.error(error);
  }
}

boot();
