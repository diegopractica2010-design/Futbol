(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const clamp = FMG.clamp;

  const hashText = FMG.hashText;

  const deterministicId = FMG.deterministicId;

  const boundedPush = FMG.boundedPush;

  const boundedUpsert = FMG.boundedUpsert;

  function squad(state) {
    return (state.players || []).filter((player) => player.teamId === state.userTeamId && !player.retired);
  }

  function playerSeed(player, salt) {
    return hashText(`${player.id}-${player.name}-${salt}`);
  }

  function ensureSquadPsychologyState(state) {
    state.psychology = state.psychology || {};
    const psych = state.psychology;
    psych.version = 1;
    psych.players = psych.players || {};
    psych.relationships = psych.relationships || {};
    psych.chemistry = psych.chemistry || { cohesion: 55, trust: 52, conflict: 28, leadership: 50, motivation: 55, emotionalMomentum: 0 };
    psych.manager = psych.manager || { empathy: 55, authority: 56, pressure: 35, burnout: 18, trust: 52 };
    psych.staff = psych.staff || { assistantTrust: 52, medicalTrust: 50, psychologySupport: 48, alignment: 54 };
    psych.memory = psych.memory || [];
    psych.events = psych.events || [];
    psych.interactions = psych.interactions || [];
    psych.conflicts = psych.conflicts || [];
    psych.hierarchy = psych.hierarchy || [];
    psych.lastUpdated = psych.lastUpdated || { seasonNumber: state.seasonNumber || 1, week: state.currentWeek || 1 };
    squad(state).forEach((player) => EmotionalStateEngine.ensurePlayer(state, player));
    SquadChemistryEngine.updateHierarchy(state);
    return psych;
  }

  const PsychologyController = {
    ensure: ensureSquadPsychologyState,

    runWeek(state, options = {}) {
      const psych = ensureSquadPsychologyState(state);
      EmotionalStateEngine.updateSquad(state, options);
      RelationshipManager.update(state);
      SquadChemistryEngine.update(state);
      MoraleSimulationController.run(state);
      HumanInteractionSystem.generate(state);
      psych.lastUpdated = { seasonNumber: state.seasonNumber || 1, week: state.currentWeek || 1 };
      return psych;
    },

    recordEvent(state, event) {
      return EmotionalEventProcessor.process(state, event);
    }
  };

  const EmotionalStateEngine = {
    ensurePlayer(state, player) {
      const psych = state.psychology || ensureSquadPsychologyState(state);
      const seed = playerSeed(player, "psychology");
      psych.players[player.id] = psych.players[player.id] || {
        playerId: player.id,
        personality: {
          professionalism: 38 + (seed % 50),
          ambition: 36 + ((seed >>> 3) % 54),
          discipline: 34 + ((seed >>> 5) % 52),
          confidenceTrait: 35 + ((seed >>> 7) % 50),
          temperament: 34 + ((seed >>> 9) % 52),
          empathy: 30 + ((seed >>> 11) % 50)
        },
        emotions: {
          confidence: player.overall >= 75 ? 62 : 52,
          motivation: player.age <= 23 ? 62 : 54,
          frustration: clamp(100 - (player.happiness || 58), 0, 100),
          pressure: 32,
          burnout: 12,
          discipline: 55,
          tacticalSatisfaction: 52,
          fanPressure: 35,
          mediaPressure: 35
        },
        influence: clamp((player.leadership || player.overall || 55) + (player.squadRole === "key" ? 8 : 0), 15, 98),
        managerTrust: 50,
        staffTrust: 50,
        memoryIds: [],
        relationshipIds: [],
        evolution: []
      };
      Object.keys(psych.players[player.id].personality).forEach((key) => {
        psych.players[player.id].personality[key] = clamp(psych.players[player.id].personality[key], 20, 98);
      });
      return psych.players[player.id];
    },

    updatePlayer(state, player, context = {}) {
      const record = this.ensurePlayer(state, player);
      const mediaPressure = state.managerEcosystem?.worldMedia?.media?.pressure || 40;
      const fanPressure = state.managerEcosystem?.worldMedia?.fans?.pressure || state.managerEcosystem?.clubs?.[state.userTeamId]?.fans?.expectation || 45;
      const role = FMG.SQUAD_ROLES?.[player.squadRole] || { expectedStarts: 0.35 };
      const completed = Math.max(1, state.completedWeeks || 1);
      const startRatio = (player.seasonStats?.starts || 0) / completed;
      const playingTimeGap = role.expectedStarts - startRatio;
      const traits = record.personality;
      const emotions = record.emotions;
      emotions.mediaPressure = clamp(Math.round(emotions.mediaPressure * 0.76 + mediaPressure * 0.24), 0, 100);
      emotions.fanPressure = clamp(Math.round(emotions.fanPressure * 0.76 + fanPressure * 0.24), 0, 100);
      emotions.frustration = clamp(Math.round(emotions.frustration * 0.72 + (100 - (player.happiness || 55)) * 0.16 + Math.max(0, playingTimeGap) * 34), 0, 100);
      emotions.pressure = clamp(Math.round(emotions.pressure * 0.74 + emotions.mediaPressure * 0.12 + emotions.fanPressure * 0.1 + (player.squadRole === "key" ? 4 : 0)), 0, 100);
      emotions.confidence = clamp(Math.round(emotions.confidence * 0.7 + (player.morale || 55) * 0.18 + traits.confidenceTrait * 0.08 + (context.result === "win" ? 5 : context.result === "loss" ? -5 : 0)), 0, 100);
      emotions.motivation = clamp(Math.round(emotions.motivation * 0.76 + traits.ambition * 0.1 + (100 - emotions.frustration) * 0.08 + (player.age <= 23 ? 3 : 0)), 0, 100);
      emotions.burnout = clamp(Math.round(emotions.burnout * 0.82 + Math.max(0, 100 - (player.energy || 70)) * 0.14 + emotions.pressure * 0.04), 0, 100);
      emotions.discipline = clamp(Math.round(emotions.discipline * 0.84 + traits.discipline * 0.16 - (emotions.frustration > 72 ? 3 : 0)), 0, 100);
      emotions.tacticalSatisfaction = clamp(Math.round(emotions.tacticalSatisfaction * 0.78 + this.tacticalFit(state, player) * 0.22), 0, 100);
      record.managerTrust = clamp(Math.round(record.managerTrust * 0.82 + (player.happiness || 55) * 0.1 + emotions.tacticalSatisfaction * 0.08), 0, 100);
      player.happiness = clamp(Math.round((player.happiness || 55) * 0.88 + emotions.confidence * 0.04 + emotions.motivation * 0.04 - emotions.frustration * 0.03), 0, 100);
      player.morale = clamp(Math.round((player.morale || 55) * 0.9 + emotions.confidence * 0.06 + emotions.motivation * 0.04 - emotions.burnout * 0.03), 0, 100);
      return record;
    },

    tacticalFit(state, player) {
      const plan = FMG.getTeamPlan?.(state, state.userTeamId);
      if (!plan) return 52;
      const role = plan.playerRoles?.[player.position] || "balanced";
      const attacking = ["attacking", "insideForward", "advancedPlaymaker", "wideWinger", "wingBack"].includes(role);
      const defensive = ["defensive", "noNonsenseDefender", "holdingMidfielder"].includes(role);
      const personality = player.personality || "";
      let fit = 52;
      if (attacking && (player.overall >= 72 || String(personality).includes("Ambicioso"))) fit += 12;
      if (defensive && (player.leadership || 0) >= 65) fit += 8;
      if (plan.mentality === "attacking" && player.position === "DEL") fit += 6;
      if (plan.pressing === "high" && (player.energy || 70) < 58) fit -= 10;
      return clamp(fit, 15, 92);
    },

    updateSquad(state, context = {}) {
      squad(state).forEach((player) => this.updatePlayer(state, player, context));
    }
  };

  const RelationshipManager = {
    pairId(leftId, rightId) {
      return [leftId, rightId].sort().join("::");
    },

    ensurePair(state, left, right) {
      const psych = ensureSquadPsychologyState(state);
      const id = this.pairId(left.id, right.id);
      psych.relationships[id] = psych.relationships[id] || {
        id,
        players: [left.id, right.id],
        affinity: 42 + (hashText(`${id}-affinity`) % 32),
        respect: 40 + (hashText(`${id}-respect`) % 38),
        rivalry: 18 + (hashText(`${id}-rivalry`) % 28),
        friendship: 20 + (hashText(`${id}-friendship`) % 36),
        memoryIds: []
      };
      return psych.relationships[id];
    },

    update(state) {
      const players = squad(state)
        .sort((a, b) => (b.leadership || b.overall || 0) - (a.leadership || a.overall || 0))
        .slice(0, 16);
      for (let i = 0; i < players.length; i += 1) {
        for (let j = i + 1; j < Math.min(players.length, i + 5); j += 1) {
          const left = players[i];
          const right = players[j];
          const rel = this.ensurePair(state, left, right);
          const samePosition = left.position === right.position;
          const moraleAvg = ((left.morale || 55) + (right.morale || 55)) / 2;
          rel.affinity = clamp(Math.round(rel.affinity * 0.92 + moraleAvg * 0.08 + (samePosition ? -1 : 1)), 0, 100);
          rel.respect = clamp(Math.round(rel.respect * 0.9 + ((left.leadership || left.overall || 55) + (right.leadership || right.overall || 55)) * 0.05), 0, 100);
          rel.rivalry = clamp(Math.round(rel.rivalry * 0.94 + (samePosition ? 4 : 0) + (Math.abs((left.overall || 60) - (right.overall || 60)) < 4 ? 1 : -1)), 0, 100);
          rel.friendship = clamp(Math.round(rel.friendship * 0.92 + rel.affinity * 0.08 - (rel.rivalry > 62 ? 2 : 0)), 0, 100);
        }
      }
      return state.psychology.relationships;
    },

    managerInteraction(state, playerId, type) {
      const player = (state.players || []).find((item) => item.id === playerId);
      if (!player) return null;
      const record = EmotionalStateEngine.ensurePlayer(state, player);
      const delta = type === "captaincy" ? 8 : type === "role-change" ? 3 : type === "contract" ? 5 : -2;
      record.managerTrust = clamp(record.managerTrust + delta, 0, 100);
      return EmotionalMemoryLayer.remember(state, {
        type: "manager-player",
        playerId,
        title: `${player.name}: ${type}`,
        detail: `Relacion manager-jugador ajustada a ${record.managerTrust}/100.`,
        intensity: Math.abs(delta) * 9
      });
    }
  };

  const SquadChemistryEngine = {
    updateHierarchy(state) {
      const psych = state.psychology || ensureSquadPsychologyState(state);
      psych.hierarchy = squad(state)
        .map((player) => {
          const record = EmotionalStateEngine.ensurePlayer(state, player);
          return {
            playerId: player.id,
            name: player.name,
            influence: clamp(Math.round((player.leadership || player.overall || 55) * 0.68 + record.emotions.confidence * 0.18 + record.managerTrust * 0.14), 0, 100),
            role: player.squadRole === "key" ? "lider central" : player.age >= 30 ? "veterano" : player.age <= 22 ? "joven sensible" : "referente"
          };
        })
        .sort((a, b) => b.influence - a.influence)
        .slice(0, 8);
      return psych.hierarchy;
    },

    update(state) {
      const psych = ensureSquadPsychologyState(state);
      const players = squad(state);
      this.updateHierarchy(state);
      const records = players.map((player) => EmotionalStateEngine.ensurePlayer(state, player));
      const avg = (selector, fallback) => records.length ? FMG.average(records.map(selector)) : fallback;
      const relationships = Object.values(psych.relationships);
      const friendship = relationships.length ? FMG.average(relationships.map((rel) => rel.friendship)) : 45;
      const rivalry = relationships.length ? FMG.average(relationships.map((rel) => rel.rivalry)) : 25;
      psych.chemistry = {
        cohesion: clamp(Math.round(avg((record) => record.emotions.motivation, 55) * 0.34 + avg((record) => record.managerTrust, 50) * 0.24 + friendship * 0.22 + avg((record) => 100 - record.emotions.frustration, 55) * 0.2), 0, 100),
        trust: clamp(Math.round(avg((record) => record.managerTrust, 50) * 0.7 + psych.manager.trust * 0.3), 0, 100),
        conflict: clamp(Math.round(rivalry * 0.46 + avg((record) => record.emotions.frustration, 35) * 0.36 + avg((record) => record.emotions.pressure, 35) * 0.18), 0, 100),
        leadership: clamp(Math.round(FMG.average(psych.hierarchy.map((item) => item.influence)) || 50), 0, 100),
        motivation: clamp(Math.round(avg((record) => record.emotions.motivation, 55)), 0, 100),
        emotionalMomentum: clamp(Math.round((psych.chemistry.emotionalMomentum || 0) * 0.7 + (avg((record) => record.emotions.confidence, 52) - 50) * 0.18 + (50 - avg((record) => record.emotions.pressure, 35)) * 0.12), -40, 40)
      };
      psych.manager.pressure = clamp(Math.round((state.managerEcosystem?.manager?.pressure || 35) * 0.62 + psych.chemistry.conflict * 0.22 + (100 - psych.chemistry.trust) * 0.16), 0, 100);
      psych.manager.burnout = clamp(Math.round(psych.manager.burnout * 0.84 + psych.manager.pressure * 0.1 + (psych.chemistry.conflict > 70 ? 5 : 0)), 0, 100);
      psych.manager.trust = clamp(Math.round(psych.manager.trust * 0.82 + psych.chemistry.trust * 0.18), 0, 100);
      return psych.chemistry;
    }
  };

  const EmotionalMemoryLayer = {
    remember(state, event) {
      const psych = ensureSquadPsychologyState(state);
      const entry = {
        id: event.id || deterministicId("emotion", [state.seasonNumber, state.currentWeek, event.type, event.playerId || "", event.title]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        type: event.type || "emotion",
        playerId: event.playerId || null,
        title: event.title || "Evento emocional",
        detail: event.detail || "",
        intensity: clamp(event.intensity || 40, 0, 100),
        tags: event.tags || []
      };
      boundedUpsert(psych.memory, entry, 100);
      if (entry.playerId && psych.players[entry.playerId]) {
        boundedUpsert(psych.players[entry.playerId].evolution, {
          id: entry.id,
          week: entry.week,
          seasonNumber: entry.seasonNumber,
          title: entry.title,
          intensity: entry.intensity
        }, 16);
        if (!psych.players[entry.playerId].memoryIds.includes(entry.id)) {
          psych.players[entry.playerId].memoryIds.unshift(entry.id);
          psych.players[entry.playerId].memoryIds = psych.players[entry.playerId].memoryIds.slice(0, 16);
        }
      }
      return entry;
    }
  };

  const MoraleSimulationController = {
    run(state) {
      const psych = ensureSquadPsychologyState(state);
      const chemistry = psych.chemistry;
      squad(state).forEach((player) => {
        const record = EmotionalStateEngine.ensurePlayer(state, player);
        const recovery = record.personality.professionalism > 70 ? 2 : 1;
        if (record.emotions.burnout > 55) player.energy = clamp((player.energy || 70) - 1, 0, 100);
        if (chemistry.cohesion > 68) {
          player.morale = clamp((player.morale || 55) + recovery, 0, 100);
          record.emotions.frustration = clamp(record.emotions.frustration - 1, 0, 100);
        }
        if (chemistry.conflict > 72 && record.emotions.discipline < 45) {
          player.morale = clamp((player.morale || 55) - 2, 0, 100);
          EmotionalEventProcessor.process(state, {
            type: "discipline",
            playerId: player.id,
            title: `${player.name} acusa tension interna`,
            detail: `Disciplina ${record.emotions.discipline}/100 con conflicto de grupo ${chemistry.conflict}/100.`,
            intensity: chemistry.conflict
          });
        }
      });
      return psych;
    }
  };

  const HumanInteractionSystem = {
    generate(state) {
      const psych = ensureSquadPsychologyState(state);
      if ((state.currentWeek || 1) % 2 !== 0) return null;
      const leaders = psych.hierarchy.slice(0, 3);
      const sensitive = squad(state)
        .map((player) => ({ player, record: EmotionalStateEngine.ensurePlayer(state, player) }))
        .sort((a, b) => b.record.emotions.frustration - a.record.emotions.frustration)[0];
      if (!leaders.length || !sensitive) return null;
      const leader = leaders[hashText(`${state.seasonNumber}-${state.currentWeek}-interaction`) % leaders.length];
      const interaction = {
        id: deterministicId("interaction", [state.seasonNumber, state.currentWeek, leader.playerId, sensitive.player.id]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        leaderId: leader.playerId,
        playerId: sensitive.player.id,
        title: `${leader.name} contiene a ${sensitive.player.name}`,
        detail: `El liderazgo interno intenta bajar frustracion ${sensitive.record.emotions.frustration}/100.`,
        effect: 3
      };
      boundedUpsert(psych.interactions, interaction, 32);
      sensitive.record.emotions.frustration = clamp(sensitive.record.emotions.frustration - interaction.effect, 0, 100);
      return interaction;
    }
  };

  const EmotionalEventProcessor = {
    process(state, event) {
      const psych = ensureSquadPsychologyState(state);
      const memory = EmotionalMemoryLayer.remember(state, event);
      boundedUpsert(psych.events, memory, 60);
      const player = event.playerId ? (state.players || []).find((item) => item.id === event.playerId) : null;
      if (player) {
        const record = EmotionalStateEngine.ensurePlayer(state, player);
        if (event.type === "role-change") record.emotions.tacticalSatisfaction = clamp(record.emotions.tacticalSatisfaction + 4, 0, 100);
        if (event.type === "captaincy") {
          record.emotions.confidence = clamp(record.emotions.confidence + 8, 0, 100);
          record.influence = clamp(record.influence + 6, 0, 100);
        }
        if (event.type === "contract") record.managerTrust = clamp(record.managerTrust + 5, 0, 100);
        if (event.type === "loss") record.emotions.confidence = clamp(record.emotions.confidence - 5, 0, 100);
        if (event.type === "discipline") {
          record.emotions.frustration = clamp(record.emotions.frustration + 4, 0, 100);
          boundedUpsert(psych.conflicts, memory, 24);
        }
      }
      return memory;
    },

    processMatch(state, result) {
      if (!result || (result.homeTeamId !== state.userTeamId && result.awayTeamId !== state.userTeamId)) return null;
      const home = result.homeTeamId === state.userTeamId;
      const scored = home ? result.homeGoals : result.awayGoals;
      const conceded = home ? result.awayGoals : result.homeGoals;
      const outcome = scored > conceded ? "win" : scored < conceded ? "loss" : "draw";
      const psych = ensureSquadPsychologyState(state);
      squad(state).forEach((player) => EmotionalStateEngine.updatePlayer(state, player, { result: outcome }));
      const memory = EmotionalMemoryLayer.remember(state, {
        id: deterministicId("match-emotion", [state.seasonNumber, result.week || state.currentWeek, outcome, scored, conceded]),
        type: outcome,
        title: outcome === "win" ? "Victoria emocional" : outcome === "loss" ? "Golpe animico" : "Empate de lectura mixta",
        detail: `${state.userClub?.name || "El club"} queda ${scored}-${conceded}; cohesion ${psych.chemistry.cohesion}/100.`,
        intensity: outcome === "loss" ? 70 : outcome === "win" ? 58 : 46
      });
      SquadChemistryEngine.update(state);
      return memory;
    }
  };

  const previousRunManagerEcosystemWeek = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options = {}) {
    const result = previousRunManagerEcosystemWeek ? previousRunManagerEcosystemWeek(state, options) : {};
    result.psychology = PsychologyController.runWeek(state, options);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  const previousGeneratePostMatchNews = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = previousGeneratePostMatchNews ? previousGeneratePostMatchNews(state, result) : [];
    EmotionalEventProcessor.processMatch(state, result);
    return items;
  };

  const previousSetSquadRole = FMG.setSquadRole;
  FMG.setSquadRole = function (state, playerId, role) {
    const result = previousSetSquadRole ? previousSetSquadRole(state, playerId, role) : { ok: false, message: "Rol no disponible." };
    if (result.ok) {
      RelationshipManager.managerInteraction(state, playerId, "role-change");
      EmotionalEventProcessor.process(state, { type: "role-change", playerId, title: "Cambio de rol", detail: result.message, intensity: 42 });
      SquadChemistryEngine.update(state);
    }
    return result;
  };

  const previousSetCaptain = FMG.setCaptain;
  FMG.setCaptain = function (state, playerId) {
    const result = previousSetCaptain ? previousSetCaptain(state, playerId) : { ok: false, message: "Capitania no disponible." };
    if (result.ok) {
      RelationshipManager.managerInteraction(state, playerId, "captaincy");
      EmotionalEventProcessor.process(state, { type: "captaincy", playerId, title: "Nombramiento de capitan", detail: result.message, intensity: 62 });
      SquadChemistryEngine.update(state);
    }
    return result;
  };

  const previousRenewPlayerContract = FMG.renewPlayerContract;
  FMG.renewPlayerContract = function (state, playerId, options = {}) {
    const result = previousRenewPlayerContract ? previousRenewPlayerContract(state, playerId, options) : { ok: false, message: "Contrato no disponible." };
    if (result.ok) {
      RelationshipManager.managerInteraction(state, playerId, "contract");
      EmotionalEventProcessor.process(state, { type: "contract", playerId, title: "Contrato y confianza", detail: result.message, intensity: 52 });
      SquadChemistryEngine.update(state);
    }
    return result;
  };

  const previousTrainUserSquad = FMG.trainUserSquad;
  FMG.trainUserSquad = function (state) {
    const result = previousTrainUserSquad ? previousTrainUserSquad(state) : { ok: false, message: "Entrenamiento no disponible." };
    if (result.ok) {
      EmotionalMemoryLayer.remember(state, {
        id: deterministicId("training-emotion", [state.seasonNumber, state.currentWeek, state.tactics?.teamSettings?.[state.userTeamId]?.trainingFocus || "balanced"]),
        type: "training",
        title: "Semana de entrenamiento emocional",
        detail: result.message,
        intensity: 44
      });
      PsychologyController.runWeek(state, { phase: "training" });
    }
    return result;
  };

  FMG.SquadPsychology = {
    ensure: ensureSquadPsychologyState,
    runWeek: PsychologyController.runWeek,
    recordEvent: PsychologyController.recordEvent,
    PsychologyController,
    EmotionalStateEngine,
    RelationshipManager,
    SquadChemistryEngine,
    EmotionalMemoryLayer,
    MoraleSimulationController,
    HumanInteractionSystem,
    EmotionalEventProcessor
  };

  FMG.ensureSquadPsychologyState = ensureSquadPsychologyState;
})();

