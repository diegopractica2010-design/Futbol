(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Match = FMG.Core.Domain.Match || {};

  /**
   * MatchRecord Entity
   * Represents immutable match result and events
   * Part of Season aggregate
   */
  function MatchRecord(config) {
    config = config || {};

    this.id = config.id || Math.random().toString(36).slice(2, 10);
    this.homeTeamId = config.homeTeamId;
    this.awayTeamId = config.awayTeamId;
    this.homeTeam = config.homeTeam;
    this.awayTeam = config.awayTeam;
    this.week = config.week || 0;

    // Final score
    this.homeGoals = config.homeGoals || 0;
    this.awayGoals = config.awayGoals || 0;

    // Match stats
    this.homeStats = Object.freeze(config.homeStats || {
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      passes: 0,
      tackles: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0
    });

    this.awayStats = Object.freeze(config.awayStats || {
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      passes: 0,
      tackles: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0
    });

    // Match events (immutable)
    this.events = Object.freeze(config.events || []);

    // Match metadata
    this.venue = config.venue || "Away";
    this.attendance = config.attendance || 0;
    this.date = config.date || new Date().toISOString();
    this.seed = config.seed || 0;

    Object.freeze(this);
  }

  /**
   * Determine winner
   */
  MatchRecord.prototype.getWinner = function () {
    if (this.homeGoals > this.awayGoals) return "home";
    if (this.awayGoals > this.homeGoals) return "away";
    return "draw";
  };

  /**
   * Get points for team (3 for win, 1 for draw)
   */
  MatchRecord.prototype.getPoints = function (teamId) {
    if (teamId === this.homeTeamId) {
      if (this.homeGoals > this.awayGoals) return 3;
      if (this.homeGoals === this.awayGoals) return 1;
      return 0;
    } else if (teamId === this.awayTeamId) {
      if (this.awayGoals > this.homeGoals) return 3;
      if (this.awayGoals === this.homeGoals) return 1;
      return 0;
    }
    return 0;
  };

  FMG.Core.Domain.Match.MatchRecord = MatchRecord;
})();
