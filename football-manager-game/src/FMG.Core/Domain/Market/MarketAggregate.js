(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Market = FMG.Core.Domain.Market || {};

  /**
   * MarketAggregate
   * Owns: transfer offers, player market values, trading rules
   * Immutable: all mutations return new Market instances
   */
  function MarketAggregate(config) {
    config = config || {};

    this.activeOffers = Object.freeze(config.activeOffers || []);
    this.completedTransfers = Object.freeze(config.completedTransfers || []);
    this.playerPrices = Object.freeze(config.playerPrices || {});
    this.marketTrend = config.marketTrend || "stable"; // rising, stable, falling

    Object.freeze(this);
  }

  /**
   * Create Market with new active offers
   */
  MarketAggregate.prototype.withActiveOffers = function (newOffers) {
    return new MarketAggregate({
      activeOffers: Object.freeze(newOffers),
      completedTransfers: this.completedTransfers,
      playerPrices: this.playerPrices,
      marketTrend: this.marketTrend
    });
  };

  /**
   * Add completed transfer
   */
  MarketAggregate.prototype.addTransfer = function (transfer) {
    const newTransfers = this.completedTransfers.slice();
    newTransfers.push(transfer);
    return new MarketAggregate({
      activeOffers: this.activeOffers,
      completedTransfers: Object.freeze(newTransfers),
      playerPrices: this.playerPrices,
      marketTrend: this.marketTrend
    });
  };

  /**
   * Update player market values
   */
  MarketAggregate.prototype.updatePrices = function (newPrices) {
    return new MarketAggregate({
      activeOffers: this.activeOffers,
      completedTransfers: this.completedTransfers,
      playerPrices: Object.freeze({ ...this.playerPrices, ...newPrices }),
      marketTrend: this.marketTrend
    });
  };

  FMG.Core.Domain.Market.MarketAggregate = MarketAggregate;
})();
