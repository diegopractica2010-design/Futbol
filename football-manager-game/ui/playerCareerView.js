(function () {
  const FMG = (window.FMG = window.FMG || {});

  function bar(label, value, className) {
    return `<article class="stat-card ${className || ""}">
      <div class="muted">${FMG.escapeHtml(label)}</div>
      <div class="progress"><span style="width:${FMG.clamp(Number(value) || 0, 0, 100)}%"></span></div>
      <div class="stat-value">${Math.round(Number(value) || 0)}</div>
    </article>`;
  }

  function renderCreator(state) {
    const archetypes = FMG.PlayerMode?.archetypes || {};
    const teams = state.teams || [];
    return `
      <section class="hero player-mode-creator" data-player-mode-create>
        <div class="panel hero-main football-priority">
          <span class="eyebrow">Modo aparte</span>
          <h1 class="hero-title">Carrera Jugador</h1>
          <p class="hero-copy">Crea un futbolista propio y vive una carrera separada del manager: entrenamientos, minutos, mensajes del DT, representante, objetivos y partidos semana a semana.</p>
          <div class="player-create-grid">
            <label>
              <span>Nombre del jugador</span>
              <input data-player-name type="text" value="Diego Promesa" maxlength="32" />
            </label>
            <label>
              <span>Arquetipo</span>
              <select data-player-archetype>
                ${Object.entries(archetypes).map(([key, value]) => `<option value="${key}">${FMG.escapeHtml(value.label)}</option>`).join("")}
              </select>
            </label>
            <label>
              <span>Primer club</span>
              <select data-player-club>
                ${teams.map((team) => `<option value="${FMG.escapeHtml(team.id)}" ${team.id === state.userTeamId ? "selected" : ""}>${FMG.escapeHtml(team.name)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="hero-actions">
            <button class="btn-primary" data-action="create-player-mode">Crear jugador</button>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Como se juega</h2><span class="chip">Estilo carrera FIFA</span></div>
            <div class="log-list">
              <div class="log-item"><strong>Entrena</strong><p class="muted">Sube atributos y forma, pero controla la fatiga.</p></div>
              <div class="log-item"><strong>Juega semanas</strong><p class="muted">El DT decide minutos segun confianza, forma y rendimiento.</p></div>
              <div class="log-item"><strong>Responde decisiones</strong><p class="muted">Representante, prensa y entrenador reaccionan de inmediato.</p></div>
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function renderObjectives(pm) {
    return (pm.objectives || []).map((objective) => {
      const raw = objective.id === "rating"
        ? (Number(objective.value) / Math.max(1, Number(objective.target))) * 100
        : (Number(objective.value) / Math.max(1, Number(objective.target))) * 100;
      const pct = FMG.clamp(Math.round(raw), 0, 100);
      return `<div class="log-item">
        <strong>${FMG.escapeHtml(objective.title)}</strong>
        <p class="muted">${FMG.escapeHtml(String(objective.value || 0))}/${FMG.escapeHtml(String(objective.target))} ${FMG.escapeHtml(objective.unit)}</p>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </div>`;
    }).join("") || `<div class="empty-state">Sin objetivos activos.</div>`;
  }

  function renderDecisions(pm) {
    const pending = (pm.decisions || []).filter((decision) => decision.status === "pending");
    if (!pending.length) return `<div class="empty-state">Sin decisiones urgentes. Avanza semanas para que aparezcan llamadas del DT y del agente.</div>`;
    return pending.map((decision) => `
      <div class="log-item consequence-card">
        <strong>${FMG.escapeHtml(decision.title)}</strong>
        <p class="muted">${FMG.escapeHtml(decision.detail)}</p>
        <div class="button-row" style="margin-top:10px;">
          ${(decision.choices || []).map((choice) => `<button class="btn-secondary" data-action="resolve-player-mode-decision" data-decision-id="${FMG.escapeHtml(decision.id)}" data-choice-id="${FMG.escapeHtml(choice.id)}">${FMG.escapeHtml(choice.label)}</button>`).join("")}
        </div>
      </div>`).join("");
  }

  function renderMatches(pm) {
    return (pm.matches || []).slice(0, 8).map((match) => `
      <div class="log-item player-match-row ${match.goals ? "is-wow" : ""}">
        <strong>Semana ${match.week}: ${FMG.escapeHtml(match.headline)}</strong>
        <p class="muted">${FMG.escapeHtml(match.clubName)} vs ${FMG.escapeHtml(match.opponentName)} | ${match.starts ? "Titular" : match.minutes ? "Suplente" : "No jugo"} | ${match.minutes} min | Rating ${match.rating}</p>
        <div class="chips">
          <span class="chip">Goles ${match.goals}</span>
          <span class="chip">Asistencias ${match.assists}</span>
          ${match.cleanSheet ? `<span class="chip chip-success">Porteria a cero</span>` : ""}
        </div>
      </div>`).join("") || `<div class="empty-state">Todavia no disputaste partidos. Avanza la primera semana.</div>`;
  }

  function renderMessages(pm) {
    return (pm.messages || []).slice(0, 8).map((message) => `
      <div class="log-item message-${FMG.escapeHtml(message.tone || "neutral")}">
        <strong>${FMG.escapeHtml(message.from)} | ${FMG.escapeHtml(message.title)}</strong>
        <p class="muted">${FMG.escapeHtml(message.body)}</p>
      </div>`).join("") || `<div class="empty-state">Tu bandeja esta vacia.</div>`;
  }

  FMG.renderPlayerCareerView = function (state) {
    const pm = FMG.ensurePlayerMode ? FMG.ensurePlayerMode(state) : state.playerMode;
    if (!pm || !pm.created) return renderCreator(state);
    const player = pm.player;
    const attrs = player.attributes || {};
    const team = (state.teams || []).find((item) => item.id === pm.clubId);
    const playerChallenges = FMG.generatePlayerLiveChallenges ? FMG.generatePlayerLiveChallenges(state) : ((state.liveChallenges && state.liveChallenges.player) || []);

    return `
      <section class="screen-rhythm player-mode-screen">
        <section class="hero">
          <div class="panel hero-main football-priority player-mode-hero">
            <span class="eyebrow">Carrera Jugador</span>
            <div class="club-heading">
              <div class="player-avatar">${FMG.escapeHtml((player.name || "JP").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase())}</div>
              <h1 class="hero-title">${FMG.escapeHtml(player.name)}</h1>
            </div>
            <p class="hero-copy">${FMG.escapeHtml(player.archetypeLabel)} | ${FMG.escapeHtml(player.position)} | ${FMG.escapeHtml(team?.name || "Sin club")} | T${pm.seasonNumber} Semana ${pm.week}</p>
            <div class="chips">
              <span class="chip">OVR ${player.overall}</span>
              <span class="chip">Potencial ${player.potential}</span>
              <span class="chip">XP ${pm.xp}</span>
              <span class="chip">Puntos ${pm.skillPoints}</span>
            </div>
            <div class="hero-actions">
              <button class="btn-primary" data-action="advance-player-mode-week">Jugar proxima semana</button>
              <button class="btn-secondary" data-action="train-player-mode" data-plan="balanced">Entreno balanceado</button>
              <button class="btn-secondary" data-action="train-player-mode" data-plan="finishing">Definicion</button>
              <button class="btn-secondary" data-action="train-player-mode" data-plan="playmaking">Creacion</button>
              <button class="btn-secondary" data-action="train-player-mode" data-plan="athletic">Fisico</button>
            </div>
          </div>
          <div class="side-stack">
            <section class="panel player-inbox">
              <div class="section-title"><h2>Bandeja del jugador</h2><span class="chip">${(pm.messages || []).length}</span></div>
              <div class="log-list">${renderMessages(pm)}</div>
            </section>
          </div>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Atributos</h2><span class="chip">${FMG.escapeHtml(pm.trainingPlan)}</span></div>
            <div class="stats-grid">
              ${bar("Ritmo", attrs.pace)}
              ${bar("Tiro", attrs.shooting)}
              ${bar("Pase", attrs.passing)}
              ${bar("Regate", attrs.dribbling)}
              ${bar("Defensa", attrs.defending)}
              ${bar("Fisico", attrs.physical)}
            </div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Confianza y entorno</h2></div>
            <div class="stats-grid">
              ${bar("Confianza DT", pm.personality.managerTrust)}
              ${bar("Carino hinchas", pm.personality.fanLove)}
              ${bar("Interes mercado", pm.personality.agentHeat)}
              ${bar("Disciplina", pm.personality.discipline)}
              ${bar("Forma", pm.personality.form)}
              ${bar("Fatiga", pm.personality.fatigue)}
            </div>
          </section>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Objetivos de temporada</h2><span class="chip">Progreso visible</span></div>
            <div class="log-list">${renderObjectives(pm)}</div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Desafios del jugador</h2><span class="chip">Live</span></div>
            <div class="log-list">
              ${playerChallenges.filter((challenge) => challenge.status === "active").slice(0, 3).map((challenge) => {
                const pct = FMG.clamp(Math.round(((challenge.progress || 0) / Math.max(1, challenge.target || 1)) * 100), 0, 100);
                return `<div class="log-item challenge-card">
                  <strong>${FMG.escapeHtml(challenge.title)}</strong>
                  <p class="muted">${FMG.escapeHtml(challenge.detail)}</p>
                  <p class="muted">Recompensa: ${FMG.escapeHtml(challenge.reward)}</p>
                  <div class="progress"><span style="width:${pct}%"></span></div>
                </div>`;
              }).join("") || `<div class="empty-state">No hay desafios activos.</div>`}
            </div>
          </section>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Decisiones inmediatas</h2><span class="chip">${(pm.decisions || []).filter((decision) => decision.status === "pending").length} pendientes</span></div>
            <div class="log-list">${renderDecisions(pm)}</div>
          </section>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Partidos del jugador</h2><span class="chip">${pm.careerStats.appearances} PJ</span></div>
            <div class="log-list">${renderMatches(pm)}</div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Resumen carrera</h2><span class="chip">Media ${pm.careerStats.avgRating || 0}</span></div>
            <div class="stats-grid">
              <article class="stat-card"><div class="muted">Titularidades</div><div class="stat-value">${pm.careerStats.starts || 0}</div></article>
              <article class="stat-card"><div class="muted">Goles</div><div class="stat-value">${pm.careerStats.goals || 0}</div></article>
              <article class="stat-card"><div class="muted">Asistencias</div><div class="stat-value">${pm.careerStats.assists || 0}</div></article>
              <article class="stat-card"><div class="muted">Porterias a cero</div><div class="stat-value">${pm.careerStats.cleanSheets || 0}</div></article>
            </div>
          </section>
        </section>
      </section>
    `;
  };
})();
