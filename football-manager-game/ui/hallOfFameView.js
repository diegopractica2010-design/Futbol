(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderHallOfFameView = function (state) {
    const hof = FMG.LegacyEngine ? FMG.LegacyEngine.getHallOfFame(state) : [];
    const records = FMG.LegacyEngine ? FMG.LegacyEngine.getAllTimeRecords(state) : null;
    const reasonLabel = {
      titles: "3+ títulos mismo club",
      goals: "50+ goles en carrera",
      appearances: "150+ apariciones",
      peak: "5+ temporadas OVR >80"
    };

    return `
      <section class="screen-rhythm">
        <section class="card football-priority">
          <div class="section-title">
            <div><span class="eyebrow">Inmortales del fútbol</span><h2>Salón de la Fama</h2></div>
            <button class="btn-ghost" data-action="change-route" data-route="${FMG.ROUTES.history}">Historia</button>
          </div>
          <p class="muted" style="padding:0 1rem 1rem">${hof.length} jugador(es) han alcanzado la inmortalidad en el fútbol chileno.</p>
        </section>

        ${records ? `<section class="card">
          <div class="section-title"><h2>Récords históricos</h2></div>
          <div class="stats-grid">
            ${records.topScorer ? `<article class="stat-card">
              <div class="muted">Máximo goleador histórico</div>
              <div class="stat-value">${FMG.escapeHtml(records.topScorer.name)}</div>
              <div class="muted">${records.topScorer.goals} goles | T${records.topScorer.seasonNumber}</div>
            </article>` : ""}
            ${records.mostAppearances ? `<article class="stat-card">
              <div class="muted">Más apariciones</div>
              <div class="stat-value">${FMG.escapeHtml(records.mostAppearances.name)}</div>
              <div class="muted">${records.mostAppearances.appearances} partidos</div>
            </article>` : ""}
            ${records.highestOverall ? `<article class="stat-card">
              <div class="muted">Mayor overall histórico</div>
              <div class="stat-value">${FMG.escapeHtml(records.highestOverall.name)}</div>
              <div class="muted">OVR ${records.highestOverall.overall} | T${records.highestOverall.season}</div>
            </article>` : ""}
            ${records.mostTitles ? `<article class="stat-card">
              <div class="muted">Más títulos</div>
              <div class="stat-value">${FMG.escapeHtml(records.mostTitles.name)}</div>
              <div class="muted">${records.mostTitles.titles} campeonatos</div>
            </article>` : ""}
          </div>
        </section>` : ""}

        <section class="card">
          <div class="section-title"><h2>Miembros inductos</h2><span class="chip">${hof.length}</span></div>
          <div class="log-list">
            ${hof.length ? hof.map(function (entry) { return `
              <div class="log-item" style="border-left:3px solid ${FMG.escapeHtml(entry.portraitColor || "#888")};padding-left:0.75rem">
                <strong>🎖️ ${FMG.escapeHtml(entry.name)}</strong>
                <p class="muted">${FMG.escapeHtml(entry.clubName)} | T${entry.inductedSeason}</p>
                <p class="muted">${FMG.escapeHtml(reasonLabel[entry.reason] || entry.reason)}</p>
                <p class="muted">${entry.stats ? `${entry.stats.goals} goles | ${entry.stats.appearances} apariciones | ${entry.stats.titles} títulos | OVR pico ${entry.stats.peakOverall}` : ""}</p>
              </div>`;}).join("") : `<div class="empty-state">Completa temporadas para ver inductos al Salón de la Fama. Se requieren 50+ goles, 150+ apariciones, 3+ títulos en el mismo club o 5+ temporadas con OVR >80.</div>`}
          </div>
        </section>
      </section>
    `;
  };
})();
