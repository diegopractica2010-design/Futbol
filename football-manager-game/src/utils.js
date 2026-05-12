(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.STORAGE_KEY = "football-manager-game-save";
  FMG.SAVE_INDEX_KEY = "football-manager-game-save-index";
  FMG.SAVE_SLOT_PREFIX = "football-manager-game-slot-";
  FMG.SETTINGS_KEY = "football-manager-game-settings";
  // Version de save: se mantiene en la fase publica mas alta y las migraciones
  // deben aceptar versiones anteriores sin romper partidas guardadas.
  FMG.CURRENT_VERSION = typeof document === "undefined" ? 13 : 24;
  FMG.DIFFICULTY_MODIFIERS = {
    easy: { matchBonus: 5, marketDiscount: 0.85, boardTrustDecay: 0.5, rivalAILevel: 0.6 },
    normal: { matchBonus: 0, marketDiscount: 1.0, boardTrustDecay: 1.0, rivalAILevel: 1.0 },
    hard: { matchBonus: -3, marketDiscount: 1.1, boardTrustDecay: 1.3, rivalAILevel: 1.2 },
    expert: { matchBonus: -6, marketDiscount: 1.25, boardTrustDecay: 1.6, rivalAILevel: 1.5 }
  };

  // =========================================================================
  // RANDOM NUMBER GENERATOR SEEDABLE (Mulberry32)
  // =========================================================================
  FMG.mulberry32 = function (a) {
    return function () {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // RNG global del juego
  FMG.rng = Math.random; // Por defecto, usar Math.random

  // Inicializar RNG con seed
  FMG.initRNG = function (seed) {
    if (!seed) {
      // Si no hay seed, generar uno basado en el timestamp
      seed = Math.floor(Date.now() % 4294967296);
    }
    FMG._currentSeed = seed;
    FMG.rng = FMG.mulberry32(seed);
  };

  // Obtener el seed actual
  FMG.getCurrentSeed = function () {
    return FMG._currentSeed;
  };

  // =========================================================================
  // BRIDGE TO FMG.Core RNG (after Core loads)
  // =========================================================================
  FMG.createCoreRNG = function (seed) {
    if (!FMG.Core || !FMG.Core.Utils || !FMG.Core.Utils.RNG) {
      console.warn("FMG.Core.Utils.RNG not loaded yet");
      return null;
    }
    return new FMG.Core.Utils.RNG(seed);
  };

  FMG.deriveSeed = function (baseSeed, index, salt) {
    if (!FMG.Core || !FMG.Core.Utils || !FMG.Core.Utils.deriveSeed) {
      console.warn("FMG.Core.Utils not ready");
      return baseSeed ^ index ^ (salt || 0);
    }
    return FMG.Core.Utils.deriveSeed(baseSeed, index, salt);
  };

  FMG.clamp = function (value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  FMG.randomInt = function (min, max) {
    return Math.floor(FMG.rng() * (max - min + 1)) + min;
  };

  FMG.sample = function (list) {
    return list[Math.floor(FMG.rng() * list.length)];
  };

  FMG.currency = function (value) {
    const amount = Math.round(Number(value) || 0);
    if (Math.abs(amount) >= 1000000) {
      return `$${(amount / 1000000).toFixed(1).replace(".", ",")} M`;
    }
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  FMG.uid = function (prefix) {
    const safePrefix = prefix || "id";
    return `${safePrefix}-${FMG.rng().toString(36).slice(2, 10)}`;
  };

  FMG.average = function (values) {
    if (!values.length) return 0;
    return values.reduce((sum, current) => sum + current, 0) / values.length;
  };

  // structuredClone es ~3x mas rapido que JSON.parse/stringify en V8 moderno
  FMG.deepClone = typeof structuredClone === "function"
    ? function (value) { return structuredClone(value); }
    : function (value) { return JSON.parse(JSON.stringify(value)); };

  // Clones ligeros para rutas criticas (evita serializar objetos completos)
  FMG.cloneTeam = function (team) {
    return Object.assign({}, team);
  };

  FMG.clonePlayer = function (player) {
    const p = Object.assign({}, player);
    if (player.attributes) p.attributes = Object.assign({}, player.attributes);
    if (player.seasonStats) p.seasonStats = Object.assign({}, player.seasonStats);
    return p;
  };

  FMG.escapeHtml = function (value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  FMG.safe = function (value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  };

  if (typeof window.addEventListener === "function") {
    window.addEventListener("DOMContentLoaded", () => {
      FMG.CURRENT_VERSION = Math.max(...(FMG._loadedPhases || [FMG.CURRENT_VERSION]));
    });
  }

  FMG.validateSeedData = function (teams, players) {
    if (!Array.isArray(teams) || teams.length < 2) {
      throw new Error("Se necesitan al menos dos equipos para iniciar la liga.");
    }
    if (!Array.isArray(players) || players.length === 0) {
      throw new Error("No se encontraron jugadores para iniciar la partida.");
    }

    const teamIds = new Set();
    teams.forEach((team) => {
      ["id", "name", "city", "stadium", "style"].forEach((field) => {
        if (!team[field]) throw new Error(`Equipo invalido: falta ${field}.`);
      });
      ["budget", "fanBase", "sponsor", "infrastructureCost", "form"].forEach((field) => {
        if (!Number.isFinite(team[field])) throw new Error(`Equipo ${team.name} tiene ${field} invalido.`);
      });
      if (teamIds.has(team.id)) throw new Error(`Equipo duplicado: ${team.id}.`);
      teamIds.add(team.id);
    });

    const playerIds = new Set();
    players.forEach((player) => {
      ["id", "name", "teamId", "position"].forEach((field) => {
        if (!player[field]) throw new Error(`Jugador invalido: falta ${field}.`);
      });
      ["age", "overall", "morale", "energy", "value", "salary"].forEach((field) => {
        if (!Number.isFinite(player[field])) throw new Error(`Jugador ${player.name} tiene ${field} invalido.`);
      });
      if (!teamIds.has(player.teamId)) throw new Error(`Jugador ${player.name} apunta a un equipo inexistente.`);
      if (playerIds.has(player.id)) throw new Error(`Jugador duplicado: ${player.id}.`);
      playerIds.add(player.id);
    });
  };
})();
