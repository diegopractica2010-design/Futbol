(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderTeamView = function (state) {
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    const starters = FMG.getMatchSquad(state, state.userTeamId);
    const starterIds = new Set(starters.map((player) => player.id));
    const squad = state.players.filter((player) => player.teamId === state.userTeamId).sort((left, right) => {
      if (starterIds.has(left.id) !== starterIds.has(right.id)) return starterIds.has(left.id) ? -1 : 1;
      return right.overall - left.overall;
    });

    return `
      <section class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Plan deportivo</h2><span class="chip">${plan.formation}</span></div>
        <div class="stats-grid">
          <article class="stat-card"><div class="muted">Titulares disponibles</div><div class="stat-value">${starters.length}/11</div></article>
          <article class="stat-card"><div class="muted">Entrenamiento</div><div class="stat-value">${FMG.escapeHtml(FMG.TRAINING_FOCUS[plan.trainingFocus].label)}</div></article>
        </div>
        <div class="button-row">
          ${Object.keys(FMG.FORMATIONS).map((formation) => `
            <button class="${plan.formation === formation ? "active" : "btn-ghost"}" data-action="set-formation" data-formation="${formation}">${formation}</button>`).join("")}
        </div>
        <div class="button-row">
          ${Object.entries(FMG.TRAINING_FOCUS).map(([focus, config]) => `
            <button class="${plan.trainingFocus === focus ? "active" : "btn-secondary"}" data-action="set-training" data-focus="${focus}">${FMG.escapeHtml(config.label)}</button>`).join("")}
          <button class="btn-primary" data-action="train-squad">Entrenar semana</button>
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Plantilla profesional</h2><span class="chip">${squad.length} jugadores</span></div>
        <div class="list">
          ${squad.map((player) => `
            <article class="list-row">
              <div>
                <strong>${FMG.escapeHtml(player.name)}</strong>
                <div class="meta">
                  <span>${starterIds.has(player.id) ? "Titular" : "Plantel"}</span><span>${FMG.escapeHtml(player.position)}</span><span>${player.age} anos</span><span>OVR ${player.overall}</span><span>G ${player.seasonStats?.goals || 0}</span><span>Tiros ${player.seasonStats?.shots || 0}</span><span>Contrato ${player.contractYears}a</span><span>Salario ${FMG.currency(player.salary)}</span>
                  ${player.injuredWeeks ? `<span>Lesion ${player.injuredWeeks}s</span>` : ""}
                  ${player.suspendedWeeks ? `<span>Sancion ${player.suspendedWeeks}s</span>` : ""}
                </div>
              </div>
              <div>
                <div class="muted">Energia</div>
                <div class="energy-bar"><span style="width:${player.energy}%"></span></div>
              </div>
              <div>
                <div class="muted">Moral</div>
                <div class="morale-bar"><span style="width:${player.morale}%"></span></div>
                <div class="button-row" style="margin-top:10px;">
                  <button class="btn-danger" data-action="sell-player" data-player-id="${player.id}">Vender</button>
                </div>
              </div>
            </article>`).join("")}
        </div>
      </section>
      </section>
    `;
  };
})();
