(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Services = FMG.Core.Services || {};

  /**
   * Deterministic Match Simulator
   * Single source of truth for all match simulations
   * Same seed + input = same output (always)
   */
  function MatchSimulator(config) {
    config = config || {};
    this.config = config;
  }

  /**
   * Run deterministic match simulation
   * @param homeTeam: {id, name, form, ...}
   * @param awayTeam: {id, name, form, ...}
   * @param homeSquad: Player[]
   * @param awaySquad: Player[]
   * @param seed: deterministic seed
   * @returns: MatchResult {homeGoals, awayGoals, events, stats, seed}
   */
  MatchSimulator.prototype.run = function (homeTeam, awayTeam, homeSquad, awaySquad, seed) {
    if (!FMG.Core.Utils || !FMG.Core.Utils.RNG) {
      throw new Error("RNG not loaded. Ensure FMG.Core.Utils.RNG is included.");
    }

    const RNG = FMG.Core.Utils.RNG;
    const rng = new RNG(seed);

    // Calculate team strengths (deterministic from squad attributes)
    const homeStrength = this._calculateStrength(homeSquad) + (homeTeam.form || 10);
    const awayStrength = this._calculateStrength(awaySquad) + (awayTeam.form || 10);

    // Simulate possession
    const possessionDelta = (homeStrength - awayStrength) / 100;
    const basePossession = 50 + possessionDelta * 20;
    const homePossession = Math.max(30, Math.min(70, Math.round(basePossession + rng.nextInt(-5, 5))));
    const awayPossession = 100 - homePossession;

    // Simulate match events
    const matchDuration = 90;
    let homeGoals = 0;
    let awayGoals = 0;
    const events = [];
    const homeStats = this._emptyStats();
    const awayStats = this._emptyStats();

    for (let minute = 1; minute <= matchDuration; minute++) {
      const isHomeAttack = rng.next() * 100 < homePossession;
      const attackTeam = isHomeAttack ? homeTeam : awayTeam;
      const defendTeam = isHomeAttack ? awayTeam : homeTeam;
      const attackSquad = isHomeAttack ? homeSquad : awaySquad;
      const defendSquad = isHomeAttack ? awaySquad : homeSquad;
      const attackStrength = isHomeAttack ? homeStrength : awayStrength;
      const defendStrength = isHomeAttack ? awayStrength : homeStrength;
      const stats = isHomeAttack ? homeStats : awayStats;

      // Simulate shot chance
      const shotChance = this._calculateShotChance(attackStrength, defendStrength, rng);
      if (rng.next() < shotChance) {
        stats.shots++;
        const onTarget = rng.next() < 0.6; // 60% of shots on target
        if (onTarget) {
          stats.shotsOnTarget++;
          const goalChance = this._calculateGoalChance(
            attackStrength,
            defendStrength,
            rng
          );
          if (rng.next() < goalChance) {
            if (isHomeAttack) {
              homeGoals++;
            } else {
              awayGoals++;
            }
            events.push({
              minute,
              type: "goal",
              team: isHomeAttack ? "home" : "away",
              playerName: this._pickPlayer(attackSquad, rng).name
            });
          }
        }
      }

      // Simulate fouls/cards (rare)
      if (rng.next() < 0.02) {
        const isRed = rng.next() < 0.1;
        stats.yellowCards += isRed ? 0 : 1;
        stats.redCards += isRed ? 1 : 0;
        events.push({
          minute,
          type: isRed ? "redCard" : "yellowCard",
          team: rng.next() < 0.5 ? "home" : "away",
          playerName: this._pickPlayer(rng.next() < 0.5 ? homeSquad : awaySquad, rng).name
        });
      }

      // Simulate injury (very rare)
      if (rng.next() < 0.005) {
        events.push({
          minute,
          type: "injury",
          team: rng.next() < 0.5 ? "home" : "away",
          playerName: this._pickPlayer(rng.next() < 0.5 ? homeSquad : awaySquad, rng).name
        });
      }
    }

    homeStats.possession = homePossession;
    awayStats.possession = awayPossession;
    homeStats.xg = this._calculateXG(homeStats);
    awayStats.xg = this._calculateXG(awayStats);

    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      homeGoals,
      awayGoals,
      events,
      stats: { home: homeStats, away: awayStats },
      seed,
      timestamp: FMG.Core.Utils.Determinism.timestampForTick(seed || 0),
      summary: this._createSummary(homeTeam, awayTeam, homeGoals, awayGoals)
    };
  };

  MatchSimulator.prototype._calculateStrength = function (squad) {
    if (!squad || squad.length === 0) return 50;
    const starters = squad.slice(0, 11);
    const overallSum = starters.reduce((sum, p) => sum + (p.overall || 70), 0);
    const morale = starters.reduce((sum, p) => sum + (p.morale || 70), 0);
    const energy = starters.reduce((sum, p) => sum + (p.energy || 80), 0);
    return (overallSum / starters.length) * 0.7 + (morale / starters.length) * 0.15 + (energy / starters.length) * 0.15;
  };

  MatchSimulator.prototype._calculateShotChance = function (attackStrength, defendStrength, rng) {
    const delta = (attackStrength - defendStrength) / 50;
    return Math.max(0.01, Math.min(0.15, 0.08 + delta * 0.02 + rng.nextFloat(-0.02, 0.02)));
  };

  MatchSimulator.prototype._calculateGoalChance = function (attackStrength, defendStrength, rng) {
    const delta = (attackStrength - defendStrength) / 100;
    return Math.max(0.05, Math.min(0.3, 0.15 + delta * 0.1 + rng.nextFloat(-0.05, 0.05)));
  };

  MatchSimulator.prototype._calculateXG = function (stats) {
    return Math.max(0, stats.shotsOnTarget * 0.08 + (stats.shots - stats.shotsOnTarget) * 0.02);
  };

  MatchSimulator.prototype._emptyStats = function () {
    return {
      possession: 50,
      shots: 0,
      shotsOnTarget: 0,
      xg: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      corners: 0
    };
  };

  MatchSimulator.prototype._pickPlayer = function (squad, rng) {
    if (!squad || squad.length === 0) return { name: "Unknown" };
    return (rng || new FMG.Core.Utils.RNG(0)).choice(squad);
  };

  MatchSimulator.prototype._createSummary = function (homeTeam, awayTeam, homeGoals, awayGoals) {
    const winner = homeGoals > awayGoals ? homeTeam.name : awayGoals > homeGoals ? awayTeam.name : null;
    if (!winner) {
      return `${homeTeam.name} drew ${awayGoals}-${homeGoals} with ${awayTeam.name}.`;
    }
    return `${winner} defeated their opponent ${Math.max(homeGoals, awayGoals)}-${Math.min(homeGoals, awayGoals)}.`;
  };

  FMG.Core.Services.MatchSimulator = MatchSimulator;
})();
