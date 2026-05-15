(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  // Player personality attributes (0-100 scale)
  const PERSONALITY_BOUNDS = {
    professionalism: { min: 30, max: 95, label: "Profesionalismo" },
    ambition: { min: 35, max: 100, label: "Ambicion" },
    leadership: { min: 20, max: 95, label: "Liderazgo" },
    consistency: { min: 25, max: 90, label: "Consistencia" },
    temperament: { min: 20, max: 95, label: "Temperamento" }
  };

  // Growth curve progression by age
  const GROWTH_CURVE = {
    young: { ageRange: [16, 21], peakGrowth: 0.018, label: "Jovenes" },
    prime: { ageRange: [22, 28], peakGrowth: 0.012, label: "Plenitud" },
    veteran: { ageRange: [29, 32], peakGrowth: 0.006, label: "Veterano" },
    declining: { ageRange: [33, 38], peakGrowth: -0.015, label: "Declive" },
    retiring: { ageRange: [39, 50], peakGrowth: -0.035, label: "Retiro" }
  };

  // Training impact modifiers
  const TRAINING_EFFECTIVENESS = {
    balanced: { overallGain: 0.9, potentialGain: 0.4, moraleMult: 1.0 },
    fitness: { overallGain: 0.5, potentialGain: 0.1, moraleMult: 0.8 },
    morale: { overallGain: 0.3, potentialGain: 0.2, moraleMult: 2.0 },
    tactics: { overallGain: 1.2, potentialGain: 0.5, moraleMult: 1.1 }
  };

  /**
   * Initialize personality attributes for a player (deterministic)
   * Uses player ID and a seeded value for replay compatibility
   */
  function initializePersonality(player, seed = 0) {
    if (player.personality) return player.personality;

    const seedValue = (parseInt(player.id.replace(/\D/g, "") || "0") + seed) % 1000;
    const seededRandom = (offset) => {
      const x = Math.sin(seedValue + offset) * 10000;
      return x - Math.floor(x);
    };

    player.personality = {
      professionalism: Math.round(50 + seededRandom(1) * 45),
      ambition: Math.round(50 + seededRandom(2) * 50),
      leadership: Math.round(35 + seededRandom(3) * 50),
      consistency: Math.round(50 + seededRandom(4) * 40),
      temperament: Math.round(50 + seededRandom(5) * 45)
    };

    // Clamp values within bounds
    Object.keys(PERSONALITY_BOUNDS).forEach((key) => {
      const bounds = PERSONALITY_BOUNDS[key];
      player.personality[key] = FMG.clamp(player.personality[key], bounds.min, bounds.max);
    });

    return player.personality;
  }

  /**
   * Get the growth curve stage for a player's age
   */
  function getGrowthStage(age) {
    for (const [stageName, stage] of Object.entries(GROWTH_CURVE)) {
      const [minAge, maxAge] = stage.ageRange;
      if (age >= minAge && age <= maxAge) {
        return { stageName, ...stage };
      }
    }
    return { stageName: "retiring", ...GROWTH_CURVE.retiring };
  }

  /**
   * Calculate position in growth curve (0-1, where 0.5 is peak)
   */
  function getGrowthPosition(age) {
    const stage = getGrowthStage(age);
    const [minAge, maxAge] = stage.ageRange;
    const posInStage = (age - minAge) / (maxAge - minAge);
    
    // Return position along the curve
    if (stage.stageName === "young" || stage.stageName === "prime") {
      return Math.min(1, posInStage + 0.2);
    }
    return Math.max(0, 1 - posInStage * 0.8);
  }

  /**
   * Calculate potential adjustment based on morale and professionalism
   */
  function calculateDynamicPotential(player) {
    if (!player.potential) return player.overall;

    const personality = player.personality || { professionalism: 50, ambition: 50 };
    const baselinePotential = player.basePotential || player.potential;
    
    // Morale impacts effective potential
    const moraleMultiplier = 0.8 + (player.morale || 70) / 500;
    
    // Professionalism affects ceiling
    const profCeiling = 1 + (personality.professionalism - 50) / 500;
    
    const effective = baselinePotential * moraleMultiplier * profCeiling;
    return Math.round(FMG.clamp(effective, player.overall, baselinePotential + 5));
  }

  /**
   * Calculate weekly progression based on multiple factors
   */
  function calculateWeeklyProgression(player, state, trainingFocus = "balanced") {
    const personality = initializePersonality(player);
    const stage = getGrowthStage(player.age || 28);
    const position = getGrowthPosition(player.age || 28);

    // Base growth from age curve
    const ageGrowth = stage.peakGrowth * position;

    // Training effectiveness
    const training = TRAINING_EFFECTIVENESS[trainingFocus] || TRAINING_EFFECTIVENESS.balanced;
    const trainingGain = training.overallGain * 0.01; // Scale to 1% base

    // Personality impact on growth
    const ambitionMult = 0.7 + (personality.ambition / 100) * 0.6;
    const profMult = 0.8 + (personality.professionalism / 100) * 0.4;

    // Morale impact
    const moraleMult = 0.85 + (player.morale || 70) / 500;

    // Playing time impact (if tracked)
    const playingTimeBonus = (player.seasonStats?.minutes || 0) > 2700 ? 1.15 : 
                            (player.seasonStats?.minutes || 0) > 900 ? 1.0 : 0.8;

    // Calculate final progression
    const totalGrowth = (ageGrowth + trainingGain) * ambitionMult * profMult * moraleMult * playingTimeBonus;

    return {
      ageGrowth,
      trainingGain,
      personality,
      stage,
      totalGrowth,
      multipliers: { ambition: ambitionMult, prof: profMult, morale: moraleMult, playingTime: playingTimeBonus }
    };
  }

  /**
   * Apply weekly progression to a player
   */
  function applyWeeklyProgression(player, state, trainingFocus = "balanced", week = 1) {
    const progression = calculateWeeklyProgression(player, state, trainingFocus);
    
    // Update overall (cap to potential)
    const potentialNow = calculateDynamicPotential(player);
    const maxGain = Math.max(0, potentialNow - player.overall);
    const actualGain = Math.min(maxGain, Math.max(-1, progression.totalGrowth));
    
    player.overall = Math.round(FMG.clamp(player.overall + actualGain, 1, 99));

    // Update potential based on morale and professionalism
    if (player.basePotential === undefined) {
      player.basePotential = player.potential || player.overall;
    }
    player.potential = calculateDynamicPotential(player);

    // Record progression history
    if (!player.progressionHistory) player.progressionHistory = [];
    player.progressionHistory.push({
      week,
      seasonNumber: state.seasonNumber || 1,
      overallBefore: player.overall - actualGain,
      overallAfter: player.overall,
      progression: Math.round(actualGain * 100) / 100
    });
    player.progressionHistory = player.progressionHistory.slice(-52); // Keep 1 year

    return {
      player,
      progression,
      actualGain: Math.round(actualGain * 100) / 100
    };
  }

  /**
   * Apply morale impact from match performance
   */
  function applyMoraleImpact(player, matchPerformance, result) {
    if (!matchPerformance) return;

    const personality = player.personality || { temperament: 50, consistency: 50 };
    const baseImpact = matchPerformance.rating ? (matchPerformance.rating - 75) / 10 : 0;
    
    // Consistency reduces variance
    const consistency = personality.consistency / 100;
    const actualImpact = baseImpact * (0.5 + consistency * 0.5);
    
    // Result multiplier
    const resultMult = result === "win" ? 1.2 : result === "draw" ? 1.0 : 0.6;
    
    const moraleDelta = actualImpact * resultMult;
    player.morale = FMG.clamp(player.morale + moraleDelta, 0, 100);
  }

  /**
   * Apply injury risk based on temperament
   */
  function calculateInjuryRisk(player, minutesPlayed = 0) {
    const personality = player.personality || { temperament: 50 };
    
    // Base risk increases with fatigue
    const fatigue = Math.max(0, 100 - (player.energy || 70));
    const baseRisk = 0.001 + (fatigue / 1000);
    
    // Temperament increases injury risk (reckless play)
    const recklessness = (100 - personality.temperament) / 1000;
    
    // Cumulative from minutes
    const minutesRisk = minutesPlayed / 50000; // 1% risk at 500 minutes
    
    return Math.min(0.1, baseRisk + recklessness + minutesRisk);
  }

  /**
   * Apply leadership impact to nearby players' morale
   */
  function applyLeadershipImpact(leader, teammates, state) {
    if (!leader.personality || leader.personality.leadership < 50) return [];

    const leadership = leader.personality.leadership;
    const impactedPlayers = [];

    // Only impact if player played significant minutes
    const minLeadMinutes = 1000;
    if ((leader.seasonStats?.minutes || 0) < minLeadMinutes) return impactedPlayers;

    teammates
      .filter((p) => p.id !== leader.id && p.teamId === leader.teamId && (p.morale || 70) < 80)
      .slice(0, 3) // Max 3 players impacted per week
      .forEach((teammate) => {
        const impact = (leadership - 50) / 200; // 0-0.25 morale boost
        teammate.morale = FMG.clamp(teammate.morale + impact, 0, 100);
        impactedPlayers.push(teammate.id);
      });

    return impactedPlayers;
  }

  /**
   * Process weekly player progression for all players
   */
  function processWeeklyPlayerProgression(state, trainingFocusByTeam = {}) {
    if (!state.players || !state.players.length) return { processed: 0, errors: 0 };

    const results = [];
    let processed = 0;
    let errors = 0;

    state.players.forEach((player) => {
      try {
        // Skip retired players
        if (player.retired) return;

        // Initialize personality if needed
        initializePersonality(player);

        // Get training focus for player's team
        const focus = trainingFocusByTeam[player.teamId] || "balanced";

        // Apply progression
        const result = applyWeeklyProgression(player, state, focus, state.currentWeek);
        results.push(result);
        processed++;
      } catch (err) {
        errors++;
        console.error(`Player progression error for ${player.id}:`, err);
      }
    });

    return { processed, errors, results: results.slice(0, 20) };
  }

  /**
   * Ensure player has progression state
   */
  function ensurePlayerProgressionState(player) {
    player.personality = player.personality || {};
    player.basePotential = player.basePotential || player.potential || player.overall;
    player.progressionHistory = player.progressionHistory || [];
    player.seasonStats = player.seasonStats || {
      minutes: 0,
      goals: 0,
      assists: 0,
      rating: 0,
      matchCount: 0
    };
    return player;
  }

  // Exports
  FMG.PlayerProgression = {
    initializePersonality,
    getGrowthStage,
    getGrowthPosition,
    calculateDynamicPotential,
    calculateWeeklyProgression,
    applyWeeklyProgression,
    applyMoraleImpact,
    calculateInjuryRisk,
    applyLeadershipImpact,
    processWeeklyPlayerProgression,
    ensurePlayerProgressionState,
    PERSONALITY_BOUNDS,
    GROWTH_CURVE,
    TRAINING_EFFECTIVENESS
  };
})();
