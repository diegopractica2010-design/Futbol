(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Club = FMG.Core.Domain.Club || {};

  /**
   * Club Aggregate Root
   * Owns: squad, finances, tactics, market participation
   * Immutable: all mutations return new Club instances
   */
  function ClubAggregate(config) {
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
  ClubAggregate.prototype.withSquad = function (newSquad) {
    return new ClubAggregate({
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
  ClubAggregate.prototype.withFinances = function (newFinances) {
    return new ClubAggregate({
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
  ClubAggregate.prototype.withTactics = function (newTactics) {
    return new ClubAggregate({
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
  ClubAggregate.prototype.getStartingXI = function () {
    return this.lineup.slice(0, 11);
  };

  FMG.Core.Domain.Club.ClubAggregate = ClubAggregate;
})();
