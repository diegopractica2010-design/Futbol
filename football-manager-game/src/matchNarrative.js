(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  function clampVal(v, lo, hi) {
    return FMG.clamp ? FMG.clamp(v, lo, hi) : Math.max(lo, Math.min(hi, v));
  }

  function hashStr(s) {
    return FMG.hashText ? FMG.hashText(s) : String(s || "").split("").reduce((h, c) => ((h * 33) + c.charCodeAt(0)) >>> 0, 1);
  }

  function detId(prefix, parts) {
    return FMG.deterministicId ? FMG.deterministicId(prefix, parts) : (prefix + "-" + hashStr(String(parts)));
  }

  function bPush(arr, item, max) {
    if (FMG.boundedPush) return FMG.boundedPush(arr, item, max);
    arr.unshift(item);
    if (arr.length > max) arr.length = max;
    return arr;
  }

  function getTeamName(state, teamId) {
    const t = (state.teams || []).find(function (x) { return x.id === teamId; });
    return t ? t.name : teamId;
  }

  function getPlayer(state, playerId) {
    return (state.players || []).find(function (p) { return p.id === playerId; }) || null;
  }

  function standingPos(state, teamId) {
    const idx = (state.standings || []).findIndex(function (e) { return e.teamId === teamId; });
    return idx >= 0 ? idx + 1 : 99;
  }

  // ═══════════════════════════════════════════════
  // SYSTEM 1 — MATCH STORY ARCS
  // ═══════════════════════════════════════════════

  function classifyArc(state, result) {
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const timeline = result.timeline || [];
    const homeTeamId = result.homeTeamId;
    const awayTeamId = result.awayTeamId;
    const homePos = standingPos(state, homeTeamId);
    const awayPos = standingPos(state, awayTeamId);
    const rivalry = FMG.getRivalry ? FMG.getRivalry(homeTeamId, awayTeamId) : null;
    const totalShots = (result.stats && result.stats.home ? result.stats.home.shots : 0) + (result.stats && result.stats.away ? result.stats.away.shots : 0);
    const lateGoals = timeline.filter(function (e) { return e.type === "goal" && e.minute >= 75; });
    const goalsInOrder = timeline.filter(function (e) { return e.type === "goal"; }).sort(function (a, b) { return a.minute - b.minute; });

    let h = 0;
    let a = 0;
    let maxHomeDeficit = 0;
    let maxAwayDeficit = 0;
    goalsInOrder.forEach(function (g) {
      if (g.teamId === homeTeamId) { h += 1; } else { a += 1; }
      if (a - h > maxHomeDeficit) maxHomeDeficit = a - h;
      if (h - a > maxAwayDeficit) maxAwayDeficit = h - a;
    });

    if (rivalry && hg >= 2 && ag >= 2) return "derby_classic";
    if (hg === 0 && ag === 0 && totalShots < 4) return "boring_point";

    const loserSOT = hg > ag
      ? (result.stats && result.stats.away ? result.stats.away.shotsOnTarget : 0)
      : (result.stats && result.stats.home ? result.stats.home.shotsOnTarget : 0);
    if (hg !== ag && loserSOT >= 8 && (hg === 0 || ag === 0)) return "shutout_drama";

    if (hg > ag && awayPos - homePos >= 4) return "giant_killing";
    if (ag > hg && homePos - awayPos >= 4) return "giant_killing";
    if (lateGoals.length >= 3) return "thriller";
    if (maxHomeDeficit >= 2 && hg >= ag) return "comeback";
    if (maxAwayDeficit >= 2 && ag >= hg) return "comeback";
    if (maxHomeDeficit >= 2 && ag > hg) return "collapse";
    if (maxAwayDeficit >= 2 && hg > ag) return "collapse";
    return "standard";
  }

  // ═══════════════════════════════════════════════
  // SYSTEM 2 — HERO / VILLAIN GENERATION
  // ═══════════════════════════════════════════════

  function findHero(state, result) {
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const allGoals = (result.homeEvents || []).concat(result.awayEvents || []);
    const byPlayer = {};
    allGoals.forEach(function (g) {
      if (g.playerId) byPlayer[g.playerId] = (byPlayer[g.playerId] || 0) + 1;
    });

    const hatTrickEntry = Object.keys(byPlayer).find(function (pid) { return byPlayer[pid] >= 3; });
    if (hatTrickEntry) {
      const p = getPlayer(state, hatTrickEntry);
      if (p) return { playerId: p.id, name: p.name, reason: "hat_trick" };
    }

    if (hg === 0 && ag === 0) {
      const homeSOT = result.stats && result.stats.home ? result.stats.home.shotsOnTarget : 0;
      const awaySOT = result.stats && result.stats.away ? result.stats.away.shotsOnTarget : 0;
      if (Math.max(homeSOT, awaySOT) >= 3) {
        const gkTeamId = homeSOT >= awaySOT ? result.awayTeamId : result.homeTeamId;
        const gkList = (state.players || []).filter(function (p) { return p.teamId === gkTeamId && p.position === "POR"; });
        const gk = gkList.sort(function (a, b) { return b.overall - a.overall; })[0];
        if (gk) return { playerId: gk.id, name: gk.name, reason: "clean_sheet_saves" };
      }
    }

    const winnerId = hg > ag ? result.homeTeamId : ag > hg ? result.awayTeamId : null;
    if (winnerId) {
      const winEvents = winnerId === result.homeTeamId ? (result.homeEvents || []) : (result.awayEvents || []);
      if (winEvents.length > 0) {
        const last = winEvents[winEvents.length - 1];
        const p = getPlayer(state, last.playerId);
        if (p) return { playerId: p.id, name: p.name, reason: "match_winner" };
      }
    }
    return null;
  }

  function findVillain(state, result) {
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const loserId = hg > ag ? result.awayTeamId : ag > hg ? result.homeTeamId : null;

    if (loserId) {
      const redCard = (result.cards || []).find(function (c) { return c.color === "red" && c.teamId === loserId; });
      if (redCard) return { playerId: redCard.playerId, name: redCard.playerName, reason: "red_card_loss" };
    }

    if (loserId) {
      const suspGoal = (result.timeline || []).find(function (e) { return e.type === "goal" && e.teamId !== loserId && Number(e.xg) < 0.05; });
      if (suspGoal) {
        const defList = (state.players || []).filter(function (p) { return p.teamId === loserId && p.position === "DEF"; });
        const def = defList.sort(function (a, b) { return a.overall - b.overall; })[0];
        if (def) return { playerId: def.id, name: def.name, reason: "own_goal" };
      }
    }
    return null;
  }

  function applyHeroVillainEffects(state, hero, villain) {
    if (hero && hero.playerId) {
      const p = getPlayer(state, hero.playerId);
      if (p) {
        p.confidence = clampVal((p.confidence || 55) + 12, 0, 100);
        p.mediaReputation = clampVal((p.mediaReputation || 50) + 8, 0, 100);
      }
    }
    if (villain && villain.playerId) {
      const p = getPlayer(state, villain.playerId);
      if (p) {
        p.confidence = clampVal((p.confidence || 55) - 15, 0, 100);
        p.mediaReputation = clampVal((p.mediaReputation || 50) - 10, 0, 100);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // SYSTEM 3 — LEGENDARY MOMENT MEMORY
  // ═══════════════════════════════════════════════

  function ensureLegendaryMoments(state) {
    state.legendaryMoments = state.legendaryMoments || [];
    return state.legendaryMoments;
  }

  function registerMoment(state, moment) {
    const moments = ensureLegendaryMoments(state);
    const id = detId("legendary", [moment.type, moment.seasonNumber, moment.week, moment.minute || 0, moment.teamId || ""]);
    if (moments.some(function (m) { return m.id === id; })) return null;
    const entry = Object.assign({ id: id }, moment);
    bPush(moments, entry, 50);
    return entry;
  }

  function detectLegendaryMoments(state, result) {
    if (!result) return [];
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const timeline = result.timeline || [];
    const week = result.week || state.currentWeek || 1;
    const season = state.seasonNumber || 1;
    const hName = getTeamName(state, result.homeTeamId);
    const aName = getTeamName(state, result.awayTeamId);
    const detected = [];

    const lateGoals = timeline.filter(function (e) { return e.type === "goal" && e.minute >= 88; });
    lateGoals.forEach(function (g) {
      const p = getPlayer(state, g.playerId);
      const tName = g.teamId === result.homeTeamId ? hName : aName;
      const m = registerMoment(state, {
        type: "last_minute_winner",
        seasonNumber: season,
        week: week,
        description: (p ? p.name : "Jugador") + " anota en el minuto " + g.minute + " para " + tName + " (" + hg + "-" + ag + ")",
        playerId: g.playerId || null,
        teamId: g.teamId,
        minute: g.minute,
        score_before: null,
        score_after: hg + "-" + ag
      });
      if (m) detected.push(m);
    });

    const allGoals = (result.homeEvents || []).concat(result.awayEvents || []);
    const byPlayer = {};
    allGoals.forEach(function (g) {
      if (g.playerId) byPlayer[g.playerId] = (byPlayer[g.playerId] || 0) + 1;
    });
    Object.keys(byPlayer).forEach(function (pid) {
      if (byPlayer[pid] < 3) return;
      const p = getPlayer(state, pid);
      const tName = p ? getTeamName(state, p.teamId) : "equipo";
      const m = registerMoment(state, {
        type: "hat_trick",
        seasonNumber: season,
        week: week,
        description: (p ? p.name : "Jugador") + " marca hat-trick (" + byPlayer[pid] + " goles) en " + hName + " " + hg + "-" + ag + " " + aName,
        playerId: pid,
        teamId: p ? p.teamId : null,
        minute: 90,
        score_before: null,
        score_after: hg + "-" + ag,
        _tName: tName
      });
      if (m) detected.push(m);
    });

    const goalsInOrder = timeline.filter(function (e) { return e.type === "goal"; }).sort(function (a, b) { return a.minute - b.minute; });
    let hh = 0;
    let aa = 0;
    let maxHD = 0;
    let maxAD = 0;
    goalsInOrder.forEach(function (g) {
      if (g.teamId === result.homeTeamId) { hh += 1; } else { aa += 1; }
      if (aa - hh > maxHD) maxHD = aa - hh;
      if (hh - aa > maxAD) maxAD = hh - aa;
    });
    if (maxHD >= 3 && hg >= ag) {
      const m = registerMoment(state, {
        type: "massive_comeback",
        seasonNumber: season,
        week: week,
        description: hName + " remonta desde " + maxHD + " goles abajo (" + hg + "-" + ag + ")",
        teamId: result.homeTeamId,
        minute: 90,
        score_before: "0-" + maxHD,
        score_after: hg + "-" + ag
      });
      if (m) detected.push(m);
    }
    if (maxAD >= 3 && ag >= hg) {
      const m = registerMoment(state, {
        type: "massive_comeback",
        seasonNumber: season,
        week: week,
        description: aName + " remonta desde " + maxAD + " goles abajo (" + hg + "-" + ag + ")",
        teamId: result.awayTeamId,
        minute: 90,
        score_before: maxAD + "-0",
        score_after: hg + "-" + ag
      });
      if (m) detected.push(m);
    }

    const rivalry = FMG.getRivalry ? FMG.getRivalry(result.homeTeamId, result.awayTeamId) : null;
    if (rivalry && Math.abs(hg - ag) === 1) {
      const deciders = timeline.filter(function (e) { return e.type === "goal" && e.minute >= 85; });
      const decider = deciders.sort(function (x, y) { return y.minute - x.minute; })[0];
      if (decider) {
        const p = getPlayer(state, decider.playerId);
        const tName = decider.teamId === result.homeTeamId ? hName : aName;
        const m = registerMoment(state, {
          type: "derby_decider",
          seasonNumber: season,
          week: week,
          description: (p ? p.name : "Jugador") + " decide el " + rivalry.name + " en el minuto " + decider.minute + " para " + tName,
          playerId: decider.playerId || null,
          teamId: decider.teamId,
          minute: decider.minute,
          score_before: null,
          score_after: hg + "-" + ag
        });
        if (m) detected.push(m);
      }
    }

    return detected.filter(Boolean);
  }

  // ═══════════════════════════════════════════════
  // SYSTEM 4 — DRAMATIC COMMENTARY TEMPLATES
  // ═══════════════════════════════════════════════

  const ARC_TEMPLATES = {
    comeback: [
      function (ctx) { return ctx.winner + " rescribe la historia: remontar es posible"; },
      function (ctx) { return "Del abismo a la gloria: " + ctx.winner + " no conoce la rendicion"; },
      function (ctx) { return "Epica remontada de " + ctx.winner + " en la semana " + ctx.week; },
      function (ctx) { return ctx.winner + " volvio desde la oscuridad para brillar"; },
      function (ctx) { return "La fe mueve marcadores: " + ctx.winner + " lo creyo hasta el final"; },
      function (ctx) { return "Imposible era la palabra, " + ctx.winner + " no la conoce"; }
    ],
    collapse: [
      function (ctx) { return ctx.loser + " vivio un colapso historico ante " + ctx.winner; },
      function (ctx) { return "Cuando todo se derrumba: la tarde negra de " + ctx.loser; },
      function (ctx) { return ctx.loser + " dilapido ventaja y pago un precio enorme"; },
      function (ctx) { return "El derrumbe de " + ctx.loser + " sera tema de analisis"; },
      function (ctx) { return "De dominador a victima: el dia que " + ctx.loser + " perdio el hilo"; },
      function (ctx) { return ctx.loser + " tuvo el partido en la mano y lo solto"; }
    ],
    thriller: [
      function (ctx) { return "Noche de fuego en la semana " + ctx.week + ": golazo tras golazo sin respiro"; },
      function () { return "El partido que no paro: goles hasta el pitazo final"; },
      function (ctx) { return ctx.home + " vs " + ctx.away + " dejaron un espectaculo memorable"; },
      function (ctx) { return "El futbol en su estado mas puro: " + ctx.home + " " + ctx.score + " " + ctx.away; },
      function (ctx) { return "Nadie queria defender esta noche: thriller en la semana " + ctx.week; },
      function () { return "Cinco estrellas para este partido que lo tuvo todo"; }
    ],
    shutout_drama: [
      function (ctx) { return ctx.winner + " sufrio pero aguanto: drama y tres puntos"; },
      function (ctx) { return "El arco se cerro: porteria de hierro de " + ctx.winner; },
      function (ctx) { return "Asedio rival, voluntad local: victoria sufrida de " + ctx.winner; },
      function (ctx) { return "El arquero de " + ctx.winner + " fue la diferencia en la semana " + ctx.week; },
      function (ctx) { return "Bajo el fuego y sin caer: " + ctx.winner + " resiste y gana"; },
      function (ctx) { return "Concentracion maxima: " + ctx.winner + " defiende con todo"; }
    ],
    giant_killing: [
      function (ctx) { return "Terremoto en la tabla: " + ctx.winner + " tumba a " + ctx.loser; },
      function (ctx) { return "La grande cayo: " + ctx.loser + " no esperaba este resultado"; },
      function (ctx) { return ctx.winner + " escribe su capitulo de gloria frente a " + ctx.loser; },
      function (ctx) { return "Sorpresa mayuscula: " + ctx.winner + " no entiende de jerarquias"; },
      function (ctx) { return "El dia que " + ctx.winner + " le explico futbol a " + ctx.loser; },
      function (ctx) { return "Nadie lo creyo pero " + ctx.winner + " lo hizo: resultado historico"; }
    ],
    boring_point: [
      function (ctx) { return "Cero a cero y pocas emociones entre " + ctx.home + " y " + ctx.away; },
      function () { return "El futbol tambien tiene estas noches: sin goles ni alardes"; },
      function () { return "Un punto para cada uno en una noche sin chispa"; },
      function () { return "El empate no le sirvio a ninguno: partido para olvidar"; },
      function (ctx) { return ctx.home + " y " + ctx.away + " repartieron sin brillar"; },
      function (ctx) { return "Poco para contar en el " + ctx.home + " vs " + ctx.away; }
    ],
    derby_classic: [
      function () { return "El clasico vivio otra noche de leyenda"; },
      function (ctx) { return ctx.home + " vs " + ctx.away + ": un clasico como los de antes"; },
      function () { return "Goles, tension y pasion: el derbi lo tuvo todo"; },
      function () { return "Cuando rivales se encuentran, el futbol gana"; },
      function () { return "La ciudad paro para ver este clasico memorable"; },
      function () { return "Noche de clasico: emociones al limite y futbol de altura"; }
    ]
  };

  function pickNarrativeTitle(state, result, arc) {
    const templates = ARC_TEMPLATES[arc];
    if (!templates || !templates.length) return null;
    const homeTeam = (state.teams || []).find(function (t) { return t.id === result.homeTeamId; });
    const awayTeam = (state.teams || []).find(function (t) { return t.id === result.awayTeamId; });
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const winner = hg > ag ? homeTeam : ag > hg ? awayTeam : null;
    const loser = winner ? (winner.id === (homeTeam && homeTeam.id) ? awayTeam : homeTeam) : null;
    const ctx = {
      home: homeTeam ? homeTeam.name : "Local",
      away: awayTeam ? awayTeam.name : "Visita",
      winner: winner ? winner.name : "El ganador",
      loser: loser ? loser.name : "El perdedor",
      score: hg + "-" + ag,
      week: result.week || state.currentWeek || 1
    };
    const seed = hashStr("narrative-" + (state.seasonNumber || 1) + "-" + (result.week || state.currentWeek || 1) + "-" + result.homeTeamId + "-" + result.awayTeamId + "-" + arc);
    return templates[seed % templates.length](ctx);
  }

  // ═══════════════════════════════════════════════
  // SYSTEM 5 — FINAL MINUTE PRESSURE NARRATIVES
  // ═══════════════════════════════════════════════

  const TIED_LINES = [
    "El empate no le sirve a ninguno...",
    "Queda tiempo para un heroe o un villano...",
    "El reloj corre y el marcador no se mueve...",
    "Minutos finales: alguien tiene que decidir"
  ];

  const ONE_GOAL_LINES = [
    "El marcador tiembla en los ultimos instantes...",
    "Tres puntos en juego con el tiempo casi agotado...",
    "Un gol puede cambiar todo — la defensa lo sabe...",
    "Agonia pura: un gol de diferencia y poco tiempo"
  ];

  function getPressureNarrative(state, liveMatch, minute) {
    if (!liveMatch || minute < 85) return null;
    const hg = (liveMatch.result && liveMatch.result.homeGoals) || 0;
    const ag = (liveMatch.result && liveMatch.result.awayGoals) || 0;
    const seed = hashStr("pressure-" + (liveMatch.seed || 1) + "-" + minute);

    if (hg === ag) return TIED_LINES[seed % TIED_LINES.length];
    if (Math.abs(hg - ag) === 1) return ONE_GOAL_LINES[seed % ONE_GOAL_LINES.length];

    const userTeamId = state.userTeamId;
    if (!userTeamId) return null;
    const userGoals = liveMatch.homeTeamId === userTeamId ? hg : ag;
    const oppGoals = liveMatch.homeTeamId === userTeamId ? ag : hg;
    if (userGoals < oppGoals) {
      const club = getTeamName(state, userTeamId);
      const lines = [
        "Todo o nada para " + club + "...",
        club + " lanza todo al ataque en busca del milagro...",
        "La desesperacion de " + club + " se convierte en presion pura...",
        club + " necesita el gol — el reloj es su enemigo"
      ];
      return lines[seed % lines.length];
    }
    return null;
  }

  // ═══════════════════════════════════════════════
  // ENRICHMENT
  // ═══════════════════════════════════════════════

  function enrichResult(state, result) {
    if (!result) return result;
    result.narrativeArc = classifyArc(state, result);
    result.matchHero = findHero(state, result);
    result.matchVillain = findVillain(state, result);
    detectLegendaryMoments(state, result);
    applyHeroVillainEffects(state, result.matchHero, result.matchVillain);
    return result;
  }

  // ═══════════════════════════════════════════════
  // HOOK — wrap FMG.generatePostMatchNews
  // ═══════════════════════════════════════════════

  const _origPostMatchNews = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    enrichResult(state, result);
    const items = _origPostMatchNews ? _origPostMatchNews(state, result) : [];
    const arc = result.narrativeArc;
    const hero = result.matchHero;

    if (arc && arc !== "standard" && FMG.addNewsItem) {
      const narrativeTitle = pickNarrativeTitle(state, result, arc);
      if (narrativeTitle) {
        const homeTeam = (state.teams || []).find(function (t) { return t.id === result.homeTeamId; });
        const awayTeam = (state.teams || []).find(function (t) { return t.id === result.awayTeamId; });
        const hg = result.homeGoals || 0;
        const ag = result.awayGoals || 0;
        const score = (homeTeam ? homeTeam.name : "Local") + " " + hg + "-" + ag + " " + (awayTeam ? awayTeam.name : "Visita");
        const body = hero
          ? hero.name + " fue figura en este partido que pasara a la historia. " + score + "."
          : "Un partido que dejara recuerdo. " + score + ".";
        const item = FMG.addNewsItem(state, {
          type: "chronicle",
          title: narrativeTitle,
          body: body,
          tags: ["narrativa", arc],
          importance: (arc === "comeback" || arc === "derby_classic" || arc === "thriller") ? 90 : 78,
          entities: { homeTeamId: result.homeTeamId, awayTeamId: result.awayTeamId },
          dedupeKey: "narrative-" + (state.seasonNumber || 1) + "-" + (result.week || state.currentWeek || 1) + "-" + result.homeTeamId + "-" + result.awayTeamId
        });
        if (item) items.unshift(item);
      }
    }

    if (hero && hero.playerId && FMG.addNewsItem) {
      const p = getPlayer(state, hero.playerId);
      if (p) {
        FMG.addNewsItem(state, {
          type: "player-story",
          title: hero.name + " emerge como heroe de la jornada",
          body: hero.name + " fue la figura del " + (arc === "derby_classic" ? "clasico" : "partido") + " con una actuacion que no paso inadvertida. Confianza: " + Math.round(p.confidence || 55) + "/100.",
          tags: ["heroe", "protagonista"],
          importance: 75,
          entities: { playerId: hero.playerId },
          dedupeKey: "hero-" + (state.seasonNumber || 1) + "-" + (result.week || state.currentWeek || 1) + "-" + hero.playerId
        });
      }
    }

    return items;
  };

  // ═══════════════════════════════════════════════
  // HOOK — wrap FMG.advanceLiveMatch for final-minute narratives
  // ═══════════════════════════════════════════════

  const _origAdvanceLiveMatch = FMG.advanceLiveMatch;
  FMG.advanceLiveMatch = function (state, minutes) {
    const outcome = _origAdvanceLiveMatch ? _origAdvanceLiveMatch(state, minutes) : { ok: false, message: "No disponible." };
    if (!outcome.ok) return outcome;
    const liveMatch = state.liveMatch;
    if (!liveMatch || !liveMatch.result || liveMatch.completed) return outcome;

    const minute = liveMatch.minute;
    if (minute >= 85) {
      const narrative = getPressureNarrative(state, liveMatch, minute);
      if (narrative) {
        const already = (liveMatch.result.timeline || []).some(function (e) { return e.type === "narrative" && e.minute === minute; });
        if (!already) {
          if (!liveMatch.result.timeline) liveMatch.result.timeline = [];
          liveMatch.result.timeline.push({ minute: minute, type: "narrative", teamId: null, text: narrative });
        }
      }
    }
    return outcome;
  };

  // ═══════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════

  FMG.matchNarrative = {
    classifyArc: classifyArc,
    findHero: findHero,
    findVillain: findVillain,
    detectLegendaryMoments: detectLegendaryMoments,
    enrichResult: enrichResult,
    ensureLegendaryMoments: ensureLegendaryMoments,
    getPressureNarrative: getPressureNarrative
  };
})();
