export class RNG {
  constructor(seed) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this.seed = seed % 2147483647; // Ensure seed is within a reasonable range
    if (this.seed <= 0) this.seed += 2147483646;
  }

  // LCG for next deterministic integer
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed;
  }

  // nextFloat returns a float between 0 (inclusive) and 1 (exclusive)
  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }

  // nextRange returns an integer between min (inclusive) and max (inclusive)
  nextRange(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  // deriveSeed creates a new seed based on the current state and a namespace
  deriveSeed(namespace) {
    // A simple derivation, can be made more robust if needed
    let derived = this.seed;
    for (let i = 0; i < namespace.length; i++) {
      derived = (derived + namespace.charCodeAt(i)) % 2147483647;
    }
    return derived;
  }
}
