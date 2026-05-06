(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderStatLine(label, homeValue, awayValue) {
    return `
      <div class="stat-line">
        <strong>${homeValue}</strong>
        <span>${label}</span>
        <strong>${awayValue}</strong>
      </div>
    `;
  }

  function renderLiveControls(liveMatch) {
    if (liveMatch.completed) {
      return `<div class="button-row"><button class="btn-primary" data-action="finish-live-match">Cerrar fecha</button></div>`;
    }
    return `
      <div class="button-row">
        <button class="btn-primary" data-action="advance-live-match">Avanzar ${liveMatch.speed} min</button>
        <button class="btn-secondary" data-action="advance-live-half">Avanzar al descanso/final</button>
        <button class="btn-ghost" data-action="simulate-live-full">Simular completo</button>
      </div>
      <div class="button-row">
        <button class="btn-ghost" data-action="set-live-speed" data-speed="3">x3</button>
        <button class="btn-ghost" data-action="set-live-speed" data-speed="5">x5</button>
        <button class="btn-ghost" data-action="set-live-speed" data-speed="10">x10</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="defend">Proteger area</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="balanced">Equilibrar</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="attack">Adelantar lineas</button>
      </div>
    `;
  }

  function renderLiveSubstitutions(state, liveMatch) {
    const userSide = liveMatch.homeTeamId === state.userTeamId ? "home" : "away";
    const lineupIds = userSide === "home" ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
    const benchIds = userSide === "home" ? liveMatch.homeBenchIds : liveMatch.awayBenchIds;
    const lineup = lineupIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
    const bench = benchIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
    const tired = [...lineup].sort((left, right) => left.energy - right.energy).slice(0, 5);

    return `
      <section class="card">
        <div class="section-title"><h2>Cambios</h2><span class="chip">${liveMatch.substitutions[userSide]}/5 usados</span></div>
        <div class="sub-grid">
          <div>
            <strong>Titulares cansados</strong>
            <div class="log-list" style="margin-top:12px;">
              ${tired.map((player) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p class="muted">${FMG.escapeHtml(player.position)} | Energia ${player.energy}</p>
                </div>`).join("")}
            </div>
          </div>
          <div>
            <strong>Banca disponible</strong>
            <div class="log-list" style="margin-top:12px;">
              ${bench.map((player) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p class="muted">${FMG.escapeHtml(player.position)} | Energia ${player.energy}</p>
                  <div class="button-row" style="margin-top:10px;">
                    ${tired.slice(0, 3).map((starter) => `<button class="btn-ghost" data-action="live-substitution" data-in-player-id="${player.id}" data-out-player-id="${starter.id}">Por ${FMG.escapeHtml(starter.name.split(" ")[0])}</button>`).join("")}
                  </div>
                </div>`).join("") || `<div class="empty-state">Sin suplentes disponibles.</div>`}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderLiveMatch(state) {
    const liveMatch = state.liveMatch;
    const homeTeam = state.teams.find((team) => team.id === liveMatch.homeTeamId);
    const awayTeam = state.teams.find((team) => team.id === liveMatch.awayTeamId);
    const result = liveMatch.result;
    const stats = result.stats;
    const momentumHome = liveMatch.momentum;

    return `
      <section class="card live-match">
        <div class="section-title">
          <h2>Partido en vivo</h2>
          <span class="chip">${liveMatch.completed ? "Final" : `${liveMatch.minute}'`}</span>
        </div>
        <div class="live-scoreboard">
          <div><strong>${FMG.escapeHtml(homeTeam.name)}</strong><p class="muted">${liveMatch.homeLineupIds.length} en cancha</p></div>
          <div class="score">${result.homeGoals} - ${result.awayGoals}</div>
          <div><strong>${FMG.escapeHtml(awayTeam.name)}</strong><p class="muted">${liveMatch.awayLineupIds.length} en cancha</p></div>
        </div>
        <div class="momentum">
          <span style="width:${momentumHome}%"></span>
        </div>
        <div class="match-stats">
          ${renderStatLine("Posesion", `${stats.home.possession}%`, `${stats.away.possession}%`)}
          ${renderStatLine("Remates", stats.home.shots, stats.away.shots)}
          ${renderStatLine("Al arco", stats.home.shotsOnTarget, stats.away.shotsOnTarget)}
          ${renderStatLine("xG", stats.home.xg.toFixed(2), stats.away.xg.toFixed(2))}
          ${renderStatLine("Faltas", stats.home.fouls, stats.away.fouls)}
          ${renderStatLine("Tarjetas", `${stats.home.yellowCards}/${stats.home.redCards}`, `${stats.away.yellowCards}/${stats.away.redCards}`)}
        </div>
        ${renderLiveControls(liveMatch)}
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Relato en vivo</h2><span class="chip">${result.timeline.length} eventos</span></div>
          <div class="log-list">
            ${result.timeline.slice(-16).reverse().map((event) => `
              <div class="log-item event-${FMG.escapeHtml(event.type)}">
                <strong>${event.minute}' | ${FMG.escapeHtml(event.type)}</strong>
                <p class="muted">${FMG.escapeHtml(event.text)}</p>
              </div>`).join("") || `<div class="empty-state">El partido espera el pitazo inicial.</div>`}
          </div>
        </section>
        ${renderLiveSubstitutions(state, liveMatch)}
      </section>
    `;
  }

  function renderTacticalPreview(state, upcomingMatches) {
    const userMatch = upcomingMatches ? upcomingMatches.find((match) => match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId) : null;
    if (!userMatch) return `<div class="empty-state">Tu club descansa en la proxima fecha.</div>`;
    const opponentId = userMatch.homeTeamId === state.userTeamId ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponent = state.teams.find((team) => team.id === opponentId);
    const userProfile = FMG.getTacticalMatchProfile(state, state.userTeamId);
    const rivalProfile = FMG.getTacticalMatchProfile(state, opponentId);
    const userPlan = FMG.getTeamPlan(state, state.userTeamId);
    const rivalPlan = FMG.getTeamPlan(state, opponentId);
    const rows = [
      ["Formacion", userPlan.formation, rivalPlan.formation],
      ["Posesion", userProfile.possession.toFixed(1), rivalProfile.possession.toFixed(1)],
      ["Ataque", userProfile.attack.toFixed(1), rivalProfile.attack.toFixed(1)],
      ["Defensa", userProfile.defense.toFixed(1), rivalProfile.defense.toFixed(1)],
      ["Riesgo", userProfile.risk.toFixed(1), rivalProfile.risk.toFixed(1)],
      ["Desgaste", userProfile.fatigue.toFixed(1), rivalProfile.fatigue.toFixed(1)]
    ];
    return `
      <div class="section-title"><h2>Previa tactica</h2><span class="chip">vs ${FMG.escapeHtml(opponent.name)}</span></div>
      <div class="table tactical-table">
        <div class="table-row header"><span>Factor</span><span>${FMG.escapeHtml(state.userClub.name)}</span><span>${FMG.escapeHtml(opponent.name)}</span></div>
        ${rows.map(([label, userValue, rivalValue]) => `
          <div class="table-row"><span>${FMG.escapeHtml(label)}</span><span>${FMG.escapeHtml(userValue)}</span><span>${FMG.escapeHtml(rivalValue)}</span></div>
        `).join("")}
      </div>
    `;
  }

  FMG.renderMatchView = function (state, upcomingMatches) {
    if (state.liveMatch) return renderLiveMatch(state);
    const currentMatch = state.currentMatch;
    const homeTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.homeTeamId) : null;
    const awayTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.awayTeamId) : null;
    const stats = currentMatch ? currentMatch.stats : null;
    return `
      <section class="content-grid">
        <section class="card">
          <div class="section-title">
            <h2>Ultimo partido</h2>
            <div class="button-row">
              <button class="btn-primary" data-action="start-live-match">Jugar partido</button>
              <button class="btn-secondary" data-action="advance-week">Simular fecha</button>
            </div>
          </div>
          ${
            currentMatch
              ? `<article class="match-card">
                  <p class="muted">Semana ${currentMatch.week || Math.max(state.currentWeek - 1, 1)}</p>
                  <div class="match-score">
                    <div><strong>${FMG.escapeHtml(homeTeam.name)}</strong></div>
                    <div class="score">${currentMatch.homeGoals} - ${currentMatch.awayGoals}</div>
                    <div><strong>${FMG.escapeHtml(awayTeam.name)}</strong></div>
                  </div>
                  <p class="muted">${FMG.escapeHtml(currentMatch.summary)}</p>
                  ${stats ? `
                    <div class="match-stats">
                      ${renderStatLine("Posesion", `${stats.home.possession}%`, `${stats.away.possession}%`)}
                      ${renderStatLine("Remates", stats.home.shots, stats.away.shots)}
                      ${renderStatLine("Al arco", stats.home.shotsOnTarget, stats.away.shotsOnTarget)}
                      ${renderStatLine("xG", stats.home.xg.toFixed(2), stats.away.xg.toFixed(2))}
                      ${renderStatLine("Faltas", stats.home.fouls, stats.away.fouls)}
                      ${renderStatLine("Tarjetas", `${stats.home.yellowCards}/${stats.home.redCards}`, `${stats.away.yellowCards}/${stats.away.redCards}`)}
                    </div>` : ""}
                  <div style="margin-top:18px; display:grid; gap:10px;">
                    ${[...currentMatch.homeEvents, ...currentMatch.awayEvents]
                      .sort((left, right) => left.minute - right.minute)
                      .map((goal) => `<div class="log-item"><strong>${goal.minute}'</strong><p class="muted">${FMG.escapeHtml(goal.scorer)}</p></div>`)
                      .join("") || `<div class="empty-state">No hubo goles en este encuentro.</div>`}
                  </div>
                </article>`
              : `<div class="empty-state">Todavia no se ha disputado el primer partido.</div>`
          }
        </section>
        <section class="card">
          <div class="section-title"><h2>Proxima fecha</h2></div>
          <div style="display:grid; gap:12px;">
            ${
              upcomingMatches && upcomingMatches.length
                ? upcomingMatches.map((match) => `
                    <article class="list-row compact">
                      <div><strong>${FMG.escapeHtml(match.homeTeam.name)}</strong><p class="muted">vs ${FMG.escapeHtml(match.awayTeam.name)}</p></div>
                      <span class="chip">${match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId ? "Tu partido" : "Liga"}</span>
                    </article>`).join("")
                : `<div class="empty-state">Calendario completado.</div>`
            }
          </div>
        </section>
        <section class="card">
          ${renderTacticalPreview(state, upcomingMatches)}
        </section>
      </section>
      ${
        currentMatch && currentMatch.timeline
          ? `<section class="card">
              <div class="section-title"><h2>Relato del partido</h2><span class="chip">${currentMatch.timeline.length} eventos</span></div>
              <div class="log-list">
                ${currentMatch.timeline.slice(-14).map((event) => `
                  <div class="log-item">
                    <strong>${event.minute}' | ${FMG.escapeHtml(event.type)}</strong>
                    <p class="muted">${FMG.escapeHtml(event.text)}</p>
                  </div>`).join("")}
              </div>
            </section>`
          : ""
      }
    `;
  };
})();
