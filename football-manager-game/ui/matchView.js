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

  FMG.renderMatchView = function (state, upcomingMatches) {
    const currentMatch = state.currentMatch;
    const homeTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.homeTeamId) : null;
    const awayTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.awayTeamId) : null;
    const stats = currentMatch ? currentMatch.stats : null;
    return `
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Ultimo partido</h2><button class="btn-primary" data-action="advance-week">Simular siguiente fecha</button></div>
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
