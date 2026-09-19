// ==============================================================================
// TRANSMOVE DISPUTES & USER REPORTING SERVICE
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const jwt = await getAuthJwt();
  if (!jwt) throw new Error("Authentication required.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({ action, data, jwt })
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Dispute operation failed.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export const DisputeService = {
  /**
   * Files a dispute tied to a legitimate booking.
   */
  async createDispute({ bookingId, reason, details, evidenceUrl }) {
    if (!bookingId) throw new Error("bookingId is required.");
    if (!reason) throw new Error("reason is required.");
    return callTrustedApi("create_dispute", {
      booking_id: bookingId,
      reason,
      details,
      evidence_url: evidenceUrl
    });
  },

  /**
   * Lists disputes. Returns participant's disputes for regular users, or all disputes for admin.
   */
  async listDisputes() {
    const res = await callTrustedApi("list_disputes", {});
    return res.disputes || [];
  },

  /**
   * Admin: Resolves a dispute with resolution notes.
   */
  async resolveDispute({ disputeId, resolution }) {
    if (!disputeId) throw new Error("disputeId is required.");
    if (!resolution) throw new Error("resolution is required.");
    return callTrustedApi("resolve_dispute", {
      dispute_id: disputeId,
      resolution
    });
  }
};
