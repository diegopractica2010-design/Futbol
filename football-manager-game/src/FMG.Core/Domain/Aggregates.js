(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};

  /**
   * Aggregates.js — Barrel export for all Domain aggregates
   * 
   * Each aggregate is defined in its own subdirectory:
   * - src/FMG.Core/Domain/Club/ClubAggregate.js
   * - src/FMG.Core/Domain/Season/SeasonAggregate.js
   * - src/FMG.Core/Domain/Manager/ManagerAggregate.js
   * - src/FMG.Core/Domain/Match/MatchRecord.js
   * - src/FMG.Core/Domain/Player/PlayerEntity.js
   * - src/FMG.Core/Domain/Market/MarketAggregate.js
   * 
   * This file re-exports them with friendly aliases for backward compatibility.
   */

  /**
   * Create convenience aliases for aggregates
   * These point to the actual implementations loaded from subdirectories
   */
  Object.defineProperty(FMG.Core.Domain, 'Club', {
    get: function () {
      return (FMG.Core.Domain.Club && FMG.Core.Domain.Club.ClubAggregate) || undefined;
    }
  });

  Object.defineProperty(FMG.Core.Domain, 'Season', {
    get: function () {
      return (FMG.Core.Domain.Season && FMG.Core.Domain.Season.SeasonAggregate) || undefined;
    }
  });

  Object.defineProperty(FMG.Core.Domain, 'Manager', {
    get: function () {
      return (FMG.Core.Domain.Manager && FMG.Core.Domain.Manager.ManagerAggregate) || undefined;
    }
  });

  Object.defineProperty(FMG.Core.Domain, 'MatchRecord', {
    get: function () {
      return (FMG.Core.Domain.Match && FMG.Core.Domain.Match.MatchRecord) || undefined;
    }
  });

  Object.defineProperty(FMG.Core.Domain, 'PlayerEntity', {
    get: function () {
      return (FMG.Core.Domain.Player && FMG.Core.Domain.Player.PlayerEntity) || undefined;
    }
  });

  Object.defineProperty(FMG.Core.Domain, 'MarketAggregate', {
    get: function () {
      return (FMG.Core.Domain.Market && FMG.Core.Domain.Market.MarketAggregate) || undefined;
    }
  });
})();
