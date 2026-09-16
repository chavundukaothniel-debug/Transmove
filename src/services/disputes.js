// ==============================================================================
// TRANSMOVE SUPPORT & DISPUTES SERVICE
// Ticket Creation, Investigation & Admin Resolution
// ==============================================================================
import { getSupabase } from "../config/supabase.js";
import { WalletService } from "./wallet.js";

export const DisputesService = {
  /**
   * Submits a support dispute / ticket.
   */
  async createDispute(userId, category, subject, description, bookingId = null) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data, error } = await supabase
      .from("support_disputes")
      .insert([
        {
          user_id: userId,
          booking_id: bookingId,
          category,
          subject,
          description,
          status: "open"
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Retrieves disputes submitted by a user.
   */
  async getUserDisputes(userId) {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("support_disputes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Disputes fetch error:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Admin: List all disputes.
   */
  async getAllDisputes() {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("support_disputes")
      .select("*, profiles:user_id(full_name, email, role)")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("All disputes fetch error:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Admin: Resolve a dispute (with optional refund).
   */
  async resolveDispute(disputeId, resolutionNotes, status = "resolved", refundAmount = 0) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data: dispute, error: fetchErr } = await supabase
      .from("support_disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (fetchErr || !dispute) throw new Error("Dispute record not found.");

    const numRefund = parseFloat(refundAmount || 0);

    // Process refund if specified
    if (numRefund > 0) {
      await WalletService.recordTransaction(
        dispute.user_id,
        numRefund,
        "credit",
        "refund",
        `Refund for Dispute #${disputeId.slice(0, 8)}: ${resolutionNotes}`,
        disputeId
      );
    }

    const { data, error } = await supabase
      .from("support_disputes")
      .update({
        status,
        resolution_notes: resolutionNotes,
        refund_amount: numRefund,
        updated_at: new Date().toISOString()
      })
      .eq("id", disputeId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};
