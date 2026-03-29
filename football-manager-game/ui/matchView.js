export function renderMatchView(state, upcomingMatches) {
  const currentMatch = state.currentMatch;
  return `
    <section class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Ultimo partido</h2><button class="btn-primary" data-action="advance-week">Simular siguiente fecha</button></div>
        ${
          currentMatch
            ? `<article class="match-card">
                <p class="muted">Semana ${Math.max(state.currentWeek - 1, 1)}</p>
                <div class="match-score">
                  <div><strong>${state.teams.find((team) => team.id === currentMatch.homeTeamId).name}</strong></div>
                  <div class="score">${currentMatch.homeGoals} - ${currentMatch.awayGoals}</div>
                  <div><strong>${state.teams.find((team) => team.id === currentMatch.awayTeamId).name}</strong></div>
                </div>
                <p class="muted">${currentMatch.summary}</p>
                <div style="margin-top:18px; display:grid; gap:10px;">
                  ${[...currentMatch.homeEvents, ...currentMatch.awayEvents]
                    .sort((left, right) => left.minute - right.minute)
                    .map((goal) => `<div class="log-item"><strong>${goal.minute}'</strong><p class="muted">${goal.scorer}</p></div>`)
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
            upcomingMatches?.length
              ? upcomingMatches.map((match) => `
                  <article class="list-row compact">
                    <div><strong>${match.homeTeam.name}</strong><p class="muted">vs ${match.awayTeam.name}</p></div>
                    <span class="chip">${match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId ? "Tu partido" : "Liga"}</span>
                  </article>`).join("")
              : `<div class="empty-state">Calendario completado.</div>`
          }
        </div>
      </section>
    </section>
  `;
}
