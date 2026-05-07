(function () {
  "use strict";

  // ============================================================
  // FASE 24 — index.js
  // Tácticas en Cancha: conecta manager con partido en vivo.
  // Integra tácticas, atributos, fatiga, moral, lesiones.
  // Base: Phase 23 (Audio) + Phase 22 (HUD) + Phase 18 (IA)
  // ============================================================

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  var C = null;

  window.FMG.Phase24.createGame = function (canvas, gameState) {
    C = window.FMG.Phase16.C;

    // Crear juego base con audio (Phase 23)
    var game = window.FMG.Phase23.createGame(canvas);

    // Crear sistemas de tácticas
    var tacticsApplier = new window.FMG.Phase24.TacticsApplier();
    var attributeModifier = new window.FMG.Phase24.AttributeModifier();

    game.tacticsApplier = tacticsApplier;
    game.attributeModifier = attributeModifier;

    // Guardar gameState en el juego para acceso a tácticas
    game._gameState = gameState;

    // ---- Parchar IA para usar TacticsApplier ----

    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var match = game.match;
      var tick = game._tick || 0;

      // Inicializar tácticas en el primer tick
      if (tick === 0) {
        tacticsApplier.applyInitialTactics(match, gameState);
      }

      // Aplicar tácticas antes de la lógica de IA
      tacticsApplier.tick(match, gameState, tick);

      // Ejecutar lógica original (IA, física, etc.)
      origLogic();

      game._tick = (tick + 1) % 3600;  // resetear cada minuto
    };

    // ---- Parchar decisiones de IA para usar atributos ----

    if (game.matchAI && game.matchAI._userBrain) {
      var origUserTick = game.matchAI._userBrain.tick.bind(game.matchAI._userBrain);
      game.matchAI._userBrain.tick = function (players, rivals, ball, match, tick) {
        // Aplicar modificadores de atributos antes de decisiones
        players.forEach(function (player) {
          applyAttributeModifiers(player, attributeModifier, match);
        });
        origUserTick(players, rivals, ball, match, tick);
      };

      var origAITick = game.matchAI._aiBrain.tick.bind(game.matchAI._aiBrain);
      game.matchAI._aiBrain.tick = function (players, rivals, ball, match, tick) {
        players.forEach(function (player) {
          applyAttributeModifiers(player, attributeModifier, match);
        });
        origAITick(players, rivals, ball, match, tick);
      };
    }

    // ---- Parchar reset ----

    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      tacticsApplier = new window.FMG.Phase24.TacticsApplier();
      if (gameState) tacticsApplier.applyInitialTactics(game.match, gameState);
    };

    // ---- Parchar dispose ----

    var origDispose = game.dispose.bind(game);
    game.dispose = function () {
      tacticsApplier = null;
      attributeModifier = null;
      origDispose();
    };

    return game;
  };

  // Aplicar modificadores de atributo a un jugador
  function applyAttributeModifiers(player, attributeModifier, match) {
    if (!attributeModifier) return;

    // Guardar modificadores calculados
    player._passAccuracy = attributeModifier.getPassAccuracy(player);
    player._shootAccuracy = attributeModifier.getShootAccuracy(player);
    player._controlAccuracy = attributeModifier.getControlAccuracy(player);
    player._speedModifier = attributeModifier.getEffectiveSpeed(player);
    player._aggressionModifier = attributeModifier.getAggressionModifier(player, player._tacticRole);
    player._pressRadiusModifier = attributeModifier.getModifiedPressRadius(1.0, player, match._tacticsPressure);
    player._riskModifier = attributeModifier.getRiskTakingModifier(player);

    // Aplicar modificador de velocidad al jugador
    if (player._speedModifier && player._baseSpeed) {
      player.speed = player._baseSpeed * player._speedModifier;
    }
  }

  window.FMG.Phase24.AttributeModifier = window.FMG.Phase24.AttributeModifier || function () {};
  window.FMG.Phase24.TacticsApplier = window.FMG.Phase24.TacticsApplier || function () {};
})();
