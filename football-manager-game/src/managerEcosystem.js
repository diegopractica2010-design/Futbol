(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pickByHash(list, seed) {
    if (!list.length) return null;
    return list[hashText(seed) % list.length];
  }

  function boundedPush(list, item, limit) {
    list.unshift(item);
    list.length = Math.min(list.length, limit);
    return item;
  }

  function deterministicId(prefix, parts) {
    return `${prefix}-${hashText(parts.join("|")).toString(36)}`;
  }

  function boundedUpsert(list, item, limit) {
    const existingIndex = list.findIndex((entry) => entry.id === item.id);
    if (existingIndex >= 0) list.splice(existingIndex, 1);
    return boundedPush(list, item, limit);
  }

  function teamStanding(state, teamId) {
    const position = (state.standings || []).findIndex((entry) => entry.teamId === teamId) + 1;
    return {
      position: position || state.teams.length,
      entry: (state.standings || []).find((entry) => entry.teamId === teamId) || null
    };
  }

  function teamPlayers(state, teamId) {
    return (state.players || []).filter((player) => player.teamId === teamId && !player.retired);
  }

  function ensureClubRecord(state, team) {
    const eco = state.managerEcosystem;
    const key = team.id;
    if (eco.clubs[key]) return eco.clubs[key];
    const seed = hashText(`${team.id}-${team.style}-${team.budget}`);
    const ambition = team.budget >= 125000000 ? "title" : team.budget >= 90000000 ? "continental" : "stability";
    const fanBaseLevel = clamp(Math.round((team.fanBase || 200000) / 9000), 18, 100);
    eco.clubs[key] = {
      teamId: team.id,
      culture: {
        identity: team.style || "Balanced",
        patience: 38 + (seed % 32),
        tradition: 35 + ((seed >>> 4) % 40),
        academyPride: 28 + ((seed >>> 8) % 46),
        transferAggression: ambition === "title" ? 76 : ambition === "continental" ? 58 : 38
      },
      philosophy: {
        tactical: team.style || "Balanced",
        preferredFormation: pickByHash(["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"], `${team.id}-formation`),
        developmentBias: 35 + ((seed >>> 10) % 50),
        riskTolerance: 30 + ((seed >>> 12) % 52)
      },
      board: {
        ambition,
        patience: 45 + ((seed >>> 14) % 38),
        politics: [
          { name: "Presidente", influence: 38 + (seed % 28), mood: 58 },
          { name: "Area deportiva", influence: 28 + ((seed >>> 6) % 26), mood: 55 },
          { name: "Finanzas", influence: 24 + ((seed >>> 12) % 28), mood: 54 }
        ],
        expectation: ambition === "title" ? "Pelear campeonatos" : ambition === "continental" ? "Clasificar a copas" : "Consolidar proyecto"
      },
      fans: {
        expectation: ambition === "title" ? 82 : ambition === "continental" ? 66 : 50,
        mood: 58,
        fanBaseLevel
      },
      finances: {
        pressure: 42,
        wageDiscipline: 45 + ((seed >>> 16) % 45)
      },
      reputation: clamp(34 + Math.round((team.budget || 75000000) / 2400000) + Math.round((team.form || 10) * 1.4), 20, 92),
      staff: {
        assistant: { name: `${team.city || "Club"} Segundo`, judgement: 48 + (seed % 35), loyalty: 45 + ((seed >>> 3) % 40) },
        coach: { specialization: pickByHash(["ataque", "defensa", "posesion", "juveniles"], `${team.id}-coach`), quality: 44 + ((seed >>> 5) % 40) },
        medical: { quality: 42 + ((seed >>> 7) % 42), fatiguePrevention: 38 + ((seed >>> 9) % 44) },
        psychologist: { quality: 40 + ((seed >>> 11) % 44), conflictHandling: 38 + ((seed >>> 13) % 44) }
      },
      scouting: {
        reach: ambition === "title" ? 74 : ambition === "continental" ? 58 : 42,
        regions: [team.city || "Local", "Nacional"],
        reports: []
      },
      academy: {
        level: 34 + ((seed >>> 15) % 52),
        prospects: []
      },
      memory: []
    };
    return eco.clubs[key];
  }

  const FootballCultureController = {
    ensure(state) {
      const eco = state.managerEcosystem;
      eco.culture.country = eco.culture.country || {
        name: "Chile",
        tempo: "intenso",
        mediaHeat: 62,
        youthBias: 58,
        rivalryWeight: 74
      };
      eco.culture.league = eco.culture.league || {
        name: "Liga Chile",
        reputation: 54,
        financialScale: 48,
        exportMarket: 64,
        tacticalTrend: "presion y transicion"
      };
    },

    evolve(state) {
      const league = state.managerEcosystem.culture.league;
      const avgBudget = FMG.average((state.teams || []).map((team) => team.budget || 0));
      league.financialScale = clamp(Math.round(avgBudget / 2200000), 30, 80);
      league.reputation = clamp(league.reputation + (state.currentWeek % 7 === 0 ? 1 : 0), 35, 88);
    }
  };

  const DynamicReputationController = {
    updateClub(state, team) {
      const club = ensureClubRecord(state, team);
      const standing = teamStanding(state, team.id);
      const budgetRank = [...state.teams].sort((a, b) => b.budget - a.budget).findIndex((item) => item.id === team.id) + 1;
      const overPerformance = budgetRank - standing.position;
      club.reputation = clamp(Math.round(club.reputation + overPerformance * 0.12 + ((team.form || 10) - 10) * 0.05), 20, 96);
      return club.reputation;
    },

    updateLeague(state) {
      const eco = state.managerEcosystem;
      const topRep = Math.max(...Object.values(eco.clubs).map((club) => club.reputation || 40), 40);
      eco.culture.league.reputation = clamp(Math.round(eco.culture.league.reputation * 0.96 + topRep * 0.04), 35, 92);
    }
  };

  const BoardDecisionController = {
    update(state, team) {
      const club = ensureClubRecord(state, team);
      const standing = teamStanding(state, team.id);
      const boardTrust = team.id === state.userTeamId ? state.finances?.boardTrust || 50 : club.board.politics[0].mood;
      const expectationPressure = club.board.ambition === "title" && standing.position > 3 ? 12 : club.board.ambition === "continental" && standing.position > 6 ? 8 : 0;
      const financePressure = club.finances.pressure > 70 ? 8 : 0;
      club.board.politics.forEach((faction, index) => {
        const agenda = index === 2 ? financePressure : expectationPressure;
        faction.mood = clamp(Math.round(faction.mood * 0.82 + boardTrust * 0.18 - agenda * (faction.influence / 70)), 0, 100);
      });
      return club.board;
    },

    createDecisionIfNeeded(state) {
      const club = ensureClubRecord(state, state.userClub || state.teams.find((team) => team.id === state.userTeamId));
      const avgMood = Math.round(FMG.average(club.board.politics.map((faction) => faction.mood)));
      if (avgMood < 38 && state.currentWeek % 3 === 0 && FMG.createNarrativeDecision) {
        return FMG.createNarrativeDecision(state, "budget");
      }
      return null;
    }
  };

  const FootballPoliticsController = {
    update(state) {
      const eco = state.managerEcosystem;
      const userClub = eco.clubs[state.userTeamId];
      if (!userClub) return null;
      const strongestFaction = [...userClub.board.politics].sort((a, b) => b.influence - a.influence)[0];
      eco.politics.currentPressure = {
        faction: strongestFaction.name,
        mood: strongestFaction.mood,
        topic: strongestFaction.name === "Finanzas" ? "control presupuestario" : strongestFaction.name === "Area deportiva" ? "coherencia deportiva" : "resultados"
      };
      return eco.politics.currentPressure;
    }
  };

  const SquadRelationshipController = {
    ensurePlayer(state, player) {
      const squad = state.managerEcosystem.squad;
      squad.players[player.id] = squad.players[player.id] || {
        ego: clamp(30 + Math.round((player.overall || 60) * 0.55) + (player.squadRole === "key" ? 12 : 0), 20, 96),
        loyalty: 46 + (hashText(`${player.id}-loyalty`) % 42),
        pressureHandling: 38 + (hashText(`${player.id}-pressure`) % 48),
        promises: [],
        relationships: {},
        mentorId: null
      };
      return squad.players[player.id];
    },

    update(state) {
      const squadState = state.managerEcosystem.squad;
      const players = teamPlayers(state, state.userTeamId);
      const leaders = [...players]
        .sort((a, b) => (b.leadership || b.overall || 0) - (a.leadership || a.overall || 0))
        .slice(0, 4);
      squadState.hierarchy = leaders.map((player, index) => ({
        playerId: player.id,
        name: player.name,
        role: index === 0 ? "capitan emocional" : index === 1 ? "lider silencioso" : "referente",
        influence: clamp((player.leadership || player.overall || 60) + (player.squadRole === "key" ? 8 : 0), 20, 98)
      }));
      players.forEach((player) => {
        const record = this.ensurePlayer(state, player);
        const morale = Number(player.morale || 50);
        const happiness = Number(player.happiness || 50);
        const rolePressure = player.squadRole === "key" && morale < 55 ? 8 : 0;
        record.ego = clamp(Math.round(record.ego * 0.96 + (player.overall || 60) * 0.04 + rolePressure), 10, 100);
        record.loyalty = clamp(Math.round(record.loyalty * 0.94 + happiness * 0.06), 0, 100);
      });
      const atmosphere = players.length
        ? Math.round(FMG.average(players.map((player) => (player.morale || 50) * 0.48 + (player.happiness || 50) * 0.42 + (this.ensurePlayer(state, player).loyalty || 50) * 0.1)))
        : 50;
      squadState.dressingRoom = {
        atmosphere,
        leadership: Math.round(FMG.average(squadState.hierarchy.map((item) => item.influence)) || 50),
        conflictRisk: clamp(Math.round(100 - atmosphere + FMG.average(players.map((player) => this.ensurePlayer(state, player).ego)) * 0.18), 0, 100)
      };
      this.assignMentors(state, players);
      return squadState.dressingRoom;
    },

    assignMentors(state, players) {
      const veterans = players.filter((player) => player.age >= 28).sort((a, b) => (b.leadership || b.overall) - (a.leadership || a.overall));
      const youngsters = players.filter((player) => player.age <= 22);
      youngsters.slice(0, 5).forEach((player, index) => {
        const mentor = veterans[index % Math.max(1, veterans.length)];
        if (mentor) this.ensurePlayer(state, player).mentorId = mentor.id;
      });
    },

    addPromise(state, playerId, promise) {
      const player = state.players.find((item) => item.id === playerId);
      if (!player) return null;
      const record = this.ensurePlayer(state, player);
      const entry = {
        id: deterministicId("promise", [state.seasonNumber, state.currentWeek, playerId, promise]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        text: promise,
        status: "active"
      };
      boundedPush(record.promises, entry, 5);
      return entry;
    }
  };

  const ManagerPersonalityController = {
    ensure(state) {
      const eco = state.managerEcosystem;
      eco.manager.personality = eco.manager.personality || {
        temperament: state.managerProfile?.style || "balanced",
        ambition: 58,
        discipline: 55,
        empathy: 55,
        mediaTone: 52
      };
      eco.manager.pressure = Number.isFinite(eco.manager.pressure) ? eco.manager.pressure : 38;
      eco.manager.burnout = Number.isFinite(eco.manager.burnout) ? eco.manager.burnout : 18;
      eco.manager.mediaReputation = Number.isFinite(eco.manager.mediaReputation) ? eco.manager.mediaReputation : 50;
      eco.manager.legacy = eco.manager.legacy || { seasons: 0, clubs: [], storyFlags: [] };
    },

    update(state) {
      const eco = state.managerEcosystem;
      const relations = state.career?.relations || {};
      const boardTrust = state.finances?.boardTrust || 50;
      const dressing = eco.squad.dressingRoom?.atmosphere || 50;
      eco.manager.pressure = clamp(Math.round(100 - boardTrust * 0.35 - (relations.fans || 50) * 0.25 - dressing * 0.2 + (state.seasonComplete ? -10 : 0)), 0, 100);
      eco.manager.burnout = clamp(Math.round(eco.manager.burnout * 0.9 + eco.manager.pressure * 0.08 + (state.liveMatch ? 3 : 0)), 0, 100);
      eco.manager.mediaReputation = clamp(Math.round(eco.manager.mediaReputation * 0.92 + (relations.press || 50) * 0.08), 0, 100);
      return eco.manager;
    }
  };

  const MediaController = {
    ensure(state) {
      const eco = state.managerEcosystem;
      if (!eco.media.journalists.length) {
        eco.media.journalists = ["Valentina Rojas", "Marco Fuentes", "Claudio Herrera", "Paula Medina"].map((name, index) => ({
          id: `jour-${index + 1}`,
          name,
          agenda: ["tactica", "mercado", "vestuario", "finanzas"][index],
          relationship: 45 + index * 5,
          heat: 48 + index * 7
        }));
      }
      eco.media.rumors = eco.media.rumors || [];
      eco.media.pressConferences = eco.media.pressConferences || [];
    },

    weekly(state) {
      const eco = state.managerEcosystem;
      const journalist = pickByHash(eco.media.journalists, `${state.currentWeek}-${state.seasonNumber}-journalist`);
      const pressure = eco.manager.pressure || 40;
      const topic = pressure > 68 ? "presion del cargo" : state.market?.windowOpen ? "mercado" : "identidad de juego";
      const conference = {
        id: deterministicId("pc", [state.seasonNumber, state.currentWeek, journalist.id, topic]),
        week: state.currentWeek,
        journalistId: journalist.id,
        journalistName: journalist.name,
        topic,
        tone: pressure > 70 ? "duro" : pressure > 48 ? "incisivo" : "constructivo",
        resolved: false
      };
      if (state.currentWeek % 2 === 0) boundedUpsert(eco.media.pressConferences, conference, 12);
      this.createRumor(state);
      return conference;
    },

    createRumor(state) {
      const eco = state.managerEcosystem;
      const players = teamPlayers(state, state.userTeamId)
        .filter((player) => !String(player.id).startsWith("youth-"))
        .sort((a, b) => (b.overall || 0) - (a.overall || 0));
      const player = pickByHash(players, `${state.currentWeek}-${state.seasonNumber}-rumor`);
      if (!player) return null;
      const rumor = {
        id: deterministicId("rumor", [state.seasonNumber, state.currentWeek, player.id, "media"]),
        week: state.currentWeek,
        playerId: player.id,
        playerName: player.name,
        topic: player.happiness < 45 ? "malestar contractual" : player.overall >= 75 ? "interes externo" : "seguimiento de mercado",
        credibility: clamp(35 + (hashText(`${player.id}-${state.currentWeek}`) % 48), 25, 86)
      };
      if (state.currentWeek % 3 === 0) {
        boundedUpsert(eco.media.rumors, rumor, 16);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "rumor",
            title: `Pasillo: ${player.name} genera comentarios`,
            body: `${player.name} queda asociado a ${rumor.topic}. Credibilidad interna: ${rumor.credibility}/100.`,
            tags: ["ecosistema", "rumor"],
            importance: rumor.credibility,
            entities: { playerId: player.id, teamId: state.userTeamId },
            dedupeKey: `eco-rumor-${state.seasonNumber}-${state.currentWeek}-${player.id}`
          });
        }
      }
      return rumor;
    }
  };

  const ScoutingController = {
    ensure(state) {
      const eco = state.managerEcosystem;
      if (!Array.isArray(eco.scouting.networks) || eco.scouting.networks.length === 0) eco.scouting.networks = [
        { id: "local", name: "Red local", region: state.userClub?.city || "Local", depth: 52 },
        { id: "national", name: "Red nacional", region: "Chile", depth: 46 },
        { id: "continental", name: "Radar continental", region: "Sudamerica", depth: 34 }
      ];
      eco.scouting.shortlist = eco.scouting.shortlist || [];
      eco.scouting.reports = eco.scouting.reports || [];
    },

    weekly(state) {
      const eco = state.managerEcosystem;
      if (state.currentWeek % 2 !== 0) return null;
      const pool = (state.players || [])
        .filter((player) => player.teamId !== state.userTeamId && !player.retired)
        .sort((a, b) => (b.potential || b.overall) - (a.potential || a.overall));
      const player = pickByHash(pool.slice(0, 30), `${state.seasonNumber}-${state.currentWeek}-scout`);
      if (!player) return null;
      const report = {
        id: deterministicId("scout", [state.seasonNumber, state.currentWeek, player.id]),
        week: state.currentWeek,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        fit: clamp(38 + (player.potential || player.overall) - 55 + (hashText(player.id) % 20), 20, 96),
        risk: clamp(100 - (player.morale || 60) + (player.age > 30 ? 12 : 0), 8, 92),
        note: player.age <= 21 ? "proyecto de academia rival" : player.overall >= 75 ? "impacto inmediato" : "profundidad de plantilla"
      };
      boundedUpsert(eco.scouting.reports, report, 18);
      eco.scouting.shortlist = [report, ...eco.scouting.shortlist.filter((item) => item.playerId !== report.playerId)].slice(0, 12);
      return report;
    }
  };

  const YouthDevelopmentController = {
    ensure(state) {
      state.managerEcosystem.youth = state.managerEcosystem.youth || { generated: [], intakeHistory: [] };
    },

    weekly(state) {
      const eco = state.managerEcosystem;
      const club = ensureClubRecord(state, state.userClub || state.teams.find((team) => team.id === state.userTeamId));
      if (state.currentWeek % 6 !== 0) return [];
      const prospects = [];
      const count = club.academy.level >= 70 ? 2 : 1;
      for (let index = 0; index < count; index += 1) {
        const seed = hashText(`${state.seasonNumber}-${state.currentWeek}-${state.userTeamId}-${index}`);
        const position = pickByHash(["DEF", "MED", "EXT", "DEL", "POR"], `${seed}-pos`);
        const first = pickByHash(["Tomas", "Ignacio", "Martin", "Vicente", "Bruno", "Matias"], `${seed}-first`);
        const last = pickByHash(["Araya", "Molina", "Tapia", "Rojas", "Fuentes", "Cortes"], `${seed}-last`);
        const player = {
          id: `youth-${state.userTeamId}-${state.seasonNumber}-${state.currentWeek}-${index}`,
          name: `${first} ${last}`,
          teamId: state.userTeamId,
          position,
          age: 16 + (seed % 3),
          overall: 48 + (seed % 12),
          potential: 66 + ((seed >>> 5) % 24),
          morale: 70,
          energy: 88,
          value: 500000 + (seed % 900000),
          salary: 90000 + (seed % 120000),
          contractYears: 2,
          personality: pickByHash(["Ambicioso", "Leal", "Profesional", "Volatil"], `${seed}-personality`),
          seasonStats: { appearances: 0, goals: 0, assists: 0, minutes: 0, shots: 0, cards: 0 }
        };
        if (!state.players.some((item) => item.id === player.id)) {
          state.players.push(player);
          prospects.push(player);
          boundedPush(club.academy.prospects, { playerId: player.id, name: player.name, potential: player.potential, week: state.currentWeek }, 12);
          boundedPush(eco.youth.generated, { playerId: player.id, name: player.name, teamId: state.userTeamId, seasonNumber: state.seasonNumber }, 40);
        }
      }
      if (prospects.length) {
        boundedPush(eco.youth.intakeHistory, { week: state.currentWeek, seasonNumber: state.seasonNumber, count: prospects.length }, 12);
        FMG.pushNotification?.(`Cantera: ${prospects.length} juvenil(es) promovido(s).`, "success");
      }
      return prospects;
    }
  };

  function ensureManagerEcosystemState(state) {
    state.managerEcosystem = state.managerEcosystem || {};
    const eco = state.managerEcosystem;
    eco.version = 1;
    eco.clubs = eco.clubs || {};
    eco.culture = eco.culture || {};
    eco.politics = eco.politics || {};
    eco.media = eco.media || { journalists: [], rumors: [], pressConferences: [] };
    eco.scouting = eco.scouting || { networks: [], reports: [], shortlist: [] };
    eco.squad = eco.squad || { players: {}, hierarchy: [], dressingRoom: { atmosphere: 55, leadership: 50, conflictRisk: 35 } };
    eco.youth = eco.youth || { generated: [], intakeHistory: [] };
    eco.manager = eco.manager || {};
    eco.worldMemory = eco.worldMemory || { events: [], rivalries: [] };

    FootballCultureController.ensure(state);
    ManagerPersonalityController.ensure(state);
    MediaController.ensure(state);
    ScoutingController.ensure(state);
    YouthDevelopmentController.ensure(state);
    (state.teams || []).forEach((team) => ensureClubRecord(state, team));
    SquadRelationshipController.update(state);
    FootballPoliticsController.update(state);
    return eco;
  }

  function runManagerEcosystemWeek(state, options = {}) {
    const eco = ensureManagerEcosystemState(state);
    FootballCultureController.evolve(state);
    const relevant = (state.teams || []).filter((team) => team.id === state.userTeamId || teamStanding(state, team.id).position <= 5);
    relevant.forEach((team) => {
      BoardDecisionController.update(state, team);
      DynamicReputationController.updateClub(state, team);
    });
    DynamicReputationController.updateLeague(state);
    SquadRelationshipController.update(state);
    ManagerPersonalityController.update(state);
    FootballPoliticsController.update(state);
    const conference = MediaController.weekly(state);
    const report = ScoutingController.weekly(state);
    const youth = YouthDevelopmentController.weekly(state);
    BoardDecisionController.createDecisionIfNeeded(state);
    boundedUpsert(eco.worldMemory.events, {
      id: deterministicId("eco-week", [state.seasonNumber, state.currentWeek, options.phase || "weekly"]),
      week: state.currentWeek,
      seasonNumber: state.seasonNumber,
      type: "ecosystem-week",
      managerPressure: eco.manager.pressure,
      dressingRoom: eco.squad.dressingRoom.atmosphere,
      reportId: report?.id || null,
      conferenceId: conference?.id || null,
      youthCount: youth.length,
      phase: options.phase || "weekly"
    }, 80);
    return { conference, report, youth };
  }

  function enrichNegotiation(state, negotiation, player) {
    ensureManagerEcosystemState(state);
    if (!negotiation || !player) return negotiation;
    const agentSeed = hashText(`${player.id}-agent`);
    negotiation.agent = negotiation.agent || {
      name: pickByHash(["Sergio Lagos", "Andres Vidal", "Camila Pizarro", "Ruben Salinas"], `${player.id}-agent-name`),
      style: pickByHash(["duro", "pragmatico", "relacional", "mediatico"], `${player.id}-agent-style`),
      patience: 42 + (agentSeed % 42)
    };
    negotiation.promises = negotiation.promises || [
      player.overall >= 75 ? "rol importante" : "plan de desarrollo",
      negotiation.type === "loan" ? "minutos regulares" : "proyecto deportivo"
    ];
    return negotiation;
  }

  function evaluateNegotiationContext(state, negotiation, player) {
    ensureManagerEcosystemState(state);
    if (!negotiation || !player) return { wageMultiplier: 1, feeMultiplier: 1, message: "" };
    const eco = state.managerEcosystem;
    const mediaHeat = eco.manager.mediaReputation < 40 ? 1.04 : 1;
    const pressureTax = eco.manager.pressure > 72 ? 1.05 : 1;
    const agentStyle = negotiation.agent?.style;
    const agentTax = agentStyle === "duro" ? 1.07 : agentStyle === "relacional" ? 0.97 : 1;
    return {
      wageMultiplier: mediaHeat * pressureTax * agentTax,
      feeMultiplier: agentStyle === "pragmatico" ? 0.98 : agentStyle === "mediatico" ? 1.04 : 1,
      message: `Agente ${negotiation.agent?.name || "sin identificar"} (${agentStyle || "normal"}) evalua proyecto, promesas y presion del club.`
    };
  }

  FMG.ManagerEcosystem = {
    ensure: ensureManagerEcosystemState,
    runWeek: runManagerEcosystemWeek,
    enrichNegotiation,
    evaluateNegotiationContext,
    ClubIdentityController: { ensureClubRecord },
    BoardDecisionController,
    MediaController,
    ScoutingController,
    FootballPoliticsController,
    SquadRelationshipController,
    FootballCultureController,
    DynamicReputationController,
    YouthDevelopmentController,
    ManagerPersonalityController
  };

  FMG.ensureManagerEcosystemState = ensureManagerEcosystemState;
  FMG.runManagerEcosystemWeek = runManagerEcosystemWeek;
})();
