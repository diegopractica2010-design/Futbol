(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  function ensureLegacy(state) {
    state.legacy = state.legacy || {};
    const lg = state.legacy;
    lg.version = 1;
    lg.hallOfFame = lg.hallOfFame || [];
    lg.allTimeRecords = lg.allTimeRecords || {
      topScorer: null,
      mostAppearances: null,
      highestOverall: null,
      mostTitles: null
    };
    lg.playerCareerStats = lg.playerCareerStats || {};
    lg.clubTimelines = lg.clubTimelines || {};
    lg.managerLegacy = lg.managerLegacy || {
      totalTitles: 0, seasonsManaged: 0, clubsManaged: 0,
      legendaryMomentsInvolved: 0, hallOfFamePlayersNurtured: 0,
      legacyScore: 0, legacyLabel: "Pasajero"
    };
    lg.seasonDocumentaries = lg.seasonDocumentaries || [];
    return lg;
  }

  function getTeam(state, teamId) {
    return (state.teams || []).find(function (t) { return t.id === teamId; }) || null;
  }

  function getPlayer(state, playerId) {
    return (state.players || []).find(function (p) { return p.id === playerId; }) || null;
  }

  function teamName(state, teamId) {
    const t = getTeam(state, teamId);
    return t ? t.name : teamId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAREER STATS ACCUMULATION (runs before seasonStats reset)
  // ═══════════════════════════════════════════════════════════════════════════

  function accumulateCareerStats(state) {
    const lg = ensureLegacy(state);
    const season = state.seasonNumber || 1;
    const championId = state.champion ? state.champion.teamId : null;

    (state.players || []).filter(function (p) { return !p.retired; }).forEach(function (player) {
      const cs = lg.playerCareerStats[player.id] = lg.playerCareerStats[player.id] || {
        goals: 0, appearances: 0, seasonsAbove80: 0,
        peakOverall: player.overall || 60, titles: 0,
        titlesByClub: {}, teamIds: []
      };

      cs.goals += player.seasonStats ? (player.seasonStats.goals || 0) : 0;
      cs.appearances += player.seasonStats ? (player.seasonStats.appearances || 0) : 0;

      if ((player.overall || 0) > 80) cs.seasonsAbove80 += 1;
      if ((player.overall || 0) > cs.peakOverall) cs.peakOverall = player.overall;

      if (player.teamId && !cs.teamIds.includes(player.teamId)) cs.teamIds.push(player.teamId);

      if (championId && player.teamId === championId) {
        cs.titles = (cs.titles || 0) + 1;
        cs.titlesByClub[championId] = (cs.titlesByClub[championId] || 0) + 1;
      }

      cs.peakSeason = season;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 1 — HALL OF FAME
  // ═══════════════════════════════════════════════════════════════════════════

  const HOF_INDUCTION_REASONS = {
    titles: "3 o mas titulos con el mismo club",
    goals: "50 o mas goles en carrera",
    appearances: "150 o mas apariciones en carrera",
    peak: "5 o mas temporadas con overall mayor a 80"
  };

  function checkHallOfFame(state) {
    const lg = ensureLegacy(state);
    const season = state.seasonNumber || 1;

    Object.keys(lg.playerCareerStats).forEach(function (playerId) {
      if (lg.hallOfFame.some(function (e) { return e.playerId === playerId; })) return;
      const cs = lg.playerCareerStats[playerId];
      const player = getPlayer(state, playerId);
      const name = player ? player.name : playerId;

      let inductionReason = null;
      const titlesPerClub = Object.values(cs.titlesByClub || {});
      if (titlesPerClub.some(function (n) { return n >= 3; })) {
        inductionReason = "titles";
      } else if (cs.goals >= 50) {
        inductionReason = "goals";
      } else if (cs.appearances >= 150) {
        inductionReason = "appearances";
      } else if (cs.seasonsAbove80 >= 5) {
        inductionReason = "peak";
      }

      if (!inductionReason) return;

      const topClubId = Object.keys(cs.titlesByClub || {}).sort(function (a, b) {
        return (cs.titlesByClub[b] || 0) - (cs.titlesByClub[a] || 0);
      })[0] || (player && player.teamId) || null;

      const entry = {
        id: deterministicId("hof", [playerId, inductionReason]),
        playerId: playerId,
        name: name,
        clubId: topClubId,
        clubName: topClubId ? teamName(state, topClubId) : "Varios",
        inductedSeason: season,
        reason: inductionReason,
        reasonText: HOF_INDUCTION_REASONS[inductionReason],
        stats: {
          goals: cs.goals,
          appearances: cs.appearances,
          titles: cs.titles,
          seasonsAbove80: cs.seasonsAbove80,
          peakOverall: cs.peakOverall
        },
        portraitColor: FMG.getClubIdentity ? FMG.getClubIdentity(topClubId).primary : "#888"
      };
      boundedPush(lg.hallOfFame, entry, 100);
      addToClubTimeline(state, topClubId || state.userTeamId, "hof-induction",
        name + " ingresa al Salon de la Fama (" + HOF_INDUCTION_REASONS[inductionReason] + ")", season);

      if (topClubId === state.userTeamId && FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "player-story",
          title: name + " ingresa al Salon de la Fama",
          body: name + " es inducido al Salon de la Fama del futbol chileno. Razon: " + HOF_INDUCTION_REASONS[inductionReason] + ".",
          tags: ["salon-fama", "leyenda"],
          importance: 92,
          entities: { playerId: playerId, teamId: topClubId },
          dedupeKey: "hof-" + playerId + "-" + season
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 2 — CAREER RECORDS
  // ═══════════════════════════════════════════════════════════════════════════

  function updateCareerRecords(state) {
    const lg = ensureLegacy(state);
    const season = state.seasonNumber || 1;
    const cs = lg.playerCareerStats;

    Object.keys(cs).forEach(function (playerId) {
      const stats = cs[playerId];
      const player = getPlayer(state, playerId);
      const name = player ? player.name : playerId;

      if (!lg.allTimeRecords.topScorer || stats.goals > lg.allTimeRecords.topScorer.goals) {
        const prev = lg.allTimeRecords.topScorer;
        lg.allTimeRecords.topScorer = { playerId: playerId, name: name, goals: stats.goals, seasonNumber: season };
        if (prev && FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "player-story",
            title: "Record roto: " + name + " es el maximos goleador historico",
            body: name + " supera el record anterior con " + stats.goals + " goles en carrera. Record roto en Temporada " + season + ".",
            tags: ["record", "goleador"],
            importance: 80,
            dedupeKey: "record-scorer-" + season + "-" + playerId
          });
        }
      }

      if (!lg.allTimeRecords.mostAppearances || stats.appearances > lg.allTimeRecords.mostAppearances.appearances) {
        lg.allTimeRecords.mostAppearances = { playerId: playerId, name: name, appearances: stats.appearances, seasonNumber: season };
      }

      if (!lg.allTimeRecords.highestOverall || stats.peakOverall > lg.allTimeRecords.highestOverall.overall) {
        lg.allTimeRecords.highestOverall = { playerId: playerId, name: name, overall: stats.peakOverall, season: season };
      }

      if (!lg.allTimeRecords.mostTitles || stats.titles > lg.allTimeRecords.mostTitles.titles) {
        lg.allTimeRecords.mostTitles = { playerId: playerId, name: name, titles: stats.titles };
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 3 — CLUB TIMELINES
  // ═══════════════════════════════════════════════════════════════════════════

  function addToClubTimeline(state, clubId, type, description, season) {
    if (!clubId) return;
    const lg = ensureLegacy(state);
    if (!lg.clubTimelines[clubId]) lg.clubTimelines[clubId] = [];
    const id = deterministicId("timeline", [clubId, type, season || 1, description.slice(0, 20)]);
    if (lg.clubTimelines[clubId].some(function (e) { return e.id === id; })) return;
    const entry = { id: id, season: season || state.seasonNumber || 1, type: type, description: description };
    boundedPush(lg.clubTimelines[clubId], entry, 30);
  }

  function syncClubTimelines(state) {
    ensureLegacy(state);
    const season = state.seasonNumber || 1;

    const wh = state.worldHistory || {};

    Object.keys(wh.dynasties || {}).forEach(function (clubId) {
      const rec = wh.dynasties[clubId];
      if (rec && rec.isDynasty && rec.lastTitleSeason === season) {
        addToClubTimeline(state, clubId, "dynasty",
          teamName(state, clubId) + ": " + rec.consecutiveTitles + " titulos consecutivos. Dinastia consolidada.", season);
      }
    });

    Object.keys(wh.fallenGiants || {}).forEach(function (clubId) {
      const rec = wh.fallenGiants[clubId];
      if (rec && rec.status === "fallen" && rec.fallenSeason === season) {
        addToClubTimeline(state, clubId, "fallen-giant",
          teamName(state, clubId) + " atraviesa su mayor crisis historica.", season);
      }
      if (rec && rec.status === "recovered" && rec.recoveredSeason === season) {
        addToClubTimeline(state, clubId, "recovery",
          teamName(state, clubId) + " resurgió de sus cenizas.", season);
      }
    });

    (state.legendaryMoments || []).filter(function (m) { return m.seasonNumber === season; }).forEach(function (m) {
      if (m.teamId) addToClubTimeline(state, m.teamId, "legendary-moment", m.description, season);
    });

    const champId = state.champion ? state.champion.teamId : null;
    if (champId) addToClubTimeline(state, champId, "title", teamName(state, champId) + " se corona campeon de la temporada " + season + ".", season);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 4 — MANAGER LEGACY SCORE
  // ═══════════════════════════════════════════════════════════════════════════

  const LEGACY_LABELS = [
    { min: 81, label: "Monumento vivo" },
    { min: 61, label: "Idolo eterno" },
    { min: 41, label: "Leyenda local" },
    { min: 21, label: "Recordado" },
    { min: 0, label: "Pasajero" }
  ];

  function computeManagerLegacy(state) {
    const lg = ensureLegacy(state);
    const career = state.career || {};
    const trophies = career.trophies || [];
    const history = career.history || [];

    const totalTitles = trophies.length;
    const seasonsManaged = history.length;
    const clubSet = {};
    history.forEach(function (h) { if (h.teamId) clubSet[h.teamId] = true; });
    const clubsManaged = Object.keys(clubSet).length;

    const seasonMoments = (state.legendaryMoments || []).filter(function (m) {
      return m.teamId === state.userTeamId;
    }).length;

    const hofNurtured = lg.hallOfFame.filter(function (e) { return e.clubId === state.userTeamId; }).length;

    const score = clamp(
      Math.round(
        totalTitles * 12 +
        seasonsManaged * 3 +
        clubsManaged * 2 +
        seasonMoments * 8 +
        hofNurtured * 15
      ),
      0,
      100
    );

    const label = (LEGACY_LABELS.find(function (l) { return score >= l.min; }) || LEGACY_LABELS[LEGACY_LABELS.length - 1]).label;

    lg.managerLegacy = {
      totalTitles: totalTitles,
      seasonsManaged: seasonsManaged,
      clubsManaged: clubsManaged,
      legendaryMomentsInvolved: seasonMoments,
      hallOfFamePlayersNurtured: hofNurtured,
      legacyScore: score,
      legacyLabel: label
    };

    return lg.managerLegacy;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 5 — DOCUMENTARY GENERATION
  // ═══════════════════════════════════════════════════════════════════════════

  function generateSeasonDocumentary(state) {
    const lg = ensureLegacy(state);
    const season = state.seasonNumber || 1;
    const uid = state.userTeamId;
    const clubName = teamName(state, uid);
    const history = (state.career && state.career.history) || [];
    const currentRecord = history[0] || {};
    const pos = currentRecord.position || "?";
    const pts = currentRecord.points || 0;
    const champId = state.champion ? state.champion.teamId : null;
    const champName = champId ? teamName(state, champId) : "un equipo desconocido";

    const seasonMoments = (state.legendaryMoments || []).filter(function (m) { return m.seasonNumber === season; });
    const derbyMoments = seasonMoments.filter(function (m) { return m.type === "derby_decider"; });
    const hatTricks = seasonMoments.filter(function (m) { return m.type === "hat_trick"; });
    const comebacks = seasonMoments.filter(function (m) { return m.type === "massive_comeback"; });

    const wh = state.worldHistory || {};
    const dynasty = wh.dynasties && wh.dynasties[champId];
    const isDynastyYear = dynasty && dynasty.isDynasty;

    const drEvents = (state.dressingRoomEvents || []).filter(function (e) {
      return e.seasonNumber === season && e.type === "ego-clash";
    });
    const scandals = (state.scandals || []).filter(function (e) { return e.seasonNumber === season; });

    const p1 = "La temporada " + season + " de " + clubName + " termino con el equipo en el " + pos + " lugar con " + pts + " puntos. " +
      (champId === uid
        ? "La campana fue historica: el campeonato llegó con meritos propios."
        : champName + " se llevo el titulo, dejando a " + clubName + " a " + (isDynastyYear ? "distancia de una dinastia que crece" : "la busqueda de su mejor version") + ".");

    const p2 = seasonMoments.length > 0
      ? "La temporada guardo momentos para el recuerdo: " +
        (hatTricks.length ? hatTricks[0].description + ". " : "") +
        (comebacks.length ? comebacks[0].description + ". " : "") +
        (derbyMoments.length ? "El clasico quedo en la memoria con " + derbyMoments[0].description + "." : "Las emociones marcaron a los protagonistas.")
      : "En lo deportivo, la temporada no dejo momentos legendarios, pero si lecciones que el cuerpo tecnico procesara para el futuro.";

    const p3 = (drEvents.length > 0 || scandals.length > 0)
      ? "Dentro del vestuario, la temporada tuvo su cuota de drama: " +
        (scandals.length ? "se registraron " + scandals.length + " escandalo(s) que sacudieron la imagen del club. " : "") +
        (drEvents.length ? drEvents[0].title + " fue el episodio mas comentado entre bastidores. " : "") +
        "El legado del tecnico queda en " + lg.managerLegacy.legacyLabel + " segun los anales del futbol chileno."
      : "La temporada transcurrio sin grandes tormentas internas. El tecnico mantiene su clasificacion como " +
        lg.managerLegacy.legacyLabel + " en la historia del club.";

    const docId = deterministicId("doc", [season, uid]);
    if (lg.seasonDocumentaries.some(function (d) { return d.id === docId; })) return;
    const doc = {
      id: docId,
      season: season,
      teamId: uid,
      clubName: clubName,
      paragraphs: [p1, p2, p3],
      generatedAt: season
    };
    boundedPush(lg.seasonDocumentaries, doc, 10);
    return doc;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SEASON-END RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  function runLegacySeasonEnd(state, seasonRecord) {
    ensureLegacy(state);
    accumulateCareerStats(state);
    updateCareerRecords(state);
    checkHallOfFame(state);
    syncClubTimelines(state);
    computeManagerLegacy(state);
    generateSeasonDocumentary(state);
    void seasonRecord;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK: wrap FMG.evaluateCareerSeasonEnd
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevEvaluate = FMG.evaluateCareerSeasonEnd;
  FMG.evaluateCareerSeasonEnd = function (state, seasonRecord) {
    const result = _prevEvaluate ? _prevEvaluate(state, seasonRecord) : {};
    runLegacySeasonEnd(state, seasonRecord);
    return result;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.LegacyEngine = {
    ensure: ensureLegacy,
    runSeasonEnd: runLegacySeasonEnd,
    accumulateCareerStats: accumulateCareerStats,
    checkHallOfFame: checkHallOfFame,
    updateCareerRecords: updateCareerRecords,
    syncClubTimelines: syncClubTimelines,
    computeManagerLegacy: computeManagerLegacy,
    generateSeasonDocumentary: generateSeasonDocumentary,
    addToClubTimeline: addToClubTimeline,
    getHallOfFame: function (state) { return (state.legacy && state.legacy.hallOfFame) || []; },
    getClubTimeline: function (state, clubId) {
      return (state.legacy && state.legacy.clubTimelines && state.legacy.clubTimelines[clubId]) || [];
    },
    getDocumentaries: function (state) { return (state.legacy && state.legacy.seasonDocumentaries) || []; },
    getManagerLegacy: function (state) { return (state.legacy && state.legacy.managerLegacy) || null; },
    getAllTimeRecords: function (state) { return (state.legacy && state.legacy.allTimeRecords) || null; }
  };

  FMG.ensureLegacy = ensureLegacy;
})();
