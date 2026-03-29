import { registerFinanceEntry } from "./finances.js";
import { clamp, randomInt, sample, uid } from "./utils.js";

function createListing(player, teamsById) {
  return {
    listingId: uid("listing"),
    playerId: player.id,
    askingPrice: clamp(player.value + randomInt(-2000000, 3500000), 3000000, 999999999),
    sellerTeamId: player.teamId,
    sellerTeamName: teamsById[player.teamId]?.name || "Libre"
  };
}

export function buildTransferMarket(state) {
  const teamsById = Object.fromEntries(state.teams.map((team) => [team.id, team]));
  const externalPlayers = state.players.filter((player) => player.teamId !== state.userClub.id);
  const marketable = externalPlayers
    .sort((left, right) => right.overall - left.overall)
    .slice(0, 16)
    .filter(() => Math.random() > 0.28);
  state.market.listings = marketable.map((player) => createListing(player, teamsById));
}

export function refreshTransferMarket(state) {
  registerFinanceEntry(state.finances, "expense", "Informe extra de scouting", -state.market.refreshCost);
  buildTransferMarket(state);
}

export function buyPlayer(state, playerId) {
  const listing = state.market.listings.find((item) => item.playerId === playerId);
  if (!listing) return { ok: false, message: "La oferta ya no esta disponible." };
  if (state.finances.balance < listing.askingPrice) {
    return { ok: false, message: "No hay presupuesto suficiente para cerrar la compra." };
  }

  const player = state.players.find((item) => item.id === playerId);
  const sellerTeam = state.teams.find((team) => team.id === listing.sellerTeamId);
  player.teamId = state.userClub.id;
  player.energy = clamp(player.energy + 5, 0, 100);
  player.morale = clamp(player.morale + 8, 0, 100);

  registerFinanceEntry(state.finances, "expense", `Compra de ${player.name}`, -listing.askingPrice);
  if (sellerTeam) sellerTeam.form = clamp(sellerTeam.form - 1, 0, 20);

  state.market.listings = state.market.listings.filter((item) => item.playerId !== playerId);
  return { ok: true, message: `${player.name} llega al club por ${listing.askingPrice.toLocaleString("es-CL")} CLP.` };
}

export function sellPlayer(state, playerId) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player || player.teamId !== state.userClub.id) {
    return { ok: false, message: "Ese jugador no pertenece a tu plantilla." };
  }

  const squadSize = state.players.filter((item) => item.teamId === state.userClub.id).length;
  if (squadSize <= 15) {
    return { ok: false, message: "Necesitas mantener al menos 15 jugadores en la plantilla." };
  }

  const buyer = sample(state.teams.filter((team) => team.id !== state.userClub.id));
  const price = clamp(player.value + randomInt(-1000000, 2500000), 2500000, 999999999);
  player.teamId = buyer.id;
  player.morale = clamp(player.morale - 4, 0, 100);
  registerFinanceEntry(state.finances, "income", `Venta de ${player.name}`, price);
  buildTransferMarket(state);
  return { ok: true, message: `${player.name} fue transferido a ${buyer.name} por ${price.toLocaleString("es-CL")} CLP.` };
}
