(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const hashText = FMG.hashText;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function ensureWorldHistory(state) {
    state.worldHistory = state.worldHistory || {};
    const wh = state.worldHistory;
    wh.version = 1;
    wh.dynasties = wh.dynasties || {};
    wh.fallenGiants = wh.fallenGiants || {};
    wh.goldenGenerations = wh.goldenGenerations || {};
    wh.tacticalEras = wh.tacticalEras || { history: [], currentEra: null, eraStartSeason: null, consecutiveSeasons: 0 };
    wh.economicCycle = wh.economicCycle || { phase: "neutral", phaseSince: 1, inflationMultiplier: 1.0 };
    wh.worldEvents = wh.worldEvents || [];
    return wh;
  }

  function getTeam(state, teamId) {
    return (state.teams || []).find(function (t) { return t.id === teamId; }) || null;
  }

  function getClubPrestige(teamId) {
    return (FMG.ClubCulture && FMG.ClubCulture.DNA && FMG.ClubCulture.DNA[teamId])
      ? FMG.ClubCulture.DNA[teamId].prestige
      : 50;
  }

  function getClubTacticalDNA(teamId) {
    return (FMG.ClubCulture && FMG.ClubCulture.DNA && FMG.ClubCulture.DNA[teamId])
      ? FMG.ClubCulture.DNA[teamId].tacticalDNA
      : "balanced";
  }

  function standingPos(state, teamId) {
    const idx = (state.standings || []).findIndex(function (e) { return e.teamId === teamId; });
    return idx >= 0 ? idx + 1 : (state.teams || []).length;
  }

  function totalTeams(state) {
    return (state.teams || []).length || 16;
  }

  function recordWorldEvent(state, type, detail, teamId) {
    const wh = ensureWorldHistory(state);
    const entry = {
      id: deterministicId("world-ev", [type, state.seasonNumber || 1, teamId || ""]),
      seasonNumber: state.seasonNumber || 1,
      type: type,
      teamId: teamId || null,
      detail: detail
    };
    boundedPush(wh.worldEvents, entry, 40);
    const eco = state.managerEcosystem;
    if (eco && eco.worldMemory && eco.worldMemory.events) {
      const ecoEntry = {
        id: entry.id,
        week: state.currentWeek || 1,
        seasonNumber: state.seasonNumber || 1,
        type: "world-evolution",
        title: detail,
        detail: type
      };
      const alreadyHas = eco.worldMemory.events.some(function (e) { return e.id === ecoEntry.id; });
      if (!alreadyHas) {
        eco.worldMemory.events.unshift(ecoEntry);
        eco.worldMemory.events = eco.worldMemory.events.slice(0, 80);
      }
    }
    return entry;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 1 — DYNASTIES
  // ═══════════════════════════════════════════════════════════════════════════

  function updateDynasties(state, seasonRecord) {
    const wh = ensureWorldHistory(state);
    const season = state.seasonNumber || 1;
    const championId = seasonRecord ? seasonRecord.championTeamId : (state.champion && state.champion.teamId);
    if (!championId) return;

    (state.teams || []).forEach(function (t) {
      wh.dynasties[t.id] = wh.dynasties[t.id] || { titles: 0, consecutiveTitles: 0, lastTitleSeason: null, isDynasty: false };
      if (t.id !== championId) {
        wh.dynasties[t.id].consecutiveTitles = 0;
      }
    });

    const rec = wh.dynasties[championId];
    rec.titles = (rec.titles || 0) + 1;
    rec.consecutiveTitles = (rec.consecutiveTitles || 0) + 1;
    rec.lastTitleSeason = season;
    const wasDynasty = rec.isDynasty;
    rec.isDynasty = rec.consecutiveTitles >= 3;

    if (rec.isDynasty && !wasDynasty) {
      const t = getTeam(state, championId);
      const clubName = t ? t.name : championId;
      recordWorldEvent(state, "dynasty-start", clubName + " establece una dinastia con " + rec.consecutiveTitles + " titulos consecutivos.", championId);
      if (FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "world-reaction",
          title: "Nace una dinastia: " + clubName + " domina el futbol chileno",
          body: clubName + " consigue su " + rec.consecutiveTitles + "° titulo consecutivo. El resto de la liga solo piensa en como frenar este dominio.",
          tags: ["dinastia", "dominacion", "historia"],
          importance: 92,
          entities: { teamId: championId },
          dedupeKey: "dynasty-start-" + season + "-" + championId
        });
      }
    }

    if (!rec.isDynasty && wasDynasty) {
      const t = getTeam(state, championId);
      const clubName = t ? t.name : championId;
      recordWorldEvent(state, "dynasty-end", "La dinastia de " + clubName + " llega a su fin.", championId);
      if (FMG.addNewsItem) {
        FMG.addNewsItem(state, {
          type: "world-reaction",
          title: "El fin de una era: la dinastia queda interrumpida",
          body: "El dominio que parecia eterno ha terminado. Una nueva pagina se abre en el futbol chileno.",
          tags: ["dinastia", "historia"],
          importance: 85,
          dedupeKey: "dynasty-end-" + season + "-" + championId
        });
      }
    }
  }

  function getDynastyBonus(state, teamId) {
    const wh = state.worldHistory;
    if (!wh || !wh.dynasties || !wh.dynasties[teamId]) return { prestige: 0, budgetMultiplier: 1 };
    const rec = wh.dynasties[teamId];
    if (!rec.isDynasty) return { prestige: 0, budgetMultiplier: 1 };
    return { prestige: 8, budgetMultiplier: 1.12 };
  }

  function applyDynastyMotivation(state, opponentTeamId) {
    const wh = state.worldHistory;
    if (!wh || !wh.dynasties) return;
    const dynRec = wh.dynasties[opponentTeamId];
    if (!dynRec || !dynRec.isDynasty) return;
    const uid = state.userTeamId;
    (state.players || []).filter(function (p) { return p.teamId === uid && !p.retired; }).forEach(function (p) {
      p.morale = clamp((p.morale || 55) + 5, 0, 100);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 2 — FALLEN GIANTS
  // ═══════════════════════════════════════════════════════════════════════════

  function updateFallenGiants(state) {
    const wh = ensureWorldHistory(state);
    const season = state.seasonNumber || 1;
    const total = totalTeams(state);
    const half = Math.ceil(total / 2);

    (state.teams || []).forEach(function (t) {
      const prestige = getClubPrestige(t.id);
      if (prestige < 80) return;

      wh.fallenGiants[t.id] = wh.fallenGiants[t.id] || { badSeasons: 0, status: null, fallenSeason: null };
      const rec = wh.fallenGiants[t.id];
      const pos = standingPos(state, t.id);

      if (pos > half) {
        rec.badSeasons = (rec.badSeasons || 0) + 1;
      } else {
        if (rec.badSeasons > 0) rec.badSeasons -= 1;
        if (rec.status === "fallen" && pos <= 4) {
          rec.status = "recovered";
          rec.recoveredSeason = season;
          recordWorldEvent(state, "fallen-giant-recovery", t.name + " resurge y recupera su nivel de elite.", t.id);
          if (FMG.addNewsItem) {
            FMG.addNewsItem(state, {
              type: "world-reaction",
              title: "El renacimiento de " + t.name,
              body: t.name + " regresa a la elite tras su periodo oscuro. Una recuperacion que ya es parte de la historia del futbol chileno.",
              tags: ["renacimiento", "historia"],
              importance: 88,
              dedupeKey: "giant-recovery-" + season + "-" + t.id
            });
          }
        }
      }

      if (rec.badSeasons >= 3 && rec.status !== "fallen") {
        rec.status = "fallen";
        rec.fallenSeason = season;
        recordWorldEvent(state, "fallen-giant", t.name + " cae: un grande sufre su peor crisis en anos.", t.id);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "world-reaction",
            title: "La caida de " + t.name + ": una institucion en crisis",
            body: t.name + " acumula " + rec.badSeasons + " temporadas en la mitad baja de la tabla. La crisis deportiva amenaza con arrastrar a la institucion.",
            tags: ["crisis", "caida", "historia"],
            importance: 90,
            entities: { teamId: t.id },
            dedupeKey: "fallen-giant-" + season + "-" + t.id
          });
        }
        triggerFallenGiantBudgetCrisis(state, t.id);
      }
    });
  }

  function triggerFallenGiantBudgetCrisis(state, teamId) {
    const wh = ensureWorldHistory(state);
    if (!wh.fallenGiants[teamId]) return;
    wh.fallenGiants[teamId].budgetPenalty = 0.3;

    if (teamId === state.userTeamId && state.finances) {
      const reduction = Math.round((state.finances.balance || 0) * 0.3);
      state.finances.balance = clamp((state.finances.balance || 0) - reduction, 0, 999999999);
      if (state.finances.budgets) {
        state.finances.budgets.transfers = clamp((state.finances.budgets.transfers || 0) - Math.round(reduction * 0.5), 0, 999999999);
      }
    }

    const keyPlayers = (state.players || []).filter(function (p) {
      return p.teamId === teamId && !p.retired && (p.squadRole === "key" || (p.overall || 0) >= 74);
    });
    keyPlayers.slice(0, 2).forEach(function (p) {
      p.transferRequest = true;
      p.happiness = clamp((p.happiness || 55) - 12, 0, 100);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 3 — GOLDEN GENERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function updateGoldenGenerations(state) {
    const wh = ensureWorldHistory(state);
    const season = state.seasonNumber || 1;
    const activePlayers = (state.players || []).filter(function (p) { return !p.retired; });
    const sorted = activePlayers.slice().sort(function (a, b) { return (b.overall || 0) - (a.overall || 0); });
    const top10 = sorted.slice(0, 10);
    const youngTop10 = top10.filter(function (p) { return p.age < 26; });

    const byClub = {};
    youngTop10.forEach(function (p) {
      byClub[p.teamId] = byClub[p.teamId] || [];
      byClub[p.teamId].push(p.id);
    });

    Object.keys(wh.goldenGenerations).forEach(function (tid) {
      if (wh.goldenGenerations[tid].active && !byClub[tid]) {
        wh.goldenGenerations[tid].active = false;
        wh.goldenGenerations[tid].endSeason = season;
      }
    });

    Object.keys(byClub).forEach(function (tid) {
      if (byClub[tid].length < 3) return;
      const wasActive = wh.goldenGenerations[tid] && wh.goldenGenerations[tid].active;
      wh.goldenGenerations[tid] = { active: true, season: season, playerIds: byClub[tid] };
      if (!wasActive) {
        const t = getTeam(state, tid);
        const clubName = t ? t.name : tid;
        recordWorldEvent(state, "golden-generation", clubName + " tiene una generacion dorada: " + byClub[tid].length + " jovenes en el top-10 del pais.", tid);
        if (FMG.addNewsItem) {
          FMG.addNewsItem(state, {
            type: "player-story",
            title: "Generacion dorada: " + clubName + " tiene " + byClub[tid].length + " figuras en el olimpo del futbol chileno",
            body: "Con " + byClub[tid].length + " jugadores menores de 26 en el top-10 de calidad, " + clubName + " vive un momento irrepetible. El mercado internacional ya los mira.",
            tags: ["generacion-dorada", "joven", "talento"],
            importance: 85,
            entities: { teamId: tid },
            dedupeKey: "golden-gen-" + season + "-" + tid
          });
        }
        if (tid === state.userTeamId && state.managerEcosystem && state.managerEcosystem.worldMedia && state.managerEcosystem.worldMedia.fans) {
          state.managerEcosystem.worldMedia.fans.pressure = clamp((state.managerEcosystem.worldMedia.fans.pressure || 45) - 10, 0, 100);
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 4 — TACTICAL ERAS
  // ═══════════════════════════════════════════════════════════════════════════

  function detectDominantTactic(state) {
    const sorted = FMG.sortStandings ? FMG.sortStandings(state.standings) : (state.standings || []);
    const styleCount = {};
    sorted.slice(0, 6).forEach(function (entry) {
      const style = getClubTacticalDNA(entry.teamId);
      styleCount[style] = (styleCount[style] || 0) + 1;
    });
    let dominant = null;
    let max = 0;
    Object.keys(styleCount).forEach(function (style) {
      if (styleCount[style] > max) { max = styleCount[style]; dominant = style; }
    });
    return dominant || "balanced";
  }

  function updateTacticalEras(state) {
    const wh = ensureWorldHistory(state);
    const season = state.seasonNumber || 1;
    const dominant = detectDominantTactic(state);

    wh.tacticalEras.history = wh.tacticalEras.history || [];
    wh.tacticalEras.history.unshift({ season: season, dominantStyle: dominant });
    wh.tacticalEras.history = wh.tacticalEras.history.slice(0, 10);

    const prev = wh.tacticalEras.history[1];
    if (prev && prev.dominantStyle === dominant) {
      wh.tacticalEras.consecutiveSeasons = (wh.tacticalEras.consecutiveSeasons || 0) + 1;
    } else {
      wh.tacticalEras.consecutiveSeasons = 1;
    }

    if (wh.tacticalEras.consecutiveSeasons >= 2 && wh.tacticalEras.currentEra !== dominant) {
      const prevEra = wh.tacticalEras.currentEra;
      wh.tacticalEras.currentEra = dominant;
      wh.tacticalEras.eraStartSeason = season;
      recordWorldEvent(state, "tactical-era", "Nueva era tactica: el " + dominant + " domina la liga.", null);
      if (FMG.addNewsItem && prevEra) {
        FMG.addNewsItem(state, {
          type: "world-reaction",
          title: "El futbol chileno entra en la era del " + dominant,
          body: "Dos temporadas seguidas con el " + dominant + " como estilo dominante. El ADN tactico de la liga esta cambiando. Los equipos que no se adapten pagaran las consecuencias.",
          tags: ["era-tactica", dominant, "liga"],
          importance: 78,
          dedupeKey: "tactical-era-" + season + "-" + dominant
        });
      }
    }
  }

  function getCurrentEra(state) {
    const wh = state.worldHistory;
    return (wh && wh.tacticalEras && wh.tacticalEras.currentEra) || null;
  }

  function getTacticalEraSurpriseBonus(state, teamId) {
    const era = getCurrentEra(state);
    if (!era) return 0;
    const clubDNA = getClubTacticalDNA(teamId);
    if (clubDNA === era) return -2;
    return 3;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM 5 — ECONOMIC CYCLES
  // ═══════════════════════════════════════════════════════════════════════════

  const CYCLE_PHASES = ["boom", "neutral", "crisis"];
  const CYCLE_INFLATION = { boom: 1.15, neutral: 1.0, crisis: 0.88 };
  const CYCLE_BUDGET_DELTA = { boom: 0.15, neutral: 0, crisis: -0.12 };

  function computeEconomicPhase(state) {
    const seed = state.seed || 1;
    const season = state.seasonNumber || 1;
    const cycleIndex = Math.floor((season - 1) / 4);
    const hash = hashText("econ-cycle-" + seed + "-" + cycleIndex);
    return CYCLE_PHASES[hash % 3];
  }

  function updateEconomicCycle(state) {
    const wh = ensureWorldHistory(state);
    const season = state.seasonNumber || 1;
    const newPhase = computeEconomicPhase(state);
    const prevPhase = wh.economicCycle.phase;

    wh.economicCycle.phase = newPhase;
    wh.economicCycle.inflationMultiplier = CYCLE_INFLATION[newPhase] || 1.0;

    if ((season - 1) % 4 === 0 && newPhase !== prevPhase) {
      wh.economicCycle.phaseSince = season;
      recordWorldEvent(state, "economic-cycle", "Ciclo economico: " + newPhase + " en el mercado de fichajes.", null);
      if (FMG.addNewsItem) {
        const msgs = {
          boom: "El mercado de pases entra en fase de expansion. Los presupuestos suben un 15% y hay mas dinero circulando.",
          crisis: "El mercado se contrae. Los clubes ajustan cinturones y los fichajes se vuelven mas escasos y baratos.",
          neutral: "El mercado se estabiliza tras el ciclo anterior. Los presupuestos vuelven a su estado natural."
        };
        FMG.addNewsItem(state, {
          type: "finance",
          title: "Nuevo ciclo economico: " + newPhase.toUpperCase() + " en el mercado",
          body: msgs[newPhase] || "El mercado cambia de ciclo.",
          tags: ["economia", "mercado", newPhase],
          importance: 72,
          dedupeKey: "econ-cycle-" + season + "-" + newPhase
        });
      }
    }

    const adv = state.market && state.market.advanced;
    if (adv && adv.economy) {
      adv.economy.inflationMultiplier = wh.economicCycle.inflationMultiplier;
      adv.economy.inflation = clamp(
        (adv.economy.inflation || 1.0) * wh.economicCycle.inflationMultiplier,
        0.75,
        1.65
      );
    }
  }

  function applyBudgetCycleEffects(state) {
    const wh = state.worldHistory;
    if (!wh || !wh.economicCycle) return;
    const delta = CYCLE_BUDGET_DELTA[wh.economicCycle.phase] || 0;
    if (delta === 0) return;

    (state.teams || []).forEach(function (t) {
      if (state.rivalAI && state.rivalAI.budgets && state.rivalAI.budgets[t.id]) {
        state.rivalAI.budgets[t.id] = clamp(
          Math.round(state.rivalAI.budgets[t.id] * (1 + delta)),
          1000000,
          999999999
        );
      }
    });

    if (state.finances && delta !== 0) {
      const userBonus = Math.round((state.finances.balance || 0) * Math.abs(delta) * 0.5);
      if (delta > 0) {
        state.finances.balance = (state.finances.balance || 0) + userBonus;
      } else {
        state.finances.balance = clamp((state.finances.balance || 0) - userBonus, 0, 999999999);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN SEASON-END RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  function runWorldEvolutionSeasonEnd(state, seasonRecord) {
    ensureWorldHistory(state);
    updateDynasties(state, seasonRecord);
    updateFallenGiants(state);
    updateGoldenGenerations(state);
    updateTacticalEras(state);
    updateEconomicCycle(state);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK: wrap FMG.evaluateCareerSeasonEnd
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevEvaluateCareerSeasonEnd = FMG.evaluateCareerSeasonEnd;
  FMG.evaluateCareerSeasonEnd = function (state, seasonRecord) {
    const result = _prevEvaluateCareerSeasonEnd ? _prevEvaluateCareerSeasonEnd(state, seasonRecord) : {};
    runWorldEvolutionSeasonEnd(state, seasonRecord);
    return result;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK: wrap FMG.startNewSeason to apply budget effects
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevStartNewSeason = FMG.startNewSeason;
  FMG.startNewSeason = function () {
    const result = _prevStartNewSeason ? _prevStartNewSeason() : { ok: false, message: "No disponible." };
    if (result.ok) {
      const state = FMG.gameState;
      applyBudgetCycleEffects(state);
    }
    return result;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK: wrap FMG.computeTeamStrength for tactical era bonus
  // ═══════════════════════════════════════════════════════════════════════════

  const prevComputeStrength = FMG.computeTeamStrength;
  if (typeof prevComputeStrength === "function" && !prevComputeStrength._evolutionWrapped) {
    const wrapped = function (team, players, state) {
      const base = prevComputeStrength(team, players, state);
      const eraBonus = state ? getTacticalEraSurpriseBonus(state, team.id) : 0;
      return base + eraBonus;
    };
    wrapped._evolutionWrapped = true;
    if (prevComputeStrength._humanAIWrapped) wrapped._humanAIWrapped = true;
    if (prevComputeStrength._cultureWrapped) wrapped._cultureWrapped = true;
    FMG.computeTeamStrength = wrapped;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY HOOK: dynasty rivalry motivation
  // ═══════════════════════════════════════════════════════════════════════════

  const _prevRunWeekWE = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options) {
    const result = _prevRunWeekWE ? _prevRunWeekWE(state, options) : {};
    if (!state || !state.userTeamId) return result;
    ensureWorldHistory(state);
    const uid = state.userTeamId;
    const upcoming = (state.fixtures || []).find(function (f) {
      return !f.played && f.week === (state.currentWeek || 1) + 1 && (f.matches || []).some(function (m) {
        return m.homeTeamId === uid || m.awayTeamId === uid;
      });
    });
    if (upcoming) {
      const nextMatch = (upcoming.matches || []).find(function (m) { return m.homeTeamId === uid || m.awayTeamId === uid; });
      if (nextMatch) {
        const opponentId = nextMatch.homeTeamId === uid ? nextMatch.awayTeamId : nextMatch.homeTeamId;
        applyDynastyMotivation(state, opponentId);
      }
    }
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.WorldEvolution = {
    ensure: ensureWorldHistory,
    runSeasonEnd: runWorldEvolutionSeasonEnd,
    getDynastyBonus: getDynastyBonus,
    getCurrentEra: getCurrentEra,
    getTacticalEraSurpriseBonus: getTacticalEraSurpriseBonus,
    computeEconomicPhase: computeEconomicPhase,
    getGoldenGeneration: function (state, teamId) {
      const wh = state.worldHistory;
      return (wh && wh.goldenGenerations && wh.goldenGenerations[teamId]) || null;
    },
    isFallenGiant: function (state, teamId) {
      const wh = state.worldHistory;
      return !!(wh && wh.fallenGiants && wh.fallenGiants[teamId] && wh.fallenGiants[teamId].status === "fallen");
    }
  };

  FMG.ensureWorldHistory = ensureWorldHistory;
})();
