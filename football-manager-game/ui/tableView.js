(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderRanking(title, items) {
    return `
      <section class="card">
        <div class="section-title"><h2>${title}</h2></div>
        <div class="log-list">
          ${
            items && items.length
              ? items.slice(0, 5).map((item, index) => `<div class="log-item"><strong>${index + 1}. ${FMG.escapeHtml(item.name)}</strong><p class="muted">${FMG.escapeHtml(item.teamName)} | ${item.value}</p></div>`).join("")
              : `<div class="empty-state">Sin registros suficientes.</div>`
          }
        </div>
      </section>
    `;
  }

  function renderCup(title, cup) {
    return `
      <section class="card">
        <div class="section-title"><h2>${title}</h2><span class="chip">${cup ? FMG.escapeHtml(cup.championName) : "Por definir"}</span></div>
        <div class="log-list">
          ${
            cup && cup.rounds
              ? cup.rounds.flatMap((round) => round.matches.map((match) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(round.name)} | ${FMG.escapeHtml(match.winnerName)}</strong>
                  <p class="muted">${FMG.escapeHtml(match.homeTeamName)} ${match.homeGoals} - ${match.awayGoals} ${FMG.escapeHtml(match.awayTeamName)}</p>
                </div>`)).join("")
              : `<div class="empty-state">Se resolvera al cierre de temporada.</div>`
          }
        </div>
      </section>
    `;
  }

  FMG.renderTableView = function (state) {
    const competitions = state.competitions || { rankings: {}, qualification: [] };
    return `
      <section class="card">
        <div class="section-title"><h2>Tabla de posiciones</h2><span class="chip">${state.totalWeeks} semanas</span></div>
        <div class="table">
          <div class="table-row header"><span>#</span><span>Equipo</span><span>Pts</span><span>DG</span><span>GF</span><span>PJ</span></div>
          ${state.standings.map((entry, index) => `
            <div class="table-row">
              <span>${index + 1}</span><span>${FMG.escapeHtml(entry.name)}${entry.teamId === state.userTeamId ? " (Tu club)" : ""}</span><span>${entry.points}</span><span>${entry.goalDifference}</span><span>${entry.goalsFor}</span><span>${entry.played}</span>
            </div>`).join("")}
        </div>
      </section>
      <section class="content-grid">
        ${renderCup("Copa Chile", competitions.nationalCup)}
        ${renderCup("Copa Internacional", competitions.international)}
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Clasificacion</h2><span class="chip">${competitions.relegation ? "Ascenso/descenso" : "En disputa"}</span></div>
          <div class="log-list">
            ${
              competitions.qualification && competitions.qualification.length
                ? competitions.qualification.map((entry) => `<div class="log-item"><strong>${entry.position}. ${FMG.escapeHtml(entry.teamName)}</strong><p class="muted">${FMG.escapeHtml(entry.competition)}</p></div>`).join("")
                : `<div class="empty-state">La clasificacion se define al terminar la liga.</div>`
            }
            ${competitions.relegation ? `<div class="log-item"><strong>Desciende ${FMG.escapeHtml(competitions.relegation.relegatedTeamName)}</strong><p class="muted">Asciende ${FMG.escapeHtml(competitions.relegation.promotedTeamName)}</p></div>` : ""}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Supercopa</h2><span class="chip">${competitions.superCup ? FMG.escapeHtml(competitions.superCup.championName) : "Pendiente"}</span></div>
          ${
            competitions.superCup
              ? `<div class="log-item"><strong>${FMG.escapeHtml(competitions.superCup.match.winnerName)}</strong><p class="muted">${FMG.escapeHtml(competitions.superCup.match.homeTeamName)} ${competitions.superCup.match.homeGoals} - ${competitions.superCup.match.awayGoals} ${FMG.escapeHtml(competitions.superCup.match.awayTeamName)}</p></div>`
              : `<div class="empty-state">Se juega al iniciar una nueva temporada.</div>`
          }
        </section>
      </section>
      <section class="content-grid">
        ${renderRanking("Goleadores", competitions.rankings?.scorers || [])}
        ${renderRanking("Rematadores", competitions.rankings?.shooters || [])}
      </section>
      <section class="content-grid">
        ${renderRanking("Tarjetas", competitions.rankings?.cards || [])}
        ${renderRanking("Arqueros", competitions.rankings?.keepers || [])}
      </section>
    `;
  };
})();
