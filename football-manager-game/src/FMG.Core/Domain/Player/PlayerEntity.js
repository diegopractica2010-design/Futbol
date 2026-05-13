(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Player = FMG.Core.Domain.Player || {};

  /**
   * PlayerEntity
   * Part of Club aggregate (owned by Club)
   * Immutable player attributes
   */
  function PlayerEntity(config) {
    config = config || {};

    this.id = config.id;
    this.name = config.name || "Unknown";
    this.teamId = config.teamId;
    this.position = config.position || "ST"; // ST, CM, CB, GK, etc.
    this.age = config.age || 25;
    this.pace = config.pace || 75;
    this.shooting = config.shooting || 75;
    this.passing = config.passing || 75;
    this.dribbling = config.dribbling || 75;
    this.defense = config.defense || 75;
    this.physical = config.physical || 75;

    // Player state
    this.isInjured = config.isInjured || false;
    this.injuryWeeks = config.injuryWeeks || 0;
    this.suspensionWeeks = config.suspensionWeeks || 0;
    this.morale = config.morale || 50;
    this.experience = config.experience || 0;

    // Contract
    this.marketValue = config.marketValue || 0;
    this.salary = config.salary || 0;
    this.contractExpiry = config.contractExpiry || null;

    Object.freeze(this);
  }

  /**
   * Get player's overall rating
   */
  PlayerEntity.prototype.getOverall = function () {
    const attrs = [
      this.pace,
      this.shooting,
      this.passing,
      this.dribbling,
      this.defense,
      this.physical
    ];
    const sum = attrs.reduce((a, b) => a + b, 0);
    return Math.round(sum / attrs.length);
  };

  /**
   * Check if player is available to play
   */
  PlayerEntity.prototype.isAvailable = function () {
    return !this.isInjured && this.suspensionWeeks === 0;
  };

  FMG.Core.Domain.Player.PlayerEntity = PlayerEntity;
})();
