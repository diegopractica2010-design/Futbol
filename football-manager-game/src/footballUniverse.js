(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const hashText = FMG.hashText;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTBALL UNIVERSE — PRE-PHASE-10 FINALIZATION
  // Jealousy, historical narrative, engagement hooks,
  // career-mode foundations, fan memory, player legend
  // ═══════════════════════════════════════════════════════════════════════════

  function getSquad(state) {
    return (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; });
  }

  function ensureFootballUniverse(state) {
    state.footballUniverse = state.footballUniverse || {};
    const fu = state.footballUniverse;
    fu.version = 1;
    fu.playerReputation = fu.playerReputation || {};
    fu.fanMemory = fu.fanMemory || {};
    fu.engagementHooks = fu.engagementHooks || [];
    fu.careerMilestones = fu.careerMilestones || [];
    return fu;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // A. PLAYER REPUTATION & LEGEND FOUNDATIONS (Career-Mode Readiness)
  // ═══════════════════════════════════════════════════════════════════════════

  function ensurePlayerReputation(state, player) {
    const fu = ensureFootballUniverse(state);
    if (!fu.playerReputation[player.id]) {
      const seed = hashText(player.id + "-rep");
      fu.playerReputation[player.id] = {
        playerId: player.id,
        popularity: clamp(30 + (player.overall || 55) * 0.4 + (seed % 20), 0, 100),
        legendScore: 0,
        fanFavorite: false,
        traitorFlag: false,
        milestones: [],
        fanChants: 0
      };
    }
    return fu.playerReputation[player.id];
  }

  function updatePlayerReputation(state) {
    ensureFootballUniverse(state);
    const squad = getSquad(state);
    squad.forEach(function (player) {
      const rep = ensurePlayerReputation(state, player);
      const goals = (player.seasonStats && player.seasonStats.goals) || 0;
      const heroCredits = player.heroCredits || 0;
      const isCaptain = state.psychology && state.psychology.captainId === player.id;
      rep.popularity = clamp(Math.round(
        rep.popularity * 0.88 +
        (player.overall || 55) * 0.05 +
        goals * 2 +
        heroCredits * 4 +
        (isCaptain ? 5 : 0) +
        ((player.morale || 55) - 55) * 0.08
      ), 0, 100);
      rep.fanFavorite = rep.popularity >= 75;
      rep.legendScore = clamp(rep.legendScore +
        goals * 0.5 +
        heroCredits * 2 +
        (isCaptain ? 0.2 : 0), 0, 100);
      // Fan chant threshold
      if (rep.popularity >= 80 && rep.fanChants === 0) {
        rep.fanChants = 1;
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "fans",
            title: player.name + " ya tiene su canto en las tribunas",
            body: "La hinchada ha adoptado a " + player.name + " como uno de sus idolos. Su nombre resuena en el estadio con una fuerza distinta.",
            tags: ["ídolo", "hinchada"],
            importance: 68,
            entities: { playerId: player.id, teamId: state.userTeamId },
            dedupeKey: "fan-chant-" + (state.seasonNumber || 1) + "-" + player.id
          });
        }
      }
    });
  }

  function trackCareerMilestone(state, type, description, playerId) {
    const fu = ensureFootballUniverse(state);
    const id = deterministicId("milestone", [type, state.seasonNumber || 1, state.currentWeek || 1, playerId || ""]);
    if (fu.careerMilestones.some(function (m) { return m.id === id; })) return null;
    const entry = {
      id: id,
      type: type,
      description: description,
      playerId: playerId || null,
      seasonNumber: state.seasonNumber || 1,
      week: state.currentWeek || 1
    };
    boundedPush(fu.careerMilestones, entry, 50);
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B. JEALOUSY MECHANIC
  // ═══════════════════════════════════════════════════════════════════════════

  function runJealousyChecks(state) {
    const squad = getSquad(state);
    const completedWeeks = Math.max(1, state.completedWeeks || 1);
    squad.forEach(function (player) {
      if ((player.ego || 0) < 50) return;
      const pos = player.position;
      const myStarts = (player.seasonStats && player.seasonStats.starts) || 0;
      const myStartRate = myStarts / completedWeeks;
      const rivals = squad.filter(function (p) {
        return p.id !== player.id &&
          p.position === pos &&
          !p.retired &&
          (p.seasonStats && p.seasonStats.starts || 0) / completedWeeks > myStartRate + 0.25;
      });
      if (!rivals.length) return;
      const seed = hashText("jealousy-" + (state.seasonNumber || 1) + "-" + (state.currentWeek || 1) + "-" + player.id);
      if (seed % 4 !== 0) return;
      const rival = rivals[seed % rivals.length];
      player.morale = clamp((player.morale || 55) - 3, 0, 100);
      if (state.psychology && state.psychology.players && state.psychology.players[player.id]) {
        state.psychology.players[player.id].emotions.frustration =
          clamp((state.psychology.players[player.id].emotions.frustration || 30) + 6, 0, 100);
      }
      // Add relationship friction between rivals
      if (state.psychology && state.psychology.relationships) {
        const pairId = [player.id, rival.id].sort().join("::");
        if (state.psychology.relationships[pairId]) {
          state.psychology.relationships[pairId].rivalry =
            clamp((state.psychology.relationships[pairId].rivalry || 20) + 4, 0, 100);
        }
      }
      if (FMG.SquadPsychologyExtended && FMG.SquadPsychologyExtended.addDressingRoomEvent) {
        FMG.SquadPsychologyExtended.addDressingRoomEvent(state, {
          type: "ego-clash",
          title: player.name + " observa con envidia a " + rival.name,
          description: rival.name + " juega en su posicion y acumula minutos. " + player.name + " empieza a cuestionarse su rol en el equipo.",
          playerId: player.id,
          icon: "👁️",
          choices: [
            { label: "Hablar con ambos jugadores", effect: { frustration: -8, rivalry: -5 } },
            { label: "Ignorar la situacion", effect: { frustration: 3, toxicity: 4 } }
          ]
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C. FAN MEMORY — Fans remember idols, traitors, heroes
  // ═══════════════════════════════════════════════════════════════════════════

  function updateFanMemory(state) {
    const fu = ensureFootballUniverse(state);
    const squad = getSquad(state);
    squad.forEach(function (player) {
      const rep = ensurePlayerReputation(state, player);
      if (!fu.fanMemory[player.id]) {
        fu.fanMemory[player.id] = { playerId: player.id, events: [], lastSentiment: "neutral" };
      }
      const mem = fu.fanMemory[player.id];
      if (rep.legendScore >= 30 && mem.lastSentiment !== "idol") {
        mem.lastSentiment = "idol";
        mem.events.push({ type: "idol", season: state.seasonNumber || 1 });
        if (mem.events.length > 10) mem.events.shift();
      }
    });
    // Players who left to a rival club are remembered as traitors
    (state.players || []).filter(function (p) {
      return p.retired !== true && p.formerTeamId === state.userTeamId &&
        p.teamId !== state.userTeamId && p.teamId && p.teamId !== "free-agent";
    }).forEach(function (player) {
      if (!fu.fanMemory[player.id]) fu.fanMemory[player.id] = { playerId: player.id, events: [], lastSentiment: "neutral" };
      const mem = fu.fanMemory[player.id];
      if (mem.lastSentiment !== "traitor" && mem.lastSentiment !== "idol") {
        const isRival = FMG.getRivalry ? FMG.getRivalry(state.userTeamId, player.teamId) : false;
        if (isRival) {
          mem.lastSentiment = "traitor";
          mem.events.push({ type: "traitor", season: state.seasonNumber || 1 });
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D. HISTORICAL NARRATIVE HOOKS IN NEWS
  // ═══════════════════════════════════════════════════════════════════════════

  function generateHistoricalNarrativeNews(state) {
    const moments = state.legendaryMoments || [];
    if (!moments.length) return;
    const week = state.currentWeek || 1;
    const season = state.seasonNumber || 1;
    // Only generate historical reference once every 5 weeks max
    const seed = hashText("hist-ref-" + season + "-" + Math.floor(week / 5));
    if (seed % 3 !== 0) return;
    const userMoments = moments.filter(function (m) { return m.teamId === state.userTeamId; });
    if (!userMoments.length) return;
    const moment = userMoments[seed % userMoments.length];
    const typeLabel = {
      last_minute_winner: "el gol de ultimo minuto",
      hat_trick: "el hat-trick histórico",
      massive_comeback: "la remontada memorable",
      derby_decider: "el gol clasico"
    }[moment.type] || "el momento epico";
    if (!FMG.addNewsItem) return;
    FMG.addNewsItem(state, {
      type: "fans",
      title: "La hinchada no olvida: el recuerdo de T" + moment.seasonNumber + " sigue vivo",
      body: "En el estadio todavia se habla de " + typeLabel + ". \"" + moment.description + "\". La historia pesa y el presente debe estar a la altura.",
      tags: ["historia", "memoria", "hinchada"],
      importance: 62,
      entities: { teamId: state.userTeamId },
      dedupeKey: "hist-ref-" + season + "-" + week + "-" + moment.id
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // E. ENGAGEMENT HOOKS — "One more week" suspense builders
  // ═══════════════════════════════════════════════════════════════════════════

  function generateEngagementHook(state) {
    const fu = ensureFootballUniverse(state);
    const week = state.currentWeek || 1;
    const totalWeeks = state.totalWeeks || 30;
    const season = state.seasonNumber || 1;
    const weeksLeft = Math.max(0, totalWeeks - week);
    const uid = state.userTeamId;
    const pos = (state.standings || []).findIndex(function (e) { return e.teamId === uid; }) + 1;
    const standings = state.standings || [];
    const seed = hashText("hook-" + season + "-" + week);
    const hooks = [];

    // Title race hook
    if (pos <= 4 && weeksLeft <= 8 && weeksLeft > 0) {
      const leader = standings[0];
      const userEntry = standings.find(function (e) { return e.teamId === uid; });
      if (leader && userEntry) {
        const gap = leader.points - userEntry.points;
        if (gap <= 6) {
          hooks.push("🏆 La recta final del torneo: " + (gap === 0 ? "líderes empatados en puntos" : gap + " puntos de diferencia con el lider") + " y " + weeksLeft + " fechas restantes. Todo se define ahora.");
        }
      }
    }

    // Relegation hook
    const relegationZone = standings.length - 2;
    if (pos >= relegationZone && weeksLeft <= 6) {
      hooks.push("⬇️ La zona de descenso respira en la nuca: " + weeksLeft + " partidos para salvarse. Cada punto es una batalla de vida o muerte.");
    }

    // Derby coming up
    const upcomingDerby = (state.fixtures || []).find(function (f) {
      if (f.played || f.week <= week) return false;
      return (f.matches || []).some(function (m) {
        const isUser = m.homeTeamId === uid || m.awayTeamId === uid;
        const oppId = m.homeTeamId === uid ? m.awayTeamId : m.homeTeamId;
        return isUser && FMG.getRivalry && FMG.getRivalry(uid, oppId);
      });
    });
    if (upcomingDerby && upcomingDerby.week - week <= 2) {
      const match = (upcomingDerby.matches || []).find(function (m) { return m.homeTeamId === uid || m.awayTeamId === uid; });
      const oppId = match ? (match.homeTeamId === uid ? match.awayTeamId : match.homeTeamId) : null;
      const opp = oppId ? (state.teams || []).find(function (t) { return t.id === oppId; }) : null;
      const rivalry = oppId ? (FMG.getRivalry ? FMG.getRivalry(uid, oppId) : null) : null;
      if (rivalry && opp) {
        hooks.push("⚡ El " + rivalry.name + " contra " + opp.name + " se acerca — faltan " + (upcomingDerby.week - week) + " semana(s). La ciudad ya respira esto.");
      }
    }

    // Transfer window opening/closing
    if (state.market && state.market.windowOpen === false) {
      const weeksToOpen = seed % 4 + 1;
      if (weeksToOpen <= 2) {
        hooks.push("💰 El mercado de pases abre en breve. El momento de reforzar o perder jugadores clave. ¿El plantel esta listo?");
      }
    }

    // Winning streak continuation
    const streaks = state.worldNews && state.worldNews.streaks && state.worldNews.streaks[uid];
    if (streaks && (streaks.wins || 0) >= 3) {
      hooks.push("🔥 " + (streaks.wins) + " victorias consecutivas — ¿puede continuar la racha? El próximo rival va a intentar frenarlo.");
    }

    if (!hooks.length) return;
    const hook = hooks[seed % hooks.length];
    const id = deterministicId("hook", [season, week, hook.slice(0, 20)]);
    if (fu.engagementHooks.some(function (h) { return h.id === id; })) return;
    const entry = { id: id, season: season, week: week, text: hook };
    boundedPush(fu.engagementHooks, entry, 20);
    if (FMG.addNewsItem) {
      FMG.addNewsItem(state, {
        type: "world-reaction",
        title: hook.replace(/^[⚡🏆⬇️💰🔥]\s*/, "").split(":")[0] || "El torneo entra en fase clave",
        body: hook.replace(/^[⚡🏆⬇️💰🔥]\s*/, ""),
        tags: ["tension", "suspense", "narrativa"],
        importance: 72,
        entities: { teamId: uid },
        dedupeKey: id
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // F. MEDIA REFERENCES HISTORICAL MOMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  function generateRivalryHistoryNews(state, result) {
    if (!result) return;
    const rivalry = FMG.getRivalry ? FMG.getRivalry(result.homeTeamId, result.awayTeamId) : null;
    if (!rivalry) return;
    const moments = (state.legendaryMoments || []).filter(function (m) {
      return m.type === "derby_decider" &&
        (m.teamId === result.homeTeamId || m.teamId === result.awayTeamId);
    });
    if (!moments.length) return;
    const seed = hashText("rivalry-hist-" + (state.seasonNumber || 1) + "-" + (result.week || state.currentWeek || 1));
    if (seed % 3 !== 0) return;
    const ref = moments[seed % moments.length];
    const hg = result.homeGoals || 0;
    const ag = result.awayGoals || 0;
    const homeTeam = (state.teams || []).find(function (t) { return t.id === result.homeTeamId; });
    const awayTeam = (state.teams || []).find(function (t) { return t.id === result.awayTeamId; });
    if (!homeTeam || !awayTeam || !FMG.addNewsItem) return;
    FMG.addNewsItem(state, {
      type: "classic",
      title: rivalry.name + ": la historia siempre vuelve",
      body: "El " + rivalry.name + " de hoy (" + homeTeam.name + " " + hg + "-" + ag + " " + awayTeam.name + ") reactiva los recuerdos. En T" + ref.seasonNumber + " ya vivimos algo parecido cuando " + ref.description + ". La rivalidad tiene memoria larga.",
      tags: ["clasico", "historia", "memoria"],
      importance: 82,
      entities: { homeTeamId: result.homeTeamId, awayTeamId: result.awayTeamId },
      dedupeKey: "rivalry-hist-" + (state.seasonNumber || 1) + "-" + (result.week || state.currentWeek || 1) + "-" + rivalry.name
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // G. SEASON CAREER MILESTONES
  // ═══════════════════════════════════════════════════════════════════════════

  function checkCareerMilestones(state) {
    const career = state.career;
    if (!career) return;
    const trophies = career.trophies || [];
    const legacyScore = state.legacy && state.legacy.managerLegacy && state.legacy.managerLegacy.legacyScore || 0;
    if (trophies.length >= 1 && !state.footballUniverse.careerMilestones.some(function (m) { return m.type === "first-title"; })) {
      trackCareerMilestone(state, "first-title", "Primer titulo conquistado como manager", null);
      if (FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "player-story",
          title: "El primer titulo: el inicio de una leyenda",
          body: "El primer campeonato siempre queda grabado en la memoria. Este inicio de legado puede ser el comienzo de algo mucho mas grande.",
          tags: ["hito", "carrera", "titulo"],
          importance: 88,
          dedupeKey: "milestone-first-title-" + (state.seasonNumber || 1)
        });
      }
    }
    if (legacyScore >= 40 && !state.footballUniverse.careerMilestones.some(function (m) { return m.type === "legend-status"; })) {
      trackCareerMilestone(state, "legend-status", "Manager alcanza status de leyenda local", null);
    }
    // Player goal milestones
    getSquad(state).forEach(function (player) {
      const goals = (player.seasonStats && player.seasonStats.goals) || 0;
      const cs = state.legacy && state.legacy.playerCareerStats && state.legacy.playerCareerStats[player.id];
      const careerGoals = cs ? cs.goals : goals;
      if (careerGoals >= 50 && !state.footballUniverse.careerMilestones.some(function (m) { return m.type === "50-goals" && m.playerId === player.id; })) {
        trackCareerMilestone(state, "50-goals", player.name + " alcanza los 50 goles en su carrera", player.id);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "player-story",
            title: player.name + ": 50 goles y una historia que se escribe sola",
            body: "Con su gol " + careerGoals + " en carrera, " + player.name + " se convierte en una figura historica del futbol chileno.",
            tags: ["hito", "goleador", "historia"],
            importance: 84,
            entities: { playerId: player.id },
            dedupeKey: "milestone-50goals-" + player.id
          });
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY INTEGRATION HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevRunWeekFU = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options) {
    const result = _prevRunWeekFU ? _prevRunWeekFU(state, options) : {};
    if (!state.userTeamId) return result;
    ensureFootballUniverse(state);
    updatePlayerReputation(state);
    runJealousyChecks(state);
    updateFanMemory(state);
    generateHistoricalNarrativeNews(state);
    generateEngagementHook(state);
    checkCareerMilestones(state);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  // HOOK — post-match: rivalry history reference
  const _prevPostMatchFU = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = _prevPostMatchFU ? _prevPostMatchFU(state, result) : [];
    generateRivalryHistoryNews(state, result);
    return items;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.FootballUniverse = {
    ensure: ensureFootballUniverse,
    getPlayerReputation: function (state, playerId) {
      const fu = state.footballUniverse;
      return fu && fu.playerReputation && fu.playerReputation[playerId] || null;
    },
    getFanMemory: function (state, playerId) {
      const fu = state.footballUniverse;
      return fu && fu.fanMemory && fu.fanMemory[playerId] || null;
    },
    getEngagementHooks: function (state) {
      return (state.footballUniverse && state.footballUniverse.engagementHooks) || [];
    },
    getCareerMilestones: function (state) {
      return (state.footballUniverse && state.footballUniverse.careerMilestones) || [];
    },
    trackCareerMilestone: trackCareerMilestone
  };

  FMG.ensureFootballUniverse = ensureFootballUniverse;
})();
