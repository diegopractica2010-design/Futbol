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
                ${decision.choices.map((choice) => `<button class="btn-secondary" data-action="resolve-manager-decision" data-decision-id="${decision.id}" data-choice-id="${choice.id}">${FMG.escapeHtml(choice.label)}</button>`).join("")}
              </div>`
            : `<p class="muted">Resuelto: ${FMG.escapeHtml(decision.result?.label || "Sin detalle")}</p>`
        }
      </div>`;
  }

  function renderEcosystemSnapshot(state) {
    const eco = FMG.ensureManagerEcosystemState ? FMG.ensureManagerEcosystemState(state) : state.managerEcosystem;
    if (!eco) return "";
    const club = eco.clubs?.[state.userTeamId] || {};
    const manager = eco.manager || {};
    const dressing = eco.squad?.dressingRoom || {};
    const politics = eco.politics?.currentPressure || {};
    const latestReport = eco.scouting?.reports?.[0] || null;
    const latestConference = eco.media?.pressConferences?.[0] || null;
    const latestYouth = eco.youth?.intakeHistory?.[0] || null;
    const staff = club.staff || {};
    const world = FMG.ensureFootballWorldMediaState ? FMG.ensureFootballWorldMediaState(state) : eco.worldMedia;
    const latestWorldStory = world?.narratives?.storylines?.[0] || null;

    return `
      <section class="content-grid manager-ecosystem-grid">
        <section class="card manager-ecosystem-card">
          <div class="section-title"><h2>Ecosistema del club</h2><span class="chip">${FMG.escapeHtml(club.board?.expectation || "Proyecto")}</span></div>
          <div class="ecosystem-kpis">
            <article><span>Cultura</span><strong>${FMG.escapeHtml(club.culture?.identity || "Club")}</strong></article>
            <article><span>Reputacion club</span><strong>${club.reputation || 50}/100</strong></article>
            <article><span>Presion politica</span><strong>${FMG.escapeHtml(politics.topic || "resultados")}</strong></article>
            <article><span>Burnout manager</span><strong>${manager.burnout || 0}/100</strong></article>
            <article><span>Prensa mundial</span><strong>${world?.media?.pressure || 0}/100</strong></article>
            <article><span>Hinchas</span><strong>${world?.fans?.pressure || 0}/100</strong></article>
          </div>
          <div class="log-list ecosystem-list">
            ${(club.board?.politics || []).map((faction) => `
              <div class="log-item">
                <strong>${FMG.escapeHtml(faction.name)} | Influencia ${faction.influence}</strong>
                <p class="muted">Animo ${Math.round(faction.mood)}/100</p>
                <div class="progress"><span style="width:${FMG.clamp(faction.mood, 0, 100)}%"></span></div>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="card manager-ecosystem-card">
          <div class="section-title"><h2>Vestuario y staff</h2><span class="chip">Ambiente ${dressing.atmosphere || 50}/100</span></div>
          <div class="ecosystem-kpis">
            <article><span>Liderazgo</span><strong>${dressing.leadership || 50}/100</strong></article>
            <article><span>Riesgo conflicto</span><strong>${dressing.conflictRisk || 35}/100</strong></article>
            <article><span>Asistente</span><strong>${FMG.escapeHtml(staff.assistant?.name || "Sin dato")}</strong></article>
            <article><span>Psicologia</span><strong>${staff.psychologist?.quality || 50}/100</strong></article>
          </div>
          <div class="log-list ecosystem-list">
            ${(eco.squad?.hierarchy || []).slice(0, 4).map((leader) => `
              <div class="log-item">
                <strong>${FMG.escapeHtml(leader.name)}</strong>
                <p class="muted">${FMG.escapeHtml(leader.role)} | Influencia ${leader.influence}/100</p>
              </div>
            `).join("") || `<div class="empty-state">Aun no hay jerarquia clara.</div>`}
          </div>
        </section>
      </section>
      <section class="content-grid manager-ecosystem-grid">
        <section class="card">
          <div class="section-title"><h2>Prensa y mundo</h2><span class="chip">Reputacion publica ${manager.mediaReputation || 50}/100</span></div>
          <div class="log-list">
            ${latestWorldStory ? `
              <div class="log-item">
                <strong>${FMG.escapeHtml(latestWorldStory.topic)} | ${FMG.escapeHtml(latestWorldStory.arc)}</strong>
                <p class="muted">Narrativa mundial ${latestWorldStory.heat}/100 | Prestigio liga ${world?.reputation?.leaguePrestige || 0}/100</p>
              </div>` : ""}
            ${latestConference ? `
              <div class="log-item">
                <strong>${FMG.escapeHtml(latestConference.journalistName)} | ${FMG.escapeHtml(latestConference.tone)}</strong>
                <p class="muted">Tema: ${FMG.escapeHtml(latestConference.topic)}</p>
              </div>` : `<div class="empty-state">Sin rueda de prensa reciente.</div>`}
            ${(eco.media?.rumors || []).slice(0, 3).map((rumor) => `
              <div class="log-item">
                <strong>${FMG.escapeHtml(rumor.playerName)}</strong>
                <p class="muted">${FMG.escapeHtml(rumor.topic)} | Credibilidad ${rumor.credibility}/100</p>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Seguimiento y cantera</h2><span class="chip">${eco.scouting?.reports?.length || 0} informes</span></div>
          <div class="log-list">
            ${latestReport ? `
              <div class="log-item">
                <strong>${FMG.escapeHtml(latestReport.playerName)} | ${FMG.escapeHtml(latestReport.position)}</strong>
                <p class="muted">Encaje ${latestReport.fit}/100 | Riesgo ${latestReport.risk}/100 | ${FMG.escapeHtml(latestReport.note)}</p>
              </div>` : `<div class="empty-state">La red de observación prepara informes.</div>`}
            ${latestYouth ? `
              <div class="log-item">
                <strong>Ultima camada juvenil</strong>
                <p class="muted">Semana ${latestYouth.week}, temporada ${latestYouth.seasonNumber}: ${latestYouth.count} jugador(es).</p>
              </div>` : ""}
          </div>
        </section>
      </section>
    `;
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
      <details class="ux-disclosure">
        <summary>Entorno del club, prensa y seguimiento</summary>
        ${renderEcosystemSnapshot(state)}
      </details>
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
      <details class="ux-disclosure">
        <summary>Historial y bitácora de carrera</summary>
        <section class="content-grid">
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
        </section>
      </details>
      ${(function () {
        const scandals = (state.scandals || []).filter(function (s) { return !s.resolved; });
        const traditions = (state.clubCulture && state.clubCulture.activeTraditions || []).filter(function (t) { return t.seasonNumber === (state.seasonNumber || 1); });
        if (!scandals.length && !traditions.length) return "";
        return `<details class="ux-disclosure">
          <summary>Escándalos activos y tradiciones del club</summary>
          <section class="content-grid">
            <section class="card">
              <div class="section-title"><h2>Escándalos activos</h2><span class="chip">${scandals.length}</span></div>
              <div class="log-list">
                ${scandals.length ? scandals.map(function (s) { return `
                  <div class="log-item">
                    <strong>Nivel ${s.severity} | ${FMG.escapeHtml(s.title)}</strong>
                    <p class="muted">${FMG.escapeHtml(s.description)}</p>
                    <p class="muted">Semana ${s.week} | ${s.mechanicalEffect || ""}</p>
                  </div>`;}).join("") : `<div class="empty-state">Sin escándalos activos.</div>`}
              </div>
            </section>
            <section class="card">
              <div class="section-title"><h2>Tradiciones activas</h2><span class="chip">${traditions.length}</span></div>
              <div class="log-list">
                ${traditions.length ? traditions.map(function (t) { return `
                  <div class="log-item">
                    <strong>${FMG.escapeHtml(t.title)}</strong>
                    <p class="muted">${FMG.escapeHtml(t.body)}</p>
                  </div>`;}).join("") : `<div class="empty-state">Sin tradiciones activadas esta temporada.</div>`}
              </div>
            </section>
          </section>
        </details>`;
      })()}
      ${(function () {
        const eco = state.managerEcosystem || {};
        const conferences = (eco.media && eco.media.pressConferences || []).filter(function (c) { return !c.resolved && c.answerable && c.questions; });
        if (!conferences.length) return "";
        const conf = conferences[0];
        return `<details class="ux-disclosure" open>
          <summary>Rueda de prensa pendiente — ${FMG.escapeHtml(conf.topic)}</summary>
          <section class="card">
            <div class="section-title"><h2>Conferencia de prensa</h2><span class="chip">${FMG.escapeHtml(conf.journalistName || "Periodista")} | ${FMG.escapeHtml(conf.tone)}</span></div>
            <p class="muted" style="padding:0 1rem 0.5rem">Tema: ${FMG.escapeHtml(conf.topic)}</p>
            ${(conf.questions || []).map(function (q, qi) { return `
              <div class="log-item">
                <strong>P${qi + 1}: ${FMG.escapeHtml(q.question)}</strong>
                <div class="button-row" style="margin-top:0.5rem">
                  ${(q.choices || []).map(function (ch, ci) { return `
                    <button class="${q.answered && q.selectedChoice === ci ? "active" : "btn-ghost"}"
                      data-action="answer-press-conference"
                      data-conference-id="${FMG.escapeHtml(conf.id)}"
                      data-question-idx="${qi}"
                      data-choice-idx="${ci}"
                      title="${FMG.escapeHtml(ch.text)}">
                      ${FMG.escapeHtml(ch.label)} (${FMG.escapeHtml(ch.tone)})
                    </button>`;}).join("")}
                </div>
              </div>`;}).join("")}
          </section>
        </details>`;
      })()}
      ${(function () {
        const docs = FMG.LegacyEngine ? FMG.LegacyEngine.getDocumentaries(state).slice(0, 3) : [];
        const legacy = FMG.LegacyEngine ? FMG.LegacyEngine.getManagerLegacy(state) : null;
        if (!docs.length && !legacy) return "";
        return `<details class="ux-disclosure">
          <summary>Legado y documentales de temporada</summary>
          <section class="content-grid">
            ${legacy ? `<section class="card">
              <div class="section-title"><h2>Legado del técnico</h2><span class="chip">${FMG.escapeHtml(legacy.legacyLabel)}</span></div>
              <div class="stats-grid">
                <article class="stat-card"><div class="muted">Puntuación</div><div class="stat-value">${legacy.legacyScore}/100</div></article>
                <article class="stat-card"><div class="muted">Títulos</div><div class="stat-value">${legacy.totalTitles}</div></article>
                <article class="stat-card"><div class="muted">Temporadas</div><div class="stat-value">${legacy.seasonsManaged}</div></article>
                <article class="stat-card"><div class="muted">Hall of Fame</div><div class="stat-value">${legacy.hallOfFamePlayersNurtured}</div></article>
              </div>
            </section>` : ""}
            <section class="card">
              <div class="section-title"><h2>Archivo de temporada</h2><span class="chip">${docs.length} entrega(s)</span></div>
              <div class="log-list">
                ${docs.map(function (doc) { return `
                  <div class="log-item">
                    <strong>T${doc.season} — ${FMG.escapeHtml(doc.clubName)}</strong>
                    ${(doc.paragraphs || []).map(function (p) { return `<p class="muted">${FMG.escapeHtml(p)}</p>`;}).join("")}
                  </div>`;}).join("") || `<div class="empty-state">Los documentales se generan al completar cada temporada.</div>`}
              </div>
            </section>
          </section>
        </details>`;
      })()}
    `;
  };
})();
