// ==============================================================================
// TRANSMOVE SUBSCRIPTION SERVICE (ECOCASH MANUAL PAYMENTS)
// Provider subscription plans, status verification, and EcoCash payment submission.
// Paynow has been completely replaced with manual EcoCash + admin verification.
// ==============================================================================
import { getAppwriteAccount, getTrustedApiEndpoint } from "../config/appwrite.js";
import { PaymentService } from "./payments.js";

async function trustedCall(action, data = {}) {
  const account = getAppwriteAccount();
  let jwt = null;
  try {
    const jwtRes = await account.createJWT();
    jwt = jwtRes.jwt;
  } catch (_) {
    // Guest access for public plan listing
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
  if (!response.ok) throw new Error(result.error || `Trusted API error (HTTP ${response.status})`);
  return result;
}

export const SubscriptionService = {
  /**
   * Fetches active provider subscription plans from the server database.
   */
  async getPlans() {
    try {
      const result = await trustedCall("list_subscription_plans", {});
      if (result.plans && result.plans.length > 0) {
        return result.plans;
      }
    } catch (err) {
      console.warn("Failed to fetch dynamic subscription plans, using fallback list:", err.message);
    }

    // High-fidelity fallback if network error
    return [
      {
        id: "flex-pass",
        name: "Flex Pass",
        slug: "flex-pass",
        price: 5.00,
        currency: "USD",
        duration_days: 7,
        recommended: false,
        description: "7-day access for short-term and flexible providers",
        features: [
          "Full bidding access for 7 days",
          "Direct passenger & shipper communication",
          "Standard marketplace listing",
          "EcoCash manual verification"
        ]
      },
      {
        id: "professional",
        name: "TransMove Professional",
        slug: "professional",
        price: 15.00,
        currency: "USD",
        duration_days: 30,
        recommended: true,
        description: "Standard 30-day access with full bidding & route tools",
        features: [
          "Full bidding access for 30 days",
          "Direct passenger & shipper communication",
          "Priority vehicle listing in search",
          "Verified Driver badge on profile",
          "Automated receipt & invoice history"
        ]
      },
      {
        id: "pro-90",
        name: "Pro 90",
        slug: "pro-90",
        price: 40.00,
        currency: "USD",
        duration_days: 90,
        recommended: false,
        description: "Quarterly savings for consistent transport professionals",
        features: [
          "Full bidding access for 90 days (save $5)",
          "Featured placement in provider search",
          "Direct customer phone & chat connections",
          "Quarterly performance badge",
          "Priority dispute resolution"
        ]
      },
      {
        id: "pro-annual",
        name: "Pro Annual",
        slug: "pro-annual",
        price: 140.00,
        currency: "USD",
        duration_days: 365,
        recommended: false,
        description: "Best annual value with priority support and marketplace badge",
        features: [
          "Full bidding access for 365 days (save $40)",
          "Top-tier priority in search & matching",
          "Gold Verified Provider profile badge",
          "Dedicated account & support line",
          "Complimentary 7-day Search Sponsored ad"
        ]
      }
    ];
  },

  /**
   * Fetches active EcoCash payment destinations.
   */
  async getPaymentDestinations() {
    return PaymentService.getPaymentDestinations();
  },

  /**
   * Uploads screenshot proof of payment.
   */
  async uploadProof(file) {
    return PaymentService.uploadPaymentProof(file);
  },

  /**
   * Fetches the current provider's subscription and free job status.
   */
  async getSubscriptionStatus() {
    return trustedCall("get_subscription_status");
  },

  /**
   * Fetches the current user's active subscription (if active).
   */
  async getCurrentSubscription() {
    const result = await trustedCall("get_subscription_status");
    return result.active ? result : null;
  },

  /**
   * Submits an EcoCash payment for a subscription plan.
   *
   * @param {Object} params
   * @param {string} params.planId - Plan ID or slug
   * @param {string} params.destinationId - Payment destination ID
   * @param {string} params.senderName - Name of sender on EcoCash
   * @param {string} params.senderPhone - Phone number payment sent from
   * @param {string} params.transactionRef - EcoCash confirmation code
   * @param {string} params.proofFileId - Appwrite file ID of payment proof screenshot
   * @param {number} [params.amountDeclared] - Declared amount
   */
  async submitSubscriptionPayment({
    planId,
    destinationId,
    senderName,
    senderPhone,
    transactionRef,
    proofFileId,
    amountDeclared
  }) {
    return PaymentService.submitEcocashPayment({
      payment_type: "subscription",
      related_id: planId,
      payment_destination_id: destinationId,
      sender_name: senderName,
      sender_phone: senderPhone,
      transaction_reference: transactionRef,
      proof_file_id: proofFileId,
      amount_declared: amountDeclared
    });
  },

  /**
   * Fetches payment history for subscriptions & jobs.
   */
  async getPaymentHistory() {
    const result = await trustedCall("list_user_payments");
    return result.payments || [];
  }
};
