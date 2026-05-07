(function () {
  const FMG = (window.FMG = window.FMG || {});

  const filters = [
    ["all", "Todo"],
    ["preview", "Previas"],
    ["chronicle", "Cronicas"],
    ["rumor", "Rumores"],
    ["fans", "Hinchas"],
    ["player-story", "Jugadores"],
    ["classic", "Clasicos"],
    ["dressing-room", "Vestuario"],
    ["streak", "Rachas"]
  ];

  function renderNewsCard(item) {
    return `
      <article class="log-item">
        <div class="section-title" style="margin-bottom:8px;">
          <strong>${FMG.escapeHtml(item.title)}</strong>
          <span class="chip">${FMG.escapeHtml(item.type)}</span>
        </div>
        <p class="muted">Temporada ${item.seasonNumber} | Semana ${item.week} | Importancia ${item.importance}/100</p>
        <p style="margin-top:10px;">${FMG.escapeHtml(item.body)}</p>
        ${item.tags && item.tags.length ? `<div class="meta">${item.tags.map((tag) => `<span>${FMG.escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      </article>`;
  }

  function renderQuestion(question) {
    return `
      <div class="log-item">
        <strong>${FMG.escapeHtml(question.question)}</strong>
        <p class="muted">Contexto: ${FMG.escapeHtml(question.context)} | T${question.seasonNumber} semana ${question.week}</p>
      </div>`;
  }

  FMG.renderNewsView = function (state) {
    FMG.ensureWorldNews(state);
    const selected = state.worldNews.filter || "all";
    const news = selected === "all"
      ? state.worldNews.items
      : state.worldNews.items.filter((item) => item.type === selected || (item.tags || []).includes(selected));
    const top = state.worldNews.items[0] || null;
    const pendingQuestions = state.worldNews.pressQuestions.filter((question) => question.status === "open");

    return `
      <section class="hero">
        <div class="panel hero-main">
          <span class="eyebrow">Centro de noticias</span>
          <h1 class="hero-title">Mundo vivo</h1>
          <p class="hero-copy">${top ? FMG.escapeHtml(top.title) : "La temporada aun no tiene titulares publicados."}</p>
          <div class="chips">
            <span class="chip">${state.worldNews.items.length} noticias</span>
            <span class="chip">${pendingQuestions.length} preguntas de prensa</span>
            <span class="chip">${state.worldNews.rivalries.length} rivalidades</span>
          </div>
          <div class="hero-actions">
            <button class="btn-primary" data-action="generate-world-news">Actualizar mundo</button>
            <button class="btn-secondary" data-action="generate-market-rumors">Rumores de mercado</button>
          </div>
        </div>
        <div class="side-stack">
          <section class="panel">
            <div class="section-title"><h2>Filtros</h2></div>
            <div class="button-row">
              ${filters.map(([filter, label]) => `<button class="${selected === filter ? "active" : "btn-ghost"}" data-action="set-news-filter" data-filter="${filter}">${label}</button>`).join("")}
            </div>
          </section>
          <section class="panel">
            <div class="section-title"><h2>Rivalidades</h2></div>
            <div class="log-list">
              ${state.worldNews.rivalries.map((rivalry) => `
                <div class="log-item">
                  <strong>${FMG.escapeHtml(rivalry.name)}</strong>
                  <p class="muted">${rivalry.intensity}/100 de intensidad</p>
                </div>`).join("")}
            </div>
          </section>
        </div>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Titulares</h2><span class="chip">${FMG.escapeHtml(selected)}</span></div>
          <div class="log-list">
            ${news.length ? news.map(renderNewsCard).join("") : `<div class="empty-state">No hay noticias para este filtro.</div>`}
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Preguntas de prensa</h2></div>
          <div class="log-list">
            ${pendingQuestions.length ? pendingQuestions.map(renderQuestion).join("") : `<div class="empty-state">La prensa no tiene preguntas pendientes.</div>`}
          </div>
        </section>
      </section>
    `;
  };
})();
