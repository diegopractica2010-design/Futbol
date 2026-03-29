import { currency } from "../src/utils.js";

export function renderMarketView(state) {
  const listings = state.market.listings.map((listing) => ({ listing, player: state.players.find((item) => item.id === listing.playerId) })).filter((entry) => entry.player);
  return `
    <section class="card">
      <div class="section-title">
        <h2>Mercado de fichajes</h2>
        <div class="button-row"><button class="btn-secondary" data-action="refresh-market">Actualizar scouting</button></div>
      </div>
      <p class="muted">Saldo disponible: ${currency(state.finances.balance)}</p>
      <div class="list" style="margin-top:18px;">
        ${
          listings.length
            ? listings.map(({ listing, player }) => `
                <article class="list-row">
                  <div>
                    <strong>${player.name}</strong>
                    <div class="meta">
                      <span>${player.position}</span><span>OVR ${player.overall}</span><span>${player.age} anos</span><span>${listing.sellerTeamName}</span>
                    </div>
                  </div>
                  <div><div class="muted">Precio</div><strong>${currency(listing.askingPrice)}</strong></div>
                  <div><button class="btn-primary" data-action="buy-player" data-player-id="${player.id}">Comprar</button></div>
                </article>`).join("")
            : `<div class="empty-state">No hay jugadores publicados por ahora.</div>`
        }
      </div>
    </section>
  `;
}
