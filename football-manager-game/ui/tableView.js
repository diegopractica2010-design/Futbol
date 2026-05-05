(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderTableView = function (state) {
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
    `;
  };
})();
