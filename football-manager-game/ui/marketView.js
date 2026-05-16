(function () {
  const FMG = (window.FMG = window.FMG || {});

  function playerValueBand(player) {
    if (player.overall >= 78) return { label: "Titular elite", className: "success" };
    if (player.overall >= 72) return { label: "Primer equipo", className: "warning" };
    return { label: "Rotacion", className: "neutral" };
  }

  function renderMarketKpis(state) {
    const active = state.market.listings.length;
    const pending = state.market.negotiations.filter((item) => item.status === "pending" || item.status === "countered").length;
    const incoming = state.market.incomingOffers.filter((item) => item.status === "pending").length;
    return `
      <div class="market-kpis">
        <div><span>Saldo</span><strong>${FMG.currency(state.finances.balance)}</strong></div>
        <div><span>Ventana</span><strong>${state.market.windowOpen ? "Abierta" : "Cerrada"}</strong></div>
        <div><span>En vitrina</span><strong>${active}</strong></div>
        <div><span>Operaciones</span><strong>${pending + incoming}</strong></div>
      </div>
    `;
  }

  function renderListings(state) {
    const listings = state.market.listings
      .map((listing) => ({ listing, player: state.players.find((item) => item.id === listing.playerId) }))
      .filter((entry) => entry.player);

    return listings.length
      ? listings.map(({ listing, player }) => {
          const value = FMG.calculatePlayerValue(player);
          const wage = FMG.estimatePlayerWageDemand(player, player.overall >= 76 ? "starter" : "rotation");
          const band = playerValueBand(player);
          return `
            <article class="market-player-card">
              <div class="market-player-card__main">
                <div class="market-avatar">${FMG.escapeHtml(player.position)}</div>
                <div>
                  <strong>${FMG.escapeHtml(player.name)}</strong>
                  <p>${FMG.escapeHtml(listing.sellerTeamName)} | ${player.age} anos</p>
                  <div class="market-tags">
                    <span class="chip chip-${band.className}">${band.label}</span>
                    <span>Scout ${listing.scoutingLevel}%</span>
                    <span>${listing.loanAvailable ? "Cesion viable" : "Solo compra"}</span>
                  </div>
                </div>
              </div>
              <div class="market-rating">
                <div><span>OVR</span><strong>${player.overall}</strong></div>
                <div><span>POT</span><strong>${player.potential}</strong></div>
                <div><span>Valor</span><strong>${FMG.currency(value)}</strong></div>
                <div><span>Salario</span><strong>${FMG.currency(wage)}</strong></div>
              </div>
              <div class="button-row market-actions">
                <button class="btn-primary" data-action="create-transfer-offer" data-player-id="${player.id}" data-transfer-type="${listing.askingPrice === 0 ? "free" : "buy"}" ${state.market.windowOpen ? "" : "disabled"}>Ofertar</button>
                <button class="btn-secondary" data-action="create-loan-offer" data-player-id="${player.id}" ${state.market.windowOpen && listing.loanAvailable ? "" : "disabled"}>Cesion</button>
              </div>
            </article>`;
        }).join("")
      : `<div class="empty-state">No hay jugadores publicados por ahora.</div>`;
  }

  function renderNegotiations(state) {
    return state.market.negotiations.length
      ? state.market.negotiations.map((negotiation) => {
          const player = state.players.find((item) => item.id === negotiation.playerId);
          return `
            <div class="log-item">
              <strong>${FMG.escapeHtml(player ? player.name : "Jugador")} | ${FMG.escapeHtml(negotiation.status)}</strong>
              <p class="muted">${FMG.escapeHtml(negotiation.type)} | Prima ${FMG.currency(negotiation.fee)} | Salario ${FMG.currency(negotiation.wage)} | ${negotiation.years}a | ${FMG.escapeHtml(negotiation.message)}</p>
              ${negotiation.status === "pending" || negotiation.status === "countered" ? `<div class="button-row" style="margin-top:10px;"><button class="btn-primary" data-action="resolve-negotiation" data-negotiation-id="${negotiation.id}">Resolver</button></div>` : ""}
            </div>`;
        }).join("")
      : `<div class="empty-state">No hay negociaciones abiertas.</div>`;
  }

  function renderIncomingOffers(state) {
    return state.market.incomingOffers.length
      ? state.market.incomingOffers.map((offer) => {
          const player = state.players.find((item) => item.id === offer.playerId);
          return `
            <div class="log-item">
              <strong>${FMG.escapeHtml(offer.buyerTeamName)} por ${FMG.escapeHtml(player ? player.name : "Jugador")}</strong>
              <p class="muted">${FMG.currency(offer.fee)} | ${FMG.escapeHtml(offer.status)}</p>
              ${offer.status === "pending" ? `<div class="button-row" style="margin-top:10px;"><button class="btn-primary" data-action="accept-incoming-offer" data-offer-id="${offer.id}" data-confirm="Aceptar oferta de ${FMG.escapeHtml(offer.buyerTeamName)}?">Aceptar</button><button class="btn-ghost" data-action="reject-incoming-offer" data-offer-id="${offer.id}">Rechazar</button></div>` : ""}
            </div>`;
        }).join("")
      : `<div class="empty-state">Todavia no llegan ofertas por tu plantilla.</div>`;
  }

  function renderHistory(state) {
    return state.market.transferHistory.length
      ? state.market.transferHistory.map((entry) => `
        <div class="log-item">
          <strong>${FMG.escapeHtml(entry.playerName)}</strong>
          <p class="muted">${FMG.escapeHtml(entry.fromTeamName)} -> ${FMG.escapeHtml(entry.toTeamName)} | ${FMG.escapeHtml(entry.type)} | ${FMG.currency(entry.fee)}</p>
        </div>`).join("")
      : `<div class="empty-state">Sin movimientos cerrados.</div>`;
  }

  FMG.renderMarketView = function (state) {
    state.market.negotiations = state.market.negotiations || [];
    state.market.incomingOffers = state.market.incomingOffers || [];
    state.market.transferHistory = state.market.transferHistory || [];
    return `
      <section class="card market-hero">
        <div class="section-title">
          <div>
            <span class="eyebrow">Direccion deportiva</span>
            <h2>Mercado de fichajes</h2>
          </div>
          <div class="button-row">
            <button class="btn-secondary" data-action="refresh-market" ${state.market.windowOpen ? "" : "disabled"}>Actualizar scouting</button>
            <button class="btn-ghost" data-action="generate-incoming-offers" ${state.market.windowOpen ? "" : "disabled"}>Buscar ofertas</button>
          </div>
        </div>
        ${renderMarketKpis(state)}
        <div class="market-board">${renderListings(state)}</div>
      </section>
      <section class="content-grid">
        <section class="card"><div class="section-title"><h2>Negociaciones</h2></div><div class="log-list">${renderNegotiations(state)}</div></section>
        <section class="card"><div class="section-title"><h2>Ofertas recibidas</h2></div><div class="log-list">${renderIncomingOffers(state)}</div></section>
      </section>
      <section class="card"><div class="section-title"><h2>Historial de mercado</h2></div><div class="log-list">${renderHistory(state)}</div></section>
    `;
  };
})();
