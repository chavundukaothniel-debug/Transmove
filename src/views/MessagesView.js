// ==============================================================================
// TRANSMOVE REALTIME MESSAGING VIEW
// ==============================================================================
import { MessagingService } from "../services/messaging.js";
import { BookingService } from "../services/booking.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";

export const MessagesView = {
  activeBookingId: null,
  currentProfile: null,
  isPassengerView: false,

  renderPassengerMessages() {
    return `
      <div class="passenger-shell-page passenger-messages-page">
        <div class="passenger-page-heading"><div><h2>Messages</h2><p>Coordinate safely with drivers assigned to your bookings.</p></div></div>
        <section class="passenger-messages-layout">
          <aside class="conversation-panel">
            <div class="conversation-search"><span>⌕</span><input type="search" id="conversation-search-input" placeholder="Search conversations…" aria-label="Search conversations"></div>
            <div id="passenger-conversation-list" class="conversation-list"><div class="passenger-loading-state">Loading conversations…</div></div>
          </aside>
          <div class="conversation-chat-panel">
            <div class="conversation-chat-header">
              <div><strong id="chat-subheading">Select a conversation</strong><small>Booking messages</small></div>
            </div>
            <div id="chat-messages-box" class="chat-messages"><div class="passenger-loading-state">Select a booking to view messages.</div></div>
            <form id="chat-form" class="chat-input-bar">
              <input type="text" id="chat-input-text" class="form-input" placeholder="Type a message…" required autocomplete="off">
              <button type="submit" class="btn btn-primary btn-sm" aria-label="Send message">Send</button>
            </form>
          </div>
        </section>
      </div>`;
  },

  async render(currentProfile = null) {
    this.isPassengerView = ["customer", "passenger"].includes(currentProfile?.role);
    if (this.isPassengerView) return this.renderPassengerMessages();
    return `
      <div style="max-width: 760px; margin: 0 auto;">
        <div class="card-header" style="margin-bottom: 1rem;">
          <div>
            <h2 style="font-size: 1.4rem; font-weight: 800;">Trip Chat</h2>
            <p id="chat-subheading" style="color: var(--text-muted); font-size: 0.85rem;">Secure trip conversation</p>
          </div>
          <a href="#customer" class="btn btn-outline btn-sm">← Back to Dashboard</a>
        </div>

        <div class="chat-window">
          <div id="chat-messages-box" class="chat-messages">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Connecting to conversation...
            </div>
          </div>

          <div id="quick-messages-bar" style="display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.5rem 1rem; background: var(--bg-subtle); border-top: 1px solid var(--border-light);">
            <button class="btn btn-outline btn-sm quick-msg-pill" style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              📍 I'm at the pickup point.
            </button>
            <button class="btn btn-outline btn-sm quick-msg-pill" style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              🚪 Please move to the main gate.
            </button>
            <button class="btn btn-outline btn-sm quick-msg-pill" style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              ⏱️ I'm arriving in 2 minutes.
            </button>
            <button class="btn btn-outline btn-sm quick-msg-pill" style="font-size: 0.75rem; white-space: nowrap; border-radius: var(--radius-full);">
              📞 Masked Call
            </button>
          </div>

          <form id="chat-form" class="chat-input-bar">
            <input type="text" id="chat-input-text" class="form-input" placeholder="Type your message..." required autocomplete="off" />
            <button type="submit" class="btn btn-primary btn-sm" style="padding: 0 1.25rem;">
              Send
            </button>
          </form>
        </div>
      </div>
    `;
  },

  async init() {
    this.currentProfile = await AuthService.getCurrentProfile();
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split("?")[1]);
    this.activeBookingId = urlParams.get("booking");

    if (this.isPassengerView) {
      const bookings = await BookingService.getUserBookings();
      if (!this.activeBookingId && bookings?.length) this.activeBookingId = bookings[0].id;
      this.renderPassengerConversations(bookings || []);

      const searchInput = document.getElementById("conversation-search-input");
      searchInput?.addEventListener("input", () => {
        const query = searchInput.value.trim().toLowerCase();
        document.querySelectorAll(".conversation-item").forEach((item) => {
          item.style.display = item.textContent.toLowerCase().includes(query) ? "flex" : "none";
        });
      });
    }

    if (!this.activeBookingId) {
      document.getElementById("chat-messages-box").innerHTML = renderEmptyState({
        title: "No booking selected",
        description: "Select an active booking from your dashboard to start chatting with your driver/customer.",
        actionText: "Go to Dashboard",
        actionLink: "#customer",
        icon: "chat"
      });
      return;
    }

    // Load booking details
    const booking = await BookingService.getBookingById(this.activeBookingId);
    if (booking) {
      const isCustomer = this.currentProfile?.id === booking.customer_id;
      const otherPerson = isCustomer ? booking.driver : booking.customer;
      document.getElementById("chat-subheading").innerText = `Chatting with ${otherPerson?.full_name || "Trip Partner"} (${booking.request?.pickup_address} → ${booking.request?.destination_address})`;
    }

    this.loadMessages();

    // Subscribe to realtime messages
    MessagingService.subscribeToMessages(this.activeBookingId, (newMsg) => {
      this.appendMessage(newMsg);
    });

    // Quick message pill clicks
    document.querySelectorAll(".quick-msg-pill").forEach((pill) => {
      pill.addEventListener("click", async (e) => {
        const text = e.target.innerText.replace(/^[^\s]+\s/, ""); // strip emoji prefix
        if (text.includes("Masked Call")) {
          alert("📞 Initiating masked call: Connecting to secure telephony proxy (+263 770 000 000)...");
          return;
        }
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
        const isCustomer = this.currentProfile?.id === booking?.customer_id;
        const receiverId = isCustomer ? booking?.driver_id : booking?.customer_id;

        await MessagingService.sendMessage({
          bookingId: this.activeBookingId,
          receiverId: receiverId,
          content: content
        });
      } catch (err) {
        alert("Could not send message: " + err.message);
      }
    });
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
      const route = `${booking.request?.pickup_address || "Pickup"} → ${booking.request?.destination_address || "Destination"}`;
      const driverName = booking.driver?.full_name || "Assigned driver";
      const avatar = booking.driver?.profile_photo_url
        ? `<img src="${booking.driver.profile_photo_url}" alt="${driverName}">`
        : driverName.charAt(0).toUpperCase();
      return `
        <button type="button" class="conversation-item ${booking.id === this.activeBookingId ? "active" : ""}" data-booking-id="${booking.id}">
          <span class="conversation-avatar">${avatar}</span>
          <span><strong>${driverName}</strong><small>${route}</small></span>
          <time>${booking.updated_at ? new Date(booking.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : ""}</time>
        </button>`;
    }).join("");

    container.querySelectorAll(".conversation-item").forEach((button) => {
      button.addEventListener("click", () => {
        window.location.hash = `#messages?booking=${button.getAttribute("data-booking-id")}`;
      });
    });
  },

  async loadMessages() {
    const box = document.getElementById("chat-messages-box");
    if (!box) return;

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

      box.innerHTML = messages.map((m) => {
        const isMine = m.sender_id === this.currentProfile?.id;
        return `
          <div class="chat-bubble ${isMine ? "mine" : "theirs"}">
            <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.2rem;">
              ${m.sender?.full_name || "User"} • ${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div>${m.content}</div>
          </div>
        `;
      }).join("");

      box.scrollTop = box.scrollHeight;
    } catch (err) {
      box.innerHTML = `<div style="padding: 1rem; color: var(--danger);">Failed to load messages.</div>`;
    }
  },

  appendMessage(msg) {
    const box = document.getElementById("chat-messages-box");
    if (!box) return;

    const isMine = msg.sender_id === this.currentProfile?.id;
    const msgEl = document.createElement("div");
    msgEl.className = `chat-bubble ${isMine ? "mine" : "theirs"}`;
    msgEl.innerHTML = `
      <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.2rem;">
        ${isMine ? "You" : "User"} • ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div>${msg.content}</div>
    `;

    box.appendChild(msgEl);
    box.scrollTop = box.scrollHeight;
  }
};
