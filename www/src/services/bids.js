// ==============================================================================
// TRANSMOVE BIDS & BOOKINGS SERVICE
// Powered by Supabase via Trusted API (netlify/functions/trusted-api.js)
// All privileged mutations are server-side only. Client cannot spoof driver_id,
// status, or entitlement counts.
//
// Legacy Supabase offer/booking modules remain on disk for unrelated fallback
// audit only; this live passenger/driver workflow never imports or calls them.
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

const getTrustedApiEndpoint = () => {
  if (typeof window !== "undefined") {
    const isNative = Boolean(window.Capacitor?.isNativePlatform?.() || window.location?.protocol === "capacitor:");
    if (isNative) return "https://transmove.onrender.com/.netlify/functions/trusted-api";
    const storedBase = window.localStorage?.getItem("transmove_api_base")?.replace(/\/+$/, "");
    const base = storedBase || window.location?.origin;
    if (base) return `${base}/.netlify/functions/trusted-api`;
  }
  return "https://transmove.onrender.com/.netlify/functions/trusted-api";
};

// ---------------------------------------------------------------------------
// INTERNAL: Call the trusted API with a JWT for authentication
// ---------------------------------------------------------------------------
async function callTrustedApi(action, data = {}, extraParams = {}) {
  const endpoint = getTrustedApiEndpoint();
  if (!endpoint) throw new Error("Trusted API endpoint not configured.");

  let jwt = "";
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) jwt = session.access_token;
    }
  } catch (_) {}
  if (!jwt) {
    jwt = localStorage.getItem("transmove_mock_jwt") || "";
  }
  if (!jwt) throw new Error("A Supabase session is required.");

  const payload = { action, data, ...extraParams };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();

  if (!res.ok) {
    const errMsg = result.error || `Trusted API error: HTTP ${res.status}`;
    const err = new Error(errMsg);
    err.status = res.status;
    err.subscriptionRequired =
      errMsg.includes("SUBSCRIPTION_REQUIRED") ||
      errMsg.includes("DRIVER_SUBSCRIPTION_REQUIRED") ||
      res.status === 402;
    throw err;
  }

  return result;
}

