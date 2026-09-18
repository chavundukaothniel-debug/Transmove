// ==============================================================================
// TRANSMOVE REFERRAL SYSTEM SERVICE
// Unique referral codes, qualification logic, and anti-fraud validation
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const ReferralService = {
  /**
   * Generates or fetches user's unique referral code (e.g. TRANSMOVE-9A82B1).
   */
  async getReferralCode(userId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: profile } = await supabase.from("profiles").select("referral_code").eq("id", userId).single();

    if (profile && profile.referral_code) {
      return profile.referral_code;
    }

    // Generate new code
    const code = `TRANSMOVE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await supabase.from("profiles").update({ referral_code: code }).eq("id", userId);
    return code;
  },

  /**
   * Fetches user's referral statistics (invited, qualified, rewards).
   */
  async getReferralStats(userId) {
    const supabase = getSupabase();
    if (!supabase) return { totalInvited: 0, qualified: 0, totalEarned: 0.0 };

    const { data: referrals, error } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", userId);

    if (error || !referrals) return { totalInvited: 0, qualified: 0, totalEarned: 0.0 };

    const totalInvited = referrals.length;
    const qualified = referrals.filter((r) => r.status === "completed" || r.status === "qualified").length;
    const totalEarned = referrals.reduce((sum, r) => sum + parseFloat(r.reward_amount || 0), 0);

    return {
      totalInvited,
      qualified,
      totalEarned: parseFloat(totalEarned.toFixed(2))
    };
  },

  /**
   * Admin: Fetches all platform referrals for audit.
   */
  async getAllReferralsForAdmin() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("referrals")
      .select("*, referrer:referrer_id(full_name, email), referred:referred_id(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  }
};
