(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderDashboard = function (state, helpers) {
    const squad = state.players.filter((player) => player.teamId === state.userTeamId);
    const avgOverall = squad.length ? Math.round(squad.reduce((sum, player) => sum + player.overall, 0) / squad.length) : 0;
    const avgEnergy = squad.length ? Math.round(squad.reduce((sum, player) => sum + (player.energy || 100), 0) / squad.length) : 0;
    const avgMorale = squad.length ? Math.round(squad.reduce((sum, player) => sum + (player.morale || 70), 0) / squad.length) : 0;
    const userSide = state.currentMatch?.homeTeamId === state.userTeamId ? "home" : "away";
    const userEvents = state.currentMatch?.[userSide === "home" ? "homeEvents" : "awayEvents"] || [];
    const topScorer = state.currentMatch ? userEvents[0]?.scorer || "Sin registros de tu equipo" : "Sin registros";
    const nextOpponent = helpers.nextOpponent;
    const position = state.standings.findIndex((entry) => entry.teamId === state.userTeamId) + 1;
    const progress = state.totalWeeks ? (state.completedWeeks / state.totalWeeks) * 100 : 0;
    const plan = FMG.getTeamPlan(state, state.userTeamId);

    return `
      <section class="hero">
        <div class="panel hero-main">
          <span class="eyebrow">Temporada en marcha</span>
          <div class="club-heading">${FMG.clubBadge(state.userClub, "lg")}<h1 class="hero-title">${FMG.escapeHtml(state.userClub.name)}</h1></div>
          <p class="hero-copy">Administra presupuesto, mercado y vestuario para competir por la liga. Cada semana mezcla futbol, riesgo financiero y decisiones de plantilla.</p>
          <div class="chips">
            <span class="chip">${FMG.escapeHtml(state.userClub.city)}</span>
            <span class="chip">Estadio ${FMG.escapeHtml(state.userClub.stadium)}</span>
            <span class="chip">Estilo ${FMG.escapeHtml(state.userClub.style)}</span>
          </div>
          <div class="hero-actions">
            ${avgEnergy < 60 || avgMorale < 45 ? `<div class="empty-state alert-state">Plantel en zona de riesgo: energia ${avgEnergy}/100, moral ${avgMorale}/100.</div>` : ""}
            <button class="btn-primary" data-action="advance-week" aria-label="Simular semana completa">Simular semana</button>
            ${state.seasonComplete ? `<button class="btn-primary" data-action="new-season" data-confirm="Iniciar temporada ${state.seasonNumber + 1}?">Nueva temporada</button>` : ""}
            <button class="btn-secondary" data-action="change-route" data-route="${FMG.ROUTES.settings}">Gestionar guardados</button>
          </div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">Saldo disponible</div><div class="stat-value">${FMG.currency(state.finances.balance)}</div></article>
            <article class="stat-card"><div class="muted">Posición actual</div><div class="stat-value">${position || "-"}</div></article>
            <article class="stat-card"><div class="muted">Media de plantilla</div><div class="stat-value">${avgOverall}</div></article>
            <article class="stat-card"><div class="muted">Sistema</div><div class="stat-value">${FMG.escapeHtml(plan.formation)}</div></article>
            <article class="stat-card"><div class="muted">Energía ${avgEnergy < 60 ? "!" : ""}</div><div class="stat-value">${avgEnergy}</div></article>
            <article class="stat-card"><div class="muted">Moral ${avgMorale < 45 ? "!" : ""}</div><div class="stat-value">${avgMorale}</div></article>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Próxima fecha</h2><span class="chip">Semana ${state.currentWeek}</span></div>
            ${
              state.seasonComplete
                ? `<p><strong>Campeon: ${FMG.escapeHtml(state.champion ? state.champion.name : "Por definir")}</strong></p>
                   <p class="muted">La temporada actual ya fue completada.</p>
                   <div class="progress"><span style="width:100%"></span></div>`
                : nextOpponent
                  ? `<p><strong>${FMG.escapeHtml(state.userClub.name)}</strong> vs <strong>${FMG.escapeHtml(nextOpponent.name)}</strong></p>
                     <p class="muted">Semana ${nextOpponent.week} | ${FMG.escapeHtml(nextOpponent.city)} | Forma ${nextOpponent.form}/20</p>
                     <div class="progress"><span style="width:${progress}%"></span></div>`
                  : `<div class="empty-state">Tu club descansa en la próxima fecha.</div>`
            }
          </section>
          <section class="panel">
            <div class="section-title"><h2>Radar rápido</h2></div>
            <div class="log-list">
              <div class="log-item"><strong>Último protagonista</strong><p class="muted">${FMG.escapeHtml(topScorer)}</p></div>
              <div class="log-item"><strong>Mercado</strong><p class="muted">${state.market.windowOpen ? "Ventana abierta" : "Ventana cerrada"}</p></div>
              <div class="log-item"><strong>Afición</strong><p class="muted">${state.userClub.fanBase.toLocaleString("es-CL")} hinchas base</p></div>
              <div class="log-item"><strong>Patrocinio</strong><p class="muted">${FMG.currency(state.userClub.sponsor)}</p></div>
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Bitacora reciente</h2></div>
          <div class="log-list">
            ${
              state.seasonLog.length
                ? state.seasonLog.map((entry) => `
                    <div class="log-item">
                      <strong>Semana ${entry.week}</strong>
                      <p class="muted">${FMG.escapeHtml(entry.headline)}</p>
                      <p class="muted">${FMG.escapeHtml(entry.event ? entry.event.detail : "Sin evento extraordinario.")}</p>
                    </div>`).join("")
              : `<div class="empty-state">Aún no hay actividad. Pulsa <strong>Simular semana</strong> para arrancar la temporada.</div>`
            }
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Top liga</h2></div>
          <div class="table">
            <div class="table-row header"><span>#</span><span>Equipo</span><span>Pts</span><span>DG</span><span>GF</span><span>PJ</span></div>
            ${state.standings.slice(0, 5).map((entry, index) => `
              <div class="table-row">
                <span>${index + 1}</span><span>${FMG.escapeHtml(entry.name)}</span><span>${entry.points}</span><span>${entry.goalDifference}</span><span>${entry.goalsFor}</span><span>${entry.played}</span>
              </div>`).join("")}
          </div>
        </section>
      </section>
      <section class="card">
        <div class="section-title"><h2>Historial</h2><span class="chip">Temporada ${state.seasonNumber}</span></div>
        <div class="log-list">
          ${
            state.seasonHistory.length
              ? state.seasonHistory.map((entry) => `
                <div class="log-item">
                  <strong>Temporada ${entry.seasonNumber}: ${FMG.escapeHtml(entry.championName)}</strong>
                  <p class="muted">${FMG.escapeHtml(entry.userTeamName)} termino ${entry.userPosition || "-"} con ${entry.userPoints} pts.</p>
                </div>`).join("")
              : `<div class="empty-state">Aquí aparecerán tus temporadas cerradas. Completa la actual primero.</div>`
          }
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Movimiento rival</h2><span class="chip">IA clubes</span></div>
        <div class="log-list">
          ${
            state.rivalAI && state.rivalAI.log && state.rivalAI.log.length
              ? state.rivalAI.log.slice(0, 8).map((entry) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(entry.teamName)} | ${FMG.escapeHtml(entry.title)}</strong>
                  <p class="muted">Semana ${entry.week}</p>
                  <p class="muted">${FMG.escapeHtml(entry.detail)}</p>
                </div>`).join("")
              : `<div class="empty-state">Los rivales comenzarán a moverse a partir de la semana 2.</div>`
          }
        </div>
      </section>
      <section class="card">
        <details>
          <summary><strong>Centro de notificaciones</strong></summary>
          <div class="log-list" style="margin-top:12px;">
            ${(state.notificationLog || []).slice(0, 12).map((entry) => {
              const icons = { achievement: "LOGRO", injury: "LESION", transfer: "FICHAJE", warning: "ALERTA", info: "INFO" };
              return `<div class="log-item"><strong>${icons[entry.type] || "INFO"}</strong><p class="muted">${FMG.escapeHtml(entry.message)}</p></div>`;
            }).join("") || `<div class="empty-state">Aún no hay notificaciones registradas.</div>`}
          </div>
        </details>
      </section>
    `;
  };
})();