// ==============================================================================
// BidService — Driver bidding & passenger quotation viewing
// ==============================================================================
export const BidService = {
  /**
   * DRIVER: Submit a bid on an open service request.
   * The trusted API enforces the 5-job free limit and subscription check.
   * Returns the created/updated bid document.
   * Throws an error with .subscriptionRequired = true if limit exceeded.
   */
  async submitBid({ requestId, vehicleId, proposedPrice, amount, currency = "USD", estimatedArrivalMinutes, estimatedArrivalMins, message }) {
    const finalPrice = proposedPrice !== undefined && proposedPrice !== null ? proposedPrice : amount;
    const finalEta = estimatedArrivalMins || estimatedArrivalMinutes || 15;
    if (!requestId) throw new Error("requestId is required to submit a bid.");
    if (!Number.isFinite(Number(finalPrice)) || Number(finalPrice) <= 0) throw new Error("proposedPrice must be greater than zero.");

    const res = await callTrustedApi("create_bid", {
      request_id: requestId,
      vehicle_id: vehicleId || undefined,
      proposed_price: finalPrice,
      currency,
      estimated_arrival_mins: finalEta,
      message: message || null
    });

    const doc = res?.bid || res;
    return {
      ...doc,
      id: doc?.$id || doc?.id,
      $id: doc?.$id || doc?.id
    };
  },

  /**
   * DRIVER: Withdraw a pending bid.
   */
  async withdrawBid(bidId) {
    if (!bidId) throw new Error("bidId is required.");
    return callTrustedApi("withdraw_bid", { bid_id: bidId });
  },

  /**
   * DRIVER: List all bids the authenticated driver has submitted.
   * Returns enriched bids with request summary.
   */
  async getDriverBids() {
    const result = await callTrustedApi("list_driver_bids", {});
    return result.bids || [];
  },

  /**
   * DRIVER: Check job entitlement (free job count & subscription status).
   * Returns { driver_id, awarded_jobs, free_jobs_remaining, free_limit, has_active_subscription, can_bid }
   */
  async checkEntitlement() {
    return callTrustedApi("check_driver_entitlement", {});
  },

  /**
   * PASSENGER: List all bids received on a specific request.
   * Only the request owner can call this.
   * Returns the actual array of enriched bids with .total and .request metadata attached.
   */
  async getBidsForRequest(requestId) {
    if (!requestId) throw new Error("requestId is required to fetch bids.");
    const res = await callTrustedApi("list_bids_for_request", { request_id: requestId });
    const rawList = Array.isArray(res) ? res : (res?.bids || res?.documents || res?.data || []);
    const normalizedBids = rawList.map((bid) => ({
      ...bid,
      id: bid?.$id || bid?.id,
      $id: bid?.$id || bid?.id
    }));
    // Attach backward-compatible properties so all callers (array or object style) work cleanly
    normalizedBids.bids = normalizedBids;
    normalizedBids.total = res?.total ?? normalizedBids.length;
    normalizedBids.request = res?.request ?? null;
    return normalizedBids;
  },

  /**
   * PASSENGER: Accept a driver's bid.
   * Atomically:
   *   1. Re-checks driver entitlement server-side
   *   2. Marks the chosen bid "accepted"
   *   3. Rejects all competing bids
   *   4. Sets service_request status to "accepted"
   *   5. Creates a booking record
   * Returns { success, bookingId, booking, competing_bids_rejected }
   */
  async acceptBid(bidId, notes = null) {
    if (!bidId) throw new Error("bidId is required.");
    return callTrustedApi("accept_bid", {
      bid_id: bidId,
      notes: notes || undefined
    });
  },

  /**
   * PASSENGER / DRIVER: Submit a counter offer on a pending quotation.
   */
  async counterBid({ bidId, counterAmount, message = "" }) {
    if (!bidId) throw new Error("bidId is required.");
    if (!Number.isFinite(Number(counterAmount)) || Number(counterAmount) <= 0) throw new Error("counterAmount must be greater than zero.");
    return callTrustedApi("counter_bid", {
      bid_id: bidId,
      counter_amount: parseFloat(counterAmount),
      message
    });
  },

  /**
   * PASSENGER / DRIVER: Accept the negotiated counter offer amount.
   */
  async acceptCounterOffer(bidId) {
    if (!bidId) throw new Error("bidId is required.");
    return callTrustedApi("accept_counter_offer", { bid_id: bidId });
  },

  /**
   * PASSENGER / DRIVER: Decline a counter offer.
   */
  async declineCounterOffer(bidId) {
    if (!bidId) throw new Error("bidId is required.");
    return callTrustedApi("decline_counter_offer", { bid_id: bidId });
  },

  /** Subscribe to Supabase journey changes; trusted reads remain authoritative. */
  subscribeToJourneyUpdates(callback) {
    if (typeof callback !== "function") return { unsubscribe: () => {} };

    try {
      const supabase = getSupabase();
      if (!supabase?.channel) return { unsubscribe: () => {} };
      const channel = supabase.channel(`journey-updates-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, callback)
        .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, callback)
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, callback)
        .subscribe();
      return { unsubscribe: () => { supabase.removeChannel(channel); } };
    } catch (error) {
      console.warn("Journey realtime unavailable; polling remains active:", error.message);
      return { unsubscribe: () => {} };
    }
  }
};

// ==============================================================================
// BookingService — Booking lifecycle
// Replaces Supabase booking.js for Appwrite-backed data.
// ==============================================================================
export const BookingService = {
  /**
   * PASSENGER: Get all bookings for the current passenger.
   * Returns enriched bookings with request summary, driver info, vehicle info.
   */
  async getPassengerBookings() {
    const result = await callTrustedApi("get_passenger_bookings", {});
    return result.bookings || [];
  },

  /**
   * DRIVER: Get all bookings (active & historical) for the current driver.
   */
  async getDriverBookings() {
    const result = await callTrustedApi("get_driver_bookings", {});
    return result.bookings || [];
  },

  /**
   * Update booking status.
   * DRIVER transitions: confirmed → driver_arriving → arrived → in_progress → completed
   * PASSENGER transitions: confirmed → cancelled (only)
   */
  async updateBookingStatus(bookingId, status, options = {}) {
    if (!bookingId) throw new Error("bookingId is required.");
    const validStatuses = ["driver_arriving", "arrived", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status '${status}'. Allowed: ${validStatuses.join(", ")}`);
    }
    const extra = typeof options === "string" ? { reason: options } : (options || {});
    return callTrustedApi("update_booking_status", {
      booking_id: bookingId,
      status,
      ...extra
    });
  },

  /**
   * Role-agnostic: Get all bookings for the current user.
   * Tries both passenger and driver endpoints; deduplicates and sorts by date.
   */
  async getUserBookings() {
    let passengerBookings = [];
    let driverBookings = [];

    try {
      const r = await callTrustedApi("get_passenger_bookings", {});
      passengerBookings = r.bookings || [];
    } catch (e) {
      if (e.status !== 403) console.warn("getUserBookings (passenger):", e.message);
    }

    try {
      const r = await callTrustedApi("get_driver_bookings", {});
      driverBookings = r.bookings || [];
    } catch (e) {
      if (e.status !== 403) console.warn("getUserBookings (driver):", e.message);
    }

    const seen = new Set();
    const all = [...passengerBookings, ...driverBookings].filter((b) => {
      const id = b.$id || b.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  /**
   * PASSENGER: Generates a temporary secure share link for an active trip.
   */
  async generateShareLink(bookingId) {
    if (!bookingId) throw new Error("bookingId is required.");
    return callTrustedApi("generate_trip_share_link", { booking_id: bookingId });
  },

  /**
   * PUBLIC / PASSENGER: Retrieves safe trip tracking details using share token.
   */
  async getSharedTrip(token) {
    if (!token) throw new Error("token is required.");
    return callTrustedApi("get_shared_trip", { token });
  },

  /**
   * PASSENGER / DRIVER: Cancels a booking with controlled reason category & optional notes.
   */
  async cancelBookingWithReason(bookingId, { reason = "change_of_plans", notes = "" } = {}) {
    if (!bookingId) throw new Error("bookingId is required.");
    return callTrustedApi("update_booking_status", {
      booking_id: bookingId,
      status: "cancelled",
      reason,
      notes
    });
  },

  /**
   * DRIVER: Confirms receipt of agreed trip payment from passenger.
   */
  async confirmTripPayment(bookingId) {
    if (!bookingId) throw new Error("bookingId is required.");
    return callTrustedApi("confirm_trip_payment", { booking_id: bookingId });
  },

  /**
   * PASSENGER: Update live pickup location sharing for assigned driver.
   */
  async updatePassengerLiveLocation({ bookingId, latitude, longitude, active = true }) {
    if (!bookingId) throw new Error("bookingId is required.");
    return callTrustedApi("update_passenger_live_location", {
      booking_id: bookingId,
      latitude,
      longitude,
      active
    });
  }
};
