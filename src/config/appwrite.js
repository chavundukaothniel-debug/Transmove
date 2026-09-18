// ==============================================================================
// TRANSMOVE APPWRITE CLIENT CONFIGURATION (BROWSER SAFE)
// Official Appwrite Web SDK Client
// NEVER includes or exposes APPWRITE_API_KEY
// ==============================================================================
import { Client, Account, Databases, Storage, ID, Query, Permission, Role } from "../../assets/js/vendor/appwrite.js";

const getStoredValue = (key, fallback) => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key) || fallback;
    }
  } catch (_) {}
  return fallback;
};

export const APPWRITE_CONFIG = {
  endpoint: getStoredValue("transmove_appwrite_endpoint", "https://fra.cloud.appwrite.io/v1"),
  projectId: getStoredValue("transmove_appwrite_project_id", "6aaa6531003d5747b640"),
  databaseId: "transmove",
  bucketId: "transmove-files"
};

let clientInstance = null;
let accountInstance = null;
let databasesInstance = null;

// In-memory JWT cache to prevent exhausting Appwrite /account/jwts rate limits
let cachedJWT = null;
let cachedJWTExpiresAt = 0;
let jwtInFlightPromise = null;

export function clearAppwriteJWTCache() {
  cachedJWT = null;
  cachedJWTExpiresAt = 0;
  jwtInFlightPromise = null;
}

export async function getAppwriteJWT(forceRefresh = false) {
  const now = Date.now();
  // Appwrite JWT tokens are valid for 15 minutes. Cache for 10 minutes (with 5-min safety window).
  if (!forceRefresh && cachedJWT && cachedJWTExpiresAt > now) {
    return cachedJWT;
  }
  if (jwtInFlightPromise) {
    return await jwtInFlightPromise;
  }

  jwtInFlightPromise = (async () => {
    const rawAccount = accountInstance || new Account(getAppwriteClient());
    const originalCreateJWT = rawAccount._originalCreateJWT || rawAccount.createJWT.bind(rawAccount);

    const delays = [1000, 2000, 4000];
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await originalCreateJWT();
        if (res && res.jwt) {
          cachedJWT = res.jwt;
          cachedJWTExpiresAt = Date.now() + 10 * 60 * 1000;
          return cachedJWT;
        }
        throw new Error("Invalid JWT returned by Appwrite.");
      } catch (err) {
        lastError = err;
        const is429 = err?.code === 429 ||
          err?.message?.toLowerCase().includes("rate limit") ||
          err?.type === "general_rate_limit_exceeded";

        if (is429 && attempt < 3) {
          const waitMs = delays[attempt - 1] || 1000;
          console.warn(`[getAppwriteJWT] Rate limit (429) encountered. Retrying in ${waitMs}ms (attempt ${attempt}/3)...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error("Failed to obtain Appwrite authentication token.");
  })();

  try {
    return await jwtInFlightPromise;
  } finally {
    jwtInFlightPromise = null;
  }
}

export function getAppwriteClient() {
  if (!clientInstance) {
    clientInstance = new Client()
      .setEndpoint(APPWRITE_CONFIG.endpoint)
      .setProject(APPWRITE_CONFIG.projectId);
  }
  return clientInstance;
}

export function getAppwriteAccount() {
  if (!accountInstance) {
    const rawAccount = new Account(getAppwriteClient());
    rawAccount._originalCreateJWT = rawAccount.createJWT.bind(rawAccount);
    rawAccount.createJWT = async function (forceRefresh = false) {
      const jwt = await getAppwriteJWT(forceRefresh);
      return { jwt };
    };
    accountInstance = rawAccount;
  }
  return accountInstance;
}

export function getAppwriteDatabases() {
  if (!databasesInstance) {
    databasesInstance = new Databases(getAppwriteClient());
  }
  return databasesInstance;
}

let storageInstance = null;

export function getAppwriteStorage() {
  if (!storageInstance) {
    storageInstance = new Storage(getAppwriteClient());
  }
  return storageInstance;
}

export function getTrustedApiEndpoint() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    if (window.location.origin === "http://localhost:3000") {
      return "http://localhost:8080/.netlify/functions/trusted-api";
    }
    return `${window.location.origin}/.netlify/functions/trusted-api`;
  }
  return "http://localhost:8080/.netlify/functions/trusted-api";
}

export { Storage, ID, Query, Permission, Role };

