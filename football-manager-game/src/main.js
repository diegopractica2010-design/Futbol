(function () {
  const FMG = (window.FMG = window.FMG || {});
  const app = document.querySelector("#app");

  async function loadSeedData() {
    const [teamsResponse, playersResponse] = await Promise.all([
      fetch("./data/teams.json"),
      fetch("./data/players.json")
    ]);

    if (!teamsResponse.ok || !playersResponse.ok) {
      throw new Error("No se pudieron cargar los datos base. Abre el juego desde un servidor local.");
    }

    const teams = await teamsResponse.json();
    const players = await playersResponse.json();
    FMG.validateSeedData(teams, players);
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
          ${FMG.gameState.teams.map((team) => `
            <article class="selector-card">
              <h3>${FMG.escapeHtml(team.name)}</h3>
              <p class="muted">${FMG.escapeHtml(team.city)} | ${FMG.escapeHtml(team.stadium)}</p>
              <div class="meta">
                <span>Presupuesto ${FMG.currency(team.budget)}</span><span>Hinchas ${team.fanBase.toLocaleString("es-CL")}</span><span>${FMG.escapeHtml(team.style)}</span>
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
    return FMG.gameState.notifications.map((notification, index) => `
      <div class="toast" data-id="${notification.id}" style="bottom:${20 + index * 84}px;">
        <strong>${FMG.escapeHtml(notification.message)}</strong>
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
    if (action === "save-game") {
      const result = FMG.saveGame();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "load-game") {
      const result = FMG.loadGame();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "refresh-market") {
      FMG.pushNotification(FMG.refreshTransferMarket(FMG.gameState).message);
    }
    if (action === "set-formation") FMG.pushNotification(FMG.setFormation(FMG.gameState, target.dataset.formation).message);
    if (action === "set-training") FMG.pushNotification(FMG.setTrainingFocus(FMG.gameState, target.dataset.focus).message);
    if (action === "train-squad") FMG.pushNotification(FMG.trainUserSquad(FMG.gameState).message);
    if (action === "new-season") FMG.pushNotification(FMG.startNewSeason().message);
    if (action === "buy-player") FMG.pushNotification(FMG.buyPlayer(FMG.gameState, target.dataset.playerId).message);
    if (action === "sell-player") FMG.pushNotification(FMG.sellPlayer(FMG.gameState, target.dataset.playerId).message);
    if (action === "dismiss-toast") FMG.dismissNotification(target.dataset.id);
    render();
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (target) handleAction(target.dataset.action, target);
  });

  async function boot() {
    try {
      const seed = await loadSeedData();
      FMG.initializeGame(seed.teams, seed.players);
      render();
    } catch (error) {
      app.innerHTML = `
        <section class="panel">
          <h1>Error de carga</h1>
          <p class="hero-copy">${FMG.escapeHtml(error.message)}</p>
          <p class="hero-copy">Inicia un servidor local en la carpeta del juego y vuelve a abrir la pagina.</p>
        </section>`;
      console.error(error);
    }
  }

  boot();
})();
