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
            <article class="selector-card club-card" style="--club-primary:${FMG.getClubIdentity(team.id).primary};--club-secondary:${FMG.getClubIdentity(team.id).secondary};--club-accent:${FMG.getClubIdentity(team.id).accent};">
              <div class="club-heading">${FMG.clubBadge(team, "md")}<h3>${FMG.escapeHtml(team.name)}</h3></div>
              <p class="muted">${FMG.escapeHtml(team.city)} | ${FMG.escapeHtml(team.stadium)}</p>
              <div class="meta">
                <span>Presupuesto ${FMG.currency(team.budget)}</span><span>Hinchas ${team.fanBase.toLocaleString("es-CL")}</span><span>${FMG.escapeHtml(team.style)}</span>
              </div>
              <div class="button-row" style="margin-top:18px;"><button class="btn-primary" data-action="select-club" data-team-id="${team.id}" aria-label="Tomar mando de ${FMG.escapeHtml(team.name)}">Tomar mando</button></div>
            </article>`).join("")}
        </div>
      </section>
    `;
  }

  function renderNavigation() {
    const items = [
      [FMG.ROUTES.dashboard, "Inicio", "Panel principal"],
      [FMG.ROUTES.squad, "Plantilla", "Gestionar jugadores"],
      [FMG.ROUTES.matches, "Partidos", "Jugar y revisar partidos"],
      [FMG.ROUTES.calendar, "Calendario", "Ver fixture"],
      [FMG.ROUTES.market, "Mercado", "Fichajes y ventas"],
      [FMG.ROUTES.rival, "Rivales", "Analizar clubes rivales"],
      [FMG.ROUTES.table, "Tabla", "Competencias"],
      [FMG.ROUTES.finances, "Finanzas", "Presupuesto del club"],
      [FMG.ROUTES.career, "Carrera", "Manager"],
      [FMG.ROUTES.news, "Noticias", "Mundo vivo"],
      [FMG.ROUTES.settings, "Config", "Guardado y configuracion"]
    ];

    return `
      <nav class="nav">
        ${items.map(([route, label, tooltip]) => `
          <button class="${FMG.gameState.route === route ? "active" : "btn-ghost"}" data-action="change-route" data-route="${route}" title="${FMG.escapeHtml(tooltip)}" aria-label="${FMG.escapeHtml(tooltip)}">${label}</button>`).join("")}
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
      case FMG.ROUTES.calendar: return FMG.renderCalendarView(FMG.gameState);
      case FMG.ROUTES.market: return FMG.renderMarketView(FMG.gameState);
      case FMG.ROUTES.finances: return FMG.renderFinanceView(FMG.gameState);
      case FMG.ROUTES.career: return FMG.renderCareerView(FMG.gameState);
      case FMG.ROUTES.news: return FMG.renderNewsView(FMG.gameState);
      case FMG.ROUTES.player: return FMG.renderPlayerDetailView(FMG.gameState);
      case FMG.ROUTES.rival: return FMG.renderRivalClubView(FMG.gameState);
      case FMG.ROUTES.settings: return FMG.renderSettingsView(FMG.gameState);
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
    if (target.dataset.confirm && !window.confirm(target.dataset.confirm)) return;
    if (action === "select-club") FMG.selectClub(target.dataset.teamId);
    if (action === "change-route") FMG.gameState.route = target.dataset.route;
    if (action === "advance-week") {
      const result = FMG.advanceWeek();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "start-live-match") FMG.pushNotification(FMG.startLiveUserMatch().message);
    if (action === "advance-live-match") {
      const result = FMG.advanceLiveUserMatch(FMG.gameState.liveMatch ? FMG.gameState.liveMatch.speed : 5);
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "advance-live-half") {
      const liveMatch = FMG.gameState.liveMatch;
      const target = liveMatch && liveMatch.minute < 45 ? 45 : 90;
      const result = FMG.advanceLiveUserMatch(liveMatch ? target - liveMatch.minute : 45);
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "simulate-live-full") {
      const liveMatch = FMG.gameState.liveMatch;
      const result = FMG.advanceLiveUserMatch(liveMatch ? 90 - liveMatch.minute : 90);
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "finish-live-match") FMG.pushNotification(FMG.finishLiveUserMatch().message);
    if (action === "set-live-speed") FMG.pushNotification(FMG.setLiveMatchSpeed(Number(target.dataset.speed)).message);
    if (action === "live-tactic") FMG.pushNotification(FMG.applyLiveTacticalShift(target.dataset.mode).message);
    if (action === "live-substitution") {
      FMG.pushNotification(FMG.makeLiveSubstitution(target.dataset.outPlayerId, target.dataset.inPlayerId).message);
    }
    if (action === "save-game") {
      const result = FMG.saveGame();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "load-game") {
      const result = FMG.loadGame();
      if (!result.ok) FMG.pushNotification(result.message);
    }
    if (action === "take-bank-loan" && !target.dataset.confirm && !window.confirm("Solicitar prestamo bancario por 30.000.000 CLP?")) return;
    if (action === "take-bank-loan") FMG.pushNotification(FMG.takeBankLoan(FMG.gameState, 30000000).message);
    if (action === "negotiate-sponsor") FMG.pushNotification(FMG.negotiateSponsor(FMG.gameState).message);
    if (action === "upgrade-infrastructure") FMG.pushNotification(FMG.upgradeInfrastructure(FMG.gameState, target.dataset.area).message);
    if (action === "upgrade-staff") FMG.pushNotification(FMG.upgradeStaff(FMG.gameState, target.dataset.area).message);
    if (action === "set-manager-style") {
      FMG.gameState.managerProfile.style = target.dataset.style;
      FMG.pushNotification(`Estilo de manager: ${FMG.MANAGER_STYLES[target.dataset.style].label}.`);
    }
    if (action === "generate-career-offers") {
      const offers = FMG.generateCareerOffers(FMG.gameState, { force: true, reason: "manual" });
      FMG.pushNotification(offers.length ? "Llegaron nuevas ofertas de clubes." : "No hay clubes interesados esta semana.");
    }
    if (action === "accept-career-offer" && !target.dataset.confirm && !window.confirm("Aceptar esta oferta y cambiar de club?")) return;
    if (action === "accept-career-offer") FMG.pushNotification(FMG.acceptCareerOffer(FMG.gameState, target.dataset.offerId).message);
    if (action === "create-career-decision") {
      const decision = FMG.createNarrativeDecision(FMG.gameState);
      FMG.pushNotification(`Nueva decision: ${decision.title}.`);
    }
    if (action === "resolve-career-decision") {
      FMG.pushNotification(FMG.resolveNarrativeDecision(FMG.gameState, target.dataset.decisionId, target.dataset.choiceId).message);
    }
    if (action === "set-news-filter") FMG.setNewsFilter(FMG.gameState, target.dataset.filter);
    if (action === "set-table-sort") FMG.setTableViewOption(FMG.gameState, "sort", target.dataset.sort);
    if (action === "set-table-filter") FMG.setTableViewOption(FMG.gameState, "filter", target.dataset.filter);
    if (action === "set-calendar-filter") FMG.setCalendarFilter(FMG.gameState, target.dataset.filter);
    if (action === "select-rival-club") FMG.pushNotification(FMG.selectRivalClub(FMG.gameState, target.dataset.teamId).message);
    if (action === "update-setting") FMG.pushNotification(FMG.updateGameSetting(FMG.gameState, target.dataset.setting, target.dataset.value).message);
    if (action === "save-slot") FMG.pushNotification(FMG.saveToSlot(FMG.gameState, target.dataset.slotId, { overwrite: true }).message);
    if (action === "load-slot") FMG.pushNotification(FMG.loadFromSlot(target.dataset.slotId).message);
    if (action === "import-save") {
      const payload = document.querySelector("[data-role='import-payload']")?.value || "";
      FMG.pushNotification(FMG.importSave(payload, target.dataset.slotId).message);
    }
    if (action === "safe-reset") {
      FMG.initializeGame(FMG.gameState.teams, FMG.gameState.players);
      FMG.pushNotification("Partida reiniciada. Los slots guardados se conservan.");
    }
    if (action === "generate-world-news") {
      const created = FMG.generateContextualWeeklyNews(FMG.gameState, null);
      FMG.pushNotification(created.length ? `Mundo actualizado con ${created.length} noticia(s).` : "No surgieron nuevas historias esta semana.");
    }
    if (action === "generate-market-rumors") {
      const rumors = FMG.generateMarketRumors(FMG.gameState);
      FMG.pushNotification(rumors.length ? "La red de scouting filtro nuevos rumores." : "No hay rumores nuevos por ahora.");
    }
    if (action === "refresh-market") {
      FMG.pushNotification(FMG.refreshTransferMarket(FMG.gameState).message);
    }
    if (action === "create-transfer-offer") {
      const player = FMG.gameState.players.find((item) => item.id === target.dataset.playerId);
      const role = player && player.overall >= 76 ? "starter" : "rotation";
      FMG.pushNotification(FMG.createTransferOffer(FMG.gameState, target.dataset.playerId, { transferType: target.dataset.transferType, role }).message);
    }
    if (action === "create-loan-offer") {
      FMG.pushNotification(FMG.createTransferOffer(FMG.gameState, target.dataset.playerId, { transferType: "loan", role: "rotation" }).message);
    }
    if (action === "resolve-negotiation") FMG.pushNotification(FMG.resolveTransferNegotiation(FMG.gameState, target.dataset.negotiationId).message);
    if (action === "generate-incoming-offers") {
      const offers = FMG.generateIncomingOffers(FMG.gameState);
      FMG.pushNotification(offers.length ? "Llegaron nuevas ofertas por jugadores." : "No llegaron ofertas nuevas.");
    }
    if (action === "accept-incoming-offer" && !target.dataset.confirm && !window.confirm("Aceptar venta del jugador?")) return;
    if (action === "accept-incoming-offer") FMG.pushNotification(FMG.respondIncomingOffer(FMG.gameState, target.dataset.offerId, true).message);
    if (action === "reject-incoming-offer") FMG.pushNotification(FMG.respondIncomingOffer(FMG.gameState, target.dataset.offerId, false).message);
    if (action === "set-formation") FMG.pushNotification(FMG.setFormation(FMG.gameState, target.dataset.formation).message);
    if (action === "set-training") FMG.pushNotification(FMG.setTrainingFocus(FMG.gameState, target.dataset.focus).message);
    if (action === "set-team-tactic") FMG.pushNotification(FMG.setTeamTactic(FMG.gameState, target.dataset.tacticKey, target.dataset.tacticValue).message);
    if (action === "set-position-role") FMG.pushNotification(FMG.setPositionRole(FMG.gameState, target.dataset.position, target.dataset.role).message);
    if (action === "set-player-instruction") FMG.pushNotification(FMG.setPlayerInstruction(FMG.gameState, target.dataset.playerId, target.dataset.instruction).message);
    if (action === "set-squad-role") FMG.pushNotification(FMG.setSquadRole(FMG.gameState, target.dataset.playerId, target.dataset.role).message);
    if (action === "set-captain") FMG.pushNotification(FMG.setCaptain(FMG.gameState, target.dataset.playerId).message);
    if (action === "select-squad-player") {
      FMG.pushNotification(FMG.selectSquadPlayer(FMG.gameState, target.dataset.playerId).message);
      FMG.gameState.route = FMG.ROUTES.player;
    }
    if (action === "set-squad-filter") FMG.setSquadView(FMG.gameState, "filter", target.dataset.filter);
    if (action === "set-squad-sort") FMG.setSquadView(FMG.gameState, "sort", target.dataset.sort);
    if (action === "renew-contract") {
      const player = FMG.gameState.players.find((item) => item.id === target.dataset.playerId);
      FMG.pushNotification(FMG.renewPlayerContract(FMG.gameState, target.dataset.playerId, {
        role: player ? player.squadRole : "rotation",
        years: 3
      }).message);
    }
    if (action === "train-squad") FMG.pushNotification(FMG.trainUserSquad(FMG.gameState).message);
    if (action === "new-season" && !target.dataset.confirm && !window.confirm("Iniciar una nueva temporada?")) return;
    if (action === "new-season") FMG.pushNotification(FMG.startNewSeason().message);
    if (action === "buy-player") FMG.pushNotification(FMG.buyPlayer(FMG.gameState, target.dataset.playerId).message);
    if (action === "sell-player" && !target.dataset.confirm && !window.confirm("Poner en venta a este jugador?")) return;
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
