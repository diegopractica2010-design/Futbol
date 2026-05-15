(function () {
  "use strict";

  window.FMG = window.FMG || {};
  window.FMG.Phase24 = window.FMG.Phase24 || {};

  function TacticsApplier() {
    this.matchStarted = false;
    this.matchTick = 0;
    this.attributeModifier = null;
  }

  TacticsApplier.prototype.applyInitialTactics = function (match, gameState) {
    if (!match || !gameState || !gameState.tactics) return;

    var userPlan = getTeamPlan(gameState, gameState.userTeamId);
    var rivalTeamId = getRivalTeamId(gameState);
    var aiPlan = getTeamPlan(gameState, rivalTeamId);
    if (!userPlan) return;

    match.tacticsPlan = userPlan;
    match.userTacticsPlan = userPlan;
    match.aiTacticsPlan = aiPlan;
    this.attributeModifier = this.attributeModifier || new window.FMG.Phase24.AttributeModifier();

    hydrateMatchTeam(match.userTeam, getMatchSquad(gameState, gameState.userTeamId), userPlan, match, 0);
    hydrateMatchTeam(match.aiTeam, getMatchSquad(gameState, rivalTeamId), aiPlan, match, 1);

    match.userTeam.forEach(function (player, index) {
      ensurePlayerStats(player, index, userPlan, match);
    });
    match.aiTeam.forEach(function (player, index) {
      ensurePlayerStats(player, index, aiPlan, match);
    });

    this._applyPressureModifier(match, gameState);
    this._applyAttributeEffects(match);
    this.matchStarted = true;
  };

  TacticsApplier.prototype.tick = function (match, gameState, tickNumber) {
    if (!this.matchStarted || !match || !gameState) return;

    this.matchTick = tickNumber;
    if (tickNumber % 60 === 0) this._updatePlayerFatigue(match, tickNumber);

    this._applyPressureModifier(match, gameState);
    this._applyAttributeEffects(match);
  };

  TacticsApplier.prototype._updatePlayerFatigue = function (match, tickNumber) {
    var matchSeconds = tickNumber / 60;
    var C = window.FMG.Phase16 && window.FMG.Phase16.C;
    var matchProgress = Math.min(1.0, matchSeconds / ((C && C.MATCH_SECS) || 180));

    match.allPlayers().forEach(function (player) {
      if (!player._tacticsInitialized) return;

      var baseFatigue = matchProgress * 60;
      var speed = Math.hypot(player.vx || 0, player.vy || 0);
      var movementFatigue = speed > 3 ? 0.8 : speed > 1.5 ? 0.4 : 0.1;
      var plan = player.team === 0 ? match.userTacticsPlan : match.aiTacticsPlan;
      var tacticFatigue = 1.0;

      if (plan && plan.mentality === "attacking") tacticFatigue += 0.15;
      else if (plan && plan.mentality === "defensive") tacticFatigue -= 0.12;
      if (plan && plan.pressing === "high") tacticFatigue += 0.12;
      else if (plan && plan.pressing === "low") tacticFatigue -= 0.08;
      if (plan && plan.tempo === "fast") tacticFatigue += 0.08;

      var startingFatigue = Math.max(0, 100 - (Number.isFinite(player.energy) ? player.energy : 88)) * 0.25;
      player.fatigue = Math.min(100, startingFatigue + baseFatigue + movementFatigue * tacticFatigue * 8);
    });
  };

  TacticsApplier.prototype._applyAttributeEffects = function (match) {
    var modifier = this.attributeModifier || new window.FMG.Phase24.AttributeModifier();
    match.allPlayers().forEach(function (player) {
      if (!player._tacticsInitialized) return;

      var pressure = player.team === 0 ? match._userTacticsPressure : match._aiTacticsPressure;
      player._passAccuracy = modifier.getPassAccuracy(player);
      player._shootAccuracy = modifier.getShootAccuracy(player);
      player._controlAccuracy = modifier.getControlAccuracy(player);
      player._speedModifier = modifier.getEffectiveSpeed(player);
      player._aggressionModifier = modifier.getAggressionModifier(player, player._tacticRole);
      player._pressRadiusModifier = modifier.getModifiedPressRadius(1.0, player, pressure);
      player._markRadiusModifier = modifier.getMarkRadiusModifier(player);
      player._shootDistanceModifier = modifier.getShootDistanceModifier(player);
      player._riskModifier = modifier.getRiskTakingModifier(player);
      player.speed = (player._baseSpeed || 75) * player._speedModifier;
    });
  };

  TacticsApplier.prototype._applyPressureModifier = function (match, gameState) {
    match._userTacticsPressure = pressureForPlan(getTeamPlan(gameState, gameState.userTeamId));
    match._aiTacticsPressure = pressureForPlan(getTeamPlan(gameState, getRivalTeamId(gameState)));
    match._tacticsPressure = match._userTacticsPressure;
  };

  function ensurePlayerStats(player, slotIndex, plan, match) {
    var attrs = player.attributes || {};
    player._baseSpeed = attrs.speed || player.speed || 75;
    player._baseShootAccuracy = 0.65;
    player._basePassAccuracy = 0.82;
    player._baseControl = 0.7;
    player.fatigue = Math.max(0, 100 - (Number.isFinite(player.energy) ? player.energy : 88)) * 0.25;
    player.injuryReduction = (player.injuredWeeks || player.injury) ? 0.72 : 1.0;
    player._match = match;
    player._slotPosition = player.position || getPositionFromSlot(slotIndex, plan);

    if (plan && plan.playerRoles) {
      player._tacticRole = plan.playerRoles[player._slotPosition] || "balanced";
    } else {
      player._tacticRole = "balanced";
    }

    var instructionKey = player.realPlayerId || player.id;
    player._instruction = plan && plan.instructions
      ? plan.instructions[instructionKey] || plan.instructions[player.id] || "none"
      : "none";
    player._roleBehavior = window.FMG.getRoleBehavior
      ? window.FMG.getRoleBehavior(player._tacticRole, player._instruction)
      : {};
    player._tacticsInitialized = true;
  }

  function hydrateMatchTeam(matchPlayers, squad, plan, match, teamIndex) {
    var slots = plan && window.FMG.FORMATIONS ? window.FMG.FORMATIONS[plan.formation] : null;
    matchPlayers.forEach(function (matchPlayer, index) {
      var source = squad[index] || {};
      matchPlayer.realPlayerId = source.id || matchPlayer.realPlayerId || matchPlayer.id;
      matchPlayer.displayName = source.name || matchPlayer.displayName || matchPlayer.id;
      matchPlayer.position = source.position || (slots && slots[index]) || getPositionFromSlot(index, plan);
      matchPlayer.overall = source.overall || matchPlayer.overall || 70;
      matchPlayer.morale = Number.isFinite(source.morale) ? source.morale : matchPlayer.morale || 70;
      matchPlayer.energy = Number.isFinite(source.energy) ? source.energy : matchPlayer.energy || 88;
      matchPlayer.attributes = Object.assign({}, source.attributes || matchPlayer.attributes || {});
      matchPlayer.injuredWeeks = source.injuredWeeks || 0;
      matchPlayer.team = teamIndex;
      matchPlayer._match = match;
    });
  }

  function pressureForPlan(plan) {
    var pressureLevel = 1.0;
    if (!plan) return pressureLevel;

    if (plan.mentality === "attacking") pressureLevel += 0.25;
    else if (plan.mentality === "defensive") pressureLevel -= 0.20;
    if (plan.pressing === "high") pressureLevel += 0.30;
    else if (plan.pressing === "low") pressureLevel -= 0.25;

    return Math.max(0.55, Math.min(1.75, pressureLevel));
  }

  function getPositionFromSlot(slotIndex, plan) {
    if (plan && window.FMG.FORMATIONS && window.FMG.FORMATIONS[plan.formation]) {
      return window.FMG.FORMATIONS[plan.formation][slotIndex] || "DEL";
    }
    if (slotIndex === 0) return "POR";
    if (slotIndex <= 4) return "DEF";
    if (slotIndex <= 7) return "MED";
    if (slotIndex <= 9) return "EXT";
    return "DEL";
  }

  function getTeamPlan(gameState, teamId) {
    if (!gameState || !teamId) return null;
    if (window.FMG.getTeamPlan) return window.FMG.getTeamPlan(gameState, teamId);
    return gameState.tactics && gameState.tactics.teamSettings
      ? gameState.tactics.teamSettings[teamId]
      : null;
  }

  function getMatchSquad(gameState, teamId) {
    if (!gameState || !teamId) return [];
    if (window.FMG.getMatchSquad) return window.FMG.getMatchSquad(gameState, teamId);
    return (gameState.players || []).filter(function (player) { return player.teamId === teamId; }).slice(0, 11);
  }

  function getRivalTeamId(gameState) {
    if (!gameState) return null;
    var userTeamId = gameState.userTeamId;
    var match = gameState.currentMatch || gameState.liveMatch;
    if (match) {
      if (match.homeTeamId === userTeamId) return match.awayTeamId;
      if (match.awayTeamId === userTeamId) return match.homeTeamId;
      if (match.home && match.home.id !== userTeamId) return match.home.id;
      if (match.away && match.away.id !== userTeamId) return match.away.id;
    }
    var fixture = (gameState.fixtures || []).find(function (item) {
      return item.week === gameState.currentWeek &&
        (item.homeTeamId === userTeamId || item.awayTeamId === userTeamId);
    });
    if (fixture) return fixture.homeTeamId === userTeamId ? fixture.awayTeamId : fixture.homeTeamId;
    var rival = (gameState.teams || []).find(function (team) { return team.id !== userTeamId; });
    return rival ? rival.id : null;
  }

  window.FMG.Phase24.TacticsApplier = TacticsApplier;
})();
