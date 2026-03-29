(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.STORAGE_KEY = "football-manager-game-save";

  FMG.clamp = function (value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  FMG.randomInt = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  FMG.sample = function (list) {
    return list[Math.floor(Math.random() * list.length)];
  };

  FMG.currency = function (value) {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0
    }).format(Math.round(value));
  };

  FMG.uid = function (prefix) {
    const safePrefix = prefix || "id";
    return `${safePrefix}-${Math.random().toString(36).slice(2, 10)}`;
  };

  FMG.average = function (values) {
    if (!values.length) return 0;
    return values.reduce((sum, current) => sum + current, 0) / values.length;
  };

  FMG.deepClone = function (value) {
    return JSON.parse(JSON.stringify(value));
  };
})();
