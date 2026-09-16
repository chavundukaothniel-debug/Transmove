// ==============================================================================
// TRANSMOVE SUPABASE CLIENT CONFIGURATION
// SOLE APPLICATION BACKEND
// ==============================================================================

const DEFAULT_SUPABASE_URL = "https://mhghjurlwmgeiuhcxieg.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZ2hqdXJsd21nZWl1aGN4aWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTczNjgsImV4cCI6MjEwNDk3MzM2OH0.ZkI-ZdrZq-KSCQDEJCEJZ5RoJVK7XGSSzvzNgJu7Ui4";

export function getSupabaseCredentials() {
  const customUrl = localStorage.getItem("transmove_supabase_url");
  const customKey = localStorage.getItem("transmove_supabase_key");
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
    localStorage.setItem("transmove_supabase_url", url.trim());
    localStorage.setItem("transmove_supabase_key", key.trim());
    window.location.reload();
  }
}

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey } = getSupabaseCredentials();

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
  } else {
    console.error("Supabase JS SDK not found in window object.");
    return null;
  }
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
