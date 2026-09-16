// ==============================================================================
// TRANSMOVE SECURE ADMINISTRATIVE SERVICE
// Server-side / RLS verified Admin capabilities
// ==============================================================================
import { getSupabase } from "../config/supabase.js";
import { getAppwriteAccount, getTrustedApiEndpoint } from "../config/appwrite.js";
import { AuthService } from "./auth.js";

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
   * Fetches overall platform statistics.
   */
  async getPlatformStats() {
    const result = await trustedCall("admin_get_platform_stats");
    return { ...result, totalRevenue: Number(result.totalRevenue || 0).toFixed(2) };
  },

  /**
   * Fetches pending driver & owner verification requests.
   */
  async getPendingVerifications() {
    const result = await trustedCall("admin_list_verifications");
    return result.verifications || [];
  },

  /**
   * Updates a user's driver/owner verification status.
   * Status: 'approved' | 'rejected' | 'suspended'
   */
  async updateVerificationStatus(userId, status, reason = null) {
    const queue = await this.getPendingVerifications();
    const target = queue.find((item) => item.id === userId || item.user_id === userId);
    const profileId = target?.id || userId;
    const profile = await trustedCall("admin_set_profile_verification", {
      profile_id: profileId,
      verification_status: status,
      reason
    });

    const documentStatus = status === "approved" ? "verified" : "rejected";
    await Promise.all((target?.documents || []).map((document) => this.verifyDocument(document.id, documentStatus, reason)));
    await Promise.all((target?.vehicles || []).map((vehicle) => this.verifyVehicle(vehicle.id, status)));
    return profile;
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

  async verifyVehicle(vehicleId, verificationStatus = "approved") {
    return trustedCall("admin_verify_vehicle", {
      vehicle_id: vehicleId,
      verification_status: verificationStatus
    });
  },

  async setAccountStatus(profileId, accountStatus) {
    return trustedCall("admin_set_account_status", { profile_id: profileId, account_status: accountStatus });
  },

  /**
   * Fetches all machinery equipment listings for moderation.
   */
  async getAllEquipment() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("equipment_listings")
      .select("*, owner:owner_id(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  },

  /**
   * Updates machinery listing verification status.
   */
  async updateEquipmentStatus(equipmentId, status) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data, error } = await supabase
      .from("equipment_listings")
      .update({ verification_status: status, updated_at: new Date().toISOString() })
      .eq("id", equipmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
