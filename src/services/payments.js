// ==============================================================================
// TRANSMOVE MANUAL ECOCASH PAYMENT SERVICE
// Client service for EcoCash payment destinations, proof uploads,
// and manual payment submissions with server-side verification.
// ==============================================================================
import {
  APPWRITE_CONFIG,
  getAppwriteAccount,
  getAppwriteStorage,
  getTrustedApiEndpoint,
  ID,
  Permission,
  Role
} from "../config/appwrite.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const account = getAppwriteAccount();
  let jwt = null;

  try {
    const jwtRes = await account.createJWT();
    jwt = jwtRes.jwt;
  } catch (_) {
    // Unauthenticated or guest calls for public actions
  }

  const headers = {
    "Content-Type": "application/json"
  };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
    headers["X-Appwrite-JWT"] = jwt;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data })
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
   * Uploads payment proof image/screenshot securely to Appwrite storage.
   * File is restricted to the authenticated user and server admin.
   *
   * @param {File} file
   * @returns {Promise<string>} Appwrite file ID
   */
  async uploadPaymentProof(file) {
    if (!file) throw new Error("Proof screenshot is required.");

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error("Proof file exceeds maximum size of 5MB. Please upload a smaller image.");
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const allowedExtension = /\.(?:jpe?g|png|webp)$/i.test(file.name || "");
    if (!allowedTypes.has(String(file.type || "").toLowerCase()) || !allowedExtension) {
      throw new Error("Proof must be a JPG, PNG, or WebP image.");
    }

    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user || !user.$id) throw new Error("Authentication required to upload payment proof.");

    const storage = getAppwriteStorage();
    const fileId = ID.unique();

    const uploaded = await storage.createFile(
      APPWRITE_CONFIG.bucketId,
      fileId,
      file,
      [
        Permission.read(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );

    return uploaded.$id;
  },

  async deletePaymentProof(fileId) {
    if (!fileId) return;
    await getAppwriteStorage().deleteFile(APPWRITE_CONFIG.bucketId, fileId);
  },

  /**
   * Gets a view/preview URL for a payment proof screenshot.
   */
  getProofViewUrl(fileId) {
    if (!fileId) return null;
    const storage = getAppwriteStorage();
    return storage.getFileView(APPWRITE_CONFIG.bucketId, fileId);
  },

  /**
   * Submits an EcoCash manual payment for admin review.
   *
   * @param {Object} paymentData
   * @param {'subscription'|'advertising'|'booking'} paymentData.payment_type
   * @param {string} paymentData.related_id - Plan ID/slug, campaign ID, or booking ID
   * @param {string} paymentData.payment_destination_id - Chosen destination ID
   * @param {string} paymentData.sender_name - Full name of sender
   * @param {string} paymentData.sender_phone - Phone number payment sent from
   * @param {string} paymentData.transaction_reference - EcoCash transaction ref/code
   * @param {string} paymentData.proof_file_id - Appwrite file ID of uploaded screenshot
   * @param {number} [paymentData.amount_declared] - Amount sender claims to have sent
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
