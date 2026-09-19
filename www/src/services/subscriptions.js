// ==============================================================================
// TRANSMOVE SUBSCRIPTION SERVICE (ECOCASH MANUAL PAYMENTS)
// Provider subscription plans, status verification, and EcoCash payment submission.
// Subscription activation uses manual EcoCash proof + admin verification.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";
import { PaymentService } from "./payments.js";

async function trustedCall(action, data = {}) {
  let jwt = null;
  try {
    jwt = await getAuthJwt();
  } catch (_) {
    // Guest access for public plan listing
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
  if (!response.ok) throw new Error(result.error || `Trusted API error (HTTP ${response.status})`);
  return result;
}

export const SubscriptionService = {
  /**
   * Fetches active provider subscription plans from the server database.
   */
  async getPlans() {
    const result = await trustedCall("list_subscription_plans", {});
    if (!Array.isArray(result.plans) || result.plans.length === 0) {
      throw new Error("No active subscription plans are currently available.");
    }
    return result.plans;
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
