// ==============================================================================
// TRANSMOVE REALTIME MESSAGING SERVICE
// Direct chat between booking participants via Trusted API
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function trustedCall(action, data = {}) {
  const jwt = await getAuthJwt();
  if (!jwt) throw new Error("Authentication required.");

  const endpoint = getTrustedApiEndpoint();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({ action, data, jwt })
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Trusted API error (HTTP ${res.status})`);
  }
  return body;
}

export const MessagingService = {
  /**
   * Fetches conversation messages for a specific booking.
   */
  async getMessages(bookingId) {
    if (!bookingId) return [];

    try {
      const result = await trustedCall("list_booking_messages", { booking_id: bookingId });
      return result.messages || [];
    } catch (err) {
      console.warn("getMessages notice:", err.message);
      return [];
    }
  },

  /**
   * Sends a new chat message via trusted server.
   */
  async sendMessage({ bookingId, receiverId, content }) {
    if (!bookingId) throw new Error("bookingId is required.");
    if (!content || !content.trim()) throw new Error("Message content cannot be empty.");

    const result = await trustedCall("send_message", {
      booking_id: bookingId,
      receiver_id: receiverId,
      message: content.trim()
    });
    return result;
  },

  /**
   * Marks unread messages in this booking conversation as read.
   */
  async markAsRead(bookingId) {
    if (!bookingId) return;
    try {
      await trustedCall("mark_messages_read", { booking_id: bookingId });
    } catch (e) {
      console.warn("markAsRead notice:", e.message);
    }
  },

  /**
   * Subscribes to messages with resilient polling fallback.
   */
  subscribeToMessages(bookingId, callback) {
    if (!bookingId || typeof callback !== "function") return { unsubscribe: () => {} };

    let unsubscribed = false;
    let pollTimer = null;
    let lastSeenCreatedAt = new Date().toISOString();

    // Polling fallback every 4s
    pollTimer = setInterval(async () => {
      if (unsubscribed) return;
      try {
        const msgs = await this.getMessages(bookingId);
        if (msgs && msgs.length > 0) {
          const newest = msgs[msgs.length - 1];
          if (newest && new Date(newest.created_at) > new Date(lastSeenCreatedAt)) {
            lastSeenCreatedAt = newest.created_at;
            callback(newest);
          }
        }
      } catch (_) {}
    }, 4000);

    return {
      unsubscribe: () => {
        unsubscribed = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    };
  }
};
