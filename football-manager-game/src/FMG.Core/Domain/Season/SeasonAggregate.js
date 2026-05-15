(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Season = FMG.Core.Domain.Season || {};

  /**
   * Season Aggregate Root
   * Owns: fixture, standings, competitions, match results
   * Immutable: all mutations return new Season instances
   */
  function SeasonAggregate(config) {
    config = config || {};

    this.number = config.number || 1;
    this.week = config.week || 1;
    this.totalWeeks = config.totalWeeks || 38;

    this.fixture = Object.freeze(config.fixture || []);
    this.standings = Object.freeze(config.standings || []);
    this.matchResults = Object.freeze(config.matchResults || []);

    this.competitions = Object.freeze(config.competitions || {
      nationalCup: null,
      superCup: null,
      international: null,
      rankings: { scorers: [], shooters: [], cards: [], keepers: [] }
    });

    this.startSeed = config.startSeed || FMG.Core.Utils.Determinism.seed(["season", this.number, this.totalWeeks, this.fixture.length]);

    Object.freeze(this);
  }

  /**
   * Create new Season with advanced week
   */
  SeasonAggregate.prototype.nextWeek = function () {
    if (this.week >= this.totalWeeks) {
      return this; // Already complete
    }
    return new SeasonAggregate({
      number: this.number,
      week: this.week + 1,
      totalWeeks: this.totalWeeks,
      fixture: this.fixture,
      standings: this.standings,
      matchResults: this.matchResults,
      competitions: this.competitions,
      startSeed: this.startSeed
    });
  };

  /**
   * Create new Season with updated standings
   */
  SeasonAggregate.prototype.withStandings = function (newStandings) {
    return new SeasonAggregate({
      number: this.number,
      week: this.week,
      totalWeeks: this.totalWeeks,
      fixture: this.fixture,
      standings: Object.freeze(newStandings),
      matchResults: this.matchResults,
      competitions: this.competitions,
      startSeed: this.startSeed
    });
  };

  /**
   * Create new Season with added match result
   */
  SeasonAggregate.prototype.addMatchResult = function (matchResult) {
    const newResults = this.matchResults.slice();
    newResults.push(matchResult);
    return new SeasonAggregate({
      number: this.number,
      week: this.week,
      totalWeeks: this.totalWeeks,
      fixture: this.fixture,
      standings: this.standings,
      matchResults: Object.freeze(newResults),
      competitions: this.competitions,
      startSeed: this.startSeed
    });
  };

  /**
   * Get current week's fixture (matches to play)
   */
  SeasonAggregate.prototype.currentFixture = function () {
    return this.fixture.find((f) => f.week === this.week) || null;
  };

  FMG.Core.Domain.Season.SeasonAggregate = SeasonAggregate;
})();