// ═══════════════════════════════════════════════════════════════════════════
// SQUAD PSYCHOLOGY — EXTENDED SYSTEMS (Fase 3+4)
// Ego, Factions, Mentor/Protege, Toxicity, Captain Influence, Dressing Room Events
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const hashText = FMG.hashText;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  function getSquad(state) {
    return (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; });
  }

  function getPlayer(state, playerId) {
    return (state.players || []).find(function (p) { return p.id === playerId; }) || null;
  }

  // ═══════════════════════════════
  // DRESSING ROOM EVENTS
  // ═══════════════════════════════

  function ensureDressingRoomEvents(state) {
    state.dressingRoomEvents = state.dressingRoomEvents || [];
    return state.dressingRoomEvents;
  }

  function addDressingRoomEvent(state, event) {
    ensureDressingRoomEvents(state);
    const id = deterministicId("dre", [event.type, state.seasonNumber || 1, state.currentWeek || 1, event.playerId || event.title || ""]);
    if (state.dressingRoomEvents.some(function (e) { return e.id === id; })) return null;
    const entry = {
      id: id,
      week: state.currentWeek || 1,
      seasonNumber: state.seasonNumber || 1,
      resolved: false,
      type: event.type || "general",
      title: event.title || "",
      description: event.description || "",
      icon: event.icon || "📋",
      playerId: event.playerId || null,
      choices: event.choices || []
    };
    boundedPush(state.dressingRoomEvents, entry, 20);
    return entry;
  }

  // ═══════════════════════════════
  // EGO SYSTEM
  // ═══════════════════════════════

  function ensureEgo(player) {
    if (!Number.isFinite(player.ego)) {
      const seed = hashText(player.id + "-ego");
      const base = 30 + (player.overall || 55) * 0.4 + (player.age <= 24 ? 5 : player.age >= 32 ? -5 : 0);
      player.ego = clamp(Math.round(base + (seed % 21) - 10), 0, 100);
    }
    return player.ego;
  }

  function weeklyEgoUpdate(state) {
    const players = getSquad(state);
    const completedWeeks = Math.max(1, state.completedWeeks || 1);
    players.forEach(function (player) {
      ensureEgo(player);
      const record = state.psychology && state.psychology.players && state.psychology.players[player.id];
      if (!record) return;

      const startRatio = (player.seasonStats && player.seasonStats.starts ? player.seasonStats.starts : 0) / completedWeeks;
      const role = FMG.SQUAD_ROLES && FMG.SQUAD_ROLES[player.squadRole];
      const expectedStarts = role ? role.expectedStarts : 0.5;

      if (startRatio < expectedStarts - 0.3) {
        player.ego = clamp(player.ego - 1, 0, 100);
      }
      if ((record.emotions && record.emotions.confidence > 75) && player.seasonStats && player.seasonStats.goals >= 2) {
        player.ego = clamp(player.ego + 1, 0, 100);
      }

      if (player.ego > 75) {
        const weeksBenched = Math.round((1 - startRatio) * completedWeeks);
        if (weeksBenched >= 3) {
          addDressingRoomEvent(state, {
            type: "ego-clash",
            title: player.name + " exige protagonismo",
            description: "Ego " + player.ego + "/100. Lleva " + weeksBenched + " semanas sin ser titular y hace sentir su malestar.",
            playerId: player.id,
            icon: "⚡",
            choices: [
              { label: "Conversar en privado", effect: { egoPlayer: -5, managerTrust: 3 } },
              { label: "Ignorar", effect: { egoPlayer: 2, toxicity: 5 } }
            ]
          });
        }
        const otherHighEgo = players.filter(function (p) { return p.id !== player.id && p.ego > 75; });
        if (otherHighEgo.length > 0 && (state.currentWeek || 1) % 3 === 0) {
          const seed = hashText("ego-clash-" + (state.seasonNumber || 1) + "-" + (state.currentWeek || 1) + "-" + player.id);
          const rival = otherHighEgo[seed % otherHighEgo.length];
          if (rival) {
            addDressingRoomEvent(state, {
              type: "ego-clash",
              title: player.name + " y " + rival.name + ": dos egos que chocan",
              description: "Tension creciente entre dos figuras del plantel. Cohesion puede verse afectada.",
              playerId: player.id,
              icon: "💥",
              choices: [
                { label: "Separar sus funciones", effect: { cohesion: -3, conflict: -5 } },
                { label: "Dejar que se resuelva solo", effect: { conflict: 3, toxicity: 4 } }
              ]
            });
          }
        }
      }

      if (player.ego < 30 && record.emotions && record.emotions.confidence > 65) {
        const teammates = players.filter(function (p) { return p.id !== player.id; }).slice(0, 3);
        teammates.forEach(function (t) {
          const tr = state.psychology.players[t.id];
          if (tr && tr.emotions) tr.emotions.motivation = clamp(tr.emotions.motivation + 1, 0, 100);
        });
      }
    });
  }

  // ═══════════════════════════════
  // FACTIONS SYSTEM
  // ═══════════════════════════════

  function ensureFactions(state) {
    if (!state.psychology) state.psychology = {};
    state.psychology.factions = state.psychology.factions || [];
    return state.psychology.factions;
  }

  function detectFactionFormation(state) {
    const players = getSquad(state);
    const factions = ensureFactions(state);
    const MAX_FACTIONS = 4;

    const byNationality = {};
    players.forEach(function (p) {
      const nat = p.nationality || p.country || "neutral";
      if (!byNationality[nat]) byNationality[nat] = [];
      byNationality[nat].push(p.id);
    });

    const youngGroup = players.filter(function (p) { return p.age < 22; }).map(function (p) { return p.id; });
    const veteranGroup = players.filter(function (p) { return p.age > 30; }).map(function (p) { return p.id; });

    const candidates = [];
    Object.keys(byNationality).forEach(function (nat) {
      if (byNationality[nat].length >= 3) {
        candidates.push({ type: "nationality", name: "Grupo " + nat, memberIds: byNationality[nat].slice(0, 8) });
      }
    });
    if (youngGroup.length >= 3) candidates.push({ type: "young", name: "La cantera", memberIds: youngGroup.slice(0, 8) });
    if (veteranGroup.length >= 3) candidates.push({ type: "veteran", name: "Los mayores", memberIds: veteranGroup.slice(0, 8) });

    candidates.slice(0, MAX_FACTIONS).forEach(function (candidate) {
      const exists = factions.find(function (f) { return f.type === candidate.type && f.name === candidate.name; });
      if (!exists && factions.length < MAX_FACTIONS) {
        factions.push({
          id: deterministicId("faction", [state.seasonNumber || 1, candidate.type, candidate.name]),
          type: candidate.type,
          name: candidate.name,
          memberIds: candidate.memberIds,
          strength: 30 + hashText(candidate.name + "-" + (state.seasonNumber || 1)) % 40,
          mood: 55
        });
      }
    });

    const activeIds = new Set(players.map(function (p) { return p.id; }));
    for (let i = factions.length - 1; i >= 0; i -= 1) {
      factions[i].memberIds = factions[i].memberIds.filter(function (id) { return activeIds.has(id); });
      if (factions[i].memberIds.length < 3) factions.splice(i, 1);
    }

    return factions;
  }

  function updateFactions(state) {
    const factions = ensureFactions(state);
    const psych = state.psychology;
    if (!psych || !psych.chemistry) return factions;
    detectFactionFormation(state);

    factions.forEach(function (faction) {
      const members = (state.players || []).filter(function (p) { return faction.memberIds.includes(p.id); });
      if (!members.length) return;
      const avgMorale = members.reduce(function (s, p) { return s + (p.morale || 55); }, 0) / members.length;
      faction.mood = clamp(Math.round(faction.mood * 0.8 + avgMorale * 0.2), 0, 100);
      faction.strength = clamp(faction.strength + (faction.mood > 60 ? 1 : -1), 0, 100);

      if (faction.strength > 65 && faction.mood > 60) {
        psych.chemistry.cohesion = clamp(psych.chemistry.cohesion + 5, 0, 100);
      } else if (faction.strength > 65 && faction.mood <= 60) {
        psych.chemistry.cohesion = clamp(psych.chemistry.cohesion - 8, 0, 100);
        if (psych.chemistry.conflict < 80) {
          addDressingRoomEvent(state, {
            type: "faction-conflict",
            title: "Tension interna en \"" + faction.name + "\"",
            description: "El grupo \"" + faction.name + "\" (" + faction.memberIds.length + " jugadores) muestra descontento. Fortaleza: " + faction.strength + "/100.",
            icon: "🔥",
            choices: [
              { label: "Reunion grupal", effect: { cohesion: 4, factionMood: 8 } },
              { label: "Ignorar", effect: { cohesion: -3, conflict: 5 } }
            ]
          });
        }
      }

      const conflictFactions = factions.filter(function (f) { return f.id !== faction.id && f.strength > 65 && f.mood < 45; });
      if (faction.strength > 65 && faction.mood < 45 && conflictFactions.length > 0) {
        psych.chemistry.cohesion = clamp(psych.chemistry.cohesion - 15, 0, 100);
        psych.chemistry.conflict = clamp(psych.chemistry.conflict + 10, 0, 100);
      }
    });
    return factions;
  }

  // ═══════════════════════════════
  // MENTOR / PROTEGE SYSTEM
  // ═══════════════════════════════

  const POSITION_GROUPS = { POR: "POR", DEF: "DEF", MED: "MED", EXT: "MED", DEL: "DEL" };

  function detectMentors(state) {
    const players = getSquad(state);
    const psych = state.psychology;
    if (!psych) return;
    const relationships = psych.relationships || {};

    players.forEach(function (veteran) {
      if (veteran.age < 30 || (veteran.overall || 0) < 70) return;
      const record = psych.players && psych.players[veteran.id];
      if (!record || record.personality.professionalism < 65) return;
      const vetGroup = POSITION_GROUPS[veteran.position] || veteran.position;

      players.forEach(function (youngster) {
        if (youngster.id === veteran.id || youngster.age >= 21) return;
        const youngGroup = POSITION_GROUPS[youngster.position] || youngster.position;
        if (vetGroup !== youngGroup) return;

        const pairId = [veteran.id, youngster.id].sort().join("::");
        const rel = relationships[pairId];
        if (rel && !rel.mentorType) {
          rel.mentorType = "mentor";
          rel.mentorId = veteran.id;
          rel.protegeId = youngster.id;
          rel.mentorBondStrength = 40;
          rel.startSeason = state.seasonNumber || 1;
          addDressingRoomEvent(state, {
            type: "mentor-bond",
            title: veteran.name + " guia a " + youngster.name,
            description: "El veterano " + veteran.name + " (" + veteran.age + " anyos, OVR " + veteran.overall + ") toma bajo su ala al joven " + youngster.name + " (" + youngster.age + " anyos).",
            playerId: veteran.id,
            icon: "🤝",
            choices: []
          });
        }
      });
    });
  }

  function updateMentorEffects(state) {
    const psych = state.psychology;
    if (!psych) return;
    const relationships = psych.relationships || {};

    Object.keys(relationships).forEach(function (key) {
      const rel = relationships[key];
      if (!rel.mentorType) return;
      const veteran = getPlayer(state, rel.mentorId);
      const youngster = getPlayer(state, rel.protegeId);
      if (!veteran || !youngster) { rel.mentorType = null; return; }

      if (veteran.teamId !== state.userTeamId) {
        const bondPenalty = Math.round(4 + (rel.mentorBondStrength || 40) / 10);
        youngster.confidence = clamp((youngster.confidence || 55) - bondPenalty, 0, 100);
        rel.mentorType = null;
        return;
      }

      rel.mentorBondStrength = clamp((rel.mentorBondStrength || 40) + 1, 0, 100);
      const youngRecord = psych.players && psych.players[youngster.id];
      if (youngRecord && youngRecord.emotions) {
        youngRecord.emotions.confidence = clamp(youngRecord.emotions.confidence + 0.5, 0, 100);
        youngRecord.emotions.motivation = clamp(youngRecord.emotions.motivation + 0.5, 0, 100);
      }
      if (!Number.isFinite(veteran.legacyPoints)) veteran.legacyPoints = 0;
      veteran.legacyPoints += 3 / 36;
    });
  }

  // ═══════════════════════════════
  // TOXICITY SYSTEM
  // ═══════════════════════════════

  function ensureToxicity(player) {
    if (!Number.isFinite(player.toxicity)) player.toxicity = 0;
    return player.toxicity;
  }

  function updateToxicity(state, player) {
    ensureToxicity(player);
    ensureEgo(player);
    const record = state.psychology && state.psychology.players && state.psychology.players[player.id];
    if (!record) return;

    const unhappy = (player.happiness || 55) < 45;
    const highEgo = player.ego > 65;
    const lowTrust = record.managerTrust < 40;

    if (unhappy && highEgo && lowTrust) {
      player.toxicity = clamp(player.toxicity + 3, 0, 100);
    } else if (!unhappy || record.managerTrust > 60) {
      player.toxicity = clamp(player.toxicity - 2, 0, 100);
    }

    if (player.toxicity > 60 && (state.currentWeek || 1) % 2 === 0) {
      addDressingRoomEvent(state, {
        type: "toxic-spread",
        title: player.name + ": ambiente enrarecido",
        description: "Toxicidad " + player.toxicity + "/100. El descontento de " + player.name + " afecta el clima del vestuario.",
        playerId: player.id,
        icon: "☠️",
        choices: [
          { label: "Reunion privada", effect: { toxicity: -10, managerTrust: 5 } },
          { label: "Darle titularidad", effect: { toxicity: -15, ego: 5 } }
        ]
      });
    }

    if (player.toxicity > 80) {
      const others = getSquad(state).filter(function (p) { return p.id !== player.id; }).slice(0, 2);
      others.forEach(function (other) {
        other.morale = clamp((other.morale || 55) - 5, 0, 100);
      });
    }

    if (player.toxicity > 90 && !player.transferRequest) {
      player.transferRequest = true;
      addDressingRoomEvent(state, {
        type: "ego-clash",
        title: player.name + " pide salir del club",
        description: "Toxicidad maxima (" + player.toxicity + "/100). " + player.name + " ha solicitado formalmente su transferencia.",
        playerId: player.id,
        icon: "🚪",
        choices: [
          { label: "Vender en el proximo mercado", effect: { morale: 3 } },
          { label: "Intentar reconciliacion", effect: { toxicity: -20, managerTrust: -10 } }
        ]
      });
    }
  }

  // ═══════════════════════════════
  // CAPTAIN INFLUENCE
  // ═══════════════════════════════

  function updateCaptainInfluence(state) {
    const psych = state.psychology;
    if (!psych) return;
    const captainId = psych.captainId;
    if (!captainId) {
      if (!psych.hierarchy || psych.hierarchy.length === 0) {
        addDressingRoomEvent(state, {
          type: "leadership-void",
          title: "El vestuario busca un lider",
          description: "No hay figura natural de liderazgo en el plantel. La cohesion puede verse afectada.",
          icon: "👥",
          choices: [
            { label: "Nombrar capitan", effect: { cohesion: 5, leadership: 8 } },
            { label: "Dejar que emerja", effect: { cohesion: -2 } }
          ]
        });
      }
      return;
    }

    const captain = getPlayer(state, captainId);
    if (!captain) return;
    ensureEgo(captain);
    const record = psych.players && psych.players[captainId];
    if (!record) return;
    const conf = record.emotions ? record.emotions.confidence : 50;
    const players = getSquad(state);
    const captainSeasons = psych.captainSeasonsCount || 0;

    if (conf > 70) {
      players.forEach(function (p) {
        const r = psych.players && psych.players[p.id];
        if (r && r.emotions) r.emotions.motivation = clamp(r.emotions.motivation + 3, 0, 100);
      });
    } else if (conf < 40) {
      players.forEach(function (p) {
        p.morale = clamp((p.morale || 55) - 2, 0, 100);
      });
    }

    if (captain.ego > 75 && (state.currentWeek || 1) % 4 === 0) {
      addDressingRoomEvent(state, {
        type: "captain-speech",
        title: captain.name + ": el capitan marca terreno",
        description: "El capitan (ego " + captain.ego + "/100) muestra fricciones con el cuerpo tecnico. Confianza manager: " + record.managerTrust + "/100.",
        playerId: captainId,
        icon: "👑",
        choices: [
          { label: "Ceder espacio", effect: { captainEgo: 5, managerTrust: -5 } },
          { label: "Recordar jerarquia", effect: { captainEgo: -5, managerTrust: -8 } }
        ]
      });
    }

    if (psych.captainAppointedWeek) {
      const weeksSince = (state.currentWeek || 1) - psych.captainAppointedWeek;
      if (weeksSince >= 0 && weeksSince <= 2) {
        players.forEach(function (p) { p.morale = clamp((p.morale || 55) - 2, 0, 100); });
      }
    }

    if (captainSeasons >= 3) {
      psych.chemistry.cohesion = clamp(psych.chemistry.cohesion + 5, 0, 100);
    }
  }

  // ═══════════════════════════════
  // WEEKLY UPDATE
  // ═══════════════════════════════

  function runExtendedPsychologyWeek(state) {
    if (!state.psychology && FMG.ensureSquadPsychologyState) FMG.ensureSquadPsychologyState(state);
    const players = getSquad(state);
    weeklyEgoUpdate(state);
    players.forEach(function (p) { updateToxicity(state, p); });
    updateFactions(state);
    detectMentors(state);
    updateMentorEffects(state);
    updateCaptainInfluence(state);
  }

  // ═══════════════════════════════
  // HOOKS
  // ═══════════════════════════════

  const _prevRunWeek = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options) {
    const result = _prevRunWeek ? _prevRunWeek(state, options) : {};
    runExtendedPsychologyWeek(state);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  const _prevSetCaptain = FMG.setCaptain;
  FMG.setCaptain = function (state, playerId) {
    const result = _prevSetCaptain ? _prevSetCaptain(state, playerId) : { ok: false, message: "No disponible." };
    if (result.ok) {
      if (!state.psychology) state.psychology = {};
      state.psychology.captainId = playerId;
      state.psychology.captainAppointedWeek = state.currentWeek || 1;
      state.psychology.captainAppointedSeason = state.seasonNumber || 1;
      state.psychology.captainSeasonsCount = state.psychology.captainSeasonsCount || 0;
    }
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  // ═══════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════

  FMG.SquadPsychologyExtended = {
    ensureEgo: ensureEgo,
    ensureToxicity: ensureToxicity,
    updateToxicity: updateToxicity,
    ensureFactions: ensureFactions,
    updateFactions: updateFactions,
    detectMentors: detectMentors,
    updateMentorEffects: updateMentorEffects,
    addDressingRoomEvent: addDressingRoomEvent,
    ensureDressingRoomEvents: ensureDressingRoomEvents,
    runExtendedPsychologyWeek: runExtendedPsychologyWeek,
    updateCaptainInfluence: updateCaptainInfluence
  };
})();
