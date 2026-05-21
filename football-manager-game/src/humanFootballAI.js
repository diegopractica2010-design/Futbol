(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const DEFAULT_CONFIDENCE = 55;
  const DEFAULT_MENTAL_FATIGUE = 35;
  const PANIC_RECOVERY_PER_MINUTE = 10;
  const PANIC_WINDOW = 8;
  const EMOTIONAL_GOAL_SURGE = 20;
  const EMOTIONAL_SAVE_SURGE = 12;
  const EMOTIONAL_MISS_DROP = 15;

  function clamp(value, min, max) {
    return FMG.clamp ? FMG.clamp(value, min, max) : Math.max(min, Math.min(max, value));
  }

  function hash(value) {
    return FMG.hashText ? FMG.hashText(value) : String(value || "").split("").reduce((sum, ch) => ((sum * 33) + ch.charCodeAt(0)) >>> 0, 1);
  }

  function rng(seed) {
    return FMG.mulberry32 ? FMG.mulberry32(seed >>> 0) : function () { return 0.5; };
  }

  function sideForTeam(liveMatch, teamId) {
    if (!liveMatch || !teamId) return null;
    if (teamId === liveMatch.homeTeamId) return "home";
    if (teamId === liveMatch.awayTeamId) return "away";
    return null;
  }

  function opponentSide(side) {
    return side === "home" ? "away" : "home";
  }

  function getLineup(state, liveMatch, side) {
    const ids = side === "home" ? liveMatch.homeLineupIds : liveMatch.awayLineupIds;
    const set = new Set(ids || []);
    return (state.players || []).filter((player) => set.has(player.id));
  }

  function findPlayer(state, playerId) {
    return (state.players || []).find((player) => player.id === playerId) || null;
  }

  function teamScore(liveMatch, side) {
    return side === "home" ? liveMatch.result.homeGoals : liveMatch.result.awayGoals;
  }

  function ensurePlayerHumanState(player) {
    if (!player) return null;
    const variance = (hash(player.id) % 17) - 8;
    player.confidence = Number.isFinite(player.confidence) ? clamp(player.confidence, 0, 100) : clamp(DEFAULT_CONFIDENCE + variance, 0, 100);
    player.mental_fatigue = Number.isFinite(player.mental_fatigue) ? clamp(player.mental_fatigue, 0, 100) : DEFAULT_MENTAL_FATIGUE;
    return player;
  }

  function ensureHumanAIState(state) {
    state.humanAI = state.humanAI || {};
    state.humanAI.version = 1;
    state.humanAI.players = state.humanAI.players || {};
    state.humanAI.team = state.humanAI.team || {};
    state.humanAI.matches = state.humanAI.matches || {};
    (state.players || []).forEach((player) => {
      ensurePlayerHumanState(player);
      state.humanAI.players[player.id] = state.humanAI.players[player.id] || {};
      state.humanAI.players[player.id].confidence = player.confidence;
      state.humanAI.players[player.id].mental_fatigue = player.mental_fatigue;
    });
    return state.humanAI;
  }

  function rivalryForMatch(state, liveMatch) {
    const rivalries = FMG.Rivalries?.ensureRivalryState ? FMG.Rivalries.ensureRivalryState(state) : (state.rivalries || []);
    return (rivalries || []).find((item) =>
      (item.teamAId === liveMatch.homeTeamId && item.teamBId === liveMatch.awayTeamId) ||
      (item.teamAId === liveMatch.awayTeamId && item.teamBId === liveMatch.homeTeamId)
    ) || null;
  }

  function matchKey(liveMatch) {
    return [
      liveMatch.seed || 1,
      liveMatch.week || 1,
      liveMatch.homeTeamId,
      liveMatch.awayTeamId
    ].join("|");
  }

  function ensureMatchState(state, liveMatch) {
    const humanAI = ensureHumanAIState(state);
    const key = liveMatch ? matchKey(liveMatch) : "none";
    if (!humanAI.currentMatch || humanAI.currentMatch.key !== key) {
      const rivalry = liveMatch ? rivalryForMatch(state, liveMatch) : null;
      humanAI.currentMatch = {
        key,
        started: false,
        finalized: false,
        derby: Boolean(rivalry),
        rivalryId: rivalry?.id || null,
        rivalryMultiplier: rivalry ? 1.3 : 1,
        emotional: {
          home: { value: 0, until: 0 },
          away: { value: 0, until: 0 }
        },
        panic: {
          home: { level: 0, triggerMinute: null, reason: null, goalkeeperErrors: 0 },
          away: { level: 0, triggerMinute: null, reason: null, goalkeeperErrors: 0 }
        },
        performance: {},
        eventsSeen: 0,
        modifiers: {
          home: emptySideModifiers(),
          away: emptySideModifiers()
        }
      };
    }
    return humanAI.currentMatch;
  }

  function emptySideModifiers() {
    return {
      pressureBonus: 0,
      shotQualityMultiplier: 1,
      onTargetMultiplier: 1,
      foulMultiplier: 1,
      cornerBonus: 0,
      possessionShift: 0,
      strengthBonus: 0,
      savePenalty: 0,
      desperation: 0,
      panic: 0,
      positionError: 0,
      pressingIntensity: 1
    };
  }

  function averageHumanValue(players, field, fallback) {
    if (!players.length) return fallback;
    return players.reduce((sum, player) => sum + (Number(player[field]) || fallback), 0) / players.length;
  }

  function confidenceModifier(player) {
    ensurePlayerHumanState(player);
    if (player.confidence > 70) return { shot: 1.08, pressure: 0.018, target: 1.03, risk: 1 };
    if (player.confidence < 35) return { shot: 0.9, pressure: -0.025, target: 0.94, risk: -1 };
    return { shot: 1, pressure: 0, target: 1, risk: 0 };
  }

  function mentalModifier(player) {
    ensurePlayerHumanState(player);
    if (player.mental_fatigue > 70) return { strength: -1.5, decision: -0.03, positionError: 1.4 };
    if (player.mental_fatigue < 30) return { strength: 1.4, decision: 0.02, positionError: -0.4 };
    return { strength: 0, decision: 0, positionError: 0 };
  }

  function recordPerformance(matchState, playerId, delta) {
    if (!playerId) return;
    matchState.performance[playerId] = matchState.performance[playerId] || { goals: 0, shots: 0, onTarget: 0, cards: 0, injuries: 0, decisive: 0 };
    Object.keys(delta).forEach((key) => {
      matchState.performance[playerId][key] = (matchState.performance[playerId][key] || 0) + delta[key];
    });
  }

  function setPanic(matchState, side, minute, reason) {
    const current = matchState.panic[side];
    if (!current || current.level > 70 && current.triggerMinute === minute) return;
    matchState.panic[side] = {
      level: 80,
      triggerMinute: minute,
      reason,
      goalkeeperErrors: current?.goalkeeperErrors || 0
    };
  }

  function currentPanic(matchState, side, minute) {
    const panic = matchState.panic[side];
    if (!panic || panic.triggerMinute === null) return 0;
    const elapsed = Math.max(0, minute - panic.triggerMinute);
    if (elapsed > PANIC_WINDOW) {
      panic.level = 0;
      return 0;
    }
    panic.level = clamp(80 - elapsed * PANIC_RECOVERY_PER_MINUTE, 0, 80);
    return panic.level;
  }

  function emotionalValue(emotional, minute) {
    if (!emotional || minute > emotional.until) return 0;
    return clamp(emotional.value * (1 - Math.max(0, minute - (emotional.until - 6)) / 6), -30, 30);
  }

  function desperationFor(liveMatch, side, minute) {
    const deficit = teamScore(liveMatch, opponentSide(side)) - teamScore(liveMatch, side);
    if (deficit <= 0 || minute <= 65) return 0;
    const timePressure = clamp((minute - 65) / 25, 0, 1);
    return clamp((deficit / 3) * timePressure, 0, 1);
  }

  function teamLosingByTwo(liveMatch, side, minute) {
    return minute > 60 && teamScore(liveMatch, opponentSide(side)) - teamScore(liveMatch, side) >= 2;
  }

  function pressureMatchFactor(state, matchState) {
    const recent = (state.seasonLog || []).filter((entry) => entry.result).slice(0, 4);
    const losingStreak = recent.filter((entry) => entry.result === "derrota").length;
    return (matchState.derby ? 9 : 0) + losingStreak * 4;
  }

  function applyPreMatchModifiers(state) {
    const liveMatch = state.liveMatch;
    const humanAI = ensureHumanAIState(state);
    if (!liveMatch) return humanAI;
    const matchState = ensureMatchState(state, liveMatch);
    if (matchState.started) return humanAI;
    matchState.started = true;

    ["home", "away"].forEach((side) => {
      getLineup(state, liveMatch, side).forEach((player) => {
        ensurePlayerHumanState(player);
        if (matchState.derby) player.confidence = clamp(player.confidence + 8, 0, 100);
        state.humanAI.players[player.id].confidence = player.confidence;
        state.humanAI.players[player.id].mental_fatigue = player.mental_fatigue;
      });
    });
    liveMatch.humanAI = liveMatch.humanAI || {};
    liveMatch.humanAI.derby = matchState.derby;
    liveMatch.humanAI.emotionalMomentum = { home: 0, away: 0, gap: 0 };
    return humanAI;
  }

  function applyMinuteModifiers(state, context) {
    const liveMatch = context.liveMatch;
    const minute = context.minute;
    const matchState = ensureMatchState(state, liveMatch);
    const modifiers = { home: emptySideModifiers(), away: emptySideModifiers() };
    const matchSeed = Number(liveMatch.seed) || 1;

    ["home", "away"].forEach((side) => {
      const players = getLineup(state, liveMatch, side);
      const avgConfidence = averageHumanValue(players, "confidence", DEFAULT_CONFIDENCE);
      const avgMental = averageHumanValue(players, "mental_fatigue", DEFAULT_MENTAL_FATIGUE);
      const panicLevel = currentPanic(matchState, side, minute);
      const desperation = desperationFor(liveMatch, side, minute);
      const emotional = emotionalValue(matchState.emotional[side], minute);
      const opponentEmotional = emotionalValue(matchState.emotional[opponentSide(side)], minute);
      const sideRng = rng((matchSeed + minute + hash(side)) >>> 0);
      const mentalDecisionDrag = avgMental > 70 ? 0.035 + sideRng() * 0.02 : avgMental < 30 ? -0.02 : 0;

      if (teamLosingByTwo(liveMatch, side, minute)) setPanic(matchState, side, minute, "scoreline");

      modifiers[side].shotQualityMultiplier *= avgConfidence > 70 ? 1.04 : avgConfidence < 35 ? 0.95 : 1;
      modifiers[side].onTargetMultiplier *= avgMental < 30 ? 1.05 : avgMental > 70 ? 0.94 : 1;
      modifiers[side].pressureBonus += avgConfidence > 70 ? 0.012 : avgConfidence < 35 ? -0.014 : 0;
      modifiers[side].pressureBonus += emotional * 0.0018 - opponentEmotional * 0.001;
      modifiers[side].strengthBonus += (avgConfidence - 55) * 0.035 - Math.max(0, avgMental - 55) * 0.035;
      modifiers[side].positionError += avgMental > 70 ? 1.2 : avgMental < 30 ? -0.4 : 0;
      modifiers[side].pressureBonus -= mentalDecisionDrag;

      if (matchState.derby) {
        modifiers[side].pressureBonus += 0.018;
        modifiers[side].foulMultiplier *= 1.18;
      }

      if (desperation > 0) {
        modifiers[side].desperation = desperation;
        modifiers[side].pressureBonus += 0.25 * desperation;
        modifiers[side].shotQualityMultiplier *= 1 - 0.15 * desperation;
        modifiers[side].onTargetMultiplier *= 1 - 0.1 * desperation;
        modifiers[side].positionError += 1.8 * desperation;
        modifiers[side].possessionShift += (side === "home" ? 1 : -1) * 3.5 * desperation;
      }

      if (panicLevel > 0) {
        modifiers[side].panic = panicLevel;
        modifiers[side].cornerBonus += 0.15 * (panicLevel / 80);
        modifiers[side].positionError += 1.2 * (panicLevel / 80);
        modifiers[side].savePenalty = 0.1 * (panicLevel / 80);
      }
    });

    const emotionalHome = emotionalValue(matchState.emotional.home, minute);
    const emotionalAway = emotionalValue(matchState.emotional.away, minute);
    const emotionalGap = emotionalHome - emotionalAway;
    liveMatch.emotional_momentum = {
      home: Math.round(emotionalHome),
      away: Math.round(emotionalAway),
      gap: Math.round(Math.abs(emotionalGap))
    };
    if (Math.abs(emotionalGap) > 0) liveMatch.momentum = clamp(liveMatch.momentum + emotionalGap * 0.03, 0, 100);

    const momentumGap = Math.abs((Number(liveMatch.momentum) || 50) - 50) * 2;
    if (momentumGap > 40) {
      const losingSide = liveMatch.momentum >= 50 ? "away" : "home";
      modifiers[losingSide].desperation = Math.max(modifiers[losingSide].desperation, 0.35);
      modifiers[losingSide].pressureBonus += 0.05;
    }
    if (momentumGap > 60) {
      const winningSide = liveMatch.momentum >= 50 ? "home" : "away";
      modifiers[winningSide].pressingIntensity *= 0.95;
      modifiers[winningSide].pressureBonus -= (1 - modifiers[winningSide].pressingIntensity) * 0.4;
    }

    ["home", "away"].forEach(function (side) {
      if (modifiers[side].pressingIntensity < 1) {
        const intensityDrop = modifiers[side].pressingIntensity - 1;
        modifiers[side].pressureBonus += intensityDrop * 0.12;
        modifiers[side].shotQualityMultiplier *= (1 + intensityDrop * 0.06);
      }
    });

    matchState.modifiers = modifiers;
    liveMatch.humanAI = liveMatch.humanAI || {};
    liveMatch.humanAI.modifiers = modifiers;
    liveMatch.humanAI.desperation = {
      home: modifiers.home.desperation,
      away: modifiers.away.desperation
    };
    liveMatch.humanAI.positionError = {
      home: modifiers.home.positionError,
      away: modifiers.away.positionError
    };
    liveMatch.humanAI.panic = {
      home: modifiers.home.panic,
      away: modifiers.away.panic
    };
    return modifiers;
  }

  function applyPostEventModifiers(state, event) {
    const liveMatch = state.liveMatch;
    if (!liveMatch || !event) return;
    const matchState = ensureMatchState(state, liveMatch);
    const minute = Number(event.minute) || liveMatch.minute || 0;
    const side = sideForTeam(liveMatch, event.teamId);
    if (!side) return;
    const multiplier = matchState.rivalryMultiplier || 1;
    const player = findPlayer(state, event.playerId);

    if (event.type === "goal") {
      matchState.emotional[side] = { value: EMOTIONAL_GOAL_SURGE * multiplier, until: minute + 6 };
      recordPerformance(matchState, event.playerId, { goals: 1, shots: 1, onTarget: 1, decisive: 2 });
      const defendingSide = opponentSide(side);
      if (Number(event.xg) < 0.13) {
        matchState.panic[defendingSide].goalkeeperErrors += 1;
        if (matchState.panic[defendingSide].goalkeeperErrors >= 2) setPanic(matchState, defendingSide, minute, "goalkeeper-errors");
      }
    } else if (event.type === "shot-on-target") {
      matchState.emotional[opponentSide(side)] = { value: EMOTIONAL_SAVE_SURGE * multiplier, until: minute + 4 };
      recordPerformance(matchState, event.playerId, { shots: 1, onTarget: 1 });
    } else if (event.type === "shot") {
      if (Number(event.xg) > 0.28) matchState.emotional[side] = { value: -EMOTIONAL_MISS_DROP * multiplier, until: minute + 4 };
      recordPerformance(matchState, event.playerId, { shots: 1 });
    } else if (event.type === "yellow-card" || event.type === "red-card") {
      recordPerformance(matchState, event.playerId, { cards: event.type === "red-card" ? 2 : 1 });
    } else if (event.type === "injury") {
      recordPerformance(matchState, event.playerId, { injuries: 1 });
      if (player && player.overall > 75) setPanic(matchState, side, minute, "star-injury");
      if (player) player.mental_fatigue = clamp((player.mental_fatigue || DEFAULT_MENTAL_FATIGUE) + 10, 0, 100);
    }
  }

  function applyPostMatchModifiers(state) {
    const liveMatch = state.liveMatch;
    if (!liveMatch) return;
    const matchState = ensureMatchState(state, liveMatch);
    if (matchState.finalized) return;
    matchState.finalized = true;
    const pressure = pressureMatchFactor(state, matchState);

    ["home", "away"].forEach((side) => {
      const players = getLineup(state, liveMatch, side);
      const won = teamScore(liveMatch, side) > teamScore(liveMatch, opponentSide(side));
      const lost = teamScore(liveMatch, side) < teamScore(liveMatch, opponentSide(side));
      players.forEach((player) => {
        ensurePlayerHumanState(player);
        const perf = matchState.performance[player.id] || {};
        const personality = ((hash(player.id + ":personality") % 11) - 5) / 10;
        let confidenceDelta = won ? 4 : lost ? -4 : 1;
        confidenceDelta += (perf.goals || 0) * 8 + (perf.onTarget || 0) * 1.2 - (perf.cards || 0) * 2.5 - (perf.injuries || 0) * 3;
        confidenceDelta += personality;
        player.confidence = clamp(player.confidence + confidenceDelta, 0, 100);

        let mentalDelta = pressure + (lost ? 4 : 0) + (perf.cards || 0) * 2 + (perf.injuries || 0) * 8;
        if (player.injuryWeeks && player.injuryWeeks > 0) mentalDelta += 8;
        if (won && player.confidence > 65) mentalDelta -= 3;
        player.mental_fatigue = clamp(player.mental_fatigue + mentalDelta, 0, 100);

        state.humanAI.players[player.id] = state.humanAI.players[player.id] || {};
        state.humanAI.players[player.id].confidence = player.confidence;
        state.humanAI.players[player.id].mental_fatigue = player.mental_fatigue;
      });
    });
  }

  function applyRestWeekRecovery(state) {
    ensureHumanAIState(state);
    (state.players || []).forEach((player) => {
      ensurePlayerHumanState(player);
      const active = !player.injuryWeeks || player.injuryWeeks <= 0;
      player.mental_fatigue = clamp(player.mental_fatigue - (active ? 20 : 8), 0, 100);
      state.humanAI.players[player.id] = state.humanAI.players[player.id] || {};
      state.humanAI.players[player.id].mental_fatigue = player.mental_fatigue;
      state.humanAI.players[player.id].confidence = player.confidence;
    });
  }

  function sideStrengthBonus(state, teamId) {
    const liveMatch = state?.liveMatch;
    if (!liveMatch) return 0;
    const side = sideForTeam(liveMatch, teamId);
    if (!side) return 0;
    const matchState = ensureMatchState(state, liveMatch);
    const players = getLineup(state, liveMatch, side);
    const confidence = averageHumanValue(players, "confidence", DEFAULT_CONFIDENCE);
    const mental = averageHumanValue(players, "mental_fatigue", DEFAULT_MENTAL_FATIGUE);
    let bonus = (confidence - 55) * 0.035 - Math.max(0, mental - 55) * 0.035;
    if (matchState.derby && side === "home") bonus += 1.8;
    return bonus;
  }

  const previousComputeTeamStrength = FMG.computeTeamStrength;
  if (typeof previousComputeTeamStrength === "function" && !previousComputeTeamStrength._humanAIWrapped) {
    const wrapped = function (team, players, state) {
      const base = previousComputeTeamStrength(team, players, state);
      return base + (state ? sideStrengthBonus(state, team.id) : 0);
    };
    wrapped._humanAIWrapped = true;
    FMG.computeTeamStrength = wrapped;
  }

  FMG.humanFootballAI = {
    ensureHumanAIState,
    applyPreMatchModifiers,
    applyMinuteModifiers,
    applyPostEventModifiers,
    applyPostMatchModifiers,
    applyRestWeekRecovery,
    confidenceModifier,
    mentalModifier
  };
})();
