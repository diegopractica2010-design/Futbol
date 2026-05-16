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

  function deterministicId(prefix, parts) {
    return `${prefix}-${hashText(parts.join("|")).toString(36)}`;
  }

  function pickByHash(list, seed) {
    return list.length ? list[hashText(seed) % list.length] : null;
  }

  function boundedPush(list, item, limit) {
    list.unshift(item);
    list.length = Math.min(list.length, limit);
    return item;
  }

  function boundedUpsert(list, item, limit) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list.splice(index, 1);
    return boundedPush(list, item, limit);
  }

  function team(state, teamId) {
    return (state.teams || []).find((item) => item.id === teamId) || null;
  }

  function standing(state, teamId) {
    const position = (state.standings || []).findIndex((entry) => entry.teamId === teamId) + 1;
    return {
      position: position || (state.teams || []).length,
      entry: (state.standings || []).find((item) => item.teamId === teamId) || null
    };
  }

  function resultGoals(result, teamId) {
    const home = result.homeTeamId === teamId;
    return {
      scored: home ? result.homeGoals : result.awayGoals,
      conceded: home ? result.awayGoals : result.homeGoals
    };
  }

  function ensureClubWorldRecord(state, teamId) {
    state.managerEcosystem = state.managerEcosystem || {};
    state.managerEcosystem.worldMedia = state.managerEcosystem.worldMedia || {};
    const world = state.managerEcosystem.worldMedia;
    world.clubs = world.clubs || {};
    const club = team(state, teamId) || state.userClub || { id: teamId, name: "Club" };
    const ecoClub = state.managerEcosystem?.clubs?.[teamId] || {};
    const seed = hashText(`${teamId}-${club.name}`);
    world.clubs[teamId] = world.clubs[teamId] || {
      teamId,
      fanIdentity: pickByHash(["exigente", "popular", "canterana", "copera", "barrial"], `${teamId}-fan-identity`),
      emotionalMemory: [],
      narratives: [],
      pressure: clamp((ecoClub.fans?.expectation || 52) - 8 + (seed % 16), 20, 96),
      socialPopularity: clamp(Math.round((club.fanBase || 180000) / 9500), 20, 100),
      tacticalReputation: ecoClub.philosophy?.tactical || club.style || "Balanced",
      reputationMomentum: 0,
      mythology: []
    };
    return world.clubs[teamId];
  }

  function ensureFootballWorldMediaState(state) {
    FMG.ensureWorldNews?.(state);
    FMG.ensureManagerEcosystemState?.(state);
    const eco = state.managerEcosystem || {};
    eco.worldMedia = eco.worldMedia || {};
    const world = eco.worldMedia;
    world.version = 1;
    world.media = world.media || {};
    world.media.pressure = Number.isFinite(world.media.pressure) ? world.media.pressure : 42;
    world.media.obsession = world.media.obsession || {};
    world.media.headlineMemory = world.media.headlineMemory || [];
    world.media.pundits = world.media.pundits || [];
    world.media.debates = world.media.debates || [];
    world.media.controversies = world.media.controversies || [];
    world.media.reactions = world.media.reactions || [];
    world.fans = world.fans || { pressure: 45, expectations: [], atmosphere: "expectante" };
    world.sponsors = world.sponsors || { relationship: 55, pressure: 38, concerns: [], history: [] };
    world.reputation = world.reputation || { leaguePrestige: 54, countryReputation: 52, momentum: 0, tacticalReputation: "en observacion" };
    world.narratives = world.narratives || { active: [], manager: [], club: [], storylines: [] };
    world.history = world.history || { events: [], rivalries: [], myths: [] };
    world.clubs = world.clubs || {};
    world.eventQueue = world.eventQueue || [];
    (state.teams || []).forEach((item) => ensureClubWorldRecord(state, item.id));
    return world;
  }

  const FootballMediaController = {
    ensure(state) {
      const world = ensureFootballWorldMediaState(state);
      if (!world.media.pundits.length) {
        world.media.pundits = ["Javiera Campos", "Hector Mena", "Raimundo Soto", "Isabel Norambuena"].map((name, index) => ({
          id: `pundit-${index + 1}`,
          name,
          personality: ["analitica", "incendiario", "romantico", "pragmatica"][index],
          agenda: ["tactica", "presion", "identidad", "finanzas"][index],
          trust: 42 + index * 7,
          heat: 48 + index * 9
        }));
      }
      return world.media;
    },

    updatePressure(state) {
      const world = ensureFootballWorldMediaState(state);
      const eco = state.managerEcosystem || {};
      const managerPressure = eco.manager?.pressure || 40;
      const fanPressure = world.fans.pressure || 45;
      const controversyHeat = (world.media.controversies[0]?.heat || 0) * 0.18;
      world.media.pressure = clamp(Math.round(world.media.pressure * 0.72 + managerPressure * 0.16 + fanPressure * 0.12 + controversyHeat), 0, 100);
      world.media.obsession[state.userTeamId] = clamp(Math.round((world.media.obsession[state.userTeamId] || 35) * 0.8 + world.media.pressure * 0.2), 0, 100);
      return world.media.pressure;
    },

    generateHeadline(state, context = {}) {
      const world = ensureFootballWorldMediaState(state);
      const club = state.userClub || team(state, state.userTeamId);
      if (!club) return null;
      const pressure = world.media.pressure || 40;
      const topic = context.topic || (pressure > 72 ? "presion" : world.fans.pressure > 68 ? "hinchada" : state.market?.windowOpen ? "mercado" : "identidad");
      const pundit = pickByHash(world.media.pundits, `${state.seasonNumber}-${state.currentWeek}-${topic}`);
      const templates = {
        presion: [`${club.name} queda bajo lupa total`, `La semana que puede cambiar el clima en ${club.name}`],
        hinchada: [`La hinchada eleva el tono en ${club.name}`, `${club.name} y una tribuna que ya pide senales`],
        mercado: [`Mercado, rumores y urgencias alrededor de ${club.name}`, `${club.name} mide su pulso en la ventana`],
        identidad: [`El debate sobre la identidad de ${club.name} no se apaga`, `${club.name} busca que su idea convenza al entorno`]
      };
      const title = pickByHash(templates[topic] || templates.identidad, `${state.currentWeek}-${topic}-title`);
      const body = `${pundit?.name || "La mesa de analisis"} instala el eje ${topic}: presion mediatica ${pressure}/100, expectativa fan ${world.fans.pressure}/100 y reputacion tactica ${world.reputation.tacticalReputation}.`;
      const item = {
        id: deterministicId("headline", [state.seasonNumber, state.currentWeek, topic]),
        type: "world-reaction",
        title,
        body,
        topic,
        punditId: pundit?.id || null,
        pressure,
        tags: ["mundo-vivo", "prensa", topic],
        importance: clamp(48 + Math.round(pressure * 0.42), 45, 92),
        dedupeKey: `world-headline-${state.seasonNumber}-${state.currentWeek}-${topic}`
      };
      boundedUpsert(world.media.headlineMemory, item, 32);
      FMG.addNewsItem?.(state, item);
      return item;
    },

    createDebate(state, reason) {
      const world = ensureFootballWorldMediaState(state);
      const pundit = pickByHash(world.media.pundits, `${state.currentWeek}-${reason}-debate`);
      const debate = {
        id: deterministicId("debate", [state.seasonNumber, state.currentWeek, reason]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        topic: reason,
        punditName: pundit?.name || "Panel central",
        polarity: clamp(35 + (hashText(`${reason}-${state.userTeamId}`) % 58), 20, 94),
        pressureDelta: reason === "racha negativa" ? 9 : reason === "clasico" ? 7 : 4
      };
      boundedUpsert(world.media.debates, debate, 18);
      return debate;
    }
  };

  const FanPressureController = {
    update(state, context = {}) {
      const world = ensureFootballWorldMediaState(state);
      const clubRecord = ensureClubWorldRecord(state, state.userTeamId);
      const relations = state.career?.relations || {};
      const position = standing(state, state.userTeamId).position;
      const clubEco = state.managerEcosystem?.clubs?.[state.userTeamId] || {};
      const expectation = clubEco.fans?.expectation || 55;
      const tableStress = position > 8 ? 12 : position > 5 ? 6 : -4;
      const resultStress = context.result === "loss" ? 10 : context.result === "win" ? -7 : 2;
      world.fans.pressure = clamp(Math.round((world.fans.pressure || 45) * 0.68 + expectation * 0.16 + (100 - (relations.fans || 50)) * 0.1 + tableStress + resultStress), 0, 100);
      world.fans.atmosphere = world.fans.pressure > 75 ? "tensa" : world.fans.pressure > 55 ? "impaciente" : world.fans.pressure < 34 ? "ilusionada" : "expectante";
      clubRecord.pressure = world.fans.pressure;
      clubRecord.socialPopularity = clamp(Math.round(clubRecord.socialPopularity + (context.result === "win" ? 1 : context.result === "loss" ? -1 : 0)), 10, 100);
      const expectationEntry = {
        id: deterministicId("fan-exp", [state.seasonNumber, state.currentWeek, state.userTeamId]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        clubId: state.userTeamId,
        expectation,
        pressure: world.fans.pressure,
        atmosphere: world.fans.atmosphere
      };
      boundedUpsert(world.fans.expectations, expectationEntry, 24);
      return expectationEntry;
    },

    reactToMatch(state, result) {
      const goals = resultGoals(result, state.userTeamId);
      const outcome = goals.scored > goals.conceded ? "win" : goals.scored < goals.conceded ? "loss" : "draw";
      const reaction = this.update(state, { result: outcome });
      const title = outcome === "win" ? "La tribuna recupera aire" : outcome === "loss" ? "La tribuna exige respuestas" : "La tribuna queda dividida";
      return FMG.FootballWorldMedia.WorldReactionManager.record(state, {
        id: deterministicId("fan-react", [state.seasonNumber, result.week || state.currentWeek, state.userTeamId, outcome]),
        type: "fan-reaction",
        title,
        detail: `${state.userClub?.name || "El club"} queda con presion fan ${reaction.pressure}/100 y atmosfera ${reaction.atmosphere}.`,
        intensity: reaction.pressure,
        entities: { teamId: state.userTeamId }
      });
    }
  };

  const FootballReputationEngine = {
    update(state) {
      const world = ensureFootballWorldMediaState(state);
      const eco = state.managerEcosystem || {};
      const leagueRep = eco.culture?.league?.reputation || world.reputation.leaguePrestige || 54;
      const userClub = eco.clubs?.[state.userTeamId] || {};
      const clubMomentum = (userClub.reputation || 50) - 50;
      const mediaPenalty = world.media.pressure > 75 ? -2 : world.media.pressure < 38 ? 1 : 0;
      world.reputation.momentum = clamp(Math.round(world.reputation.momentum * 0.78 + clubMomentum * 0.08 + mediaPenalty), -30, 30);
      world.reputation.leaguePrestige = clamp(Math.round(world.reputation.leaguePrestige * 0.94 + leagueRep * 0.06 + Math.max(0, world.reputation.momentum) * 0.04), 30, 95);
      world.reputation.countryReputation = clamp(Math.round(world.reputation.countryReputation * 0.96 + world.reputation.leaguePrestige * 0.04), 30, 92);
      world.reputation.tacticalReputation = userClub.philosophy?.tactical || state.userClub?.style || "en observacion";
      ensureClubWorldRecord(state, state.userTeamId).reputationMomentum = world.reputation.momentum;
      return world.reputation;
    }
  };

  const SponsorRelationshipController = {
    update(state) {
      const world = ensureFootballWorldMediaState(state);
      const finances = state.finances || {};
      const ffp = finances.financialFairPlay?.status || "ok";
      const pressureHit = ffp === "critical" ? 16 : ffp === "warning" ? 8 : 0;
      const mediaHit = world.media.pressure > 72 ? 5 : 0;
      const sponsorValue = finances.sponsorDeal?.weeklyAmount || 0;
      world.sponsors.pressure = clamp(Math.round(world.sponsors.pressure * 0.74 + pressureHit + mediaHit + (sponsorValue ? 4 : 0)), 0, 100);
      world.sponsors.relationship = clamp(Math.round(world.sponsors.relationship * 0.84 + (100 - world.sponsors.pressure) * 0.16), 0, 100);
      const concern = {
        id: deterministicId("sponsor", [state.seasonNumber, state.currentWeek, ffp, world.media.pressure]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        status: ffp,
        pressure: world.sponsors.pressure,
        relationship: world.sponsors.relationship,
        topic: ffp !== "ok" ? "disciplina financiera" : world.media.pressure > 72 ? "exposicion mediatica" : "valor de marca"
      };
      boundedUpsert(world.sponsors.history, concern, 20);
      if (concern.pressure > 70) boundedUpsert(world.sponsors.concerns, concern, 8);
      return concern;
    }
  };

  const FootballHistoryTracker = {
    remember(state, event) {
      const world = ensureFootballWorldMediaState(state);
      const entry = {
        id: event.id || deterministicId("history", [state.seasonNumber, state.currentWeek, event.type, event.title]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        type: event.type || "world",
        title: event.title,
        detail: event.detail || "",
        intensity: event.intensity || 50,
        entities: event.entities || {}
      };
      boundedUpsert(world.history.events, entry, 80);
      const clubId = entry.entities.teamId || state.userTeamId;
      const clubRecord = ensureClubWorldRecord(state, clubId);
      boundedUpsert(clubRecord.emotionalMemory, entry, 20);
      if (entry.intensity >= 88) {
        boundedUpsert(world.history.myths, {
          id: deterministicId("myth", [entry.id, clubId]),
          week: state.currentWeek,
          seasonNumber: state.seasonNumber,
          title: entry.title,
          originEventId: entry.id,
          weight: entry.intensity
        }, 12);
      }
      return entry;
    },

    escalateRivalry(state, result) {
      const rivalry = FMG.getRivalry?.(result.homeTeamId, result.awayTeamId);
      if (!rivalry) return null;
      const world = ensureFootballWorldMediaState(state);
      const margin = Math.abs(result.homeGoals - result.awayGoals);
      const redCards = (result.cards || []).filter((card) => card.color === "red").length;
      const intensity = clamp(rivalry.intensity + margin * 3 + redCards * 5, 40, 100);
      const entry = {
        id: deterministicId("rivalry", [state.seasonNumber, result.week || state.currentWeek, rivalry.name, result.homeGoals, result.awayGoals]),
        week: result.week || state.currentWeek,
        seasonNumber: state.seasonNumber,
        name: rivalry.name,
        teams: rivalry.teams,
        intensity,
        lastScore: `${result.homeGoals}-${result.awayGoals}`,
        impact: intensity > 90 ? "mito competitivo" : intensity > 78 ? "tension sostenida" : "memoria reciente"
      };
      boundedUpsert(world.history.rivalries, entry, 20);
      this.remember(state, {
        id: entry.id,
        type: "rivalry",
        title: `${rivalry.name} escala a ${entry.impact}`,
        detail: `Marcador ${entry.lastScore}; intensidad historica ${intensity}/100.`,
        intensity,
        entities: { homeTeamId: result.homeTeamId, awayTeamId: result.awayTeamId }
      });
      return entry;
    }
  };

  const WorldReactionManager = {
    record(state, reaction) {
      const world = ensureFootballWorldMediaState(state);
      const entry = {
        id: reaction.id || deterministicId("reaction", [state.seasonNumber, state.currentWeek, reaction.type, reaction.title]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        type: reaction.type || "reaction",
        title: reaction.title,
        detail: reaction.detail,
        intensity: clamp(reaction.intensity || 50, 0, 100),
        entities: reaction.entities || {}
      };
      boundedUpsert(world.media.reactions, entry, 28);
      FootballHistoryTracker.remember(state, entry);
      return entry;
    },

    weekly(state) {
      const world = ensureFootballWorldMediaState(state);
      const pressure = world.media.pressure;
      const standingPos = standing(state, state.userTeamId).position;
      const title = pressure > 74
        ? "El entorno instala una semana de alta presion"
        : standingPos <= 3
          ? "El mundo futbolero mira al proyecto como candidato"
          : "El campeonato mantiene abierta la conversacion";
      return this.record(state, {
        id: deterministicId("weekly-reaction", [state.seasonNumber, state.currentWeek, pressure, standingPos]),
        type: "world-reaction",
        title,
        detail: `Semana ${state.currentWeek}: posicion ${standingPos}, presion media ${pressure}/100 y prestigio liga ${world.reputation.leaguePrestige}/100.`,
        intensity: pressure,
        entities: { teamId: state.userTeamId }
      });
    }
  };

  const FootballNarrativeEngine = {
    update(state) {
      const world = ensureFootballWorldMediaState(state);
      const pressure = world.media.pressure;
      const fanPressure = world.fans.pressure;
      const sponsorPressure = world.sponsors.pressure;
      const topic = pressure > 75 ? "manager bajo lupa" : fanPressure > 70 ? "tribuna impaciente" : sponsorPressure > 65 ? "marca en alerta" : "proyecto en construccion";
      const storyline = {
        id: deterministicId("storyline", [state.seasonNumber, state.currentWeek, topic]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        topic,
        arc: pressure > 75 ? "crisis" : fanPressure < 38 ? "ilusion" : "continuidad",
        heat: clamp(Math.round(pressure * 0.5 + fanPressure * 0.32 + sponsorPressure * 0.18), 0, 100)
      };
      boundedUpsert(world.narratives.storylines, storyline, 24);
      boundedUpsert(world.narratives.manager, {
        id: deterministicId("manager-narrative", [state.seasonNumber, state.currentWeek, topic]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        managerName: state.managerProfile?.name || "Manager",
        label: topic,
        pressure,
        mediaReputation: state.managerEcosystem?.manager?.mediaReputation || 50
      }, 28);
      const clubRecord = ensureClubWorldRecord(state, state.userTeamId);
      boundedUpsert(clubRecord.narratives, storyline, 16);
      world.narratives.active = world.narratives.storylines.filter((item) => item.heat >= 55).slice(0, 6);
      return storyline;
    }
  };

  const ProceduralFootballEventGenerator = {
    weekly(state) {
      const world = ensureFootballWorldMediaState(state);
      const candidates = [
        { topic: "presion", condition: world.media.pressure > 70 },
        { topic: "sponsors", condition: world.sponsors.pressure > 68 },
        { topic: "hinchas", condition: world.fans.pressure > 68 },
        { topic: "prestigio", condition: world.reputation.momentum > 8 },
        { topic: "debate tactico", condition: true }
      ];
      const viable = candidates.filter((item) => item.condition);
      const selected = pickByHash(viable, `${state.seasonNumber}-${state.currentWeek}-event`) || candidates[candidates.length - 1];
      const event = {
        id: deterministicId("world-event", [state.seasonNumber, state.currentWeek, selected.topic]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        topic: selected.topic,
        title: selected.topic === "sponsors" ? "Los patrocinadores piden estabilidad" : selected.topic === "hinchas" ? "La calle futbolera sube el volumen" : selected.topic === "prestigio" ? "La liga gana conversacion externa" : "El panel abre un debate tactico",
        intensity: selected.topic === "debate tactico" ? 52 : clamp(world.media.pressure + 8, 40, 96)
      };
      boundedUpsert(world.eventQueue, event, 16);
      if (event.intensity >= 65) FootballMediaController.createDebate(state, selected.topic);
      return event;
    }
  };

  function runFootballWorldMediaWeek(state, options = {}) {
    const world = ensureFootballWorldMediaState(state);
    FootballMediaController.ensure(state);
    FanPressureController.update(state, options);
    FootballMediaController.updatePressure(state);
    SponsorRelationshipController.update(state);
    FootballReputationEngine.update(state);
    const event = ProceduralFootballEventGenerator.weekly(state);
    const storyline = FootballNarrativeEngine.update(state);
    const reaction = WorldReactionManager.weekly(state);
    const headline = FootballMediaController.generateHeadline(state, { topic: event.topic === "debate tactico" ? "identidad" : event.topic });
    boundedUpsert(world.history.events, {
      id: deterministicId("world-week", [state.seasonNumber, state.currentWeek, options.phase || "weekly"]),
      week: state.currentWeek,
      seasonNumber: state.seasonNumber,
      type: "world-week",
      title: "Pulso semanal del mundo futbolero",
      detail: `Evento ${event.topic}; narrativa ${storyline.topic}; reaccion ${reaction.title}.`,
      intensity: clamp(Math.round((world.media.pressure + world.fans.pressure) / 2), 0, 100)
    }, 80);
    return { event, storyline, reaction, headline };
  }

  function handlePostMatchWorldReaction(state, result) {
    if (!result || (result.homeTeamId !== state.userTeamId && result.awayTeamId !== state.userTeamId)) {
      FootballHistoryTracker.escalateRivalry(state, result || {});
      return null;
    }
    const fanReaction = FanPressureController.reactToMatch(state, result);
    const rivalry = FootballHistoryTracker.escalateRivalry(state, result);
    FootballMediaController.updatePressure(state);
    const goals = resultGoals(result, state.userTeamId);
    const reason = goals.scored < goals.conceded ? "racha negativa" : rivalry ? "clasico" : "resultado";
    const debate = FootballMediaController.createDebate(state, reason);
    const headline = FootballMediaController.generateHeadline(state, { topic: goals.scored < goals.conceded ? "presion" : rivalry ? "hinchada" : "identidad" });
    FootballNarrativeEngine.update(state);
    SponsorRelationshipController.update(state);
    FootballReputationEngine.update(state);
    return { fanReaction, rivalry, debate, headline };
  }

  const previousRunManagerEcosystemWeek = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options = {}) {
    const result = previousRunManagerEcosystemWeek ? previousRunManagerEcosystemWeek(state, options) : {};
    result.worldMedia = runFootballWorldMediaWeek(state, options);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  const previousGeneratePostMatchNews = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = previousGeneratePostMatchNews ? previousGeneratePostMatchNews(state, result) : [];
    handlePostMatchWorldReaction(state, result);
    return items;
  };

  FMG.FootballWorldMedia = {
    ensure: ensureFootballWorldMediaState,
    runWeek: runFootballWorldMediaWeek,
    reactToMatch: handlePostMatchWorldReaction,
    FootballMediaController,
    FootballNarrativeEngine,
    WorldReactionManager,
    FanPressureController,
    FootballReputationEngine,
    SponsorRelationshipController,
    FootballHistoryTracker,
    ProceduralFootballEventGenerator
  };

  FMG.ensureFootballWorldMediaState = ensureFootballWorldMediaState;
  FMG.runFootballWorldMediaWeek = runFootballWorldMediaWeek;

  const baseEnsureFootballWorldMediaState = ensureFootballWorldMediaState;
  FMG.ensureFootballWorldMediaState = function (state) {
    const world = baseEnsureFootballWorldMediaState(state);
    FootballMediaController.ensure(state);
    return world;
  };
  FMG.FootballWorldMedia.ensure = FMG.ensureFootballWorldMediaState;
})();
