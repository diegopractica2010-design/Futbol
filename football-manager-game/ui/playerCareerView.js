(function () {
  const FMG = (window.FMG = window.FMG || {});

  function reputationBar(label, value) {
    return `<article class="stat-card">
      <div class="muted">${FMG.escapeHtml(label)}</div>
      <div class="progress" style="margin:4px 0"><span style="width:${FMG.clamp ? FMG.clamp(value, 0, 100) : value}%"></span></div>
      <div class="stat-value">${Math.round(value)}</div>
    </article>`;
  }

  function psychBar(label, value, warnHigh, warnLow) {
    const warn = (warnHigh && value >= warnHigh) ? "⚠️ " : (warnLow && value <= warnLow) ? "⬇️ " : "";
    return `<article class="stat-card">
      <div class="muted">${warn}${FMG.escapeHtml(label)}</div>
      <div class="progress" style="margin:4px 0"><span style="width:${Math.round(value)}%"></span></div>
      <div class="stat-value">${Math.round(value)}</div>
    </article>`;
  }

  function renderDecisions(pc) {
    const pending = (pc.decisions || []).filter(function (d) { return d.status === "pending"; });
    if (!pending.length) return `<div class="empty-state">No hay decisiones activas. Surgiran con la evolucion de tu carrera.</div>`;
    return pending.map(function (d) { return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(d.title)}</strong>
        <p class="muted">${FMG.escapeHtml(d.detail)}</p>
        <div class="button-row" style="margin-top:0.5rem">
          ${(d.choices || []).map(function (c) { return `
            <button class="btn-ghost"
              data-action="resolve-career-decision"
              data-decision-id="${FMG.escapeHtml(d.id)}"
              data-choice-id="${FMG.escapeHtml(c.id)}">
              ${FMG.escapeHtml(c.label)}
            </button>`;}).join("")}
        </div>
      </div>`;}).join("");
  }

  function renderEngagementHooks(fu) {
    const hooks = ((fu && fu.engagementHooks) || []).filter(function (h) { return !h.resolved; }).slice(0, 3);
    if (!hooks.length) return `<div class="empty-state">Sin eventos activos esta semana.</div>`;
    return hooks.map(function (h) { return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(h.text)}</strong>
        <div class="button-row" style="margin-top:0.5rem">
          <button class="btn-primary" data-action="react-to-hook" data-hook-id="${FMG.escapeHtml(h.id)}" data-choice="focus">Concentrarse</button>
          <button class="btn-ghost" data-action="react-to-hook" data-hook-id="${FMG.escapeHtml(h.id)}" data-choice="rest">Recuperarse</button>
          <button class="btn-ghost" data-action="react-to-hook" data-hook-id="${FMG.escapeHtml(h.id)}" data-choice="press">Declaraciones</button>
          <button class="btn-ghost" data-action="react-to-hook" data-hook-id="${FMG.escapeHtml(h.id)}" data-choice="ignore">Ignorar</button>
        </div>
      </div>`;}).join("");
  }

  function renderDressingEvents(state) {
    const events = (state.dressingRoomEvents || []).filter(function (e) { return !e.resolved && (e.choices || []).length > 0; }).slice(0, 3);
    if (!events.length) return `<div class="empty-state">El vestuario esta tranquilo.</div>`;
    return events.map(function (e) { return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(e.icon || "")} ${FMG.escapeHtml(e.title)}</strong>
        <p class="muted">${FMG.escapeHtml(e.description)}</p>
        <div class="button-row" style="margin-top:0.5rem">
          ${(e.choices || []).map(function (c) { return `
            <button class="btn-ghost"
              data-action="resolve-dressing-event"
              data-event-id="${FMG.escapeHtml(e.id)}"
              data-choice-label="${FMG.escapeHtml(c.label)}">
              ${FMG.escapeHtml(c.label)}
            </button>`;}).join("")}
        </div>
      </div>`;}).join("");
  }

  function renderLegacyMoments(pc) {
    const moments = (pc.legacy && pc.legacy.legendaryMoments) || [];
    if (!moments.length) return `<div class="empty-state">Los momentos legendarios se construyen con el tiempo.</div>`;
    const typeLabel = { comeback: "Remontada", thriller: "Thrilller", "derby_classic": "Clasico", last_minute_winner: "Gol agónico", hat_trick: "Hat-trick", massive_comeback: "Remontada epica" };
    return moments.slice(0, 8).map(function (m) { return `
      <div class="log-item">
        <strong>⭐ ${FMG.escapeHtml(typeLabel[m.type] || m.type)}</strong>
        <p class="muted">T${m.season} | Semana ${m.week}</p>
      </div>`;}).join("");
  }

  function renderRetirement(pc) {
    const rs = pc.legacy && pc.legacy.retirementSummary;
    if (!rs) return `<div class="empty-state">El resumen de retiro se genera al final de la carrera.</div>`;
    return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(rs.status)}</strong>
        <p class="muted">${FMG.escapeHtml(rs.narrative)}</p>
        <p class="muted">Titulos: ${rs.trophiesTotal} | Legado: ${rs.legendScore}/100 | Hall of Fame: ${rs.hallOfFame ? "Si" : "No"}</p>
        ${rs.records.length ? `<div class="chips">${rs.records.map(function (r) { return `<span class="chip">${FMG.escapeHtml(r)}</span>`; }).join("")}</div>` : ""}
      </div>`;
  }

  FMG.renderPlayerCareerView = function (state) {
    const pc = FMG.ensurePlayerCareer ? FMG.ensurePlayerCareer(state) : (state.playerCareer || {});
    const fu = state.footballUniverse || {};
    const rep = pc.reputation || {};
    const psych = pc.psychology || {};
    const legacy = pc.legacy || {};
    const career = pc.career || {};
    const managerName = (state.managerProfile && state.managerProfile.name) || "Manager";

    return `
      <section class="screen-rhythm">
        <section class="card football-priority">
          <div class="section-title">
            <div>
              <span class="eyebrow">Carrera del técnico</span>
              <h2>${FMG.escapeHtml(managerName)}</h2>
            </div>
            <div class="chips">
              <span class="chip" title="Legado actual">${FMG.escapeHtml(state.legacy && state.legacy.managerLegacy ? state.legacy.managerLegacy.legacyLabel : "Construyendo")}</span>
              <span class="chip">T${state.seasonNumber || 1}</span>
              ${career.trophies && career.trophies.length ? `<span class="chip">🏆 ${career.trophies.length} titulos</span>` : ""}
            </div>
          </div>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Reputacion</h2></div>
            <div class="stats-grid">
              ${reputationBar("Local", rep.local || 0)}
              ${reputationBar("Liga nacional", rep.league || 0)}
              ${reputationBar("Imagen publica", rep.mediaImage || 0)}
              ${reputationBar("Popularidad fans", rep.fanPop || 0)}
              ${reputationBar("Mundial", rep.world || 0)}
            </div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Estado psicologico</h2></div>
            <div class="stats-grid">
              ${psychBar("Confianza", psych.confidence || 55, null, 35)}
              ${psychBar("Moral", psych.morale || 60, null, 40)}
              ${psychBar("Ambicion", psych.ambition || 70)}
              ${psychBar("Presion", psych.pressure || 30, 70)}
              ${psychBar("Burnout", psych.burnout || 20, 80)}
              ${psychBar("Disciplina", psych.discipline || 65, null, 40)}
            </div>
          </section>
        </section>

        <details class="ux-disclosure">
          <summary>Estilo de vida del tecnico</summary>
          <section class="card">
            <div class="section-title"><h2>Lifestyle</h2><span class="chip">Ajusta tu rutina semanal</span></div>
            <div class="stats-grid">
              ${(FMG.getLifestyleOptions ? FMG.getLifestyleOptions() : []).map(function (opt) {
                const val = (pc.lifestyle && pc.lifestyle[opt.key]) || 50;
                return `<article class="stat-card">
                  <div class="muted">${FMG.escapeHtml(opt.icon + " " + opt.label)}</div>
                  <div class="progress" style="margin:4px 0"><span style="width:${val}%"></span></div>
                  <div class="stat-value">${Math.round(val)}/100</div>
                  <p class="muted" style="font-size:11px;margin-top:4px">${FMG.escapeHtml(opt.desc)}</p>
                  <div class="button-row" style="margin-top:6px">
                    <button class="btn-ghost" data-action="set-lifestyle" data-key="${FMG.escapeHtml(opt.key)}" data-delta="-10">-10</button>
                    <button class="btn-ghost" data-action="set-lifestyle" data-key="${FMG.escapeHtml(opt.key)}" data-delta="-5">-5</button>
                    <button class="btn-ghost" data-action="set-lifestyle" data-key="${FMG.escapeHtml(opt.key)}" data-delta="5">+5</button>
                    <button class="btn-ghost" data-action="set-lifestyle" data-key="${FMG.escapeHtml(opt.key)}" data-delta="10">+10</button>
                  </div>
                </article>`;
              }).join("")}
            </div>
          </section>
        </details>

        <details class="ux-disclosure">
          <summary>Trayectoria de clubes</summary>
          <section class="card">
            <div class="section-title"><h2>Historial de clubes</h2><span class="chip">${(pc.career && pc.career.clubs || []).length} club(es)</span></div>
            <div class="log-list">
              ${(pc.career && pc.career.clubs || []).length ? (pc.career.clubs || []).map(function (c) { return `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(c.name)}</strong>
                  <p class="muted">Desde T${c.from}${c.to ? " hasta T" + c.to : " (actual)"} | Titulos: ${c.trophies || 0}</p>
                </div>`;}).join("") : `<div class="empty-state">El historial de clubes se construye con el tiempo.</div>`}
            </div>
          </section>
        </details>

        <details class="ux-disclosure" open>
          <summary>Decisiones activas y gestion de plantilla</summary>
          <section class="content-grid">
            <section class="card">
              <div class="section-title"><h2>Decisiones de carrera</h2><span class="chip">${(pc.decisions || []).filter(function (d) { return d.status === "pending"; }).length} pendientes</span></div>
              <div class="log-list">${renderDecisions(pc)}</div>
            </section>
            <section class="card">
              <div class="section-title"><h2>Eventos del vestuario</h2></div>
              <div class="log-list">${renderDressingEvents(state)}</div>
            </section>
          </section>
        </details>

        <details class="ux-disclosure" open>
          <summary>Pulso de la semana — reacciona ahora</summary>
          <section class="card">
            <div class="section-title"><h2>Tension y anticipacion</h2><span class="chip">${((fu.engagementHooks || []).filter(function (h) { return !h.resolved; })).length} activos</span></div>
            <div class="log-list">${renderEngagementHooks(fu)}</div>
          </section>
        </details>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Momentos legendarios</h2><span class="chip">${((pc.legacy && pc.legacy.legendaryMoments) || []).length}/15</span></div>
            <div class="log-list">${renderLegacyMoments(pc)}</div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Legado final</h2><span class="chip">Score ${legacy.legendScore || 0}/100</span></div>
            <div class="log-list">${renderRetirement(pc)}</div>
            <div style="padding:0.75rem 1rem">
              <button class="btn-secondary" data-action="generate-retirement">Ver resumen de carrera</button>
            </div>
          </section>
        </section>
      </section>
    `;
  };
})();
