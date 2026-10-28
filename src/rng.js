/**
 * Small seeded random number generator (mulberry32), so every random choice
 * in the game can be replayed exactly in tests.
 */

/**
 * Creates a generator of floats in [0, 1) from a 32-bit seed.
 * @param {number} seed any number; only its low 32 bits are used
 * @returns {() => number}
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Picks a uniformly random element.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items non-empty list
 * @returns {T}
 */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
