(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderCalendarView = function (state) {
    FMG.ensureUIState(state);
    const filter = state.ui.calendarFilter || "all";
    const fixtures = state.fixtures.filter((fixture) => {
      if (filter === "played") return fixture.played;
      if (filter === "pending") return !fixture.played;
      if (filter === "mine") return fixture.matches.some((match) => match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId);
      return true;
    });
    return `
      <section class="card">
        <div class="section-title"><h2>Calendario</h2><span class="chip">Semana ${state.currentWeek}/${state.totalWeeks}</span></div>
        <div class="button-row" role="toolbar" aria-label="Filtros de calendario">
          ${[["all", "Todo"], ["mine", "Mi club"], ["pending", "Pendiente"], ["played", "Jugado"]].map(([key, label]) => `<button class="${filter === key ? "active" : "btn-ghost"}" data-action="set-calendar-filter" data-filter="${key}" title="Mostrar ${label.toLowerCase()}">${label}</button>`).join("")}
        </div>
        <div class="calendar-grid">
          ${fixtures.map((fixture) => `
            <article class="calendar-week ${fixture.played ? "is-played" : "is-pending"}">
              <div class="section-title"><h3>Semana ${fixture.week}</h3><span class="chip">${fixture.played ? "Jugado" : fixture.week === state.currentWeek ? "Actual" : "Pendiente"}</span></div>
              <div class="log-list">
                ${fixture.matches.map((match) => {
                  const home = state.teams.find((team) => team.id === match.homeTeamId);
                  const away = state.teams.find((team) => team.id === match.awayTeamId);
                  const result = state.lastResults.find((item) => item.week === fixture.week && item.homeTeamId === match.homeTeamId && item.awayTeamId === match.awayTeamId);
                  return `<div class="calendar-match ${match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId ? "is-user-match" : ""}">
                    <span>${FMG.clubBadge(home, "sm")} ${FMG.escapeHtml(home.name)}</span>
                    <strong>${result ? `${result.homeGoals} - ${result.awayGoals}` : "vs"}</strong>
                    <span>${FMG.clubBadge(away, "sm")} ${FMG.escapeHtml(away.name)}</span>
                  </div>`;
                }).join("")}
              </div>
            </article>`).join("") || `<div class="empty-state">No hay fechas para este filtro.</div>`}
        </div>
      </section>
    `;
  };
})();
