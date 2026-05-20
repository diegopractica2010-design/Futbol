(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 1 — CLUB DNA
  // Fixed identity per club — never changes across seasons
  // ═══════════════════════════════════════════════════════════════════════════

  const FMG_CLUB_DNA = {
    "colo-colo": {
      identity: "Presion y dominio historico",
      tacticalDNA: "pressing",
      fanExpectation: "champion",
      prestige: 95,
      traditionsKey: ["superclasico", "copa-libertadores-historia", "hinchada-pueblo"]
    },
    "u-de-chile": {
      identity: "Futbol de ataque, identidad popular",
      tacticalDNA: "attacking",
      fanExpectation: "champion",
      prestige: 90,
      traditionsKey: ["superclasico", "hinchada-caliente", "identidad-azul"]
    },
    "u-catolica": {
      identity: "Disciplina tactica, cantera solida",
      tacticalDNA: "structured",
      fanExpectation: "contender",
      prestige: 85,
      traditionsKey: ["academia", "proceso", "clasico-universitario"]
    },
    cobreloa: {
      identity: "Fuerza minera del norte",
      tacticalDNA: "pressing",
      fanExpectation: "contender",
      prestige: 68,
      traditionsKey: ["orgullo-nortino", "historia-copera"]
    },
    huachipato: {
      identity: "Solidez industrial, colectivo sobre individuo",
      tacticalDNA: "defensive",
      fanExpectation: "consistent",
      prestige: 60,
      traditionsKey: ["identidad-acero"]
    },
    palestino: {
      identity: "Identidad cultural unica, comunidad unida",
      tacticalDNA: "balanced",
      fanExpectation: "consistent",
      prestige: 58,
      traditionsKey: ["identidad-comunitaria"]
    },
    wanderers: {
      identity: "Futbol de ataque, orgullo portuario",
      tacticalDNA: "attacking",
      fanExpectation: "consistent",
      prestige: 62,
      traditionsKey: ["orgullo-puerto", "decano-chileno"]
    },
    nublense: {
      identity: "Futbol de region, cantera joven",
      tacticalDNA: "defensive",
      fanExpectation: "survival",
      prestige: 52,
      traditionsKey: ["cantera-regional"]
    },
    "la-serena": {
      identity: "Equipo de zona, arraigo local",
      tacticalDNA: "balanced",
      fanExpectation: "survival",
      prestige: 48,
      traditionsKey: ["arraigo-local"]
    },
    cobresal: {
      identity: "Altura y resistencia, mineros del desierto",
      tacticalDNA: "defensive",
      fanExpectation: "survival",
      prestige: 55,
      traditionsKey: ["fortaleza-altiplano"]
    },
    ohiggins: {
      identity: "Identidad regional fuerte, hinchada fiel",
      tacticalDNA: "structured",
      fanExpectation: "consistent",
      prestige: 58,
      traditionsKey: ["orgullo-sureño"]
    },
    everton: {
      identity: "Club historico de Vina, tradicion costena",
      tacticalDNA: "balanced",
      fanExpectation: "consistent",
      prestige: 60,
      traditionsKey: ["tradicion-vinamar"]
    },
    "deportes-antofagasta": {
      identity: "Norte grande, identidad deserticia",
      tacticalDNA: "balanced",
      fanExpectation: "survival",
      prestige: 50,
      traditionsKey: ["norte-grande"]
    },
    "union-espanola": {
      identity: "Futbol ofensivo, comunidad hispana",
      tacticalDNA: "attacking",
      fanExpectation: "consistent",
      prestige: 62,
      traditionsKey: ["identidad-hispana", "futbol-ofensivo"]
    },
    "audax-italiano": {
      identity: "Filosofia tactica, cantera formativa",
      tacticalDNA: "structured",
      fanExpectation: "consistent",
      prestige: 55,
      traditionsKey: ["filosofia-italiana", "cantera-formativa"]
    },
    "coquimbo-unido": {
      identity: "Club del norte chico, crecimiento sostenido",
      tacticalDNA: "balanced",
      fanExpectation: "survival",
      prestige: 52,
      traditionsKey: ["norte-chico"]
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 3 — STADIUM ATMOSPHERE DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const FMG_STADIUM = {
    "colo-colo": { name: "Estadio Monumental", capacity: 47000, passionRating: 95, intimidationFactor: 14 },
    "u-de-chile": { name: "Estadio Nacional", capacity: 48000, passionRating: 92, intimidationFactor: 13 },
    "u-catolica": { name: "Estadio San Carlos de Apoquindo", capacity: 20000, passionRating: 82, intimidationFactor: 9 },
    cobreloa: { name: "Estadio El Cobre", capacity: 7000, passionRating: 72, intimidationFactor: 7 },
    huachipato: { name: "Estadio CAP", capacity: 12000, passionRating: 65, intimidationFactor: 6 },
    palestino: { name: "Estadio Municipal La Cisterna", capacity: 8000, passionRating: 68, intimidationFactor: 6 },
    wanderers: { name: "Estadio Elias Figueroa", capacity: 18000, passionRating: 70, intimidationFactor: 8 },
    nublense: { name: "Estadio Nelson Oyarzun", capacity: 7000, passionRating: 60, intimidationFactor: 5 },
    "la-serena": { name: "Estadio La Portada", capacity: 10000, passionRating: 58, intimidationFactor: 5 },
    cobresal: { name: "Estadio El Cobre El Salvador", capacity: 4000, passionRating: 62, intimidationFactor: 8 },
    ohiggins: { name: "Estadio El Teniente", capacity: 12000, passionRating: 65, intimidationFactor: 6 },
    everton: { name: "Estadio Sausalito", capacity: 10000, passionRating: 66, intimidationFactor: 6 },
    "deportes-antofagasta": { name: "Estadio Regional Antofagasta", capacity: 21000, passionRating: 60, intimidationFactor: 5 },
    "union-espanola": { name: "Estadio Santa Laura", capacity: 10000, passionRating: 70, intimidationFactor: 7 },
    "audax-italiano": { name: "Estadio Bicentenario La Florida", capacity: 12000, passionRating: 62, intimidationFactor: 5 },
    "coquimbo-unido": { name: "Estadio Francisco Sanchez Rumoroso", capacity: 18000, passionRating: 63, intimidationFactor: 6 }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function ensureClubCultureState(state) {
    state.clubCulture = state.clubCulture || {};
    const cc = state.clubCulture;
    cc.version = 1;
    cc.pressureByTeam = cc.pressureByTeam || {};
    cc.derbyWeek = cc.derbyWeek || {};
    cc.postDerby = cc.postDerby || {};
    cc.activeTraditions = cc.activeTraditions || [];
    cc.homeAdvantageModifiers = cc.homeAdvantageModifiers || {};
    return cc;
  }

  function getTeam(state, teamId) {
    return (state.teams || []).find(function (t) { return t.id === teamId; }) || null;
  }

  function standingPos(state, teamId) {
    const idx = (state.standings || []).findIndex(function (e) { return e.teamId === teamId; });
    return idx >= 0 ? idx + 1 : (state.teams || []).length;
  }

  function totalTeams(state) {
    return (state.teams || []).length || 16;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 2 — FAN EXPECTATION PRESSURE
  // ═══════════════════════════════════════════════════════════════════════════

  function getPressureLevel(dna, position, total) {
    const half = Math.ceil(total / 2);
    const relegationZone = total - 2;
    if (dna.fanExpectation === "champion" && position >= 4) return "crisis";
    if (dna.fanExpectation === "contender" && position > half) return "concern";
    if (dna.fanExpectation === "consistent" && position > half + 2) return "concern";
    if (dna.fanExpectation === "survival" && position > relegationZone) return "fear";
    return "ok";
  }

  const PRESSURE_BOARD_DRAIN = { crisis: 8, concern: 4, fear: 6, ok: 0 };
  const PRESSURE_MORALE_DRAIN = { crisis: 3, concern: 2, fear: 4, ok: 0 };

  function applyFanExpectationPressure(state) {
    const cc = ensureClubCultureState(state);
    const userTeamId = state.userTeamId;
    const dna = FMG_CLUB_DNA[userTeamId];
    if (!dna) return;

    const pos = standingPos(state, userTeamId);
    const total = totalTeams(state);
    const level = getPressureLevel(dna, pos, total);

    cc.pressureByTeam[userTeamId] = { level: level, position: pos, dna: dna.fanExpectation };

    if (level === "ok") return;

    const boardDrain = PRESSURE_BOARD_DRAIN[level] || 0;
    const moraleDrain = PRESSURE_MORALE_DRAIN[level] || 0;

    if (boardDrain > 0 && state.finances) {
      state.finances.boardTrust = clamp((state.finances.boardTrust || 50) - boardDrain, 0, 100);
    }

    if (moraleDrain > 0) {
      (state.players || []).filter(function (p) { return p.teamId === userTeamId && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) - moraleDrain, 0, 100);
      });
    }

    if ((level === "crisis" || level === "fear") && FMG.addNewsItem) {
      const teamObj = getTeam(state, userTeamId);
      const clubName = teamObj ? teamObj.name : "El club";
      const msg = level === "crisis"
        ? clubName + " bajo la lupa: el " + pos + "° puesto alarma a la directiva"
        : clubName + " en zona de peligro: la permanencia preocupa";
      FMG.addNewsItem(state, {
        type: "fans",
        title: msg,
        body: "La hinchada exige respuestas. Con prestige " + dna.prestige + "/100, el puesto " + pos + " no satisface las expectativas del club.",
        tags: ["presion", "hinchada", level],
        importance: level === "crisis" ? 82 : 75,
        entities: { teamId: userTeamId },
        dedupeKey: "fan-pressure-" + (state.seasonNumber || 1) + "-" + (state.currentWeek || 1) + "-" + level + "-" + userTeamId
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 3 — STADIUM ATMOSPHERE (extends home advantage)
  // ═══════════════════════════════════════════════════════════════════════════

  function getStadiumIntimidation(teamId) {
    const stadium = FMG_STADIUM[teamId];
    return stadium ? stadium.intimidationFactor : 5;
  }

  function stadiumStrengthBonus(state, team) {
    if (!state || !team) return 0;
    const liveMatch = state.liveMatch;
    if (!liveMatch) return 0;
    if (team.id !== liveMatch.homeTeamId) return 0;
    const cc = ensureClubCultureState(state);
    const extra = cc.homeAdvantageModifiers[team.id] || 0;
    const intimidation = getStadiumIntimidation(team.id);
    return intimidation * 0.1 + extra;
  }

  const prevComputeTeamStrength = FMG.computeTeamStrength;
  if (typeof prevComputeTeamStrength === "function" && !prevComputeTeamStrength._cultureWrapped) {
    const wrapped = function (team, players, state) {
      const base = prevComputeTeamStrength(team, players, state);
      return base + stadiumStrengthBonus(state, team);
    };
    wrapped._cultureWrapped = true;
    if (prevComputeTeamStrength._humanAIWrapped) wrapped._humanAIWrapped = true;
    FMG.computeTeamStrength = wrapped;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 4 — DERBY CULTURE
  // ═══════════════════════════════════════════════════════════════════════════

  function findNextUserFixture(state) {
    const week = state.currentWeek || 1;
    const uid = state.userTeamId;
    const next = (state.fixtures || []).find(function (f) {
      return !f.played && f.week > week && (f.matches || []).some(function (m) {
        return m.homeTeamId === uid || m.awayTeamId === uid;
      });
    });
    if (!next) return null;
    const match = (next.matches || []).find(function (m) { return m.homeTeamId === uid || m.awayTeamId === uid; });
    return match ? { week: next.week, match: match } : null;
  }

  function isDerby(homeTeamId, awayTeamId) {
    return FMG.getRivalry ? Boolean(FMG.getRivalry(homeTeamId, awayTeamId)) : false;
  }

  function applyPreDerbyEffects(state, match, derbyName) {
    const cc = ensureClubCultureState(state);
    const uid = state.userTeamId;
    const week = state.currentWeek || 1;
    const season = state.seasonNumber || 1;

    cc.derbyWeek[uid] = { week: week, opponent: match.homeTeamId === uid ? match.awayTeamId : match.homeTeamId, name: derbyName };

    const eco = state.managerEcosystem || {};
    if (eco.manager) eco.manager.pressure = clamp((eco.manager.pressure || 35) + 12, 0, 100);

    const world = eco.worldMedia || {};
    if (world.media) world.media.pressure = clamp((world.media.pressure || 42) + 15, 0, 100);

    (state.players || []).filter(function (p) { return p.teamId === uid && !p.retired; }).forEach(function (p) {
      p.morale = clamp((p.morale || 55) + 3, 0, 100);
    });

    if (FMG.addNewsItem) {
      const teamObj = getTeam(state, uid);
      FMG.addNewsItem(state, {
        type: "classic",
        title: "La semana del clasico: " + derbyName + " se acerca",
        body: "La ciudad respira futbol. " + (teamObj ? teamObj.name : uid) + " prepara el choque mas esperado. La presion y la expectativa estan en su punto mas alto.",
        tags: ["clasico", "derbi", "previa"],
        importance: 90,
        entities: { teamId: uid },
        dedupeKey: "pre-derby-" + season + "-" + week + "-" + uid
      });
    }
  }

  function applyPostDerbyEffects(state, result) {
    const cc = ensureClubCultureState(state);
    const uid = state.userTeamId;
    const season = state.seasonNumber || 1;
    const week = state.currentWeek || 1;

    const userGoals = result.homeTeamId === uid ? result.homeGoals : result.awayGoals;
    const oppGoals = result.homeTeamId === uid ? result.awayGoals : result.homeGoals;
    const won = userGoals > oppGoals;

    cc.postDerby[uid] = {
      week: week,
      won: won,
      expiresWeek: week + 3,
      score: userGoals + "-" + oppGoals
    };

    if (won) {
      if (state.finances) state.finances.boardTrust = clamp((state.finances.boardTrust || 50) + 8, 0, 100);
      cc.homeAdvantageModifiers[uid] = (cc.homeAdvantageModifiers[uid] || 0) + 3;
      (state.players || []).filter(function (p) { return p.teamId === uid && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) + 10, 0, 100);
      });
      const eco = state.managerEcosystem || {};
      if (eco.manager) eco.manager.pressure = clamp((eco.manager.pressure || 35) - 15, 0, 100);
    } else {
      if (state.finances) state.finances.boardTrust = clamp((state.finances.boardTrust || 50) - 12, 0, 100);
      (state.players || []).filter(function (p) { return p.teamId === uid && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) - 8, 0, 100);
      });
      const eco2 = state.managerEcosystem || {};
      if (eco2.manager) eco2.manager.pressure = clamp((eco2.manager.pressure || 35) + 15, 0, 100);
    }

    if (FMG.addNewsItem) {
      const teamObj = getTeam(state, uid);
      const rivalId = result.homeTeamId === uid ? result.awayTeamId : result.homeTeamId;
      const rivalry = FMG.getRivalry ? FMG.getRivalry(result.homeTeamId, result.awayTeamId) : null;
      const rivalryName = rivalry ? rivalry.name : "El clasico";
      FMG.addNewsItem(state, {
        type: "classic",
        title: won
          ? rivalryName + ": victoria que vale mucho mas que tres puntos"
          : rivalryName + ": derrota que duele en el alma",
        body: (teamObj ? teamObj.name : uid) + " " + (won ? "gano" : "perdio") + " el " + rivalryName + " " + userGoals + "-" + oppGoals + ". Los efectos se sentiran las proximas semanas.",
        tags: ["clasico", "derbi", won ? "victoria" : "derrota"],
        importance: 92,
        entities: { teamId: uid, opponentId: rivalId },
        dedupeKey: "post-derby-" + season + "-" + week + "-" + uid
      });
    }
  }

  function expirePostDerbyEffects(state) {
    const cc = ensureClubCultureState(state);
    const uid = state.userTeamId;
    const week = state.currentWeek || 1;
    const postDerby = cc.postDerby[uid];
    if (postDerby && postDerby.expiresWeek <= week) {
      if (postDerby.won && cc.homeAdvantageModifiers[uid]) {
        cc.homeAdvantageModifiers[uid] = Math.max(0, (cc.homeAdvantageModifiers[uid] || 0) - 3);
      }
      cc.postDerby[uid] = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 5 — CLUB TRADITIONS
  // Annual narrative events triggered at specific moments
  // ═══════════════════════════════════════════════════════════════════════════

  function processTraditions(state) {
    const cc = ensureClubCultureState(state);
    const uid = state.userTeamId;
    const dna = FMG_CLUB_DNA[uid];
    if (!dna || !dna.traditionsKey || !dna.traditionsKey.length) return;

    const season = state.seasonNumber || 1;
    const week = state.currentWeek || 1;
    const teamObj = getTeam(state, uid);
    const clubName = teamObj ? teamObj.name : uid;

    dna.traditionsKey.forEach(function (tradition) {
      const id = deterministicId("tradition", [tradition, season, uid]);
      if (cc.activeTraditions.some(function (t) { return t.id === id; })) return;

      let shouldFire = false;
      let title = "";
      let body = "";
      let effect = null;

      if (tradition === "superclasico") {
        shouldFire = week === 1;
        title = "Comienza la temporada: el Superclasico ya espera";
        body = clubName + " inicia la temporada con el Superclasico en el horizonte. El duelo mas importante del futbol chileno marcara el pulso de esta campana.";
        effect = { type: "media-boost", value: 10 };
      } else if (tradition === "copa-libertadores-historia") {
        const pos = standingPos(state, uid);
        shouldFire = pos <= 3 && week >= Math.floor((state.totalWeeks || 30) * 0.5);
        title = clubName + " sueña con la gloria continental";
        body = "Con " + pos + "° puesto en la tabla, " + clubName + " recuerda su historia internacional. La Libertadores es el maximo sueno.";
        effect = { type: "morale-boost", value: 5 };
      } else if (tradition === "hinchada-caliente" || tradition === "hinchada-pueblo") {
        shouldFire = week === 2;
        title = "La hinchada ya canta: " + clubName + " siente el calor de su gente";
        body = "Nada como el apoyo de los fieles. " + clubName + " arranca la temporada con su hinchada como un jugador mas en el estadio.";
        effect = { type: "home-boost", value: 2 };
      } else if (tradition === "academia" || tradition === "cantera-formativa" || tradition === "cantera-regional") {
        const youth = (state.players || []).filter(function (p) { return p.teamId === uid && p.age <= 21 && !p.retired; });
        shouldFire = youth.length >= 3 && week === 1;
        title = "La cantera de " + clubName + " promete para esta temporada";
        body = youth.length + " jugadores sub-22 en el plantel refuerzan el ADN formativo del club.";
        effect = { type: "fanApproval", value: 5 };
      } else if (tradition === "proceso" || tradition === "filosofia-italiana") {
        shouldFire = week === 3;
        title = clubName + ": la identidad de juego como sello diferenciador";
        body = "El proceso tactico de " + clubName + " tiene raices profundas. La filosofia de juego es parte del ADN del club.";
        effect = { type: "tactical-boost", value: 3 };
      } else if (tradition === "clasico-universitario") {
        shouldFire = week === 1;
        title = "El Clasico Universitario: la rivalidad academica vuelve a escena";
        body = "Una vez mas, el futbol academico de Santiago medira fuerzas. " + clubName + " prepara el choque con la carga historica de siempre.";
        effect = { type: "media-boost", value: 8 };
      } else {
        shouldFire = week === 1;
        title = "La tradicion de " + clubName + " marca el inicio de temporada";
        body = "Cada temporada es una nueva pagina en la historia de " + clubName + ". La tradicion pesa, pero tambien impulsa.";
        effect = { type: "morale-boost", value: 2 };
      }

      if (!shouldFire) return;

      const entry = {
        id: id,
        tradition: tradition,
        seasonNumber: season,
        week: week,
        teamId: uid,
        title: title,
        body: body,
        effect: effect
      };
      boundedPush(cc.activeTraditions, entry, 20);

      if (effect) applyTraditionEffect(state, uid, effect);

      if (FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "fans",
          title: title,
          body: body,
          tags: ["tradicion", tradition],
          importance: 65,
          entities: { teamId: uid },
          dedupeKey: id
        });
      }
    });
  }

  function applyTraditionEffect(state, teamId, effect) {
    if (!effect) return;
    if (effect.type === "morale-boost") {
      (state.players || []).filter(function (p) { return p.teamId === teamId && !p.retired; }).forEach(function (p) {
        p.morale = clamp((p.morale || 55) + effect.value, 0, 100);
      });
    } else if (effect.type === "home-boost") {
      const cc = ensureClubCultureState(state);
      cc.homeAdvantageModifiers[teamId] = (cc.homeAdvantageModifiers[teamId] || 0) + effect.value;
    } else if (effect.type === "media-boost") {
      const world = (state.managerEcosystem && state.managerEcosystem.worldMedia) || {};
      if (world.media) world.media.pressure = clamp((world.media.pressure || 42) + effect.value, 0, 100);
    } else if (effect.type === "fanApproval") {
      const world2 = (state.managerEcosystem && state.managerEcosystem.worldMedia) || {};
      if (world2.fans) world2.fans.pressure = clamp((world2.fans.pressure || 45) - effect.value, 0, 100);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  function runClubCultureWeek(state) {
    if (!state.userTeamId) return;
    ensureClubCultureState(state);

    processTraditions(state);
    applyFanExpectationPressure(state);
    expirePostDerbyEffects(state);

    const uid = state.userTeamId;
    const nextFixture = findNextUserFixture(state);
    if (nextFixture && nextFixture.week === (state.currentWeek || 1) + 1) {
      const m = nextFixture.match;
      const rivalry = FMG.getRivalry ? FMG.getRivalry(m.homeTeamId, m.awayTeamId) : null;
      if (rivalry) {
        const cc = ensureClubCultureState(state);
        const alreadySet = cc.derbyWeek[uid] && cc.derbyWeek[uid].week === (state.currentWeek || 1);
        if (!alreadySet) applyPreDerbyEffects(state, m, rivalry.name);
      }
    }

    const eco = state.managerEcosystem || {};
    const world = eco.worldMedia || {};
    const cc = state.clubCulture;
    if (cc.derbyWeek[uid]) {
      const derbyInfo = cc.derbyWeek[uid];
      if ((world.media && (world.media.pressure || 0) > 0) && derbyInfo.week === (state.currentWeek || 1) - 1) {
        world.media.pressure = clamp((world.media.pressure || 42) + 12, 0, 100);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // POST-MATCH HOOK (derby detection)
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevPostMatchNews = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = _prevPostMatchNews ? _prevPostMatchNews(state, result) : [];
    if (!result) return items;
    const uid = state.userTeamId;
    if (result.homeTeamId !== uid && result.awayTeamId !== uid) return items;
    if (isDerby(result.homeTeamId, result.awayTeamId)) applyPostDerbyEffects(state, result);
    return items;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY ECOSYSTEM HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevRunWeekCC = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options) {
    const result = _prevRunWeekCC ? _prevRunWeekCC(state, options) : {};
    runClubCultureWeek(state);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.ClubCulture = {
    ensure: ensureClubCultureState,
    getDNA: function (teamId) { return FMG_CLUB_DNA[teamId] || null; },
    getStadium: function (teamId) { return FMG_STADIUM[teamId] || null; },
    getPressureLevel: getPressureLevel,
    runWeek: runClubCultureWeek,
    DNA: FMG_CLUB_DNA,
    STADIUM: FMG_STADIUM
  };

  FMG.ensureClubCultureState = ensureClubCultureState;
})();
