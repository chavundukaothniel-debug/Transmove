// ==============================================================================
// TRANSMOVE REALTIME MESSAGING SERVICE
// Direct chat between booking participants via Appwrite Trusted API & Realtime
// Supabase remains intact as backup during incremental migration
// ==============================================================================
import { getAppwriteAccount, getAppwriteClient, getTrustedApiEndpoint } from "../config/appwrite.js";
import { getSupabase } from "../config/supabase.js";

async function trustedCall(action, data = {}) {
  const account = getAppwriteAccount();
  const jwtRes = await account.createJWT();
  const jwt = jwtRes.jwt;

  const endpoint = getTrustedApiEndpoint();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "X-Appwrite-JWT": jwt
    },
    body: JSON.stringify({ action, data })
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
      console.warn("Appwrite getMessages notice:", err.message);

      // Graceful fallback to Supabase if configured
      const supabase = getSupabase();
      if (supabase) {
        const { data } = await supabase
          .from("messages")
          .select("*, sender:profiles!sender_id(full_name, profile_photo_url)")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: true });
        if (data) return data;
      }
      return [];
    }
  },

  /**
   * Sends a new chat message via trusted server.
   */
  async sendMessage({ bookingId, receiverId, content }) {
    if (!bookingId) throw new Error("bookingId is required.");
    if (!content || !content.trim()) throw new Error("Message content cannot be empty.");

    try {
      const result = await trustedCall("send_message", {
        booking_id: bookingId,
        receiver_id: receiverId,
        message: content.trim()
      });
      return result;
    } catch (err) {
      // Graceful fallback to Supabase if configured
      const supabase = getSupabase();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data, error } = await supabase
            .from("messages")
            .insert({
              booking_id: bookingId,
              sender_id: session.user.id,
              receiver_id: receiverId,
              content: content.trim()
            })
            .select("*, sender:profiles!sender_id(full_name, profile_photo_url)")
            .single();
          if (!error && data) return data;
        }
      }
      throw err;
    }
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
   * Subscribes to real-time incoming messages for a booking.
   * Uses Appwrite Realtime on messages collection with clean unsubscribe.
   */
  subscribeToMessages(bookingId, callback) {
    if (!bookingId || typeof callback !== "function") return { unsubscribe: () => {} };

    let unsubscribed = false;
    let appwriteUnsub = null;
    let pollTimer = null;
    let lastSeenCreatedAt = new Date().toISOString();

    try {
      const client = getAppwriteClient();
      const channel = "databases.transmove.collections.messages.documents";

      appwriteUnsub = client.subscribe(channel, (response) => {
        if (unsubscribed) return;
        const payload = response.payload;
        if (!payload) return;

        const isMatchingBooking =
          payload.booking_id === bookingId ||
          payload.conversation_id === `booking_${bookingId}` ||
          payload.conversation_id === bookingId;

        if (isMatchingBooking) {
          lastSeenCreatedAt = payload.created_at || new Date().toISOString();
          const formatted = {
            ...payload,
            id: payload.$id,
            content: payload.message || payload.content
          };
          callback(formatted);
        }
      });
    } catch (e) {
      console.warn("Appwrite Realtime subscription notice:", e.message);
    }

    // Controlled refresh/polling fallback (every 6s) to ensure resilience
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
    }, 6000);

    return {
      unsubscribe: () => {
        unsubscribed = true;
        if (typeof appwriteUnsub === "function") {
          try { appwriteUnsub(); } catch (_) {}
        }
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }
    };
  }
};
