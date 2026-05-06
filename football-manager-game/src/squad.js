(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.FORMATIONS = {
    "4-3-3": ["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "EXT", "EXT", "DEL"],
    "4-4-2": ["POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "DEL", "DEL"],
    "3-5-2": ["POR", "DEF", "DEF", "DEF", "MED", "MED", "MED", "MED", "EXT", "DEL", "DEL"]
  };

  FMG.TRAINING_FOCUS = {
    balanced: { label: "Equilibrado", energy: -2, morale: 1, overallChance: 0.08 },
    fitness: { label: "Fisico", energy: 5, morale: 0, overallChance: 0.04 },
    morale: { label: "Animo", energy: -1, morale: 5, overallChance: 0.03 },
    tactics: { label: "Tactico", energy: -3, morale: 1, overallChance: 0.12 }
  };

  FMG.TACTIC_OPTIONS = {
    mentality: {
      defensive: { label: "Defensiva", possession: -2, attack: -4, defense: 5, risk: -4, fatigue: -1 },
      balanced: { label: "Equilibrada", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0 },
      attacking: { label: "Ofensiva", possession: 2, attack: 5, defense: -3, risk: 5, fatigue: 1 }
    },
    pressing: {
      low: { label: "Baja", possession: -2, attack: -1, defense: 2, risk: -2, fatigue: -2, fouls: -2 },
      medium: { label: "Media", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0, fouls: 0 },
      high: { label: "Alta", possession: 3, attack: 3, defense: -1, risk: 4, fatigue: 3, fouls: 4 }
    },
    tempo: {
      slow: { label: "Pausado", possession: 3, attack: -2, defense: 1, risk: -2, fatigue: -1, chance: -2 },
      normal: { label: "Normal", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0, chance: 0 },
      fast: { label: "Rapido", possession: -2, attack: 4, defense: -2, risk: 4, fatigue: 2, chance: 4 }
    },
    passing: {
      short: { label: "Corto", possession: 4, attack: -1, defense: 1, risk: -1, fatigue: 0 },
      mixed: { label: "Mixto", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0 },
      direct: { label: "Directo", possession: -4, attack: 3, defense: -1, risk: 3, fatigue: 1, chance: 2 }
    },
    width: {
      narrow: { label: "Cerrada", possession: 1, attack: -1, defense: 3, risk: -1, fatigue: 0 },
      balanced: { label: "Media", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0 },
      wide: { label: "Amplia", possession: 1, attack: 3, defense: -2, risk: 3, fatigue: 1, chance: 2 }
    },
    defensiveLine: {
      deep: { label: "Baja", possession: -2, attack: -2, defense: 5, risk: -5, fatigue: -1 },
      standard: { label: "Media", possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0 },
      high: { label: "Alta", possession: 2, attack: 3, defense: -3, risk: 6, fatigue: 2, fouls: 2 }
    },
    role: {
      balanced: { label: "Equilibrado", attack: 0, defense: 0, risk: 0, fatigue: 0 },
      attacking: { label: "Ataque", attack: 1.4, defense: -0.7, risk: 0.8, fatigue: 0.5 },
      defensive: { label: "Defensa", attack: -0.8, defense: 1.3, risk: -0.8, fatigue: 0.2 },
      support: { label: "Apoyo", possession: 0.9, attack: 0.4, defense: 0.4, risk: -0.2, fatigue: 0.3 }
    }
  };

  FMG.INDIVIDUAL_INSTRUCTIONS = {
    none: { label: "Normal", attack: 0, defense: 0, risk: 0, fatigue: 0 },
    pressMore: { label: "Presionar", attack: 0.4, defense: 0.2, risk: 0.6, fatigue: 0.7, fouls: 0.5 },
    stayBack: { label: "Guardar posicion", attack: -0.5, defense: 0.8, risk: -0.6, fatigue: -0.2 },
    takeRisks: { label: "Arriesgar", possession: -0.4, attack: 0.9, risk: 0.8, fatigue: 0.3 }
  };

  FMG.SQUAD_ROLES = {
    key: { label: "Figura", expectedStarts: 0.78, morale: 2 },
    starter: { label: "Titular", expectedStarts: 0.58, morale: 1 },
    rotation: { label: "Rotacion", expectedStarts: 0.34, morale: 0 },
    backup: { label: "Suplente", expectedStarts: 0.16, morale: -1 },
    youth: { label: "Juvenil", expectedStarts: 0.08, morale: 0 }
  };

  const PERSONALITIES = ["Profesional", "Ambicioso", "Leal", "Competitivo", "Volatil"];

  function seededValue(player, salt) {
    const source = `${player.id}-${player.name}-${salt}`;
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) % 9973;
    }
    return hash;
  }

  function attributeBase(player, name, index) {
    const variance = (seededValue(player, name) % 13) - 6;
    const positionBoosts = {
      POR: { defense: 10, physical: 3, mentality: 4, shooting: -12 },
      DEF: { defense: 9, physical: 4, shooting: -5 },
      MED: { passing: 8, technique: 5, mentality: 4 },
      EXT: { speed: 8, technique: 5, shooting: 2, defense: -4 },
      DEL: { shooting: 10, technique: 3, speed: 2, defense: -7 }
    };
    const boost = positionBoosts[player.position]?.[name] || 0;
    return FMG.clamp(Math.round(player.overall + boost + variance + (index % 3) - 1), 35, 95);
  }

  function ensureDetailedAttributes(player, index) {
    player.attributes = player.attributes || {};
    ["speed", "passing", "shooting", "defense", "physical", "technique", "mentality"].forEach((name) => {
      if (!Number.isFinite(player.attributes[name])) {
        player.attributes[name] = attributeBase(player, name, index);
      }
    });
  }

  function defaultSquadRole(player) {
    if (player.age <= 21 && player.overall < 70) return "youth";
    if (player.overall >= 77) return "key";
    if (player.overall >= 72) return "starter";
    if (player.overall >= 68) return "rotation";
    return "backup";
  }

  function addMoraleEntry(player, reason, amount) {
    player.moraleLog = player.moraleLog || [];
    player.moraleLog.unshift({ week: FMG.gameState?.currentWeek || 0, reason, amount });
    player.moraleLog = player.moraleLog.slice(0, 6);
  }

  function defaultPlayerRoles() {
    return { POR: "balanced", DEF: "defensive", MED: "support", EXT: "attacking", DEL: "attacking" };
  }

  function createDefaultTeamPlan(formation) {
    return {
      formation,
      trainingFocus: "balanced",
      mentality: "balanced",
      pressing: "medium",
      tempo: "normal",
      passing: "mixed",
      width: "balanced",
      defensiveLine: "standard",
      playerRoles: defaultPlayerRoles(),
      instructions: {},
      lineup: []
    };
  }

  function normalizeTeamPlan(plan, formation) {
    const normalized = { ...createDefaultTeamPlan(formation), ...(plan || {}) };
    normalized.playerRoles = { ...defaultPlayerRoles(), ...(normalized.playerRoles || {}) };
    normalized.instructions = normalized.instructions || {};
    return normalized;
  }

  function ratingForSlot(player, slot) {
    let score = player.overall;
    if (player.position === slot) score += 8;
    if (slot === "MED" && player.position === "EXT") score += 2;
    if (slot === "EXT" && player.position === "MED") score += 1;
    if (slot === "DEL" && player.position === "EXT") score += 2;
    score += player.energy * 0.08 + player.morale * 0.05;
    return score;
  }

  function pickForSlots(players, slots) {
    const remaining = [...players];
    return slots.map((slot) => {
      if (!remaining.length) return null;
      remaining.sort((left, right) => ratingForSlot(right, slot) - ratingForSlot(left, slot));
      return remaining.shift();
    }).filter(Boolean);
  }

  FMG.preparePlayersForSeason = function (players, options = {}) {
    const newSeason = options.newSeason === true;
    players.forEach((player, index) => {
      if (!Number.isFinite(player.contractYears)) {
        player.contractYears = FMG.clamp(player.contractYears || 2 + (index % 3), 1, 5);
      }
      if (!Number.isFinite(player.potential)) {
        player.potential = FMG.clamp(player.overall + 3 + (index % 7), player.overall, 90);
      }
      player.injuredWeeks = newSeason ? 0 : player.injuredWeeks || 0;
      player.suspendedWeeks = newSeason ? 0 : player.suspendedWeeks || 0;
      player.seasonStats = newSeason || !player.seasonStats
        ? { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 }
        : player.seasonStats;
      player.seasonStats.appearances = player.seasonStats.appearances || 0;
      player.seasonStats.starts = player.seasonStats.starts || 0;
      player.seasonStats.minutes = player.seasonStats.minutes || 0;
      player.seasonStats.shots = player.seasonStats.shots || 0;
      ensureDetailedAttributes(player, index);
      player.squadRole = player.squadRole || defaultSquadRole(player);
      player.personality = player.personality || PERSONALITIES[seededValue(player, "personality") % PERSONALITIES.length];
      player.leadership = Number.isFinite(player.leadership) ? player.leadership : FMG.clamp(Math.round(player.attributes.mentality * 0.7 + player.age * 0.8 + (seededValue(player, "leadership") % 9) - 4), 35, 95);
      player.happiness = Number.isFinite(player.happiness) ? player.happiness : FMG.clamp(player.morale + FMG.SQUAD_ROLES[player.squadRole].morale, 0, 100);
      player.moraleReason = player.moraleReason || "Inicio de temporada";
      player.moraleLog = player.moraleLog || [{ week: 0, reason: player.moraleReason, amount: 0 }];
      player.injuryHistory = newSeason ? (player.injuryHistory || []) : player.injuryHistory || [];
      player.retired = Boolean(player.retired);
    });
  };

  FMG.initializeTeamPlans = function (state) {
    state.tactics = state.tactics || { teamSettings: {}, trainingUsedWeek: 0 };
    state.tactics.teamSettings = state.tactics.teamSettings || {};
    state.teams.forEach((team, index) => {
      const defaultFormation = index % 3 === 0 ? "4-3-3" : index % 3 === 1 ? "4-4-2" : "3-5-2";
      const current = state.tactics.teamSettings[team.id] || {};
      state.tactics.teamSettings[team.id] = normalizeTeamPlan(current, current.formation || defaultFormation);
      if (!state.tactics.teamSettings[team.id].captainId) {
        const leaders = state.players
          .filter((player) => player.teamId === team.id && !player.retired)
          .sort((left, right) => right.leadership - left.leadership);
        state.tactics.teamSettings[team.id].captainId = leaders[0]?.id || null;
      }
      FMG.autoSelectLineup(state, team.id);
    });
  };

  FMG.getTeamPlan = function (state, teamId) {
    if (!state.tactics || !state.tactics.teamSettings || !state.tactics.teamSettings[teamId]) {
      FMG.initializeTeamPlans(state);
    }
    return state.tactics.teamSettings[teamId];
  };

  FMG.getAvailablePlayers = function (players, teamId) {
    return players.filter((player) =>
      player.teamId === teamId &&
      !player.retired &&
      (player.injuredWeeks || 0) <= 0 &&
      (player.suspendedWeeks || 0) <= 0
    );
  };

  FMG.autoSelectLineup = function (state, teamId) {
    const plan = FMG.getTeamPlan(state, teamId);
    const slots = FMG.FORMATIONS[plan.formation] || FMG.FORMATIONS["4-3-3"];
    const available = FMG.getAvailablePlayers(state.players, teamId);
    const selected = pickForSlots(available, slots);
    plan.lineup = selected.map((player) => player.id);
    return selected;
  };

  FMG.getMatchSquad = function (state, teamId) {
    const plan = FMG.getTeamPlan(state, teamId);
    const available = FMG.getAvailablePlayers(state.players, teamId);
    const byId = Object.fromEntries(available.map((player) => [player.id, player]));
    const selected = plan.lineup.map((id) => byId[id]).filter(Boolean);
    if (selected.length >= 11) return selected.slice(0, 11);
    const selectedIds = new Set(selected.map((player) => player.id));
    const extras = available
      .filter((player) => !selectedIds.has(player.id))
      .sort((left, right) => right.overall - left.overall)
      .slice(0, 11 - selected.length);
    return [...selected, ...extras];
  };

  FMG.setFormation = function (state, formation) {
    if (!FMG.FORMATIONS[formation]) return { ok: false, message: "Formacion no disponible." };
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    plan.formation = formation;
    FMG.autoSelectLineup(state, state.userTeamId);
    return { ok: true, message: `Formacion cambiada a ${formation}.` };
  };

  FMG.setTeamTactic = function (state, key, value) {
    if (!FMG.TACTIC_OPTIONS[key] || !FMG.TACTIC_OPTIONS[key][value]) {
      return { ok: false, message: "Ajuste tactico no disponible." };
    }
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    plan[key] = value;
    return { ok: true, message: `${FMG.TACTIC_OPTIONS[key][value].label} aplicado.` };
  };

  FMG.setPositionRole = function (state, position, role) {
    if (!["POR", "DEF", "MED", "EXT", "DEL"].includes(position) || !FMG.TACTIC_OPTIONS.role[role]) {
      return { ok: false, message: "Rol no disponible." };
    }
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    plan.playerRoles[position] = role;
    return { ok: true, message: `Rol ${FMG.TACTIC_OPTIONS.role[role].label.toLowerCase()} asignado a ${position}.` };
  };

  FMG.setPlayerInstruction = function (state, playerId, instruction) {
    if (!FMG.INDIVIDUAL_INSTRUCTIONS[instruction]) return { ok: false, message: "Instruccion no disponible." };
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userTeamId);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    const plan = FMG.getTeamPlan(state, state.userTeamId);
    plan.instructions[playerId] = instruction;
    return { ok: true, message: `${player.name}: ${FMG.INDIVIDUAL_INSTRUCTIONS[instruction].label}.` };
  };

  FMG.setSquadRole = function (state, playerId, role) {
    if (!FMG.SQUAD_ROLES[role]) return { ok: false, message: "Rol de plantilla no disponible." };
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userTeamId && !item.retired);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    player.squadRole = role;
    player.morale = FMG.clamp(player.morale + FMG.SQUAD_ROLES[role].morale, 0, 100);
    player.moraleReason = `Rol definido: ${FMG.SQUAD_ROLES[role].label}`;
    addMoraleEntry(player, player.moraleReason, FMG.SQUAD_ROLES[role].morale);
    return { ok: true, message: `${player.name} queda como ${FMG.SQUAD_ROLES[role].label.toLowerCase()}.` };
  };

  FMG.setCaptain = function (state, playerId) {
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userTeamId && !item.retired);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    FMG.getTeamPlan(state, state.userTeamId).captainId = player.id;
    player.morale = FMG.clamp(player.morale + 3, 0, 100);
    player.moraleReason = "Nombrado capitan";
    addMoraleEntry(player, player.moraleReason, 3);
    return { ok: true, message: `${player.name} es el capitan del equipo.` };
  };

  FMG.selectSquadPlayer = function (state, playerId) {
    const player = state.players.find((item) => item.id === playerId && item.teamId === state.userTeamId && !item.retired);
    if (!player) return { ok: false, message: "Jugador no disponible." };
    state.squadView = state.squadView || { selectedPlayerId: null, filter: "all", sort: "overall" };
    state.squadView.selectedPlayerId = player.id;
    return { ok: true, message: `Ficha abierta: ${player.name}.` };
  };

  FMG.setSquadView = function (state, key, value) {
    state.squadView = state.squadView || { selectedPlayerId: null, filter: "all", sort: "overall" };
    if (key === "filter" && !["all", "POR", "DEF", "MED", "EXT", "DEL"].includes(value)) return { ok: false, message: "Filtro no disponible." };
    if (key === "sort" && !["overall", "age", "morale", "minutes", "potential"].includes(value)) return { ok: false, message: "Orden no disponible." };
    state.squadView[key] = value;
    return { ok: true, message: "Vista de plantilla actualizada." };
  };

  FMG.updateSquadHappiness = function (state) {
    const completed = Math.max(1, state.completedWeeks || 1);
    state.players.filter((player) => player.teamId === state.userTeamId && !player.retired).forEach((player) => {
      const role = FMG.SQUAD_ROLES[player.squadRole] || FMG.SQUAD_ROLES.rotation;
      const startRatio = (player.seasonStats?.starts || 0) / completed;
      const gap = startRatio - role.expectedStarts;
      const adjustment = gap < -0.18 ? -4 : gap > 0.18 ? 3 : 1;
      player.happiness = FMG.clamp(player.happiness + adjustment, 0, 100);
      player.morale = FMG.clamp(player.morale + Math.sign(adjustment), 0, 100);
      player.moraleReason = adjustment < 0 ? "Quiere mas minutos" : adjustment > 1 ? "Conforme con su rol" : "Semana estable";
      addMoraleEntry(player, player.moraleReason, adjustment);
    });
  };

  FMG.progressPlayersForNewSeason = function (state) {
    const retired = [];
    state.players.forEach((player) => {
      if (player.retired) return;
      const minutesFactor = Math.min(1, (player.seasonStats?.minutes || 0) / 1800);
      const youngGrowth = player.age <= 24 && player.overall < player.potential && Math.random() < 0.18 + minutesFactor * 0.32;
      const veteranDecline = player.age >= 32 && Math.random() < 0.25 + (player.age - 32) * 0.04;
      if (youngGrowth) {
        player.overall += 1;
        Object.keys(player.attributes || {}).forEach((key) => {
          if (Math.random() < 0.38) player.attributes[key] = FMG.clamp(player.attributes[key] + 1, 35, 99);
        });
        player.moraleReason = "Progreso por desarrollo";
        addMoraleEntry(player, player.moraleReason, 2);
      }
      if (veteranDecline) {
        player.overall = Math.max(45, player.overall - 1);
        Object.keys(player.attributes || {}).forEach((key) => {
          if (Math.random() < 0.28) player.attributes[key] = FMG.clamp(player.attributes[key] - 1, 30, 99);
        });
      }
      if (player.age >= 36 && Math.random() < 0.3 + (player.age - 36) * 0.12) {
        player.retired = true;
        player.retiredSeason = state.seasonNumber;
        retired.push(player);
      }
    });
    retired.forEach((player) => {
      state.eventsLog.unshift({ week: state.currentWeek, title: "Retiro profesional", detail: `${player.name} anuncio su retiro del futbol.` });
    });
    state.eventsLog = state.eventsLog.slice(0, 12);
    return retired;
  };

  FMG.getTacticalMatchProfile = function (state, teamId) {
    const plan = FMG.getTeamPlan(state, teamId);
    const squad = FMG.getMatchSquad(state, teamId);
    const profile = {
      possession: 0,
      attack: 0,
      defense: 0,
      risk: 0,
      fatigue: 0,
      fouls: 0,
      chance: 0,
      description: []
    };
    ["mentality", "pressing", "tempo", "passing", "width", "defensiveLine"].forEach((key) => {
      const option = FMG.TACTIC_OPTIONS[key][plan[key]] || FMG.TACTIC_OPTIONS[key][Object.keys(FMG.TACTIC_OPTIONS[key])[0]];
      Object.keys(profile).forEach((metric) => {
        if (Number.isFinite(option[metric])) profile[metric] += option[metric];
      });
      profile.description.push(option.label);
    });
    squad.forEach((player) => {
      const role = FMG.TACTIC_OPTIONS.role[plan.playerRoles[player.position] || "balanced"];
      const instruction = FMG.INDIVIDUAL_INSTRUCTIONS[plan.instructions[player.id] || "none"];
      [role, instruction].forEach((source) => {
        Object.keys(profile).forEach((metric) => {
          if (Number.isFinite(source[metric])) profile[metric] += source[metric] / 11;
        });
      });
    });
    profile.possession = FMG.clamp(profile.possession, -12, 12);
    profile.attack = FMG.clamp(profile.attack, -12, 12);
    profile.defense = FMG.clamp(profile.defense, -12, 12);
    profile.risk = FMG.clamp(profile.risk, -14, 14);
    profile.fatigue = FMG.clamp(profile.fatigue, -5, 8);
    profile.fouls = FMG.clamp(profile.fouls, -5, 8);
    profile.chance = FMG.clamp(profile.chance, -6, 8);
    return profile;
  };

  FMG.setTrainingFocus = function (state, focus) {
    if (!FMG.TRAINING_FOCUS[focus]) return { ok: false, message: "Entrenamiento no disponible." };
    FMG.getTeamPlan(state, state.userTeamId).trainingFocus = focus;
    return { ok: true, message: `Entrenamiento fijado en ${FMG.TRAINING_FOCUS[focus].label}.` };
  };

  FMG.trainUserSquad = function (state) {
    if (state.seasonComplete) return { ok: false, message: "La temporada ya termino." };
    if (state.tactics.trainingUsedWeek === state.currentWeek) {
      return { ok: false, message: "Ya se entreno esta semana." };
    }

    const plan = FMG.getTeamPlan(state, state.userTeamId);
    const focus = FMG.TRAINING_FOCUS[plan.trainingFocus] || FMG.TRAINING_FOCUS.balanced;
    const squad = state.players.filter((player) => player.teamId === state.userTeamId);
    squad.forEach((player) => {
      player.energy = FMG.clamp(player.energy + focus.energy, 0, 100);
      player.morale = FMG.clamp(player.morale + focus.morale, 0, 100);
      if (player.overall < player.potential && Math.random() < focus.overallChance) {
        player.overall += 1;
      }
    });

    state.tactics.trainingUsedWeek = state.currentWeek;
    FMG.autoSelectLineup(state, state.userTeamId);
    return { ok: true, message: `Entrenamiento ${focus.label.toLowerCase()} completado.` };
  };

  FMG.tickPlayerAvailability = function (state) {
    state.players.forEach((player) => {
      player.injuredWeeks = Math.max(0, (player.injuredWeeks || 0) - 1);
      player.suspendedWeeks = Math.max(0, (player.suspendedWeeks || 0) - 1);
    });
  };

  FMG.applyMatchSquadStats = function (state, result) {
    const allEvents = [...result.homeEvents, ...result.awayEvents];
    [result.homeTeamId, result.awayTeamId].forEach((teamId) => {
      FMG.getMatchSquad(state, teamId).forEach((player) => {
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.appearances += 1;
        player.seasonStats.starts += 1;
        player.seasonStats.minutes += 90;
      });
    });
    allEvents.forEach((event) => {
      const player = state.players.find((item) => item.name === event.scorer);
      if (player) {
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.goals += 1;
        player.morale = FMG.clamp(player.morale + 3, 0, 100);
        player.moraleReason = "Anoto en partido oficial";
        addMoraleEntry(player, player.moraleReason, 3);
      }
    });
    (result.timeline || []).filter((event) => event.type === "shot" || event.type === "shot-on-target" || event.type === "goal").forEach((event) => {
      const player = state.players.find((item) => item.id === event.playerId);
      if (player) {
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.shots = (player.seasonStats.shots || 0) + 1;
      }
    });
    (result.cards || []).forEach((card) => {
      const player = state.players.find((item) => item.id === card.playerId);
      if (player) {
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.cards += 1;
        if (card.color === "red") player.suspendedWeeks = Math.max(player.suspendedWeeks || 0, 1);
        player.moraleReason = card.color === "red" ? "Expulsado" : "Amonestado";
        addMoraleEntry(player, player.moraleReason, card.color === "red" ? -3 : -1);
      }
    });
    (result.injuries || []).forEach((injury) => {
      const player = state.players.find((item) => item.id === injury.playerId);
      if (player) {
        player.injuredWeeks = Math.max(player.injuredWeeks || 0, injury.duration);
        player.energy = FMG.clamp(player.energy - 20, 20, 100);
        player.seasonStats = player.seasonStats || { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 };
        player.seasonStats.injuries += 1;
        player.injuryHistory = player.injuryHistory || [];
        player.injuryHistory.unshift({ week: result.week || state.currentWeek, duration: injury.duration, detail: "Lesion durante partido" });
        player.injuryHistory = player.injuryHistory.slice(0, 8);
        player.moraleReason = "Lesionado";
        addMoraleEntry(player, player.moraleReason, -4);
      }
    });
  };

  FMG.applyRandomMatchIncidents = function (state, result) {
    const matchPlayers = [
      ...FMG.getMatchSquad(state, result.homeTeamId),
      ...FMG.getMatchSquad(state, result.awayTeamId)
    ];

    if (matchPlayers.length && Math.random() < 0.08) {
      const injured = FMG.sample(matchPlayers);
      injured.injuredWeeks = FMG.randomInt(1, 4);
      injured.energy = FMG.clamp(injured.energy - 20, 20, 100);
      injured.seasonStats = injured.seasonStats || { appearances: 0, goals: 0, injuries: 0, cards: 0 };
      injured.seasonStats.injuries += 1;
      return { title: "Lesion de partido", detail: `${injured.name} estara fuera ${injured.injuredWeeks} semana(s).` };
    }

    if (matchPlayers.length && Math.random() < 0.12) {
      const suspended = FMG.sample(matchPlayers);
      suspended.suspendedWeeks = 1;
      suspended.seasonStats = suspended.seasonStats || { appearances: 0, goals: 0, injuries: 0, cards: 0 };
      suspended.seasonStats.cards += 1;
      return { title: "Sancion disciplinaria", detail: `${suspended.name} queda suspendido por una semana.` };
    }

    return null;
  };
})();
