(function () {
  "use strict";

  // ============================================================
  // FASE 24 — TacticsApplier.js
  // Aplica tácticas del manager al partido en vivo.
  // Modifica: presión, formación, roles, fatiga, moral, etc.
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  function TacticsApplier() {
    this.matchStarted = false;
    this.matchTick = 0;
    this._lastFatigueUpdate = 0;
  }

  // Inicializar tácticas al comenzar el partido
  TacticsApplier.prototype.applyInitialTactics = function (match, gameState) {
    if (!match || !gameState || !gameState.tactics) return;

    var plan = gameState.tactics.teamSettings[gameState.userTeamId];
    if (!plan) return;

    // Grabar plan en el partido para acceso rápido
    match.tacticsPlan = plan;

    // Aplicar atributos iniciales a jugadores
    match.userTeam.forEach(function (player, idx) {
      ensurePlayerStats(player, idx, plan);
    });

    match.aiTeam.forEach(function (player, idx) {
      ensurePlayerStats(player, idx, null);
    });

    this.matchStarted = true;
  };

  // Aplicar tácticas cada tick
  TacticsApplier.prototype.tick = function (match, gameState, tickNumber) {
    if (!this.matchStarted || !match || !gameState) return;

    this.matchTick = tickNumber;

    // Cada 60 ticks (~1 segundo a 60 fps), actualizar fatiga y estado
    if (tickNumber % 60 === 0) {
      this._updatePlayerFatigue(match, tickNumber);
      this._applyFatigueEffects(match);
      this._applyMoralEffects(match);
    }

    // Aplicar modificadores dinámicos al juego
    this._applyPressureModifier(match, gameState);
  };

  // Asegurar que el jugador tenga atributos y estado
  function ensurePlayerStats(player, slotIndex, plan) {
    if (!player._tacticsInitialized) {
      // Atributos base (no modificados)
      player._baseSpeed = player.speed || 75;
      player._baseShootAccuracy = 0.65;
      player._basePassAccuracy = 0.82;
      player._baseControl = 0.7;

      // Fatiga y moral se ajustan durante el partido
      player.fatigue = 0;     // 0-100: 0=fresco, 100=agotado
      player.injuryReduction = player.injury ? 0.75 : 1.0;  // velocidad si lesionado

      // Aplicar role si es equipo del usuario
      if (plan && plan.playerRoles) {
        var position = getPositionFromSlot(slotIndex);
        var role = plan.playerRoles[position] || "balanced";
        player._tacticRole = role;
      }

      // Aplicar instrucción individual
      if (plan && plan.instructions && plan.instructions[player.id]) {
        player._instruction = plan.instructions[player.id];
      }

      player._tacticsInitialized = true;
    }
  }

  // Actualizar fatiga cada segundo de juego
  TacticsApplier.prototype._updatePlayerFatigue = function (match, tickNumber) {
    var matchSeconds = tickNumber / 60;
    var matchMinutes = Math.floor(matchSeconds / 60);
    var matchProgress = Math.min(1.0, matchMinutes / 90);  // 0-1 en 90 minutos

    match.allPlayers().forEach(function (player) {
      if (!player._tacticsInitialized) return;

      // Fatiga base: progresa con el tiempo (0 -> 60 en 90 min)
      var baseFatigue = matchProgress * 60;

      // Modificador por movimiento
      var speed = Math.hypot(player.vx || 0, player.vy || 0);
      var movementFatigue = speed > 3 ? 0.8 : speed > 1.5 ? 0.4 : 0.1;

      // Modificador por mentalidad (ataque cansa más)
      var mentalityFatigue = 1.0;
      if (player._team === 0) {  // equipo usuario
        var plan = (player._match || {}).tacticsPlan;
        if (plan && plan.mentality === "attacking") mentalityFatigue = 1.15;
        else if (plan && plan.mentality === "defensive") mentalityFatigue = 0.85;
      }

      player.fatigue = Math.min(100, baseFatigue + movementFatigue * mentalityFatigue * 8);
    });
  };

  // Aplicar efectos de fatiga
  TacticsApplier.prototype._applyFatigueEffects = function (match) {
    match.allPlayers().forEach(function (player) {
      if (!player._tacticsInitialized) return;

      var fatigueRatio = Math.min(1.0, player.fatigue / 100);

      // Fatiga afecta velocidad
      var baseSpeed = player._baseSpeed || 75;
      player.speed = baseSpeed * (1 - fatigueRatio * 0.35);  // hasta -35%

      // Fatiga afecta precisión
      player._passAccuracy = (player._basePassAccuracy || 0.82) * (1 - fatigueRatio * 0.25);
      player._shootAccuracy = (player._baseShootAccuracy || 0.65) * (1 - fatigueRatio * 0.30);
    });
  };

  // Aplicar efectos de moral
  TacticsApplier.prototype._applyMoralEffects = function (match) {
    match.userTeam.forEach(function (player) {
      if (!player._tacticsInitialized) return;

      // Moral afecta precisión
      var morale = player.morale || 70;
      var moralRatio = (morale - 35) / 65;  // normalizar a [-1, 1] aprox

      player._passAccuracy = (player._basePassAccuracy || 0.82) * (1 + moralRatio * 0.15);
      player._shootAccuracy = (player._baseShootAccuracy || 0.65) * (1 + moralRatio * 0.20);
    });
  };

  // Aplicar modificador de presión según mentalidad
  TacticsApplier.prototype._applyPressureModifier = function (match, gameState) {
    var plan = gameState.tactics.teamSettings[gameState.userTeamId];
    if (!plan) return;

    // Modificar presión según mentalidad y pressing
    var pressureLevel = 1.0;

    if (plan.mentality === "attacking") pressureLevel += 0.25;
    else if (plan.mentality === "defensive") pressureLevel -= 0.20;

    if (plan.pressing === "high") pressureLevel += 0.30;
    else if (plan.pressing === "low") pressureLevel -= 0.25;

    // Guardar para que TeamBrain lo use
    match._tacticsPressure = pressureLevel;
  };

  function getPositionFromSlot(slotIndex) {
    if (slotIndex === 0) return "POR";
    if (slotIndex <= 4) return "DEF";
    if (slotIndex <= 7) return "MED";
    if (slotIndex <= 9) return "EXT";
    return "DEL";
  }

  window.FMG.Phase24.TacticsApplier = TacticsApplier;
})();
