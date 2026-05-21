(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  const clamp = FMG.clamp;
  const hashText = FMG.hashText;
  const deterministicId = FMG.deterministicId;
  const boundedPush = FMG.boundedPush;

  // ═══════════════════════════════════════════════════════════════════════════
  // FASE 10 — PLAYER CAREER MODE
  // ═══════════════════════════════════════════════════════════════════════════

  function getSquad(state) {
    return (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; });
  }

  function ensurePlayerCareer(state) {
    state.playerCareer = state.playerCareer || {};
    const pc = state.playerCareer;
    pc.version = 1;
    pc.reputation = pc.reputation || { local: 30, league: 20, world: 10, fanPop: 30, mediaImage: 40 };
    pc.psychology = pc.psychology || { confidence: 55, pressure: 30, ambition: 70, morale: 60, burnout: 20, discipline: 65 };
    pc.lifestyle = pc.lifestyle || { professionalism: 65, trainingFocus: 70, nightlifeRisk: 15, recoveryQuality: 60 };
    pc.career = pc.career || { goals: 0, assists: 0, matches: 0, trophies: [], clubs: [], currentClub: null, yearsActive: 0, loyalty: 60 };
    pc.relationships = pc.relationships || { teammates: {}, coaches: {}, rivals: [], agents: [] };
    pc.decisions = pc.decisions || [];
    pc.events = pc.events || [];
    pc.legacy = pc.legacy || { hallOfFame: false, legendScore: 0, recordsHeld: [], legendaryMoments: [], retirementSummary: null };
    return pc;
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  function weeklyWinRate(state) {
    const recent = (state.seasonLog || []).filter(function (e) { return e.result; }).slice(0, 8);
    if (!recent.length) return 0.5;
    return recent.filter(function (e) { return e.result === "victoria"; }).length / recent.length;
  }

  function recentLossStreak(state) {
    const recent = (state.seasonLog || []).filter(function (e) { return e.result; }).slice(0, 5);
    let streak = 0;
    for (let i = 0; i < recent.length; i++) {
      if (recent[i].result === "derrota") streak++;
      else break;
    }
    return streak;
  }

  function didUserWin(state, result) {
    const uid = state.userTeamId;
    if (!result || !uid) return false;
    if (result.homeTeamId === uid) return result.homeGoals > result.awayGoals;
    if (result.awayTeamId === uid) return result.awayGoals > result.homeGoals;
    return false;
  }

  function getScoreDiff(state, result) {
    const uid = state.userTeamId;
    if (!result || !uid) return 0;
    if (result.homeTeamId === uid) return result.homeGoals - result.awayGoals;
    if (result.awayTeamId === uid) return result.awayGoals - result.homeGoals;
    return 0;
  }

  function findStarPlayer(state, fu) {
    const squad = getSquad(state);
    if (!squad.length) return null;
    return squad.reduce(function (best, p) {
      const rep = fu.playerReputation && fu.playerReputation[p.id];
      const pop = rep ? rep.popularity : 0;
      const bestPop = best && fu.playerReputation && fu.playerReputation[best.id]
        ? fu.playerReputation[best.id].popularity : 0;
      return pop > bestPop ? p : best;
    }, null);
  }

  function generateCareerEvent(state, type, title, detail) {
    const pc = ensurePlayerCareer(state);
    const id = deterministicId("cevt", [state.seasonNumber || 1, state.currentWeek || 1, type]);
    if (pc.events.some(function (e) { return e.id === id; })) return null;
    const event = { id: id, type: type, title: title, detail: detail, week: state.currentWeek || 1, season: state.seasonNumber || 1 };
    boundedPush(pc.events, event, 20);
    if (FMG.pushCareerLog) FMG.pushCareerLog(state, title, detail);
    return event;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PLAYER REPUTATION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  function updatePlayerCareerReputation(state) {
    const pc = ensurePlayerCareer(state);
    const fu = state.footballUniverse;
    const pos = (state.standings || []).findIndex(function (e) { return e.teamId === state.userTeamId; }) + 1;
    const winRate = weeklyWinRate(state);

    pc.reputation.local = clamp(Math.round(
      pc.reputation.local * 0.86 +
      (pos <= 3 ? 12 : pos <= 6 ? 6 : pos >= 12 ? -4 : 2) +
      winRate * 8
    ), 0, 100);

    pc.reputation.league = clamp(Math.round(
      pc.reputation.league * 0.97 +
      (pc.career.trophies.length * 0.3) +
      (pc.reputation.local > 70 ? 1.5 : 0)
    ), 0, 100);

    if (pc.career.trophies.length >= 3 || pc.legacy.legendScore >= 60) {
      pc.reputation.world = clamp(pc.reputation.world + 0.5, 0, 100);
    }

    if (fu && fu.playerReputation) {
      const star = findStarPlayer(state, fu);
      if (star) {
        pc.reputation.fanPop = clamp(Math.round(
          pc.reputation.fanPop * 0.9 + (fu.playerReputation[star.id] ? fu.playerReputation[star.id].popularity : 50) * 0.1
        ), 0, 100);
      }
    }

    const scandals = (state.scandals || []).filter(function (s) {
      return !s.resolved && s.seasonNumber === (state.seasonNumber || 1);
    });
    pc.reputation.mediaImage = clamp(Math.round(
      pc.reputation.mediaImage * 0.94 - scandals.length * 3 +
      (pc.reputation.local > 65 ? 2 : -1)
    ), 0, 100);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PLAYER PSYCHOLOGY ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  function updatePlayerCareerPsychology(state) {
    const pc = ensurePlayerCareer(state);
    const psych = state.psychology || {};
    const weeklyPressure = (psych.manager && psych.manager.pressure) || 30;

    pc.psychology.burnout = clamp(
      pc.psychology.burnout + (weeklyPressure > 65 ? 2 : -1), 0, 100
    );

    if (pc.psychology.burnout >= 80) {
      pc.psychology.confidence = clamp(pc.psychology.confidence - 3, 0, 100);
      pc.psychology.morale = clamp(pc.psychology.morale - 4, 0, 100);
      generateCareerEvent(state, "burnout-crisis",
        "El desgaste acumulado pasa factura",
        "La intensidad de la temporada esta afectando el rendimiento del cuerpo tecnico. Necesitas un respiro.");
    }

    const pos = (state.standings || []).findIndex(function (e) { return e.teamId === state.userTeamId; }) + 1;
    if (pos > 6 && pc.reputation.league > 55) {
      pc.psychology.ambition = clamp(pc.psychology.ambition + 1, 0, 100);
    }

    const recentLosses = recentLossStreak(state);
    pc.psychology.pressure = clamp(pc.psychology.pressure + recentLosses * 3 - 2, 0, 100);

    if (pc.lifestyle.nightlifeRisk >= 60) {
      pc.psychology.discipline = clamp(pc.psychology.discipline - 2, 0, 100);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CAREER DECISIONS ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  const DECISION_TEMPLATES = {
    "transfer-ambition": {
      title: "¿Buscar un desafio mayor?",
      detail: "La ambicion del cuerpo tecnico pide mas. ¿Es momento de dar el salto a un club mas grande?",
      choices: [
        { id: "request", label: "Abrir negociaciones", effect: { ambition: -20, reputation: 5, loyalty: -10 } },
        { id: "stay", label: "Comprometerse con el club", effect: { loyalty: 15, morale: 8, ambition: 5 } },
        { id: "wait", label: "Evaluar al final de temporada", effect: { ambition: 3 } }
      ]
    },
    "salary-demand": {
      title: "Negociar renovacion",
      detail: "El contrato vence. El club ofrece renovar pero las condiciones son debatibles.",
      choices: [
        { id: "accept", label: "Aceptar la oferta", effect: { morale: 5, loyalty: 8 } },
        { id: "demand", label: "Exigir mejores condiciones", effect: { boardTrust: -8, ambition: -10 } },
        { id: "reject", label: "Rechazar y explorar el mercado", effect: { loyalty: -20, ambition: -15, reputation: 3 } }
      ]
    },
    "playtime-demand": {
      title: "Crisis de protagonismo",
      detail: "Un jugador clave exige mas participacion o amenaza con marcharse.",
      choices: [
        { id: "promise", label: "Prometerle minutos", effect: { morale: 10, pressure: 8 } },
        { id: "sell", label: "Abrir su venta", effect: { morale: -5 } },
        { id: "dialogue", label: "Gestionar internamente", effect: { cohesion: 5, pressure: 3 } }
      ]
    },
    "trophy-ambition": {
      title: "¿Ir a por el titulo?",
      detail: "La posicion permite competir. Arriesgar todo puede costar caro si falla.",
      choices: [
        { id: "allin", label: "Presupuesto maximo en refuerzos", effect: { ambition: -15, pressure: 15 } },
        { id: "organic", label: "Crecer con lo que hay", effect: { pressure: -5 } },
        { id: "balanced", label: "Un fichaje clave", effect: { morale: 5 } }
      ]
    }
  };

  FMG.generatePlayerCareerDecision = function (state, kind) {
    const pc = ensurePlayerCareer(state);
    const template = DECISION_TEMPLATES[kind] || DECISION_TEMPLATES["transfer-ambition"];
    const decision = {
      id: deterministicId("pcd", [state.seasonNumber || 1, state.currentWeek || 1, kind]),
      kind: kind,
      status: "pending",
      title: template.title,
      detail: template.detail,
      choices: template.choices,
      week: state.currentWeek || 1,
      season: state.seasonNumber || 1
    };
    boundedPush(pc.decisions, decision, 10);
    return decision;
  };

  FMG.resolvePlayerCareerDecision = function (state, decisionId, choiceId) {
    const pc = ensurePlayerCareer(state);
    const decision = pc.decisions.find(function (d) { return d.id === decisionId; });
    if (!decision || decision.status !== "pending") return { ok: false, message: "Decision no disponible." };
    const choice = decision.choices.find(function (c) { return c.id === choiceId; });
    if (!choice) return { ok: false, message: "Eleccion no encontrada." };
    const eff = choice.effect || {};
    if (Number.isFinite(eff.ambition)) pc.psychology.ambition = clamp(pc.psychology.ambition + eff.ambition, 0, 100);
    if (Number.isFinite(eff.morale)) pc.psychology.morale = clamp(pc.psychology.morale + eff.morale, 0, 100);
    if (Number.isFinite(eff.pressure)) pc.psychology.pressure = clamp(pc.psychology.pressure + eff.pressure, 0, 100);
    if (Number.isFinite(eff.reputation)) pc.reputation.local = clamp(pc.reputation.local + eff.reputation, 0, 100);
    if (Number.isFinite(eff.loyalty)) pc.career.loyalty = clamp((pc.career.loyalty || 50) + eff.loyalty, 0, 100);
    if (Number.isFinite(eff.boardTrust) && state.finances) {
      state.finances.boardTrust = clamp((state.finances.boardTrust || 50) + eff.boardTrust, 0, 100);
    }
    if (Number.isFinite(eff.cohesion) && state.psychology && state.psychology.chemistry) {
      state.psychology.chemistry.cohesion = clamp(state.psychology.chemistry.cohesion + eff.cohesion, 0, 100);
    }
    decision.status = "resolved";
    decision.resolvedChoice = choiceId;
    decision.resolvedLabel = choice.label;
    if (FMG.pushCareerLog) FMG.pushCareerLog(state, "Decision de carrera", decision.title + " → " + choice.label);
    return { ok: true, choice: choice, decision: decision };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ENGAGEMENT HOOK REACTIONS (A-3)
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.reactToEngagementHook = function (state, hookId, choiceId) {
    const fu = state.footballUniverse;
    if (!fu) return { ok: false, message: "No disponible." };
    const hook = (fu.engagementHooks || []).find(function (h) { return h.id === hookId; });
    if (!hook || hook.resolved) return { ok: false, message: "Hook no disponible." };
    const pc = ensurePlayerCareer(state);
    const REACTIONS = {
      focus: { confidence: 5, morale: 3, burnout: 4, label: "Concentrarse al maximo" },
      ignore: { confidence: -2, morale: -1, burnout: -3, label: "Ignorar la presion" },
      press: { mediaRep: 6, morale: -3, pressure: 8, label: "Dar declaraciones a la prensa" },
      rest: { burnout: -8, confidence: 2, morale: 4, label: "Priorizar recuperacion" }
    };
    const effect = REACTIONS[choiceId] || REACTIONS.ignore;
    if (Number.isFinite(effect.confidence)) pc.psychology.confidence = clamp(pc.psychology.confidence + effect.confidence, 0, 100);
    if (Number.isFinite(effect.morale)) pc.psychology.morale = clamp(pc.psychology.morale + effect.morale, 0, 100);
    if (Number.isFinite(effect.burnout)) pc.psychology.burnout = clamp(pc.psychology.burnout + effect.burnout, 0, 100);
    if (Number.isFinite(effect.pressure)) pc.psychology.pressure = clamp(pc.psychology.pressure + effect.pressure, 0, 100);
    if (Number.isFinite(effect.mediaRep)) pc.reputation.mediaImage = clamp(pc.reputation.mediaImage + effect.mediaRep, 0, 100);
    hook.resolved = true;
    hook.choiceId = choiceId;
    hook.choiceLabel = effect.label;
    return { ok: true, effect: effect, pc: pc };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SOCIAL RELATIONSHIPS ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  function updateSocialRelationships(state) {
    const pc = ensurePlayerCareer(state);
    const relationships = (state.psychology && state.psychology.relationships) || {};
    Object.keys(relationships).forEach(function (key) {
      const rel = relationships[key];
      if (rel.mentorType) {
        const protegeId = rel.protegeId;
        if (protegeId && !pc.relationships.teammates[protegeId]) {
          pc.relationships.teammates[protegeId] = { trust: 60, chemistry: 55 };
        }
        if (protegeId) {
          const bond = Math.min(100, rel.mentorBondStrength || 40);
          pc.relationships.teammates[protegeId].trust = clamp(55 + bond * 0.35, 0, 100);
          pc.relationships.teammates[protegeId].chemistry = clamp(50 + bond * 0.30, 0, 100);
        }
      }
      if ((rel.rivalry || 0) > 50) {
        const ids = key.split("::");
        ids.forEach(function (id) {
          if (!pc.relationships.rivals.find(function (r) { return r.playerId === id; })) {
            pc.relationships.rivals.push({ playerId: id, intensity: rel.rivalry });
            if (pc.relationships.rivals.length > 6) pc.relationships.rivals.shift();
          }
        });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LIFESTYLE SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  function runLifestyleWeek(state) {
    const pc = ensurePlayerCareer(state);
    const ls = pc.lifestyle;
    const seed = hashText("lifestyle-" + (state.seasonNumber || 1) + "-" + (state.currentWeek || 1));
    if (ls.nightlifeRisk >= 60 && seed % 5 === 0) {
      if (FMG.MediaExtended && FMG.MediaExtended.addScandal) {
        FMG.MediaExtended.addScandal(state, {
          type: "lifestyle",
          severity: 1,
          title: "Rumores de vida nocturna en el cuerpo tecnico",
          description: "La disciplina del grupo esta siendo cuestionada fuera del campo.",
          affectedPartyId: state.userTeamId,
          mechanicalEffect: "-5 board trust"
        });
      }
      ls.nightlifeRisk = clamp(ls.nightlifeRisk - 15, 0, 100);
    }
    if (ls.recoveryQuality >= 70) {
      pc.psychology.burnout = clamp(pc.psychology.burnout - 1, 0, 100);
    }
    const fu = state.footballUniverse;
    if (ls.trainingFocus >= 70 && fu && fu.playerReputation) {
      const star = (state.players || []).filter(function (p) { return p.teamId === state.userTeamId && !p.retired; })
        .reduce(function (best, p) { return (!best || (p.overall || 0) > (best.overall || 0)) ? p : best; }, null);
      if (star && fu.playerReputation[star.id]) {
        fu.playerReputation[star.id].popularity = clamp(fu.playerReputation[star.id].popularity + 0.3, 0, 100);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. MATCH EXPERIENCE HOOK
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.playerCareerMatchHook = function (state, matchData) {
    if (!matchData || !matchData.isUserMatch) return;
    const pc = ensurePlayerCareer(state);
    const userWon = didUserWin(state, matchData.result);
    const scoreDiff = getScoreDiff(state, matchData.result);
    pc.psychology.confidence = clamp(
      pc.psychology.confidence + (userWon ? 4 : -3) + (Math.abs(scoreDiff) >= 3 ? 2 : 0), 0, 100
    );
    pc.career.matches += 1;
    if (matchData.isDerby) {
      pc.psychology.pressure = clamp(pc.psychology.pressure + (userWon ? -5 : 10), 0, 100);
      generateCareerEvent(state, userWon ? "derby-win" : "derby-loss",
        userWon ? "Victoria en el clasico" : "Derrota en el derbi",
        userWon ? "Una victoria que la ciudad recordara." : "El clasico duele mas que ningun resultado.");
    }
    if (matchData.legendaryMoment) {
      boundedPush(pc.legacy.legendaryMoments, {
        type: matchData.legendaryMoment,
        week: state.currentWeek || 1,
        season: state.seasonNumber || 1
      }, 15);
      pc.legacy.legendScore = clamp(pc.legacy.legendScore + 8, 0, 100);
      pc.reputation.league = clamp(pc.reputation.league + 5, 0, 100);
    }
    const cc = state.clubCulture || {};
    const homeAdv = (cc.homeAdvantageModifiers || {})[state.userTeamId] || 0;
    if (homeAdv >= 10 && userWon) {
      pc.psychology.morale = clamp(pc.psychology.morale + 5, 0, 100);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. MEDIA INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  function processMediaForPlayerCareer(state) {
    const pc = ensurePlayerCareer(state);
    const eco = state.managerEcosystem || {};
    const media = eco.media || {};
    const latestConference = (media.pressConferences || [])[0];
    if (latestConference && latestConference.season === (state.seasonNumber || 1) && latestConference.resolved) {
      const combativeAnswers = (latestConference.answers || [])
        .filter(function (a) { return a.tone === "combative"; }).length;
      if (combativeAnswers > 0) {
        pc.reputation.mediaImage = clamp(pc.reputation.mediaImage - combativeAnswers * 4, 0, 100);
        pc.psychology.pressure = clamp(pc.psychology.pressure + combativeAnswers * 3, 0, 100);
      }
    }
    const activeScandals = (state.scandals || []).filter(function (s) {
      return !s.resolved && s.seasonNumber === (state.seasonNumber || 1);
    });
    if (activeScandals.length > 2) {
      pc.reputation.mediaImage = clamp(pc.reputation.mediaImage - 5, 0, 100);
      generateCareerEvent(state, "media-crisis",
        "Crisis mediatica",
        "La acumulacion de escandalos empaña la imagen publica del proyecto.");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. AUTOMATIC CAREER EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  function generateAutomaticCareerEvents(state) {
    const pc = ensurePlayerCareer(state);
    const week = state.currentWeek || 1;
    const seed = hashText("auto-event-" + (state.seasonNumber || 1) + "-" + week);
    if (pc.psychology.burnout >= 75 && seed % 2 === 0) {
      generateCareerEvent(state, "injury-risk",
        "El agotamiento aumenta el riesgo de lesiones",
        "El nivel de desgaste es preocupante. Un descanso podria evitar problemas mayores.");
    }
    if (pc.reputation.fanPop >= 80 && seed % 7 === 0) {
      generateCareerEvent(state, "fan-love",
        "La aficion idolatra al cuerpo tecnico",
        "La conexion con la hinchada esta en su punto mas alto. El estadio vibra contigo.");
    }
    const lossStreak = recentLossStreak(state);
    if (lossStreak >= 4 && seed % 3 === 0) {
      generateCareerEvent(state, "fan-hate",
        "La aficion pierde la paciencia",
        "Cuatro derrotas seguidas. La tribuna empieza a cuestionar el rumbo del equipo.");
    }
    if (pc.psychology.ambition >= 75 && week >= 12 && seed % 5 === 0) {
      generateCareerEvent(state, "transfer-rumor",
        "Rumores de cambio de club",
        "Tu nombre empieza a circular en conversaciones de otros clubes. ¿Es momento de escuchar?");
      if (pc.decisions.filter(function (d) { return d.kind === "transfer-ambition" && d.status === "pending"; }).length === 0) {
        FMG.generatePlayerCareerDecision(state, "transfer-ambition");
      }
    }
  }

  function generateWeeklyDecisionIfNeeded(state) {
    const pc = ensurePlayerCareer(state);
    const pending = pc.decisions.filter(function (d) { return d.status === "pending"; });
    if (pending.length > 0) return;
    const week = state.currentWeek || 1;
    const total = state.totalWeeks || 30;
    const seed = hashText("weekly-decision-" + (state.seasonNumber || 1) + "-" + week);
    if (week >= Math.floor(total * 0.4) && seed % 6 === 0) {
      const kinds = ["salary-demand", "playtime-demand", "trophy-ambition"];
      FMG.generatePlayerCareerDecision(state, kinds[seed % kinds.length]);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. LEGACY & RETIREMENT
  // ═══════════════════════════════════════════════════════════════════════════

  function buildRetirementNarrative(state, pc, status) {
    const name = (state.managerProfile && state.managerProfile.name) || "El entrenador";
    const trophies = pc.career.trophies.length;
    const seasons = pc.career.yearsActive || (state.seasonNumber || 1);
    let narrative = name + " se retira del futbol chileno ";
    if (status === "Leyenda inmortal del futbol chileno") {
      narrative += "como una figura que ha trascendido el tiempo. " + trophies + " titulos, incontables momentos epicos y una generacion de jugadores que lo recuerda como el mejor.";
    } else if (status === "Referente historico") {
      narrative += "dejando una huella profunda. " + trophies + " campeonatos y " + seasons + " temporadas de futbol con identidad propia.";
    } else if (status === "Figura recordada") {
      narrative += "con el respeto de la gente y varios momentos que quedaron en la memoria colectiva del futbol chileno.";
    } else {
      narrative += "tras " + seasons + " temporadas. El futbol sigue, pero su paso no paso inadvertido.";
    }
    return narrative;
  }

  FMG.generateRetirementSummary = function (state) {
    const pc = ensurePlayerCareer(state);
    const hallOfFame = pc.career.trophies.length >= 3 || pc.legacy.legendScore >= 75;
    const records = [];
    if (pc.career.matches >= 200) records.push("Mas de 200 partidos dirigidos");
    if (pc.career.trophies.length >= 5) records.push("Pentacampeon");
    if (pc.legacy.legendScore >= 80) records.push("Maximo legado de su generacion");
    let status = "Entrenador olvidado";
    if (pc.legacy.legendScore >= 90) status = "Leyenda inmortal del futbol chileno";
    else if (pc.legacy.legendScore >= 70) status = "Referente historico";
    else if (pc.legacy.legendScore >= 50) status = "Figura recordada";
    else if (pc.legacy.legendScore >= 30) status = "Profesional respetado";
    const summary = {
      status: status,
      hallOfFame: hallOfFame,
      trophiesTotal: pc.career.trophies.length,
      legendScore: pc.legacy.legendScore,
      records: records,
      legendaryMoments: pc.legacy.legendaryMoments,
      clubs: pc.career.clubs,
      yearsActive: pc.career.yearsActive,
      finalReputation: pc.reputation,
      narrative: buildRetirementNarrative(state, pc, status)
    };
    pc.legacy.retirementSummary = summary;
    pc.legacy.hallOfFame = hallOfFame;
    if (hallOfFame && state.legacy) {
      state.legacy.managerLegacy = state.legacy.managerLegacy || {};
      state.legacy.managerLegacy.retiredHallOfFame = true;
    }
    return summary;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY RUNNER
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.runPlayerCareerWeek = function (state) {
    if (!state.userTeamId) return;
    ensurePlayerCareer(state);
    updatePlayerCareerReputation(state);
    updatePlayerCareerPsychology(state);
    runLifestyleWeek(state);
    updateSocialRelationships(state);
    processMediaForPlayerCareer(state);
    generateAutomaticCareerEvents(state);
    generateWeeklyDecisionIfNeeded(state);
    // Update career stats from career.js trophies
    const pc = state.playerCareer;
    const career = state.career;
    if (career && career.trophies) {
      pc.career.trophies = career.trophies.map(function (t) {
        return { type: t.type, clubName: t.teamName, season: t.seasonNumber };
      });
    }
    // Cleanup jealousy accum at new season start
    const fu = state.footballUniverse;
    if (fu && fu.jealousyAccum && (state.currentWeek || 1) === 1) {
      fu.jealousyAccum = {};
    }
    // Clean resolved engagement hooks older than 4 weeks
    if (fu && fu.engagementHooks) {
      const week = state.currentWeek || 1;
      fu.engagementHooks = fu.engagementHooks.filter(function (h) {
        return !h.resolved || (week - h.week) < 4;
      });
    }
    pc.career.yearsActive = state.seasonNumber || 1;
  };

  // HOOK into generatePostMatchNews for match experience
  const _prevPostMatchPC = FMG.generatePostMatchNews;
  FMG.generatePostMatchNews = function (state, result) {
    const items = _prevPostMatchPC ? _prevPostMatchPC(state, result) : [];
    if (result && state.userTeamId &&
      (result.homeTeamId === state.userTeamId || result.awayTeamId === state.userTeamId)) {
      const isDerby = FMG.getRivalry ? Boolean(FMG.getRivalry(result.homeTeamId, result.awayTeamId)) : false;
      const legendaryMoment = result.narrativeArc && result.narrativeArc !== "standard"
        ? result.narrativeArc : null;
      FMG.playerCareerMatchHook(state, {
        result: result,
        isUserMatch: true,
        isDerby: isDerby,
        legendaryMoment: legendaryMoment
      });
    }
    return items;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  FMG.PlayerCareer = {
    ensure: ensurePlayerCareer,
    get: function (state) { return state.playerCareer || null; },
    getReputation: function (state) { const pc = state.playerCareer; return pc ? pc.reputation : null; },
    getPsychology: function (state) { const pc = state.playerCareer; return pc ? pc.psychology : null; },
    getDecisions: function (state) {
      const pc = state.playerCareer;
      return pc ? pc.decisions.filter(function (d) { return d.status === "pending"; }) : [];
    },
    getLegacy: function (state) { const pc = state.playerCareer; return pc ? pc.legacy : null; }
  };

  FMG.ensurePlayerCareer = ensurePlayerCareer;
})();
