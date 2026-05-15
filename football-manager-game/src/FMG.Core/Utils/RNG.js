(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Utils = FMG.Core.Utils || {};

  /**
   * Seedable PRNG (Mulberry32)
   * Deterministic: same seed always produces same sequence
   * Isolated: does not affect global browser randomness
   */
  function RNG(seed) {
    this._seed = seed === undefined || seed === null ? 0x1f2e3d4c : seed;
    this._state = this._seed;
  }

  RNG.prototype.next = function () {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  RNG.prototype.nextInt = function (min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  };

  RNG.prototype.nextFloat = function (min, max) {
    return this.next() * (max - min) + min;
  };

  RNG.prototype.choice = function (array) {
    if (!array || array.length === 0) return null;
    return array[this.nextInt(0, array.length - 1)];
  };

  RNG.prototype.getSeed = function () {
    return this._seed;
  };

  RNG.prototype.reset = function (seed) {
    this._seed = seed;
    this._state = seed;
  };

  RNG.prototype.snapshot = function () {
    return {
      seed: this._seed,
      state: this._state
    };
  };

  RNG.prototype.restore = function (snapshot) {
    this._seed = snapshot.seed;
    this._state = snapshot.state;
  };

  FMG.Core.Utils.RNG = RNG;

  FMG.Core.Utils.Determinism = FMG.Core.Utils.Determinism || {
    _tick: 0,

    nextTick: function () {
      this._tick += 1;
      return this._tick;
    },

    timestampForTick: function (tick) {
      const totalSeconds = Math.max(0, Math.floor(tick || 0));
      const day = 1 + Math.floor(totalSeconds / 86400) % 28;
      const hour = Math.floor(totalSeconds / 3600) % 24;
      const minute = Math.floor(totalSeconds / 60) % 60;
      const second = totalSeconds % 60;
      return "2000-01-" + pad(day, 2) + "T" + pad(hour, 2) + ":" + pad(minute, 2) + ":" + pad(second, 2) + ".000Z";
    },

    nextTimestamp: function () {
      return this.timestampForTick(this.nextTick());
    },

    timestampForGeneration: function (generation, offset) {
      return this.timestampForTick((generation || 0) * 100 + (offset || 0));
    },

    id: function (prefix, parts) {
      const value = stableStringify(parts || []);
      return prefix + "_" + FMG.Core.Utils.hashSeed(value).toString(36);
    },

    nextId: function (prefix) {
      return this.id(prefix, [this.nextTick()]);
    },

    seed: function (parts) {
      return FMG.Core.Utils.hashSeed(stableStringify(parts || []));
    },

    reset: function () {
      this._tick = 0;
    }
  };

  /**
   * Global RNG factory for simulation context
   */
  FMG.Core.Utils.createRNG = function (seed) {
    return new RNG(seed);
  };

  /**
   * Deterministic seed derivation
   * deriveSeed(baseSeed, index) always produces same result
   */
  FMG.Core.Utils.deriveSeed = function (baseSeed, index, salt) {
    const combined = baseSeed ^ (index * 73856093);
    const salted = combined ^ ((salt || 0) * 19349663);
    const rng = new RNG(salted);
    return rng.nextInt(0, 0xffffffff);
  };

  /**
   * Hash function for deterministic string seeding
   */
  FMG.Core.Utils.hashSeed = function (str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  function pad(value, length) {
    return String(value).padStart(length, "0");
  }

  function stableStringify(value) {
    if (value === null || value === undefined) return String(value);
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) {
      return "[" + value.map(stableStringify).join(",") + "]";
    }
    return "{" + Object.keys(value).sort().map((key) => key + ":" + stableStringify(value[key])).join(",") + "}";
  }
})();
