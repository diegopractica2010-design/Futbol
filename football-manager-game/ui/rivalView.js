(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderRivalClubView = function (state) {
    FMG.ensureUIState(state);
    const rivals = state.teams.filter((team) => team.id !== state.userTeamId);
    const rival = state.teams.find((team) => team.id === state.ui.selectedRivalId) || rivals[0];
    if (!rival) return `<section class="card"><div class="empty-state">No hay clubes rivales disponibles.</div></section>`;
    const identity = FMG.getClubIdentity(rival.id);
    const standingIndex = state.standings.findIndex((entry) => entry.teamId === rival.id);
    const standing = state.standings[standingIndex] || { points: 0, played: 0, goalDifference: 0 };
    const squad = state.players.filter((player) => player.teamId === rival.id && !player.retired);
    const topPlayers = [...squad].sort((left, right) => right.overall - left.overall).slice(0, 5);
    const need = FMG.getRivalSquadNeeds ? FMG.getRivalSquadNeeds(state, rival.id) : null;
    const next = state.fixtures
      .filter((fixture) => !fixture.played)
      .flatMap((fixture) => fixture.matches.map((match) => ({ ...match, week: fixture.week })))
      .find((match) => match.homeTeamId === rival.id || match.awayTeamId === rival.id);
    return `
      <section class="hero">
        <div class="panel hero-main club-hero" style="--club-primary:${identity.primary};--club-secondary:${identity.secondary};--club-accent:${identity.accent};">
          <span class="eyebrow">Informe rival</span>
          <div class="club-heading">${FMG.clubBadge(rival, "lg")}<h1 class="hero-title">${FMG.escapeHtml(rival.name)}</h1></div>
          <p class="hero-copy">${FMG.escapeHtml(rival.city)} | ${FMG.escapeHtml(rival.stadium)} | Estilo ${FMG.escapeHtml(rival.style)}</p>
          <div class="chips">
            <span class="chip">Posicion ${standingIndex + 1 || "-"}</span>
            <span class="chip">${standing.points} pts</span>
            <span class="chip">Forma ${rival.form}/20</span>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Cambiar rival</h2></div>
            <div class="button-row">
              ${rivals.map((team) => `<button class="${team.id === rival.id ? "active" : "btn-ghost"}" data-action="select-rival-club" data-team-id="${team.id}" title="Ver informe de ${FMG.escapeHtml(team.name)}">${FMG.escapeHtml(team.name)}</button>`).join("")}
            </div>
          </section>
          <section class="panel">
            <div class="section-title"><h2>Proximo partido</h2></div>
            ${next ? `<div class="log-item"><strong>Semana ${next.week}</strong><p class="muted">${FMG.escapeHtml(state.teams.find((team) => team.id === next.homeTeamId).name)} vs ${FMG.escapeHtml(state.teams.find((team) => team.id === next.awayTeamId).name)}</p></div>` : `<div class="empty-state">Sin partido pendiente.</div>`}
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Plantel destacado</h2><span class="chip">${squad.length} jugadores</span></div>
          <div class="log-list">
            ${topPlayers.map((player) => `<div class="list-row compact"><div><strong>${FMG.escapeHtml(player.name)}</strong><p class="muted">${player.position} | OVR ${player.overall} | POT ${player.potential}</p></div><button class="btn-ghost" data-action="select-squad-player" data-player-id="${player.id}">Ficha</button></div>`).join("")}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Lectura deportiva</h2></div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">Media</div><div class="stat-value">${need ? need.averageOverall : 0}</div></article>
            <article class="stat-card"><div class="muted">Necesidad</div><div class="stat-value">${FMG.escapeHtml(need ? need.targetPosition : "-")}</div></article>
            <article class="stat-card"><div class="muted">Presupuesto IA</div><div class="stat-value">${FMG.currency(need ? need.budget : 0)}</div></article>
            <article class="stat-card"><div class="muted">DG</div><div class="stat-value">${standing.goalDifference}</div></article>
          </div>
        </section>
      </section>
    `;
  };
})();
