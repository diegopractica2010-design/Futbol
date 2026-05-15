(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Repository = FMG.Core.Repository || {};

  /**
   * SeasonRepository
   * Handles persistence of Season aggregates
   * Linked to GameStateRepository via foreign key
   */
  function SeasonRepository(config) {
    config = config || {};
    this.storageKey = config.storageKey || "FMG_SEASON";
  }

  /**
   * Save Season aggregate
   */
  SeasonRepository.prototype.save = function (seasonId, season) {
    if (!season) {
      throw new Error("Season required");
    }

    try {
      const data = {
        id: seasonId,
        season: {
          number: season.number,
          week: season.week,
          totalWeeks: season.totalWeeks,
          fixture: season.fixture,
          standings: season.standings,
          matchResults: season.matchResults,
          competitions: season.competitions,
          startSeed: season.startSeed
        },
        timestamp: FMG.Core.Utils.Determinism.timestampForGeneration(season.week, 110)
      };

      if (window.localStorage) {
        localStorage.setItem(this.storageKey + "_" + seasonId, JSON.stringify(data));
      }

      return Promise.resolve(data);
    } catch (err) {
      console.error("SeasonRepository.save error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * Load Season aggregate
   */
  SeasonRepository.prototype.load = function (seasonId) {
    try {
      if (window.localStorage) {
        const data = localStorage.getItem(this.storageKey + "_" + seasonId);
        if (!data) return Promise.resolve(null);
        const parsed = JSON.parse(data);
        return Promise.resolve(parsed.season);
      }
      return Promise.resolve(null);
    } catch (err) {
      console.error("SeasonRepository.load error:", err);
      return Promise.reject(err);
    }
  };

  FMG.Core.Repository.SeasonRepository = SeasonRepository;
})();
