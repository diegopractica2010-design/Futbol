(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.renderMarketView = function (state) {
    const listings = state.market.listings
      .map((listing) => ({ listing, player: state.players.find((item) => item.id === listing.playerId) }))
      .filter((entry) => entry.player);

    return `
      <section class="card">
        <div class="section-title">
          <h2>Mercado de fichajes</h2>
          <div class="button-row"><button class="btn-secondary" data-action="refresh-market" ${state.market.windowOpen ? "" : "disabled"}>Actualizar scouting</button></div>
        </div>
        <p class="muted">Saldo disponible: ${FMG.currency(state.finances.balance)} | ${state.market.windowOpen ? "Ventana abierta" : "Ventana cerrada"}</p>
        <div class="list" style="margin-top:18px;">
          ${
            listings.length
              ? listings.map(({ listing, player }) => `
                  <article class="list-row">
                    <div>
                      <strong>${FMG.escapeHtml(player.name)}</strong>
                      <div class="meta">
                        <span>${FMG.escapeHtml(player.position)}</span><span>OVR ${player.overall}</span><span>${player.age} anos</span><span>${FMG.escapeHtml(listing.sellerTeamName)}</span>
                      </div>
                    </div>
                    <div><div class="muted">Precio</div><strong>${FMG.currency(listing.askingPrice)}</strong></div>
                    <div><button class="btn-primary" data-action="buy-player" data-player-id="${player.id}" ${state.market.windowOpen ? "" : "disabled"}>Comprar</button></div>
                  </article>`).join("")
              : `<div class="empty-state">No hay jugadores publicados por ahora.</div>`
          }
        </div>
      </section>
    `;
  };
})();
