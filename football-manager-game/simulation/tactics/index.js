(function () {
  "use strict";

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  window.FMG.Phase24.createGame = function (canvas, gameState) {
    var game = window.FMG.Phase23.createGame(canvas);
    var tacticsApplier = new window.FMG.Phase24.TacticsApplier();
    var attributeModifier = new window.FMG.Phase24.AttributeModifier();

    game.tacticsApplier = tacticsApplier;
    game.attributeModifier = attributeModifier;
    game._gameState = gameState;

    applyBrainPlans(game, gameState);

    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var match = game.match;
      var tick = match ? match.tickCount || 0 : 0;

      if (!tacticsApplier.matchStarted) {
        tacticsApplier.applyInitialTactics(match, gameState);
        applyBrainPlans(game, gameState);
      }

      tacticsApplier.tick(match, gameState, tick);
      origLogic();
    };

    if (game.matchAI && game.matchAI._userBrain) {
      var origUserTick = game.matchAI._userBrain.tick.bind(game.matchAI._userBrain);
      game.matchAI._userBrain.tick = function (players, rivals, ball, match, tick) {
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

    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      tacticsApplier = new window.FMG.Phase24.TacticsApplier();
      game.tacticsApplier = tacticsApplier;
      applyBrainPlans(game, gameState);
      if (gameState) tacticsApplier.applyInitialTactics(game.match, gameState);
    };

    var origDispose = game.dispose.bind(game);
    game.dispose = function () {
      tacticsApplier = null;
      attributeModifier = null;
      origDispose();
    };

    return game;
  };

  function applyAttributeModifiers(player, attributeModifier, match) {
    if (!attributeModifier || !player) return;
    var pressure = player.team === 0 ? match._userTacticsPressure : match._aiTacticsPressure;

    player._passAccuracy = attributeModifier.getPassAccuracy(player);
    player._shootAccuracy = attributeModifier.getShootAccuracy(player);
    player._controlAccuracy = attributeModifier.getControlAccuracy(player);
    player._speedModifier = attributeModifier.getEffectiveSpeed(player);
    player._aggressionModifier = attributeModifier.getAggressionModifier(player, player._tacticRole);
    player._pressRadiusModifier = attributeModifier.getModifiedPressRadius(1.0, player, pressure);
    player._markRadiusModifier = attributeModifier.getMarkRadiusModifier(player);
    player._shootDistanceModifier = attributeModifier.getShootDistanceModifier(player);
    player._riskModifier = attributeModifier.getRiskTakingModifier(player);

    if (player._speedModifier && player._baseSpeed) {
      player.speed = player._baseSpeed * player._speedModifier;
    }
  }

  function applyBrainPlans(game, gameState) {
    if (!game || !game.matchAI || !gameState) return;
    var userPlan = getTeamPlan(gameState, gameState.userTeamId);
    var aiPlan = getTeamPlan(gameState, getRivalTeamId(gameState));
    if (game.matchAI._userBrain && game.matchAI._userBrain.setTacticsPlan) {
      game.matchAI._userBrain.setTacticsPlan(userPlan);
    }
    if (game.matchAI._aiBrain && game.matchAI._aiBrain.setTacticsPlan) {
      game.matchAI._aiBrain.setTacticsPlan(aiPlan);
    }
  }

  function getTeamPlan(gameState, teamId) {
    if (!gameState || !teamId) return null;
    if (window.FMG.getTeamPlan) return window.FMG.getTeamPlan(gameState, teamId);
    return gameState.tactics && gameState.tactics.teamSettings
      ? gameState.tactics.teamSettings[teamId]
      : null;
  }

  function getRivalTeamId(gameState) {
    if (!gameState) return null;
    var userTeamId = gameState.userTeamId;
    var match = gameState.currentMatch || gameState.liveMatch;
    if (match) {
      if (match.homeTeamId === userTeamId) return match.awayTeamId;
      if (match.awayTeamId === userTeamId) return match.homeTeamId;
    }
    var fixture = (gameState.fixtures || []).find(function (item) {
      return item.week === gameState.currentWeek &&
        (item.homeTeamId === userTeamId || item.awayTeamId === userTeamId);
    });
    if (fixture) return fixture.homeTeamId === userTeamId ? fixture.awayTeamId : fixture.homeTeamId;
    var rival = (gameState.teams || []).find(function (team) { return team.id !== userTeamId; });
    return rival ? rival.id : null;
  }
  window.FMG._loadedPhases = window.FMG._loadedPhases || [];
  window.FMG._loadedPhases.push(24);
})();
