(function () {
  const FMG = (window.FMG = window.FMG || {});

  function renderListings(state) {
    const listings = state.market.listings
      .map((listing) => ({ listing, player: state.players.find((item) => item.id === listing.playerId) }))
      .filter((entry) => entry.player);

    return listings.length
      ? listings.map(({ listing, player }) => {
          const value = FMG.calculatePlayerValue(player);
          const wage = FMG.estimatePlayerWageDemand(player, player.overall >= 76 ? "starter" : "rotation");
          return `
            <article class="list-row">
              <div>
                <strong>${FMG.escapeHtml(player.name)}</strong>
                <div class="meta">
                  <span>${FMG.escapeHtml(player.position)}</span><span>OVR ${player.overall}</span><span>POT ${player.potential}</span><span>${player.age} anos</span><span>${FMG.escapeHtml(listing.sellerTeamName)}</span><span>Scout ${listing.scoutingLevel}%</span>
                </div>
              </div>
              <div><div class="muted">Valor / salario</div><strong>${FMG.currency(value)}</strong><p class="muted">${FMG.currency(wage)}</p></div>
              <div class="button-row">
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
              ${offer.status === "pending" ? `<div class="button-row" style="margin-top:10px;"><button class="btn-primary" data-action="accept-incoming-offer" data-offer-id="${offer.id}">Aceptar</button><button class="btn-ghost" data-action="reject-incoming-offer" data-offer-id="${offer.id}">Rechazar</button></div>` : ""}
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
      <section class="card">
        <div class="section-title">
          <h2>Mercado de fichajes</h2>
          <div class="button-row">
            <button class="btn-secondary" data-action="refresh-market" ${state.market.windowOpen ? "" : "disabled"}>Actualizar scouting</button>
            <button class="btn-ghost" data-action="generate-incoming-offers" ${state.market.windowOpen ? "" : "disabled"}>Buscar ofertas</button>
          </div>
        </div>
        <p class="muted">Saldo disponible: ${FMG.currency(state.finances.balance)} | ${state.market.windowOpen ? "Ventana abierta" : "Ventana cerrada"}</p>
        <div class="list" style="margin-top:18px;">${renderListings(state)}</div>
      </section>
      <section class="content-grid">
        <section class="card"><div class="section-title"><h2>Negociaciones</h2></div><div class="log-list">${renderNegotiations(state)}</div></section>
        <section class="card"><div class="section-title"><h2>Ofertas recibidas</h2></div><div class="log-list">${renderIncomingOffers(state)}</div></section>
      </section>
      <section class="card"><div class="section-title"><h2>Historial de mercado</h2></div><div class="log-list">${renderHistory(state)}</div></section>
    `;
  };
})();
