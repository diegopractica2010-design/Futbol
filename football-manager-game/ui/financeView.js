(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderEntries(entries) {
    return entries.length
      ? entries.slice(0, 10).map((entry) => `<div class="log-item"><strong>${FMG.escapeHtml(entry.label)}</strong><p class="muted">${FMG.currency(entry.amount)}${entry.budgetKey ? ` | ${FMG.escapeHtml(entry.budgetKey)}` : ""}</p></div>`).join("")
      : `<div class="empty-state">Todavia no hay movimientos registrados.</div>`;
  }

  function renderLevelControls(title, levels, action, areas) {
    return `
      <section class="card">
        <div class="section-title"><h2>${title}</h2></div>
        <div class="stats-grid">
          ${areas.map(([key, label]) => {
            const button = action === "upgrade-infrastructure"
              ? `<button class="btn-primary" data-action="upgrade-infrastructure" data-area="${key}">Mejorar</button>`
              : `<button class="btn-primary" data-action="upgrade-staff" data-area="${key}">Mejorar</button>`;
            return `
              <article class="stat-card">
                <div class="muted">${label}</div>
                <div class="stat-value">${levels[key]}/5</div>
                <div class="button-row" style="margin-top:12px;">${button}</div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  FMG.renderFinanceView = function (state) {
    FMG.ensureAdvancedFinances(state);
    const finances = state.finances;
    const totalIncome = finances.incomeHistory.reduce((sum, entry) => sum + entry.amount, 0);
    const totalExpenses = Math.abs(finances.expenseHistory.reduce((sum, entry) => sum + entry.amount, 0));
    const ffp = FMG.evaluateFinancialFairPlay(state);
    return `
      <section class="screen-rhythm">
      <section class="content-grid">
        <section class="card football-priority">
          <div class="section-title"><h2>Estado economico del club</h2><span class="chip">${FMG.escapeHtml(ffp.status)}</span></div>
          <div class="stats-grid">
            <article class="stat-card"><div class="muted">Saldo actual</div><div class="stat-value">${FMG.currency(finances.balance)}</div></article>
            <article class="stat-card"><div class="muted">Ingresos acumulados</div><div class="stat-value">${FMG.currency(totalIncome)}</div></article>
            <article class="stat-card"><div class="muted">Gastos acumulados</div><div class="stat-value">${FMG.currency(totalExpenses)}</div></article>
            <article class="stat-card"><div class="muted">Directorio</div><div class="stat-value">${finances.boardTrust}/100</div></article>
          </div>
          <div class="log-list" style="margin-top:18px;">${renderEntries(finances.weeklyReport)}</div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Caja para competir</h2><button class="btn-secondary" data-action="take-bank-loan" data-confirm="Solicitar prestamo bancario por 30.000.000 CLP?">Prestamo</button></div>
          <div class="log-list">
            ${Object.entries(finances.budgets).map(([key, value]) => `<div class="log-item"><strong>${FMG.escapeHtml(key)}</strong><p class="muted">${FMG.currency(value)}</p></div>`).join("")}
          </div>
        </section>
      </section>
      <section class="content-grid">
        <section class="card">
          <div class="section-title"><h2>Acuerdos comerciales</h2><button class="btn-primary" data-action="negotiate-sponsor">Negociar auspicio</button></div>
          <div class="log-list">
            <div class="log-item"><strong>${FMG.escapeHtml(finances.sponsorDeal.name)}</strong><p class="muted">Semana ${FMG.currency(finances.sponsorDeal.weeklyAmount)} | Bono victoria ${FMG.currency(finances.sponsorDeal.bonusPerWin)}</p></div>
            <div class="log-item"><strong>${FMG.escapeHtml(finances.tvDeal.name)}</strong><p class="muted">Semana ${FMG.currency(finances.tvDeal.weeklyAmount)} | Bono ${FMG.currency(finances.tvDeal.performanceBonus)}</p></div>
          </div>
        </section>
        <section class="card">
          <div class="section-title"><h2>Deuda y disciplina financiera</h2></div>
          <div class="log-list">
            <div class="log-item"><strong>Deuda total</strong><p class="muted">${FMG.currency(finances.debt)}</p></div>
            <div class="log-item"><strong>Limite salarial</strong><p class="muted">${FMG.currency(finances.financialFairPlay.wageLimit)}</p></div>
            ${finances.financialFairPlay.warnings.length ? finances.financialFairPlay.warnings.map((warning) => `<div class="log-item"><strong>Advertencia</strong><p class="muted">${FMG.escapeHtml(warning)}</p></div>`).join("") : `<div class="empty-state">Las finanzas del club están estables.</div>`}
            ${finances.crisis ? `<div class="log-item"><strong>Crisis activa</strong><p class="muted">${FMG.escapeHtml(finances.crisis.reason)}</p></div>` : ""}
          </div>
        </section>
      </section>
      <details class="ux-disclosure">
        <summary>Infraestructura, staff y eventos del club</summary>
      <section class="content-grid">
        ${renderLevelControls("Infraestructura", finances.infrastructure, "upgrade-infrastructure", [["stadium", "Estadio"], ["training", "Entrenamiento"], ["medical", "Medicina"]])}
        ${renderLevelControls("Staff", finances.staff, "upgrade-staff", [["coaching", "Cuerpo tecnico"], ["scouting", "Scouting"], ["medical", "Medico"]])}
      </section>
      <section class="card">
        <div class="section-title"><h2>Eventos del club</h2></div>
        <div class="log-list">
          ${
            state.eventsLog.length
              ? state.eventsLog.map((event) => `
                  <div class="log-item">
                    <strong>${FMG.escapeHtml(event.title)}</strong>
                    <p class="muted">Semana ${event.week}</p>
                    <p class="muted">${FMG.escapeHtml(event.detail)}</p>
                  </div>`).join("")
              : `<div class="empty-state">Aun no se registran eventos aleatorios.</div>`
          }
        </div>
      </section>
      </details>
      </section>
    `;
  };
})();
