import { currency } from "../src/utils.js";

function renderEntries(entries) {
  return entries.length
    ? entries.slice(0, 8).map((entry) => `<div class="log-item"><strong>${entry.label}</strong><p class="muted">${currency(entry.amount)}</p></div>`).join("")
    : `<div class="empty-state">Todavia no hay movimientos registrados.</div>`;
}

export function renderFinanceView(state) {
  const totalIncome = state.finances.incomeHistory.reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = Math.abs(state.finances.expenseHistory.reduce((sum, entry) => sum + entry.amount, 0));
  return `
    <section class="content-grid">
      <section class="card">
        <div class="section-title"><h2>Resumen financiero</h2></div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit,minmax(200px,1fr)); gap:12px;">
          <article class="stat-card"><div class="muted">Saldo actual</div><div class="stat-value">${currency(state.finances.balance)}</div></article>
          <article class="stat-card"><div class="muted">Ingresos acumulados</div><div class="stat-value">${currency(totalIncome)}</div></article>
          <article class="stat-card"><div class="muted">Gastos acumulados</div><div class="stat-value">${currency(totalExpenses)}</div></article>
        </div>
        <div class="log-list" style="margin-top:18px;">${renderEntries(state.finances.weeklyReport)}</div>
      </section>
      <section class="card">
        <div class="section-title"><h2>Eventos del club</h2></div>
        <div class="log-list">
          ${
            state.eventsLog.length
              ? state.eventsLog.map((event) => `
                  <div class="log-item">
                    <strong>${event.title}</strong>
                    <p class="muted">Semana ${event.week}</p>
                    <p class="muted">${event.detail}</p>
                  </div>`).join("")
              : `<div class="empty-state">Aun no se registran eventos aleatorios.</div>`
          }
        </div>
      </section>
    </section>
  `;
}
