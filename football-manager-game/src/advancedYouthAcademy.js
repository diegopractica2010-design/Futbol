(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const clamp = FMG.clamp;

  const hashText = FMG.hashText;

  const deterministicId = FMG.deterministicId;

  const pickByHash = FMG.pickByHash;

  const boundedPush = FMG.boundedPush;

  const boundedUpsert = FMG.boundedUpsert;

  function team(state, teamId) {
    return (state.teams || []).find((item) => item.id === teamId) || null;
  }

  function activePlayers(state, teamId) {
    return (state.players || []).filter((player) => player.teamId === teamId && !player.retired);
  }

  function ensureFootballGenerationState(state) {
    state.youthAcademy = state.youthAcademy || {};
    const academy = state.youthAcademy;
    academy.version = 1;
    academy.academies = academy.academies || {};
    academy.generations = academy.generations || [];
    academy.lineages = academy.lineages || [];
    academy.dynasties = academy.dynasties || [];
    academy.prospects = academy.prospects || [];
    academy.history = academy.history || [];
    academy.regens = academy.regens || [];
    academy.narratives = academy.narratives || [];
    academy.balancing = academy.balancing || { lastSeason: 0, createdThisSeason: 0, retiredThisSeason: 0 };
    academy.culture = academy.culture || {
      era: "presion moderna",
      tacticalInfluence: state.managerEcosystem?.culture?.league?.tacticalTrend || "presion y transicion",
      countryReputation: state.managerEcosystem?.worldMedia?.reputation?.countryReputation || 52
    };
    (state.teams || []).forEach((item) => AcademyDevelopmentController.ensureAcademy(state, item.id));
    return academy;
  }

  function baseName(seed, region) {
    const firstNames = {
      norte: ["Tomas", "Bruno", "Nicolas", "Valentin", "Cristobal"],
      centro: ["Ignacio", "Martin", "Vicente", "Joaquin", "Agustin"],
      sur: ["Matias", "Benjamin", "Diego", "Lautaro", "Bastian"],
      costa: ["Maximiliano", "Lucas", "Franco", "Emiliano", "Rafael"]
    };
    const lastNames = ["Araya", "Molina", "Tapia", "Rojas", "Fuentes", "Cortes", "Vidal", "Pizarro", "Mena", "Salinas"];
    const group = firstNames[region] || firstNames.centro;
    return `${pickByHash(group, `${seed}-first`)} ${pickByHash(lastNames, `${seed}-last`)}`;
  }

  function regionForClub(club) {
    const city = String(club?.city || "").toLowerCase();
    if (city.includes("valparaiso") || city.includes("vina")) return "costa";
    if (city.includes("calama") || city.includes("antofagasta") || city.includes("iquique")) return "norte";
    if (city.includes("temuco") || city.includes("concepcion") || city.includes("chillan")) return "sur";
    return "centro";
  }

  const YouthPersonalityGenerator = {
    generate(seed, context = {}) {
      const archetype = pickByHash(["profesional", "ambicioso", "barrial", "lider", "irregular", "resiliente"], `${seed}-archetype`);
      const base = {
        professionalism: 42 + (hashText(`${seed}-pro`) % 42),
        ambition: 44 + (hashText(`${seed}-amb`) % 46),
        leadership: 30 + (hashText(`${seed}-lead`) % 50),
        consistency: 36 + (hashText(`${seed}-cons`) % 48),
        temperament: 38 + (hashText(`${seed}-temp`) % 48)
      };
      if (archetype === "profesional") base.professionalism += 10;
      if (archetype === "ambicioso") base.ambition += 12;
      if (archetype === "lider") base.leadership += 12;
      if (archetype === "irregular") base.consistency -= 10;
      if (archetype === "resiliente") base.temperament += 10;
      if (context.academyPhilosophy === "disciplina") base.professionalism += 6;
      if (context.academyPhilosophy === "talento libre") base.ambition += 5;
      Object.keys(base).forEach((key) => { base[key] = clamp(base[key], 20, 98); });
      return { archetype, traits: base };
    }
  };

  const AcademyDevelopmentController = {
    ensureAcademy(state, teamId) {
      const academy = state.youthAcademy || { academies: {} };
      academy.academies = academy.academies || {};
      state.youthAcademy = academy;
      const club = team(state, teamId) || { id: teamId, name: "Club", budget: 80000000, style: "Balanced" };
      const seed = hashText(`${teamId}-academy`);
      academy.academies[teamId] = academy.academies[teamId] || {
        teamId,
        region: regionForClub(club),
        philosophy: pickByHash(["disciplina", "talento libre", "fisico intenso", "posesion tecnica", "cantera familiar"], `${teamId}-philosophy`),
        reputation: clamp(34 + Math.round((club.budget || 80000000) / 3500000) + (seed % 18), 25, 92),
        facilities: 36 + (hashText(`${teamId}-facilities`) % 46),
        recruitment: 34 + (hashText(`${teamId}-recruitment`) % 48),
        coaching: 38 + (hashText(`${teamId}-coaching`) % 46),
        identity: pickByHash(["formadora", "exportadora", "barrial", "elite local", "rescate regional"], `${teamId}-identity`),
        rivalryScore: {},
        prospects: [],
        graduates: [],
        failures: [],
        wonderkids: [],
        lateBloomers: []
      };
      return academy.academies[teamId];
    },

    weekly(state) {
      const academy = ensureFootballGenerationState(state);
      const record = this.ensureAcademy(state, state.userTeamId);
      const staffBoost = state.finances?.staff?.coaching || 1;
      record.reputation = clamp(Math.round(record.reputation * 0.98 + record.facilities * 0.01 + staffBoost), 20, 98);
      FootballCultureInheritanceManager.update(state);
      DynamicTalentEngine.trackYouthDevelopment(state);
      if (state.currentWeek % 5 === 0) DynamicTalentEngine.emergeProspect(state, state.userTeamId, { source: "weekly" });
      return academy;
    }
  };

  const FootballCultureInheritanceManager = {
    update(state) {
      const academy = ensureFootballGenerationState(state);
      academy.culture.era = state.seasonNumber >= 8 ? "era generacional" : state.seasonNumber >= 4 ? "transicion tactica" : "presion moderna";
      academy.culture.tacticalInfluence = state.managerEcosystem?.culture?.league?.tacticalTrend || academy.culture.tacticalInfluence;
      academy.culture.countryReputation = state.managerEcosystem?.worldMedia?.reputation?.countryReputation || academy.culture.countryReputation;
      return academy.culture;
    },

    positionBias(state, teamId, seed) {
      const record = AcademyDevelopmentController.ensureAcademy(state, teamId);
      if (record.philosophy === "posesion tecnica") return pickByHash(["MED", "MED", "EXT", "DEF", "DEL"], `${seed}-pos`);
      if (record.philosophy === "fisico intenso") return pickByHash(["DEF", "DEL", "EXT", "MED", "POR"], `${seed}-pos`);
      if (record.philosophy === "talento libre") return pickByHash(["EXT", "DEL", "MED", "MED", "POR"], `${seed}-pos`);
      return pickByHash(["POR", "DEF", "MED", "EXT", "DEL"], `${seed}-pos`);
    }
  };

  const FootballLineageSystem = {
    createLineage(state, player, parent = null) {
      const academy = ensureFootballGenerationState(state);
      const lineage = {
        id: deterministicId("lineage", [player.id, parent?.id || "origin"]),
        playerId: player.id,
        playerName: player.name,
        parentPlayerId: parent?.id || null,
        parentName: parent?.name || null,
        teamId: player.teamId,
        generation: parent ? "regen" : "academy",
        familyTag: parent ? `${parent.name.split(" ").slice(-1)[0]} lineage` : `${player.name.split(" ").slice(-1)[0]} roots`,
        seasonNumber: state.seasonNumber
      };
      boundedUpsert(academy.lineages, lineage, 120);
      return lineage;
    },

    updateDynasty(state, player) {
      const academy = ensureFootballGenerationState(state);
      const surname = player.name.split(" ").slice(-1)[0];
      const existing = academy.dynasties.find((item) => item.surname === surname);
      const dynasty = existing || {
        id: deterministicId("dynasty", [surname]),
        surname,
        members: [],
        reputation: 30,
        originSeason: state.seasonNumber
      };
      if (!dynasty.members.includes(player.id)) dynasty.members.push(player.id);
      dynasty.reputation = clamp(Math.round(dynasty.reputation + (player.potential || 65) / 24), 20, 100);
      boundedUpsert(academy.dynasties, dynasty, 40);
      return dynasty;
    }
  };

  const FootballGenerationController = {
    createProspect(state, teamId, options = {}) {
      const club = team(state, teamId) || state.userClub || { id: teamId, name: "Club", budget: 80000000 };
      const academyRecord = AcademyDevelopmentController.ensureAcademy(state, teamId);
      const seed = `${state.seasonNumber}-${state.currentWeek}-${teamId}-${options.source || "academy"}-${options.index || 0}-${options.parentId || ""}`;
      const hash = hashText(seed);
      const position = options.position || FootballCultureInheritanceManager.positionBias(state, teamId, seed);
      const age = options.age || 15 + (hash % 4);
      const personality = YouthPersonalityGenerator.generate(seed, { academyPhilosophy: academyRecord.philosophy });
      const reputationBoost = Math.round(academyRecord.reputation / 12);
      const parentBoost = options.parent ? Math.round(((options.parent.overall || 65) + (options.parent.potential || 70)) / 38) : 0;
      const potential = clamp(61 + (hash % 23) + reputationBoost + parentBoost, 58, 94);
      const overall = clamp(42 + ((hash >>> 4) % 15) + Math.round((academyRecord.coaching || 50) / 22), 38, Math.min(68, potential - 4));
      const player = {
        id: options.id || deterministicId(options.parent ? "regen" : "academy", [seed]),
        name: options.name || baseName(seed, academyRecord.region),
        teamId,
        position,
        age,
        overall,
        potential,
        basePotential: potential,
        morale: 68 + (hash % 18),
        energy: 82 + ((hash >>> 6) % 12),
        value: 350000 + potential * 42000 + overall * 18000,
        salary: 80000 + overall * 2500,
        contractYears: 2,
        squadRole: "youth",
        personality: personality.archetype,
        youthPersonality: personality,
        generationTag: options.parent ? "regen" : "academy",
        lineageParentId: options.parent?.id || null,
        idolPlayerId: options.idolPlayerId || options.parent?.id || null,
        regionalIdentity: academyRecord.region,
        academyPhilosophy: academyRecord.philosophy,
        developmentState: potential >= 84 ? "wonderkid" : age >= 19 && overall < 55 ? "late-bloomer-risk" : "prospect",
        seasonStats: { appearances: 0, starts: 0, minutes: 0, goals: 0, injuries: 0, cards: 0, shots: 0 }
      };
      FMG.preparePlayersForSeason?.([player]);
      return player;
    },

    registerProspect(state, player, options = {}) {
      const academy = ensureFootballGenerationState(state);
      const record = AcademyDevelopmentController.ensureAcademy(state, player.teamId);
      if (!state.players.some((item) => item.id === player.id)) state.players.push(player);
      const prospect = {
        id: deterministicId("prospect", [player.id]),
        playerId: player.id,
        playerName: player.name,
        teamId: player.teamId,
        seasonNumber: state.seasonNumber,
        age: player.age,
        position: player.position,
        potential: player.potential,
        tag: player.developmentState,
        source: options.source || player.generationTag || "academy"
      };
      boundedUpsert(academy.prospects, prospect, 80);
      boundedUpsert(record.prospects, prospect, 24);
      if (player.developmentState === "wonderkid") boundedUpsert(record.wonderkids, prospect, 12);
      FootballLineageSystem.createLineage(state, player, options.parent || null);
      FootballLineageSystem.updateDynasty(state, player);
      return prospect;
    }
  };

  const RegenGenerationEngine = {
    generateFromRetired(state, retiredPlayers = []) {
      const created = [];
      retiredPlayers
        .filter((player) => player && player.retired)
        .sort((left, right) => (right.overall || 0) - (left.overall || 0))
        .slice(0, Math.max(4, Math.ceil((state.teams || []).length / 2)))
        .forEach((retired, index) => {
          const targetTeam = retired.teamId && retired.teamId !== "free-agent" ? retired.teamId : pickByHash(state.teams, `${retired.id}-regen-team`)?.id;
          if (!targetTeam) return;
          const regen = FootballGenerationController.createProspect(state, targetTeam, {
            source: "regen",
            index,
            parent: retired,
            parentId: retired.id,
            position: retired.position,
            age: 16 + (hashText(`${retired.id}-regen-age`) % 3)
          });
          regen.name = baseName(`${retired.id}-regen-${state.seasonNumber}`, AcademyDevelopmentController.ensureAcademy(state, targetTeam).region);
          regen.potential = clamp(Math.round((regen.potential * 0.72) + ((retired.potential || retired.overall || 70) * 0.28)), regen.overall + 5, 96);
          regen.value = Math.round(regen.value * (regen.potential >= 85 ? 1.35 : 1));
          FootballGenerationController.registerProspect(state, regen, { source: "regen", parent: retired });
          created.push(regen);
        });
      const academy = ensureFootballGenerationState(state);
      created.forEach((player) => boundedUpsert(academy.regens, {
        id: deterministicId("regen-record", [player.id]),
        playerId: player.id,
        playerName: player.name,
        parentPlayerId: player.lineageParentId,
        teamId: player.teamId,
        seasonNumber: state.seasonNumber,
        potential: player.potential
      }, 60));
      return created;
    }
  };

  const DynamicTalentEngine = {
    emergeProspect(state, teamId, options = {}) {
      const academy = ensureFootballGenerationState(state);
      const record = AcademyDevelopmentController.ensureAcademy(state, teamId);
      const currentYouth = activePlayers(state, teamId).filter((player) => player.age <= 20).length;
      if (currentYouth > 9 && options.force !== true) return null;
      const index = academy.balancing.createdThisSeason + record.prospects.length;
      const player = FootballGenerationController.createProspect(state, teamId, { source: options.source || "emergence", index });
      if (player.potential >= 84) player.developmentState = "wonderkid";
      if (player.age >= 18 && player.overall <= 52 && player.potential >= 78) player.developmentState = "late-bloomer";
      FootballGenerationController.registerProspect(state, player, { source: options.source || "emergence" });
      academy.balancing.createdThisSeason += 1;
      this.createProspectNarrative(state, player);
      return player;
    },

    trackYouthDevelopment(state) {
      const academy = ensureFootballGenerationState(state);
      academy.prospects.slice(0, 60).forEach((prospect) => {
        const player = (state.players || []).find((item) => item.id === prospect.playerId);
        if (!player || player.retired) return;
        const personality = player.youthPersonality?.traits || {};
        const mentor = activePlayers(state, player.teamId).filter((item) => item.age >= 28).sort((a, b) => (b.leadership || b.overall || 0) - (a.leadership || a.overall || 0))[0];
        if (mentor && !player.mentorId) player.mentorId = mentor.id;
        const mentorBoost = mentor ? Math.round((mentor.leadership || mentor.overall || 60) / 38) : 0;
        const professionalism = personality.professionalism || 55;
        const growthChance = hashText(`${state.seasonNumber}-${state.currentWeek}-${player.id}-growth`) % 100;
        if (growthChance < clamp(8 + Math.round(professionalism / 8) + mentorBoost, 5, 28) && player.overall < player.potential) {
          player.overall += 1;
          player.morale = clamp((player.morale || 60) + 2, 0, 100);
          prospect.lastDevelopmentWeek = state.currentWeek;
        }
        if (player.age >= 22 && player.overall + 8 < player.potential) {
          player.developmentState = "failed-prospect";
          boundedUpsert(AcademyDevelopmentController.ensureAcademy(state, player.teamId).failures, {
            id: deterministicId("failed-prospect", [player.id]),
            playerId: player.id,
            playerName: player.name,
            seasonNumber: state.seasonNumber,
            gap: player.potential - player.overall
          }, 18);
        }
      });
    },

    createProspectNarrative(state, player) {
      const academy = ensureFootballGenerationState(state);
      const title = player.developmentState === "wonderkid"
        ? `${player.name} aparece como joya generacional`
        : player.developmentState === "late-bloomer"
          ? `${player.name} asoma como desarrollo tardio`
          : `${player.name} entra al mapa formativo`;
      const narrative = {
        id: deterministicId("prospect-story", [state.seasonNumber, state.currentWeek, player.id]),
        week: state.currentWeek,
        seasonNumber: state.seasonNumber,
        playerId: player.id,
        playerName: player.name,
        title,
        detail: `${player.position}, ${player.age} anos, potencial ${player.potential}, identidad ${player.regionalIdentity} y filosofia ${player.academyPhilosophy}.`,
        tag: player.developmentState
      };
      boundedUpsert(academy.narratives, narrative, 40);
      FMG.addNewsItem?.(state, {
        type: "academy",
        title,
        body: narrative.detail,
        tags: ["cantera", "futuro"],
        importance: player.developmentState === "wonderkid" ? 84 : 58,
        entities: { playerId: player.id, teamId: player.teamId },
        dedupeKey: `academy-${state.seasonNumber}-${state.currentWeek}-${player.id}`
      });
      return narrative;
    }
  };

  const ProceduralFootballFutureSimulationLayer = {
    runWeekly(state) {
      const academy = AcademyDevelopmentController.weekly(state);
      return { academy };
    },

    runSeasonRollover(state, options = {}) {
      const academy = ensureFootballGenerationState(state);
      const rolloverId = deterministicId("generation-season", [state.seasonNumber]);
      if (!options.force && academy.history.some((entry) => entry.id === rolloverId)) {
        return { created: 0, regens: [], skipped: true };
      }
      academy.balancing.lastSeason = state.seasonNumber;
      academy.balancing.createdThisSeason = 0;
      academy.balancing.retiredThisSeason = (options.retired || []).length;
      const regens = RegenGenerationEngine.generateFromRetired(state, options.retired || []);
      const targetPerSeason = Math.max(6, Math.ceil((state.teams || []).length * 0.7));
      let created = regens.length;
      (state.teams || []).forEach((club, index) => {
        if (created >= targetPerSeason) return;
        const currentYouth = activePlayers(state, club.id).filter((player) => player.age <= 20).length;
        if (currentYouth < 5 || index % 3 === state.seasonNumber % 3) {
          const prospect = DynamicTalentEngine.emergeProspect(state, club.id, { source: "season-intake", force: currentYouth < 5 });
          if (prospect) created += 1;
        }
      });
      boundedUpsert(academy.history, {
        id: rolloverId,
        seasonNumber: state.seasonNumber,
        week: state.currentWeek,
        type: "season-rollover",
        created,
        regens: regens.length,
        retired: (options.retired || []).length,
        era: academy.culture.era
      }, 80);
      return { created, regens };
    }
  };

  function runFootballGenerationWeek(state, options = {}) {
    const result = ProceduralFootballFutureSimulationLayer.runWeekly(state, options);
    return result;
  }

  function runFootballGenerationSeasonRollover(state, options = {}) {
    return ProceduralFootballFutureSimulationLayer.runSeasonRollover(state, options);
  }

  const previousRunManagerEcosystemWeek = FMG.runManagerEcosystemWeek;
  FMG.runManagerEcosystemWeek = function (state, options = {}) {
    const result = previousRunManagerEcosystemWeek ? previousRunManagerEcosystemWeek(state, options) : {};
    result.footballGeneration = runFootballGenerationWeek(state, options);
    return result;
  };
  if (FMG.ManagerEcosystem) FMG.ManagerEcosystem.runWeek = FMG.runManagerEcosystemWeek;

  FMG.AdvancedYouthAcademy = {
    ensure: ensureFootballGenerationState,
    runWeek: runFootballGenerationWeek,
    runSeasonRollover: runFootballGenerationSeasonRollover,
    RegenGenerationEngine,
    AcademyDevelopmentController,
    FootballGenerationController,
    FootballLineageSystem,
    DynamicTalentEngine,
    YouthPersonalityGenerator,
    FootballCultureInheritanceManager,
    ProceduralFootballFutureSimulationLayer
  };

  FMG.ensureFootballGenerationState = ensureFootballGenerationState;
  FMG.runFootballGenerationWeek = runFootballGenerationWeek;
  FMG.runFootballGenerationSeasonRollover = runFootballGenerationSeasonRollover;
})();
