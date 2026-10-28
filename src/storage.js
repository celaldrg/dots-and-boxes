/**
 * The only place that touches localStorage. Every read and write is wrapped in
 * try/catch: in private mode, with storage blocked or full, reads fall back
 * and writes are skipped instead of breaking the game.
 */

const PREFIX = 'dots-and-boxes.';

/**
 * @typedef {object} Store
 * @property {(key: string, fallback: unknown) => unknown} load parsed JSON value, or the fallback
 * @property {(key: string, value: unknown) => boolean} save whether the value was stored
 */

/**
 * Creates a store on top of a Web Storage object. The backend is looked up on
 * every call, never at import time.
 * @param {() => Pick<Storage, 'getItem' | 'setItem'> | null | undefined} [getBackend]
 * @returns {Store}
 */
export function createStore(getBackend = () => globalThis.localStorage) {
  return {
    load(key, fallback) {
      try {
        const raw = getBackend()?.getItem(PREFIX + key);
        return raw === null || raw === undefined ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    save(key, value) {
      try {
        const backend = getBackend();
        if (!backend) return false;
        backend.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The browser's localStorage, guarded. */
export const storage = createStore();
