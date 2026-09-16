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
    accountInstance = new Account(getAppwriteClient());
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

