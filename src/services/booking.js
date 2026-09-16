// ==============================================================================
// TRANSMOVE BOOKINGS & TRIP LIFECYCLE SERVICE
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const BookingService = {
  /**
   * Fetches active or historical bookings for the current user.
   */
  async getUserBookings() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("*, request:ride_requests(*), driver:profiles!driver_id(*), customer:profiles!customer_id(*), vehicle:vehicles(*)")
      .or(`customer_id.eq.${session.user.id},driver_id.eq.${session.user.id}`)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching user bookings:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetches a single booking by ID with complete relations.
   */
  async getBookingById(bookingId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("bookings")
      .select("*, request:ride_requests(*), driver:profiles!driver_id(*), customer:profiles!customer_id(*), vehicle:vehicles(*)")
      .eq("id", bookingId)
      .single();

    if (error) return null;
    return data;
  },

  /**
   * Updates booking trip status.
   * Status: 'driver_arriving' | 'in_progress' | 'completed' | 'cancelled'
   */
  async updateBookingStatus(bookingId, newStatus, reason = null) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();

    const updates = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === "in_progress") updates.start_time = new Date().toISOString();
    if (newStatus === "completed") updates.completed_time = new Date().toISOString();
    if (newStatus === "cancelled") {
      updates.cancellation_reason = reason;
      updates.cancelled_by = session?.user?.id;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;

    // Log trip lifecycle event in trip_events audit table
    try {
      await supabase.from("trip_events").insert({
        booking_id: bookingId,
        actor_id: session?.user?.id,
        status: newStatus,
        notes: reason || `Status updated to ${newStatus}`
      });
    } catch (e) {
      console.warn("Trip event log notice:", e.message);
    }

    return data;
  },

  /**
   * Leaves a review and star rating for a completed trip.
   */
  async submitReview({ bookingId, revieweeId, rating, comment }) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("You must be logged in to leave a review.");

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        booking_id: bookingId,
        reviewer_id: session.user.id,
        reviewee_id: revieweeId,
        rating: Math.min(5, Math.max(1, parseInt(rating))),
        comment: comment || null
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Subscribes to real-time changes on a specific booking.
   */
  subscribeToBooking(bookingId, callback) {
    const supabase = getSupabase();
    if (!supabase) return { unsubscribe: () => {} };

    const channel = supabase
      .channel(`public:bookings:${bookingId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  }
};
