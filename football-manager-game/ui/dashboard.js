(function () {
  const FMG = (window.FMG = window.FMG || {});

  function trendIndicator(history, key, currentValue, options = {}) {
    const previous = [...(history || [])].reverse().find((entry) => Number.isFinite(Number(entry[key])));
    if (!previous) return "";
    const previousValue = Number(previous[key]);
    const current = Number(currentValue);
    if (!Number.isFinite(current) || current === previousValue) return `<span class="trend trend-flat">=</span>`;
    const improved = options.lowerIsBetter ? current < previousValue : current > previousValue;
    const arrow = current > previousValue ? "↑" : "↓";
    return `<span class="trend ${improved ? "trend-up" : "trend-down"}">${arrow} ${Math.abs(current - previousValue)}</span>`;
  }

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
    const drama = FMG.ensureSeasonDramaState ? FMG.ensureSeasonDramaState(state) : (state.seasonDrama || {});
    const challenges = FMG.generateManagerLiveChallenges ? FMG.generateManagerLiveChallenges(state) : ((state.liveChallenges && state.liveChallenges.manager) || []);
    const tension = drama.preMatchTension;
    const canPlayLive = !state.seasonComplete && !state.liveMatch;

    return `
      <section class="hero">
        <div class="panel hero-main football-priority">
          <span class="eyebrow">Temporada en marcha</span>
          <div class="club-heading">${FMG.clubBadge(state.userClub, "lg")}<h1 class="hero-title">${FMG.escapeHtml(state.userClub.name)}</h1></div>
          <p class="hero-copy">La semana se juega en la cancha, en el camarín y en la tribuna. Decide con cabeza fría cuando el club empiece a sentir el ruido.</p>
          <div class="chips">
            <span class="chip">${FMG.escapeHtml(state.userClub.city)}</span>
            <span class="chip">Estadio ${FMG.escapeHtml(state.userClub.stadium)}</span>
            <span class="chip">Estilo ${FMG.escapeHtml(state.userClub.style)}</span>
          </div>
          <div class="hero-actions">
            ${avgEnergy < 60 || avgMorale < 45 ? `<div class="empty-state alert-state">Plantel en zona de riesgo: energía ${avgEnergy}/100, moral ${avgMorale}/100.</div>` : ""}
            ${canPlayLive ? `<button class="btn-primary live-cta" data-action="start-live-match" aria-label="Jugar partido con visualizador integrado">Jugar partido en vivo</button>` : ""}
            <button class="btn-secondary" data-action="advance-week" aria-label="Simular semana completa">Simular semana</button>
            ${state.seasonComplete ? `<button class="btn-primary" data-action="new-season" data-confirm="Iniciar temporada ${state.seasonNumber + 1}?">Nueva temporada</button>` : ""}
            <button class="btn-secondary" data-action="change-route" data-route="${FMG.ROUTES.settings}">Gestionar guardados</button>
          </div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">Saldo disponible</div><div class="stat-value">${FMG.currency(state.finances.balance)}</div></article>
            <article class="stat-card"><div class="muted">Posición actual ${trendIndicator(state.dashboardHistory, "position", position, { lowerIsBetter: true })}</div><div class="stat-value">${position || "-"}</div></article>
            <article class="stat-card"><div class="muted">Media de plantilla</div><div class="stat-value">${avgOverall}</div></article>
            <article class="stat-card"><div class="muted">Sistema</div><div class="stat-value">${FMG.escapeHtml(plan.formation)}</div></article>
            <article class="stat-card"><div class="muted">Energía ${avgEnergy < 60 ? "!" : ""} ${trendIndicator(state.dashboardHistory, "energy", avgEnergy)}</div><div class="stat-value">${avgEnergy}</div></article>
            <article class="stat-card"><div class="muted">Moral ${avgMorale < 45 ? "!" : ""} ${trendIndicator(state.dashboardHistory, "morale", avgMorale)}</div><div class="stat-value">${avgMorale}</div></article>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Próxima fecha</h2><span class="chip">Semana ${state.currentWeek}</span></div>
            ${
              state.seasonComplete
                ? `<p><strong>Campeón: ${FMG.escapeHtml(state.champion ? state.champion.name : "Por definir")}</strong></p>
                   <p class="muted">La temporada actual ya fue completada.</p>
                   <div class="progress"><span style="width:100%"></span></div>`
                : nextOpponent
                  ? `<p><strong>${FMG.escapeHtml(state.userClub.name)}</strong> vs <strong>${FMG.escapeHtml(nextOpponent.name)}</strong></p>
                     <p class="muted">Semana ${nextOpponent.week} | ${FMG.escapeHtml(nextOpponent.city)} ya mira el duelo | Forma rival ${nextOpponent.form}/20</p>
                     <div class="progress"><span style="width:${progress}%"></span></div>`
                  : `<div class="empty-state">Tu club descansa en la próxima fecha.</div>`
            }
          </section>
          ${tension ? `<section class="panel pre-match-tension">
            <div class="section-title"><h2>${FMG.escapeHtml(tension.label)}</h2><span class="chip tension-chip">${Math.round(tension.tension)}/100</span></div>
            <p><strong>${FMG.escapeHtml(tension.homeTeamName)} vs ${FMG.escapeHtml(tension.awayTeamName)}</strong></p>
            <p class="muted">${FMG.escapeHtml(tension.detail)}</p>
            <div class="progress tension-progress"><span style="width:${FMG.clamp(tension.tension, 0, 100)}%"></span></div>
          </section>` : ""}
          <section class="panel">
            <div class="section-title"><h2>Radar rápido</h2></div>
            <div class="log-list">
              <div class="log-item"><strong>Último protagonista</strong><p class="muted">${FMG.escapeHtml(topScorer)}</p></div>
              <div class="log-item"><strong>Mercado</strong><p class="muted">${state.market.windowOpen ? "La dirigencia tiene margen para moverse" : "La plantilla queda en manos del trabajo semanal"}</p></div>
              <div class="log-item"><strong>Hinchada</strong><p class="muted">${state.userClub.fanBase.toLocaleString("es-CL")} hinchas base</p></div>
              <div class="log-item"><strong>Patrocinio</strong><p class="muted">${FMG.currency(state.userClub.sponsor)}</p></div>
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Bitácora reciente</h2></div>
          <div class="log-list">
            ${
              state.seasonLog.length
                ? state.seasonLog.slice(0, 6).map((entry) => `
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
          <div class="section-title"><h2>Podio en tiempo real</h2><span class="chip">Tabla viva</span></div>
          <div class="table">
            <div class="table-row header"><span>#</span><span>Equipo</span><span>Pts</span><span>DG</span><span>GF</span><span>PJ</span></div>
            ${state.standings.slice(0, 5).map((entry, index) => `
              <div class="table-row club-tinted-row subtle" style="--club-primary:${FMG.getClubIdentity(entry.teamId).primary};--club-secondary:${FMG.getClubIdentity(entry.teamId).secondary};--club-accent:${FMG.getClubIdentity(entry.teamId).accent};">
                <span>${index + 1}</span><span>${FMG.escapeHtml(entry.name)}</span><span>${entry.points}</span><span>${entry.goalDifference}</span><span>${entry.goalsFor}</span><span>${entry.played}</span>
              </div>`).join("")}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Desafios de temporada</h2><span class="chip">Live</span></div>
          <div class="log-list">
            ${challenges.filter((challenge) => challenge.status === "active").slice(0, 3).map((challenge) => {
              const pct = FMG.clamp(Math.round(((challenge.progress || 0) / Math.max(1, challenge.target || 1)) * 100), 0, 100);
              return `<div class="log-item challenge-card">
                <strong>${FMG.escapeHtml(challenge.title)}</strong>
                <p class="muted">${FMG.escapeHtml(challenge.detail)}</p>
                <p class="muted">Recompensa: ${FMG.escapeHtml(challenge.reward)}</p>
                <div class="progress"><span style="width:${pct}%"></span></div>
              </div>`;
            }).join("") || `<div class="empty-state">No hay desafios activos.</div>`}
          </div>
        </section>
      </section>
      ${(drama.moments || []).length || (drama.consequences || []).length ? `<details class="ux-disclosure" open>
        <summary>Momentos wow y consecuencias inmediatas</summary>
        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Momentos de temporada</h2><span class="chip">${(drama.moments || []).filter((item) => item.seasonNumber === state.seasonNumber).length}/3 esta temporada</span></div>
            <div class="log-list">
              ${(drama.moments || []).slice(0, 6).map((item) => `
                <div class="log-item wow-moment">
                  <strong>Semana ${item.week}: ${FMG.escapeHtml(item.title)}</strong>
                  <p class="muted">${FMG.escapeHtml(item.detail)}</p>
                </div>`).join("") || `<div class="empty-state">Los grandes momentos apareceran cuando la temporada se rompa.</div>`}
            </div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Consecuencias visibles</h2><span class="chip">${(drama.consequences || []).length}</span></div>
            <div class="log-list">
              ${(drama.consequences || []).slice(0, 6).map((item) => `
                <div class="log-item consequence-card tone-${FMG.escapeHtml(item.tone || "neutral")}">
                  <strong>${FMG.escapeHtml(item.actor)} | ${FMG.escapeHtml(item.title)}</strong>
                  <p class="muted">${FMG.escapeHtml(item.detail)}</p>
                </div>`).join("") || `<div class="empty-state">Las decisiones fuertes dejaran huella aqui.</div>`}
            </div>
          </section>
        </section>
      </details>` : ""}
      <details class="ux-disclosure">
        <summary>Historial de temporadas</summary>
        <section class="card">
          <div class="section-title"><h2>Historial</h2><span class="chip">Temporada ${state.seasonNumber}</span></div>
          <div class="log-list">
            ${
              state.seasonHistory.length
                ? state.seasonHistory.map((entry) => `
                  <div class="log-item">
                    <strong>Temporada ${entry.seasonNumber}: ${FMG.escapeHtml(entry.championName)}</strong>
                    <p class="muted">${FMG.escapeHtml(entry.userTeamName)} terminó ${entry.userPosition || "-"} con ${entry.userPoints} pts.</p>
                  </div>`).join("")
                : `<div class="empty-state">Aquí aparecerán tus temporadas cerradas. Completa la actual primero.</div>`
            }
          </div>
        </section>
      </details>
      ${(function () {
        const reactions = (state.fanReactions || []).slice(0, 4);
        const loyaltyConflicts = FMG.getLoyaltyConflicts ? FMG.getLoyaltyConflicts(state) : [];
        const dressingEvents = (state.dressingRoomEvents || []).filter(function (e) { return !e.resolved; }).slice(0, 3);
        if (!reactions.length && !loyaltyConflicts.length && !dressingEvents.length) return "";
        return `<details class="ux-disclosure" open>
          <summary>Pulso de la hinchada y vestuario</summary>
          <section class="content-grid">
            <section class="card">
              <div class="section-title"><h2>Pulso de la hinchada</h2><span class="chip">${reactions.length} reacciones</span></div>
              <div class="log-list">
                ${reactions.length ? reactions.map(function (r) { return `
                  <div class="log-item">
                    <strong>${FMG.escapeHtml(r.icon || "")} ${FMG.escapeHtml(r.title)}</strong>
                    <p class="muted">${FMG.escapeHtml(r.body)}</p>
                    <p class="muted">${r.positive ? "Efecto positivo" : "Efecto negativo"} | ${FMG.escapeHtml(r.mechanical || "")}</p>
                  </div>`;}).join("") : `<div class="empty-state">La hinchada esta en calma.</div>`}
              </div>
            </section>
            <section class="card">
              <div class="section-title"><h2>Vestuario</h2><span class="chip">${dressingEvents.length + loyaltyConflicts.length} pendientes</span></div>
              <div class="log-list">
                ${dressingEvents.map(function (e) { return `
                  <div class="log-item">
                    <strong>${FMG.escapeHtml(e.icon || "")} ${FMG.escapeHtml(e.title)}</strong>
                    <p class="muted">${FMG.escapeHtml(e.description)}</p>
                  </div>`;}).join("")}
                ${loyaltyConflicts.map(function (c) { return `
                  <div class="log-item">
                    <strong>⚖️ Dilema de lealtad: ${FMG.escapeHtml(c.playerName)}</strong>
                    <p class="muted">${FMG.escapeHtml(c.buyerTeamName)} ofrece ${FMG.currency ? FMG.currency(c.offerFee) : c.offerFee}. Decide en carrera.</p>
                  </div>`;}).join("")}
                ${!dressingEvents.length && !loyaltyConflicts.length ? `<div class="empty-state">El vestuario esta tranquilo.</div>` : ""}
              </div>
            </section>
          </section>
        </details>`;
      })()}
      <details class="ux-disclosure">
        <summary>Movimiento rival y notificaciones</summary>
        <section class="content-grid">
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
            <div class="section-title"><h2>Centro de notificaciones</h2></div>
            <div class="log-list">
              ${(state.notificationLog || []).slice(0, 12).map((entry) => {
                const icons = { achievement: "LOGRO", injury: "LESION", transfer: "FICHAJE", warning: "ALERTA", info: "INFO" };
                return `<div class="log-item"><strong>${icons[entry.type] || "INFO"}</strong><p class="muted">${FMG.escapeHtml(entry.message)}</p></div>`;
              }).join("") || `<div class="empty-state">Aún no hay notificaciones registradas.</div>`}
            </div>
          </section>
        </section>
      </details>
    `;
  };
})();
