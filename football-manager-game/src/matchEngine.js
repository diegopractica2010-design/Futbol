(function () {
  const FMG = (window.FMG = window.FMG || {});

  const MATCH_CONSTANTS = {
    pressureBase: 0.34,
    foulBase: 0.052,
    foulMax: 0.10,
    injuryBase: 0.004,
    possessionSwingFactor: 0.08
  };

  FMG.MATCH_CONSTANTS = MATCH_CONSTANTS;

  // =============================================================================
  // ARQUITECTURA CANÓNICA DE PARTIDOS
  // =============================================================================
  // FUENTE DE VERDAD ÚNICA:
  // - FMG.simulateMatch() — Simulación offline de un partido completo
  // - FMG.createLiveMatch() + FMG.advanceLiveMatch() — Partido interactivo del usuario
  //
  // AMBOS flujos escriben ÚNICAMENTE mediante:
  // - FMG.finishLiveUserMatch() → FMG.updateStandings()
  // - FMG.finishLiveUserMatch() → FMG.applyMatchSquadStats()
  //
  // PROHIBIDO:
  // - Las fases experimentales (15-24) escriben en standings o seasonStats
  // - Usar resultados de motores visuales como fuente de verdad
  // - Simular partidos sin guardar el seed para reproducibilidad
  //
  // MOTORES VISUALES (Fases 15-24):
  // - Prototipos, NO afectan la simulación de carrera
  // - Sandbox exclusivamente para visualización 3D
  // - Usar FMG.gameState como referencia, nunca como destino

  function ratingFromSquad(players) {
    const starters = (FMG.deterministicSort || ((items, comparator) => [...items].sort(comparator)))(players, (left, right) => right.overall - left.overall).slice(0, 11);
    const quality = FMG.average(starters.map((player) => player.overall));
    const morale = FMG.average(starters.map((player) => player.morale));
    const energy = FMG.average(starters.map((player) => player.energy));
    return quality * 0.58 + morale * 0.22 + energy * 0.2;
  }

  function pickAttacker(squad) {
    const attackers = squad.filter((player) => ["DEL", "EXT", "MED"].includes(player.position));
    const pool = attackers.length ? attackers : squad;
    const weighted = [];
    pool.forEach((player) => {
      const weight = player.position === "DEL" ? 5 : player.position === "EXT" ? 4 : player.position === "MED" ? 3 : 1;
      for (let index = 0; index < weight; index += 1) weighted.push(player);
    });
    return FMG.sample(weighted);
  }

  function pickDefender(squad) {
    const defenders = squad.filter((player) => ["DEF", "MED"].includes(player.position));
    return FMG.sample(defenders.length ? defenders : squad);
  }

  function emptyStats() {
    return {
      possession: 50,
      shots: 0,
      shotsOnTarget: 0,
      xg: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      corners: 0
    };
  }

  function createBlankResult(homeTeam, awayTeam) {
    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals: 0,
      awayGoals: 0,
      homeEvents: [],
      awayEvents: [],
      stats: {
        home: emptyStats(),
        away: emptyStats()
      },
      cards: [],
      injuries: [],
      timeline: [],
      summary: "El partido esta en desarrollo."
    };
  }

  function addTimeline(timeline, minute, type, teamId, text, extra = {}) {
    timeline.push({ minute, type, teamId, text, ...extra });
  }

  function createSummary(homeTeam, awayTeam, homeGoals, awayGoals, homeStats, awayStats) {
    if (homeGoals === awayGoals) {
      return `Partido parejo: ${homeTeam.name} genero ${homeStats.xg.toFixed(1)} xG y ${awayTeam.name} respondio con ${awayStats.xg.toFixed(1)}.`;
    }
    const winner = homeGoals > awayGoals ? homeTeam : awayTeam;
    const winnerStats = homeGoals > awayGoals ? homeStats : awayStats;
    return `${winner.name} fue mas claro en las areas y cerro el partido con ${winnerStats.shotsOnTarget} remates al arco.`;
  }

  function getLiveSquads(liveMatch, state) {
    const homeAvailable = FMG.getAvailablePlayers(state.players, liveMatch.homeTeamId);
    const awayAvailable = FMG.getAvailablePlayers(state.players, liveMatch.awayTeamId);
    const homeById = Object.fromEntries(homeAvailable.map((player) => [player.id, player]));
    const awayById = Object.fromEntries(awayAvailable.map((player) => [player.id, player]));
    return {
      homePlayers: liveMatch.homeLineupIds.map((id) => homeById[id]).filter(Boolean),
      awayPlayers: liveMatch.awayLineupIds.map((id) => awayById[id]).filter(Boolean)
    };
  }

  function addLiveMinuteEvent(liveMatch, state, minute) {
    const homeTeam = state.teams.find((team) => team.id === liveMatch.homeTeamId);
    const awayTeam = state.teams.find((team) => team.id === liveMatch.awayTeamId);
    const { homePlayers, awayPlayers } = getLiveSquads(liveMatch, state);
    const homeProfile = FMG.getTacticalMatchProfile(state, liveMatch.homeTeamId);
    const awayProfile = FMG.getTacticalMatchProfile(state, liveMatch.awayTeamId);
    applyLiveOrders(liveMatch.liveOrders?.home, homeProfile);
    applyLiveOrders(liveMatch.liveOrders?.away, awayProfile);
    const homeStrength = FMG.computeTeamStrength(homeTeam, state.players, state) + 4 + (liveMatch.tacticalBoost.home || 0) + liveOrderStrength(liveMatch.liveOrders?.home);
    const awayStrength = FMG.computeTeamStrength(awayTeam, state.players, state) + (liveMatch.tacticalBoost.away || 0) + liveOrderStrength(liveMatch.liveOrders?.away);
    const strengthDelta = FMG.clamp(homeStrength - awayStrength, -24, 24);
    const baseHomePossession = FMG.clamp(Math.round(50 + strengthDelta * 0.38 + (homeProfile.possession - awayProfile.possession) * 0.75 + FMG.randomInt(-4, 4)), 32, 68);
    const homePossession = FMG.clamp(Math.round((liveMatch.result.stats.home.possession * 0.85) + (baseHomePossession * 0.15)), 32, 68);
    const result = liveMatch.result;

    result.stats.home.possession = homePossession;
    result.stats.away.possession = 100 - homePossession;

    const isHomeAttack = FMG.rng() * 100 < homePossession;
    const attackTeam = isHomeAttack ? homeTeam : awayTeam;
    const defendTeam = isHomeAttack ? awayTeam : homeTeam;
    const attackSquad = isHomeAttack ? homePlayers : awayPlayers;
    const defendSquad = isHomeAttack ? awayPlayers : homePlayers;
    const attackStats = isHomeAttack ? result.stats.home : result.stats.away;
    const defendStats = isHomeAttack ? result.stats.away : result.stats.home;
    const attackEvents = isHomeAttack ? result.homeEvents : result.awayEvents;
    const attackStrength = isHomeAttack ? homeStrength : awayStrength;
    const defendStrength = isHomeAttack ? awayStrength : homeStrength;
    const attackProfile = isHomeAttack ? homeProfile : awayProfile;
    const defendProfile = isHomeAttack ? awayProfile : homeProfile;
    const attacker = pickLiveAttacker(attackSquad, liveMatch.playerOrders);
    const defender = pickDefender(defendSquad);
    const boostKey = isHomeAttack ? "homeTurns" : "awayTurns";
    const activeBoost = liveMatch.tacticBoost?.[boostKey] > 0 ? (liveMatch.tacticBoost[userSideFromAttack(liveMatch, isHomeAttack)] || 0) * 0.018 : 0;
    const pressure = FMG.clamp(
      MATCH_CONSTANTS.pressureBase + activeBoost + (attackStrength - defendStrength) / 115 + (attackProfile.chance + attackProfile.attack - defendProfile.defense + defendProfile.risk * 0.25) / 135 + FMG.randomInt(-8, 8) / 100,
      0.1,
      0.76
    );

    if (!attacker || !defender) return;

    if (FMG.rng() < FMG.clamp(MATCH_CONSTANTS.foulBase + (defendProfile.fouls + defendProfile.risk * 0.18) / 360, 0.025, MATCH_CONSTANTS.foulMax)) {
      const cardRoll = FMG.rng();
      const color = cardRoll > 0.965 ? "red" : cardRoll > 0.74 ? "yellow" : null;
      defendStats.fouls += 1;
      if (color) {
        if (color === "red") defendStats.redCards += 1;
        else defendStats.yellowCards += 1;
        result.cards.push({ minute, teamId: defendTeam.id, playerId: defender.id, playerName: defender.name, color });
        addTimeline(result.timeline, minute, color === "red" ? "red-card" : "yellow-card", defendTeam.id, `${defender.name} recibe ${color === "red" ? "roja" : "amarilla"}.`, { playerId: defender.id });
        if (color === "red") {
          const lineupKey = defendTeam.id === liveMatch.homeTeamId ? "homeLineupIds" : "awayLineupIds";
          liveMatch[lineupKey] = liveMatch[lineupKey].filter((id) => id !== defender.id);
          liveMatch.momentum = FMG.clamp(liveMatch.momentum + (isHomeAttack ? 8 : -8), 0, 100);
        }
      } else {
        addTimeline(result.timeline, minute, "foul", defendTeam.id, `${defender.name} corta el avance de ${attacker.name}.`);
      }
      return;
    }

    if (FMG.rng() < pressure) {
      const shotQuality = FMG.clamp(
        0.06 + (attacker.overall - 62) / 225 + (attacker.energy - 70) / 900 + (attackProfile.attack + defendProfile.risk - defendProfile.defense) / 560 + FMG.randomInt(0, 10) / 100,
        0.035,
        0.4
      );
      const onTargetChance = FMG.clamp(0.28 + attacker.overall / 270 + shotQuality * 0.4, 0.3, 0.76);
      const isGoal = FMG.rng() < shotQuality;
      const isOnTarget = isGoal || FMG.rng() < onTargetChance;
      attackStats.shots += 1;
      attackStats.xg += shotQuality;
      if (isOnTarget) attackStats.shotsOnTarget += 1;
      if (FMG.rng() < 0.16) attackStats.corners += 1;

      if (isGoal) {
        const goal = { minute, scorer: attacker.name, playerId: attacker.id, xg: shotQuality };
        attackEvents.push(goal);
        result.homeGoals = result.homeEvents.length;
        result.awayGoals = result.awayEvents.length;
        liveMatch.momentum = FMG.clamp(liveMatch.momentum + (isHomeAttack ? 12 : -12), 0, 100);
        addTimeline(result.timeline, minute, "goal", attackTeam.id, `Gol de ${attacker.name} para ${attackTeam.name}.`, { playerId: attacker.id, xg: shotQuality });
      } else {
        liveMatch.momentum = FMG.clamp(liveMatch.momentum + (isHomeAttack ? 2 : -2), 0, 100);
        addTimeline(
          result.timeline,
          minute,
          isOnTarget ? "shot-on-target" : "shot",
          attackTeam.id,
          isOnTarget ? `${attacker.name} exige al arquero.` : `${attacker.name} remata desviado.`,
          { playerId: attacker.id, xg: shotQuality }
        );
      }
    } else if (FMG.rng() < 0.16) {
      addTimeline(result.timeline, minute, "chance", attackTeam.id, `${attackTeam.name} progresa pero no encuentra remate claro.`);
    }

    if (FMG.rng() < MATCH_CONSTANTS.injuryBase) {
      const injured = FMG.sample([...attackSquad, ...defendSquad]);
      if (injured) {
        const duration = FMG.randomInt(1, 4);
        result.injuries.push({ minute, teamId: injured.teamId, playerId: injured.id, playerName: injured.name, duration });
        addTimeline(result.timeline, minute, "injury", injured.teamId, `${injured.name} queda sentido y sera baja ${duration} semana(s).`, { playerId: injured.id });
      }
    }
  }

  function userSideFromAttack(liveMatch, isHomeAttack) {
    return isHomeAttack ? "home" : "away";
  }

  function applyLiveOrders(orders, profile) {
    if (!orders) return profile;
    if (orders.mentality === "attack") { profile.attack += 4; profile.defense -= 2; profile.risk += 4; }
    if (orders.mentality === "defend") { profile.attack -= 3; profile.defense += 5; profile.risk -= 4; }
    if (orders.press === "high") { profile.possession += 3; profile.fouls += 3; profile.fatigue += 2; profile.risk += 2; }
    if (orders.press === "low") { profile.defense += 2; profile.fouls -= 2; profile.fatigue -= 1; }
    if (orders.tempo === "fast") { profile.attack += 3; profile.chance += 3; profile.risk += 3; }
    if (orders.tempo === "slow") { profile.possession += 3; profile.risk -= 2; }
    if (orders.risk === "safe") { profile.risk -= 4; profile.defense += 2; profile.attack -= 1; }
    if (orders.risk === "direct") { profile.risk += 4; profile.attack += 3; profile.possession -= 2; }
    return profile;
  }

  function liveOrderStrength(orders) {
    if (!orders) return 0;
    let value = 0;
    if (orders.mentality === "attack") value += 1.5;
    if (orders.mentality === "defend") value += 0.5;
    if (orders.press === "high") value += 1;
    if (orders.tempo === "fast") value += 1;
    if (orders.risk === "direct") value += 0.8;
    if (orders.risk === "safe") value -= 0.4;
    return value;
  }

  function pickLiveAttacker(players, playerOrders) {
    const focused = players.filter((player) => {
      const order = playerOrders && playerOrders[player.id];
      return order === "shoot" || order === "free" || order === "run";
    });
    if (focused.length && FMG.rng() < 0.55) return FMG.sample(focused);
    return pickAttacker(players);
  }

  FMG.computeTeamStrength = function (team, players, state) {
    const squad = state ? FMG.getMatchSquad(state, team.id) : players.filter((player) => player.teamId === team.id);
    const base = ratingFromSquad(squad);
    const tacticalBonus = team.style === "Presion" ? 3 : team.style === "Posesion" ? 2 : 1;
    const profile = state ? FMG.getTacticalMatchProfile(state, team.id) : { attack: 0, defense: 0 };
    const availabilityPenalty = squad.length < 11 ? (11 - squad.length) * 4 : 0;
    const difficulty = state?.settings?.difficulty || "normal";
    const modifier = FMG.DIFFICULTY_MODIFIERS?.[difficulty] || FMG.DIFFICULTY_MODIFIERS?.normal || { matchBonus: 0 };
    const userAdjustment = state && team.id === state.userTeamId
      ? modifier.matchBonus
      : state && team.id !== state.userTeamId
        ? difficulty === "easy" ? -1 : difficulty === "hard" ? 2 : difficulty === "expert" ? 4 : 0
        : 0;
    return base + tacticalBonus + profile.attack * 0.35 + profile.defense * 0.2 + team.form * 0.6 - availabilityPenalty + userAdjustment;
  };

  FMG.simulateMatch = function ({ homeTeam, awayTeam, players, state }) {
    const homePlayers = state ? FMG.getMatchSquad(state, homeTeam.id) : players.filter((player) => player.teamId === homeTeam.id).slice(0, 11);
    const awayPlayers = state ? FMG.getMatchSquad(state, awayTeam.id) : players.filter((player) => player.teamId === awayTeam.id).slice(0, 11);
    const homeProfile = state ? FMG.getTacticalMatchProfile(state, homeTeam.id) : { possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0, fouls: 0, chance: 0 };
    const awayProfile = state ? FMG.getTacticalMatchProfile(state, awayTeam.id) : { possession: 0, attack: 0, defense: 0, risk: 0, fatigue: 0, fouls: 0, chance: 0 };
    const homeStrength = FMG.computeTeamStrength(homeTeam, players, state) + 4;
    const awayStrength = FMG.computeTeamStrength(awayTeam, players, state);
    const strengthDelta = FMG.clamp(homeStrength - awayStrength, -24, 24);
    const tacticalPossession = homeProfile.possession - awayProfile.possession;
    const homePossession = FMG.clamp(Math.round(50 + strengthDelta * 0.38 + tacticalPossession * 0.75 + FMG.randomInt(-5, 5)), 32, 68);
    const awayPossession = 100 - homePossession;
    const homeStats = emptyStats();
    const awayStats = emptyStats();
    const homeEvents = [];
    const awayEvents = [];
    const cards = [];
    const injuries = [];
    const timeline = [];

    homeStats.possession = homePossession;
    awayStats.possession = awayPossession;

    for (let minute = 2; minute <= 90;) {
      const step = FMG.randomInt(2, 4);
      minute += step;
      if (minute > 90) break;
      const isHomeAttack = FMG.rng() * 100 < homePossession;
      const attackTeam = isHomeAttack ? homeTeam : awayTeam;
      const defendTeam = isHomeAttack ? awayTeam : homeTeam;
      const attackSquad = isHomeAttack ? homePlayers : awayPlayers;
      const defendSquad = isHomeAttack ? awayPlayers : homePlayers;
      const attackStats = isHomeAttack ? homeStats : awayStats;
      const attackEvents = isHomeAttack ? homeEvents : awayEvents;
      const attackStrength = isHomeAttack ? homeStrength : awayStrength;
      const defendStrength = isHomeAttack ? awayStrength : homeStrength;
      const attackProfile = isHomeAttack ? homeProfile : awayProfile;
      const defendProfile = isHomeAttack ? awayProfile : homeProfile;
      const attacker = pickAttacker(attackSquad);
      const defender = pickDefender(defendSquad);
      const pressure = FMG.clamp(
        (MATCH_CONSTANTS.pressureBase * step) + (attackStrength - defendStrength) / 115 + (attackProfile.chance + attackProfile.attack - defendProfile.defense + defendProfile.risk * 0.25) / 135 + FMG.randomInt(-8, 8) / 100,
        0.1,
        0.86
      );

      if (!attacker || !defender) continue;

      if (FMG.rng() < FMG.clamp((MATCH_CONSTANTS.foulBase * step) + (defendProfile.fouls + defendProfile.risk * 0.18) / 360, 0.025, MATCH_CONSTANTS.foulMax * step)) {
        const cardRoll = FMG.rng();
        const color = cardRoll > 0.96 ? "red" : cardRoll > 0.72 ? "yellow" : null;
        const defendingStats = isHomeAttack ? awayStats : homeStats;
        defendingStats.fouls += 1;
        if (color) {
          if (color === "red") defendingStats.redCards += 1;
          else defendingStats.yellowCards += 1;
          cards.push({ minute, teamId: defendTeam.id, playerId: defender.id, playerName: defender.name, color });
          addTimeline(timeline, minute, color === "red" ? "red-card" : "yellow-card", defendTeam.id, `${defender.name} recibe ${color === "red" ? "roja" : "amarilla"}.`, { playerId: defender.id });
        } else {
          addTimeline(timeline, minute, "foul", defendTeam.id, `${defender.name} corta el avance de ${attacker.name}.`);
        }
        continue;
      }

      if (FMG.rng() < pressure) {
        const shotQuality = FMG.clamp(
          0.07 + (attacker.overall - 62) / 210 + (attacker.energy - 70) / 800 + (attackProfile.attack + defendProfile.risk - defendProfile.defense) / 520 + FMG.randomInt(0, 10) / 100,
          0.04,
          0.42
        );
        const onTargetChance = FMG.clamp(0.28 + attacker.overall / 260 + shotQuality * 0.45, 0.32, 0.78);
        const isGoal = FMG.rng() < shotQuality;
        const isOnTarget = isGoal || FMG.rng() < onTargetChance;
        attackStats.shots += 1;
        attackStats.xg += shotQuality;
        if (isOnTarget) attackStats.shotsOnTarget += 1;
        if (FMG.rng() < 0.16) attackStats.corners += 1;

        if (isGoal) {
          const goal = { minute, scorer: attacker.name, playerId: attacker.id, xg: shotQuality };
          attackEvents.push(goal);
          addTimeline(timeline, minute, "goal", attackTeam.id, `Gol de ${attacker.name} para ${attackTeam.name}.`, { playerId: attacker.id, xg: shotQuality });
        } else {
          addTimeline(
            timeline,
            minute,
            isOnTarget ? "shot-on-target" : "shot",
            attackTeam.id,
            isOnTarget ? `${attacker.name} exige al arquero.` : `${attacker.name} remata desviado.`,
            { playerId: attacker.id, xg: shotQuality }
          );
        }
      } else if (FMG.rng() < 0.35) {
        addTimeline(timeline, minute, "chance", attackTeam.id, `${attackTeam.name} progresa pero no encuentra remate claro.`);
      }

      if (FMG.rng() < MATCH_CONSTANTS.injuryBase * step) {
        const injured = FMG.sample([...attackSquad, ...defendSquad]);
        if (injured) {
          const duration = FMG.randomInt(1, 4);
          injuries.push({ minute, teamId: injured.teamId, playerId: injured.id, playerName: injured.name, duration });
          addTimeline(timeline, minute, "injury", injured.teamId, `${injured.name} queda sentido y sera baja ${duration} semana(s).`, { playerId: injured.id });
        }
      }
    }

    const homeGoals = homeEvents.length;
    const awayGoals = awayEvents.length;

    homePlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(5 + Math.max(0, Math.round(homeProfile.fatigue / 2)), 12 + Math.max(0, Math.round(homeProfile.fatigue))), 30, 100);
      player.morale = FMG.clamp(player.morale + (homeGoals >= awayGoals ? 2 : -2), 40, 100);
    });

    awayPlayers.forEach((player) => {
      player.energy = FMG.clamp(player.energy - FMG.randomInt(5 + Math.max(0, Math.round(awayProfile.fatigue / 2)), 12 + Math.max(0, Math.round(awayProfile.fatigue))), 30, 100);
      player.morale = FMG.clamp(player.morale + (awayGoals >= homeGoals ? 2 : -2), 40, 100);
    });

    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals,
      awayGoals,
      homeEvents: (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(homeEvents, (left, right) => left.minute - right.minute),
      awayEvents: (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(awayEvents, (left, right) => left.minute - right.minute),
      stats: {
        home: { ...homeStats, xg: Number(homeStats.xg.toFixed(2)) },
        away: { ...awayStats, xg: Number(awayStats.xg.toFixed(2)) }
      },
      cards,
      injuries,
      timeline: (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(timeline, (left, right) => left.minute - right.minute),
      summary: createSummary(homeTeam, awayTeam, homeGoals, awayGoals, homeStats, awayStats)
    };
  };

  FMG.createLiveMatch = function ({ homeTeam, awayTeam, state, week, otherMatches, seed }) {
    if (seed === undefined) {
      const baseSeed = state.seed || FMG.getCurrentSeed?.() || 1;
      const salt = `${homeTeam.id}|${awayTeam.id}|${week || state.currentWeek || 1}|${state.seasonNumber || 1}`;
      seed = FMG.Core?.Utils?.deriveSeed
        ? FMG.Core.Utils.deriveSeed(baseSeed, week || 1, FMG.Core.Utils.hashSeed(salt))
        : (baseSeed ^ (week || 1) ^ salt.length) >>> 0;
    }
    FMG.initRNG(seed);

    const homeSquad = FMG.getMatchSquad(state, homeTeam.id);
    const awaySquad = FMG.getMatchSquad(state, awayTeam.id);
    const homeBench = FMG.getAvailablePlayers(state.players, homeTeam.id).filter((player) => !homeSquad.some((starter) => starter.id === player.id));
    const awayBench = FMG.getAvailablePlayers(state.players, awayTeam.id).filter((player) => !awaySquad.some((starter) => starter.id === player.id));
    return {
      active: true,
      completed: false,
      paused: false,
      speed: 5,
      minute: 0,
      week,
      seed: seed, // Guardar seed para reproducibilidad
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      otherMatches: otherMatches || [],
      homeLineupIds: homeSquad.map((player) => player.id),
      awayLineupIds: awaySquad.map((player) => player.id),
      homeBenchIds: homeBench.slice(0, 7).map((player) => player.id),
      awayBenchIds: awayBench.slice(0, 7).map((player) => player.id),
      substitutions: { home: 0, away: 0 },
      tacticBoost: { home: 0, away: 0, homeTurns: 0, awayTurns: 0 },
      tacticalBoost: { home: 0, away: 0 },
      liveOrders: {
        home: { mentality: "balanced", press: "normal", tempo: "normal", risk: "normal" },
        away: { mentality: "balanced", press: "normal", tempo: "normal", risk: "normal" }
      },
      playerOrders: {},
      momentum: 50,
      result: createBlankResult(homeTeam, awayTeam)
    };
  };

  // Restaurar RNG desde un liveMatch (usado al cargar save)
  FMG.restoreRNGFromLiveMatch = function (liveMatch) {
    if (liveMatch && liveMatch.seed !== undefined) {
      FMG.initRNG(liveMatch.seed);
    }
  };

  FMG.advanceLiveMatch = function (state, minutes) {
    const liveMatch = state.liveMatch;
    if (!liveMatch || liveMatch.completed) return { ok: false, message: "No hay partido en vivo activo." };
    const step = Number.isFinite(minutes) ? Math.max(1, Math.min(90, minutes)) : liveMatch.speed;
    const targetMinute = Math.min(90, liveMatch.minute + step);

    for (let minute = liveMatch.minute + 1; minute <= targetMinute; minute += 1) {
      liveMatch.minute = minute;
      if (liveMatch.tacticBoost) {
        liveMatch.tacticBoost.homeTurns = Math.max(0, (liveMatch.tacticBoost.homeTurns || 0) - 1);
        liveMatch.tacticBoost.awayTurns = Math.max(0, (liveMatch.tacticBoost.awayTurns || 0) - 1);
      }
      if (minute % 9 === 0) {
        const { homePlayers, awayPlayers } = getLiveSquads(liveMatch, state);
        const homeFatigue = Math.max(0, Math.round(FMG.getTacticalMatchProfile(state, liveMatch.homeTeamId).fatigue / 3));
        const awayFatigue = Math.max(0, Math.round(FMG.getTacticalMatchProfile(state, liveMatch.awayTeamId).fatigue / 3));
        homePlayers.forEach((player) => {
          player.energy = FMG.clamp(player.energy - FMG.randomInt(1, 3 + homeFatigue), 25, 100);
        });
        awayPlayers.forEach((player) => {
          player.energy = FMG.clamp(player.energy - FMG.randomInt(1, 3 + awayFatigue), 25, 100);
        });
      }
      addLiveMinuteEvent(liveMatch, state, minute);
    }

    liveMatch.result.stats.home.xg = Number(liveMatch.result.stats.home.xg.toFixed(2));
    liveMatch.result.stats.away.xg = Number(liveMatch.result.stats.away.xg.toFixed(2));
    liveMatch.result.homeEvents = (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(liveMatch.result.homeEvents, (left, right) => left.minute - right.minute);
    liveMatch.result.awayEvents = (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(liveMatch.result.awayEvents, (left, right) => left.minute - right.minute);
    liveMatch.result.timeline = (FMG.deterministicSort || ((items, comparator) => items.sort(comparator)))(liveMatch.result.timeline, (left, right) => left.minute - right.minute);

    if (liveMatch.minute >= 90) {
      liveMatch.completed = true;
      liveMatch.active = false;
      liveMatch.result.summary = createSummary(
        state.teams.find((team) => team.id === liveMatch.homeTeamId),
        state.teams.find((team) => team.id === liveMatch.awayTeamId),
        liveMatch.result.homeGoals,
        liveMatch.result.awayGoals,
        liveMatch.result.stats.home,
        liveMatch.result.stats.away
      );
    }

    return { ok: true, message: liveMatch.completed ? "Partido finalizado." : `Partido avanzado al minuto ${liveMatch.minute}.` };
  };
})();
