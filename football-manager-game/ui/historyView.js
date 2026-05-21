(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderHistoryView = function (state) {
    const moments = (state.legendaryMoments || []).slice(0, 20);
    const wh = state.worldHistory || {};
    const docs = FMG.LegacyEngine ? FMG.LegacyEngine.getDocumentaries(state) : [];
    const dynastyClubs = Object.keys(wh.dynasties || {}).filter(function (id) {
      return wh.dynasties[id] && wh.dynasties[id].isDynasty;
    });
    const fallenClubs = Object.keys(wh.fallenGiants || {}).filter(function (id) {
      return wh.fallenGiants[id] && wh.fallenGiants[id].status === "fallen";
    });
    const momentTypeLabel = { last_minute_winner: "Gol agónico", hat_trick: "Hat-trick", massive_comeback: "Remontada épica", derby_decider: "Decisor de clásico" };

    return `
      <section class="screen-rhythm">
        <section class="card football-priority">
          <div class="section-title">
            <div><span class="eyebrow">Memoria del fútbol</span><h2>Historia</h2></div>
            <button class="btn-ghost" data-action="change-route" data-route="${FMG.ROUTES.hallOfFame}">Salón de la Fama</button>
          </div>
          <p class="muted" style="padding:0 1rem 1rem">Momentos legendarios, eras tácticas y ciclos que han marcado el fútbol chileno.</p>
        </section>

        <section class="content-grid">
          <section class="card">
            <div class="section-title"><h2>Momentos legendarios</h2><span class="chip">${moments.length}</span></div>
            <div class="log-list">
              ${moments.length ? moments.map(function (m) { return `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(momentTypeLabel[m.type] || m.type)} — T${m.seasonNumber} S${m.week}</strong>
                  <p class="muted">${FMG.escapeHtml(m.description)}</p>
                </div>`;}).join("") : `<div class="empty-state">Los momentos legendarios se registran cuando ocurren grandes gestas.</div>`}
            </div>
          </section>
          <section class="card">
            <div class="section-title"><h2>Mundo del fútbol</h2></div>
            <div class="log-list">
              ${dynastyClubs.length ? dynastyClubs.map(function (id) {
                const d = wh.dynasties[id];
                const t = (state.teams || []).find(function (x) { return x.id === id; });
                return `<div class="log-item"><strong>👑 Dinastía: ${FMG.escapeHtml(t ? t.name : id)}</strong><p class="muted">${d.consecutiveTitles} títulos consecutivos desde T${d.lastTitleSeason - d.consecutiveTitles + 1}</p></div>`;
              }).join("") : ""}
              ${fallenClubs.length ? fallenClubs.map(function (id) {
                const f = wh.fallenGiants[id];
                const t = (state.teams || []).find(function (x) { return x.id === id; });
                return `<div class="log-item"><strong>📉 Caída: ${FMG.escapeHtml(t ? t.name : id)}</strong><p class="muted">Desde T${f.fallenSeason}. ${f.badSeasons} malas temporadas.</p></div>`;
              }).join("") : ""}
              ${(wh.tacticalEras && wh.tacticalEras.currentEra) ? `<div class="log-item"><strong>⚽ Era táctica actual: ${FMG.escapeHtml(wh.tacticalEras.currentEra)}</strong><p class="muted">Desde T${wh.tacticalEras.eraStartSeason || 1}</p></div>` : ""}
              ${!dynastyClubs.length && !fallenClubs.length && !(wh.tacticalEras && wh.tacticalEras.currentEra) ? `<div class="empty-state">El mundo del fútbol toma forma con cada temporada.</div>` : ""}
            </div>
          </section>
        </section>

        ${docs.length ? `<details class="ux-disclosure">
          <summary>Archivo de temporadas</summary>
          <div class="log-list">
            ${docs.map(function (doc) { return `
              <div class="log-item">
                <strong>T${doc.season} — ${FMG.escapeHtml(doc.clubName)}</strong>
                ${(doc.paragraphs || []).map(function (p) { return `<p class="muted">${FMG.escapeHtml(p)}</p>`;}).join("")}
              </div>`;}).join("")}
          </div>
        </details>` : ""}
      </section>
    `;
  };
})();
