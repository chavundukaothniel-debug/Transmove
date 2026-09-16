// ==============================================================================
// TRANSMOVE BIDDING & OFFERS SERVICE
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const OfferService = {
  /**
   * Driver submits a proposed offer on an open request.
   */
  async submitOffer({ requestId, vehicleId, proposedPrice, currency = "USD", estimatedArrivalMins, message }) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("You must be logged in as a verified driver.");

    // Check driver verification status
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, verification_status")
      .eq("id", session.user.id)
      .single();

    if (profile?.role !== "driver" && profile?.role !== "owner" && profile?.role !== "admin") {
      throw new Error("Only drivers or equipment owners can submit offers.");
    }

    if (profile?.verification_status !== "approved" && profile?.role !== "admin") {
      throw new Error("Your driver account is pending verification. You will be able to bid once approved.");
    }

    // Server-Side 5 Free Jobs Limit Enforcement & Subscription Check
    const { data: activeSub } = await supabase
      .from("user_subscriptions")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("status", "active")
      .gt("expiry_date", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!activeSub && profile?.role !== "admin") {
      // Calculate awarded/accepted/completed free jobs used by this driver
      const { data: driverBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("driver_id", session.user.id)
        .in("status", ["confirmed", "driver_arriving", "in_progress", "completed"]);

      const freeJobsUsed = (driverBookings || []).length;
      if (freeJobsUsed >= 5) {
        throw new Error("SUBSCRIPTION_REQUIRED");
      }
    }

    const { data, error } = await supabase
      .from("offers")
      .upsert({
        request_id: requestId,
        driver_id: session.user.id,
        vehicle_id: vehicleId || null,
        proposed_price: proposedPrice,
        currency,
        estimated_arrival_mins: estimatedArrivalMins || 10,
        message: message || null,
        status: "pending"
      }, { onConflict: "request_id, driver_id" })
      .select()
      .single();

    if (error) throw error;

    // Update request status to 'offers_received'
    await supabase
      .from("ride_requests")
      .update({ status: "offers_received", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    return data;
  },

  /**
   * Customer submits a counter-offer to a driver.
   */
  async counterOfferByCustomer(offerId, counterPrice) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase
      .from("offers")
      .update({
        counter_price: counterPrice,
        counter_by: session?.user?.id,
        status: "countered_by_customer",
        updated_at: new Date().toISOString()
      })
      .eq("id", offerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Driver responds to a customer's counter-offer (accept counter or counter back).
   */
  async respondToCounter(offerId, { accept, newCounterPrice }) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();

    let updateData = { updated_at: new Date().toISOString() };

    if (accept) {
      // Driver agrees to customer's counter price
      updateData.status = "pending";
    } else if (newCounterPrice) {
      // Driver counters again
      updateData.proposed_price = newCounterPrice;
      updateData.counter_price = null;
      updateData.counter_by = session?.user?.id;
      updateData.status = "countered_by_driver";
    } else {
      updateData.status = "rejected";
    }

    const { data, error } = await supabase
      .from("offers")
      .update(updateData)
      .eq("id", offerId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Customer accepts driver's offer. Locks booking atomically.
   */
  async acceptOffer(offerId) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    // Attempt RPC call to atomic PostgreSQL function first
    const { data: bookingId, error: rpcError } = await supabase.rpc("accept_offer", {
      p_offer_id: offerId
    });

    if (!rpcError && bookingId) {
      return { success: true, bookingId };
    }

    // Fallback direct transaction update
    const { data: offer, error: fetchErr } = await supabase
      .from("offers")
      .select("*, request:ride_requests(*)")
      .eq("id", offerId)
      .single();

    if (fetchErr || !offer) throw new Error("Offer not found or unavailable");

    // 1. Mark offer accepted
    await supabase.from("offers").update({ status: "accepted" }).eq("id", offerId);

    // 2. Reject other offers for this request
    await supabase.from("offers").update({ status: "rejected" }).eq("request_id", offer.request_id).neq("id", offerId);

    // 3. Mark request accepted
    await supabase.from("ride_requests").update({ status: "accepted", accepted_offer_id: offerId }).eq("id", offer.request_id);

    // 4. Create booking record
    const { data: booking, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        request_id: offer.request_id,
        offer_id: offer.id,
        customer_id: offer.request.customer_id,
        driver_id: offer.driver_id,
        vehicle_id: offer.vehicle_id,
        final_price: offer.counter_price || offer.proposed_price,
        currency: offer.currency,
        status: "confirmed"
      })
      .select()
      .single();

    if (bookErr) throw bookErr;

    return { success: true, bookingId: booking.id };
  },

  /**
   * Subscribes to real-time changes on offers table.
   */
  subscribeToOffers(requestId, callback) {
    const supabase = getSupabase();
    if (!supabase) return { unsubscribe: () => {} };

    const channel = supabase
      .channel(`public:offers:${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "offers", filter: `request_id=eq.${requestId}` },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Fetches offers submitted by the current authenticated driver/operator.
   */
  async getDriverOffers() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from("offers")
      .select("*, request:ride_requests(*)")
      .eq("driver_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching driver offers:", error.message);
      return [];
    }
    return data || [];
  }
};
