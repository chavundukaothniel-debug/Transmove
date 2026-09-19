// ==============================================================================
// TRANSMOVE AUTOMATIC DRIVER PRESENCE & HEARTBEAT SERVICE
// Automatically tracks driver presence via periodic background heartbeat
// Online/offline status is derived strictly server-side (timeout: 3 minutes)
// NO manual toggle exists or is added.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

let heartbeatInterval = null;
let focusHandler = null;

async function trustedCall(action, data = {}) {
  const jwt = await getAuthJwt();
  if (!jwt) return {};

  const endpoint = getTrustedApiEndpoint();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ action, data, jwt })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Trusted API error (HTTP ${res.status})`);
  }
  return body;
}

export const PresenceService = {
  /**
   * Heartbeat interval: 45 seconds (45,000 ms).
   * Offline threshold: 3 minutes (180,000 ms).
   */
  HEARTBEAT_INTERVAL_MS: 45000,
  STALE_TIMEOUT_MS: 180000,

  /**
   * Starts the background heartbeat timer for the authenticated driver.
   * Sends heartbeat immediately and then every 45 seconds.
   */
  startHeartbeat(userId) {
    if (!userId) return Promise.resolve();
    this.stopHeartbeat();

    // Initial heartbeat
    const initial = this.sendHeartbeat(userId);

    // Periodic heartbeat every 45 seconds
    heartbeatInterval = setInterval(() => {
      this.sendHeartbeat(userId);
    }, this.HEARTBEAT_INTERVAL_MS);

    // Send heartbeat when user returns to window tab
    if (typeof window !== "undefined" && window.addEventListener) {
      focusHandler = () => this.sendHeartbeat(userId);
      window.addEventListener("focus", focusHandler);
    }

    return initial;
  },

  /**
   * Sends a heartbeat update to driver_presence.
   */
  async sendHeartbeat(userId) {
    if (!userId) return;

    try {
      await trustedCall("driver_heartbeat", {});
    } catch (err) {
      console.warn("Heartbeat notice:", err.message);
    }
  },

  /**
   * Stops the background heartbeat timer and cleans up window listeners.
   */
  stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    if (focusHandler && typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("focus", focusHandler);
      focusHandler = null;
    }
  },

  /**
   * Determines whether a driver is online based on last_seen_at / updated_at timestamp.
   * Driver is considered online if timestamp is within the last 3 minutes (180,000 ms).
   */
  isOnline(timestamp) {
    if (!timestamp) return false;
    const lastSeen = new Date(timestamp).getTime();
    if (isNaN(lastSeen)) return false;
    const now = Date.now();
    return (now - lastSeen) <= this.STALE_TIMEOUT_MS;
  },

  /**
   * Fetches the current online status for a specific driver.
   */
  async getDriverPresence(driverId) {
    if (!driverId) return { driver_id: null, online: false, last_seen_at: null };
    try {
      return await trustedCall("get_driver_presence", { driver_id: driverId });
    } catch (err) {
      return { driver_id: driverId, online: false, last_seen_at: null };
    }
  }
};
