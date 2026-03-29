(function () {
  const FMG = (window.FMG = window.FMG || {});
  const app = document.querySelector("#app");

  function loadSeedData() {
    return {
      teams: FMG.seedTeams,
      players: FMG.seedPlayers
    };
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
          ${FMG.gameState.teams.map((team) => `
            <article class="selector-card">
              <h3>${team.name}</h3>
              <p class="muted">${team.city} | ${team.stadium}</p>
              <div class="meta">
                <span>Presupuesto ${FMG.currency(team.budget)}</span><span>Hinchas ${team.fanBase.toLocaleString("es-CL")}</span><span>${team.style}</span>
              </div>
              <div class="button-row" style="margin-top:18px;"><button class="btn-primary" data-action="select-club" data-team-id="${team.id}">Tomar mando</button></div>
            </article>`).join("")}
        </div>
      </section>
    `;
  }

  function renderNavigation() {
    const items = [
      [FMG.ROUTES.dashboard, "Dashboard"],
      [FMG.ROUTES.squad, "Plantilla"],
      [FMG.ROUTES.matches, "Partidos"],
      [FMG.ROUTES.market, "Mercado"],
      [FMG.ROUTES.finances, "Finanzas"],
      [FMG.ROUTES.table, "Tabla"]
    ];

    return `
      <nav class="nav">
        ${items.map(([route, label]) => `
          <button class="${FMG.gameState.route === route ? "active" : "btn-ghost"}" data-action="change-route" data-route="${route}">${label}</button>`).join("")}
      </nav>
    `;
  }

  function renderNotifications() {
    return FMG.gameState.notifications.map((notification) => `
      <div class="toast" data-id="${notification.id}">
        <strong>${notification.message}</strong>
        <div class="button-row" style="margin-top:10px;"><button class="btn-ghost" data-action="dismiss-toast" data-id="${notification.id}">Cerrar</button></div>
      </div>`).join("");
  }

  function renderRoute() {
    const helpers = { nextOpponent: FMG.getNextOpponent(), upcomingMatches: FMG.getUpcomingFixture() };
    switch (FMG.gameState.route) {
      case FMG.ROUTES.squad: return FMG.renderTeamView(FMG.gameState);
      case FMG.ROUTES.matches: return FMG.renderMatchView(FMG.gameState, helpers.upcomingMatches);
      case FMG.ROUTES.market: return FMG.renderMarketView(FMG.gameState);
      case FMG.ROUTES.finances: return FMG.renderFinanceView(FMG.gameState);
      case FMG.ROUTES.table: return FMG.renderTableView(FMG.gameState);
      default: return FMG.renderDashboard(FMG.gameState, helpers);
    }
  }

  function render() {
    app.innerHTML = FMG.gameState.selectionMode
      ? `${renderSelection()}${renderNotifications()}`
      : `<div class="shell">${renderNavigation()}${renderRoute()}</div>${renderNotifications()}`;
  }

  function handleAction(action, target) {
    if (!action) return;
    if (action === "select-club") FMG.selectClub(target.dataset.teamId);
    if (action === "change-route") FMG.gameState.route = target.dataset.route;
    if (action === "advance-week") {
      const result = FMG.advanceWeek();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "save-game") FMG.saveGame();
    if (action === "load-game") {
      const result = FMG.loadGame();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "refresh-market") {
      FMG.refreshTransferMarket(FMG.gameState);
      FMG.pushNotification("El area de scouting publico una nueva tanda de jugadores.");
    }
    if (action === "buy-player") FMG.pushNotification(FMG.buyPlayer(FMG.gameState, target.dataset.playerId).message);
    if (action === "sell-player") FMG.pushNotification(FMG.sellPlayer(FMG.gameState, target.dataset.playerId).message);
    if (action === "dismiss-toast") FMG.dismissNotification(target.dataset.id);
    render();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (target) handleAction(target.dataset.action, target);
  });

  try {
    const seed = loadSeedData();
    FMG.initializeGame(seed.teams, seed.players);
    render();
  } catch (error) {
    app.innerHTML = `
      <section class="panel">
        <h1>Error de carga</h1>
        <p class="hero-copy">${error.message}</p>
        <p class="hero-copy">Si esta pagina se abre en blanco, recarga el archivo index.html despues de guardar los cambios.</p>
      </section>`;
    console.error(error);
  }
})();
