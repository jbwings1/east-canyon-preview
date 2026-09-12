/**
 * Shared browser client. Uses the anon/publishable key from supabase-config.js.
 * Service role keys must stay server-side and never ship in this repo.
 *
 * Auth sessions use sessionStorage so closing the browser signs the user out
 * (important on shared office / family computers).
 */
(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.anonKey) {
    throw new Error("Load js/supabase-config.js before js/supabase-client.js.");
  }
  if (typeof supabase === "undefined" || !supabase.createClient) {
    throw new Error("Load js/supabase.js (Supabase JS UMD) before js/supabase-client.js.");
  }

  const sessionOnlyStorage = {
    getItem(key) {
      try {
        const fromSession = sessionStorage.getItem(key);
        if (fromSession != null) return fromSession;
      } catch {
        /* ignore */
      }
      // One-time migration from older localStorage sessions, then clear them.
      try {
        const fromLocal = localStorage.getItem(key);
        if (fromLocal != null) {
          sessionStorage.setItem(key, fromLocal);
          localStorage.removeItem(key);
          return fromLocal;
        }
      } catch {
        /* ignore */
      }
      return null;
    },
    setItem(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    removeItem(key) {
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };

  window.ecrSupabase = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: sessionOnlyStorage,
    },
  });
})();
