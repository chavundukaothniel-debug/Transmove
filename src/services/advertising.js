// ==============================================================================
// TRANSMOVE ADVERTISING SERVICE (APPWRITE & ECOCASH)
// Rate cards, cost calculator, campaign creation, and EcoCash payment flow.
// Fully migrated to Appwrite and trusted API.
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
import { PaymentService } from "./payments.js";

async function trustedCall(action, data = {}) {
  const account = getAppwriteAccount();
  let jwt = null;
  try {
    const jwtRes = await account.createJWT();
    jwt = jwtRes.jwt;
  } catch (_) {
    // Guest calls for public calculator / rate cards
  }

  const headers = { "Content-Type": "application/json" };
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
    headers["X-Appwrite-JWT"] = jwt;
  }

  const response = await fetch(getTrustedApiEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ action, data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Advertising API error (HTTP ${response.status})`);
  return result;
}

export const AdvertisingService = {
  /**
   * Fetches active placement rate cards.
   */
  async getRateCards() {
    const result = await trustedCall("list_ad_rate_cards", {});
    return result.rate_cards || [];
  },

  /**
   * Fetches preset advertising packages.
   */
  async getPackages() {
    const result = await trustedCall("list_ad_packages", {});
    return result.packages || [];
  },

  /**
   * Calculates dynamic ad price via server validation.
   *
   * @param {Object} params
   * @param {string} [params.placement]
   * @param {number} [params.duration_days]
   * @param {boolean} [params.is_targeted]
   * @param {boolean} [params.is_featured]
   * @param {string} [params.package_slug]
   */
  async calculatePrice(params) {
    return trustedCall("calculate_ad_price", params);
  },

  /**
   * Uploads an ad banner/creative image to Appwrite storage.
   */
  async uploadAdImage(file) {
    if (!file) throw new Error("No image file provided.");
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user || !user.$id) throw new Error("Login required to upload campaign creative.");

    const storage = getAppwriteStorage();
    const fileId = ID.unique();

    const uploaded = await storage.createFile(
      APPWRITE_CONFIG.bucketId,
      fileId,
      file,
      [
        Permission.read(Role.any()), // Ads are public once active
        Permission.delete(Role.user(user.$id))
      ]
    );
    return uploaded.$id;
  },

  /**
   * Submits a new advertising campaign draft.
   */
  async submitCampaign(campaignData) {
    return trustedCall("submit_ad_campaign", campaignData);
  },

  /**
   * Fetches active EcoCash payment destinations for ad payment.
   */
  async getPaymentDestinations() {
    return PaymentService.getPaymentDestinations();
  },

  /**
   * Submits EcoCash payment for an ad campaign.
   */
  async submitCampaignPayment({
    campaignId,
    destinationId,
    senderName,
    senderPhone,
    transactionRef,
    proofFileId,
    amountDeclared
  }) {
    return PaymentService.submitEcocashPayment({
      payment_type: "advertising",
      related_id: campaignId,
      payment_destination_id: destinationId,
      sender_name: senderName,
      sender_phone: senderPhone,
      transaction_reference: transactionRef,
      proof_file_id: proofFileId,
      amount_declared: amountDeclared
    });
  }
};
