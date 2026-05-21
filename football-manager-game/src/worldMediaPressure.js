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

  function headlinePattern(title) {
    const text = String(title || "").toLowerCase();
    if (text.includes("?")) return "pregunta";
    if (text.includes("!")) return "exclamacion";
    if (text.includes(":")) return "dos-puntos";
    return text.split(/\s+/).slice(0, 3).join(" ");
  }

  function headlineSimilarity(left, right) {
    const a = String(left || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    const b = String(right || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    if (!a.length || !b.length) return 0;
    const shared = a.filter((word) => b.includes(word)).length / Math.max(a.length, b.length);
    return shared + (a[0] === b[0] ? 0.25 : 0) + (headlinePattern(left) === headlinePattern(right) ? 0.22 : 0);
  }

  function chooseMediaHeadline(world, templates, seed) {
    const recent = (world.media?.headlineMemory || []).slice(0, 3).map((item) => item.title);
    for (let offset = 0; offset < templates.length; offset += 1) {
      const title = templates[(seed + offset) % templates.length];
      if (!recent.some((oldTitle) => headlineSimilarity(title, oldTitle) >= 0.62)) return title;
    }
    return templates[seed % templates.length];
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
        presion: [`${club.name} queda bajo lupa total`, `La semana que puede cambiar el clima en ${club.name}`, `¿Responde ${club.name} cuando aprieta la tribuna?`, `El banco de ${club.name} siente el ruido externo`],
        hinchada: [`La hinchada eleva el tono en ${club.name}`, `${club.name} y una tribuna que ya pide senales`, `El tablon se hace escuchar en ${club.name}`, `¿Paciencia o exigencia alrededor de ${club.name}?`],
        mercado: [`Mercado, rumores y urgencias alrededor de ${club.name}`, `${club.name} mide su pulso en la ventana`, `La carpeta de fichajes no descansa en ${club.name}`, `¿Se mueve la dirigencia antes del cierre?`],
        identidad: [`El debate sobre la identidad de ${club.name} no se apaga`, `${club.name} busca que su idea convenza al entorno`, `Una semana para reconocer la mano del entrenador`, `¿Tiene sello este ${club.name}?`],
        sponsors: [`Los auspiciadores miran de cerca a ${club.name}`, `La marca ${club.name} necesita calma`, `¿Puede el club ordenar el ruido comercial?`, `La estabilidad tambien se juega fuera de la cancha`],
        prestigio: [`La liga empieza a mirar distinto a ${club.name}`, `El proyecto gana respeto fuera de casa`, `¿Hay salto de prestigio en camino?`, `${club.name} juega por algo mas que puntos`]
      };
      const title = chooseMediaHeadline(world, templates[topic] || templates.identidad, hashText(`${state.currentWeek}-${topic}-title`));
      const body = `${pundit?.name || "La mesa de analisis"} instala el eje ${topic}: presion de prensa ${pressure}/100, expectativa de hinchas ${world.fans.pressure}/100 y reputacion tactica ${world.reputation.tacticalReputation}.`;
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

// ═══════════════════════════════════════════════════════════════════════════
// WORLD MEDIA PRESSURE — EXTENDED SYSTEMS (Fase 5)
// Scandals, Fan Reactions, Hero/Villain Media, Transfer Fan Reactions
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const hashText = FMG.hashText;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════
  // FAN REACTIONS
  // ═══════════════════════════

  function ensureFanReactions(state) {
    state.fanReactions = state.fanReactions || [];
    return state.fanReactions;
  }

  function addFanReaction(state, reaction) {
    ensureFanReactions(state);
    const id = deterministicId("fan-rx", [reaction.type, state.seasonNumber || 1, state.currentWeek || 1]);
    if (state.fanReactions.some(function (r) { return r.id === id; })) return null;
    const entry = {
      id: id,
      week: state.currentWeek || 1,
      seasonNumber: state.seasonNumber || 1,
      resolved: false,
      type: reaction.type || "general",
      positive: Boolean(reaction.positive),
      title: reaction.title || "",
      body: reaction.body || "",
      icon: reaction.icon || "📣",
      mechanical: reaction.mechanical || ""
    };
    boundedPush(state.fanReactions, entry, 10);
    return entry;
  }

  function applyFanReactionEffect(state, reaction) {
    const eco = state.managerEcosystem || {};
    const world = eco.worldMedia || {};
    if (reaction.positive) {
      if (state.userTeamId) {
        if (!state.clubCulture) state.clubCulture = {};
        if (!state.clubCulture.homeAdvantageModifiers) state.clubCulture.homeAdvantageModifiers = {};
        state.clubCulture.homeAdvantageModifiers[state.userTeamId] = clamp(
          (state.clubCulture.homeAdvantageModifiers[state.userTeamId] || 0) + 2, 0, 15
        );
      }
      world.homeAdvantageDuration = (world.homeAdvantageDuration || 0) + 2;
    } else {
      (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) - 5, 0, 100);
      });
      if (eco.manager) eco.manager.pressure = clamp((eco.manager.pressure || 35) + 10, 0, 100);
    }
  }

  function checkFanReactionTriggers(state, streaks) {
    const userStreaks = (streaks && streaks[state.userTeamId]) || {};
    const world = (state.managerEcosystem && state.managerEcosystem.worldMedia) || {};
    if ((userStreaks.wins || 0) >= 4) {
      addFanReaction(state, {
        type: "winning-streak",
        positive: true,
        title: "La grada explota",
        body: "La racha ganadora ha encendido el estadio. El equipo siente el respaldo de la hinchada.",
        icon: "🔥",
        mechanical: "+8 home advantage x2 matches"
      });
    }
    if ((userStreaks.losses || 0) >= 3) {
      addFanReaction(state, {
        type: "losing-streak",
        positive: false,
        title: "Silbidos en el estadio",
        body: "La paciencia de la hinchada se agota. La racha negativa genera tension en las tribunas.",
        icon: "😤",
        mechanical: "-5 morale +10 manager pressure"
      });
    }
    if (world.lastDerbyWin && world.lastDerbyWin === (state.currentWeek || 1)) {
      addFanReaction(state, {
        type: "derby-win",
        positive: true,
        title: "La ciudad es nuestra",
        body: "La victoria en el clasico desato la euforia. El ambiente en el estadio alcanza su maximo.",
        icon: "🏆",
        mechanical: "+8 home advantage x2 matches"
      });
    }
  }

  // ═══════════════════════════
  // SCANDAL SYSTEM
  // ═══════════════════════════

  function ensureScandals(state) {
    state.scandals = state.scandals || [];
    return state.scandals;
  }

  function applyScandal(state, scandal) {
    const eco = state.managerEcosystem || {};
    const world = eco.worldMedia || {};
    const severity = scandal.severity || 1;
    if (FMG.updateBoardTrust) {
      FMG.updateBoardTrust(state, "Escandalo: " + (scandal.title || "incidente"), -5);
    } else if (state.finances) {
      state.finances.boardTrust = clamp((state.finances.boardTrust || 50) - 5, 0, 100);
    }
    if (severity >= 2) {
      if (FMG.updateBoardTrust) {
        FMG.updateBoardTrust(state, "Escandalo grave: " + (scandal.title || "incidente"), -7);
      } else if (state.finances) {
        state.finances.boardTrust = clamp((state.finances.boardTrust || 50) - 7, 0, 100);
      }
      if (world.fans) world.fans.pressure = clamp((world.fans.pressure || 45) + 8, 0, 100);
      if (FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "dressing-room",
          title: scandal.title || "Escandalo interno sacude al club",
          body: scandal.description || "Un incidente interno genera reacciones externas.",
          tags: ["escandalo"],
          importance: 80,
          dedupeKey: "scandal-news-" + scandal.id
        });
      }
    }
    if (severity >= 3) {
      (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) - 15, 0, 100);
      });
    }
  }

  function addScandal(state, scandal) {
    ensureScandals(state);
    const id = deterministicId("scandal", [scandal.type, state.seasonNumber || 1, state.currentWeek || 1, scandal.affectedPartyId || ""]);
    if (state.scandals.some(function (s) { return s.id === id; })) return null;
    const entry = {
      id: id,
      week: state.currentWeek || 1,
      seasonNumber: state.seasonNumber || 1,
      resolved: false,
      resolvedWeek: null,
      type: scandal.type || "general",
      severity: scandal.severity || 1,
      title: scandal.title || "",
      description: scandal.description || "",
      affectedPartyId: scandal.affectedPartyId || null,
      mechanicalEffect: scandal.mechanicalEffect || ""
    };
    boundedPush(state.scandals, entry, 8);
    applyScandal(state, entry);
    return entry;
  }

  function resolveOldScandals(state) {
    const scandals = ensureScandals(state);
    const week = state.currentWeek || 1;
    scandals.forEach(function (s) {
      const maxWeeks = s.severity === 3 ? 8 : s.severity === 2 ? 6 : 4;
      if (!s.resolved && week - s.week >= maxWeeks) {
        s.resolved = true;
        s.resolvedWeek = week;
      }
    });
  }

  function checkScandalTriggers(state) {
    const psych = state.psychology;
    if (psych && psych.chemistry && psych.chemistry.conflict > 80) {
      const seed = hashText("faction-leak-" + (state.seasonNumber || 1) + "-" + (state.currentWeek || 1));
      if (seed % 8 === 0) {
        addScandal(state, {
          type: "faction-conflict-leak",
          severity: 1,
          title: "Fisuras internas trascienden al publico",
          description: "El conflicto interno del plantel llega a oidos de la prensa.",
          affectedPartyId: state.userTeamId,
          mechanicalEffect: "-5 board trust"
        });
      }
    }
    const toxicPlayer = (state.players || []).find(function (p) { return p.teamId === state.userTeamId && (p.toxicity || 0) > 85; });
    if (toxicPlayer) {
      addScandal(state, {
        type: "player-toxicity-public",
        severity: 2,
        title: "El malestar de " + toxicPlayer.name + " trasciende",
        description: "La situacion de descontento de " + toxicPlayer.name + " ya es de dominio publico.",
        affectedPartyId: toxicPlayer.id,
        mechanicalEffect: "-12 board trust -8 fans"
      });
    }
  }

  // ═══════════════════════════
  // HERO/VILLAIN MEDIA
  // ═══════════════════════════

  function trackHeroVillainMedia(state, result) {
    if (!result) return;
    const hero = result.matchHero;
    const villain = result.matchVillain;
    const season = state.seasonNumber || 1;
    const week = result.week || state.currentWeek || 1;
    const world = state.managerEcosystem && state.managerEcosystem.worldMedia;

    if (hero && hero.playerId) {
      const hp = (state.players || []).find(function (x) { return x.id === hero.playerId; });
      if (hp) {
        hp.heroCredits = (hp.heroCredits || 0) + 1;
        hp.mediaReputation = clamp((hp.mediaReputation || 50) + 5, 0, 100);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "player-story",
            title: hero.name + " acapara los titulares tras su actuacion",
            body: hero.name + " suma notoriedad mediatica. Reputacion: " + Math.round(hp.mediaReputation) + "/100.",
            tags: ["heroe", "media"],
            importance: 72,
            entities: { playerId: hero.playerId },
            dedupeKey: "hero-media-" + season + "-" + week + "-" + hero.playerId
          });
        }
        if (hp.heroCredits >= 3 && world) {
          world.narratives = world.narratives || {};
          world.narratives.active = world.narratives.active || [];
          const alreadyGolden = world.narratives.active.some(function (n) { return n.playerId === hero.playerId && n.type === "golden-boy"; });
          if (!alreadyGolden) {
            world.narratives.active.push({ type: "golden-boy", playerId: hero.playerId, name: hero.name, season: season });
            if (Number.isFinite(hp.ego)) hp.ego = clamp(hp.ego + 10, 0, 100);
            if (FMG.addNewsItem) {
              FMG.addNewsItem(state, {
                type: "player-story",
                title: hero.name + ": el nino de oro del campeonato",
                body: "Tres o mas actuaciones estelares consolidan a " + hero.name + " como la gran figura del torneo.",
                tags: ["heroe", "golden-boy"],
                importance: 85,
                dedupeKey: "golden-boy-" + season + "-" + hero.playerId
              });
            }
          }
        }
      }
    }

    if (villain && villain.playerId) {
      const vp = (state.players || []).find(function (x) { return x.id === villain.playerId; });
      if (vp) {
        vp.villainCredits = (vp.villainCredits || 0) + 1;
        vp.mediaReputation = clamp((vp.mediaReputation || 50) - 8, 0, 100);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "dressing-room",
            title: villain.name + " queda en el centro de las criticas",
            body: "La actuacion de " + villain.name + " genera presion mediatica y preguntas sobre su futuro.",
            tags: ["villano", "critica"],
            importance: 70,
            entities: { playerId: villain.playerId },
            dedupeKey: "villain-media-" + season + "-" + week + "-" + villain.playerId
          });
        }
        if (vp.teamId === state.userTeamId && world && world.fans) {
          world.fans.pressure = clamp((world.fans.pressure || 45) + 8, 0, 100);
        }
        if (vp.villainCredits >= 3) {
          vp.toxicity = Number.isFinite(vp.toxicity) ? clamp(vp.toxicity + 15, 0, 100) : 15;
          if (FMG.addNewsItem) {
            FMG.addNewsItem(state, {
              type: "dressing-room",
              title: "El estigma de " + villain.name + " crece en los medios",
              body: "Tres o mas actuaciones polemicas convierten a " + villain.name + " en el jugador problema de la temporada.",
              tags: ["villano", "problema"],
              importance: 78,
              dedupeKey: "problem-player-" + season + "-" + villain.playerId
            });
          }
        }
      }
    }
  }

  function checkTransferFanReaction(state) {
    const history = (state.market && state.market.transferHistory) || [];
    history.filter(function (t) { return t.week === (state.currentWeek || 1) && t.type !== "loan"; }).forEach(function (t) {
      const p = (state.players || []).find(function (x) { return x.id === t.playerId; });
      if (!p) return;
      if ((p.squadRole === "key" || (p.overall || 0) >= 78) && p.teamId !== state.userTeamId) {
        addFanReaction(state, {
          type: "key-player-sold",
          positive: false,
          title: "Protesta organizada en las tribunas",
          body: "La venta de " + t.playerName + " genera descontento. Los hinchas ven marcharse a un referente.",
          icon: "😠",
          mechanical: "-5 morale +10 manager pressure"
        });
      } else if (p.teamId === state.userTeamId && (p.overall || 0) >= 75) {
        addFanReaction(state, {
          type: "big-signing",
          positive: true,
          title: "Euforia en las tribunas",
          body: "La llegada de " + t.playerName + " desata el entusiasmo de la aficion.",
          icon: "🎉",
          mechanical: "+8 home advantage x2 matches"
        });
      }
    });
  }

  // ═══════════════════════════
  // WEEKLY INTEGRATION HOOK
  // ═══════════════════════════

  const _prevWeekWMP = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options) {
    const result = _prevWeekWMP ? _prevWeekWMP(state, options) : {};
    const streaks = (state.worldNews && state.worldNews.streaks) || {};
    checkFanReactionTriggers(state, streaks);
    checkScandalTriggers(state);
    resolveOldScandals(state);
    checkTransferFanReaction(state);
    const world = state.managerEcosystem && state.managerEcosystem.worldMedia;
    if (world && (world.homeAdvantageDuration || 0) > 0) {
      world.homeAdvantageDuration -= 1;
      if (world.homeAdvantageDuration <= 0) { world.homeAdvantageBonus = 0; world.homeAdvantageDuration = 0; }
    }
    const freshRx = (state.fanReactions || []).filter(function (r) { return !r.resolved && r.week === (state.currentWeek || 1); });
    freshRx.forEach(function (r) { applyFanReactionEffect(state, r); r.resolved = true; });
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  // ═══════════════════════════
  // EXTEND POST-MATCH
  // ═══════════════════════════

  const _prevPostMatchWMP = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = _prevPostMatchWMP ? _prevPostMatchWMP(state, result) : [];
    if (result && (result.homeTeamId === state.userTeamId || result.awayTeamId === state.userTeamId)) {
      trackHeroVillainMedia(state, result);
      const rivalry = FMG.getRivalry ? FMG.getRivalry(result.homeTeamId, result.awayTeamId) : null;
      if (rivalry) {
        const userGoals = result.homeTeamId === state.userTeamId ? result.homeGoals : result.awayGoals;
        const oppGoals = result.homeTeamId === state.userTeamId ? result.awayGoals : result.homeGoals;
        if (userGoals > oppGoals) {
          const world2 = state.managerEcosystem && state.managerEcosystem.worldMedia;
          if (world2) world2.lastDerbyWin = state.currentWeek || 1;
        }
      }
    }
    return items;
  };

  // ═══════════════════════════
  // PUBLIC API
  // ═══════════════════════════

  FMG.MediaExtended = {
    ensureFanReactions: ensureFanReactions,
    addFanReaction: addFanReaction,
    ensureScandals: ensureScandals,
    addScandal: addScandal,
    trackHeroVillainMedia: trackHeroVillainMedia,
    applyFanReactionEffect: applyFanReactionEffect
  };
})();
