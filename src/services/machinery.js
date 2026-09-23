// ==============================================================================
// TRANSMOVE MACHINERY SERVICE
// Handles machinery marketplace listings, search, filtering, hire requests,
// operator-inclusive pricing snapshots, Google Drive photo uploads, and sponsored ads.
// Uses Supabase authoritative backend + Render trusted endpoints.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

export const MACHINERY_CATEGORIES = [
  "Excavators",
  "Bulldozers",
  "TLB / Backhoe Loaders",
  "Graders",
  "Loaders",
  "Dump Trucks",
  "Cranes",
  "Forklifts",
  "Tractors",
  "Combine Harvesters",
  "Drilling Equipment",
  "Compressors",
  "Generators",
  "Mining Equipment",
  "Other"
];

async function trustedCall(action, data = {}) {
  let jwt = null;
  try {
    jwt = await getAuthJwt();
  } catch (_) {
    // Guest browsing allowed for public actions
  }

  const headers = { "Content-Type": "application/json" };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  const response = await fetch(getTrustedApiEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data, jwt })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Machinery service error (HTTP ${response.status})`);
  }
  return result;
}

export const MachineryService = {
  /**
   * Search and filter machinery marketplace listings.
   * Authoritative backend returns sponsored listings prioritized first.
   */
  async listMarketplace(filters = {}) {
    const res = await trustedCall("list_machinery_marketplace", filters);
    return res.machinery || [];
  },

  /**
   * Get single machinery details with owner info.
   */
  async getDetails(machineryId) {
    if (!machineryId) throw new Error("Machinery ID is required.");
    return await trustedCall("get_machinery_details", { machinery_id: machineryId });
  },

  /**
   * Create a new machinery listing (Owner role required).
   */
  async createListing(payload) {
    return await trustedCall("create_machinery_listing", payload);
  },

  /**
   * Update existing machinery listing.
   */
  async updateListing(machineryId, payload) {
    return await trustedCall("update_machinery_listing", { machinery_id: machineryId, ...payload });
  },

  /**
   * Submit hire request (With Operator vs Without Operator).
   * Backend enforces authoritative pricing calculation snapshot.
   */
  async submitHireRequest(payload) {
    return await trustedCall("submit_machinery_hire_request", payload);
  },

  /**
   * List hire requests received by current machinery owner.
   */
  async getOwnerHires() {
    const res = await trustedCall("list_owner_machinery_hires", {});
    return res.hires || [];
  },

  /**
   * List hire requests submitted by current renter (passenger/driver).
   */
  async getRenterHires() {
    const res = await trustedCall("list_renter_machinery_hires", {});
    return res.hires || [];
  },

  /**
   * Accept, decline, or cancel a hire request.
   */
  async updateHireStatus(hireId, status, reason = "") {
    return await trustedCall("update_machinery_hire_status", {
      hire_id: hireId,
      status,
      decline_reason: reason,
      reason
    });
  },

  /**
   * Promote machinery listing (Creates/activates sponsored advertising).
   */
  async promoteListing(machineryId, durationDays = 30) {
    return await trustedCall("promote_machinery_listing", {
      machinery_id: machineryId,
      duration_days: durationDays
    });
  },

  /**
   * Stop/pause active machinery advertising campaign.
   */
  async stopPromotion(machineryId) {
    return await trustedCall("stop_machinery_promotion", { machinery_id: machineryId });
  },

  /**
   * Fetch active sponsored machinery advertisement for passenger & driver dashboards.
   */
  async getActiveSponsoredAd() {
    const res = await trustedCall("get_active_sponsored_machinery", {});
    return res.sponsored_machinery || [];
  },

  /**
   * Dismiss sponsored advertisement for this user.
   */
  async dismissSponsoredAd(advertisementId) {
    if (!advertisementId) return { success: false };
    return await trustedCall("dismiss_sponsored_machinery_ad", { advertisement_id: advertisementId });
  },

  /**
   * Upload machinery photo to private Google Drive storage.
   */
  async uploadPhoto(file) {
    if (!file) throw new Error("No file selected.");
    if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds 10MB limit.");

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await trustedCall("upload_machinery_photo", {
      file_base64: base64,
      original_filename: file.name,
      mime_type: file.type || "image/jpeg"
    });

    return res;
  }
};
