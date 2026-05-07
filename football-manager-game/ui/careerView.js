(function () {
  const FMG = (window.FMG = window.FMG || {});

  function relationCard(label, value) {
    return `
      <article class="stat-card">
        <div class="muted">${label}</div>
        <div class="stat-value">${value}/100</div>
        <div class="progress"><span style="width:${FMG.clamp(value, 0, 100)}%"></span></div>
      </article>`;
  }

  function renderObjective(objective) {
    const progress = FMG.clamp(objective.progress || 0, 0, 100);
    return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(objective.title)} | ${FMG.escapeHtml(FMG.objectiveStatusLabel(objective))}</strong>
        <p class="muted">${FMG.escapeHtml(objective.detail)}</p>
        <div class="progress"><span style="width:${progress}%"></span></div>
      </div>`;
  }

  function renderOffer(offer, state) {
    const disabled = !state.seasonComplete && state.career.status !== "sacked";
    return `
      <div class="list-row compact">
        <div>
          <strong>${FMG.escapeHtml(offer.teamName)}</strong>
          <p class="muted">${FMG.escapeHtml(offer.ambition)} | Reputacion requerida ${offer.reputationRequired} | Sueldo ${FMG.currency(offer.salary)}</p>
        </div>
        <button class="btn-primary" data-action="accept-career-offer" data-offer-id="${offer.id}" data-confirm="Aceptar oferta de ${FMG.escapeHtml(offer.teamName)} y cambiar de club?" ${disabled ? "disabled" : ""}>Aceptar</button>
      </div>`;
  }

  function renderDecision(decision) {
    const pending = decision.status === "pending";
    return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(decision.title)}</strong>
        <p class="muted">${FMG.escapeHtml(decision.detail)}</p>
        ${
          pending
            ? `<div class="button-row" style="margin-top:10px;">
                ${decision.choices.map((choice) => `<button class="btn-secondary" data-action="resolve-career-decision" data-decision-id="${decision.id}" data-choice-id="${choice.id}">${FMG.escapeHtml(choice.label)}</button>`).join("")}
              </div>`
            : `<p class="muted">Resuelto: ${FMG.escapeHtml(decision.result?.label || "Sin detalle")}</p>`
        }
      </div>`;
  }

  FMG.renderCareerView = function (state) {
    FMG.ensureCareerState(state);
    FMG.evaluateBoardObjectives(state, { seasonEnd: false });
    const career = state.career;
    const profile = state.managerProfile;
    const style = FMG.MANAGER_STYLES[profile.style] || FMG.MANAGER_STYLES.balanced;
    const evaluation = career.lastEvaluation || { score: 0, summary: "Sin evaluacion" };

    return `
      <section class="hero">
        <div class="panel hero-main">
          <span class="eyebrow">Carrera de manager</span>
          <h1 class="hero-title">${FMG.escapeHtml(profile.name)}</h1>
          <p class="hero-copy">${FMG.escapeHtml(profile.nationality)} | ${profile.age} anos | Estado: ${FMG.escapeHtml(career.status === "sacked" ? "Despedido" : career.status === "unemployed" ? "Sin club" : "Empleado")}</p>
          <div class="chips">
            <span class="chip">Reputacion ${career.reputation}/100</span>
            <span class="chip">${FMG.escapeHtml(FMG.reputationLabel(career.reputation))}</span>
            <span class="chip">Directorio ${state.finances.boardTrust}/100</span>
          </div>
          <div class="hero-actions">
            <button class="btn-secondary" data-action="generate-career-offers">Buscar ofertas</button>
            <button class="btn-primary" data-action="create-career-decision">Nueva decision</button>
          </div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">Evaluacion</div><div class="stat-value">${evaluation.score}/100</div></article>
            <article class="stat-card"><div class="muted">Victorias</div><div class="stat-value">${career.record.wins}</div></article>
            <article class="stat-card"><div class="muted">Trofeos</div><div class="stat-value">${career.trophies.length}</div></article>
            <article class="stat-card"><div class="muted">Logros</div><div class="stat-value">${career.achievements.length}</div></article>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Estilo</h2><span class="chip">${FMG.escapeHtml(style.label)}</span></div>
            <div class="button-row">
              ${Object.entries(FMG.MANAGER_STYLES).map(([key, config]) => `<button class="${profile.style === key ? "active" : "btn-ghost"}" data-action="set-manager-style" data-style="${key}">${FMG.escapeHtml(config.label)}</button>`).join("")}
            </div>
          </section>
          <section class="panel">
            <div class="section-title"><h2>Relaciones</h2></div>
            <div class="stats-grid">
              ${relationCard("Hinchas", career.relations.fans)}
              ${relationCard("Jugadores", career.relations.players)}
              ${relationCard("Prensa", career.relations.press)}
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Objetivos del directorio</h2><span class="chip">${FMG.escapeHtml(evaluation.summary)}</span></div>
          <div class="log-list">
            ${career.objectives.length ? career.objectives.map(renderObjective).join("") : `<div class="empty-state">Todavia no hay objetivos activos.</div>`}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Ofertas</h2><span class="chip">${career.offers.filter((offer) => offer.status === "pending").length} activas</span></div>
          <div class="log-list">
            ${
              career.offers.filter((offer) => offer.status === "pending").length
                ? career.offers.filter((offer) => offer.status === "pending").map((offer) => renderOffer(offer, state)).join("")
                : `<div class="empty-state">No hay propuestas pendientes.</div>`
            }
          </div>
        </section>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Decisiones narrativas</h2></div>
          <div class="log-list">
            ${career.decisions.length ? career.decisions.map(renderDecision).join("") : `<div class="empty-state">No hay decisiones pendientes ni recientes.</div>`}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Logros y trofeos</h2></div>
          <div class="log-list">
            ${
              career.achievements.length || career.trophies.length
                ? [...career.trophies.map((item) => ({ title: item.title, detail: `${item.teamName} | Temporada ${item.seasonNumber}` })), ...career.achievements].slice(0, 10).map((item) => `
                  <div class="log-item">
                    <strong>${FMG.escapeHtml(item.title)}</strong>
                    <p class="muted">${FMG.escapeHtml(item.detail || `Temporada ${item.seasonNumber}`)}</p>
                  </div>`).join("")
                : `<div class="empty-state">La vitrina de carrera aun esta vacia.</div>`
            }
          </div>
        </section>
      </section>
      <section class="card">
        <div class="section-title"><h2>Historial de carrera</h2><span class="chip">${career.history.length} temporada(s)</span></div>
        <div class="log-list">
          ${
            career.history.length
              ? career.history.map((entry) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(entry.teamName)} | Temporada ${entry.seasonNumber}</strong>
                  <p class="muted">Posicion ${entry.position || "-"} | ${entry.points} pts | Reputacion ${entry.reputation} | Directorio ${entry.boardTrust}/100</p>
                </div>`).join("")
              : `<div class="empty-state">Completa una temporada para iniciar el historial profesional.</div>`
          }
        </div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Bitacora de carrera</h2></div>
        <div class="log-list">
          ${
            career.narrativeLog.length
              ? career.narrativeLog.slice(0, 10).map((entry) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(entry.title)}</strong>
                  <p class="muted">T${entry.seasonNumber} | Semana ${entry.week}</p>
                  <p class="muted">${FMG.escapeHtml(entry.detail)}</p>
                </div>`).join("")
              : `<div class="empty-state">Aun no hay hitos de carrera.</div>`
          }
        </div>
      </section>
    `;
  };
})();
