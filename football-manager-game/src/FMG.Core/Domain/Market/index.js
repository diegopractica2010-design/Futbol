(function () {
  "use strict";

  // Re-export Market Aggregate
  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Domain = FMG.Core.Domain || {};
  FMG.Core.Domain.Market = FMG.Core.Domain.Market || {};

  FMG.Core.Domain.Market.index = true;
})();
