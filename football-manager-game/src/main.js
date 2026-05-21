(function () {
  const FMG = (window.FMG = window.FMG || {});
  const app = document.querySelector("#app");
  const isDevMode = new URLSearchParams(location.search).has("dev");
  const isDebugMode = isDevMode || new URLSearchParams(location.search).has("debug");
  let menuAudio = null;
  let livePlaybackTimer = 0;
  let notificationPruneTimer = 0;
  const SANDBOX_PHASE_ROUTES = new Set([
    "phase15", "phase16", "phase17", "phase18", "phase19",
    "phase20", "phase21", "phase22", "phase23", "phase24"
  ]);
  const SANDBOX_OPT_IN_KEY = "fmg-sandbox-opt-in";

  function authorizedGameStateWrite(writeBlock) {
    FMG.openWriteToken?.();
    try {
      return writeBlock();
    } finally {
      FMG.closeWriteToken?.();
    }
  }

  function hideLoadingScreen() {
    document.getElementById("loading-screen")?.remove();
  }

  function focusRouteHeading() {
    const heading = app.querySelector("h1, h2");
    const focusTarget = heading || app;
    focusTarget.setAttribute("tabindex", "-1");
    focusTarget.focus({ preventScroll: true });
  }

  function isKnownRoute(route) {
    return Object.values(FMG.ROUTES || {}).includes(route);
  }

  function syncBrowserRoute(route, options = {}) {
    if (!route || !window.history?.pushState) return;
    const url = new URL(window.location.href);
    url.hash = route;
    const state = { route };
    if (options.replace) window.history.replaceState(state, "", url);
    else window.history.pushState(state, "", url);
  }

  function routeFromLocation() {
    const route = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    return isKnownRoute(route) ? route : null;
  }

  function ensureMenuAudio() {
    if (menuAudio || !FMG.Phase23?.StadiumAudio) return;
    FMG.UIAudio?.init();
    menuAudio = new FMG.Phase23.StadiumAudio();
    menuAudio.startMenuMusic();
  }

  function clubDifficulty(team) {
    const budgets = (FMG.gameState?.teams || [team]).map((item) => Number(item.budget) || 0);
    const maxBudget = Math.max(1, ...budgets);
    const budgetRatio = team.budget / maxBudget;
    if (budgetRatio > 0.85) return { label: "Dificil", desc: "Alta exigencia del directorio", color: "danger" };
    if (budgetRatio > 0.65) return { label: "Medio", desc: "Balance entre recursos y presion", color: "warning" };
    return { label: "Accesible", desc: "Mas margen para errores", color: "success" };
  }

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
          <button class="btn-secondary" data-action="change-route" data-route="${FMG.ROUTES.settings}">Gestionar guardados</button>
        </div>
        <div class="selector-grid">
          ${FMG.gameState.teams.map((team) => {
            const difficulty = clubDifficulty(team);
            return `
            <article class="selector-card club-card" style="--club-primary:${FMG.getClubIdentity(team.id).primary};--club-secondary:${FMG.getClubIdentity(team.id).secondary};--club-accent:${FMG.getClubIdentity(team.id).accent};">
              <div class="club-heading">${FMG.clubBadge(team, "md")}<h3>${FMG.escapeHtml(team.name)}</h3></div>
              <p class="muted">${FMG.escapeHtml(team.city)} | ${FMG.escapeHtml(team.stadium)}</p>
              <span class="chip chip-${difficulty.color}" title="${FMG.escapeHtml(difficulty.desc)}">${difficulty.label}</span>
              <div class="meta">
                <span>Presupuesto ${FMG.currency(team.budget)}</span><span>Hinchas ${team.fanBase.toLocaleString("es-CL")}</span><span>${FMG.escapeHtml(team.style)}</span>
              </div>
              <div class="button-row" style="margin-top:18px;"><button class="btn-primary" data-action="select-club" data-team-id="${team.id}" aria-label="Tomar mando de ${FMG.escapeHtml(team.name)}">Tomar mando</button></div>
            </article>`;
          }).join("")}
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
      [FMG.ROUTES.history, "Historia", "Momentos legendarios e historia"],
      [FMG.ROUTES.hallOfFame, "HoF", "Salon de la Fama"],
      [FMG.ROUTES.legacy, "Legado", "Legado del manager"],
      [FMG.ROUTES.settings, "Config", "Guardado y configuracion"],
      [FMG.ROUTES.phase15, "Jugar v1", "Partido jugable Fase 15"],
      [FMG.ROUTES.phase16, "Jugar v2", "Framework modular Fase 16"],
      [FMG.ROUTES.phase17, "Jugar v3", "Animaciones base Fase 17"],
      [FMG.ROUTES.phase18, "Jugar v4", "Comportamiento rival Fase 18"],
      [FMG.ROUTES.phase19, "Jugar v5", "Porteros Fase 19"],
      [FMG.ROUTES.phase20, "Jugar v6", "Camara Broadcast Fase 20"],
      [FMG.ROUTES.phase21, "Jugar v7", "Estadio Premium Fase 21"],
      [FMG.ROUTES.phase22, "Jugar v8", "HUD Final Fase 22"],
      [FMG.ROUTES.phase23, "Jugar v9", "Audio de Partido Fase 23"],
      [FMG.ROUTES.phase24, "Jugar v10", "Tácticas en Cancha Fase 24"]
    ];

    const visibleItems = isDevMode ? items : items.filter(([route]) => !String(route).startsWith("phase"));

    return `
      <nav class="nav" role="navigation" aria-label="Menu principal">
        <button class="btn-ghost nav-save" data-action="change-route" data-route="${FMG.ROUTES.settings}" aria-label="Gestionar guardados">Guardar</button>
        ${visibleItems.map(([route, label, tooltip]) => `
          <button class="${FMG.gameState.route === route ? "active" : "btn-ghost"} ${SANDBOX_PHASE_ROUTES.has(route) ? "sandbox-nav-item" : ""}" data-action="change-route" data-route="${route}" aria-current="${FMG.gameState.route === route ? "page" : "false"}" title="${FMG.escapeHtml(SANDBOX_PHASE_ROUTES.has(route) ? `Sandbox / No afecta carrera - ${tooltip}` : tooltip)}" aria-label="${FMG.escapeHtml(SANDBOX_PHASE_ROUTES.has(route) ? `Sandbox, no afecta carrera, ${tooltip}` : tooltip)}">${label}${SANDBOX_PHASE_ROUTES.has(route) ? `<span class="sandbox-mini-badge">Sandbox</span>` : ""}</button>`).join("")}
      </nav>
    `;
  }

  function renderDevBanner() {
    if (!isDevMode) return "";
    return `<div class="dev-mode-banner" role="status">Modo dev activo: fases sandbox visibles, no afectan la carrera principal.</div>`;
  }

  function renderSandboxFrame(content) {
    return `
      <section class="panel sandbox-disclaimer" aria-label="Modo sandbox">
        <span class="chip chip-warning">Sandbox / No afecta carrera</span>
        <p class="muted">Estas fases son laboratorios jugables del motor. Sus controles y resultados no modifican tu partida principal.</p>
      </section>
      ${content}
    `;
  }

  function confirmSandboxOptIn(route) {
    if (!SANDBOX_PHASE_ROUTES.has(route)) return true;
    if (sessionStorage.getItem(SANDBOX_OPT_IN_KEY) === "1") return true;
    const accepted = window.confirm("Estas vistas son sandbox y no afectan tu carrera. ¿Quieres entrar?");
    if (accepted) sessionStorage.setItem(SANDBOX_OPT_IN_KEY, "1");
    return accepted;
  }

  function renderNotifications() {
    if (FMG.NotificationManager) return FMG.NotificationManager.render(FMG.gameState, FMG.escapeHtml);
    return "";
  }

  function syncLiveVisualizer() {
    const container = document.querySelector("#match-visualizer-container");
    const liveMatch = FMG.gameState.liveMatch;
    if (!container || !liveMatch || !FMG.matchVisualController) return;

    const currentCanvas = FMG.matchVisualController.visualizer?.renderer?.domElement;
    if (!currentCanvas || !container.contains(currentCanvas)) {
      try {
        FMG.matchVisualController.initMatch(container, liveMatch, FMG.gameState);
        FMG._visualizerInitialized = true;
      } catch (error) {
        console.error("[match visualizer] init failed", error);
        container.innerHTML = `<div class="match-renderer-fallback">Vista tactica no disponible. El partido sigue simulado de forma segura.</div>`;
        return;
      }
    }
    try {
      if (FMG.matchVisualController.syncLiveMatch) FMG.matchVisualController.syncLiveMatch(liveMatch);
    } catch (error) {
      console.error("[match visualizer] sync failed", error);
      FMG.matchVisualController.recover?.(container, liveMatch, FMG.gameState);
    }
  }

  function stopLivePlaybackLoop() {
    if (livePlaybackTimer) {
      window.clearTimeout(livePlaybackTimer);
      livePlaybackTimer = 0;
    }
  }

  function scheduleLivePlaybackLoop() {
    stopLivePlaybackLoop();
    const liveMatch = FMG.gameState.liveMatch;
    if (!liveMatch || liveMatch.completed || liveMatch.paused) return;
    const interval = Math.max(220, Math.round(1000 / Math.max(1, Number(liveMatch.speed) || 1)));
    livePlaybackTimer = window.setTimeout(() => {
      livePlaybackTimer = 0;
      const current = FMG.gameState.liveMatch;
      if (!current || current.completed || current.paused) return;
      const result = FMG.advanceLiveUserMatch(1);
      if (!result.ok) {
        current.paused = true;
        FMG.pushNotification(result.message, "warning");
      }
      render();
      requestAnimationFrame(() => {
        syncLiveVisualizer();
        scheduleLivePlaybackLoop();
      });
    }, interval);
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
      case FMG.ROUTES.history: return FMG.renderHistoryView ? FMG.renderHistoryView(FMG.gameState) : "<div class='empty-state'>Vista Historia no disponible.</div>";
      case FMG.ROUTES.hallOfFame: return FMG.renderHallOfFameView ? FMG.renderHallOfFameView(FMG.gameState) : "<div class='empty-state'>Vista Salon de la Fama no disponible.</div>";
      case FMG.ROUTES.legacy: return FMG.renderLegacyView ? FMG.renderLegacyView(FMG.gameState) : "<div class='empty-state'>Vista Legado no disponible.</div>";
      case FMG.ROUTES.onboarding: return FMG.renderOnboardingView();
      case FMG.ROUTES.credits: return FMG.renderCreditsView();
      case FMG.ROUTES.phase15: return renderSandboxFrame(FMG.renderPhase15View());
      case FMG.ROUTES.phase16: return renderSandboxFrame(FMG.renderPhase16View());
      case FMG.ROUTES.phase17: return renderSandboxFrame(FMG.renderPhase17View());
      case FMG.ROUTES.phase18: return renderSandboxFrame(FMG.renderPhase18View());
      case FMG.ROUTES.phase19: return renderSandboxFrame(FMG.renderPhase19View());
      case FMG.ROUTES.phase20: return renderSandboxFrame(FMG.renderPhase20View());
      case FMG.ROUTES.phase21: return renderSandboxFrame(FMG.renderPhase21View());
      case FMG.ROUTES.phase22: return renderSandboxFrame(FMG.renderPhase22View());
      case FMG.ROUTES.phase23: return renderSandboxFrame(FMG.renderPhase23View());
      case FMG.ROUTES.phase24: return renderSandboxFrame(FMG.renderPhase24View());
      default: return FMG.renderDashboard(FMG.gameState, helpers);
    }
  }

  function render() {
    const presentation = FMG.gameState.liveMatch && FMG.PresentationController?.getState
      ? FMG.PresentationController.getState(FMG.gameState, FMG.gameState.liveMatch)
      : null;
    FMG.FootballIdentityTheme?.apply(FMG.gameState, presentation);
    FMG.UITheme?.apply(FMG.gameState);
    FMG.NotificationManager?.prune(FMG.gameState);
    const routeHtml = FMG.gameState.route === FMG.ROUTES.onboarding
      ? FMG.renderOnboardingView()
      : FMG.gameState.selectionMode
      ? renderSelection()
      : renderRoute();
    const navHtml = (!FMG.gameState.selectionMode && FMG.gameState.route !== FMG.ROUTES.onboarding) ? renderNavigation() : "";
    const devBannerHtml = renderDevBanner();
    const overlayHtml = renderNotifications();
    if (FMG.Hardening?.PersistentUIShell && FMG.renderScheduler) {
      FMG.persistentUIShell = FMG.persistentUIShell || new FMG.Hardening.PersistentUIShell(app, FMG.renderScheduler);
      FMG.persistentUIShell.render({ nav: `${devBannerHtml}${navHtml}`, route: routeHtml, overlay: overlayHtml });
    } else {
      app.innerHTML = FMG.gameState.route === FMG.ROUTES.onboarding
        ? `${devBannerHtml}${routeHtml}${overlayHtml}`
        : FMG.gameState.selectionMode
        ? `${devBannerHtml}${routeHtml}${overlayHtml}`
        : `<div class="shell">${devBannerHtml}${navHtml}${routeHtml}</div>${overlayHtml}`;
    }
    scheduleLivePlaybackLoop();
  }
  FMG.render = render;
  FMG.syncLiveVisualizer = function () {
    syncLiveVisualizer();
  };

  function startNotificationPruner() {
    if (notificationPruneTimer) return;
    notificationPruneTimer = window.setInterval(() => {
      if (FMG.NotificationManager?.prune(FMG.gameState)) render();
    }, 1000);
  }

  function unmountCurrentPhaseRoute() {
    const phaseUnmounts = {
      [FMG.ROUTES.phase15]: FMG.unmountPhase15,
      [FMG.ROUTES.phase16]: FMG.unmountPhase16,
      [FMG.ROUTES.phase17]: FMG.unmountPhase17,
      [FMG.ROUTES.phase18]: FMG.unmountPhase18,
      [FMG.ROUTES.phase19]: FMG.unmountPhase19,
      [FMG.ROUTES.phase20]: FMG.unmountPhase20,
      [FMG.ROUTES.phase21]: FMG.unmountPhase21,
      [FMG.ROUTES.phase22]: FMG.unmountPhase22,
      [FMG.ROUTES.phase23]: FMG.unmountPhase23,
      [FMG.ROUTES.phase24]: FMG.unmountPhase24
    };
    phaseUnmounts[FMG.gameState.route]?.();
  }

  const PHASE_ACTION_HANDLERS = [
    () => FMG.handlePhase15Action,
    () => FMG.handlePhase16Action,
    () => FMG.handlePhase17Action,
    () => FMG.handlePhase18Action,
    () => FMG.handlePhase19Action,
    () => FMG.handlePhase20Action,
    () => FMG.handlePhase21Action,
    () => FMG.handlePhase22Action,
    () => FMG.handlePhase23Action,
    () => FMG.handlePhase24Action
  ];

  const ACTION_HANDLERS = {
    "select-club": ({ target }) => FMG.selectClub(target.dataset.teamId),
    "finish-onboarding": () => {
      localStorage.setItem("fmg-onboarding-done", "1");
      authorizedGameStateWrite(() => {
        FMG.gameState.route = FMG.ROUTES.dashboard;
        FMG.gameState.selectionMode = true;
      });
    },
    "import-save-start": () => {
      localStorage.setItem("fmg-onboarding-done", "1");
      authorizedGameStateWrite(() => {
        FMG.gameState.route = FMG.ROUTES.settings;
        FMG.gameState.selectionMode = false;
      });
    },
    "change-route": ({ target }) => {
      if (!confirmSandboxOptIn(target.dataset.route)) return false;
      unmountCurrentPhaseRoute();
      authorizedGameStateWrite(() => {
        FMG.gameState.route = target.dataset.route;
        if (target.dataset.route === FMG.ROUTES.settings || target.dataset.route === FMG.ROUTES.credits) FMG.gameState.selectionMode = false;
      });
      syncBrowserRoute(target.dataset.route);
    },
    "advance-week": () => {
      const result = FMG.advanceWeek();
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "start-live-match": () => FMG.pushNotification(FMG.startLiveUserMatch().message),
    "toggle-live-playback": () => {
      const liveMatch = FMG.gameState.liveMatch;
      if (liveMatch && !liveMatch.completed) {
        liveMatch.paused = !liveMatch.paused;
        FMG.pushNotification(liveMatch.paused ? "Partido pausado." : "Partido en reproduccion.");
      }
    },
    "advance-live-minute": () => {
      const liveMatch = FMG.gameState.liveMatch;
      if (liveMatch) liveMatch.paused = true;
      const result = FMG.advanceLiveUserMatch(1);
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "advance-live-match": () => {
      const liveMatch = FMG.gameState.liveMatch;
      if (liveMatch) liveMatch.paused = true;
      const result = FMG.advanceLiveUserMatch(FMG.gameState.liveMatch ? FMG.gameState.liveMatch.speed : 5);
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "advance-live-half": () => {
      const liveMatch = FMG.gameState.liveMatch;
      if (liveMatch && !liveMatch.completed) {
        liveMatch.paused = true;
        const targetMinute = liveMatch.minute < 45 ? 45 : 90;
        const steps = Math.max(0, targetMinute - liveMatch.minute);
        if (steps > 0) {
          const result = FMG.advanceLiveUserMatch(steps);
          if (!result.ok) FMG.pushNotification(result.message);
        }
      }
    },
    "simulate-live-full": () => {
      const liveMatch = FMG.gameState.liveMatch;
      if (liveMatch) liveMatch.paused = true;
      const result = FMG.advanceLiveUserMatch(liveMatch ? 90 - liveMatch.minute : 90);
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "finish-live-match": () => {
      FMG.pushNotification(FMG.finishLiveUserMatch().message);
      FMG.matchVisualController.dispose();
      FMG._visualizerInitialized = false;
    },
    "set-live-speed": ({ target }) => {
      FMG.pushNotification(FMG.setLiveMatchSpeed(Number(target.dataset.speed)).message);
      scheduleLivePlaybackLoop();
    },
    "live-tactic": ({ target }) => FMG.pushNotification(FMG.applyLiveTacticalShift(target.dataset.mode).message),
    "live-team-order": ({ target }) => FMG.pushNotification(FMG.setLiveTeamOrder(target.dataset.group, target.dataset.value).message),
    "live-player-order": ({ target }) => FMG.pushNotification(FMG.setLivePlayerOrder(target.dataset.playerId, target.dataset.order).message),
    "live-substitution": ({ target }) => FMG.pushNotification(FMG.makeLiveSubstitution(target.dataset.outPlayerId, target.dataset.inPlayerId).message),
    "select-sub-out": ({ target }) => {
      authorizedGameStateWrite(() => {
        FMG.gameState.ui = FMG.gameState.ui || {};
      });
      FMG.gameState.ui.selectedSubOutId = target.dataset.playerId;
    },
    "save-game": () => {
      const result = FMG.saveGame();
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "load-game": () => {
      const result = authorizedGameStateWrite(() => FMG.loadGame());
      if (!result.ok) FMG.pushNotification(result.message);
    },
    "take-bank-loan": ({ target }) => {
      if (!target.dataset.confirm && !window.confirm("Solicitar prestamo bancario por 30.000.000 CLP?")) return false;
      FMG.pushNotification(FMG.takeBankLoan(FMG.gameState, FMG.FINANCE_CONSTANTS.defaultBankLoanAmount).message);
    },
    "negotiate-sponsor": () => FMG.pushNotification(FMG.negotiateSponsor(FMG.gameState).message),
    "upgrade-infrastructure": ({ target }) => FMG.pushNotification(FMG.upgradeInfrastructure(FMG.gameState, target.dataset.area).message),
    "upgrade-staff": ({ target }) => FMG.pushNotification(FMG.upgradeStaff(FMG.gameState, target.dataset.area).message),
    "set-manager-style": ({ target }) => {
      FMG.gameState.managerProfile.style = target.dataset.style;
      FMG.pushNotification(`Estilo de manager: ${FMG.MANAGER_STYLES[target.dataset.style].label}.`);
    },
    "generate-career-offers": () => {
      const offers = FMG.generateCareerOffers(FMG.gameState, { force: true, reason: "manual" });
      FMG.pushNotification(offers.length ? "Llegaron nuevas ofertas de clubes." : "No hay clubes interesados esta semana.");
    },
    "accept-career-offer": ({ target }) => {
      if (!target.dataset.confirm && !window.confirm("Aceptar esta oferta y cambiar de club?")) return false;
      FMG.pushNotification(FMG.acceptCareerOffer(FMG.gameState, target.dataset.offerId).message);
    },
    "create-career-decision": () => {
      const decision = FMG.createNarrativeDecision(FMG.gameState);
      FMG.pushNotification(`Nueva decision: ${decision.title}.`);
    },
    "resolve-career-decision": ({ target }) => FMG.pushNotification(FMG.resolveNarrativeDecision(FMG.gameState, target.dataset.decisionId, target.dataset.choiceId).message),
    "set-news-filter": ({ target }) => FMG.setNewsFilter(FMG.gameState, target.dataset.filter),
    "set-table-sort": ({ target }) => FMG.setTableViewOption(FMG.gameState, "sort", target.dataset.sort),
    "set-table-filter": ({ target }) => FMG.setTableViewOption(FMG.gameState, "filter", target.dataset.filter),
    "set-calendar-filter": ({ target }) => FMG.setCalendarFilter(FMG.gameState, target.dataset.filter),
    "select-rival-club": ({ target }) => FMG.pushNotification(FMG.selectRivalClub(FMG.gameState, target.dataset.teamId).message),
    "update-setting": ({ target }) => FMG.pushNotification(FMG.updateGameSetting(FMG.gameState, target.dataset.setting, target.dataset.value).message),
    "save-slot": ({ target }) => FMG.pushNotification(FMG.saveToSlot(FMG.gameState, target.dataset.slotId, { overwrite: true }).message),
    "load-slot": async ({ target }) => {
      const btn = target.closest("button") || target;
      const originalText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Cargando...";

      try {
        FMG.openWriteToken?.();
        const result = FMG.loadFromSlotAsync
          ? await FMG.loadFromSlotAsync(target.dataset.slotId)
          : FMG.loadFromSlot(target.dataset.slotId);
        FMG.closeWriteToken?.();

        FMG.pushNotification(result.message);
      } finally {
        FMG.closeWriteToken?.();
        btn.disabled = false;
        btn.textContent = originalText;
      }
    },
    "import-save": ({ target }) => {
      const payload = document.querySelector("[data-role='import-payload']")?.value || "";
      FMG.pushNotification(authorizedGameStateWrite(() => FMG.importSave(payload, target.dataset.slotId)).message);
    },
    "export-save": () => {
      const blob = new Blob([FMG.exportSave(FMG.gameState)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const exportTick = FMG.simulationClock ? FMG.simulationClock.tick("export") : FMG.tickMs ? FMG.tickMs("export") : Date.UTC(2025, 0, 1, 12, 0, 0);
      link.download = `football-manager-chile-${exportTick}.json`;
      link.click();
      URL.revokeObjectURL(url);
      FMG.pushNotification("Partida exportada como archivo.", "info");
    },
    "safe-reset": () => {
      authorizedGameStateWrite(() => FMG.initializeGame(FMG.gameState.teams, FMG.gameState.players));
      FMG.pushNotification("Partida reiniciada. Los slots guardados se conservan.");
    },
    "generate-world-news": () => {
      const created = FMG.generateContextualWeeklyNews(FMG.gameState, null);
      FMG.pushNotification(created.length ? `Mundo actualizado con ${created.length} noticia(s).` : "No surgieron nuevas historias esta semana.");
    },
    "generate-market-rumors": () => {
      const rumors = FMG.generateMarketRumors(FMG.gameState);
    FMG.pushNotification(rumors.length ? "La red de observacion filtro nuevos rumores." : "No hay rumores nuevos por ahora.");
    },
    "refresh-market": () => FMG.pushNotification(FMG.refreshTransferMarket(FMG.gameState).message),
    "create-transfer-offer": ({ target }) => {
      const player = FMG.gameState.players.find((item) => item.id === target.dataset.playerId);
      const role = player && player.overall >= 76 ? "starter" : "rotation";
      FMG.pushNotification(FMG.createTransferOffer(FMG.gameState, target.dataset.playerId, { transferType: target.dataset.transferType, role }).message);
    },
    "create-loan-offer": ({ target }) => FMG.pushNotification(FMG.createTransferOffer(FMG.gameState, target.dataset.playerId, { transferType: "loan", role: "rotation" }).message),
    "resolve-negotiation": ({ target }) => FMG.pushNotification(FMG.resolveTransferNegotiation(FMG.gameState, target.dataset.negotiationId).message),
    "generate-incoming-offers": () => {
      const offers = FMG.generateIncomingOffers(FMG.gameState);
      FMG.pushNotification(offers.length ? "Llegaron nuevas ofertas por jugadores." : "No llegaron ofertas nuevas.");
    },
    "accept-incoming-offer": ({ target }) => {
      if (!target.dataset.confirm && !window.confirm("Aceptar venta del jugador?")) return false;
      FMG.pushNotification(FMG.respondIncomingOffer(FMG.gameState, target.dataset.offerId, true).message);
    },
    "reject-incoming-offer": ({ target }) => FMG.pushNotification(FMG.respondIncomingOffer(FMG.gameState, target.dataset.offerId, false).message),
    "set-formation": ({ target }) => FMG.pushNotification(FMG.setFormation(FMG.gameState, target.dataset.formation).message),
    "set-training": ({ target }) => FMG.pushNotification(FMG.setTrainingFocus(FMG.gameState, target.dataset.focus).message),
    "set-team-tactic": ({ target }) => FMG.pushNotification(FMG.setTeamTactic(FMG.gameState, target.dataset.tacticKey, target.dataset.tacticValue).message),
    "set-position-role": ({ target }) => FMG.pushNotification(FMG.setPositionRole(FMG.gameState, target.dataset.position, target.dataset.role).message),
    "set-player-instruction": ({ target }) => FMG.pushNotification(FMG.setPlayerInstruction(FMG.gameState, target.dataset.playerId, target.dataset.instruction).message),
    "set-squad-role": ({ target }) => FMG.pushNotification(FMG.setSquadRole(FMG.gameState, target.dataset.playerId, target.dataset.role).message),
    "set-captain": ({ target }) => FMG.pushNotification(FMG.setCaptain(FMG.gameState, target.dataset.playerId).message),
    "select-squad-player": ({ target }) => {
      FMG.pushNotification(FMG.selectSquadPlayer(FMG.gameState, target.dataset.playerId).message);
      authorizedGameStateWrite(() => {
        FMG.gameState.route = FMG.ROUTES.player;
      });
    },
    "set-squad-filter": ({ target }) => FMG.setSquadView(FMG.gameState, "filter", target.dataset.filter),
    "set-squad-sort": ({ target }) => FMG.setSquadView(FMG.gameState, "sort", target.dataset.sort),
    "renew-contract": ({ target }) => {
      const player = FMG.gameState.players.find((item) => item.id === target.dataset.playerId);
      FMG.pushNotification(FMG.renewPlayerContract(FMG.gameState, target.dataset.playerId, {
        role: player ? player.squadRole : "rotation",
        years: 3
      }).message);
    },
    "train-squad": () => FMG.pushNotification(FMG.trainUserSquad(FMG.gameState).message),
    "new-season": ({ target }) => {
      if (!target.dataset.confirm && !window.confirm("Iniciar una nueva temporada?")) return false;
      FMG.pushNotification(FMG.startNewSeason().message);
    },
    "buy-player": ({ target }) => FMG.pushNotification(FMG.buyPlayer(FMG.gameState, target.dataset.playerId).message),
    "sell-player": ({ target }) => {
      if (!target.dataset.confirm && !window.confirm("Poner en venta a este jugador?")) return false;
      FMG.pushNotification(FMG.sellPlayer(FMG.gameState, target.dataset.playerId).message);
    },
    "dismiss-toast": ({ target }) => FMG.dismissNotification(target.dataset.id),
    "answer-press-conference": ({ target }) => {
      const conferenceId = target.dataset.conferenceId;
      const questionIdx = Number(target.dataset.questionIdx);
      const choiceIdx = Number(target.dataset.choiceIdx);
      if (!conferenceId) return;
      const answers = {};
      answers[questionIdx] = choiceIdx;
      const result = FMG.answerPressConference ? FMG.answerPressConference(FMG.gameState, conferenceId, answers) : { ok: false, message: "No disponible." };
      FMG.pushNotification(result.message);
    },
    "resolve-loyalty-conflict": ({ target }) => {
      const conflictId = target.dataset.conflictId;
      const decision = target.dataset.decision;
      if (!conflictId || !decision) return;
      const result = FMG.resolveLoyaltyConflict ? FMG.resolveLoyaltyConflict(FMG.gameState, conflictId, decision) : { ok: false, message: "No disponible." };
      FMG.pushNotification(result.message);
    }
  };

  async function handleAction(action, target) {
    if (!action) return;
    if (target.dataset.confirm && !window.confirm(target.dataset.confirm)) return;
    const activeAction = document.activeElement?.dataset?.action;
    const handler = ACTION_HANDLERS[action];
    if (handler) {
      if (await handler({ target, action }) === false) return;
    } else if (PHASE_ACTION_HANDLERS.some((resolveHandler) => {
      const phaseHandler = resolveHandler();
      return phaseHandler && phaseHandler(action);
    })) {
      return;
    }
    if (["save-slot", "buy-player", "finish-live-match"].includes(action)) FMG.UIAudio?.confirm();
    render();
    if (["change-route", "finish-onboarding", "import-save-start", "select-squad-player", "load-game", "load-slot"].includes(action)) {
      requestAnimationFrame(() => focusRouteHeading());
    }
    if (activeAction) {
      const el = document.querySelector(`[data-action="${activeAction}"]`);
      if (el) el.focus();
    }
    requestAnimationFrame(() => syncLiveVisualizer());
  }

  let _lastAction = 0;
  document.addEventListener("click", (event) => {
    ensureMenuAudio();
    const now = performance.now();
    if (now - _lastAction < 300) return;
    _lastAction = now;
    const target = event.target.closest("[data-action]");
    if (target) handleAction(target.dataset.action, target);
  });

  window.addEventListener("popstate", (event) => {
    const route = event.state?.route || routeFromLocation();
    if (!route || !FMG.gameState || FMG.gameState.route === route) return;
    unmountCurrentPhaseRoute();
    authorizedGameStateWrite(() => {
      FMG.gameState.route = route;
      FMG.gameState.selectionMode = !FMG.gameState.userTeamId && route !== FMG.ROUTES.settings;
    });
    render();
    requestAnimationFrame(() => focusRouteHeading());
    requestAnimationFrame(() => syncLiveVisualizer());
  });

  async function boot() {
    try {
      const seed = await loadSeedData();
      FMG.initializeGame(seed.teams, seed.players);
      if (FMG.Core?.initialize && !FMG.Core.isInitialized?.()) {
        FMG.Core.initialize({ diagnostics: { scaling: { profile: "low-end" } } });
      }
      if (FMG.protectGameState && !FMG._gameStateProtected) {
        FMG.openWriteToken();
        FMG.gameState = FMG.protectGameState(FMG.gameState);
        FMG.closeWriteToken();
        FMG._gameStateProtected = true;
      }
      if (isDebugMode) FMG.Core?.diagnostics?.enableOverlay(true);
      if (!localStorage.getItem("fmg-onboarding-done")) {
        authorizedGameStateWrite(() => {
          FMG.gameState.route = FMG.ROUTES.onboarding;
        });
      }
      const browserRoute = routeFromLocation();
      if (browserRoute && localStorage.getItem("fmg-onboarding-done")) {
        authorizedGameStateWrite(() => {
          FMG.gameState.route = browserRoute;
          FMG.gameState.selectionMode = !FMG.gameState.userTeamId && browserRoute !== FMG.ROUTES.settings;
        });
      }
      syncBrowserRoute(FMG.gameState.route, { replace: true });
      render();
      requestAnimationFrame(() => focusRouteHeading());
      startNotificationPruner();
      hideLoadingScreen();
    } catch (error) {
      hideLoadingScreen();
      app.innerHTML = `
        <section class="panel error-screen">
          <h1>No se pudieron cargar los datos del juego</h1>
          <p class="hero-copy">Para jugar Football Manager Chile, el juego debe ejecutarse desde un servidor web, no directamente desde tu computador.</p>
          <h2>Opciones rapidas:</h2>
          <ol>
            <li><strong>VS Code:</strong> instala Live Server y abre index.html con "Open with Live Server".</li>
            <li><strong>Python:</strong> ejecuta <code>python -m http.server 8080</code> y abre <code>localhost:8080</code>.</li>
            <li><strong>Node.js:</strong> ejecuta <code>npx serve .</code> en la carpeta del juego.</li>
          </ol>
        </section>`;
      console.error(error);
    }
  }

  startNotificationPruner();
  boot();
})();
