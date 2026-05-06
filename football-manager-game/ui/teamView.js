(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderTacticButtons(plan, key, label) {
    return `
      <div class="tactic-control">
        <strong>${label}</strong>
        <div class="button-row">
          ${Object.entries(FMG.TACTIC_OPTIONS[key]).map(([value, config]) => `
            <button class="${plan[key] === value ? "active" : "btn-ghost"}" data-action="set-team-tactic" data-tactic-key="${key}" data-tactic-value="${value}">${FMG.escapeHtml(config.label)}</button>`).join("")}
        </div>
      </div>
    `;
  }

  function renderRoleButtons(plan, position) {
    return `
      <div class="tactic-control compact-control">
        <strong>${position}</strong>
        <div class="button-row">
          ${Object.entries(FMG.TACTIC_OPTIONS.role).map(([role, config]) => `
            <button class="${plan.playerRoles[position] === role ? "active" : "btn-ghost"}" data-action="set-position-role" data-position="${position}" data-role="${role}">${FMG.escapeHtml(config.label)}</button>`).join("")}
        </div>
      </div>
    `;
  }

  function renderInstructionButtons(plan, player) {
    return Object.entries(FMG.INDIVIDUAL_INSTRUCTIONS).map(([instruction, config]) => `
      <button class="${(plan.instructions[player.id] || "none") === instruction ? "active" : "btn-ghost"}" data-action="set-player-instruction" data-player-id="${player.id}" data-instruction="${instruction}">${FMG.escapeHtml(config.label)}</button>
    `).join("");
  }

  function renderAttributeBars(player) {
    return Object.entries(player.attributes || {}).map(([key, value]) => `
      <div class="attribute-row">
        <span>${FMG.escapeHtml(key)}</span>
        <div class="attribute-bar"><span style="width:${value}%"></span></div>
        <strong>${value}</strong>
      </div>
    `).join("");
  }

  function renderPlayerCard(state, plan, player) {
    if (!player) return `<div class="empty-state">Selecciona un jugador para ver su ficha.</div>`;
    const isCaptain = plan.captainId === player.id;
    return `
      <section class="card player-profile">
        <div class="section-title">
          <h2>${FMG.escapeHtml(player.name)}</h2>
          <span class="chip">${isCaptain ? "Capitan" : FMG.escapeHtml(FMG.SQUAD_ROLES[player.squadRole].label)}</span>
        </div>
        <div class="stats-grid">
          <article class="stat-card"><div class="muted">OVR / POT</div><div class="stat-value">${player.overall}/${player.potential}</div></article>
          <article class="stat-card"><div class="muted">Felicidad</div><div class="stat-value">${player.happiness}</div></article>
          <article class="stat-card"><div class="muted">Minutos</div><div class="stat-value">${player.seasonStats.minutes}</div></article>
          <article class="stat-card"><div class="muted">Liderazgo</div><div class="stat-value">${player.leadership}</div></article>
        </div>
        <div class="profile-grid">
          <div>
            <strong>Atributos</strong>
            <div class="attribute-list">${renderAttributeBars(player)}</div>
          </div>
          <div>
            <strong>Estado</strong>
            <div class="meta profile-meta">
              <span>${FMG.escapeHtml(player.position)}</span>
              <span>${player.age} anos</span>
              <span>${FMG.escapeHtml(player.personality)}</span>
              <span>${FMG.escapeHtml(player.moraleReason)}</span>
              <span>${player.seasonStats.appearances} PJ</span>
              <span>${player.seasonStats.starts} titularidades</span>
            </div>
            <div class="button-row" style="margin-top:12px;">
              ${Object.entries(FMG.SQUAD_ROLES).map(([role, config]) => `
                <button class="${player.squadRole === role ? "active" : "btn-ghost"}" data-action="set-squad-role" data-player-id="${player.id}" data-role="${role}">${FMG.escapeHtml(config.label)}</button>`).join("")}
              <button class="btn-secondary" data-action="set-captain" data-player-id="${player.id}">Capitan</button>
              <button class="btn-primary" data-action="renew-contract" data-player-id="${player.id}">Renovar</button>
            </div>
          </div>
        </div>
        <div class="content-grid profile-history">
          <section>
            <strong>Historial de moral</strong>
            <div class="log-list" style="margin-top:10px;">
              ${(player.moraleLog || []).map((entry) => `<div class="log-item"><strong>${FMG.escapeHtml(entry.reason)}</strong><p class="muted">Semana ${entry.week} | ${entry.amount > 0 ? "+" : ""}${entry.amount}</p></div>`).join("") || `<div class="empty-state">Sin registros.</div>`}
            </div>
          </section>
          <section>
            <strong>Historial medico</strong>
            <div class="log-list" style="margin-top:10px;">
              ${(player.injuryHistory || []).map((entry) => `<div class="log-item"><strong>${FMG.escapeHtml(entry.detail)}</strong><p class="muted">Semana ${entry.week} | ${entry.duration} semana(s)</p></div>`).join("") || `<div class="empty-state">Sin lesiones registradas.</div>`}
            </div>
          </section>
        </div>
      </section>
    `;
  }

  FMG.renderTeamView = function (state) {
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    const starters = FMG.getMatchSquad(state, state.userTeamId);
    const starterIds = new Set(starters.map((player) => player.id));
    state.squadView = state.squadView || { selectedPlayerId: null, filter: "all", sort: "overall" };
    const sorters = {
      overall: (left, right) => right.overall - left.overall,
      age: (left, right) => left.age - right.age,
      morale: (left, right) => right.morale - left.morale,
      minutes: (left, right) => right.seasonStats.minutes - left.seasonStats.minutes,
      potential: (left, right) => right.potential - left.potential
    };
    const squad = state.players.filter((player) =>
      player.teamId === state.userTeamId &&
      !player.retired &&
      (state.squadView.filter === "all" || player.position === state.squadView.filter)
    ).sort((left, right) => {
      if (starterIds.has(left.id) !== starterIds.has(right.id)) return starterIds.has(left.id) ? -1 : 1;
      return (sorters[state.squadView.sort] || sorters.overall)(left, right);
    });
    const profile = FMG.getTacticalMatchProfile(state, state.userTeamId);
    const selectedPlayer = state.players.find((player) => player.id === state.squadView.selectedPlayerId && player.teamId === state.userTeamId && !player.retired) || squad[0];

    return `
      <section class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Plan deportivo</h2><span class="chip">${plan.formation}</span></div>
        <div class="stats-grid">
          <article class="stat-card"><div class="muted">Titulares disponibles</div><div class="stat-value">${starters.length}/11</div></article>
          <article class="stat-card"><div class="muted">Entrenamiento</div><div class="stat-value">${FMG.escapeHtml(FMG.TRAINING_FOCUS[plan.trainingFocus].label)}</div></article>
          <article class="stat-card"><div class="muted">Ataque tactico</div><div class="stat-value">${profile.attack > 0 ? "+" : ""}${profile.attack.toFixed(1)}</div></article>
          <article class="stat-card"><div class="muted">Riesgo</div><div class="stat-value">${profile.risk > 0 ? "+" : ""}${profile.risk.toFixed(1)}</div></article>
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
        <div class="section-title"><h2>Pizarra tactica</h2><span class="chip">Fase 4</span></div>
        <div class="tactic-grid">
          ${renderTacticButtons(plan, "mentality", "Mentalidad")}
          ${renderTacticButtons(plan, "pressing", "Presion")}
          ${renderTacticButtons(plan, "tempo", "Ritmo")}
          ${renderTacticButtons(plan, "passing", "Pase")}
          ${renderTacticButtons(plan, "width", "Anchura")}
          ${renderTacticButtons(plan, "defensiveLine", "Linea defensiva")}
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Roles por posicion</h2><span class="chip">Instrucciones</span></div>
        <div class="tactic-grid">
          ${["POR", "DEF", "MED", "EXT", "DEL"].map((position) => renderRoleButtons(plan, position)).join("")}
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Plantilla profesional</h2><span class="chip">${squad.length} jugadores</span></div>
        <div class="button-row">
          ${["all", "POR", "DEF", "MED", "EXT", "DEL"].map((filter) => `<button class="${state.squadView.filter === filter ? "active" : "btn-ghost"}" data-action="set-squad-filter" data-filter="${filter}">${filter === "all" ? "Todos" : filter}</button>`).join("")}
        </div>
        <div class="button-row">
          ${[
            ["overall", "OVR"],
            ["potential", "Potencial"],
            ["minutes", "Minutos"],
            ["morale", "Moral"],
            ["age", "Edad"]
          ].map(([sort, label]) => `<button class="${state.squadView.sort === sort ? "active" : "btn-ghost"}" data-action="set-squad-sort" data-sort="${sort}">${label}</button>`).join("")}
        </div>
        <div class="list">
          ${squad.map((player) => `
            <article class="list-row">
              <div>
                <strong>${FMG.escapeHtml(player.name)} ${plan.captainId === player.id ? "(C)" : ""}</strong>
                <div class="meta">
                  <span>${starterIds.has(player.id) ? "Titular" : "Plantel"}</span><span>${FMG.escapeHtml(FMG.SQUAD_ROLES[player.squadRole].label)}</span><span>${FMG.escapeHtml(player.position)}</span><span>${player.age} anos</span><span>OVR ${player.overall}</span><span>POT ${player.potential}</span><span>${player.seasonStats.minutes} min</span><span>G ${player.seasonStats?.goals || 0}</span><span>Tiros ${player.seasonStats?.shots || 0}</span><span>Contrato ${player.contractYears}a</span>
                  <span>${FMG.escapeHtml(FMG.INDIVIDUAL_INSTRUCTIONS[plan.instructions[player.id] || "none"].label)}</span>
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
                  <button class="btn-primary" data-action="select-squad-player" data-player-id="${player.id}">Ficha</button>
                  ${starterIds.has(player.id) ? renderInstructionButtons(plan, player) : ""}
                  <button class="btn-danger" data-action="sell-player" data-player-id="${player.id}">Vender</button>
                </div>
              </div>
            </article>`).join("")}
        </div>
      </section>
      ${renderPlayerCard(state, plan, selectedPlayer)}
      </section>
    `;
  };
})();
