// ==============================================================================
// TRANSMOVE SUPABASE CLIENT CONFIGURATION
// PRIMARY APPLICATION BACKEND
// ==============================================================================

const DEFAULT_SUPABASE_URL = "https://mhghjurlwmgeiuhcxieg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZ2hqdXJsd21nZWl1aGN4aWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTczNjgsImV4cCI6MjEwNDk3MzM2OH0.ZkI-ZdrZq-KSCQDEJCEJZ5RoJVK7XGSSzvzNgJu7Ui4";

export function getSupabaseCredentials() {
  let customUrl = null;
  let customKey = null;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      customUrl = window.localStorage.getItem("transmove_supabase_url");
      customKey = window.localStorage.getItem("transmove_supabase_key");
    } else if (typeof process !== "undefined" && process.env) {
      customUrl = process.env.SUPABASE_URL;
      customKey = process.env.SUPABASE_ANON_KEY;
    }
  } catch (_) {}

  const url = customUrl || DEFAULT_SUPABASE_URL;
  const anonKey = customKey || DEFAULT_SUPABASE_ANON_KEY;

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
          detectSessionInUrl: true
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });
      return supabaseInstance;
    }
    console.warn("Supabase JS SDK not found in window object. CDN may still be loading.");
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
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage.getItem("transmove_mock_jwt") || "";
  }
  return "";
}

export async function checkSupabaseConnection() {
  const { isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    return { connected: false, error: "Supabase credentials not configured yet" };
  }

  const client = getSupabase();
  if (!client) return { connected: false, error: "Supabase SDK not loaded" };

  try {
    const { data, error } = await client.from("profiles").select("id").limit(1);
    if (error && error.code !== "PGRST116" && !error.message.includes("0 rows")) {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}
