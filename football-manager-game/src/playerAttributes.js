(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  /**
   * Player Attributes System
   * Defines all personality and progression attributes
   */

  const PERSONALITY_TYPES = {
    "Profesional": {
      professionalism: { min: 75, max: 95 },
      ambition: { min: 60, max: 80 },
      consistency: { min: 70, max: 90 },
      temperament: { min: 65, max: 85 },
      leadership: { min: 50, max: 75 }
    },
    "Ambicioso": {
      professionalism: { min: 60, max: 85 },
      ambition: { min: 85, max: 100 },
      consistency: { min: 55, max: 75 },
      temperament: { min: 40, max: 65 },
      leadership: { min: 60, max: 85 }
    },
    "Leal": {
      professionalism: { min: 70, max: 90 },
      ambition: { min: 50, max: 70 },
      consistency: { min: 75, max: 95 },
      temperament: { min: 60, max: 80 },
      leadership: { min: 70, max: 90 }
    },
    "Competitivo": {
      professionalism: { min: 65, max: 85 },
      ambition: { min: 75, max: 95 },
      consistency: { min: 60, max: 80 },
      temperament: { min: 30, max: 60 },
      leadership: { min: 55, max: 80 }
    },
    "Volatil": {
      professionalism: { min: 30, max: 60 },
      ambition: { min: 40, max: 75 },
      consistency: { min: 20, max: 50 },
      temperament: { min: 20, max: 45 },
      leadership: { min: 25, max: 55 }
    }
  };

  const PERSONALITY_LABELS = {
    professionalism: "Profesionalismo",
    ambition: "Ambicion",
    leadership: "Liderazgo",
    consistency: "Consistencia",
    temperament: "Temperamento"
  };

  const PERSONALITY_DESCRIPTIONS = {
    professionalism: "Dedicacion a entrenamientos y disciplina personal",
    ambition: "Deseo de mejorar y alcanzar objetivos",
    leadership: "Capacidad de influir positivamente en otros",
    consistency: "Estabilidad en el desempenio",
    temperament: "Control emocional y disciplina en partidos"
  };

  /**
   * Get personality type with highest probability from seeded value
   */
  function getPersonalityType(player, seed = 0) {
    const seedValue = (parseInt(player.id.replace(/\D/g, "") || "0") + seed) % 1000;
    const personalities = Object.keys(PERSONALITY_TYPES);
    const index = Math.floor((seedValue / 1000) * personalities.length);
    return personalities[index];
  }

  /**
   * Generate personality attributes for player
   */
  function generatePersonality(player, seed = 0) {
    const personalityType = getPersonalityType(player, seed);
    const typeDefinition = PERSONALITY_TYPES[personalityType];

    const seededRandom = (offset) => {
      const x = Math.sin((parseInt(player.id.replace(/\D/g, "") || "0") + seed + offset) * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };

    const personality = {};
    Object.keys(typeDefinition).forEach((attr) => {
      const bounds = typeDefinition[attr];
      const value = bounds.min + seededRandom(attr.charCodeAt(0)) * (bounds.max - bounds.min);
      personality[attr] = Math.round(value);
    });

    return {
      type: personalityType,
      attributes: personality
    };
  }

  /**
   * Calculate attribute impact on match performance variance
   */
  function getPerformanceVariance(personality = {}) {
    const consistency = personality.consistency || 50;
    const temperament = personality.temperament || 50;
    
    // Consistency reduces variance, temperament increases it
    const varianceFactor = 1 - (consistency / 200) + ((100 - temperament) / 200);
    return Math.max(0.3, Math.min(1.8, varianceFactor));
  }

  /**
   * Calculate morale recovery rate
   */
  function getMoraleRecoveryRate(personality = {}) {
    const professionalism = personality.professionalism || 50;
    const consistency = personality.consistency || 50;
    
    // Higher professionalism and consistency = faster morale recovery
    return 1 + ((professionalism + consistency - 100) / 500);
  }

  /**
   * Calculate training receptiveness
   */
  function getTrainingReceptiveness(personality = {}, focus = "balanced") {
    const ambition = personality.ambition || 50;
    const professionalism = personality.professionalism || 50;
    
    // Base receptiveness
    let base = 1 + ((ambition + professionalism - 100) / 400);

    // Focus-specific receptiveness
    const focusMultipliers = {
      balanced: 1.0,
      fitness: 0.8 + (professionalism / 500),
      morale: 0.9 + (professionalism / 400),
      tactics: 1.1 + (ambition / 500)
    };

    return base * (focusMultipliers[focus] || 1.0);
  }

  /**
   * Calculate card/discipline risk
   */
  function getCardRisk(personality = {}) {
    const temperament = personality.temperament || 50;
    
    // Lower temperament = higher card risk
    const riskMultiplier = 1 + ((100 - temperament) / 200);
    return Math.max(0.3, Math.min(2.5, riskMultiplier));
  }

  /**
   * Format personality display
   */
  function formatPersonalityDisplay(personality = {}) {
    const attrs = [];
    Object.keys(PERSONALITY_LABELS).forEach((key) => {
      const value = personality[key] || 0;
      const label = PERSONALITY_LABELS[key];
      
      let strength = "Bajo";
      if (value >= 75) strength = "Excelente";
      else if (value >= 60) strength = "Alto";
      else if (value >= 40) strength = "Medio";
      
      attrs.push({ attr: label, value, strength });
    });
    return attrs;
  }

  /**
   * Ensure player has personality attributes
   */
  function ensurePersonalityState(player, seed = 0) {
    if (!player.personality || typeof player.personality !== "object" || !Object.keys(player.personality).length) {
      const generated = generatePersonality(player, seed);
      player.personalityType = generated.type;
      player.personality = generated.attributes;
    }
    
    // Ensure all attributes exist
    Object.keys(PERSONALITY_LABELS).forEach((key) => {
      if (!(key in player.personality)) {
        player.personality[key] = 50;
      }
    });

    return player;
  }

  // Export
  FMG.PlayerAttributes = {
    PERSONALITY_TYPES,
    PERSONALITY_LABELS,
    PERSONALITY_DESCRIPTIONS,
    getPersonalityType,
    generatePersonality,
    getPerformanceVariance,
    getMoraleRecoveryRate,
    getTrainingReceptiveness,
    getCardRisk,
    formatPersonalityDisplay,
    ensurePersonalityState
  };
})();
