/**
 * storage.js
 * Persistence layer. Everything else in the app calls `AppStorage.load()`
 * and `AppStorage.save(state)` — it never touches localStorage directly.
 *
 * WHY THIS MATTERS FOR YOU LATER:
 * Right now `AppStorage` is backed by the browser's localStorage, so each
 * visitor's data lives only in their own browser. When you're ready to
 * add user accounts / a cloud database / multi-device sync, replace the
 * two functions below with calls to your backend (e.g. Supabase, or
 * your own `fetch('/api/state')` route). No other file needs to
 * change, because everything else only ever calls `AppStorage.load()` /
 * `AppStorage.save()` — see ARCHITECTURE.md for the fuller plan.
 *
 * Both functions are already async (return Promises) even though
 * localStorage itself is synchronous — deliberate, so a real
 * network-backed adapter is a drop-in replacement later.
 */

const SAVE_KEY = 'hundred-days-app-v3';

const AppStorage = {
  /** @returns {Promise<object|null>} */
  async load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('AppStorage.load failed', e);
      return null;
    }
  },

  /** @returns {Promise<boolean>} */
  async save(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('AppStorage.save failed', e);
      return false;
    }
  }
};

/*
 * EXAMPLE — swapping in a backend later (do not uncomment yet):
 *
 * const AppStorage = {
 *   async load() {
 *     const res = await fetch('/api/state', { credentials: 'include' });
 *     return res.ok ? await res.json() : null;
 *   },
 *   async save(state) {
 *     const res = await fetch('/api/state', {
 *       method: 'PUT',
 *       headers: { 'Content-Type': 'application/json' },
 *       credentials: 'include',
 *       body: JSON.stringify(state)
 *     });
 *     return res.ok;
 *   }
 * };
 */
