(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderStatLine(label, homeValue, awayValue) {
    return `
      <div class="stat-line">
        <strong>${homeValue}</strong>
        <span>${label}</span>
        <strong>${awayValue}</strong>
      </div>
    `;
  }

  const EVENT_LABELS = {
    goal: "Gol",
    shot: "Remate",
    "shot-on-target": "Remate al arco",
    "yellow-card": "Tarjeta amarilla",
    "red-card": "Tarjeta roja",
    foul: "Falta",
    injury: "Lesion",
    substitution: "Cambio",
    save: "Atajada",
    corner: "Corner",
    offside: "Offside",
    tactical: "Cambio tactico",
    chance: "Avance"
  };

  function renderLiveControls(liveMatch) {
    if (liveMatch.completed) {
      return `<div class="button-row"><button class="btn-primary" data-action="finish-live-match">Cerrar fecha</button></div>`;
    }
    const isPaused = liveMatch.paused === true;
    return `
      <div class="button-row">
        <button class="btn-primary" data-action="toggle-live-playback">${isPaused ? "Reproducir" : "Pausar"}</button>
        <button class="btn-secondary" data-action="advance-live-match">Avanzar ${liveMatch.speed} min</button>
        <button class="btn-ghost" data-action="advance-live-minute">+1 min</button>
        <button class="btn-secondary" data-action="advance-live-half">Avanzar al descanso/final</button>
        <button class="btn-ghost" data-action="simulate-live-full">Simular completo</button>
      </div>
      <div class="button-row">
        <button class="${liveMatch.speed === 1 ? "active" : "btn-ghost"}" data-action="set-live-speed" data-speed="1">x1</button>
        <button class="${liveMatch.speed === 3 ? "active" : "btn-ghost"}" data-action="set-live-speed" data-speed="3">x3</button>
        <button class="${liveMatch.speed === 5 ? "active" : "btn-ghost"}" data-action="set-live-speed" data-speed="5">x5</button>
        <button class="${liveMatch.speed === 10 ? "active" : "btn-ghost"}" data-action="set-live-speed" data-speed="10">x10</button>
        <button class="${liveMatch.speed === 20 ? "active" : "btn-ghost"}" data-action="set-live-speed" data-speed="20">x20</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="defend">Proteger area</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="balanced">Equilibrar</button>
        <button class="btn-secondary" data-action="live-tactic" data-mode="attack">Adelantar lineas</button>
      </div>
    `;
  }

  function renderLiveSubstitutions(state, liveMatch) {
    const userSide = liveMatch.homeTeamId === state.userTeamId ? "home" : "away";
    const lineupIds = userSide === "home" ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
    const benchIds = userSide === "home" ? liveMatch.homeBenchIds : liveMatch.awayBenchIds;
    const lineup = lineupIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
    const bench = benchIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
    const starters = [...lineup].sort((left, right) => left.energy - right.energy);
    state.ui = state.ui || {};
    const selectedOut = state.ui.selectedSubOutId || starters[0]?.id || null;

    return `
      <section class="card">
        <div class="section-title"><h2>Cambios</h2><span class="chip">${liveMatch.substitutions[userSide]}/5 usados</span></div>
        <div class="sub-grid">
          <div>
            <strong>Titulares</strong>
            <div class="log-list" style="margin-top:12px;">
              ${starters.map((player) => `
                <div class="log-item ${selectedOut === player.id ? "sub-selected" : ""}">
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p class="muted">${FMG.escapeHtml(player.position)} | Energia ${player.energy} | OVR ${player.overall}</p>
                  <div class="energy-bar" role="meter" aria-valuenow="${player.energy}" aria-valuemin="0" aria-valuemax="100" aria-label="Energia de ${FMG.escapeHtml(player.name)}"><span style="width:${player.energy}%"></span></div>
                  <div class="button-row" style="margin-top:10px;"><button class="btn-ghost" data-action="select-sub-out" data-player-id="${player.id}">Sacar</button></div>
                </div>`).join("")}
            </div>
          </div>
          <div>
            <strong>Banca disponible</strong>
            <div class="log-list" style="margin-top:12px;">
              ${bench.map((player) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p class="muted">${FMG.escapeHtml(player.position)} | Energia ${player.energy} | OVR ${player.overall}</p>
                  <div class="energy-bar" role="meter" aria-valuenow="${player.energy}" aria-valuemin="0" aria-valuemax="100" aria-label="Energia de ${FMG.escapeHtml(player.name)}"><span style="width:${player.energy}%"></span></div>
                  <div class="button-row" style="margin-top:10px;">
                    ${selectedOut ? `<button class="btn-ghost" data-action="live-substitution" data-in-player-id="${player.id}" data-out-player-id="${selectedOut}">Entrar por el seleccionado</button>` : ""}
                  </div>
                </div>`).join("") || `<div class="empty-state">Sin suplentes disponibles.</div>`}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderOrderButtons(liveMatch, group, options, label) {
    const userSide = liveMatch.homeTeamId === window.FMG.gameState.userTeamId ? "home" : "away";
    const current = liveMatch.liveOrders?.[userSide]?.[group] || "normal";
    return `
      <div class="tactic-control compact-control live-order-control">
        <strong>${label}</strong>
        <div class="button-row">
          ${options.map(([value, text]) => `
            <button class="${current === value ? "active" : "btn-ghost"}" data-action="live-team-order" data-group="${group}" data-value="${value}">${FMG.escapeHtml(text)}</button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderLiveOrders(state, liveMatch) {
    const userSide = liveMatch.homeTeamId === state.userTeamId ? "home" : "away";
    const lineupIds = userSide === "home" ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
    const players = lineupIds.map((id) => state.players.find((player) => player.id === id)).filter(Boolean);
    const keyPlayers = players
      .filter((player) => ["MED", "EXT", "DEL"].includes(player.position))
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 6);

    return `
      <section class="card">
        <div class="section-title"><h2>Ordenes del partido</h2><span class="chip">Pizarra en vivo</span></div>
        <div class="tactic-grid">
          ${renderOrderButtons(liveMatch, "mentality", [["attack", "Atacar"], ["balanced", "Equilibrar"], ["defend", "Defender"]], "Mentalidad")}
          ${renderOrderButtons(liveMatch, "press", [["high", "Presion alta"], ["normal", "Normal"], ["low", "Bloque bajo"]], "Presion")}
          ${renderOrderButtons(liveMatch, "tempo", [["fast", "Ritmo alto"], ["normal", "Normal"], ["slow", "Pausar"]], "Ritmo")}
          ${renderOrderButtons(liveMatch, "risk", [["direct", "Directo"], ["normal", "Normal"], ["safe", "Seguro"]], "Riesgo")}
        </div>
        <div class="log-list" style="margin-top:14px;">
          ${keyPlayers.map((player) => {
            const current = liveMatch.playerOrders?.[player.id] || "normal";
            const orders = [["normal", "Normal"], ["shoot", "Rematar"], ["safe", "Simple"], ["press", "Presionar"], ["free", "Libertad"], ["run", "Al espacio"]];
            return `
              <div class="log-item live-player-order">
                <div>
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p class="muted">${FMG.escapeHtml(player.position)} | OVR ${player.overall} | Energia ${player.energy}</p>
                </div>
                <div class="button-row">
                  ${orders.map(([order, text]) => `<button class="${current === order ? "active" : "btn-ghost"}" data-action="live-player-order" data-player-id="${player.id}" data-order="${order}">${text}</button>`).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function statValue(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function renderHudMeter(label, homeValue, awayValue, options = {}) {
    const total = Math.max(1, statValue(homeValue) + statValue(awayValue));
    const homePct = options.fixedPct !== undefined
      ? FMG.clamp(statValue(options.fixedPct, 50), 0, 100)
      : FMG.clamp(Math.round((statValue(homeValue) / total) * 100), 0, 100);
    const awayPct = 100 - homePct;
    const homeText = options.format ? options.format(homeValue) : homeValue;
    const awayText = options.format ? options.format(awayValue) : awayValue;
    return `
      <div class="live-hud-meter" style="--home-pct:${homePct}%;--away-pct:${awayPct}%;">
        <div class="live-hud-meter__labels">
          <strong>${FMG.escapeHtml(String(homeText))}</strong>
          <span>${FMG.escapeHtml(label)}</span>
          <strong>${FMG.escapeHtml(String(awayText))}</strong>
        </div>
        <div class="live-hud-meter__track" aria-label="${FMG.escapeHtml(label)} ${FMG.escapeHtml(String(homeText))} contra ${FMG.escapeHtml(String(awayText))}">
          <span class="live-hud-meter__home"></span>
          <span class="live-hud-meter__away"></span>
        </div>
      </div>
    `;
  }

  function renderTimelineDots(events, homeTeamId, awayTeamId) {
    return events.map((event) => {
      const left = FMG.clamp((statValue(event.minute) / 90) * 100, 0, 100);
      const side = event.teamId === homeTeamId ? "home" : event.teamId === awayTeamId ? "away" : "neutral";
      return `<span class="live-timeline-dot live-timeline-dot--${side} event-${FMG.escapeHtml(event.type)}" style="left:${left}%;" title="${event.minute}' ${FMG.escapeHtml(EVENT_LABELS[event.type] || event.type)}"></span>`;
    }).join("");
  }

  function renderLiveTacticalHud(state, liveMatch, homeTeam, awayTeam, userGoalFlash) {
    const result = liveMatch.result || {};
    const stats = result.stats || { home: {}, away: {} };
    const timeline = (result.timeline || [])
      .map((event, index) => ({ ...event, _index: index }))
      .filter((event) => statValue(event.minute) <= statValue(liveMatch.minute))
      .sort((left, right) => statValue(left.minute) - statValue(right.minute) || left._index - right._index);
    const feedEvents = timeline.slice(-8).reverse();
    const keyEvents = timeline.filter((event) => ["goal", "shot-on-target", "yellow-card", "red-card", "injury", "tactical"].includes(event.type));
    const homePossession = statValue(stats.home.possession, 50);
    const awayPossession = statValue(stats.away.possession, 100 - homePossession);
    const homeXg = statValue(stats.home.xg);
    const awayXg = statValue(stats.away.xg);
    const homeMomentum = FMG.clamp(statValue(liveMatch.momentum, 50), 0, 100);
    const awayMomentum = 100 - homeMomentum;
    const minutePct = FMG.clamp((statValue(liveMatch.minute) / 90) * 100, 0, 100);

    return `
      <div class="live-tactical-hud" data-playback-minute="${statValue(liveMatch.minute)}">
        <div class="live-hud-scoreboard">
          <div class="live-hud-team live-hud-team--home">
            ${FMG.clubBadge(homeTeam, "md")}
            <div><strong>${FMG.escapeHtml(homeTeam.name)}</strong><span>${liveMatch.homeLineupIds.length} en cancha</span></div>
          </div>
          <div class="live-hud-score">
            <span class="live-hud-clock">${liveMatch.completed ? "FT" : `${liveMatch.minute}'`}</span>
            <strong class="${userGoalFlash ? "score--gol" : ""}" role="status" aria-live="polite" aria-label="Marcador: ${result.homeGoals} a ${result.awayGoals}">${result.homeGoals} - ${result.awayGoals}</strong>
          </div>
          <div class="live-hud-team live-hud-team--away">
            ${FMG.clubBadge(awayTeam, "md")}
            <div><strong>${FMG.escapeHtml(awayTeam.name)}</strong><span>${liveMatch.awayLineupIds.length} en cancha</span></div>
          </div>
        </div>
        <div class="live-hud-timeline" style="--minute-pct:${minutePct}%;">
          <div class="live-hud-timeline__rail">
            <span class="live-hud-timeline__elapsed"></span>
            ${renderTimelineDots(keyEvents, liveMatch.homeTeamId, liveMatch.awayTeamId)}
          </div>
          <div class="live-hud-timeline__ticks"><span>0'</span><span>45'</span><span>90'</span></div>
        </div>
        <div class="live-hud-grid">
          <div class="live-hud-panel">
            <span class="live-hud-label">Control</span>
            ${renderHudMeter("Posesion", `${homePossession}%`, `${awayPossession}%`, { fixedPct: homePossession })}
            ${renderHudMeter("Momentum", homeMomentum, awayMomentum, { fixedPct: homeMomentum, format: (value) => `${Math.round(statValue(value))}%` })}
            ${renderHudMeter("xG", homeXg, awayXg, { format: (value) => statValue(value).toFixed(2) })}
          </div>
          <div class="live-hud-panel live-hud-kpis">
            <div><span>Remates</span><strong>${statValue(stats.home.shots)}-${statValue(stats.away.shots)}</strong></div>
            <div><span>Al arco</span><strong>${statValue(stats.home.shotsOnTarget)}-${statValue(stats.away.shotsOnTarget)}</strong></div>
            <div><span>Faltas</span><strong>${statValue(stats.home.fouls)}-${statValue(stats.away.fouls)}</strong></div>
            <div><span>Tarjetas</span><strong>${statValue(stats.home.yellowCards) + statValue(stats.home.redCards)}-${statValue(stats.away.yellowCards) + statValue(stats.away.redCards)}</strong></div>
          </div>
          <div class="live-hud-panel live-hud-feed">
            <div class="live-hud-feed__head"><span class="live-hud-label">Eventos</span><strong>${timeline.length}</strong></div>
            <div class="live-hud-feed__list">
              ${feedEvents.map((event) => `
                <div class="live-hud-event event-${FMG.escapeHtml(event.type)} ${event.type === "goal" && event.teamId === state.userTeamId ? "event-goal--user" : ""}">
                  <strong>${event.minute}' ${FMG.escapeHtml(EVENT_LABELS[event.type] || event.type)}</strong>
                  <span>${FMG.escapeHtml(event.text || event.playerName || "")}</span>
                </div>
              `).join("") || `<div class="live-hud-event live-hud-event--empty"><strong>0'</strong><span>Esperando el primer evento.</span></div>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderLiveMatch(state) {
    const liveMatch = state.liveMatch;
    const homeTeam = state.teams.find((team) => team.id === liveMatch.homeTeamId);
    const awayTeam = state.teams.find((team) => team.id === liveMatch.awayTeamId);
    const result = liveMatch.result;
    const visibleTimeline = (result.timeline || [])
      .map((event, index) => ({ ...event, _index: index }))
      .filter((event) => statValue(event.minute) <= statValue(liveMatch.minute))
      .sort((left, right) => statValue(left.minute) - statValue(right.minute) || left._index - right._index);
    const lastGoal = [...visibleTimeline].reverse().find((event) => event.type === "goal");
    const userGoalFlash = lastGoal && lastGoal.teamId === state.userTeamId && liveMatch.minute - lastGoal.minute <= 2;
    const presentation = FMG.PresentationController?.getState ? FMG.PresentationController.getState(state, liveMatch) : null;

    return `
      <section class="card live-match ${userGoalFlash ? "live-match--goal" : ""}">
        <div class="section-title">
          <h2>Partido en vivo</h2>
          <span class="chip">${liveMatch.completed ? "Final" : `${liveMatch.minute}'`}</span>
        </div>
        ${FMG.PresentationController?.renderMatchIntro ? FMG.PresentationController.renderMatchIntro(presentation, FMG.escapeHtml) : ""}
        ${renderLiveTacticalHud(state, liveMatch, homeTeam, awayTeam, userGoalFlash)}
        <div id="match-visualizer-container" aria-label="Visualizacion tactica del partido">
          <div class="match-renderer-loading">Preparando vista tactica...</div>
        </div>
        ${renderLiveControls(liveMatch)}
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Relato en vivo</h2><span class="chip">${visibleTimeline.length} eventos</span></div>
          <div class="log-list">
            ${visibleTimeline.slice(-16).reverse().map((event) => `
              <div class="log-item event-${FMG.escapeHtml(event.type)} ${event.type === "goal" && event.teamId === state.userTeamId ? "event-goal--user" : ""}">
                <strong>${event.minute}' | ${FMG.escapeHtml(EVENT_LABELS[event.type] || event.type)}</strong>
                <p class="muted">${FMG.escapeHtml(event.text)}</p>
              </div>`).join("") || `<div class="empty-state">El partido espera el pitazo inicial.</div>`}
          </div>
        </section>
        ${renderLiveOrders(state, liveMatch)}
        ${renderLiveSubstitutions(state, liveMatch)}
      </section>
    `;
  }

  function renderTacticalPreview(state, upcomingMatches) {
    const userMatch = upcomingMatches ? upcomingMatches.find((match) => match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId) : null;
    if (!userMatch) return `<div class="empty-state">Tu club descansa en la próxima fecha.</div>`;
    const opponentId = userMatch.homeTeamId === state.userTeamId ? userMatch.awayTeamId : userMatch.homeTeamId;
    const opponent = state.teams.find((team) => team.id === opponentId);
    const userProfile = FMG.getTacticalMatchProfile(state, state.userTeamId);
    const rivalProfile = FMG.getTacticalMatchProfile(state, opponentId);
    const userPlan = FMG.getTeamPlan(state, state.userTeamId);
    const rivalPlan = FMG.getTeamPlan(state, opponentId);
    const rows = [
      ["Formación", userPlan.formation, rivalPlan.formation],
      ["Posesión", userProfile.possession.toFixed(1), rivalProfile.possession.toFixed(1)],
      ["Ataque", userProfile.attack.toFixed(1), rivalProfile.attack.toFixed(1)],
      ["Defensa", userProfile.defense.toFixed(1), rivalProfile.defense.toFixed(1)],
      ["Riesgo", userProfile.risk.toFixed(1), rivalProfile.risk.toFixed(1)],
      ["Desgaste", userProfile.fatigue.toFixed(1), rivalProfile.fatigue.toFixed(1)]
    ];
    return `
      <div class="section-title"><h2>Previa táctica</h2><span class="chip">vs ${FMG.escapeHtml(opponent.name)}</span></div>
      <div class="log-list" style="margin-bottom:14px;">
        <div class="log-item"><strong>Análisis automático del rival</strong><p class="muted">${FMG.escapeHtml(opponent.name)} llega con defensa ${rivalProfile.defense.toFixed(1)} y ataque ${rivalProfile.attack.toFixed(1)}. Su estilo ${FMG.escapeHtml(opponent.style)} marca el ritmo de la previa.</p></div>
        <div class="log-item"><strong>Recomendación táctica</strong><p class="muted">${userProfile.attack >= rivalProfile.defense ? "Tu plan ofensivo puede encontrar ventajas temprano." : "Conviene administrar riesgos y atacar con transiciones mas claras."}</p></div>
        <div class="log-item"><strong>Historia reciente</strong><p class="muted">${FMG.escapeHtml((state.seasonLog || []).slice(0, 3).map((entry) => `Semana ${entry.week}: ${entry.result || "sin duelo directo"}`).join(" | ") || "Sin enfrentamientos recientes.")}</p></div>
      </div>
      <div class="table tactical-table">
        <div class="table-row header"><span>Factor</span><span>${FMG.escapeHtml(state.userClub.name)}</span><span>${FMG.escapeHtml(opponent.name)}</span></div>
        ${rows.map(([label, userValue, rivalValue]) => `
          <div class="table-row"><span>${FMG.escapeHtml(label)}</span><span>${FMG.escapeHtml(userValue)}</span><span>${FMG.escapeHtml(rivalValue)}</span></div>
        `).join("")}
      </div>
    `;
  }

  FMG.renderMatchView = function (state, upcomingMatches) {
    if (state.liveMatch) return renderLiveMatch(state);
    const currentMatch = state.currentMatch;
    const homeTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.homeTeamId) : null;
    const awayTeam = currentMatch ? state.teams.find((team) => team.id === currentMatch.awayTeamId) : null;
    const stats = currentMatch ? currentMatch.stats : null;
    return `
      <section class="content-grid">
        <section class="card">
          <div class="section-title">
            <h2>Ultimo partido</h2>
            <div class="button-row">
              <button class="btn-primary" data-action="start-live-match">Jugar partido</button>
              <button class="btn-secondary" data-action="advance-week">Simular fecha</button>
            </div>
          </div>
          ${
            currentMatch
              ? `<article class="match-card">
                  <p class="muted">Semana ${currentMatch.week || Math.max(state.currentWeek - 1, 1)}</p>
                  <div class="match-score">
                    <div>${FMG.clubBadge(homeTeam, "md")}<strong>${FMG.escapeHtml(homeTeam.name)}</strong></div>
                    <div class="score">${currentMatch.homeGoals} - ${currentMatch.awayGoals}</div>
                    <div>${FMG.clubBadge(awayTeam, "md")}<strong>${FMG.escapeHtml(awayTeam.name)}</strong></div>
                  </div>
                  <p class="muted">${FMG.escapeHtml(currentMatch.summary)}</p>
                  ${stats ? `
                    <div class="match-stats">
                      ${renderStatLine("Posesion", `${stats.home.possession}%`, `${stats.away.possession}%`)}
                      ${renderStatLine("Remates", stats.home.shots, stats.away.shots)}
                      ${renderStatLine("Al arco", stats.home.shotsOnTarget, stats.away.shotsOnTarget)}
                      ${renderStatLine("xG", stats.home.xg.toFixed(2), stats.away.xg.toFixed(2))}
                      ${renderStatLine("Faltas", stats.home.fouls, stats.away.fouls)}
                      ${renderStatLine("Tarjetas", `${stats.home.yellowCards}/${stats.home.redCards}`, `${stats.away.yellowCards}/${stats.away.redCards}`)}
                    </div>` : ""}
                  <div style="margin-top:18px; display:grid; gap:10px;">
                    ${[...currentMatch.homeEvents, ...currentMatch.awayEvents]
                      .sort((left, right) => left.minute - right.minute)
                      .map((goal) => `<div class="log-item"><strong>${goal.minute}'</strong><p class="muted">${FMG.escapeHtml(goal.scorer)}</p></div>`)
                      .join("") || `<div class="empty-state">No hubo goles en este encuentro.</div>`}
                  </div>
                </article>`
              : `<div class="empty-state">Todavia no se ha disputado el primer partido.</div>`
          }
        </section>
        <section class="card">
          <div class="section-title"><h2>Proxima fecha</h2></div>
          <div style="display:grid; gap:12px;">
            ${
              upcomingMatches && upcomingMatches.length
                ? upcomingMatches.map((match) => `
                    <article class="list-row compact">
                      <div><strong>${FMG.clubBadge(match.homeTeam, "sm")} ${FMG.escapeHtml(match.homeTeam.name)}</strong><p class="muted">vs ${FMG.clubBadge(match.awayTeam, "sm")} ${FMG.escapeHtml(match.awayTeam.name)}</p></div>
                      <span class="chip">${match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId ? "Tu partido" : "Liga"}</span>
                    </article>`).join("")
                : `<div class="empty-state">Calendario completado.</div>`
            }
          </div>
        </section>
        <section class="card">
          ${renderTacticalPreview(state, upcomingMatches)}
        </section>
      </section>
      ${
        currentMatch && currentMatch.timeline
          ? `<section class="card">
              <div class="section-title"><h2>Relato del partido</h2><span class="chip">${currentMatch.timeline.length} eventos</span></div>
              <div class="log-list">
                ${currentMatch.timeline.slice(-14).map((event) => `
                  <div class="log-item">
                    <strong>${event.minute}' | ${FMG.escapeHtml(EVENT_LABELS[event.type] || event.type)}</strong>
                    <p class="muted">${FMG.escapeHtml(event.text)}</p>
                  </div>`).join("")}
              </div>
            </section>`
          : ""
      }
    `;
  };
})();
