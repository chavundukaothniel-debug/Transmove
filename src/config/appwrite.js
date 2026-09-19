// ==============================================================================
// TRANSMOVE APPWRITE CLIENT CONFIGURATION (BROWSER SAFE)
// Official Appwrite Web SDK Client
// NEVER includes or exposes APPWRITE_API_KEY
// ==============================================================================
import { Client, Account, Databases, Storage, ID, Query, Permission, Role } from "../../assets/js/vendor/appwrite.js";

const getStoredValue = (key, fallback) => {
  try {
    if (typeof process !== "undefined" && process.env) {
      if (key === "transmove_database_provider" && process.env.DATABASE_PROVIDER) return process.env.DATABASE_PROVIDER;
      if (key === "transmove_file_storage_provider" && process.env.FILE_STORAGE_PROVIDER) return process.env.FILE_STORAGE_PROVIDER;
    }
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

import { getSupabase, getAuthJwt } from "./supabase.js";

export function getAppwriteAccount() {
  if (!accountInstance) {
    const rawAccount = new Account(getAppwriteClient());
    rawAccount._originalCreateJWT = rawAccount.createJWT.bind(rawAccount);
    rawAccount._originalGet = rawAccount.get.bind(rawAccount);

    rawAccount.createJWT = async function (forceRefresh = false) {
      const provider = getStoredValue("transmove_database_provider", "supabase");
      if (provider === "supabase") {
        const jwt = await getAuthJwt();
        if (jwt) return { jwt };
      }
      const jwt = await getAppwriteJWT(forceRefresh);
      return { jwt };
    };

    rawAccount.get = async function () {
      const provider = getStoredValue("transmove_database_provider", "supabase");
      if (provider === "supabase") {
        try {
          const supabase = getSupabase();
          if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              return {
                $id: user.id,
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || user.email,
                phone: user.phone || ""
              };
            }
          }
        } catch (_) {}
        const mockUserStr = getStoredValue("transmove_mock_user", null);
        if (mockUserStr) {
          try {
            return JSON.parse(mockUserStr);
          } catch (_) {}
        }
      }
      return await rawAccount._originalGet();
    };

    accountInstance = rawAccount;
  }
  return accountInstance;
}

export function getAppwriteDatabases() {
  if (!databasesInstance) {
    const rawDatabases = new Databases(getAppwriteClient());
    rawDatabases._originalCreateDocument = rawDatabases.createDocument.bind(rawDatabases);
    rawDatabases._originalUpdateDocument = rawDatabases.updateDocument.bind(rawDatabases);
    rawDatabases._originalDeleteDocument = rawDatabases.deleteDocument.bind(rawDatabases);

    rawDatabases.createDocument = function () {
      const provider = getStoredValue("transmove_database_provider", "supabase");
      if (provider === "supabase") {
        throw new Error("[SafetyGuard] Appwrite database writes are blocked when DATABASE_PROVIDER=supabase. All writes must route through trusted backend/Supabase.");
      }
      return rawDatabases._originalCreateDocument.apply(rawDatabases, arguments);
    };

    rawDatabases.updateDocument = function () {
      const provider = getStoredValue("transmove_database_provider", "supabase");
      if (provider === "supabase") {
        throw new Error("[SafetyGuard] Appwrite database writes are blocked when DATABASE_PROVIDER=supabase. All writes must route through trusted backend/Supabase.");
      }
      return rawDatabases._originalUpdateDocument.apply(rawDatabases, arguments);
    };

    rawDatabases.deleteDocument = function () {
      const provider = getStoredValue("transmove_database_provider", "supabase");
      if (provider === "supabase") {
        throw new Error("[SafetyGuard] Appwrite database writes are blocked when DATABASE_PROVIDER=supabase. All writes must route through trusted backend/Supabase.");
      }
      return rawDatabases._originalDeleteDocument.apply(rawDatabases, arguments);
    };

    databasesInstance = rawDatabases;
  }
  return databasesInstance;
}

let storageInstance = null;

export function getAppwriteStorage() {
  if (!storageInstance) {
    const rawStorage = new Storage(getAppwriteClient());
    rawStorage._originalCreateFile = rawStorage.createFile.bind(rawStorage);
    rawStorage._originalDeleteFile = rawStorage.deleteFile.bind(rawStorage);
    rawStorage._originalGetFileView = rawStorage.getFileView.bind(rawStorage);

    rawStorage.createFile = function () {
      const provider = getStoredValue("transmove_file_storage_provider", "google_drive");
      if (provider === "google_drive") {
        throw new Error("[SafetyGuard] Appwrite Storage uploads are blocked when FILE_STORAGE_PROVIDER=google_drive. Files must be uploaded to Google Drive via trusted backend.");
      }
      return rawStorage._originalCreateFile.apply(rawStorage, arguments);
    };

    rawStorage.deleteFile = function () {
      const provider = getStoredValue("transmove_file_storage_provider", "google_drive");
      if (provider === "google_drive") {
        throw new Error("[SafetyGuard] Appwrite Storage mutations are blocked when FILE_STORAGE_PROVIDER=google_drive.");
      }
      return rawStorage._originalDeleteFile.apply(rawStorage, arguments);
    };

    rawStorage.getFileView = function (bucketId, fileId) {
      const provider = getStoredValue("transmove_file_storage_provider", "google_drive");
      if (provider === "google_drive" && fileId) {
        return `/api/files/preview/${encodeURIComponent(fileId)}`;
      }
      return rawStorage._originalGetFileView(bucketId, fileId);
    };
    storageInstance = rawStorage;
  }
  return storageInstance;
}

export function getTrustedApiEndpoint() {
  if (typeof window !== "undefined") {
    const isCapacitor = Boolean(window.Capacitor?.isNativePlatform?.() || window.location?.protocol === "capacitor:");
    if (isCapacitor) {
      return "https://transmove.onrender.com/.netlify/functions/trusted-api";
    }

    if (window.location && window.location.origin) {
      if (window.location.origin === "http://localhost:3000" || window.location.origin === "http://localhost:8080") {
        return `${window.location.origin}/.netlify/functions/trusted-api`;
      }
      const storedBase = getStoredValue("transmove_api_base", null);
      if (storedBase) {
        return `${storedBase.replace(/\/+$/, "")}/.netlify/functions/trusted-api`;
      }
      return `${window.location.origin}/.netlify/functions/trusted-api`;
    }
  }
  return "http://localhost:8080/.netlify/functions/trusted-api";
}

export { Storage, ID, Query, Permission, Role };

