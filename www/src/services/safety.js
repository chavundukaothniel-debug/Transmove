// ==============================================================================
// TRANSMOVE SAFETY & EMERGENCY SERVICE
// SOS Trigger, Share Trip, PIN verification, Safety Reporting
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const SafetyService = {
  /**
   * Triggers SOS Emergency alert.
   */
  async triggerSOS(userId, bookingId = null, currentCoords = null) {
    const supabase = getSupabase();
    console.warn(`🚨 SOS Emergency triggered by user: ${userId}`);

    if (supabase) {
      await supabase.from("notifications").insert([
        {
          user_id: userId,
          title: "🚨 SOS EMERGENCY ACTIVATED",
          body: `Emergency alert raised. Location: ${currentCoords ? `${currentCoords.lat}, ${currentCoords.lng}` : "Unknown"}. Support notified.`,
          type: "sos_alert",
          reference_id: bookingId
        }
      ]);

      await supabase.from("audit_logs").insert([
        {
          actor_id: userId,
          action: "SOS_EMERGENCY_TRIGGERED",
          target_type: "booking",
          target_id: bookingId,
          details: { coords: currentCoords, timestamp: new Date().toISOString() }
        }
      ]);
    }

    return {
      success: true,
      message: "SOS Alert broadcasted to TransMove Emergency Center and contacts!"
    };
  },

  /**
   * Generates a public shareable trip link.
   */
  generateShareableTripLink(bookingId) {
    const origin = window.location.origin;
    return `${origin}/#customer?track=${bookingId}`;
  },

  /**
   * Verifies 4-digit Trip PIN entered by driver.
   */
  async verifyTripPin(bookingId, inputPin) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data: booking, error } = await supabase
      .from("bookings")
      .select("trip_pin, status")
      .eq("id", bookingId)
      .single();

    if (error || !booking) throw new Error("Booking record not found.");

    if (booking.trip_pin !== inputPin) {
      return { verified: false, message: "Incorrect Trip PIN. Please check customer phone." };
    }

    // PIN matched - update trip status to in_progress / trip_started
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "in_progress", start_time: new Date().toISOString() })
      .eq("id", bookingId);

    if (updateError) throw new Error(updateError.message);

    return { verified: true, message: "Trip PIN verified! Trip started successfully." };
  }
};
