(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderLegacyView = function (state) {
    const legacy = FMG.LegacyEngine ? FMG.LegacyEngine.getManagerLegacy(state) : null;
    const timeline = FMG.LegacyEngine ? FMG.LegacyEngine.getClubTimeline(state, state.userTeamId) : [];
    const career = state.career || {};
    const profile = state.managerProfile || {};
    const typeIcon = { "dynasty": "👑", "fallen-giant": "📉", "recovery": "📈", "title": "🏆", "legendary-moment": "⭐", "hof-induction": "🎖️" };
    const legacyColors = {
      "Pasajero": "#888",
      "Recordado": "#5a8fc4",
      "Leyenda local": "#4caf50",
      "Idolo eterno": "#ff9800",
      "Monumento vivo": "#f44336"
    };

    return `
      <section class="screen-rhythm">
        <section class="card football-priority">
          <div class="section-title">
            <div><span class="eyebrow">Tu huella en el fútbol</span><h2>Legado</h2></div>
            <button class="btn-ghost" data-action="change-route" data-route="${FMG.ROUTES.hallOfFame}">Salón de la Fama</button>
          </div>
        </section>

        ${legacy ? `<section class="card">
          <div class="section-title">
            <h2>${FMG.escapeHtml(profile.name || "Manager")}</h2>
            <span class="chip" style="background:${FMG.escapeHtml(legacyColors[legacy.legacyLabel] || "#888")};color:#fff">${FMG.escapeHtml(legacy.legacyLabel)}</span>
          </div>
          <div class="stats-grid">
            <article class="stat-card">
              <div class="muted">Puntuación de legado</div>
              <div class="stat-value">${legacy.legacyScore}/100</div>
              <div class="progress"><span style="width:${legacy.legacyScore}%"></span></div>
            </article>
            <article class="stat-card"><div class="muted">Títulos totales</div><div class="stat-value">${legacy.totalTitles}</div></article>
            <article class="stat-card"><div class="muted">Temporadas dirigidas</div><div class="stat-value">${legacy.seasonsManaged}</div></article>
            <article class="stat-card"><div class="muted">Clubes dirigidos</div><div class="stat-value">${legacy.clubsManaged}</div></article>
            <article class="stat-card"><div class="muted">Momentos legendarios</div><div class="stat-value">${legacy.legendaryMomentsInvolved}</div></article>
            <article class="stat-card"><div class="muted">Figuras formadas (HoF)</div><div class="stat-value">${legacy.hallOfFamePlayersNurtured}</div></article>
          </div>
          <p class="muted" style="padding:0.5rem 1rem;font-style:italic">La fórmula del legado: cada título ×12, temporada ×3, club ×2, momento épico ×8, figura HoF ×15.</p>
        </section>` : `<section class="card"><div class="empty-state">Completa temporadas para construir tu legado.</div></section>`}

        ${timeline.length ? `<section class="card">
          <div class="section-title"><h2>Línea de tiempo del club</h2><span class="chip">${timeline.length} eventos</span></div>
          <div class="log-list">
            ${timeline.map(function (entry) { return `
              <div class="log-item">
                <strong>${typeIcon[entry.type] || "📋"} T${entry.season} — ${FMG.escapeHtml(entry.description)}</strong>
              </div>`;}).join("")}
          </div>
        </section>` : ""}

        ${career.trophies && career.trophies.length ? `<details class="ux-disclosure">
          <summary>Vitrina de trofeos</summary>
          <div class="log-list">
            ${career.trophies.map(function (t) { return `
              <div class="log-item">
                <strong>🏆 ${FMG.escapeHtml(t.title)}</strong>
                <p class="muted">${FMG.escapeHtml(t.teamName)} | T${t.seasonNumber}</p>
              </div>`;}).join("")}
          </div>
        </details>` : ""}
      </section>
    `;
  };
})();
