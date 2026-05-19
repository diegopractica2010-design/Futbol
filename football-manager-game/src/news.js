(function () {
  const FMG = (window.FMG = window.FMG || {});

  const rivalryPairs = [
    { teams: ["colo-colo", "u-de-chile"], name: "Superclasico", intensity: 95 },
    { teams: ["colo-colo", "u-catolica"], name: "Clasico de candidatos", intensity: 82 },
    { teams: ["u-de-chile", "u-catolica"], name: "Clasico universitario", intensity: 90 },
    { teams: ["cobreloa", "colo-colo"], name: "Rivalidad minera-capitalina", intensity: 78 },
    { teams: ["wanderers", "palestino"], name: "Cruce de barrios historicos", intensity: 62 }
  ];

  const weeklyEventMakers = [
    function (state) {
      const leader = FMG.sortStandings(state.standings)[0];
      if (!leader || leader.played < 2) return null;
      return {
        type: "league",
        title: `${leader.name} marca el pulso del torneo`,
        body: `${leader.name} llega a la semana ${state.currentWeek} con ${leader.points} puntos y diferencia de gol ${leader.goalDifference}. El resto de la liga ya mira esa regularidad como referencia.`
      };
    },
    function (state) {
      const unsettled = state.players
        .filter((player) => player.teamId === state.userTeamId && !player.retired)
        .sort((left, right) => (left.happiness || 50) - (right.happiness || 50))[0];
      if (!unsettled || unsettled.happiness > 48) return null;
      return {
        type: "dressing-room",
        title: `${unsettled.name} abre un foco interno en ${state.userClub.name}`,
        body: `${unsettled.name}, con felicidad ${unsettled.happiness}/100 y rol ${FMG.SQUAD_ROLES[unsettled.squadRole]?.label || "plantel"}, espera mas claridad del cuerpo tecnico.`
      };
    },
    function (state) {
      const ffp = state.finances?.financialFairPlay;
      if (!ffp || ffp.status === "ok") return null;
      return {
        type: "finance",
        title: `Fair play pone presion sobre ${state.userClub.name}`,
        body: `${state.userClub.name} aparece con estado financiero ${ffp.status}; el directorio conserva ${state.finances.boardTrust}/100 de confianza y pide controlar el gasto semanal.`
      };
    },
    function (state) {
      const top = state.competitions?.rankings?.scorers?.[0];
      if (!top || top.value < 3) return null;
      return {
        type: "player-story",
        title: `${top.name} se instala como nombre propio del campeonato`,
        body: `${top.name}, de ${top.teamName}, suma ${top.value} goles y ya condiciona las previas de sus rivales.`
      };
    }
  ];

  function team(state, teamId) {
    return state.teams.find((item) => item.id === teamId) || null;
  }

  function standing(state, teamId) {
    const position = state.standings.findIndex((entry) => entry.teamId === teamId) + 1;
    const entry = state.standings.find((item) => item.teamId === teamId) || null;
    return { position, entry };
  }

  function squad(state, teamId) {
    return state.players.filter((player) => player.teamId === teamId && !player.retired);
  }

  function topPlayer(state, teamId, sorter) {
    return [...squad(state, teamId)].sort(sorter)[0] || null;
  }

  function resultGoals(result, teamId) {
    const isHome = result.homeTeamId === teamId;
    return {
      scored: isHome ? result.homeGoals : result.awayGoals,
      conceded: isHome ? result.awayGoals : result.homeGoals
    };
  }

  function rivalryFor(homeTeamId, awayTeamId) {
    return rivalryPairs.find((rivalry) => rivalry.teams.includes(homeTeamId) && rivalry.teams.includes(awayTeamId)) || null;
  }

  function stableId(prefix, value) {
    const text = String(value || prefix);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
  }

  function titleHash(value) {
    const text = String(value || "");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 33 + text.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function headlineContext(state, item) {
    const teamId = item.entities?.teamId || item.entities?.homeTeamId || item.entities?.awayTeamId || state.userTeamId;
    const club = team(state, teamId) || state.userClub || { name: "El club", city: "la ciudad" };
    const player = item.entities?.playerId ? state.players.find((entry) => entry.id === item.entities.playerId) : null;
    return {
      club: club.name || "El club",
      city: club.city || "la ciudad",
      player: player?.name || "el protagonista",
      title: item.title
    };
  }

  /* eslint-disable no-unused-vars */
  const headlineTemplates = {
    preview: [
      (ctx) => `¿Que partido se viene para ${ctx.club}?`,
      (ctx) => `${ctx.city} ya palpita la previa`,
      (ctx) => `La semana pone a prueba a ${ctx.club}`,
      (ctx) => `${ctx.club} mira el proximo duelo con tension`
    ],
    chronicle: [
      (ctx) => `${ctx.club} firma una noche para comentar`,
      (ctx) => `La fecha deja lectura fuerte para ${ctx.club}`,
      (ctx) => `¿Cambio de animo tras el pitazo final?`,
      (ctx) => `El resultado mueve el clima en ${ctx.city}`
    ],
    rumor: [
      (ctx) => `${ctx.player} vuelve a sonar en el mercado`,
      (ctx) => `La carpeta de ${ctx.player} empieza a circular`,
      (ctx) => `¿Movimiento en puerta por ${ctx.player}?`,
      (ctx) => `El mercado mira de reojo a ${ctx.player}`
    ],
    fans: [
      (ctx) => `La hinchada de ${ctx.club} marca el pulso`,
      (ctx) => `${ctx.city} habla del momento del equipo`,
      (ctx) => `El animo popular se mueve en ${ctx.club}`,
      (ctx) => `¿Se enciende la tribuna de ${ctx.club}?`
    ],
    "player-story": [
      (ctx) => `${ctx.player} pide lugar en la conversacion`,
      (ctx) => `La semana de ${ctx.player} no pasa inadvertida`,
      (ctx) => `¿Hasta donde puede llegar ${ctx.player}?`,
      (ctx) => `${ctx.player} empieza a cambiar el relato`
    ],
    classic: [
      (ctx) => `El clasico deja ruido hasta el lunes`,
      (ctx) => `Una rivalidad que vuelve a pesar`,
      (ctx) => `El barrio futbolero no suelta el resultado`,
      (ctx) => `¿Otro capitulo caliente para la memoria?`
    ],
    "dressing-room": [
      (ctx) => `El camarin de ${ctx.club} queda bajo observacion`,
      (ctx) => `Puertas adentro se mueve el ambiente`,
      (ctx) => `¿Hay ruido interno en ${ctx.club}?`,
      (ctx) => `El vestuario exige manejo fino esta semana`
    ],
    "world-reaction": [
      (ctx) => `${ctx.club} vuelve al centro de la discusion`,
      (ctx) => `La prensa cambia el tono con ${ctx.club}`,
      (ctx) => `¿Proyecto firme o semana de dudas?`,
      (ctx) => `El entorno futbolero mira hacia ${ctx.city}`
    ],
    general: [
      (ctx) => `${ctx.club} suma un nuevo capitulo`,
      (ctx) => `La semana deja una senal en ${ctx.city}`,
      (ctx) => `¿Que lectura queda para el cuerpo tecnico?`,
      (ctx) => `El torneo vuelve a mover el tablero emocional`
    ]
  };

  /* eslint-enable no-unused-vars */

  function headlinePattern(title) {
    const text = String(title || "").toLowerCase();
    if (text.includes("?")) return "question";
    if (text.includes("!")) return "exclaim";
    if (text.includes(":")) return "colon";
    return text.split(/\s+/).slice(0, 3).join(" ");
  }

  function headlineSimilarity(left, right) {
    const a = String(left || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    const b = String(right || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    if (!a.length || !b.length) return 0;
    const shared = a.filter((word) => b.includes(word)).length / Math.max(a.length, b.length);
    const sameSubject = a[0] && a[0] === b[0] ? 0.28 : 0;
    const samePattern = headlinePattern(left) === headlinePattern(right) ? 0.24 : 0;
    return shared + sameSubject + samePattern;
  }

  function chooseHeadline(state, item) {
    const recent = (state.worldNews?.items || []).slice(0, 3).map((news) => news.title);
    const ctx = headlineContext(state, item);
    const templates = headlineTemplates[item.type] || headlineTemplates.general;
    const candidates = [item.title, ...templates.map((template) => template(ctx))]
      .filter(Boolean)
      .filter((title, index, list) => list.indexOf(title) === index);
    if (candidates.length <= 1) return item.title;
    if (!recent.some((oldTitle) => headlineSimilarity(item.title, oldTitle) >= 0.62)) return item.title;
    const seed = titleHash(`${state.seasonNumber}-${state.currentWeek}-${item.type}-${item.dedupeKey || item.title}`);
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const title = candidates[(seed + offset) % candidates.length];
      const tooSimilar = recent.some((oldTitle) => headlineSimilarity(title, oldTitle) >= 0.62);
      if (!tooSimilar) return title;
    }
    return candidates[seed % candidates.length];
  }

  function addNews(state, item) {
    FMG.ensureWorldNews(state);
    if (!item || !item.title || !item.body) return null;
    if (item.dedupeKey && state.worldNews.items.some((news) => news.dedupeKey === item.dedupeKey)) return null;
    item.title = chooseHeadline(state, item);
    const news = {
      id: item.id || (item.dedupeKey ? stableId("news", item.dedupeKey) : FMG.uid("news")),
      week: state.currentWeek,
      seasonNumber: state.seasonNumber,
      type: item.type || "general",
      title: item.title,
      body: item.body,
      tags: item.tags || [],
      importance: item.importance || 50,
      entities: item.entities || {},
      dedupeKey: item.dedupeKey || null,
      createdAt: item.createdAt || `S${state.seasonNumber}-W${state.currentWeek}`
    };
    state.worldNews.items.unshift(news);
    state.worldNews.items = state.worldNews.items.slice(0, 80);
    return news;
  }

  function addPressQuestion(state, question, context) {
    FMG.ensureWorldNews(state);
    const dedupeKey = `press-${state.seasonNumber}-${state.currentWeek}-${context}-${question}`;
    if (state.worldNews.pressQuestions.some((entry) => entry.dedupeKey === dedupeKey)) return null;
    const entry = {
      id: stableId("press", dedupeKey),
      week: state.currentWeek,
      seasonNumber: state.seasonNumber,
      question,
      context,
      status: "open",
      dedupeKey
    };
    state.worldNews.pressQuestions.unshift(entry);
    state.worldNews.pressQuestions = state.worldNews.pressQuestions.slice(0, 12);
    return entry;
  }

  function updateStreakForTeam(state, result, teamId) {
    FMG.ensureWorldNews(state);
    const goals = resultGoals(result, teamId);
    const current = state.worldNews.streaks[teamId] || { unbeaten: 0, winless: 0, wins: 0, losses: 0 };
    if (goals.scored > goals.conceded) {
      current.unbeaten += 1;
      current.wins += 1;
      current.winless = 0;
      current.losses = 0;
    } else if (goals.scored === goals.conceded) {
      current.unbeaten += 1;
      current.winless += 1;
      current.wins = 0;
      current.losses = 0;
    } else {
      current.winless += 1;
      current.losses += 1;
      current.unbeaten = 0;
      current.wins = 0;
    }
    state.worldNews.streaks[teamId] = current;
    const club = team(state, teamId);
    if (!club) return;
    if (current.wins >= 3) {
      addNews(state, {
        type: "streak",
        title: `${club.name} encadena ${current.wins} victorias`,
        body: `${club.name} viene de ganar ${goals.scored}-${goals.conceded} y ya suma ${current.wins} triunfos consecutivos en la liga.`,
        importance: 72,
        entities: { teamId },
        dedupeKey: `wins-${teamId}-${state.seasonNumber}-${current.wins}`
      });
    }
    if (current.winless >= 3) {
      addNews(state, {
        type: "streak",
        title: `${club.name} entra en una racha incomoda`,
        body: `${club.name} acumula ${current.winless} partidos sin ganar; el ultimo marcador fue ${goals.scored}-${goals.conceded}.`,
        importance: 70,
        entities: { teamId },
        dedupeKey: `winless-${teamId}-${state.seasonNumber}-${current.winless}`
      });
    }
  }

  FMG.ensureWorldNews = function (state) {
    state.worldNews = state.worldNews || {};
    state.worldNews.items = state.worldNews.items || [];
    state.worldNews.rivalries = state.worldNews.rivalries && state.worldNews.rivalries.length ? state.worldNews.rivalries : rivalryPairs.map((rivalry) => ({ ...rivalry }));
    state.worldNews.streaks = state.worldNews.streaks || {};
    state.worldNews.pressQuestions = state.worldNews.pressQuestions || [];
    state.worldNews.weeklyEvents = state.worldNews.weeklyEvents || [];
    state.worldNews.filter = state.worldNews.filter || "all";
    return state.worldNews;
  };

  FMG.addNewsItem = addNews;
  FMG.getRivalry = rivalryFor;

  FMG.generateMatchPreviewNews = function (state, match) {
    FMG.ensureWorldNews(state);
    const home = team(state, match.homeTeamId);
    const away = team(state, match.awayTeamId);
    if (!home || !away) return null;
    const homeStanding = standing(state, home.id);
    const awayStanding = standing(state, away.id);
    const homeFigure = topPlayer(state, home.id, (left, right) => right.overall - left.overall);
    const awayFigure = topPlayer(state, away.id, (left, right) => right.overall - left.overall);
    const rivalry = rivalryFor(home.id, away.id);
    const title = rivalry
      ? `${rivalry.name}: ${home.name} y ${away.name} llegan con tension real`
      : `Previa: ${home.name} recibe a ${away.name} en la semana ${match.week || state.currentWeek}`;
    const body = `${home.name} marcha ${homeStanding.position || "-"} con ${homeStanding.entry?.points || 0} pts y ${away.name} aparece ${awayStanding.position || "-"} con ${awayStanding.entry?.points || 0}. ${homeFigure ? `${homeFigure.name} lidera al local con OVR ${homeFigure.overall}` : "El local no tiene figura clara"}; ${awayFigure ? `${awayFigure.name} es la carta visitante con OVR ${awayFigure.overall}` : "la visita llega sin una figura definida"}.`;
    const news = addNews(state, {
      type: "preview",
      title,
      body,
      tags: rivalry ? ["clasico", "previa"] : ["previa"],
      importance: rivalry ? 88 : 62,
      entities: { homeTeamId: home.id, awayTeamId: away.id },
      dedupeKey: `preview-${state.seasonNumber}-${match.week || state.currentWeek}-${home.id}-${away.id}`
    });
    if (match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId) {
      addPressQuestion(state, `¿Que ajuste prepara ${state.managerProfile.name} para enfrentar a ${match.homeTeamId === state.userTeamId ? away.name : home.name}?`, "previa");
    }
    return news;
  };

  FMG.generateFixturePreviews = function (state, fixture) {
    if (!fixture || !fixture.matches) return [];
    return fixture.matches.map((match) => FMG.generateMatchPreviewNews(state, { ...match, week: fixture.week })).filter(Boolean);
  };

  FMG.generatePostMatchNews = function (state, result) {
    FMG.ensureWorldNews(state);
    const home = team(state, result.homeTeamId);
    const away = team(state, result.awayTeamId);
    if (!home || !away) return [];
    const winner = result.homeGoals > result.awayGoals ? home : result.awayGoals > result.homeGoals ? away : null;
    const loser = winner && winner.id === home.id ? away : winner ? home : null;
    const allGoals = [...(result.homeEvents || []), ...(result.awayEvents || [])];
    const scorer = allGoals[0]?.scorer || null;
    const stats = result.stats || {};
    const items = [];
    const score = `${home.name} ${result.homeGoals}-${result.awayGoals} ${away.name}`;
    items.push(addNews(state, {
      type: "chronicle",
      title: winner ? `${winner.name} firma la cronica grande: ${score}` : `Empate trabajado en ${score}`,
      body: winner
        ? `${winner.name} supero a ${loser.name} en la semana ${result.week || state.currentWeek}. ${scorer ? `${scorer} abrio una historia propia en el marcador.` : "El partido se resolvio sin un goleador dominante."} Remates al arco: ${stats.home?.shotsOnTarget || 0}-${stats.away?.shotsOnTarget || 0}; llegadas peligrosas: ${stats.home?.xg || 0}-${stats.away?.xg || 0}.`
        : `${home.name} y ${away.name} repartieron puntos. Las llegadas peligrosas terminaron ${stats.home?.xg || 0}-${stats.away?.xg || 0} y las areas dejaron mas preguntas que certezas.`,
      tags: ["post-partido"],
      importance: winner && (winner.id === state.userTeamId || loser.id === state.userTeamId) ? 78 : 60,
      entities: { homeTeamId: home.id, awayTeamId: away.id },
      dedupeKey: `chronicle-${state.seasonNumber}-${result.week || state.currentWeek}-${home.id}-${away.id}`
    }));

    if (home.id === state.userTeamId || away.id === state.userTeamId) {
      const userGoals = resultGoals(result, state.userTeamId);
      const fanMood = userGoals.scored > userGoals.conceded ? "celebra" : userGoals.scored === userGoals.conceded ? "divide opiniones" : "exige respuestas";
      const figure = topPlayer(state, state.userTeamId, (left, right) => (right.seasonStats?.goals || 0) - (left.seasonStats?.goals || 0) || right.overall - left.overall);
      items.push(addNews(state, {
        type: "fans",
        title: `La hinchada de ${state.userClub.name} ${fanMood}`,
        body: `Tras el ${userGoals.scored}-${userGoals.conceded}, la relacion con hinchas esta en ${state.career?.relations?.fans ?? 50}/100. ${figure ? `${figure.name} concentra comentarios por sus ${figure.seasonStats?.goals || 0} goles de temporada.` : "El plantel queda bajo observacion colectiva."}`,
        tags: ["hinchas"],
        importance: 68,
        entities: { teamId: state.userTeamId },
        dedupeKey: `fans-${state.seasonNumber}-${result.week || state.currentWeek}-${state.userTeamId}`
      }));
      const speaker = figure || topPlayer(state, state.userTeamId, (left, right) => right.leadership - left.leadership);
      if (speaker) {
        items.push(addNews(state, {
          type: "player-quote",
          title: `${speaker.name} deja una frase desde el vestuario`,
          body: `${speaker.name}, ${speaker.position} de ${state.userClub.name}, dijo que "el grupo sabe donde esta parado" tras jugar ${speaker.seasonStats?.minutes || 0} minutos esta temporada y mantener moral ${speaker.morale}/100.`,
          tags: ["declaracion"],
          importance: 58,
          entities: { playerId: speaker.id, teamId: state.userTeamId },
          dedupeKey: `quote-${state.seasonNumber}-${result.week || state.currentWeek}-${speaker.id}`
        }));
      }
      const question = userGoals.scored < userGoals.conceded
        ? `¿Le preocupa que ${state.userClub.name} haya recibido ${userGoals.conceded} goles esta semana?`
        : `¿Esta victoria cambia las expectativas de ${state.userClub.name} para la tabla?`;
      addPressQuestion(state, question, "post-match");
    }

    const rivalry = rivalryFor(home.id, away.id);
    if (rivalry) {
      items.push(FMG.generateClassicEvent(state, result, rivalry));
    }
    [home.id, away.id].forEach((teamId) => updateStreakForTeam(state, result, teamId));
    return items.filter(Boolean);
  };

  FMG.generateClassicEvent = function (state, result, rivalry) {
    const home = team(state, result.homeTeamId);
    const away = team(state, result.awayTeamId);
    const margin = Math.abs(result.homeGoals - result.awayGoals);
    const disciplinary = (result.cards || []).filter((card) => card.color === "red").length;
    const detail = disciplinary
      ? `El ${rivalry.name} tuvo ${disciplinary} roja(s), intensidad ${rivalry.intensity}/100 y un marcador ${result.homeGoals}-${result.awayGoals}.`
      : margin >= 3
        ? `${home.name} y ${away.name} dejaron un clasico roto por el margen de ${margin} goles.`
        : `${home.name} y ${away.name} jugaron un clasico cerrado, con intensidad ${rivalry.intensity}/100 y detalles tacticos al limite.`;
    return addNews(state, {
      type: "classic",
      title: `${rivalry.name} deja consecuencias`,
      body: detail,
      tags: ["clasico", "rivalidad"],
      importance: 92,
      entities: { homeTeamId: home.id, awayTeamId: away.id },
      dedupeKey: `classic-${state.seasonNumber}-${result.week || state.currentWeek}-${home.id}-${away.id}`
    });
  };

  FMG.generateMarketRumors = function (state) {
    FMG.ensureWorldNews(state);
    const listings = (state.market?.listings || []).slice(0, 6);
    const targets = listings.length
      ? listings
      : state.players.filter((player) => player.teamId !== state.userTeamId && !player.retired).sort((left, right) => right.overall - left.overall).slice(0, 4).map((player) => ({ playerId: player.id, askingPrice: FMG.calculatePlayerValue(player), sellerTeamName: team(state, player.teamId)?.name || "Libre" }));
    return targets.slice(0, 2).map((listing) => {
      const player = state.players.find((item) => item.id === listing.playerId);
      if (!player) return null;
      const seller = listing.sellerTeamName || team(state, player.teamId)?.name || "Libre";
      return addNews(state, {
        type: "rumor",
        title: `Rumor: ${player.name} aparece en carpetas de mercado`,
        body: `${player.name}, ${player.position} de ${seller}, tiene OVR ${player.overall}, contrato ${player.contractYears || 0} anos y una tasacion cercana a ${FMG.currency(listing.askingPrice || FMG.calculatePlayerValue(player))}.`,
        tags: ["mercado"],
        importance: player.overall >= 75 ? 76 : 55,
        entities: { playerId: player.id, teamId: player.teamId },
        dedupeKey: `rumor-${state.seasonNumber}-${state.currentWeek}-${player.id}`
      });
    }).filter(Boolean);
  };

  FMG.generatePlayerPerformanceStories = function (state) {
    FMG.ensureWorldNews(state);
    const stories = [];
    const scorer = [...state.players]
      .filter((player) => !player.retired && (player.seasonStats?.goals || 0) >= 3)
      .sort((left, right) => (right.seasonStats?.goals || 0) - (left.seasonStats?.goals || 0))[0];
    if (scorer) {
      stories.push(addNews(state, {
        type: "player-story",
        title: `${scorer.name} convierte su temporada en argumento`,
        body: `${scorer.name} suma ${scorer.seasonStats.goals} goles, ${scorer.seasonStats.shots || 0} remates y OVR ${scorer.overall}; ${team(state, scorer.teamId)?.name || "Libre"} ya juega alrededor de esa produccion.`,
        tags: ["rendimiento"],
        importance: 72,
        entities: { playerId: scorer.id, teamId: scorer.teamId },
        dedupeKey: `story-goals-${state.seasonNumber}-${state.currentWeek}-${scorer.id}-${scorer.seasonStats.goals}`
      }));
    }
    const unhappy = [...state.players]
      .filter((player) => player.teamId === state.userTeamId && !player.retired && (player.happiness || 50) < 38)
      .sort((left, right) => (left.happiness || 50) - (right.happiness || 50))[0];
    if (unhappy) {
      stories.push(addNews(state, {
        type: "dressing-room",
        title: `Crisis de vestuario: ${unhappy.name} pierde paciencia`,
        body: `${unhappy.name} aparece con felicidad ${unhappy.happiness}/100, moral ${unhappy.morale}/100 y razon reciente: ${unhappy.moraleReason || "sin explicacion interna"}.`,
        tags: ["vestuario"],
        importance: 84,
        entities: { playerId: unhappy.id, teamId: state.userTeamId },
        dedupeKey: `crisis-${state.seasonNumber}-${state.currentWeek}-${unhappy.id}`
      }));
    }
    return stories.filter(Boolean);
  };

  FMG.generateContextualWeeklyNews = function (state, weeklyEvent) {
    FMG.ensureWorldNews(state);
    const created = [];
    if (weeklyEvent) {
      created.push(addNews(state, {
        type: "weekly-event",
        title: weeklyEvent.title,
        body: `${weeklyEvent.detail} El hecho ocurre en semana ${state.currentWeek}, con ${state.userClub.name} en posicion ${standing(state, state.userTeamId).position || "-"}.`,
        tags: ["evento"],
        importance: 64,
        dedupeKey: `event-${state.seasonNumber}-${state.currentWeek}-${weeklyEvent.title}`
      }));
    }
    weeklyEventMakers.forEach((maker, index) => {
      const event = maker(state);
      if (event) {
        created.push(addNews(state, {
          ...event,
          tags: ["mundo-vivo"],
          importance: event.type === "dressing-room" ? 82 : 60,
          dedupeKey: `weekly-${state.seasonNumber}-${state.currentWeek}-${index}-${event.title}`
        }));
      }
    });
    created.push(...FMG.generateMarketRumors(state));
    created.push(...FMG.generatePlayerPerformanceStories(state));
    state.worldNews.weeklyEvents = created.filter(Boolean).slice(0, 8);
    return state.worldNews.weeklyEvents;
  };

  FMG.setNewsFilter = function (state, filter) {
    FMG.ensureWorldNews(state);
    state.worldNews.filter = filter || "all";
    return { ok: true, message: "Filtro de noticias actualizado." };
  };
})();
