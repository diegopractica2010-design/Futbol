(function () {
  const FMG = (window.FMG = window.FMG || {});

  function teamName(state, teamId) {
    return state.teams.find((team) => team.id === teamId)?.name || "Libre";
  }

  function ensureMarketState(state) {
    state.market = state.market || {};
    state.market.listings = state.market.listings || [];
    state.market.negotiations = state.market.negotiations || [];
    state.market.incomingOffers = state.market.incomingOffers || [];
    state.market.transferHistory = state.market.transferHistory || [];
  }

  function isFreeAgent(player) {
    return !player.teamId || player.teamId === "free-agent" || (player.contractYears || 0) <= 0;
  }

  function personalityMultiplier(player) {
    if (player.personality === "Ambicioso") return 1.12;
    if (player.personality === "Leal") return 0.94;
    if (player.personality === "Volatil") return 1.18;
    return 1;
  }

  function createListing(player, state) {
    const value = FMG.calculatePlayerValue(player);
    const freeAgent = isFreeAgent(player);
    return {
      listingId: FMG.uid("listing"),
      playerId: player.id,
      askingPrice: freeAgent ? 0 : FMG.clamp(Math.round(value * (1.02 + FMG.randomInt(0, 18) / 100)), 1000000, 999999999),
      sellerTeamId: freeAgent ? null : player.teamId,
      sellerTeamName: freeAgent ? "Libre" : teamName(state, player.teamId),
      loanAvailable: !freeAgent && player.age <= 24 && player.overall < 72,
      scoutingLevel: FMG.clamp(45 + FMG.randomInt(0, 45), 35, 95)
    };
  }

  FMG.calculatePlayerValue = function (player) {
    if (player.retired) return 0;
    const ageCurve = player.age <= 23 ? 1.28 : player.age <= 28 ? 1.12 : player.age <= 31 ? 0.94 : 0.72;
    const potentialBoost = 1 + Math.max(0, (player.potential || player.overall) - player.overall) * 0.035;
    const performanceBoost = 1 + ((player.seasonStats?.goals || 0) * 0.025) + Math.min(0.18, (player.seasonStats?.minutes || 0) / 12000);
    const contractFactor = isFreeAgent(player) ? 0 : FMG.clamp((player.contractYears || 0) / 3, 0.45, 1.15);
    return FMG.clamp(Math.round(player.value * ageCurve * potentialBoost * performanceBoost * contractFactor), 0, 999999999);
  };

  FMG.estimatePlayerWageDemand = function (player, role) {
    const roleFactor = role === "key" ? 1.45 : role === "starter" ? 1.22 : role === "rotation" ? 1 : role === "backup" ? 0.82 : 0.68;
    return Math.round(player.salary * roleFactor * personalityMultiplier(player));
  };

  FMG.buildTransferMarket = function (state) {
    ensureMarketState(state);
    const externalPlayers = state.players.filter((player) => player.teamId !== state.userClub.id && !player.retired);
    const freeAgents = state.players.filter((player) => isFreeAgent(player) && !player.retired);
    const marketable = [...externalPlayers]
      .filter((player) => player.teamId !== state.userClub.id)
      .sort((left, right) => FMG.calculatePlayerValue(right) - FMG.calculatePlayerValue(left))
      .slice(0, 18)
      .filter(() => Math.random() > 0.22);
    state.market.listings = [...freeAgents.slice(0, 6), ...marketable].map((player) => createListing(player, state));
    state.market.incomingOffers = state.market.incomingOffers || [];
  };

  FMG.refreshTransferMarket = function (state) {
    ensureMarketState(state);
    if (!state.market.windowOpen) return { ok: false, message: "El mercado esta cerrado esta semana." };
    if (state.finances.balance < state.market.refreshCost) return { ok: false, message: "No hay saldo suficiente para actualizar el scouting." };
    FMG.registerFinanceEntry(state.finances, "expense", "Informe extra de scouting", -state.market.refreshCost);
    FMG.buildTransferMarket(state);
    return { ok: true, message: "El area de scouting publico una nueva tanda de jugadores." };
  };

  FMG.createTransferOffer = function (state, playerId, options = {}) {
    ensureMarketState(state);
    if (!state.market.windowOpen) return { ok: false, message: "Solo puedes negociar durante la ventana de fichajes." };
    const player = state.players.find((item) => item.id === playerId && !item.retired);
    if (!player) return { ok: false, message: "No se encontro el jugador solicitado." };
    if (player.teamId === state.userTeamId) return { ok: false, message: "Ese jugador ya pertenece a tu club." };
    const listing = state.market.listings.find((item) => item.playerId === playerId) || createListing(player, state);
    const transferType = options.transferType || "buy";
    if (transferType === "loan" && !listing.loanAvailable) return { ok: false, message: "El club vendedor no acepta cesion." };

    const fee = transferType === "free" || isFreeAgent(player)
      ? 0
      : transferType === "loan"
        ? Math.round(listing.askingPrice * 0.14)
        : Number(options.fee || listing.askingPrice);
    const role = options.role || (player.overall >= 76 ? "starter" : "rotation");
    const wage = Number(options.wage || FMG.estimatePlayerWageDemand(player, role));
    const years = transferType === "loan" ? 1 : FMG.clamp(Number(options.years || 3), 1, 5);
    const releaseClause = Number(options.releaseClause || Math.round(FMG.calculatePlayerValue(player) * 2.1));
    const signingBonus = Number(options.signingBonus || Math.round(wage * (transferType === "loan" ? 1 : 3)));
    const negotiation = {
      id: FMG.uid("neg"),
      type: transferType,
      status: "pending",
      playerId,
      fromTeamId: isFreeAgent(player) ? null : player.teamId,
      toTeamId: state.userTeamId,
      fee,
      wage,
      years,
      role,
      releaseClause,
      signingBonus,
      createdWeek: state.currentWeek,
      message: "Oferta enviada"
    };
    state.market.negotiations.unshift(negotiation);
    state.market.negotiations = state.market.negotiations.slice(0, 12);
    return { ok: true, message: `Oferta enviada por ${player.name}.`, negotiation };
  };

  FMG.resolveTransferNegotiation = function (state, negotiationId) {
    ensureMarketState(state);
    const negotiation = state.market.negotiations.find((item) => item.id === negotiationId);
    if (!negotiation) return { ok: false, message: "Negociacion no encontrada." };
    if (negotiation.status !== "pending") return { ok: false, message: "La negociacion ya fue resuelta." };
    const player = state.players.find((item) => item.id === negotiation.playerId);
    if (!player || player.retired) return { ok: false, message: "Jugador no disponible." };
    const listing = state.market.listings.find((item) => item.playerId === player.id) || createListing(player, state);
    const requiredFee = negotiation.type === "loan" ? Math.round(listing.askingPrice * 0.12) : listing.askingPrice;
    const requiredWage = FMG.estimatePlayerWageDemand(player, negotiation.role);
    const totalCost = negotiation.fee + negotiation.signingBonus;
    const clubAccepts = negotiation.type === "free" || isFreeAgent(player) || negotiation.fee >= requiredFee * 0.9;
    const playerAccepts = negotiation.wage >= requiredWage * 0.92 && FMG.SQUAD_ROLES[negotiation.role];

    if (state.finances.balance < totalCost) {
      negotiation.status = "rejected";
      negotiation.message = "Presupuesto insuficiente";
      return { ok: false, message: "No hay presupuesto para cerrar la operacion." };
    }
    if (!clubAccepts || !playerAccepts) {
      negotiation.status = "countered";
      negotiation.fee = Math.max(negotiation.fee, requiredFee);
      negotiation.wage = Math.max(negotiation.wage, requiredWage);
      negotiation.message = !clubAccepts ? "El club pide mejorar la oferta." : "El jugador pide mejor contrato.";
      return { ok: false, message: negotiation.message, negotiation };
    }

    const oldTeamId = player.teamId;
    player.teamId = state.userTeamId;
    player.contractYears = negotiation.years;
    player.salary = negotiation.wage;
    player.releaseClause = negotiation.releaseClause;
    player.squadRole = negotiation.role;
    player.loan = negotiation.type === "loan" ? { fromTeamId: oldTeamId, untilSeason: state.seasonNumber + 1 } : null;
    player.injuredWeeks = 0;
    player.suspendedWeeks = 0;
    player.morale = FMG.clamp(player.morale + 8, 0, 100);
    player.happiness = FMG.clamp(player.happiness + 10, 0, 100);
    negotiation.status = "accepted";
    negotiation.message = "Operacion cerrada";
    FMG.registerFinanceEntry(state.finances, "expense", `${negotiation.type === "loan" ? "Cesion" : "Fichaje"} de ${player.name}`, -totalCost);
    state.market.transferHistory.unshift({
      week: state.currentWeek,
      type: negotiation.type,
      playerId: player.id,
      playerName: player.name,
      fromTeamName: teamName(state, oldTeamId),
      toTeamName: state.userClub.name,
      fee: negotiation.fee,
      wage: negotiation.wage
    });
    state.market.transferHistory = state.market.transferHistory.slice(0, 16);
    state.market.listings = state.market.listings.filter((item) => item.playerId !== player.id);
    FMG.autoSelectLineup(state, state.userTeamId);
    if (oldTeamId && state.teams.some((team) => team.id === oldTeamId)) FMG.autoSelectLineup(state, oldTeamId);
    return { ok: true, message: `${player.name} firma con ${state.userClub.name}.`, negotiation };
  };

  FMG.renewPlayerContract = function (state, playerId, options = {}) {
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userTeamId && !item.retired);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    const role = options.role || player.squadRole || "rotation";
    const wage = Number(options.wage || FMG.estimatePlayerWageDemand(player, role));
    const years = FMG.clamp(Number(options.years || 3), 1, 5);
    const demanded = FMG.estimatePlayerWageDemand(player, role);
    if (wage < demanded * 0.88) return { ok: false, message: "El jugador rechaza la renovacion por salario bajo." };
    player.salary = wage;
    player.contractYears = years;
    player.squadRole = role;
    player.releaseClause = Number(options.releaseClause || Math.round(FMG.calculatePlayerValue(player) * 2));
    player.morale = FMG.clamp(player.morale + 5, 0, 100);
    player.happiness = FMG.clamp(player.happiness + 8, 0, 100);
    player.moraleReason = "Contrato renovado";
    player.moraleLog = player.moraleLog || [];
    player.moraleLog.unshift({ week: state.currentWeek, reason: player.moraleReason, amount: 5 });
    return { ok: true, message: `${player.name} renovo por ${years} anos.` };
  };

  FMG.generateIncomingOffers = function (state) {
    ensureMarketState(state);
    if (!state.market.windowOpen) return [];
    const sellable = state.players
      .filter((player) => player.teamId === state.userTeamId && !player.retired && !player.loan)
      .sort((left, right) => FMG.calculatePlayerValue(right) - FMG.calculatePlayerValue(left))
      .slice(0, 5);
    const offers = sellable.filter(() => Math.random() < 0.45).map((player) => {
      const buyer = FMG.sample(state.teams.filter((team) => team.id !== state.userTeamId));
      return {
        id: FMG.uid("offer"),
        playerId: player.id,
        buyerTeamId: buyer.id,
        buyerTeamName: buyer.name,
        fee: Math.round(FMG.calculatePlayerValue(player) * (0.86 + FMG.randomInt(0, 34) / 100)),
        status: "pending",
        week: state.currentWeek
      };
    });
    state.market.incomingOffers = [...offers, ...state.market.incomingOffers].slice(0, 8);
    return offers;
  };

  FMG.respondIncomingOffer = function (state, offerId, accept) {
    ensureMarketState(state);
    const offer = state.market.incomingOffers.find((item) => item.id === offerId);
    if (!offer || offer.status !== "pending") return { ok: false, message: "Oferta no disponible." };
    const player = state.players.find((item) => item.id === offer.playerId && item.teamId === state.userTeamId);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    if (!accept) {
      offer.status = "rejected";
      return { ok: true, message: "Oferta rechazada." };
    }
    const squadSize = state.players.filter((item) => item.teamId === state.userTeamId && !item.retired).length;
    if (squadSize <= 15) return { ok: false, message: "Necesitas mantener al menos 15 jugadores." };
    player.teamId = offer.buyerTeamId;
    player.contractYears = Math.max(2, player.contractYears || 2);
    offer.status = "accepted";
    FMG.registerFinanceEntry(state.finances, "income", `Venta de ${player.name}`, offer.fee);
    state.market.transferHistory.unshift({
      week: state.currentWeek,
      type: "sale",
      playerId: player.id,
      playerName: player.name,
      fromTeamName: state.userClub.name,
      toTeamName: offer.buyerTeamName,
      fee: offer.fee,
      wage: player.salary
    });
    FMG.autoSelectLineup(state, state.userTeamId);
    FMG.autoSelectLineup(state, offer.buyerTeamId);
    return { ok: true, message: `${player.name} fue vendido a ${offer.buyerTeamName}.` };
  };

  FMG.buyPlayer = function (state, playerId) {
    const created = FMG.createTransferOffer(state, playerId, { transferType: "buy" });
    if (!created.ok) return created;
    return FMG.resolveTransferNegotiation(state, created.negotiation.id);
  };

  FMG.sellPlayer = function (state, playerId) {
    ensureMarketState(state);
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userClub.id && !item.retired);
    if (!player) return { ok: false, message: "Ese jugador no pertenece a tu plantilla." };
    const buyer = FMG.sample(state.teams.filter((team) => team.id !== state.userClub.id));
    const offer = {
      id: FMG.uid("offer"),
      playerId,
      buyerTeamId: buyer.id,
      buyerTeamName: buyer.name,
      fee: Math.round(FMG.calculatePlayerValue(player) * 0.95),
      status: "pending",
      week: state.currentWeek
    };
    state.market.incomingOffers.unshift(offer);
    return FMG.respondIncomingOffer(state, offer.id, true);
  };

  function ensureRivalAI(state) {
    state.rivalAI = state.rivalAI || { log: [], budgets: {}, profiles: {} };
    state.rivalAI.log = state.rivalAI.log || [];
    state.rivalAI.budgets = state.rivalAI.budgets || {};
    state.rivalAI.profiles = state.rivalAI.profiles || {};
  }

  function aiLog(state, teamId, title, detail) {
    ensureRivalAI(state);
    const team = state.teams.find((item) => item.id === teamId);
    state.rivalAI.log.unshift({
      week: state.currentWeek,
      teamId,
      teamName: team ? team.name : "Libre",
      title,
      detail
    });
    state.rivalAI.log = state.rivalAI.log.slice(0, 24);
  }

  function activeSquad(state, teamId) {
    return state.players.filter((player) => player.teamId === teamId && !player.retired);
  }

  function countByPosition(players) {
    return players.reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1;
      return counts;
    }, {});
  }

  function weakestNeed(state, teamId) {
    const squad = activeSquad(state, teamId);
    const counts = countByPosition(squad);
    const minimums = { POR: 2, DEF: 5, MED: 5, EXT: 3, DEL: 3 };
    const missing = Object.keys(minimums).find((position) => (counts[position] || 0) < minimums[position]);
    if (missing) return missing;
    const positions = ["POR", "DEF", "MED", "EXT", "DEL"];
    return positions
      .map((position) => {
        const group = squad.filter((player) => player.position === position);
        return { position, average: group.length ? FMG.average(group.map((player) => player.overall)) : 0 };
      })
      .sort((left, right) => left.average - right.average)[0].position;
  }

  function canSellFromPosition(state, teamId, position) {
    const counts = countByPosition(activeSquad(state, teamId));
    const minimums = { POR: 2, DEF: 5, MED: 5, EXT: 3, DEL: 3 };
    return (counts[position] || 0) > minimums[position];
  }

  FMG.initializeRivalAI = function (state) {
    ensureRivalAI(state);
    state.teams.forEach((team) => {
      if (!Number.isFinite(state.rivalAI.budgets[team.id])) {
        state.rivalAI.budgets[team.id] = Math.round(team.budget * 0.32 + team.sponsor * 0.18);
      }
      state.rivalAI.profiles[team.id] = state.rivalAI.profiles[team.id] || {
        ambition: team.budget >= 120000000 ? "contender" : team.budget >= 90000000 ? "balanced" : "seller"
      };
    });
  };

  FMG.getRivalSquadNeeds = function (state, teamId) {
    const squad = activeSquad(state, teamId);
    const counts = countByPosition(squad);
    const averageOverall = squad.length ? Math.round(FMG.average(squad.map((player) => player.overall))) : 0;
    return {
      teamId,
      squadSize: squad.length,
      counts,
      targetPosition: weakestNeed(state, teamId),
      averageOverall,
      budget: state.rivalAI?.budgets?.[teamId] || 0
    };
  };

  function adjustRivalTactics(state, team) {
    const plan = FMG.getTeamPlan(state, team.id);
    const standing = state.standings.find((entry) => entry.teamId === team.id);
    const position = state.standings.findIndex((entry) => entry.teamId === team.id) + 1;
    const previous = `${plan.mentality}-${plan.pressing}`;
    if (position > Math.ceil(state.teams.length * 0.65) && standing?.played > 2) {
      plan.mentality = "defensive";
      plan.pressing = "low";
      plan.defensiveLine = "deep";
    } else if (team.budget >= 120000000 || team.form >= 13) {
      plan.mentality = "attacking";
      plan.pressing = "high";
      plan.tempo = "fast";
    } else {
      plan.mentality = "balanced";
      plan.pressing = "medium";
      plan.tempo = "normal";
    }
    const next = `${plan.mentality}-${plan.pressing}`;
    if (previous !== next) aiLog(state, team.id, "Ajuste tactico", `${team.name} prepara un plan ${plan.mentality}/${plan.pressing}.`);
  }

  function renewRivalContracts(state, team) {
    activeSquad(state, team.id)
      .filter((player) => (player.contractYears || 0) <= 1 && player.overall >= 70)
      .slice(0, 2)
      .forEach((player) => {
        const wage = FMG.estimatePlayerWageDemand(player, player.overall >= 75 ? "starter" : "rotation");
        const budget = state.rivalAI.budgets[team.id] || 0;
        if (budget > wage * 5) {
          player.salary = wage;
          player.contractYears = 2 + FMG.randomInt(0, 2);
          state.rivalAI.budgets[team.id] = Math.max(0, budget - wage * 2);
          aiLog(state, team.id, "Renovacion", `${team.name} renovo a ${player.name} por ${player.contractYears} anos.`);
        }
      });
  }

  function rotateRivalSquad(state, team) {
    FMG.autoSelectLineup(state, team.id);
    const plan = FMG.getTeamPlan(state, team.id);
    const lineup = plan.lineup
      .map((id) => state.players.find((player) => player.id === id))
      .filter(Boolean);
    const tired = lineup.filter((player) => player.energy < 58);
    if (tired.length) {
      tired.forEach((player) => {
        const replacement = FMG.getAvailablePlayers(state.players, team.id)
          .filter((candidate) => candidate.position === player.position && !plan.lineup.includes(candidate.id))
          .sort((left, right) => right.energy - left.energy)[0];
        if (replacement) plan.lineup = plan.lineup.map((id) => id === player.id ? replacement.id : id);
      });
      aiLog(state, team.id, "Rotacion", `${team.name} rota ${tired.length} jugador(es) por cansancio.`);
    }
  }

  function makeRivalSale(state, team) {
    const profile = state.rivalAI.profiles[team.id];
    const squad = activeSquad(state, team.id);
    if (profile.ambition !== "seller" && squad.length <= 20) return false;
    const candidate = squad
      .filter((player) => canSellFromPosition(state, team.id, player.position))
      .sort((left, right) => left.overall - right.overall)[0];
    if (!candidate) return false;
    const buyer = state.teams
      .filter((item) => item.id !== team.id && item.id !== state.userTeamId)
      .sort((left, right) => (state.rivalAI.budgets[right.id] || 0) - (state.rivalAI.budgets[left.id] || 0))[0];
    if (!buyer) return false;
    const fee = Math.round(FMG.calculatePlayerValue(candidate) * 0.88);
    if ((state.rivalAI.budgets[buyer.id] || 0) < fee) return false;
    candidate.teamId = buyer.id;
    candidate.contractYears = Math.max(2, candidate.contractYears || 2);
    state.rivalAI.budgets[buyer.id] -= fee;
    state.rivalAI.budgets[team.id] += fee;
    state.market.transferHistory.unshift({
      week: state.currentWeek,
      type: "ai-sale",
      playerId: candidate.id,
      playerName: candidate.name,
      fromTeamName: team.name,
      toTeamName: buyer.name,
      fee,
      wage: candidate.salary
    });
    aiLog(state, team.id, "Venta rival", `${team.name} vendio a ${candidate.name} a ${buyer.name}.`);
    FMG.autoSelectLineup(state, team.id);
    FMG.autoSelectLineup(state, buyer.id);
    return true;
  }

  function makeRivalPurchase(state, team) {
    if (!state.market.windowOpen) return false;
    const need = weakestNeed(state, team.id);
    const budget = state.rivalAI.budgets[team.id] || 0;
    if (budget < 3000000) return false;
    const candidates = state.players
      .filter((player) =>
        !player.retired &&
        player.teamId !== team.id &&
        player.teamId !== state.userTeamId &&
        player.position === need &&
        (player.teamId === "free-agent" || canSellFromPosition(state, player.teamId, player.position))
      )
      .sort((left, right) => {
        if ((left.teamId === "free-agent") !== (right.teamId === "free-agent")) return left.teamId === "free-agent" ? -1 : 1;
        return right.overall - left.overall;
      });
    const target = candidates.find((player) => {
      const fee = player.teamId === "free-agent" ? 0 : Math.round(FMG.calculatePlayerValue(player) * 1.02);
      return fee + player.salary * 2 < budget;
    });
    if (!target) return false;
    const oldTeamId = target.teamId;
    const fee = oldTeamId === "free-agent" ? 0 : Math.round(FMG.calculatePlayerValue(target) * 1.02);
    target.teamId = team.id;
    target.contractYears = Math.max(2, target.contractYears || 2);
    target.squadRole = target.overall >= 74 ? "starter" : "rotation";
    state.rivalAI.budgets[team.id] -= fee + target.salary * 2;
    if (oldTeamId && oldTeamId !== "free-agent") state.rivalAI.budgets[oldTeamId] = (state.rivalAI.budgets[oldTeamId] || 0) + fee;
    state.market.transferHistory.unshift({
      week: state.currentWeek,
      type: oldTeamId === "free-agent" ? "ai-free" : "ai-buy",
      playerId: target.id,
      playerName: target.name,
      fromTeamName: teamName(state, oldTeamId),
      toTeamName: team.name,
      fee,
      wage: target.salary
    });
    aiLog(state, team.id, oldTeamId === "free-agent" ? "Agente libre" : "Compra rival", `${team.name} incorporo a ${target.name} para cubrir ${need}.`);
    FMG.autoSelectLineup(state, team.id);
    if (oldTeamId && oldTeamId !== "free-agent") FMG.autoSelectLineup(state, oldTeamId);
    return true;
  }

  FMG.runRivalAIWeek = function (state, options = {}) {
    FMG.initializeRivalAI(state);
    const actions = [];
    state.teams.filter((team) => team.id !== state.userTeamId).forEach((team) => {
      if (options.beforeMatches) {
        adjustRivalTactics(state, team);
        rotateRivalSquad(state, team);
        actions.push({ teamId: team.id, type: "match-prep" });
      }
      if (options.afterMatches) {
        renewRivalContracts(state, team);
        const sold = Math.random() < 0.28 ? makeRivalSale(state, team) : false;
        const bought = Math.random() < 0.42 ? makeRivalPurchase(state, team) : false;
        if (sold || bought) actions.push({ teamId: team.id, type: "market" });
      }
    });
    state.market.transferHistory = state.market.transferHistory.slice(0, 16);
    return actions;
  };
})();
