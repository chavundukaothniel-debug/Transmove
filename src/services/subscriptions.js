// ==============================================================================
// TRANSMOVE SUBSCRIPTION & REAL PAYNOW PAYMENT SERVICE
// Subscriptions activated ONLY upon genuine verified Paynow payment
// ==============================================================================
import { getAppwriteAccount, getTrustedApiEndpoint } from "../config/appwrite.js";

async function trustedCall(action, data = {}) {
  const account = getAppwriteAccount();
  const jwt = (await account.createJWT()).jwt;
  const response = await fetch(getTrustedApiEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Appwrite-JWT": jwt
    },
    body: JSON.stringify({ action, data })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Trusted API error (HTTP ${response.status})`);
  return result;
}

export const SubscriptionService = {
  /**
   * Fetches active subscription plans.
   */
  async getPlans() {
    return [{
      id: "plan-professional",
      name: "TransMove Professional",
      tier: "professional",
      price: 15.00,
      currency: "USD",
      billing_interval: "monthly",
      role_target: "provider",
      features: [
        "Unlimited transport & driver bidding",
        "Priority marketplace request dispatch",
        "Verified Provider Badge",
        "Vehicle & equipment rental listings",
        "Dedicated driver support"
      ]
    }];
  },

  /**
   * Fetches the current user's active subscription.
   */
  async getCurrentSubscription() {
    const result = await trustedCall("get_subscription_status");
    return result.active ? result : null;
  },

  async getSubscriptionStatus() {
    return trustedCall("get_subscription_status");
  },

  async getPaymentHistory() {
    const result = await trustedCall("list_user_payments");
    return result.payments || [];
  },

  /**
   * Initiates real Paynow payment for a $15 Professional Subscription plan.
   */
  async subscribeWithPaynow(plan) {
    throw new Error("Paynow subscription processing is currently deferred.");
  },

  /**
   * Server-side verified subscription activation and idempotency check.
   */
  async verifyAndActivateSubscription(transactionId, paynowRef) {
    throw new Error("Subscription activation requires a trusted, verified Paynow callback and is currently deferred.");
  }
};
