// ==============================================================================
// TRANSMOVE ADVERTISING SERVICE (SUPABASE & GOOGLE DRIVE & ECOCASH)
// Rate cards, cost calculator, campaign creation, and EcoCash payment flow.
// Fully migrated to Supabase Auth and Google Drive file storage via trusted API.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";
import { PaymentService } from "./payments.js";

async function trustedCall(action, data = {}) {
  let jwt = await getAuthJwt();

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

  async getActivePopupAds() {
    const result = await trustedCall("list_active_popup_ads", {});
    return (result.campaigns || []).map((campaign) => ({
      ...campaign,
      image_url: campaign.image_url || (campaign.image_file_id
        ? `/api/files/preview/${encodeURIComponent(campaign.image_file_id)}`
        : "")
    }));
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
   * Uploads an ad banner/creative image to Google Drive storage via trusted backend.
   */
  async uploadAdImage(file) {
    if (!file) throw new Error("No image file provided.");

    // Convert file to Base64
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

    const res = await trustedCall("upload_ad_asset", {
      file_base64: base64,
      original_filename: file.name || "campaign_asset.jpg",
      mime_type: file.type || "image/jpeg",
      file_size: file.size || 0
    });

    return res.file_id || res.$id;
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
