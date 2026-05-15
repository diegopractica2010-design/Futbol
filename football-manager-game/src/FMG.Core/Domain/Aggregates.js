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
   * Create convenience aliases for aggregates.
   * The aliases are plain values, not getters, so they cannot recurse when read.
   */
  function registerAggregate(namespaceName, exportName, aliasName) {
    const namespace = FMG.Core.Domain[namespaceName];
    const Aggregate = namespace && namespace[exportName];

    if (typeof Aggregate !== "function") {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(Aggregate, exportName)) {
      Object.defineProperty(Aggregate, exportName, {
        value: Aggregate,
        enumerable: false,
        configurable: true
      });
    }

    Object.defineProperty(FMG.Core.Domain, aliasName || namespaceName, {
      value: Aggregate,
      enumerable: true,
      configurable: true,
      writable: false
    });
  }

  registerAggregate("Club", "ClubAggregate");
  registerAggregate("Season", "SeasonAggregate");
  registerAggregate("Manager", "ManagerAggregate");
  registerAggregate("Match", "MatchRecord", "MatchRecord");
  registerAggregate("Player", "PlayerEntity", "PlayerEntity");
  registerAggregate("Market", "MarketAggregate", "MarketAggregate");
})();
