// ==============================================================================
// TRANSMOVE MANUAL ECOCASH PAYMENT SERVICE
// Client service for EcoCash payment destinations, proof uploads (Google Drive),
// and manual payment submissions with server-side verification.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getSupabase } from "../config/supabase.js";

async function getAuthJwt() {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    } catch (_) {}
  }
  return localStorage.getItem("transmove_mock_jwt") || "";
}

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const jwt = await getAuthJwt();

  const headers = {
    "Content-Type": "application/json"
  };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data, jwt })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || `Payment service error (HTTP ${res.status})`);
    error.status = res.status;
    throw error;
  }
  return json;
}

export const PaymentService = {
  /**
   * Fetches active EcoCash payment destinations for users to choose where to send funds.
   */
  async getPaymentDestinations() {
    const result = await callTrustedApi("list_payment_destinations");
    return result.destinations || [];
  },

  /**
   * Uploads payment proof image/screenshot securely to Google Drive via trusted backend.
   *
   * @param {File} file
   * @returns {Promise<string>} Google Drive file ID
   */
  async uploadPaymentProof(file) {
    if (!file) throw new Error("Proof screenshot is required.");

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error("Proof file exceeds maximum size of 5MB. Please upload a smaller image.");
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const allowedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name || "");
    if (!allowedTypes.has(String(file.type || "").toLowerCase()) || !allowedExtension) {
      throw new Error("Proof must be a JPG, PNG, or WebP image.");
    }

    // Convert to Base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64String = result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await callTrustedApi("upload_payment_proof", {
      file_base64: base64,
      original_filename: file.name,
      mime_type: file.type || "image/jpeg",
      file_size: file.size
    });

    return res.file_id || res.$id;
  },

  async deletePaymentProof(fileId) {
    // Retained for interface compatibility
  },

  /**
   * Gets a view/preview URL for a payment proof screenshot from Google Drive.
   */
  getProofViewUrl(fileId) {
    if (!fileId) return null;
    return `/api/files/preview/${encodeURIComponent(fileId)}`;
  },

  /**
   * Submits an EcoCash manual payment for admin review.
   * Persists payment_destination_id correctly.
   */
  async submitEcocashPayment(paymentData) {
    return callTrustedApi("submit_ecocash_payment", paymentData);
  },

  /**
   * Fetches payment history for current logged-in user.
   */
  async getUserPayments() {
    const result = await callTrustedApi("list_user_payments");
    return result.payments || [];
  }
};
