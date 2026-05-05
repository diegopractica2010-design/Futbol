(function () {
  const FMG = (window.FMG = window.FMG || {});

  function createListing(player, teamsById) {
    return {
      listingId: FMG.uid("listing"),
      playerId: player.id,
      askingPrice: FMG.clamp(player.value + FMG.randomInt(-2000000, 3500000), 3000000, 999999999),
      sellerTeamId: player.teamId,
      sellerTeamName: teamsById[player.teamId] ? teamsById[player.teamId].name : "Libre"
    };
  }

  FMG.buildTransferMarket = function (state) {
    const teamsById = Object.fromEntries(state.teams.map((team) => [team.id, team]));
    const externalPlayers = state.players.filter((player) => player.teamId !== state.userClub.id);
    const marketable = externalPlayers
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 16)
      .filter(() => Math.random() > 0.28);
    state.market.listings = marketable.map((player) => createListing(player, teamsById));
  };

  FMG.refreshTransferMarket = function (state) {
    if (!state.market.windowOpen) {
      return { ok: false, message: "El mercado esta cerrado esta semana." };
    }
    if (state.finances.balance < state.market.refreshCost) {
      return { ok: false, message: "No hay saldo suficiente para actualizar el scouting." };
    }
    FMG.registerFinanceEntry(state.finances, "expense", "Informe extra de scouting", -state.market.refreshCost);
    FMG.buildTransferMarket(state);
    return { ok: true, message: "El area de scouting publico una nueva tanda de jugadores." };
  };

  FMG.buyPlayer = function (state, playerId) {
    if (!state.market.windowOpen) {
      return { ok: false, message: "Solo puedes comprar durante la ventana de fichajes." };
    }
    const listing = state.market.listings.find((item) => item.playerId === playerId);
    if (!listing) return { ok: false, message: "La oferta ya no esta disponible." };
    if (state.finances.balance < listing.askingPrice) {
      return { ok: false, message: "No hay presupuesto suficiente para cerrar la compra." };
    }

    const player = state.players.find((item) => item.id === playerId);
    if (!player) return { ok: false, message: "No se encontro el jugador solicitado." };
    const sellerTeam = state.teams.find((team) => team.id === listing.sellerTeamId);
    player.teamId = state.userClub.id;
    player.contractYears = 3;
    player.injuredWeeks = 0;
    player.suspendedWeeks = 0;
    player.energy = FMG.clamp(player.energy + 5, 0, 100);
    player.morale = FMG.clamp(player.morale + 8, 0, 100);

    FMG.registerFinanceEntry(state.finances, "expense", `Compra de ${player.name}`, -listing.askingPrice);
    if (sellerTeam) sellerTeam.form = FMG.clamp(sellerTeam.form - 1, 0, 20);

    state.market.listings = state.market.listings.filter((item) => item.playerId !== playerId);
    FMG.autoSelectLineup(state, state.userClub.id);
    return { ok: true, message: `${player.name} llega al club por ${listing.askingPrice.toLocaleString("es-CL")} CLP.` };
  };

  FMG.sellPlayer = function (state, playerId) {
    if (!state.market.windowOpen) {
      return { ok: false, message: "Solo puedes vender durante la ventana de fichajes." };
    }
    const player = state.players.find((item) => item.id === playerId);
    if (!player || player.teamId !== state.userClub.id) {
      return { ok: false, message: "Ese jugador no pertenece a tu plantilla." };
    }

    const squadSize = state.players.filter((item) => item.teamId === state.userClub.id).length;
    if (squadSize <= 15) {
      return { ok: false, message: "Necesitas mantener al menos 15 jugadores en la plantilla." };
    }

    const buyer = FMG.sample(state.teams.filter((team) => team.id !== state.userClub.id));
    const price = FMG.clamp(player.value + FMG.randomInt(-1000000, 2500000), 2500000, 999999999);
    player.teamId = buyer.id;
    player.contractYears = 2;
    player.morale = FMG.clamp(player.morale - 4, 0, 100);
    FMG.registerFinanceEntry(state.finances, "income", `Venta de ${player.name}`, price);
    FMG.autoSelectLineup(state, state.userClub.id);
    FMG.autoSelectLineup(state, buyer.id);
    FMG.buildTransferMarket(state);
    return { ok: true, message: `${player.name} fue transferido a ${buyer.name} por ${price.toLocaleString("es-CL")} CLP.` };
  };
})();
