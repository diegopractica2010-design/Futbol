(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Repository = FMG.Core.Repository || {};

  /**
   * ClubRepository
   * Handles persistence of Club aggregates
   * Linked to GameStateRepository via foreign key
   */
  function ClubRepository(config) {
    config = config || {};
    this.storageKey = config.storageKey || "FMG_CLUB";
  }

  /**
   * Save Club aggregate
   */
  ClubRepository.prototype.save = function (clubId, club) {
    if (!club) {
      throw new Error("Club required");
    }

    try {
      const data = {
        id: clubId,
        club: {
          teamId: club.teamId,
          name: club.name,
          budget: club.budget,
          fanBase: club.fanBase,
          squad: club.squad,
          lineup: club.lineup,
          finances: club.finances,
          tactics: club.tactics,
          form: club.form,
          strength: club.strength
        },
        timestamp: FMG.Core.Utils.Determinism.timestampForTick(FMG.Core.Utils.Determinism.seed(["club", clubId]))
      };

      if (window.localStorage) {
        localStorage.setItem(this.storageKey + "_" + clubId, JSON.stringify(data));
      }

      return Promise.resolve(data);
    } catch (err) {
      console.error("ClubRepository.save error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * Load Club aggregate
   */
  ClubRepository.prototype.load = function (clubId) {
    try {
      if (window.localStorage) {
        const data = localStorage.getItem(this.storageKey + "_" + clubId);
        if (!data) return Promise.resolve(null);
        const parsed = JSON.parse(data);
        return Promise.resolve(parsed.club);
      }
      return Promise.resolve(null);
    } catch (err) {
      console.error("ClubRepository.load error:", err);
      return Promise.reject(err);
    }
  };

  /**
   * Load all clubs for a season/gameState
   */
  ClubRepository.prototype.loadAll = function () {
    try {
      const results = [];
      const prefix = this.storageKey + "_";
      if (window.localStorage) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith(prefix)) {
            const data = JSON.parse(localStorage.getItem(key));
            results.push(data.club);
          }
        }
      }
      return Promise.resolve(results);
    } catch (err) {
      console.error("ClubRepository.loadAll error:", err);
      return Promise.reject(err);
    }
  };

  FMG.Core.Repository.ClubRepository = ClubRepository;
})();
