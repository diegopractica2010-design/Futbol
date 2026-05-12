(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Utils = FMG.Core.Utils || {};

  /**
   * Seedable PRNG (Mulberry32)
   * Deterministic: same seed always produces same sequence
   * Isolated: does not affect global Math.random()
   */
  function RNG(seed) {
    this._seed = seed || Math.floor(Math.random() * 0xffffffff);
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
})();
