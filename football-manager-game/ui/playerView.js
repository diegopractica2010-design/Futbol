(function () {
  const FMG = (window.FMG = window.FMG || {});

  function attributeRows(player) {
    return Object.entries(player.attributes || {}).map(([key, value]) => `
      <div class="attribute-row">
        <span>${FMG.escapeHtml(key)}</span>
        <div class="attribute-bar" aria-label="${FMG.escapeHtml(key)} ${value}"><span style="width:${value}%"></span></div>
        <strong>${value}</strong>
      </div>`).join("");
  }

  FMG.renderPlayerDetailView = function (state) {
    const player = state.players.find((item) => item.id === state.squadView?.selectedPlayerId) ||
      state.players.find((item) => item.teamId === state.userTeamId && !item.retired);
    if (!player) return `<section class="card"><div class="empty-state">No hay jugador seleccionado.</div></section>`;
    const club = state.teams.find((team) => team.id === player.teamId) || { id: "free", name: "Libre" };
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    const isOwnPlayer = player.teamId === state.userTeamId;
    return `
      <section class="hero">
        <div class="panel hero-main club-hero" style="--club-primary:${FMG.getClubIdentity(club.id).primary};--club-secondary:${FMG.getClubIdentity(club.id).secondary};--club-accent:${FMG.getClubIdentity(club.id).accent};">
          <span class="eyebrow">Ficha de jugador</span>
          <div class="club-heading">${FMG.clubBadge(club, "lg")}<h1 class="hero-title">${FMG.escapeHtml(player.name)}</h1></div>
          <p class="hero-copy">${FMG.escapeHtml(player.position)} | ${player.age} anos | ${FMG.escapeHtml(club.name)} | Personalidad ${FMG.escapeHtml(player.personality || "Normal")}</p>
          <div class="chips">
            <span class="chip" title="Nivel actual">OVR ${player.overall}</span>
            <span class="chip" title="Potencial maximo estimado">POT ${player.potential}</span>
            <span class="chip">Contrato ${player.contractYears || 0}a</span>
            <span class="chip">${FMG.currency(player.salary)} sueldo</span>
          </div>
          <div class="hero-actions">
            <button class="btn-ghost" data-action="change-route" data-route="${FMG.ROUTES.squad}">Volver a plantilla</button>
            ${isOwnPlayer ? `<button class="btn-primary" data-action="renew-contract" data-player-id="${player.id}" data-confirm="Renovar contrato de ${FMG.escapeHtml(player.name)}?">Renovar</button>` : ""}
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Estado</h2><span class="chip">${isOwnPlayer && plan.captainId === player.id ? "Capitan" : FMG.escapeHtml(FMG.SQUAD_ROLES[player.squadRole]?.label || "Plantel")}</span></div>
            <div class="stats-grid">
              <article class="stat-card"><div class="muted">Energia</div><div class="stat-value">${player.energy}</div><div class="energy-bar"><span style="width:${player.energy}%"></span></div></article>
              <article class="stat-card"><div class="muted">Moral</div><div class="stat-value">${player.morale}</div><div class="morale-bar"><span style="width:${player.morale}%"></span></div></article>
              <article class="stat-card"><div class="muted">Felicidad</div><div class="stat-value">${player.happiness || 50}</div><div class="progress"><span style="width:${player.happiness || 50}%"></span></div></article>
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Atributos</h2></div>
          <div class="attribute-list">${attributeRows(player)}</div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Temporada</h2></div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">PJ</div><div class="stat-value">${player.seasonStats?.appearances || 0}</div></article>
            <article class="stat-card"><div class="muted">Goles</div><div class="stat-value">${player.seasonStats?.goals || 0}</div></article>
            <article class="stat-card"><div class="muted">Minutos</div><div class="stat-value">${player.seasonStats?.minutes || 0}</div></article>
            <article class="stat-card"><div class="muted">Tiros</div><div class="stat-value">${player.seasonStats?.shots || 0}</div></article>
          </div>
          <div class="log-list" style="margin-top:18px;">
            ${(player.moraleLog || []).slice(0, 5).map((entry) => `<div class="log-item"><strong>${FMG.escapeHtml(entry.reason)}</strong><p class="muted">Semana ${entry.week} | ${entry.amount > 0 ? "+" : ""}${entry.amount}</p></div>`).join("") || `<div class="empty-state">Sin bitacora reciente del jugador.</div>`}
          </div>
        </section>
      </section>
    `;
  };
})();
