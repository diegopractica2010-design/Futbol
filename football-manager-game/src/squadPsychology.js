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
