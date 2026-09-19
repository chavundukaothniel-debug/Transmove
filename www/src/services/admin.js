// ==============================================================================
// TRANSMOVE SECURE ADMINISTRATIVE SERVICE
// Server-side / RLS verified Admin capabilities
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";
import { AuthService } from "./auth.js";

async function trustedCall(action, data = {}) {
  const jwt = await getAuthJwt();

  if (!jwt) {
    throw new Error("Authentication required.");
  }

  const response = await fetch(getTrustedApiEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({
      action,
      data
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error || `Trusted API error (HTTP ${response.status})`
    );
  }

  return result;
}

export const AdminService = {
  /**
   * Checks if the currently authenticated user has verified 'admin' role.
   */
  async verifyAdminAccess() {
    try {
      const profile = await AuthService.getCurrentProfile();
      if (!profile || profile.role !== "admin" || profile.account_status !== "active") return false;
      await trustedCall("admin_get_platform_stats");
      return true;
    } catch (_) {
      return false;
    }
  },

  /**
   * Fetches overall platform statistics (legacy).
   */
  async getPlatformStats() {
    const result = await trustedCall("admin_get_platform_stats");
    return { ...result, totalRevenue: Number(result.totalRevenue || 0).toFixed(2) };
  },

  /**
   * Fetches real Appwrite analytics metrics across all collections.
   */
  async getAnalytics() {
    const result = await trustedCall("admin_get_analytics", {});
    return {
      ...result,
      registeredPassengers: result.registeredPassengers ?? result.registered_passengers ?? 0,
      registeredProviders: result.registeredProviders ?? result.registered_providers ?? 0,
      activeProviders: result.activeProviders ?? result.active_providers ?? 0,
      requestsPosted: result.requestsPosted ?? result.requests_posted ?? 0,
      bookingsAwarded: result.bookingsAwarded ?? result.bookings_awarded ?? 0,
      completedBookings: result.completedBookings ?? result.completed_bookings ?? 0,
      cancelledBookings: result.cancelledBookings ?? result.cancelled_bookings ?? 0,
      activeSubscriptions: result.activeSubscriptions ?? result.active_subscriptions ?? 0,
      verificationQueue: result.verificationQueue ?? result.verification_queue ?? 0,
      pendingProviders: result.pendingProviders ?? result.pending_providers ?? 0,
      pendingVehicles: result.pendingVehicles ?? result.pending_vehicles ?? 0,
      pendingDocuments: result.pendingDocuments ?? result.pending_documents ?? 0,
      expiredDocuments: result.expiredDocuments ?? result.expired_documents ?? 0,
      paymentsTotal: result.paymentsTotal ?? result.payment_totals ?? 0,
      openDisputes: result.openDisputes ?? result.open_disputes ?? 0
    };
  },

  /**
   * Fetches recent audit logs.
   */
  async getActivityLogs() {
    const res = await trustedCall("admin_get_activity_logs", {});
    return res.logs || [];
  },

  /**
   * Fetches verification documents with categorized expiry status.
   */
  async getVerificationDocuments() {
    return trustedCall("admin_list_verification_documents", {});
  },

  /**
   * Audits documents for expiries and triggers notifications.
   */
  async checkDocumentExpiries() {
    return trustedCall("check_document_expiries", {});
  },

  /**
   * Fetches pending driver & owner verification requests.
   */
  async getVerifications(statusFilter = "pending") {
    return trustedCall("admin_list_verifications", { status_filter: statusFilter });
  },

  async getPendingVerifications() {
    const result = await this.getVerifications("pending");
    return result.verifications || [];
  },

  /**
   * Updates a user's driver/owner verification status.
   * Status: 'approved' | 'rejected' | 'suspended'
   */
  async updateVerificationStatus(userId, status, reason = null) {
    return trustedCall("admin_set_profile_verification", {
      profile_id: userId,
      verification_status: status,
      reason
    });
  },

  /**
   * Fetches all registered users for admin directory.
   */
  async getAllUsers() {
    const result = await trustedCall("admin_list_users");
    return result.users || [];
  },

  /**
   * Fetches all payment transactions ledger.
   */
  async getPaymentTransactions() {
    const result = await trustedCall("admin_list_payments");
    return result.payments || [];
  },

  /**
   * Fetches all bookings for administrative live monitoring.
   */
  async getAllBookings() {
    const result = await trustedCall("admin_list_bookings");
    return result.bookings || [];
  },

  async verifyDocument(documentId, verificationStatus = "verified", rejectionReason = null) {
    return trustedCall("admin_verify_document", {
      document_id: documentId,
      verification_status: verificationStatus,
      rejection_reason: rejectionReason
    });
  },

  async verifyVehicle(vehicleId, verificationStatus = "approved", rejectionReason = null) {
    return trustedCall("admin_verify_vehicle", {
      vehicle_id: vehicleId,
      verification_status: verificationStatus,
      rejection_reason: rejectionReason
    });
  },

  async openVerificationDocument(documentId) {
    return trustedCall("admin_create_verification_file_token", { document_id: documentId });
  },

  async setAccountStatus(profileId, accountStatus) {
    return trustedCall("admin_set_account_status", { profile_id: profileId, account_status: accountStatus });
  },

  // -------------------------------------------------------------
  // ECOCASH PAYMENT QUEUE & VERIFICATION
  // -------------------------------------------------------------
  /**
   * Fetches payments with optional status filter ('pending_review', 'approved', 'rejected').
   */
  async getPendingPayments(statusFilter = "pending_review") {
    const result = await trustedCall("admin_list_pending_payments", { status: statusFilter });
    return result.payments || [];
  },

  async getAllPayments() {
    const result = await trustedCall("admin_list_pending_payments", {});
    return result.payments || [];
  },

  /**
   * Approves an EcoCash payment, activates subscription / approves ad, and logs audit.
   */
  async approvePayment(paymentId) {
    return trustedCall("admin_approve_payment", { payment_id: paymentId });
  },

  /**
   * Rejects an EcoCash payment with mandatory reason.
   */
  async rejectPayment(paymentId, rejectionReason) {
    return trustedCall("admin_reject_payment", {
      payment_id: paymentId,
      rejection_reason: rejectionReason
    });
  },

  async openPaymentProof(paymentId) {
    return trustedCall("admin_create_payment_proof_token", { payment_id: paymentId });
  },

  // -------------------------------------------------------------
  // SUBSCRIPTION PLAN MANAGEMENT
  // -------------------------------------------------------------
  async getSubscriptionPlans(includeAll = true) {
    const result = await trustedCall("list_subscription_plans", { include_all: includeAll });
    return result.plans || [];
  },

  async saveSubscriptionPlan(planData) {
    const op = planData.id || planData.plan_id ? "update" : "create";
    return trustedCall("admin_manage_subscription_plan", {
      operation: op,
      plan_id: planData.id || planData.plan_id,
      ...planData
    });
  },

  async togglePlanActive(planId) {
    return trustedCall("admin_manage_subscription_plan", {
      operation: "toggle_active",
      plan_id: planId
    });
  },

  async deleteSubscriptionPlan(planId) {
    return trustedCall("admin_manage_subscription_plan", {
      operation: "delete",
      plan_id: planId
    });
  },

  // -------------------------------------------------------------
  // PAYMENT DESTINATION MANAGEMENT (ECOCASH ACCOUNTS)
  // -------------------------------------------------------------
  async getPaymentDestinations() {
    const result = await trustedCall("admin_manage_payment_destination", { operation: "list" });
    return result.destinations || [];
  },

  async savePaymentDestination(destData) {
    const op = destData.id || destData.destination_id ? "update" : "create";
    return trustedCall("admin_manage_payment_destination", {
      operation: op,
      destination_id: destData.id || destData.destination_id,
      ...destData
    });
  },

  async togglePaymentDestinationActive(destId) {
    return trustedCall("admin_manage_payment_destination", {
      operation: "toggle_active",
      destination_id: destId
    });
  },

  async deletePaymentDestination(destId) {
    return trustedCall("admin_manage_payment_destination", {
      operation: "delete",
      destination_id: destId
    });
  },

  // -------------------------------------------------------------
  // ADVERTISING MANAGEMENT & CONTENT MODERATION
  // -------------------------------------------------------------
  async getAdRateCards() {
    const result = await trustedCall("list_ad_rate_cards", { include_all: true });
    return result.rate_cards || [];
  },

  async saveAdRateCard(cardData) {
    return trustedCall("admin_manage_ad_rate_card", {
      operation: "update",
      rate_card_id: cardData.id || cardData.rate_card_id,
      ...cardData
    });
  },

  async getAdPackages() {
    const result = await trustedCall("list_ad_packages", { include_all: true });
    return result.packages || [];
  },

  async saveAdPackage(pkgData) {
    return trustedCall("admin_manage_ad_package", {
      operation: "update",
      package_id: pkgData.id || pkgData.package_id,
      ...pkgData
    });
  },

  async getAdCampaigns(statusFilter = null) {
    const result = await trustedCall("admin_list_ad_campaigns", { status: statusFilter });
    return result.campaigns || [];
  },

  async approveAdContent(campaignId) {
    return trustedCall("admin_approve_ad_content", { campaign_id: campaignId });
  },

  async rejectAdContent(campaignId, reason) {
    return trustedCall("admin_reject_ad_content", {
      campaign_id: campaignId,
      rejection_reason: reason
    });
  }
};
