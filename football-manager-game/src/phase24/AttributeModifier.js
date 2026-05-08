(function () {
  "use strict";

  // ============================================================
  // FASE 24 — AttributeModifier.js
  // Aplica atributos de jugador a precisión de pases/tiros.
  // También aplica fatiga, moral, lesiones y técnica.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  function AttributeModifier() {}

  // Calcular precisión de pase basada en atributos
  AttributeModifier.prototype.getPassAccuracy = function (player) {
    if (!player || !player.attributes) return 0.82;  // valor por defecto

    var base = 0.60;  // base neutral

    // Atributos positivos
    base += (player.attributes.passing || 75) / 100 * 0.20;    // hasta +0.20
    base += (player.attributes.technique || 70) / 100 * 0.10;  // hasta +0.10

    // Penalizadores
    var fatigueRatio = (player.fatigue || 0) / 100;
    base -= fatigueRatio * 0.15;  // fatiga reduce hasta -0.15

    var moralMod = ((player.morale || 70) - 35) / 65;  // [-1, 1]
    base += moralMod * 0.08;  // moral afecta ±0.08

    // Lesiones
    base *= player.injuryReduction || 1.0;

    return Math.max(0.40, Math.min(1.0, base));
  };

  // Calcular precisión de tiro basada en atributos
  AttributeModifier.prototype.getShootAccuracy = function (player) {
    if (!player || !player.attributes) return 0.65;  // valor por defecto

    var base = 0.45;  // base neutral

    // Atributos positivos
    base += (player.attributes.shooting || 75) / 100 * 0.25;   // hasta +0.25
    base += (player.attributes.technique || 70) / 100 * 0.08;  // hasta +0.08

    // Penalizadores
    var fatigueRatio = (player.fatigue || 0) / 100;
    base -= fatigueRatio * 0.20;  // fatiga reduce hasta -0.20

    var moralMod = ((player.morale || 70) - 35) / 65;
    base += moralMod * 0.10;  // moral afecta ±0.10

    // Lesiones
    base *= player.injuryReduction || 1.0;

    return Math.max(0.35, Math.min(1.0, base));
  };

  // Calcular control del balón (para regates, primeros toques)
  AttributeModifier.prototype.getControlAccuracy = function (player) {
    if (!player || !player.attributes) return 0.70;  // valor por defecto

    var base = 0.55;

    // Atributos
    base += (player.attributes.technique || 70) / 100 * 0.20;   // técnica es crucial
    base += (player.attributes.speed || 75) / 100 * 0.08;       // agilidad ayuda

    // Penalizadores
    var fatigueRatio = (player.fatigue || 0) / 100;
    base -= fatigueRatio * 0.18;

    var moralMod = ((player.morale || 70) - 35) / 65;
    base += moralMod * 0.07;

    base *= player.injuryReduction || 1.0;

    return Math.max(0.40, Math.min(1.0, base));
  };

  // Modificar velocidad efectiva del jugador
  AttributeModifier.prototype.getEffectiveSpeed = function (player) {
    if (!player) return 1.0;

    var base = 1.0;

    // Velocidad base del jugador
    var speed = player.attributes ? player.attributes.speed || 75 : 75;
    base = speed / 80;  // normalizar (80 = velocidad neutra)

    // Fatiga reduce velocidad significativamente
    var fatigueRatio = (player.fatigue || 0) / 100;
    base *= (1 - fatigueRatio * 0.35);

    // Lesiones reducen velocidad
    base *= player.injuryReduction || 1.0;

    return Math.max(0.4, Math.min(1.8, base));
  };

  // Modificar agresividad según instrucciones y rol
  AttributeModifier.prototype.getAggressionModifier = function (player, roleName) {
    if (!player) return 1.0;

    var base = 1.0;

    // Según rol
    if (roleName === "attacking") base = 1.3;
    else if (roleName === "defensive") base = 0.7;
    else if (roleName === "support") base = 1.0;

    // Según instrucción individual
    if (player._instruction === "pressMore") base *= 1.4;
    else if (player._instruction === "stayBack") base *= 0.6;
    else if (player._instruction === "takeRisks") base *= 1.2;

    // Fatiga reduce agresividad
    var fatigueRatio = (player.fatigue || 0) / 100;
    base *= (1 - fatigueRatio * 0.25);

    return Math.max(0.5, Math.min(2.0, base));
  };

  AttributeModifier.prototype.getMarkRadiusModifier = function (player) {
    if (!player) return 1.0;
    var base = 1.0;
    if (player._tacticRole === "defensive") base *= 1.16;
    else if (player._tacticRole === "attacking") base *= 0.88;
    if (player._instruction === "stayBack") base *= 1.12;
    var defense = player.attributes ? player.attributes.defense || 70 : 70;
    base *= 0.9 + defense / 700;
    return Math.max(0.72, Math.min(1.35, base));
  };

  AttributeModifier.prototype.getShootDistanceModifier = function (player) {
    if (!player) return 1.0;
    var base = 1.0;
    if (player._tacticRole === "attacking") base *= 1.14;
    else if (player._tacticRole === "defensive") base *= 0.82;
    if (player._instruction === "takeRisks") base *= 1.12;
    if (player._instruction === "stayBack") base *= 0.78;
    var shooting = player.attributes ? player.attributes.shooting || 70 : 70;
    base *= 0.88 + shooting / 600;
    return Math.max(0.65, Math.min(1.35, base));
  };

  // Calcular radio de presión modificado
  AttributeModifier.prototype.getModifiedPressRadius = function (baseRadius, player, pressureModifier) {
    if (!player) return baseRadius;

    var modified = baseRadius * (pressureModifier || 1.0);

    // Mentalidad ofensiva aumenta presión
    if (player._tacticRole === "attacking") modified *= 1.15;
    else if (player._tacticRole === "defensive") modified *= 0.85;

    // Instrucción "presionar más" aumenta radio
    if (player._instruction === "pressMore") modified *= 1.25;

    // Fatiga reduce presión
    var fatigueRatio = (player.fatigue || 0) / 100;
    modified *= (1 - fatigueRatio * 0.20);

    return modified;
  };

  // Calcular decisión de tomar riesgo (para desmarques)
  AttributeModifier.prototype.getRiskTakingModifier = function (player) {
    if (!player) return 1.0;

    var base = 1.0;

    // Mental ofensivo toma más riesgo
    if (player._tacticRole === "attacking") base *= 1.2;

    // Instrucción de riesgo
    if (player._instruction === "takeRisks") base *= 1.4;
    else if (player._instruction === "stayBack") base *= 0.6;

    // Moral afecta riesgo
    var moralMod = ((player.morale || 70) - 35) / 65;
    base *= (1 + moralMod * 0.2);

    return Math.max(0.5, Math.min(2.0, base));
  };

  window.FMG.Phase24.AttributeModifier = AttributeModifier;
})();
