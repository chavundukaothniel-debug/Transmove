// ==============================================================================
// TRANSMOVE SUPABASE CLIENT CONFIGURATION
// PRIMARY APPLICATION BACKEND (BROWSER SAFE)
// NEVER includes or exposes SUPABASE_SERVICE_ROLE_KEY
// ==============================================================================

export const PRODUCTION_SUPABASE_URL = "https://wwvnnnistexgyvhvnqes.supabase.co";
export const PRODUCTION_SUPABASE_ANON_KEY = "sb_publishable__EpXdp1hPVYf-k0VSUF4Uw_5_rBEYm4";

let runtimeConfigPromise = null;

// Asynchronously sync with server runtime config if available
export async function syncRuntimeConfig() {
  if (typeof window === "undefined" || !window.fetch) return;
  if (runtimeConfigPromise) return runtimeConfigPromise;

  runtimeConfigPromise = (async () => {
    try {
      const res = await fetch("/api/public-config", { cache: "no-store" });
      if (res.ok) {
        const config = await res.json();
        if (config.supabaseUrl && config.supabaseAnonKey) {
          if (
            window.localStorage &&
            (window.localStorage.getItem("transmove_supabase_url") !== config.supabaseUrl ||
             window.localStorage.getItem("transmove_supabase_key") !== config.supabaseAnonKey)
          ) {
            window.localStorage.setItem("transmove_supabase_url", config.supabaseUrl);
            window.localStorage.setItem("transmove_supabase_key", config.supabaseAnonKey);
          }
        }
      }
    } catch (_) {
      // Offline / Capacitor / static fallback
    }
  })();

  return runtimeConfigPromise;
}

export function getSupabaseCredentials() {
  let customUrl = null;
  let customKey = null;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      customUrl = window.localStorage.getItem("transmove_supabase_url");
      customKey = window.localStorage.getItem("transmove_supabase_key");

      // Purge any stale legacy project URLs from earlier builds
      if (customUrl && (customUrl.includes("mhghjurlwmgeiuhcxieg") || customUrl.includes("your-project"))) {
        window.localStorage.removeItem("transmove_supabase_url");
        window.localStorage.removeItem("transmove_supabase_key");
        customUrl = null;
        customKey = null;
      }
    } else if (typeof process !== "undefined" && process.env) {
      customUrl = process.env.SUPABASE_URL;
      customKey = process.env.SUPABASE_ANON_KEY;
    }
  } catch (_) {}

  const url = customUrl || PRODUCTION_SUPABASE_URL;
  const anonKey = customKey || PRODUCTION_SUPABASE_ANON_KEY;

  const isConfigured = Boolean(
    url &&
    anonKey &&
    !url.includes("your-project") &&
    !anonKey.includes("your-anon") &&
    url.startsWith("https://")
  );

  return {
    url,
    anonKey,
    isConfigured
  };
}

export function saveSupabaseCredentials(url, key) {
  if (url && key) {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("transmove_supabase_url", url.trim());
      window.localStorage.setItem("transmove_supabase_key", key.trim());
      window.location.reload();
    }
  }
}

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseCredentials();

  // Browser environment
  if (typeof window !== "undefined") {
    if (window.supabase && window.supabase.createClient) {
      supabaseInstance = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
      return supabaseInstance;
    }
    console.warn("Supabase JS SDK not found on window object. CDN script may still be loading.");
    return null;
  }

  return null;
}

export async function getAuthJwt() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    } catch (_) {}
  }
  return "";
}

export async function checkSupabaseConnection() {
  const { isConfigured, url } = getSupabaseCredentials();
  if (!isConfigured) {
    return { connected: false, error: "Supabase credentials not configured." };
  }

  const client = getSupabase();
  if (!client) return { connected: false, error: "Supabase SDK not loaded." };

  try {
    const { error } = await client.auth.getSession();
    if (error) return { connected: false, error: error.message };
    return { connected: true, url };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// Trigger background runtime config synchronization
if (typeof window !== "undefined") {
  syncRuntimeConfig().catch(() => {});
}
