(function () {
  const FMG = (window.FMG = window.FMG || {});

  const ARCHETYPES = {
    striker: { label: "Delantero killer", position: "DEL", pace: 76, shooting: 78, passing: 58, dribbling: 72, defending: 34, physical: 70 },
    winger: { label: "Extremo desequilibrante", position: "EXT", pace: 84, shooting: 68, passing: 66, dribbling: 80, defending: 38, physical: 62 },
    midfielder: { label: "Mediocampista creativo", position: "MED", pace: 68, shooting: 62, passing: 80, dribbling: 74, defending: 58, physical: 66 },
    defender: { label: "Defensa lider", position: "DEF", pace: 64, shooting: 42, passing: 62, dribbling: 52, defending: 80, physical: 78 },
    goalkeeper: { label: "Arquero promesa", position: "POR", pace: 46, shooting: 20, passing: 58, dribbling: 42, defending: 82, physical: 76 }
  };

  function ensurePlayerMode(state) {
    state.playerMode = state.playerMode || {
      active: false,
      created: false,
      player: null,
      clubId: null,
      seasonNumber: 1,
      week: 1,
      maxWeeks: 30,
      status: "academy",
      objectives: [],
      matches: [],
      decisions: [],
      messages: [],
      offers: [],
      xp: 0,
      skillPoints: 0,
      trainingPlan: "balanced",
      careerStats: { appearances: 0, starts: 0, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0, trophies: 0 },
      personality: { managerTrust: 48, fanLove: 35, agentHeat: 28, discipline: 62, form: 50 }
    };
    state.playerMode.messages = state.playerMode.messages || [];
    state.playerMode.decisions = state.playerMode.decisions || [];
    state.playerMode.matches = state.playerMode.matches || [];
    state.playerMode.offers = state.playerMode.offers || [];
    state.playerMode.objectives = state.playerMode.objectives || [];
    state.playerMode.personality = state.playerMode.personality || { managerTrust: 48, fanLove: 35, agentHeat: 28, discipline: 62, form: 50 };
    return state.playerMode;
  }

  function overall(attrs) {
    return Math.round((attrs.pace + attrs.shooting + attrs.passing + attrs.dribbling + attrs.defending + attrs.physical) / 6);
  }

  function addMessage(pm, from, title, body, tone) {
    const item = {
      id: FMG.uid ? FMG.uid("pm-msg") : FMG.deterministicId("pm-msg", [pm.seasonNumber, pm.week, from, title]),
      from,
      title,
      body,
      tone: tone || "neutral",
      week: pm.week,
      seasonNumber: pm.seasonNumber
    };
    pm.messages.unshift(item);
    pm.messages = pm.messages.slice(0, 18);
    return item;
  }

  function createDecision(pm, kind) {
    if (pm.decisions.some((decision) => decision.status === "pending" && decision.kind === kind)) return null;
    const templates = {
      manager: {
        title: "El DT te llama a la oficina",
        detail: "Te ve listo para sumar minutos, pero quiere saber si aceptas jugar fuera de tu posicion.",
        choices: [
          { id: "accept", label: "Aceptar donde sea", effects: { managerTrust: 8, discipline: 4, form: -2 }, consequence: "El DT valora tu disposicion y te mete en la convocatoria." },
          { id: "refuse", label: "Pedir tu puesto natural", effects: { managerTrust: -6, fanLove: 3, discipline: -3 }, consequence: "El DT responde frio: tendras que ganarte el puesto entrenando." }
        ]
      },
      agent: {
        title: "Tu agente trae un rumor",
        detail: "Un club mas grande pregunta por ti, pero filtrar interes puede molestar al vestuario.",
        choices: [
          { id: "listen", label: "Escuchar ofertas", effects: { agentHeat: 12, managerTrust: -5, fanLove: -2 }, consequence: "La prensa instala tu nombre y el club te mira con recelo." },
          { id: "loyal", label: "Declararte comprometido", effects: { fanLove: 8, managerTrust: 5, agentHeat: -4 }, consequence: "Los hinchas celebran el gesto y el DT te felicita delante del grupo." }
        ]
      },
      training: {
        title: "Sesion extra o descanso",
        detail: "El preparador fisico te ofrece quedarte despues del entrenamiento.",
        choices: [
          { id: "extra", label: "Quedarte a rematar", effects: { form: 8, discipline: 4, fatigue: 6 }, consequence: "Sube tu forma, pero llegas mas cargado al partido." },
          { id: "recover", label: "Priorizar recuperacion", effects: { form: 2, discipline: 1, fatigue: -8 }, consequence: "El cuerpo responde mejor y reduces riesgo de lesion." }
        ]
      }
    };
    const source = templates[kind] || templates.manager;
    const decision = {
      id: FMG.uid ? FMG.uid("pm-decision") : FMG.deterministicId("pm-decision", [pm.seasonNumber, pm.week, kind]),
      kind,
      status: "pending",
      title: source.title,
      detail: source.detail,
      choices: source.choices,
      week: pm.week,
      seasonNumber: pm.seasonNumber
    };
    pm.decisions.unshift(decision);
    pm.decisions = pm.decisions.slice(0, 10);
    return decision;
  }

  function createObjectives(pm) {
    pm.objectives = [
      { id: "debut", title: "Ganar la titularidad", target: 6, value: 0, unit: "confianza DT" },
      { id: "impact", title: "Participar en goles", target: pm.player.position === "POR" ? 6 : 10, value: 0, unit: pm.player.position === "POR" ? "porterias/atajadas clave" : "goles + asistencias" },
      { id: "rating", title: "Media de calificacion", target: 7.1, value: 0, unit: "rating" }
    ];
  }

  FMG.createPlayerModeCareer = function (state, options) {
    const pm = ensurePlayerMode(state);
    const archetype = ARCHETYPES[options?.archetype] || ARCHETYPES.striker;
    const team = (state.teams || []).find((item) => item.id === options?.clubId) || state.userClub || (state.teams || [])[0];
    const attrs = {
      pace: archetype.pace,
      shooting: archetype.shooting,
      passing: archetype.passing,
      dribbling: archetype.dribbling,
      defending: archetype.defending,
      physical: archetype.physical
    };
    pm.active = true;
    pm.created = true;
    pm.clubId = team?.id || null;
    pm.week = 1;
    pm.seasonNumber = 1;
    pm.status = "prospect";
    pm.xp = 0;
    pm.skillPoints = 1;
    pm.trainingPlan = "balanced";
    pm.careerStats = { appearances: 0, starts: 0, goals: 0, assists: 0, cleanSheets: 0, avgRating: 0, trophies: 0 };
    pm.personality = { managerTrust: 48, fanLove: 35, agentHeat: 28, discipline: 62, form: 52, fatigue: 18 };
    pm.matches = [];
    pm.decisions = [];
    pm.messages = [];
    pm.offers = [];
    pm.player = {
      id: FMG.uid ? FMG.uid("created-player") : "created-player",
      name: options?.name || "Diego Promesa",
      age: Number(options?.age) || 17,
      nationality: options?.nationality || "Chile",
      position: archetype.position,
      archetype: options?.archetype || "striker",
      archetypeLabel: archetype.label,
      attributes: attrs,
      overall: overall(attrs),
      potential: FMG.clamp(overall(attrs) + 18, 70, 94)
    };
    createObjectives(pm);
    addMessage(pm, "Agente", "Nace tu carrera profesional", `${pm.player.name} firma como ${archetype.label} en ${team?.name || "un club chileno"}. Tu objetivo inmediato es convencer al DT.`, "success");
    if (FMG.pushNotification) FMG.pushNotification("Modo Carrera Jugador creado.", "success");
    return { ok: true, message: "Carrera de jugador creada.", playerMode: pm };
  };

  FMG.trainPlayerMode = function (state, plan) {
    const pm = ensurePlayerMode(state);
    if (!pm.created) return { ok: false, message: "Primero crea tu jugador." };
    const player = pm.player;
    const attrs = player.attributes;
    const plans = {
      finishing: ["shooting", "dribbling"],
      playmaking: ["passing", "dribbling"],
      athletic: ["pace", "physical"],
      defensive: ["defending", "physical"],
      balanced: ["pace", "shooting", "passing", "dribbling", "defending", "physical"]
    };
    const keys = plans[plan] || plans.balanced;
    keys.forEach((key) => {
      attrs[key] = FMG.clamp(attrs[key] + (keys.length > 2 ? 1 : 2), 20, player.potential);
    });
    pm.trainingPlan = plan || "balanced";
    pm.xp += 12;
    pm.personality.fatigue = FMG.clamp((pm.personality.fatigue || 0) + (plan === "balanced" ? 3 : 6), 0, 100);
    pm.personality.form = FMG.clamp(pm.personality.form + 3, 0, 100);
    player.overall = overall(attrs);
    FMG.recordPlayerTrainingChallenge?.(state);
    addMessage(pm, "Preparador fisico", "Entrenamiento completado", `Plan ${plan || "balanced"} aplicado. OVR actual ${player.overall}.`, "neutral");
    return { ok: true, message: "Entrenamiento completado." };
  };

  FMG.resolvePlayerModeDecision = function (state, decisionId, choiceId) {
    const pm = ensurePlayerMode(state);
    const decision = pm.decisions.find((item) => item.id === decisionId);
    if (!decision || decision.status !== "pending") return { ok: false, message: "Decision no disponible." };
    const choice = decision.choices.find((item) => item.id === choiceId) || decision.choices[0];
    Object.entries(choice.effects || {}).forEach(([key, delta]) => {
      pm.personality[key] = FMG.clamp((pm.personality[key] || 0) + delta, 0, 100);
    });
    decision.status = "resolved";
    decision.result = choice.label;
    addMessage(pm, "Consecuencia", decision.title, choice.consequence, choice.effects?.managerTrust < 0 ? "danger" : "success");
    if (FMG.recordVisibleConsequence) {
      FMG.recordVisibleConsequence(state, {
        actor: pm.player.name,
        title: choice.label,
        detail: choice.consequence,
        tone: choice.effects?.managerTrust < 0 ? "danger" : "neutral"
      });
    }
    return { ok: true, message: choice.consequence, decision };
  };

  FMG.advancePlayerModeWeek = function (state) {
    const pm = ensurePlayerMode(state);
    if (!pm.created) return { ok: false, message: "Primero crea tu jugador." };
    const player = pm.player;
    const team = (state.teams || []).find((item) => item.id === pm.clubId) || state.userClub || (state.teams || [])[0];
    const seed = FMG.hashText(`${player.name}|${pm.seasonNumber}|${pm.week}|${pm.personality.form}|${player.overall}`);
    const trust = pm.personality.managerTrust || 50;
    const starts = trust + player.overall + (pm.personality.form || 50) > 128;
    const minutes = starts ? 72 + (seed % 19) : trust > 46 ? 18 + (seed % 28) : 0;
    const attackingScore = player.position === "POR" ? player.attributes.defending : (player.attributes.shooting + player.attributes.dribbling + player.attributes.passing) / 3;
    const impactRoll = (seed % 100) + attackingScore + (pm.personality.form || 50) * 0.4 - (pm.personality.fatigue || 0) * 0.25;
    const goals = player.position === "POR" || minutes < 20 ? 0 : impactRoll > 142 ? 2 : impactRoll > 118 ? 1 : 0;
    const assists = player.position === "POR" || minutes < 18 ? 0 : (impactRoll > 105 && seed % 3 === 0 ? 1 : 0);
    const cleanSheet = player.position === "POR" && minutes > 0 && impactRoll > 112;
    const rating = minutes === 0
      ? 6.0
      : FMG.clamp(6 + goals * 0.85 + assists * 0.45 + (cleanSheet ? 0.7 : 0) + ((seed % 16) - 6) / 10, 4.8, 9.8);
    const match = {
      id: FMG.uid ? FMG.uid("pm-match") : `pm-match-${pm.week}`,
      week: pm.week,
      seasonNumber: pm.seasonNumber,
      clubName: team?.name || "Club",
      opponentName: `Rival fecha ${pm.week}`,
      starts,
      minutes,
      goals,
      assists,
      cleanSheet,
      rating: Number(rating.toFixed(1)),
      headline: minutes === 0
        ? "El DT te deja mirando desde la banca"
        : goals
        ? `${player.name} firma una noche para recordar`
        : rating >= 7.4
        ? "Actuacion convincente"
        : "Partido de aprendizaje"
    };
    pm.matches.unshift(match);
    pm.matches = pm.matches.slice(0, 24);
    if (minutes > 0) {
      pm.careerStats.appearances += 1;
      if (starts) pm.careerStats.starts = (pm.careerStats.starts || 0) + 1;
      pm.careerStats.goals += goals;
      pm.careerStats.assists += assists;
      if (cleanSheet) pm.careerStats.cleanSheets += 1;
      pm.careerStats.avgRating = Number((((pm.careerStats.avgRating || 0) * (pm.careerStats.appearances - 1) + match.rating) / pm.careerStats.appearances).toFixed(2));
      pm.xp += Math.round(match.rating * 7) + goals * 14 + assists * 8;
    }
    FMG.updatePlayerChallengeProgress?.(state, match);
    pm.personality.managerTrust = FMG.clamp(pm.personality.managerTrust + (minutes > 0 ? Math.round(match.rating - 6) : -2), 0, 100);
    pm.personality.fanLove = FMG.clamp(pm.personality.fanLove + goals * 6 + assists * 3 + (match.rating >= 8 ? 4 : 0), 0, 100);
    pm.personality.form = FMG.clamp(pm.personality.form + Math.round((match.rating - 6.4) * 4), 0, 100);
    pm.personality.fatigue = FMG.clamp((pm.personality.fatigue || 0) + Math.round(minutes / 18) - 4, 0, 100);
    pm.objectives.forEach((objective) => {
      if (objective.id === "debut") objective.value = Math.max(objective.value, Math.round(pm.personality.managerTrust / 10));
      if (objective.id === "impact") objective.value = player.position === "POR" ? pm.careerStats.cleanSheets : pm.careerStats.goals + pm.careerStats.assists;
      if (objective.id === "rating") objective.value = pm.careerStats.avgRating || 0;
    });
    if (minutes === 0) addMessage(pm, "DT", "No entraste esta fecha", "El entrenador te pide paciencia, pero el representante ya pregunta que esta pasando.", "danger");
    else addMessage(pm, "DT", match.headline, `Minutos ${minutes}, rating ${match.rating}, goles ${goals}, asistencias ${assists}.`, goals ? "success" : "neutral");
    if (pm.week % 4 === 0) createDecision(pm, ["manager", "agent", "training"][(seed % 3)]);
    if (pm.personality.fanLove >= 70 && pm.offers.length < 3) {
      pm.offers.unshift({ id: FMG.uid("pm-offer"), clubName: `Deportivo Estrella ${pm.seasonNumber}`, role: "Rotacion importante", status: "pending", week: pm.week });
      addMessage(pm, "Agente", "Hay un club siguiendo tus partidos", "Tu buen momento abre una puerta de mercado. La decision puede esperar, pero ya existe.", "success");
    }
    pm.week += 1;
    if (pm.week > pm.maxWeeks) {
      pm.seasonNumber += 1;
      pm.week = 1;
      pm.personality.fatigue = 10;
      pm.skillPoints += 2;
      addMessage(pm, "Agente", "Nueva temporada", "Arranca otro ano: mas presion, mas mercado y mas margen para crecer.", "success");
    }
    return { ok: true, message: match.headline, match };
  };

  FMG.ensurePlayerMode = ensurePlayerMode;
  FMG.PlayerMode = { ensure: ensurePlayerMode, archetypes: ARCHETYPES };
})();
