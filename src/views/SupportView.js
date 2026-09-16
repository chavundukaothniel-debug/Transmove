// ==============================================================================
// TRANSMOVE SUPPORT, TICKETING, SAFETY & HELP CENTER VIEW
// ==============================================================================
import { TicketService } from "../services/tickets.js";
import { SafetyService } from "../services/safety.js";
import { renderEmptyState } from "../components/EmptyState.js";

export const SupportView = {
  activeTab: "tickets", // 'tickets' | 'safety' | 'help' | 'status'
  isPassengerView: false,

  renderPassengerSupport() {
    const faqs = [
      ["How do I post a transport request?", "Open Find Transport, enter your pickup and destination, select both locations on the map, add a suggested price, and post the request."],
      ["How do I choose a driver?", "Open Request Details and compare the real quotations received from verified drivers before accepting one."],
      ["How do I make a payment?", "Only verified payment records are shown in Payments. Follow the payment instructions attached to your confirmed booking when available."],
      ["Can I cancel a booking?", "Eligible confirmed bookings can be cancelled from Booking Details. A cancellation reason is required."],
      ["How do I save a driver?", "Saved-driver storage is not enabled in the current account system yet, so favourites are not created automatically."],
      ["What if I have a problem during a trip?", "Use the booking chat to contact your driver, or create a support ticket below with your booking ID."],
      ["How do I contact support?", "Open the contact section below and submit a support ticket. Your real ticket reference will appear after submission."]
    ];

    return `
      <div class="passenger-shell-page passenger-support-page">
        <div class="passenger-page-heading"><div><h2>Help &amp; Support</h2><p>We’re here to help you.</p></div></div>
        <section class="support-search-card"><span>⌕</span><input type="search" id="help-search-input" placeholder="Search for help topics…" aria-label="Search help topics"></section>
        <section id="passenger-faq-list" class="passenger-list-card faq-list">
          ${faqs.map(([question, answer]) => `
            <button type="button" class="faq-row" aria-expanded="false">
              <span><strong>${question}</strong><small>${answer}</small></span><b>›</b>
            </button>`).join("")}
        </section>
        <section class="support-contact-card">
          <span class="support-contact-icon">🎧</span>
          <div><h3>Still need help?</h3><p>Contact our support team and track your real support tickets.</p></div>
          <button type="button" id="btn-open-passenger-support" class="btn btn-primary">Contact Support</button>
        </section>
        <details id="passenger-support-details" class="passenger-support-details">
          <summary>Support tickets</summary>
          <div class="support-ticket-layout">
            <form id="create-ticket-form" class="card support-ticket-form">
              <h3>Create a Support Ticket</h3>
              <label class="passenger-field"><span>Category</span><select id="tkt-category" class="form-select" required><option value="Booking">Booking &amp; Trip Issue</option><option value="Driver">Driver Issue</option><option value="Payment">Payment &amp; Billing</option><option value="Safety">Safety</option><option value="Account">Account &amp; Profile</option><option value="Other">Other Query</option></select></label>
              <label class="passenger-field"><span>Subject</span><input type="text" id="tkt-subject" class="form-input" placeholder="How can we help?" required></label>
              <div class="support-reference-grid">
                <label class="passenger-field"><span>Trip ID (Optional)</span><input type="text" id="tkt-trip-id" class="form-input"></label>
                <label class="passenger-field"><span>Payment Ref (Optional)</span><input type="text" id="tkt-payment-id" class="form-input"></label>
              </div>
              <label class="passenger-field"><span>Description</span><textarea id="tkt-description" class="form-textarea" rows="4" required></textarea></label>
              <button type="submit" id="btn-submit-ticket" class="btn btn-primary passenger-submit-button">Create Support Ticket</button>
            </form>
            <div class="card support-ticket-history"><h3>My Support Tickets</h3><div id="user-tickets-container"><div class="passenger-loading-state">Loading tickets…</div></div></div>
          </div>
        </details>
      </div>`;
  },

  async render(currentProfile = null) {
    this.isPassengerView = ["customer", "passenger"].includes(currentProfile?.role);
    if (this.isPassengerView) return this.renderPassengerSupport();
    return `
      <div class="support-portal" style="max-width: 1180px; margin: 0 auto; padding: 1.5rem 0;">
        <div class="card-header" style="margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 2rem; font-weight: 900; letter-spacing: -0.03em;">TransMove Support &amp; Safety Centre</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Manage support tickets, access trip safety tools, browse help docs, and view system status</p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm sup-tab-btn ${this.activeTab === "tickets" ? "active" : ""}" data-tab="tickets">
              🎫 Support Tickets
            </button>
            <button class="btn btn-outline btn-sm sup-tab-btn ${this.activeTab === "safety" ? "active" : ""}" data-tab="safety">
              🛡️ Safety Centre
            </button>
            <button class="btn btn-outline btn-sm sup-tab-btn ${this.activeTab === "help" ? "active" : ""}" data-tab="help">
              📚 Help Centre
            </button>
            <button class="btn btn-outline btn-sm sup-tab-btn ${this.activeTab === "status" ? "active" : ""}" data-tab="status">
              ⚡ System Status
            </button>
          </div>
        </div>

        <!-- TAB 1: SUPPORT TICKETS -->
        <div id="sup-tab-tickets" class="sup-tab-content ${this.activeTab === "tickets" ? "" : "hidden"}" style="${this.activeTab === "tickets" ? "" : "display:none;"}">
          <div class="grid-2" style="gap: 2rem;">
            
            <!-- Create Ticket Form -->
            <div class="card">
              <h3 class="card-title" style="margin-bottom: 1.25rem;">Create New Support Ticket</h3>
              <form id="create-ticket-form">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="tkt-category" class="form-select" required>
                    <option value="Account">Account &amp; Profile</option>
                    <option value="Booking">Booking &amp; Trip Issue</option>
                    <option value="Driver">Driver Issue</option>
                    <option value="Passenger">Passenger Issue</option>
                    <option value="Payment">Payment &amp; Billing</option>
                    <option value="Subscription">Subscription Plan</option>
                    <option value="Refund">Refund Request</option>
                    <option value="Safety">Safety &amp; Emergency</option>
                    <option value="Vehicle">Vehicle Verification</option>
                    <option value="Logistics">Logistics / Freight</option>
                    <option value="Machinery">Machinery Rental</option>
                    <option value="Advertising">Advertising Platform</option>
                    <option value="Technical">Technical Bug</option>
                    <option value="Other">Other Query</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Subject</label>
                  <input type="text" id="tkt-subject" class="form-input" placeholder="Summary of your ticket" required />
                </div>

                <div class="grid-2">
                  <div class="form-group">
                    <label class="form-label">Trip ID (Optional)</label>
                    <input type="text" id="tkt-trip-id" class="form-input" placeholder="e.g. TM-2026-849201" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Payment Ref (Optional)</label>
                    <input type="text" id="tkt-payment-id" class="form-input" placeholder="e.g. TRX-938204" />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Detailed Description</label>
                  <textarea id="tkt-description" class="form-textarea" rows="4" placeholder="Provide full details of your request or issue..." required></textarea>
                </div>

                <button type="submit" id="btn-submit-ticket" class="btn btn-primary btn-lg btn-full">
                  Create Support Ticket 🎫
                </button>
              </form>
            </div>

            <!-- User Tickets List -->
            <div class="card">
              <h3 class="card-title" style="margin-bottom: 1.25rem;">My Support Tickets</h3>
              <div id="user-tickets-container">
                <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading support tickets from Supabase...</div>
              </div>
            </div>

          </div>
        </div>

        <!-- TAB 2: SAFETY CENTRE -->
        <div id="sup-tab-safety" class="sup-tab-content ${this.activeTab === "safety" ? "" : "hidden"}" style="${this.activeTab === "safety" ? "" : "display:none;"}">
          <div class="grid-2" style="gap: 2rem;">
            <div class="card">
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1.5rem;">
                <h3 style="color: #ef4444; font-weight: 800; font-size: 1.25rem; margin-bottom: 0.5rem;">🚨 Emergency SOS Alert</h3>
                <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 1rem;">
                  If you are in immediate physical danger, trigger an emergency alert below. This logs your current location and notifies TransMove safety support.
                </p>
                <button id="btn-trigger-sos-portal" class="btn btn-primary" style="background: #ef4444; border: none; font-weight: 800; width: 100%;">
                  TRIGGER SOS EMERGENCY ALERT
                </button>
              </div>

              <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Safety Guidelines</h4>
              <ul style="line-height: 1.6; font-size: 0.9rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.5rem;">
                <li>✓ Verify driver profile and vehicle registration number before entering vehicle.</li>
                <li>✓ Share your live trip link with family or friends.</li>
                <li>✓ Confirm trip security PIN with driver before departure.</li>
                <li>✓ Report any suspicious or unsafe behavior immediately.</li>
              </ul>
            </div>

            <div class="card">
              <h3 class="card-title" style="margin-bottom: 1rem;">Active Trip Safety Tools</h3>
              <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                Generate a live shareable tracking link to send to trusted contacts.
              </p>

              <button id="btn-generate-share-link" class="btn btn-outline btn-full" style="margin-bottom: 1.5rem;">
                🔗 Generate Shareable Trip Link
              </button>

              <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); font-size: 0.85rem; color: var(--text-muted);">
                <div style="font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">Official Safety Contacts</div>
                <div>Head Office: 17056 Teviotdale, Vainona, Harare</div>
                <div>Support Email: martintapiwa16@gmail.com</div>
                <div>Support Phone: 0780963653 / 078 166 4661</div>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: HELP CENTRE -->
        <div id="sup-tab-help" class="sup-tab-content ${this.activeTab === "help" ? "" : "hidden"}" style="${this.activeTab === "help" ? "" : "display:none;"}">
          <div class="card" style="margin-bottom: 2rem;">
            <div style="margin-bottom: 1.5rem;">
              <h3 class="card-title">Search Knowledge Base</h3>
              <input type="text" id="help-search-input" class="form-input" placeholder="Type a topic (e.g. Bidding, Paynow, Driver Onboarding)..." style="margin-top: 0.5rem;" />
            </div>

            <div class="grid-3" id="help-topics-container">
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">🚀 Getting Started</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">How to create an account, complete profile setup, and switch between customer, driver, and owner roles.</p>
              </div>
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">🚗 Bidding &amp; Offers</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Understanding fair driver offers, submitting counter-offers, and accepting confirmed trips.</p>
              </div>
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">💳 Paynow Payments</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">How subscription plans and Paynow payment checkouts are verified server-to-server.</p>
              </div>
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">📦 Logistics &amp; Freight</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Moving cargo, agricultural goods, and specifying load dimensions with security delivery tracking.</p>
              </div>
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">🚜 Heavy Machinery</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Listing excavators, tractors, and tipper trucks for daily or hourly hire by verified equipment owners.</p>
              </div>
              <div class="card" style="padding: 1.25rem;">
                <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">📢 Advertising</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">Creating business ad campaigns, targeting audiences, and tracking impressions on TransMove.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 4: SYSTEM STATUS -->
        <div id="sup-tab-status" class="sup-tab-content ${this.activeTab === "status" ? "" : "hidden"}" style="${this.activeTab === "status" ? "" : "display:none;"}">
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 1.5rem;">Platform Service Health</h3>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-weight: 700;">Supabase Database &amp; Auth</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">PostgreSQL, RLS Policies, User Sessions</div>
                </div>
                <span class="badge badge-success">OPERATIONAL</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-weight: 700;">Paynow Payment Gateway</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">Server-to-Server Checkout &amp; Webhooks</div>
                </div>
                <span class="badge badge-success">OPERATIONAL</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-weight: 700;">OpenStreetMap Routing Engine</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">OSRM Route Geometry &amp; Nominatim Geocoding</div>
                </div>
                <span class="badge badge-success">OPERATIONAL</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <div>
                  <div style="font-weight: 700;">Realtime Messaging &amp; Live Geolocation</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">Supabase Realtime Broadcast Channels</div>
                </div>
                <span class="badge badge-success">OPERATIONAL</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  async init() {
    // Parse URL parameter tab if present (e.g., #support?tab=safety)
    const hash = window.location.hash;
    if (hash.includes("tab=safety")) this.activeTab = "safety";
    if (hash.includes("tab=help")) this.activeTab = "help";
    if (hash.includes("tab=status")) this.activeTab = "status";

    if (this.isPassengerView) {
      document.querySelectorAll(".faq-row").forEach((row) => {
        row.addEventListener("click", () => {
          const expanded = row.getAttribute("aria-expanded") === "true";
          row.setAttribute("aria-expanded", String(!expanded));
        });
      });
      const helpSearch = document.getElementById("help-search-input");
      helpSearch?.addEventListener("input", () => {
        const query = helpSearch.value.trim().toLowerCase();
        document.querySelectorAll(".faq-row").forEach((row) => {
          row.style.display = row.textContent.toLowerCase().includes(query) ? "flex" : "none";
        });
      });
      document.getElementById("btn-open-passenger-support")?.addEventListener("click", () => {
        const details = document.getElementById("passenger-support-details");
        if (details) {
          details.open = true;
          details.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    // Tab buttons
    document.querySelectorAll(".sup-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.getAttribute("data-tab");
        this.switchTab(tab);
      });
    });

    // Create Ticket Form
    document.getElementById("create-ticket-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const category = document.getElementById("tkt-category").value;
      const subject = document.getElementById("tkt-subject").value.trim();
      const description = document.getElementById("tkt-description").value.trim();
      const tripId = document.getElementById("tkt-trip-id").value.trim() || null;
      const paymentId = document.getElementById("tkt-payment-id").value.trim() || null;

      const btn = document.getElementById("btn-submit-ticket");
      btn.disabled = true;
      btn.innerText = "Creating Ticket...";

      try {
        const ticket = await TicketService.createTicket({
          category,
          subject,
          description,
          tripId,
          paymentId
        });

        alert(`Ticket created successfully! Ticket Reference: ${ticket.ticket_number || 'TM-SUP-CONFIRMED'}`);
        document.getElementById("create-ticket-form").reset();
        this.loadUserTickets();
      } catch (err) {
        alert("Error creating ticket: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "Create Support Ticket 🎫";
      }
    });

    // Safety SOS & Share Trip Buttons
    document.getElementById("btn-trigger-sos-portal")?.addEventListener("click", () => {
      if (confirm("⚠️ Confirm Emergency SOS Trigger? This will log your current coordinates and alert safety support.")) {
        SafetyService.triggerSOS("user-id", "general-sos").then((res) => alert(res.message));
      }
    });

    document.getElementById("btn-generate-share-link")?.addEventListener("click", () => {
      const link = SafetyService.generateShareableTripLink("active-trip");
      prompt("Share this live tracking link with family or friends:", link);
    });

    // Load User Tickets if on tickets tab
    this.loadUserTickets();
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".sup-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });

    const tabs = ["tickets", "safety", "help", "status"];
    tabs.forEach((t) => {
      const el = document.getElementById(`sup-tab-${t}`);
      if (el) {
        el.style.display = t === tab ? "block" : "none";
      }
    });

    if (tab === "tickets") {
      this.loadUserTickets();
    }
  },

  async loadUserTickets() {
    const container = document.getElementById("user-tickets-container");
    if (!container) return;

    try {
      const tickets = await TicketService.getUserTickets();

      if (!tickets || tickets.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No support tickets found",
          description: "Create a ticket using the form when you need assistance from TransMove support.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = tickets.map((t) => `
        <div class="card" style="margin-bottom: 1rem; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="font-weight: 800; font-size: 1rem;">${t.ticket_number || t.id.slice(0, 10)}</div>
            <span class="badge ${t.status === "RESOLVED" || t.status === "closed" ? "badge-success" : "badge-warning"}">${t.status}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--primary); font-weight: 700; margin-bottom: 0.25rem;">${t.category}</div>
          <div style="font-weight: 700; margin-bottom: 0.35rem;">${t.subject}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${t.description}</div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "No support tickets found",
        description: "Your open and resolved tickets will be displayed here.",
        icon: "inbox"
      });
    }
  }
};
