// ==============================================================================
// TRANSMOVE REALTIME MESSAGING VIEW
// ==============================================================================
import { MessagingService } from "../services/messaging.js";
import { BookingService } from "../services/bids.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { icon } from "../components/Icon.js";
const fileViewUrl = (fileId) => {
  if (!fileId) return "";
  return `/api/files/preview/${encodeURIComponent(fileId)}`;
};

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const MessagesView = {
  activeBookingId: null,
  currentProfile: null,
  isPassengerView: false,
  bookings: [],
  activeBooking: null,
  messagesSubscription: null,
  renderedMessageIds: new Set(),

  renderPassengerMessages() {
    const showingThread = new URLSearchParams((window.location.hash.split("?")[1] || "")).has("booking");
    return `
      <div class="passenger-shell-page passenger-messages-page">
        <div class="passenger-page-heading"><div><h2>Messages</h2><p>Coordinate safely with drivers assigned to your bookings.</p></div></div>
        <section class="passenger-messages-layout ${showingThread ? "is-thread-open" : "is-list-open"}">
          <aside class="conversation-panel">
            <div class="conversation-search">${icon("search", 17)}<input type="search" id="conversation-search-input" placeholder="Search conversations…" aria-label="Search conversations"></div>
            <div id="passenger-conversation-list" class="conversation-list"><div class="tm-skeleton-state" aria-label="Loading conversations"><i></i><i></i><i></i></div></div>
          </aside>
          <div class="conversation-chat-panel">
            <div class="conversation-chat-header">
              <a href="#messages" class="conversation-mobile-back" aria-label="Back to conversations" title="Back to conversations">${icon("arrow-left", 19)}</a>
              <div><strong id="chat-subheading">Select a conversation</strong><small>Booking messages</small></div>
            </div>
            <div id="chat-messages-box" class="chat-messages"><div class="passenger-loading-state">Select a booking to view messages.</div></div>
            <form id="chat-form" class="chat-input-bar">
              <input type="text" id="chat-input-text" class="form-input" placeholder="Type a message…" required autocomplete="off">
              <button type="submit" class="btn btn-primary btn-sm chat-send-button" aria-label="Send message">${icon("send", 17)}<span>Send</span></button>
            </form>
          </div>
        </section>
      </div>`;
  },

  async render(currentProfile = null) {
    this.isPassengerView = ["customer", "passenger"].includes(currentProfile?.role);
    if (this.isPassengerView) return this.renderPassengerMessages();

    const dashboardRoute = {
      driver: "driver",
      cargo_owner: "cargo-owner",
      logistics_provider: "logistics",
      logistics: "logistics",
      vehicle_owner: "vehicle-owner",
      machinery_owner: "machinery-owner",
      machinery_hirer: "machinery-hirer",
      owner: "owner",
      business_admin: "business",
      business: "business",
      advertiser: "advertise",
      admin: "admin"
    }[currentProfile?.role] || "profile";

    return `
      <div style="max-width: 760px; margin: 0 auto;">
        <div class="card-header" style="margin-bottom: 1rem;">
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800;">Trip Chat</h2>
            <p id="chat-subheading" style="color: var(--text-muted); font-size: 0.85rem;">Secure trip conversation</p>
          </div>
          <a href="#${dashboardRoute}" class="btn btn-outline btn-sm">${icon("arrow-left", 17)}<span>Back to Dashboard</span></a>
        </div>

        <div class="chat-window">
          <div id="chat-messages-box" class="chat-messages">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Connecting to conversation...
            </div>
          </div>

          <div id="quick-messages-bar" style="display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 1rem; background: var(--bg-subtle); border-top: 1px solid var(--border-light);">
            <button type="button" class="btn btn-outline btn-sm quick-msg-pill icon-label" data-message="I'm at the pickup point." style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              ${icon("map-pin", 14)}<span>I'm at the pickup point.</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm quick-msg-pill icon-label" data-message="Please move to the main gate." style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              ${icon("door-open", 14)}<span>Please move to the main gate.</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm quick-msg-pill icon-label" data-message="I'm arriving in 2 minutes." style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              ${icon("clock-3", 14)}<span>I'm arriving in 2 minutes.</span>
            </button>
          </div>

          <form id="chat-form" class="chat-input-bar">
            <input type="text" id="chat-input-text" class="form-input" placeholder="Type your message..." required autocomplete="off" />
            <button type="submit" class="btn btn-primary btn-sm chat-send-button" style="padding: 0 1.25rem;" aria-label="Send message">
              ${icon("send", 17)}<span>Send</span>
            </button>
          </form>
        </div>
      </div>
    `;
  },

  async init() {
    this.unsubscribeMessages();
    this.currentProfile = await AuthService.getCurrentProfile();
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split("?")[1]);
    this.activeBookingId = urlParams.get("booking");

    const dashboardRoute = this.isPassengerView ? "customer" : "driver";

    this.bookings = await BookingService.getUserBookings().catch((err) => {
      console.warn("Could not load bookings for messaging:", err.message);
      return [];
    });

    if (!this.activeBookingId && !this.isPassengerView) {
      const openBooking = this.bookings.find(
        (b) => !["completed", "cancelled"].includes(b.status)
      );
      this.activeBookingId = (openBooking || this.bookings[0])?.id || (openBooking || this.bookings[0])?.$id || null;
    }

    this.activeBooking =
      this.bookings.find((b) => (b.id || b.$id) === this.activeBookingId) || null;

    if (this.isPassengerView) {
      this.renderPassengerConversations(this.bookings);

      const searchInput = document.getElementById("conversation-search-input");
      searchInput?.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        document.querySelectorAll(".conversation-item").forEach((item) => {
          item.style.display = item.textContent.toLowerCase().includes(query) ? "flex" : "none";
        });
      });
    }

    if (!this.activeBooking) {
      const box = document.getElementById("chat-messages-box");
      if (box) {
        box.innerHTML = renderEmptyState({
          title: "No booking selected",
          description: "Select an active booking from your dashboard to start chatting with your driver/customer.",
          actionText: "Go to Dashboard",
          actionLink: `#${dashboardRoute}`,
          icon: "chat"
        });
      }
      document.getElementById("chat-form")?.toggleAttribute("hidden", true);
      return;
    }

    const booking = this.activeBooking;
    const myId = this.currentProfile?.user_id || this.currentProfile?.id;
    const isPassengerSide = myId === booking.passenger_id;
    const receiverId = isPassengerSide ? booking.driver_id : booking.passenger_id;
    const otherPerson = isPassengerSide ? booking.driver : booking.passenger;

    const subheading = document.getElementById("chat-subheading");
    if (subheading) {
      const route = `${booking.request?.pickup_location || "Pickup"} → ${booking.request?.destination || "Destination"}`;
      subheading.innerText = `Chatting with ${otherPerson?.full_name || "Trip Partner"} (${route})`;
    }

    this.loadMessages();

    this.messagesSubscription = MessagingService.subscribeToMessages(this.activeBookingId, (newMsg) => {
      this.appendMessage(newMsg);
    });

    MessagingService.markAsRead(this.activeBookingId).catch(() => {});

    // Quick message pill clicks
    document.querySelectorAll(".quick-msg-pill").forEach((pill) => {
      pill.addEventListener("click", async (e) => {
        const text = e.currentTarget.getAttribute("data-message") || e.currentTarget.innerText.trim();
        const input = document.getElementById("chat-input-text");
        if (input) {
          input.value = text;
          document.getElementById("chat-form")?.dispatchEvent(new Event("submit"));
        }
      });
    });

    // Chat form submit
    document.getElementById("chat-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("chat-input-text");
      const content = input.value.trim();
      if (!content) return;

      input.value = "";

      try {
        await MessagingService.sendMessage({
          bookingId: this.activeBookingId,
          receiverId: receiverId,
          content: content
        });
      } catch (err) {
        input.value = content;
        alert("Could not send message: " + err.message);
      }
    });
  },

  unsubscribeMessages() {
    if (this.messagesSubscription?.unsubscribe) {
      try {
        this.messagesSubscription.unsubscribe();
      } catch (_) {
        /* already closed */
      }
    }
    this.messagesSubscription = null;
  },

  renderPassengerConversations(bookings) {
    const container = document.getElementById("passenger-conversation-list");
    if (!container) return;
    if (!bookings.length) {
      container.innerHTML = renderEmptyState({
        title: "No conversations",
        description: "A conversation opens after you accept a driver quotation.",
        icon: "chat"
      });
      return;
    }

    container.innerHTML = bookings.map((booking) => {
      const bookingId = booking.id || booking.$id;
      const isPassengerSide = this.currentProfile?.id === booking.passenger_id;
      const other = isPassengerSide ? booking.driver : booking.passenger;
      const otherName = other?.full_name || "Trip Partner";
      const route = `${escapeHtml(booking.request?.pickup_location || "Pickup")} → ${escapeHtml(booking.request?.destination || "Destination")}`;
      const photoUrl = fileViewUrl(other?.profile_image_id);
      const avatar = photoUrl
        ? `<img src="${photoUrl}" alt="${escapeHtml(otherName)}">`
        : escapeHtml(otherName.charAt(0).toUpperCase());
      return `
        <button type="button" class="conversation-item ${bookingId === this.activeBookingId ? "active" : ""}" data-booking-id="${bookingId}">
          <span class="conversation-avatar">${avatar}</span>
          <span><strong>${escapeHtml(otherName)}</strong><small>${route}</small></span>
          <time>${booking.updated_at ? new Date(booking.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</time>
        </button>`;
    }).join("");

    container.querySelectorAll(".conversation-item").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.hash = `#messages?booking=${button.getAttribute("data-booking-id")}`;
      });
    });
  },

  resolveSenderName(msg, isMine) {
    if (isMine) return "You";
    if (msg.sender?.full_name) return msg.sender.full_name;
    const booking = this.activeBooking;
    const isPassengerSide = this.currentProfile?.id === booking?.passenger_id;
    const other = isPassengerSide ? booking?.driver : booking?.passenger;
    return other?.full_name || "Trip Partner";
  },

  renderMessage(msg) {
    const messageId = msg.id || msg.$id;
    if (messageId) {
      if (this.renderedMessageIds.has(messageId)) return null;
      this.renderedMessageIds.add(messageId);
    }

    const isMine = msg.sender_id === this.currentProfile?.id;
    const senderName = this.resolveSenderName(msg, isMine);
    const timestamp = msg.created_at
      ? new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "";

    const el = document.createElement("div");
    el.className = `chat-bubble ${isMine ? "mine" : "theirs"}`;
    if (messageId) el.dataset.messageId = messageId;
    el.innerHTML = `
      <div class="chat-message-meta">
        ${escapeHtml(senderName)} • ${escapeHtml(timestamp)}
      </div>
      <div class="chat-message-content">${escapeHtml(msg.content || msg.message || "")}</div>
    `;
    return el;
  },

  async loadMessages() {
    const box = document.getElementById("chat-messages-box");
    if (!box) return;

    this.renderedMessageIds = new Set();

    try {
      const messages = await MessagingService.getMessages(this.activeBookingId);

      if (!messages || messages.length === 0) {
        box.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem; font-size: 0.9rem;">
            No messages yet. Send a greeting to coordinate your pickup!
          </div>
        `;
        return;
      }

      box.innerHTML = "";
      messages.forEach((m) => {
        const el = this.renderMessage(m);
        if (el) box.appendChild(el);
      });

      box.scrollTop = box.scrollHeight;
    } catch (err) {
      box.innerHTML = `<div style="padding: 1rem; color: var(--danger);">Failed to load messages.</div>`;
    }
  },

  appendMessage(msg) {
    const box = document.getElementById("chat-messages-box");
    if (!box) return;

    const el = this.renderMessage(msg);
    if (!el) return;

    const placeholder = box.querySelector("[style*='text-align: center']");
    if (placeholder) box.innerHTML = "";

    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
};
