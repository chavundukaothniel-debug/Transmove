// ==============================================================================
// TRANSMOVE REVIEWS & RATINGS SERVICE
// ==============================================================================
import { getTrustedApiEndpoint, getAppwriteAccount } from "../config/appwrite.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const account = getAppwriteAccount();
  const jwtRes = await account.createJWT();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtRes.jwt}`,
      "X-Appwrite-JWT": jwtRes.jwt
    },
    body: JSON.stringify({ action, data })
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Review operation failed.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export const ReviewService = {
  /**
   * Submits a rating (1-5) and optional comment for a completed booking.
   */
  async submitReview({ bookingId, rating, comment }) {
    if (!bookingId) throw new Error("bookingId is required.");
    if (!rating) throw new Error("rating is required.");
    return callTrustedApi("create_review", {
      booking_id: bookingId,
      rating,
      comment
    });
  },

  /**
   * Fetches reviews for a specific booking.
   */
  async getBookingReviews(bookingId) {
    if (!bookingId) throw new Error("bookingId is required.");
    const res = await callTrustedApi("get_booking_reviews", { booking_id: bookingId });
    return res.reviews || [];
  },

  /**
   * Fetches public reviews and average rating for a provider.
   */
  async getDriverReviews(driverId) {
    if (!driverId) throw new Error("driverId is required.");
    return callTrustedApi("get_driver_reviews", { driver_id: driverId });
  }
};
