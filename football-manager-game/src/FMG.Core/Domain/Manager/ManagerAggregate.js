(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Manager = FMG.Core.Domain.Manager || {};

  /**
   * Manager Aggregate Root
   * Owns: profile, career, objectives, achievements
   * Immutable: all mutations return new Manager instances
   */
  function ManagerAggregate(config) {
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
  ManagerAggregate.prototype.withCareer = function (newCareer) {
    return new ManagerAggregate({
      profile: this.profile,
      career: Object.freeze({ ...this.career, ...newCareer })
    });
  };

  /**
   * Update reputation
   */
  ManagerAggregate.prototype.withReputation = function (newReputation) {
    return this.withCareer({
      reputation: newReputation
    });
  };

  /**
   * Add achievement
   */
  ManagerAggregate.prototype.addAchievement = function (achievement) {
    const newAchievements = this.career.achievements.slice();
    newAchievements.push(achievement);
    return this.withCareer({
      achievements: newAchievements
    });
  };

  FMG.Core.Domain.Manager.ManagerAggregate = ManagerAggregate;
})();
