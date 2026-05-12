(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};

  /**
   * Club Aggregate
   * Owns: squad, finances, tactics, market participation
   * Immutable: all mutations return new Club instances
   */
  function Club(config) {
    config = config || {};

    this.teamId = config.teamId;
    this.name = config.name;
    this.budget = config.budget || 0;
    this.fanBase = config.fanBase || 0;

    // Immutable collections
    this.squad = Object.freeze(config.squad || []);
    this.lineup = Object.freeze(config.lineup || []);

    // Finances
    this.finances = Object.freeze(config.finances || {
      balance: config.budget || 0,
      budgets: { transfers: 0, wages: 0, infrastructure: 0, operations: 0 },
      debt: 0,
      boardTrust: 65
    });

    // Tactics
    this.tactics = Object.freeze(config.tactics || {
      formation: "4-3-3",
      mentality: "balanced",
      pressing: "medium",
      tempo: "normal"
    });

    this.form = config.form || 10;
    this.strength = config.strength || 50;

    Object.freeze(this);
  }

  /**
   * Create new Club with updated squad (immutable)
   */
  Club.prototype.withSquad = function (newSquad) {
    return new Club({
      teamId: this.teamId,
      name: this.name,
      budget: this.budget,
      fanBase: this.fanBase,
      squad: newSquad,
      lineup: this.lineup,
      finances: this.finances,
      tactics: this.tactics,
      form: this.form,
      strength: this.strength
    });
  };

  /**
   * Create new Club with updated finances
   */
  Club.prototype.withFinances = function (newFinances) {
    return new Club({
      teamId: this.teamId,
      name: this.name,
      budget: this.budget,
      fanBase: this.fanBase,
      squad: this.squad,
      lineup: this.lineup,
      finances: Object.freeze({ ...this.finances, ...newFinances }),
      tactics: this.tactics,
      form: this.form,
      strength: this.strength
    });
  };

  /**
   * Create new Club with updated tactics
   */
  Club.prototype.withTactics = function (newTactics) {
    return new Club({
      teamId: this.teamId,
      name: this.name,
      budget: this.budget,
      fanBase: this.fanBase,
      squad: this.squad,
      lineup: this.lineup,
      finances: this.finances,
      tactics: Object.freeze({ ...this.tactics, ...newTactics }),
      form: this.form,
      strength: this.strength
    });
  };

  /**
   * Get starting XI from current lineup
   */
  Club.prototype.getStartingXI = function () {
    return this.lineup.slice(0, 11);
  };

  /**
   * Season Aggregate
   * Owns: fixture, standings, competitions
   * Immutable: all mutations return new Season instances
   */
  function Season(config) {
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

    this.startSeed = config.startSeed || Math.floor(Math.random() * 0xffffffff);

    Object.freeze(this);
  }

  /**
   * Create new Season with advanced week
   */
  Season.prototype.nextWeek = function () {
    if (this.week >= this.totalWeeks) {
      return this; // Already complete
    }
    return new Season({
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
  Season.prototype.withStandings = function (newStandings) {
    return new Season({
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
  Season.prototype.addMatchResult = function (matchResult) {
    const newResults = this.matchResults.slice();
    newResults.push(matchResult);
    return new Season({
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
  Season.prototype.currentFixture = function () {
    return this.fixture.find((f) => f.week === this.week) || null;
  };

  /**
   * Manager Aggregate
   * Owns: profile, career, objectives
   * Immutable
   */
  function Manager(config) {
    config = config || {};

    this.profile = Object.freeze(config.profile || {
      name: "Manager",
      nationality: "Chile",
      age: 40,
      style: "balanced"
    });

    this.career = Object.freeze(config.career || {
      reputation: 45,
      achievements: [],
      objectives: [],
      offers: []
    });

    Object.freeze(this);
  }

  /**
   * Create new Manager with updated career
   */
  Manager.prototype.withCareer = function (newCareer) {
    return new Manager({
      profile: this.profile,
      career: Object.freeze({ ...this.career, ...newCareer })
    });
  };

  FMG.Core.Domain.Club = Club;
  FMG.Core.Domain.Season = Season;
  FMG.Core.Domain.Manager = Manager;
})();
