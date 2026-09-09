/**
 * Shared browser client. Uses the anon/publishable key from supabase-config.js.
 * Service role keys must stay server-side and never ship in this repo.
 */
(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg?.url || !cfg?.anonKey) {
    throw new Error("Load js/supabase-config.js before js/supabase-client.js.");
  }
  if (typeof supabase === "undefined" || !supabase.createClient) {
    throw new Error("Load js/supabase.js (Supabase JS UMD) before js/supabase-client.js.");
  }
  window.ecrSupabase = supabase.createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();
