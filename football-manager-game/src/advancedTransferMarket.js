(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const clamp = FMG.clamp;

  const hashText = FMG.hashText;

  const deterministicId = FMG.deterministicId;

  const pickByHash = FMG.pickByHash;

  const boundedPush = FMG.boundedPush;

  const boundedUpsert = FMG.boundedUpsert;

  function team(state, teamId) {
    return (state.teams || []).find((item) => item.id === teamId) || null;
  }

  function teamName(state, teamId) {
    return team(state, teamId)?.name || "Libre";
  }

  function isFreeAgent(player) {
    return !player.teamId || player.teamId === "free-agent" || (player.contractYears || 0) <= 0;
  }

  function squad(state, teamId) {
    return (state.players || []).filter((player) => player.teamId === teamId && !player.retired);
  }

  function standingPosition(state, teamId) {
    const position = (state.standings || []).findIndex((entry) => entry.teamId === teamId) + 1;
    return position || (state.teams || []).length || 1;
  }

  function ensureAdvancedTransferMarket(state) {
    state.market = state.market || {};
    state.market.listings = state.market.listings || [];
    state.market.negotiations = state.market.negotiations || [];
    state.market.incomingOffers = state.market.incomingOffers || [];
    state.market.transferHistory = state.market.transferHistory || [];
    state.market.advanced = state.market.advanced || {};
    const advanced = state.market.advanced;
    advanced.version = 1;
    advanced.economy = advanced.economy || { inflation: 1, momentum: 0, deadlinePressure: 0, liquidity: 50 };
    advanced.agents = advanced.agents || {};
    advanced.players = advanced.players || {};
    advanced.clubs = advanced.clubs || {};
    advanced.negotiations = advanced.negotiations || {};
    advanced.contracts = advanced.contracts || { promises: [], brokenPromises: [], wageHierarchy: [] };
    advanced.relationships = advanced.relationships || [];
    advanced.drama = advanced.drama || [];
    advanced.rumors = advanced.rumors || [];
    advanced.reputation = advanced.reputation || { buyer: 50, seller: 50, promiseTrust: 55, corruptionRisk: 8 };
    advanced.marketMemory = advanced.marketMemory || [];
    (state.teams || []).forEach((item) => ClubNegotiationIdentityController.ensure(state, item.id));
    squad(state, state.userTeamId).forEach((player) => PlayerAmbitionEngine.ensure(state, player));
    ContractManagementSystem.updateWageHierarchy(state);
    return advanced;
  }

  const AgentRelationshipManager = {
    ensureAgent(state, player) {
      const advanced = ensureAdvancedTransferMarket(state);
      const id = deterministicId("agent", [player.id, "representative"]);
      advanced.agents[id] = advanced.agents[id] || {
        id,
        name: pickByHash(["Sergio Lagos", "Camila Pizarro", "Andres Vidal", "Ruben Salinas", "Martina Alarcon"], `${player.id}-agent-name`),
        personality: pickByHash(["duro", "relacional", "mediatico", "pragmatico", "protector"], `${player.id}-agent-personality`),
        loyalty: 40 + (hashText(`${player.id}-agent-loyalty`) % 46),
        greed: 34 + (hashText(`${player.id}-agent-greed`) % 52),
        patience: 38 + (hashText(`${player.id}-agent-patience`) % 46),
        relationship: 50,
        clients: []
      };
      const agent = advanced.agents[id];
      if (!agent.clients.includes(player.id)) agent.clients.push(player.id);
      return agent;
    },

    updateAfterOutcome(state, negotiation, outcome) {
      const advanced = ensureAdvancedTransferMarket(state);
      const agentId = negotiation.advanced?.agentId || negotiation.agent?.id;
      const agent = agentId ? advanced.agents[agentId] : null;
      if (!agent) return null;
      const delta = outcome === "accepted" ? 6 : outcome === "countered" ? -2 : -7;
      agent.relationship = clamp(agent.relationship + delta, 0, 100);
      agent.loyalty = clamp(agent.loyalty + (outcome === "accepted" ? 2 : -1), 0, 100);
      boundedUpsert(advanced.relationships, {
        id: deterministicId("agent-rel", [state.seasonNumber, state.currentWeek, agent.id, negotiation.playerId, outcome]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        agentId: agent.id,
        agentName: agent.name,
        playerId: negotiation.playerId,
        outcome,
        relationship: agent.relationship
      }, 24);
      return agent;
    }
  };

  const PlayerAmbitionEngine = {
    ensure(state, player) {
      const advanced = state.market?.advanced || ensureAdvancedTransferMarket(state);
      const seed = hashText(`${player.id}-ambition`);
      advanced.players[player.id] = advanced.players[player.id] || {
        playerId: player.id,
        ambition: clamp(34 + Math.round((player.potential || player.overall || 60) * 0.45) + (seed % 18), 20, 98),
        loyalty: clamp(38 + (hashText(`${player.id}-loyalty`) % 48) + (player.personality === "Leal" ? 12 : 0), 15, 100),
        fear: clamp(24 + (hashText(`${player.id}-fear`) % 48), 0, 100),
        pressure: 32,
        dreamClubType: pickByHash(["club grande", "exterior", "proyecto familiar", "minutos", "copas"], `${player.id}-dream`),
        familyInfluence: 20 + (hashText(`${player.id}-family`) % 54),
        frustration: clamp(100 - (player.happiness || 58), 0, 100),
        hiddenIntention: pickByHash(["subir salario", "ganar minutos", "salto deportivo", "seguridad familiar", "vitrina internacional"], `${player.id}-intent`)
      };
      return advanced.players[player.id];
    },

    evaluateFit(state, player, negotiation) {
      const ambition = this.ensure(state, player);
      const club = team(state, state.userTeamId) || state.userClub || {};
      const position = standingPosition(state, state.userTeamId);
      const roleAppeal = negotiation.role === "key" ? 14 : negotiation.role === "starter" ? 9 : negotiation.role === "rotation" ? 2 : -6;
      const sportingAppeal = position <= 3 ? 12 : position <= 6 ? 5 : -4;
      const dreamAppeal = ambition.dreamClubType === "club grande" && (club.budget || 0) > 110000000 ? 8 : ambition.dreamClubType === "minutos" && ["key", "starter"].includes(negotiation.role) ? 10 : 0;
      const familyPenalty = ambition.familyInfluence > 65 && player.teamId && player.teamId !== "free-agent" ? 4 : 0;
      return clamp(46 + roleAppeal + sportingAppeal + dreamAppeal - familyPenalty - Math.round(ambition.fear * 0.05), 0, 100);
    },

    updateFrustration(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      squad(state, state.userTeamId).forEach((player) => {
        const profile = this.ensure(state, player);
        const rolePressure = player.squadRole === "key" && (player.seasonStats?.starts || 0) < 2 ? 5 : 0;
        profile.frustration = clamp(Math.round(profile.frustration * 0.82 + (100 - (player.happiness || 55)) * 0.18 + rolePressure), 0, 100);
        profile.pressure = clamp(Math.round(profile.pressure * 0.86 + profile.frustration * 0.14), 0, 100);
      });
      return advanced.players;
    }
  };

  const ClubNegotiationIdentityController = {
    ensure(state, teamId) {
      state.market = state.market || {};
      state.market.advanced = state.market.advanced || { clubs: {} };
      state.market.advanced.clubs = state.market.advanced.clubs || {};
      const club = team(state, teamId) || state.userClub || { id: teamId, budget: 80000000, style: "Balanced" };
      const seed = hashText(`${teamId}-negotiation`);
      state.market.advanced.clubs[teamId] = state.market.advanced.clubs[teamId] || {
        teamId,
        identity: club.budget >= 120000000 ? "comprador agresivo" : club.budget < 80000000 ? "club vendedor" : "negociador prudente",
        patience: 35 + (seed % 46),
        sellingResistance: club.budget >= 110000000 ? 72 : 44 + (seed % 30),
        wageDiscipline: 38 + (hashText(`${teamId}-wage`) % 50),
        promiseReliability: 42 + (hashText(`${teamId}-promise`) % 45),
        rivalryPremium: 1.18 + ((seed >>> 8) % 18) / 100,
        corruptionRisk: clamp(4 + (seed % 16) - Math.round((club.budget || 80000000) / 30000000), 2, 28),
        financialBehavior: club.budget >= 120000000 ? "premium" : club.budget < 75000000 ? "value-trader" : "balanced"
      };
      return state.market.advanced.clubs[teamId];
    }
  };

  const FootballEconomyController = {
    update(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      const history = state.market.transferHistory || [];
      const lastFees = history.slice(0, 8).map((entry) => entry.fee || 0).filter(Boolean);
      const avgFee = lastFees.length ? FMG.average(lastFees) : 0;
      const windowHeat = state.market.windowOpen ? 6 : -3;
      const mediaHeat = state.managerEcosystem?.worldMedia?.media?.pressure || 45;
      advanced.economy.momentum = clamp(Math.round(advanced.economy.momentum * 0.78 + history.length * 0.4 + windowHeat + (mediaHeat - 50) * 0.08), -30, 60);
      advanced.economy.inflation = clamp(Number((1 + advanced.economy.momentum / 180 + Math.min(avgFee, 80000000) / 900000000).toFixed(3)), 0.86, 1.42);
      advanced.economy.deadlinePressure = state.market.windowOpen
        ? clamp(Math.round(((state.currentWeek || 1) / Math.max(1, state.totalWeeks || 14)) * 100), 0, 100)
        : 0;
      advanced.economy.liquidity = clamp(Math.round(58 - advanced.economy.inflation * 12 + (state.finances?.balance || 0) / 15000000), 15, 95);
      return advanced.economy;
    },

    marketAdjustedValue(state, player) {
      const economy = this.update(state);
      const mediaPremium = (state.managerEcosystem?.worldMedia?.media?.obsession?.[state.userTeamId] || 40) > 70 ? 1.05 : 1;
      return Math.round(FMG.calculatePlayerValue(player) * economy.inflation * mediaPremium);
    }
  };

  const FinancialPressureEngine = {
    evaluate(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      const finances = FMG.ensureAdvancedFinances ? FMG.ensureAdvancedFinances(state) : state.finances;
      const ffp = finances?.financialFairPlay?.status || "ok";
      const wageSpend = squad(state, state.userTeamId).reduce((sum, player) => sum + (player.salary || 0), 0);
      const pressure = clamp(Math.round((ffp === "critical" ? 78 : ffp === "warning" ? 58 : 34) + Math.max(0, wageSpend - (finances?.financialFairPlay?.wageLimit || wageSpend)) / 1200000), 0, 100);
      advanced.economy.financialPressure = pressure;
      return pressure;
    }
  };

  const ContractManagementSystem = {
    updateWageHierarchy(state) {
      const advanced = state.market?.advanced || ensureAdvancedTransferMarket(state);
      advanced.contracts.wageHierarchy = squad(state, state.userTeamId)
        .map((player) => ({ playerId: player.id, name: player.name, salary: player.salary || 0, role: player.squadRole || "rotation" }))
        .sort((left, right) => right.salary - left.salary)
        .slice(0, 10);
      const topWage = advanced.contracts.wageHierarchy[0]?.salary || 1;
      const median = advanced.contracts.wageHierarchy[Math.floor(advanced.contracts.wageHierarchy.length / 2)]?.salary || topWage;
      advanced.contracts.lockerRoomWagePressure = clamp(Math.round((topWage / Math.max(1, median) - 1) * 28), 0, 100);
      return advanced.contracts.wageHierarchy;
    },

    registerPromises(state, negotiation) {
      const advanced = ensureAdvancedTransferMarket(state);
      (negotiation.promises || []).forEach((promise) => {
        boundedUpsert(advanced.contracts.promises, {
          id: deterministicId("contract-promise", [state.seasonNumber, state.currentWeek, negotiation.playerId, promise]),
          week: state.currentWeek,
          seasonNumber: state.seasonNumber,
          playerId: negotiation.playerId,
          text: promise,
          status: "active",
          source: negotiation.id
        }, 30);
      });
    },

    evaluateBrokenPromises(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      advanced.contracts.promises.filter((promise) => promise.status === "active").forEach((promise) => {
        const player = (state.players || []).find((item) => item.id === promise.playerId);
        if (!player || player.teamId !== state.userTeamId) return;
        const age = (state.currentWeek || 1) - promise.week;
        const broken = age >= 5 && promise.text.includes("minutos") && (player.seasonStats?.starts || 0) < 2;
        if (broken) {
          promise.status = "broken";
          player.happiness = clamp((player.happiness || 50) - 8, 0, 100);
          player.moraleReason = "Promesa contractual incumplida";
          boundedUpsert(advanced.contracts.brokenPromises, {
            id: deterministicId("broken-promise", [promise.id]),
            week: state.currentWeek,
            seasonNumber: state.seasonNumber,
            playerId: player.id,
            playerName: player.name,
            text: promise.text,
            impact: 8
          }, 18);
        }
      });
      return advanced.contracts.brokenPromises;
    }
  };

  const NegotiationAI = {
    enrich(state, negotiation, player) {
      const advanced = ensureAdvancedTransferMarket(state);
      const agent = AgentRelationshipManager.ensureAgent(state, player);
      const ambition = PlayerAmbitionEngine.ensure(state, player);
      const seller = ClubNegotiationIdentityController.ensure(state, negotiation.fromTeamId || "free-agent");
      const buyer = ClubNegotiationIdentityController.ensure(state, negotiation.toTeamId || state.userTeamId);
      const pressure = this.evaluatePressure(state, negotiation, player, { agent, ambition, seller, buyer });
      negotiation.agent = {
        ...(negotiation.agent || {}),
        id: agent.id,
        name: agent.name,
        style: negotiation.agent?.style || agent.personality,
        loyalty: agent.loyalty,
        relationship: agent.relationship
      };
      negotiation.advanced = {
        ...(negotiation.advanced || {}),
        agentId: agent.id,
        ambition,
        sellerIdentity: seller.identity,
        buyerIdentity: buyer.identity,
        hiddenIntention: ambition.hiddenIntention,
        pressure,
        imageRights: Math.round((negotiation.wage || player.salary || 0) * (player.overall >= 76 ? 1.8 : 0.85)),
        familyInfluence: ambition.familyInfluence,
        releaseClauseDemand: Math.round(FootballEconomyController.marketAdjustedValue(state, player) * (ambition.ambition > 72 ? 2.55 : 2.05)),
        corruptionRisk: clamp(Math.round((seller.corruptionRisk + buyer.corruptionRisk) / 2), 0, 100)
      };
      negotiation.promises = negotiation.promises || [
        ambition.dreamClubType === "minutos" ? "minutos regulares" : "proyecto deportivo",
        player.overall >= 75 ? "estatus importante" : "plan de desarrollo"
      ];
      advanced.negotiations[negotiation.id] = negotiation.advanced;
      return negotiation;
    },

    evaluatePressure(state, negotiation, player, context = {}) {
      const agent = context.agent || AgentRelationshipManager.ensureAgent(state, player);
      const ambition = context.ambition || PlayerAmbitionEngine.ensure(state, player);
      const economy = FootballEconomyController.update(state);
      const mediaPressure = state.managerEcosystem?.worldMedia?.media?.pressure || 42;
      const deadline = economy.deadlinePressure || 0;
      return clamp(Math.round(agent.greed * 0.28 + ambition.ambition * 0.24 + mediaPressure * 0.18 + deadline * 0.18 + ambition.frustration * 0.12), 0, 100);
    },

    evaluateContext(state, negotiation, player, base = {}) {
      this.enrich(state, negotiation, player);
      const advanced = negotiation.advanced || {};
      const ambitionFit = PlayerAmbitionEngine.evaluateFit(state, player, negotiation);
      const pressure = advanced.pressure || 45;
      const agent = AgentRelationshipManager.ensureAgent(state, player);
      const seller = ClubNegotiationIdentityController.ensure(state, negotiation.fromTeamId || "free-agent");
      const rivalPremium = FMG.getRivalry?.(state.userTeamId, negotiation.fromTeamId) ? seller.rivalryPremium : 1;
      const wageHierarchy = state.market.advanced.contracts.lockerRoomWagePressure || 0;
      const dreamDiscount = ambitionFit > 68 ? 0.97 : 1.04;
      return {
        wageMultiplier: (base.wageMultiplier || 1) * (1 + pressure / 520) * (1 + agent.greed / 900) * (1 + wageHierarchy / 1200) * dreamDiscount,
        feeMultiplier: (base.feeMultiplier || 1) * rivalPremium * (1 + pressure / 700) * (seller.identity === "club vendedor" ? 0.96 : 1.04),
        acceptanceModifier: ambitionFit - 50,
        message: `Agente ${agent.name} (${agent.personality}) empuja ${advanced.hiddenIntention}; presion ${pressure}/100, encaje ${ambitionFit}/100.`
      };
    }
  };

  const ProceduralTransferDramaSystem = {
    record(state, type, negotiation, detail) {
      const advanced = ensureAdvancedTransferMarket(state);
      const player = (state.players || []).find((item) => item.id === negotiation.playerId);
      const entry = {
        id: deterministicId("transfer-drama", [state.seasonNumber, state.currentWeek, type, negotiation.id]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        type,
        playerId: negotiation.playerId,
        playerName: player?.name || "Jugador",
        detail,
        heat: clamp((negotiation.advanced?.pressure || 45) + (type === "accepted" ? 8 : type === "rejected" ? 12 : 4), 0, 100)
      };
      boundedUpsert(advanced.drama, entry, 24);
      if (entry.heat >= 58) {
        boundedUpsert(advanced.rumors, {
          id: deterministicId("transfer-rumor", [entry.id]),
          week: state.currentWeek,
          seasonNumber: state.seasonNumber,
          playerId: entry.playerId,
          playerName: entry.playerName,
          topic: type === "accepted" ? "acuerdo cerrado" : type === "countered" ? "tira y afloja contractual" : "negociacion tensionada",
          credibility: clamp(entry.heat - 6, 25, 92)
        }, 20);
        FMG.addNewsItem?.(state, {
          type: "transfer-drama",
          title: `${entry.playerName}: ${entry.type === "accepted" ? "acuerdo con eco mediatico" : "negociacion bajo presion"}`,
          body: entry.detail,
          tags: ["mercado", "drama"],
          importance: entry.heat,
          entities: { playerId: entry.playerId, teamId: state.userTeamId },
          dedupeKey: `transfer-drama-${state.seasonNumber}-${state.currentWeek}-${entry.playerId}-${type}`
        });
      }
      return entry;
    }
  };

  const TransferMarketController = {
    buildListings(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      const economy = FootballEconomyController.update(state);
      const externalPlayers = (state.players || [])
        .filter((player) => player.teamId !== state.userTeamId && !player.retired)
        .sort((left, right) => FootballEconomyController.marketAdjustedValue(state, right) - FootballEconomyController.marketAdjustedValue(state, left));
      const freeAgents = externalPlayers.filter(isFreeAgent).slice(0, 6);
      const targets = externalPlayers
        .filter((player) => !isFreeAgent(player))
        .slice(0, 26)
        .filter((player) => (hashText(`${state.seasonNumber}-${state.currentWeek}-${player.id}-listed`) % 100) >= 18)
        .slice(0, 18);
      state.market.listings = [...freeAgents, ...targets].map((player) => {
        const adjustedValue = FootballEconomyController.marketAdjustedValue(state, player);
        const seller = ClubNegotiationIdentityController.ensure(state, player.teamId || "free-agent");
        const free = isFreeAgent(player);
        return {
          listingId: deterministicId("listing", [state.seasonNumber, state.currentWeek, player.id]),
          playerId: player.id,
          askingPrice: free ? 0 : clamp(Math.round(adjustedValue * (1.02 + (hashText(`${player.id}-ask`) % 18) / 100) * (seller.identity === "club vendedor" ? 0.95 : 1.06)), 1000000, 999999999),
          sellerTeamId: free ? null : player.teamId,
          sellerTeamName: free ? "Libre" : teamName(state, player.teamId),
          loanAvailable: !free && player.age <= 24 && player.overall < 72,
          scoutingLevel: clamp(45 + (hashText(`${player.id}-scout-${state.currentWeek}`) % 45), 35, 95),
          marketHeat: clamp(Math.round(economy.momentum + (player.overall || 60) * 0.45), 20, 100)
        };
      });
      advanced.marketMemory = state.market.listings.map((listing) => ({
        playerId: listing.playerId,
        askingPrice: listing.askingPrice,
        heat: listing.marketHeat
      })).slice(0, 24);
      return state.market.listings;
    },

    weekly(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      FootballEconomyController.update(state);
      FinancialPressureEngine.evaluate(state);
      PlayerAmbitionEngine.updateFrustration(state);
      ContractManagementSystem.updateWageHierarchy(state);
      ContractManagementSystem.evaluateBrokenPromises(state);
      if (state.market.windowOpen) this.generateMomentumRumor(state);
      return advanced;
    },

    generateMomentumRumor(state) {
      const advanced = ensureAdvancedTransferMarket(state);
      const listing = pickByHash(state.market.listings || [], `${state.seasonNumber}-${state.currentWeek}-momentum-rumor`);
      if (!listing) return null;
      const player = (state.players || []).find((item) => item.id === listing.playerId);
      if (!player) return null;
      const rumor = {
        id: deterministicId("market-momentum", [state.seasonNumber, state.currentWeek, player.id]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        playerId: player.id,
        playerName: player.name,
        topic: "momentum de mercado",
        credibility: clamp(listing.marketHeat || 50, 25, 90)
      };
      boundedUpsert(advanced.rumors, rumor, 20);
      return rumor;
    }
  };

  const MarketSimulationLayer = {
    runWeek(state) {
      return TransferMarketController.weekly(state);
    }
  };

  const previousBuildTransferMarket = FMG.buildTransferMarket;
  FMG.buildTransferMarket = function (state) {
    if (!state?.players || !state?.teams) return previousBuildTransferMarket ? previousBuildTransferMarket(state) : [];
    return TransferMarketController.buildListings(state);
  };

  const previousCreateTransferOffer = FMG.createTransferOffer;
  FMG.createTransferOffer = function (state, playerId, options = {}) {
    ensureAdvancedTransferMarket(state);
    const result = previousCreateTransferOffer ? previousCreateTransferOffer(state, playerId, options) : { ok: false, message: "Mercado no disponible." };
    if (result.ok && result.negotiation) {
      const player = (state.players || []).find((item) => item.id === playerId);
      if (player) {
        NegotiationAI.enrich(state, result.negotiation, player);
        result.negotiation.releaseClause = Math.max(result.negotiation.releaseClause || 0, result.negotiation.advanced.releaseClauseDemand || 0);
        ProceduralTransferDramaSystem.record(state, "opened", result.negotiation, `${player.name} abre una negociacion con intencion oculta: ${result.negotiation.advanced.hiddenIntention}.`);
      }
    }
    return result;
  };

  const previousEvaluateNegotiationContext = FMG.ManagerEcosystem?.evaluateNegotiationContext;
  function evaluateNegotiationContext(state, negotiation, player) {
    const base = previousEvaluateNegotiationContext ? previousEvaluateNegotiationContext(state, negotiation, player) : { wageMultiplier: 1, feeMultiplier: 1, message: "" };
    return NegotiationAI.evaluateContext(state, negotiation, player, base);
  }
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.evaluateNegotiationContext = evaluateNegotiationContext;

  const previousResolveTransferNegotiation = FMG.resolveTransferNegotiation;
  FMG.resolveTransferNegotiation = function (state, negotiationId) {
    ensureAdvancedTransferMarket(state);
    const negotiation = state.market.negotiations.find((item) => item.id === negotiationId);
    const player = negotiation ? (state.players || []).find((item) => item.id === negotiation.playerId) : null;
    if (negotiation && player) NegotiationAI.enrich(state, negotiation, player);
    const result = previousResolveTransferNegotiation ? previousResolveTransferNegotiation(state, negotiationId) : { ok: false, message: "Negociacion no disponible." };
    const outcome = negotiation?.status || (result.ok ? "accepted" : "rejected");
    if (negotiation) {
      AgentRelationshipManager.updateAfterOutcome(state, negotiation, outcome);
      if (outcome === "accepted") {
        ContractManagementSystem.registerPromises(state, negotiation);
        ContractManagementSystem.updateWageHierarchy(state);
      }
      ProceduralTransferDramaSystem.record(state, outcome, negotiation, result.message || negotiation.message || "Negociacion actualizada.");
    }
    return result;
  };

  const previousRenewPlayerContract = FMG.renewPlayerContract;
  FMG.renewPlayerContract = function (state, playerId, options = {}) {
    ensureAdvancedTransferMarket(state);
    const player = (state.players || []).find((item) => item.id === playerId);
    if (player) {
      const ambition = PlayerAmbitionEngine.ensure(state, player);
      options.releaseClause = options.releaseClause || Math.round(FootballEconomyController.marketAdjustedValue(state, player) * (ambition.ambition > 70 ? 2.4 : 1.9));
    }
    const result = previousRenewPlayerContract ? previousRenewPlayerContract(state, playerId, options) : { ok: false, message: "Contrato no disponible." };
    ContractManagementSystem.updateWageHierarchy(state);
    if (result.ok && player) {
      boundedUpsert(state.market.advanced.contracts.promises, {
        id: deterministicId("renewal", [state.seasonNumber, state.currentWeek, player.id]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        playerId: player.id,
        text: options.promise || "proyecto deportivo",
        status: "active",
        source: "renewal"
      }, 30);
    }
    return result;
  };

  const previousGenerateIncomingOffers = FMG.generateIncomingOffers;
  FMG.generateIncomingOffers = function (state) {
    ensureAdvancedTransferMarket(state);
    const offers = previousGenerateIncomingOffers ? previousGenerateIncomingOffers(state) : [];
    offers.forEach((offer) => {
      const player = (state.players || []).find((item) => item.id === offer.playerId);
      const buyer = ClubNegotiationIdentityController.ensure(state, offer.buyerTeamId);
      const ambition = player ? PlayerAmbitionEngine.ensure(state, player) : null;
      offer.advanced = {
        buyerIdentity: buyer.identity,
        hiddenIntention: ambition?.hiddenIntention || "oportunidad",
        pressure: player ? clamp(Math.round((ambition.frustration || 35) * 0.44 + (state.market.advanced.economy.deadlinePressure || 0) * 0.24 + (buyer.patience || 50) * 0.18), 0, 100) : 40,
        familyInfluence: ambition?.familyInfluence || 30
      };
    });
    return offers;
  };

  const previousRespondIncomingOffer = FMG.respondIncomingOffer;
  FMG.respondIncomingOffer = function (state, offerId, accept) {
    ensureAdvancedTransferMarket(state);
    const offer = state.market.incomingOffers.find((item) => item.id === offerId);
    const player = offer ? (state.players || []).find((item) => item.id === offer.playerId) : null;
    const result = previousRespondIncomingOffer ? previousRespondIncomingOffer(state, offerId, accept) : { ok: false, message: "Oferta no disponible." };
    if (offer && player) {
      const advanced = ensureAdvancedTransferMarket(state);
      const outcome = accept && result.ok ? "sale-accepted" : accept ? "sale-blocked" : "sale-rejected";
      boundedUpsert(advanced.drama, {
        id: deterministicId("incoming-drama", [state.seasonNumber, state.currentWeek, offer.id, outcome]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        type: outcome,
        playerId: player.id,
        playerName: player.name,
        detail: `${teamName(state, offer.buyerTeamId)} ${accept ? "presiono" : "recibio rechazo"} por ${player.name}.`,
        heat: offer.advanced?.pressure || 45
      }, 24);
      if (!accept) {
        const profile = PlayerAmbitionEngine.ensure(state, player);
        profile.frustration = clamp(profile.frustration + 5, 0, 100);
        player.happiness = clamp((player.happiness || 50) - (profile.ambition > 72 ? 4 : 1), 0, 100);
      }
    }
    return result;
  };

  const previousRunManagerEcosystemWeek = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options = {}) {
    const result = previousRunManagerEcosystemWeek ? previousRunManagerEcosystemWeek(state, options) : {};
    result.transferMarket = MarketSimulationLayer.runWeek(state);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  FMG.AdvancedTransferMarket = {
    ensure: ensureAdvancedTransferMarket,
    TransferMarketController,
    FootballEconomyController,
    NegotiationAI,
    AgentRelationshipManager,
    PlayerAmbitionEngine,
    ContractManagementSystem,
    FinancialPressureEngine,
    ClubNegotiationIdentityController,
    MarketSimulationLayer,
    ProceduralTransferDramaSystem
  };

  FMG.ensureAdvancedTransferMarket = ensureAdvancedTransferMarket;
})();
