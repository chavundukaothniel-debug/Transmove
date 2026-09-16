// ==============================================================================
// TRANSMOVE PASSENGER DASHBOARD VIEW
// Real Supabase Data: Active Request, Job Status, Quotations, Saved Providers, Notifications
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { OfferService } from "../services/offers.js";
import { BookingService } from "../services/booking.js";
import { LocationService } from "../services/location.js";
import { NotificationService } from "../services/notifications.js";
import { AuthService } from "../services/auth.js";
import { WalletService } from "../services/wallet.js";
import { renderEmptyState } from "../components/EmptyState.js";

const passengerIcon = (name, size = 20) => {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    bus: '<path d="M6 17h12M7 17v2M17 17v2M5 14V6.8C5 5.25 6.25 4 7.8 4h8.4C17.75 4 19 5.25 19 6.8V14M5 10h14M8 14h.01M16 14h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    wallet: '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"/><path d="M4 8h15M15 12h4"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    package: '<path d="m16.5 9.4-9-5.2M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3v8Z"/><circle cx="12" cy="11" r="2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>'
  };

  return `<svg class="passenger-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bus}</svg>`;
};

export const CustomerView = {
  activeTab: "overview", // 'overview' | 'new-request' | 'active-bids' | 'bookings'
  pickupCoords: null,
  destCoords: null,
  distanceKm: null,
  durationMins: null,
  selectionMode: null, // 'pickup' | 'destination' | null
  
  mapInstance: null,
  tileLayer: null,
  pickupMarker: null,
  destMarker: null,
  routePolyline: null,

  async render(currentProfile = null) {
    const firstName = currentProfile?.full_name?.trim()?.split(/\s+/)[0] || "there";
    const hashParams = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    this.activeTab = {
      search: "new-request",
      bookings: "bookings",
      quotes: "active-bids",
      "booking-details": "booking-details",
      payments: "payments",
      favourites: "favourites",
      notifications: "notifications"
    }[hashParams.get("tab")] || "overview";

    return `
      <div class="customer-dashboard passenger-dashboard-container">
        <!-- Existing tab controls remain mounted for the sidebar and quick actions. -->
        <div class="customer-tab-switcher" aria-hidden="true">
          <button class="btn btn-outline btn-sm cust-tab-btn ${this.activeTab === "overview" ? "active" : ""}" data-tab="overview">
            Overview
          </button>
          <button class="btn btn-outline btn-sm cust-tab-btn ${this.activeTab === "new-request" ? "active" : ""}" data-tab="new-request">
            Request Transport
          </button>
          <button class="btn btn-outline btn-sm cust-tab-btn ${this.activeTab === "active-bids" ? "active" : ""}" data-tab="active-bids">
            Quotations Received
          </button>
          <button class="btn btn-outline btn-sm cust-tab-btn ${this.activeTab === "bookings" ? "active" : ""}" data-tab="bookings">
            My Bookings
          </button>
        </div>

        <!-- TAB 0: OVERVIEW & LIVE STATUS DASHBOARD -->
        <div id="tab-content-overview" class="${this.activeTab === "overview" ? "" : "hidden"}" style="${this.activeTab === "overview" ? "" : "display:none;"}">
          <section class="passenger-overview-card" aria-labelledby="passenger-welcome-title">
            <div class="passenger-welcome-row">
              <div>
                <h2 id="passenger-welcome-title" class="passenger-welcome-title">Welcome back, ${firstName}</h2>
                <p class="passenger-welcome-sub">Find reliable transport, anytime, anywhere.</p>
              </div>
              <button id="btn-quick-request-service" class="btn passenger-primary-button" type="button">
                ${passengerIcon("plus", 20)}
                <span>Post a New Request</span>
              </button>
            </div>

            <div class="summary-cards-grid" aria-label="Booking summary">
              <article class="passenger-summary-card">
                <div class="summary-icon-circle icon-blue">${passengerIcon("bus", 26)}</div>
                <div class="summary-card-copy">
                  <div class="summary-card-title">Active Requests</div>
                  <div id="cust-stat-active" class="summary-card-number"><span class="summary-loading">—</span></div>
                  <div class="summary-card-sub">Currently open</div>
                </div>
              </article>
              <article class="passenger-summary-card">
                <div class="summary-icon-circle icon-green">${passengerIcon("check", 25)}</div>
                <div class="summary-card-copy">
                  <div class="summary-card-title">Completed Bookings</div>
                  <div id="cust-stat-completed" class="summary-card-number"><span class="summary-loading">—</span></div>
                  <div class="summary-card-sub">Successfully delivered</div>
                </div>
              </article>
              <article class="passenger-summary-card">
                <div class="summary-icon-circle icon-amber">${passengerIcon("wallet", 25)}</div>
                <div class="summary-card-copy">
                  <div class="summary-card-title">Total Spent</div>
                  <div id="cust-stat-spent" class="summary-card-number"><span class="summary-loading">—</span></div>
                  <div class="summary-card-sub">Completed bookings</div>
                </div>
              </article>
              <article class="passenger-summary-card">
                <div class="summary-icon-circle icon-red">${passengerIcon("heart", 24)}</div>
                <div class="summary-card-copy">
                  <div class="summary-card-title">Saved Drivers</div>
                  <div id="cust-stat-drivers" class="summary-card-number"><span class="summary-loading">—</span></div>
                  <div class="summary-card-sub">Your favourites</div>
                </div>
              </article>
            </div>
          </section>

          <div class="passenger-main-grid">
            <section class="passenger-panel passenger-find-panel" aria-labelledby="find-transport-title">
              <div class="passenger-panel-header">
                <h3 id="find-transport-title">Find Transport</h3>
                <button type="button" class="passenger-link-button" data-customer-tab="new-request">View All</button>
              </div>

              <div class="service-tab-group" role="tablist" aria-label="Transport type">
                <button type="button" class="service-tab-btn active" data-quick-service="ride" role="tab" aria-selected="true">
                  ${passengerIcon("users", 20)} Passengers
                </button>
                <button type="button" class="service-tab-btn" data-quick-service="logistics" role="tab" aria-selected="false">
                  ${passengerIcon("package", 20)} Goods
                </button>
              </div>

              <form id="dashboard-find-transport-form" class="passenger-search-form">
                <div class="passenger-search-grid">
                  <label class="passenger-field">
                    <span>From <b aria-hidden="true">*</b></span>
                    <span class="passenger-input-shell">
                      ${passengerIcon("pin", 20)}
                      <input id="dashboard-pickup" type="text" placeholder="Enter pickup location" autocomplete="off" required>
                    </span>
                  </label>
                  <label class="passenger-field">
                    <span>To <b aria-hidden="true">*</b></span>
                    <span class="passenger-input-shell">
                      ${passengerIcon("pin", 20)}
                      <input id="dashboard-destination" type="text" placeholder="Enter destination" autocomplete="off" required>
                    </span>
                  </label>
                  <label class="passenger-field">
                    <span>Date <b aria-hidden="true">*</b></span>
                    <span class="passenger-input-shell passenger-date-shell">
                      <input id="dashboard-travel-date" type="date" required aria-label="Travel date">
                    </span>
                  </label>
                  <label class="passenger-field">
                    <span>Passengers</span>
                    <span class="passenger-input-shell passenger-select-shell">
                      <select id="dashboard-passenger-count" aria-label="Number of passengers">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5+</option>
                      </select>
                    </span>
                  </label>
                </div>
                <button id="btn-dashboard-search-transport" class="btn passenger-search-button" type="submit">
                  ${passengerIcon("search", 20)}
                  <span>Search Transport</span>
                </button>
              </form>
            </section>

            <section class="passenger-panel passenger-bookings-panel" aria-labelledby="recent-bookings-title">
              <div class="passenger-panel-header">
                <h3 id="recent-bookings-title">Recent Bookings</h3>
                <button type="button" class="passenger-link-button" data-customer-tab="bookings">View All</button>
              </div>
              <div id="cust-overview-bookings-container" class="recent-bookings-list" aria-live="polite">
                <div class="passenger-loading-state">Loading your recent bookings…</div>
              </div>
            </section>
          </div>

          <nav class="quick-actions-grid" aria-label="Passenger shortcuts">
            <button type="button" class="quick-action-card" data-customer-tab="new-request" data-service="ride">
              <span class="summary-icon-circle icon-blue">${passengerIcon("users", 25)}</span>
              <span><strong>Book a Ride</strong><small>Find transport for you</small></span>
            </button>
            <button type="button" class="quick-action-card" data-customer-tab="new-request" data-service="logistics">
              <span class="summary-icon-circle icon-amber">${passengerIcon("package", 24)}</span>
              <span><strong>Send a Parcel</strong><small>Send goods or parcels</small></span>
            </button>
            <button type="button" class="quick-action-card" data-customer-tab="bookings">
              <span class="summary-icon-circle icon-purple">${passengerIcon("calendar", 24)}</span>
              <span><strong>My Bookings</strong><small>View and manage</small></span>
            </button>
            <a href="#customer?tab=favourites" class="quick-action-card">
              <span class="summary-icon-circle icon-red">${passengerIcon("heart", 24)}</span>
              <span><strong>Saved Drivers</strong><small>Your favourites</small></span>
            </a>
          </nav>

          <section class="travel-safety-banner" aria-label="Travel safety">
            <div class="travel-safety-icon">${passengerIcon("shield", 32)}</div>
            <div class="travel-safety-copy">
              <h3>Travel Safely with TransMove</h3>
              <p>Verified drivers. Reliable transport. A better Zimbabwe.</p>
            </div>
            <div class="travel-safety-image" aria-hidden="true"></div>
          </section>
        </div>

        <!-- TAB 1: NEW REQUEST FORM -->
        <div id="tab-content-new-request" class="${this.activeTab === "new-request" ? "" : "hidden"}" style="${this.activeTab === "new-request" ? "" : "display:none;"}">
          <div class="passenger-page-heading">
            <div><h2>Post a New Request</h2><p>Tell us what you need and receive quotes from verified drivers.</p></div>
          </div>
          <div class="grid-2 passenger-request-layout">
            <!-- Left Form Column -->
            <div class="card passenger-form-card">
              <form id="create-request-form">
                <div class="request-type-tabs" role="tablist" aria-label="Request type">
                  <button type="button" class="request-type-btn active" data-request-type="ride">${passengerIcon("users", 18)} Passenger</button>
                  <button type="button" class="request-type-btn" data-request-type="logistics">${passengerIcon("package", 18)} Goods</button>
                  <button type="button" class="request-type-btn" data-request-type="hire">${passengerIcon("bus", 18)} Vehicle Hire</button>
                </div>
                <div class="form-group request-type-select-wrap">
                  <label class="form-label" for="req-service-type">Service Type</label>
                  <select id="req-service-type" class="form-select">
                    <option value="ride">Passenger Ride (Sedan / Hatchback)</option>
                    <option value="logistics">Logistics / Freight Transport (Truck / Bakkie)</option>
                    <option value="hire">Driver &amp; Vehicle Hire</option>
                  </select>
                </div>

                <!-- Pickup Input -->
                <div class="form-group" style="position: relative;">
                  <label class="form-label">Pickup Location</label>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="req-pickup" class="form-input" placeholder="Enter pickup location or click map" autocomplete="off" required />
                    <button type="button" id="btn-clear-pickup" class="btn btn-outline btn-sm" title="Clear Pickup" style="display: none; padding: 0 0.6rem;">✕</button>
                    <button type="button" id="btn-cust-gps" class="btn btn-outline btn-sm" title="Auto-detect current GPS">
                      📍 GPS
                    </button>
                  </div>
                  <div id="pickup-suggestions" class="address-suggestions-dropdown" style="display: none;"></div>
                </div>

                <!-- Destination Input -->
                <div class="form-group" style="position: relative;">
                  <label class="form-label">Drop-off Destination</label>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="req-dest" class="form-input" placeholder="Enter drop-off destination or click map" autocomplete="off" required />
                    <button type="button" id="btn-clear-dest" class="btn btn-outline btn-sm" title="Clear Destination" style="display: none; padding: 0 0.6rem;">✕</button>
                  </div>
                  <div id="dest-suggestions" class="address-suggestions-dropdown" style="display: none;"></div>
                </div>

                <!-- Cargo Specific Fields -->
                <div id="cargo-fields" style="display: none; background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
                  <div class="form-group">
                    <label class="form-label">Cargo Description</label>
                    <input type="text" id="req-load-desc" class="form-input" placeholder="e.g. 50 bags of maize, furniture, etc." />
                  </div>
                  <div class="grid-2">
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Est. Weight (kg)</label>
                      <input type="number" id="req-load-weight" class="form-input" placeholder="e.g. 500" />
                    </div>
                    <div class="form-group" style="margin-bottom: 0;">
                      <label class="form-label">Dimensions</label>
                      <input type="text" id="req-load-dims" class="form-input" placeholder="e.g. 2m x 1.5m" />
                    </div>
                  </div>
                </div>

                <div class="grid-2">
                  <div class="form-group">
                    <label class="form-label">Estimated Route Distance</label>
                    <input type="text" id="req-distance" class="form-input" value="Enter a destination to calculate your route." readonly style="font-size: 0.85rem; font-weight: 600; color: var(--primary);" />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Your Suggested Price ($)</label>
                    <input type="number" id="req-suggested-price" class="form-input" placeholder="e.g. 12.00" min="1" step="0.5" required />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Special Notes for Driver (Optional)</label>
                  <textarea id="req-notes" class="form-textarea" rows="2" placeholder="e.g. Waiting at main gate, 2 small suitcases"></textarea>
                </div>

                <button type="submit" id="btn-submit-request" class="btn btn-primary btn-lg btn-full passenger-submit-button" disabled>
                  Post Request
                </button>
              </form>
            </div>

            <!-- Right Map Column -->
            <div class="card passenger-map-card" style="display: flex; flex-direction: column;">
              <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <h3 class="card-title">🗺️ Interactive Route Map</h3>
                  <div id="map-selection-banner" style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-top: 0.2rem;">
                    Select pickup or destination using controls or enter address
                  </div>
                </div>
                <!-- Map Action Controls -->
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  <button type="button" id="map-btn-gps" class="btn btn-outline btn-sm" title="Use current GPS location">📍 Use My Location</button>
                  <button type="button" id="map-btn-pickup" class="btn btn-outline btn-sm">📍 Select Pickup</button>
                  <button type="button" id="map-btn-dest" class="btn btn-outline btn-sm">🔴 Select Destination</button>
                  <button type="button" id="map-btn-reset" class="btn btn-outline btn-sm" title="Reset Locations">↻ Reset</button>
                </div>
              </div>

              <div id="customer-map" class="map-container" style="height: 420px; width: 100%; border-radius: var(--radius-md); overflow: hidden; position: relative;"></div>

              <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <span>🟢 Green Marker: Pickup</span>
                <span>🔴 Red Marker: Destination</span>
                <span>🛣️ Solid Line: Route</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 2: ACTIVE BIDS & QUOTATIONS -->
        <div id="tab-content-active-bids" class="${this.activeTab === "active-bids" ? "" : "hidden"}" style="${this.activeTab === "active-bids" ? "" : "display:none;"}">
          <div class="passenger-page-heading">
            <div><h2>Request Details</h2><p>Compare real quotations received for your open transport requests.</p></div>
          </div>
          <div id="active-requests-board">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading active requests &amp; driver quotations...</div>
          </div>
        </div>

        <!-- TAB 3: MY BOOKINGS -->
        <div id="tab-content-bookings" class="${this.activeTab === "bookings" ? "" : "hidden"}" style="${this.activeTab === "bookings" ? "" : "display:none;"}">
          <div class="passenger-page-heading">
            <div><h2>My Bookings</h2><p>Track and manage all your transport requests.</p></div>
          </div>
          <div class="passenger-filter-tabs" role="tablist" aria-label="Booking filters">
            <button class="passenger-filter-btn active" type="button" data-booking-filter="all">All</button>
            <button class="passenger-filter-btn" type="button" data-booking-filter="upcoming">Upcoming</button>
            <button class="passenger-filter-btn" type="button" data-booking-filter="in_progress">In Progress</button>
            <button class="passenger-filter-btn" type="button" data-booking-filter="completed">Completed</button>
            <button class="passenger-filter-btn" type="button" data-booking-filter="cancelled">Cancelled</button>
          </div>
          <div id="my-bookings-board">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading bookings...</div>
          </div>
        </div>

        <!-- TAB 4: BOOKING DETAILS -->
        <div id="tab-content-booking-details" class="${this.activeTab === "booking-details" ? "" : "hidden"}" style="${this.activeTab === "booking-details" ? "" : "display:none;"}">
          <div id="booking-details-board"><div class="passenger-loading-state">Loading booking details…</div></div>
        </div>

        <!-- TAB 5: PAYMENTS -->
        <div id="tab-content-payments" class="${this.activeTab === "payments" ? "" : "hidden"}" style="${this.activeTab === "payments" ? "" : "display:none;"}">
          <div class="passenger-page-heading"><div><h2>Payments</h2><p>View your real transaction history and booking spend.</p></div></div>
          <div id="payments-board"><div class="passenger-loading-state">Loading payment history…</div></div>
        </div>

        <!-- TAB 6: FAVOURITES -->
        <div id="tab-content-favourites" class="${this.activeTab === "favourites" ? "" : "hidden"}" style="${this.activeTab === "favourites" ? "" : "display:none;"}">
          <div class="passenger-page-heading"><div><h2>Saved Drivers</h2><p>Your trusted and favourite drivers.</p></div></div>
          <div id="favourites-board"></div>
        </div>

        <!-- TAB 7: NOTIFICATIONS -->
        <div id="tab-content-notifications" class="${this.activeTab === "notifications" ? "" : "hidden"}" style="${this.activeTab === "notifications" ? "" : "display:none;"}">
          <div class="passenger-page-heading"><div><h2>Notifications</h2><p>Stay updated on your requests, bookings, messages, and payments.</p></div></div>
          <div class="passenger-filter-tabs" role="tablist" aria-label="Notification filters">
            <button class="passenger-filter-btn active" type="button" data-notification-filter="all">All</button>
            <button class="passenger-filter-btn" type="button" data-notification-filter="request">Requests</button>
            <button class="passenger-filter-btn" type="button" data-notification-filter="booking">Bookings</button>
            <button class="passenger-filter-btn" type="button" data-notification-filter="message">Messages</button>
            <button class="passenger-filter-btn" type="button" data-notification-filter="payment">Payments</button>
          </div>
          <div id="notifications-board"><div class="passenger-loading-state">Loading notifications…</div></div>
        </div>
      </div>
    `;
  },

  async init() {
    // Reset location & map state
    this.pickupCoords = null;
    this.destCoords = null;
    this.distanceKm = null;
    this.durationMins = null;
    this.selectionMode = null;
    this.pickupMarker = null;
    this.destMarker = null;
    this.routePolyline = null;

    // Quick Action button: "Request a Service"
    document.getElementById("btn-quick-request-service")?.addEventListener("click", () => {
      this.switchTab("new-request");
    });

    // Tab Switching
    document.querySelectorAll(".cust-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const targetTab = e.currentTarget.getAttribute("data-tab");
        this.switchTab(targetTab);
      });
    });

    // Dashboard shortcuts reuse the existing tab and form flows.
    document.querySelectorAll("[data-customer-tab]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const targetTab = event.currentTarget.getAttribute("data-customer-tab");
        const service = event.currentTarget.getAttribute("data-service");
        this.switchTab(targetTab);

        if (service) {
          const serviceSelect = document.getElementById("req-service-type");
          if (serviceSelect) {
            serviceSelect.value = service;
            serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });
    });

    let quickService = "ride";
    document.querySelectorAll("[data-quick-service]").forEach((button) => {
      button.addEventListener("click", (event) => {
        quickService = event.currentTarget.getAttribute("data-quick-service") || "ride";
        document.querySelectorAll("[data-quick-service]").forEach((tabButton) => {
          const isSelected = tabButton === event.currentTarget;
          tabButton.classList.toggle("active", isSelected);
          tabButton.setAttribute("aria-selected", String(isSelected));
        });
      });
    });

    document.getElementById("dashboard-find-transport-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const pickup = document.getElementById("dashboard-pickup")?.value?.trim() || "";
      const destination = document.getElementById("dashboard-destination")?.value?.trim() || "";

      this.switchTab("new-request");

      const serviceSelect = document.getElementById("req-service-type");
      if (serviceSelect) {
        serviceSelect.value = quickService;
        serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const pickupInput = document.getElementById("req-pickup");
      const destinationInput = document.getElementById("req-dest");
      if (pickupInput) pickupInput.value = pickup;
      if (destinationInput) destinationInput.value = destination;
      pickupInput?.focus();
    });

    // Service type toggle
    document.getElementById("req-service-type")?.addEventListener("change", (e) => {
      const cargoDiv = document.getElementById("cargo-fields");
      if (cargoDiv) {
        cargoDiv.style.display = e.target.value === "logistics" ? "block" : "none";
      }
      document.querySelectorAll("[data-request-type]").forEach((button) => {
        button.classList.toggle("active", button.getAttribute("data-request-type") === e.target.value);
      });
    });

    document.querySelectorAll("[data-request-type]").forEach((button) => {
      button.addEventListener("click", (event) => {
        const serviceSelect = document.getElementById("req-service-type");
        if (!serviceSelect) return;
        serviceSelect.value = event.currentTarget.getAttribute("data-request-type") || "ride";
        serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    document.querySelectorAll("[data-booking-filter]").forEach((button) => {
      button.addEventListener("click", (event) => {
        document.querySelectorAll("[data-booking-filter]").forEach((item) => item.classList.remove("active"));
        event.currentTarget.classList.add("active");
        this.loadBookings(event.currentTarget.getAttribute("data-booking-filter") || "all");
      });
    });

    document.querySelectorAll("[data-notification-filter]").forEach((button) => {
      button.addEventListener("click", (event) => {
        document.querySelectorAll("[data-notification-filter]").forEach((item) => item.classList.remove("active"));
        event.currentTarget.classList.add("active");
        this.loadNotificationsPage(event.currentTarget.getAttribute("data-notification-filter") || "all");
      });
    });

    // Clear Location Buttons
    document.getElementById("btn-clear-pickup")?.addEventListener("click", () => this.clearPickup());
    document.getElementById("btn-clear-dest")?.addEventListener("click", () => this.clearDestination());

    // Suggested Price Input Validation
    document.getElementById("req-suggested-price")?.addEventListener("input", (e) => {
      delete e.target.dataset.autoCalculated;
      this.validateForm();
    });

    // GPS Auto-detect handler
    const handleGpsClick = async () => {
      const btn = document.getElementById("btn-cust-gps");
      if (btn) {
        btn.innerText = "Locating...";
        btn.disabled = true;
      }
      try {
        const coords = await LocationService.getCurrentPosition();
        await this.setPickup(coords.lat, coords.lng);
        if (btn) btn.innerText = "✓ Found";
      } catch (err) {
        alert(err.message);
        if (btn) btn.innerText = "📍 GPS";
      } finally {
        if (btn) btn.disabled = false;
      }
    };

    document.getElementById("btn-cust-gps")?.addEventListener("click", handleGpsClick);
    document.getElementById("map-btn-gps")?.addEventListener("click", handleGpsClick);

    // Map Action Control Buttons
    document.getElementById("map-btn-pickup")?.addEventListener("click", () => {
      this.setSelectionMode(this.selectionMode === "pickup" ? null : "pickup");
    });
    document.getElementById("map-btn-dest")?.addEventListener("click", () => {
      this.setSelectionMode(this.selectionMode === "destination" ? null : "destination");
    });
    document.getElementById("map-btn-reset")?.addEventListener("click", () => {
      this.clearPickup();
      this.clearDestination();
      this.setSelectionMode(null);
    });

    // Address Search Inputs
    this.setupAddressAutocomplete("req-pickup", "pickup-suggestions", (item) => {
      this.setPickup(item.lat, item.lng, item.address);
    });
    this.setupAddressAutocomplete("req-dest", "dest-suggestions", (item) => {
      this.setDestination(item.lat, item.lng, item.address);
    });

    window.addEventListener("themechanged", () => {
      this.updateMapTheme();
    });

    // Request Form Submit
    document.getElementById("create-request-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!this.pickupCoords || !this.pickupCoords.lat || !this.pickupCoords.lng) {
        alert("Please select a pickup location.");
        return;
      }

      if (!this.destCoords || !this.destCoords.lat || !this.destCoords.lng) {
        alert("Please select a destination.");
        return;
      }

      if (!this.distanceKm) {
        alert("Please select valid pickup and destination locations to calculate route.");
        return;
      }

      const priceVal = parseFloat(document.getElementById("req-suggested-price").value);
      if (!priceVal || priceVal <= 0) {
        alert("Please enter your suggested price.");
        return;
      }

      const submitBtn = document.getElementById("btn-submit-request");
      submitBtn.disabled = true;
      submitBtn.innerText = "Publishing...";

      try {
        await RequestService.createRequest({
          request_type: document.getElementById("req-service-type").value,
          pickup_address: document.getElementById("req-pickup").value,
          pickup_lat: this.pickupCoords.lat,
          pickup_lng: this.pickupCoords.lng,
          destination_address: document.getElementById("req-dest").value,
          dest_lat: this.destCoords.lat,
          dest_lng: this.destCoords.lng,
          estimated_distance_km: this.distanceKm,
          estimated_duration_mins: this.durationMins || LocationService.estimateDuration(this.distanceKm),
          load_description: document.getElementById("req-load-desc")?.value,
          load_weight_kg: document.getElementById("req-load-weight")?.value,
          load_dimensions: document.getElementById("req-load-dims")?.value,
          suggested_price: priceVal,
          notes: document.getElementById("req-notes")?.value
        });

        alert("Request published successfully! Verified drivers in your area are receiving your request.");
        this.switchTab("overview");
      } catch (err) {
        alert("Error publishing request: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Post Request";
      }
    });

    const hashParams = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    const requestedTab = {
      search: "new-request",
      bookings: "bookings",
      quotes: "active-bids",
      "booking-details": "booking-details",
      payments: "payments",
      favourites: "favourites",
      notifications: "notifications"
    }[hashParams.get("tab")];

    if (requestedTab) {
      this.switchTab(requestedTab);
    } else {
      await this.loadOverviewData();
    }
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".cust-tab-btn").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });

    const tabs = ["overview", "new-request", "active-bids", "bookings", "booking-details", "payments", "favourites", "notifications"];
    tabs.forEach((t) => {
      const el = document.getElementById(`tab-content-${t}`);
      if (el) {
        el.style.display = t === tab ? "block" : "none";
      }
    });

    if (tab === "overview") {
      this.loadOverviewData();
    } else if (tab === "new-request") {
      setTimeout(() => this.initMap(), 150);
    } else if (tab === "active-bids") {
      this.loadActiveBids();
    } else if (tab === "bookings") {
      this.loadBookings();
    } else if (tab === "booking-details") {
      const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
      this.loadBookingDetails(params.get("id"));
    } else if (tab === "payments") {
      this.loadPayments();
    } else if (tab === "favourites") {
      this.loadFavourites();
    } else if (tab === "notifications") {
      this.loadNotificationsPage();
    }
  },

  async loadOverviewData() {
    await Promise.all([
      this.loadDashboardSummary(),
      this.loadOverviewBookings()
    ]);
  },

  async loadDashboardSummary() {
    const activeEl = document.getElementById("cust-stat-active");
    const completedEl = document.getElementById("cust-stat-completed");
    const spentEl = document.getElementById("cust-stat-spent");
    const driversEl = document.getElementById("cust-stat-drivers");
    if (!activeEl || !completedEl || !spentEl || !driversEl) return;

    try {
      const [requests, bookings] = await Promise.all([
        RequestService.getCustomerRequests(),
        BookingService.getUserBookings()
      ]);

      const activeCount = (requests || []).filter((request) =>
        ["searching", "offers_received", "negotiating"].includes(request.status)
      ).length;
      const completedBookings = (bookings || []).filter((booking) => booking.status === "completed");
      const totalSpent = completedBookings.reduce((total, booking) => {
        const amount = Number.parseFloat(booking.final_price);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      activeEl.textContent = String(activeCount);
      completedEl.textContent = String(completedBookings.length);
      spentEl.textContent = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(totalSpent);
      // There is no favourites persistence in the current schema, so do not infer
      // a saved-driver count from completed bookings.
      driversEl.textContent = "—";
    } catch (error) {
      activeEl.textContent = "—";
      completedEl.textContent = "—";
      spentEl.textContent = "—";
      driversEl.textContent = "—";
    }
  },

  /**
   * Helper to map raw DB status to mandatory clean marketplace status display label:
   * REQUESTED | QUOTING | QUOTED | ACCEPTED | IN_PROGRESS | COMPLETED | CANCELLED
   */
  getDisplayStatus(status) {
    if (!status) return "REQUESTED";
    const s = status.toLowerCase();
    if (s === "searching") return "REQUESTED";
    if (s === "offers_received" || s === "negotiating") return "QUOTED";
    if (s === "accepted" || s === "confirmed") return "ACCEPTED";
    if (s === "driver_arriving" || s === "in_progress") return "IN_PROGRESS";
    if (s === "completed") return "COMPLETED";
    if (s === "cancelled") return "CANCELLED";
    return status.toUpperCase();
  },

  async loadActiveRequestAndJobStatus() {
    const container = document.getElementById("cust-active-request-container");
    const badge = document.getElementById("cust-active-status-badge");
    if (!container) return;

    try {
      const requests = await RequestService.getCustomerRequests();
      const bookings = await BookingService.getUserBookings();

      const activeReq = (requests || []).find((r) => ["searching", "offers_received", "negotiating"].includes(r.status));
      const activeBooking = (bookings || []).find((b) => ["confirmed", "driver_arriving", "in_progress"].includes(b.status));

      if (activeBooking) {
        const displayStatus = this.getDisplayStatus(activeBooking.status);
        if (badge) {
          badge.className = "badge badge-info";
          badge.innerText = `STATUS: ${displayStatus}`;
        }

        container.innerHTML = `
          <div style="background: var(--bg-hover); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--primary-light);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <span class="badge badge-success" style="font-size: 0.8rem; font-weight: 700;">CONFIRMED BOOKING</span>
                <h4 style="font-size: 1.15rem; font-weight: 800; margin: 0.25rem 0 0.15rem 0; color: var(--text-main);">
                  Trip #${activeBooking.id.slice(0, 8)}
                </h4>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  Status: <strong style="color: var(--primary);">${displayStatus}</strong>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.35rem; font-weight: 900; color: var(--primary);">$${activeBooking.final_price}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Agreed Price</div>
              </div>
            </div>

            <div class="grid-2" style="margin-bottom: 1rem; font-size: 0.9rem;">
              <div><strong>Pickup:</strong> ${activeBooking.request?.pickup_address || "Pickup Location"}</div>
              <div><strong>Destination:</strong> ${activeBooking.request?.destination_address || "Drop-off Destination"}</div>
            </div>

            <div style="background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; padding: 0.85rem 1.15rem; border-radius: var(--radius-sm); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8;">Assigned Provider</div>
                <div style="font-weight: 800; font-size: 1rem; color: #38bdf8;">${activeBooking.driver?.full_name || "Verified Driver"}</div>
              </div>
              <div>
                <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8;">Trip Confirmation PIN</div>
                <div style="font-weight: 900; font-size: 1.25rem; color: #4ade80; letter-spacing: 0.1em;">${activeBooking.trip_pin || "----"}</div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
              <button class="btn btn-primary btn-sm" onclick="window.location.hash='#customer'; document.querySelector('[data-tab=bookings]').click();">
                View Booking Details 📜
              </button>
            </div>
          </div>
        `;
        return;
      }

      if (activeReq) {
        const displayStatus = this.getDisplayStatus(activeReq.status);
        if (badge) {
          badge.className = "badge badge-warning";
          badge.innerText = `STATUS: ${displayStatus}`;
        }

        const offersCount = activeReq.offers ? activeReq.offers.length : 0;

        container.innerHTML = `
          <div style="background: var(--bg-hover); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem;">
              <div>
                <span class="badge badge-info" style="font-size: 0.75rem;">${activeReq.request_type.toUpperCase()} REQUEST</span>
                <h4 style="font-size: 1.1rem; font-weight: 800; margin: 0.25rem 0 0.15rem 0;">${activeReq.pickup_address} &rarr; ${activeReq.destination_address}</h4>
                <div style="font-size: 0.85rem; color: var(--text-muted);">
                  Created: ${new Date(activeReq.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Distance: ${activeReq.estimated_distance_km || "—"} km
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">$${activeReq.suggested_price}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Suggested Offer</div>
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); padding: 0.75rem 1rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem;">
              <span style="font-weight: 700; font-size: 0.9rem;">Quotations Received: <strong style="color: var(--primary);">${offersCount} driver quotes</strong></span>
              <button class="btn btn-outline btn-sm" onclick="document.querySelector('[data-tab=active-bids]').click();">
                Review Quotes (${offersCount}) &rarr;
              </button>
            </div>
          </div>
        `;
        return;
      }

      if (badge) {
        badge.className = "badge badge-neutral";
        badge.innerText = "NO ACTIVE REQUEST";
      }

      container.innerHTML = renderEmptyState({
        title: "No active request right now",
        description: "You don't have any ongoing transport requests or active bookings.",
        actionText: "➕ Request a Service",
        actionLink: "#customer",
        icon: "car"
      });

    } catch (err) {
      if (badge) badge.innerText = "NONE";
      container.innerHTML = renderEmptyState({
        title: "No active request",
        description: "Click 'Request a Service' above to publish a new request.",
        icon: "car"
      });
    }
  },

  async loadSavedProviders() {
    const container = document.getElementById("cust-saved-providers-container");
    if (!container) return;

    try {
      const bookings = await BookingService.getUserBookings();
      const completed = (bookings || []).filter(b => b.status === "completed" && b.driver);

      // Unique drivers
      const uniqueMap = new Map();
      completed.forEach(b => {
        if (!uniqueMap.has(b.driver_id)) {
          uniqueMap.set(b.driver_id, {
            id: b.driver_id,
            driver: b.driver,
            vehicle: b.vehicle,
            lastTripDate: b.completed_time || b.created_at
          });
        }
      });

      const providers = Array.from(uniqueMap.values());

      if (providers.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No saved providers yet",
          description: "Drivers who complete trips for you will be saved here for easy re-booking.",
          icon: "user"
        });
        return;
      }

      container.innerHTML = providers.slice(0, 4).map(p => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-bottom: 1px solid var(--border-light);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: var(--radius-full); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: 800;">
              ${p.driver.full_name ? p.driver.full_name.charAt(0) : "D"}
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.9rem;">${p.driver.full_name}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">
                ⭐ ${p.driver.rating_avg ? parseFloat(p.driver.rating_avg).toFixed(1) : "5.0"} (${p.driver.rating_count || 1} trips)
              </div>
            </div>
          </div>
          <span class="badge badge-success" style="font-size: 0.7rem;">Verified</span>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "No saved providers",
        description: "Complete your first trip to save favorite drivers.",
        icon: "user"
      });
    }
  },

  async loadRecentNotifications() {
    const container = document.getElementById("cust-notifications-container");
    if (!container) return;

    try {
      const profile = await AuthService.getCurrentProfile();
      if (!profile) {
        container.innerHTML = renderEmptyState({ title: "No notifications", description: "Sign in to see alerts.", icon: "bell" });
        return;
      }

      const notifications = await NotificationService.getNotifications(profile.id);

      if (!notifications || notifications.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No recent notifications",
          description: "You'll receive alerts when drivers submit offers or update trip status.",
          icon: "bell"
        });
        return;
      }

      container.innerHTML = notifications.slice(0, 4).map(n => `
        <div style="padding: 0.75rem; border-bottom: 1px solid var(--border-light); font-size: 0.85rem;">
          <div style="font-weight: 700; color: var(--text-main);">${n.title}</div>
          <div style="color: var(--text-muted); margin-top: 0.15rem;">${n.body}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
            ${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      `).join("");

    } catch (err) {
      container.innerHTML = renderEmptyState({ title: "No notifications", description: "System notifications will appear here.", icon: "bell" });
    }
  },

  async loadOverviewBookings() {
    const container = document.getElementById("cust-overview-bookings-container");
    if (!container) return;

    try {
      const bookings = await BookingService.getUserBookings();

      if (!bookings || bookings.length === 0) {
        container.innerHTML = `
          <div class="recent-bookings-empty">
            <span class="summary-icon-circle icon-blue">${passengerIcon("bus", 24)}</span>
            <div>
              <strong>No bookings yet</strong>
              <p>Your confirmed trips will appear here.</p>
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = bookings.slice(0, 4).map((booking) => {
        const status = this.getDisplayStatus(booking.status);
        const statusClass = status === "COMPLETED"
          ? "badge-success"
          : status === "CANCELLED"
            ? "badge-neutral"
            : status === "IN_PROGRESS"
              ? "badge-info"
              : "badge-warning";
        const tripDate = booking.created_at
          ? new Date(booking.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "Date pending";
        const pickup = booking.request?.pickup_address || "Pickup";
        const destination = booking.request?.destination_address || "Destination";
        const vehiclePhotos = Array.isArray(booking.vehicle?.photos) ? booking.vehicle.photos : [];
        const firstVehiclePhoto = vehiclePhotos[0];
        const vehiclePhotoUrl = typeof firstVehiclePhoto === "string"
          ? firstVehiclePhoto
          : firstVehiclePhoto?.url || firstVehiclePhoto?.publicUrl || null;
        const thumbnailUrl = vehiclePhotoUrl || booking.driver?.profile_photo_url || null;
        const thumbnailAlt = vehiclePhotoUrl
          ? `${booking.vehicle?.make || "Transport"} ${booking.vehicle?.model || "vehicle"}`
          : booking.driver?.full_name
            ? `${booking.driver.full_name} profile`
            : "Transport booking";

        return `
          <button type="button" class="recent-booking-row recent-booking-open" data-booking-id="${booking.id}">
            <span class="recent-booking-thumb">
              ${thumbnailUrl ? `<img src="${thumbnailUrl}" alt="${thumbnailAlt}">` : passengerIcon("bus", 23)}
            </span>
            <span class="recent-booking-details">
              <strong>${pickup} <span aria-hidden="true">→</span> ${destination}</strong>
              <small>${tripDate}${booking.driver?.full_name ? ` · ${booking.driver.full_name}` : ""}</small>
            </span>
            <span class="badge ${statusClass}">${status.replace("_", " ")}</span>
            <span class="recent-booking-chevron">${passengerIcon("chevron", 21)}</span>
          </button>
        `;
      }).join("");

      container.querySelectorAll(".recent-booking-open").forEach((button) => {
        button.addEventListener("click", () => {
          window.location.hash = `#customer?tab=booking-details&id=${button.getAttribute("data-booking-id")}`;
        });
      });

    } catch (err) {
      container.innerHTML = `
        <div class="recent-bookings-empty">
          <span class="summary-icon-circle icon-blue">${passengerIcon("bus", 24)}</span>
          <div><strong>No bookings found</strong><p>Trip records will be listed here.</p></div>
        </div>
      `;
    }
  },

  async loadActiveBids() {
    const container = document.getElementById("active-requests-board");
    if (!container) return;

    try {
      const requests = await RequestService.getCustomerRequests();
      const openRequests = requests.filter((r) => ["searching", "offers_received", "negotiating"].includes(r.status));

      if (!openRequests || openRequests.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "You don't have any active requests",
          description: "Post a ride or cargo request to receive real-time driver quotations.",
          actionText: "➕ Request a Service",
          actionLink: "#customer",
          icon: "car"
        });
        return;
      }

      container.innerHTML = openRequests.map((req) => `
        <div class="card passenger-quote-request" style="margin-bottom: 1.25rem;">
          <div class="card-header quote-request-header">
            <div>
              <span class="badge ${req.status === "offers_received" ? "badge-success" : "badge-warning"}">
                STATUS: ${this.getDisplayStatus(req.status)}
              </span>
              <span style="font-weight: 700; margin-left: 0.5rem;">${req.request_type.toUpperCase()}</span>
            </div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">
              Suggested: $${req.suggested_price}
            </div>
          </div>

          <div class="quote-route-summary">
            <div><small>Route</small><strong>${req.pickup_address} → ${req.destination_address}</strong></div>
            <div><small>Request ID</small><strong>${req.id.slice(0, 10).toUpperCase()}</strong></div>
          </div>

          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">
            Driver Quotations Received (${req.offers ? req.offers.length : 0})
          </h4>

          ${!req.offers || req.offers.length === 0 ? `
            <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); text-align: center; color: var(--text-muted); font-size: 0.9rem;">
              ⏳ Waiting for nearby verified drivers to submit quotations...
            </div>
          ` : `
            <div class="offers-list">
              ${req.offers.map((offer) => `
                <div class="bid-card quote-driver-row">
                  <div class="bid-driver-info">
                    <div class="driver-avatar">
                      ${offer.driver?.profile_photo_url ? `<img src="${offer.driver.profile_photo_url}" alt="${offer.driver.full_name || "Driver"}">` : (offer.driver?.full_name ? offer.driver.full_name.charAt(0) : "D")}
                    </div>
                    <div>
                      <div style="font-weight: 700;">${offer.driver?.full_name || "Verified Driver"}</div>
                      <div class="quote-driver-meta">
                        ${offer.driver?.rating_avg ? `★ ${Number.parseFloat(offer.driver.rating_avg).toFixed(1)}${offer.driver.rating_count ? ` (${offer.driver.rating_count} trips)` : ""} · ` : ""}Arrives in ~${offer.estimated_arrival_mins} mins
                      </div>
                    </div>
                  </div>

                  <div class="quote-actions">
                    <div class="bid-price" style="font-size: 1.25rem; font-weight: 900; color: var(--primary);">$${offer.counter_price || offer.proposed_price}</div>
                    ${offer.status === "pending" || offer.status === "countered_by_driver" ? `
                      <button class="btn btn-outline btn-sm btn-counter-offer" data-offer-id="${offer.id}" data-current-price="${offer.proposed_price}">
                        Counter
                      </button>
                      <button class="btn btn-primary btn-sm btn-accept-offer" data-offer-id="${offer.id}">
                        Accept
                      </button>
                    ` : `
                      <span class="badge ${offer.status === "accepted" ? "badge-success" : "badge-neutral"}">${offer.status.toUpperCase()}</span>
                    `}
                  </div>
                </div>
              `).join("")}
            </div>
          `}
        </div>
      `).join("");

      // Bind Counter & Accept Offer buttons
      container.querySelectorAll(".btn-accept-offer").forEach((b) => {
        b.addEventListener("click", async (e) => {
          const offerId = e.currentTarget.getAttribute("data-offer-id");
          if (confirm("Accept this driver quotation? (This locks the driver for this request and closes other quotes)")) {
            try {
              await OfferService.acceptOffer(offerId);
              alert("Quotation accepted! Booking created & assigned to provider.");
              this.switchTab("bookings");
            } catch (err) {
              alert("Could not accept offer: " + err.message);
            }
          }
        });
      });

      container.querySelectorAll(".btn-counter-offer").forEach((b) => {
        b.addEventListener("click", (e) => {
          const offerId = e.currentTarget.getAttribute("data-offer-id");
          const currentPrice = e.currentTarget.getAttribute("data-current-price");
          const counterVal = prompt(`Enter counter-offer price for this driver (Current: $${currentPrice}):`);
          if (counterVal && !isNaN(counterVal)) {
            OfferService.counterOfferByCustomer(offerId, parseFloat(counterVal))
              .then(() => {
                alert("Counter-offer sent to driver!");
                this.loadActiveBids();
              })
              .catch((err) => alert(err.message));
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Database Ready",
        description: "Connect your Supabase project to stream driver quotations.",
        icon: "car"
      });
    }
  },

  async loadBookings(filter = "all") {
    const container = document.getElementById("my-bookings-board");
    if (!container) return;

    try {
      const bookings = await BookingService.getUserBookings();
      const filteredBookings = (bookings || []).filter((booking) => {
        if (filter === "all") return true;
        if (filter === "upcoming") return ["confirmed", "driver_arriving"].includes(booking.status);
        if (filter === "in_progress") return booking.status === "in_progress";
        return booking.status === filter;
      });

      if (filteredBookings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: filter === "all" ? "No bookings yet" : `No ${filter.replace("_", " ")} bookings`,
          description: filter === "all"
            ? "When you accept a driver quotation, your confirmed trips will appear here."
            : "Bookings matching this status will appear here.",
          actionText: "➕ Request a Service",
          actionLink: "#customer?tab=search",
          icon: "car"
        });
        return;
      }

      container.innerHTML = `<div class="passenger-list-card">${filteredBookings.map((b) => {
        const displayStatus = this.getDisplayStatus(b.status);
        const statusClass = displayStatus === "COMPLETED" ? "badge-success" : displayStatus === "CANCELLED" ? "badge-neutral" : displayStatus === "IN_PROGRESS" ? "badge-info" : "badge-warning";
        const route = `${b.request?.pickup_address || "Pickup"} → ${b.request?.destination_address || "Destination"}`;
        const tripDate = b.created_at ? new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date pending";
        const photos = Array.isArray(b.vehicle?.photos) ? b.vehicle.photos : [];
        const photo = typeof photos[0] === "string" ? photos[0] : photos[0]?.url || photos[0]?.publicUrl || b.driver?.profile_photo_url;
        return `
          <article class="booking-list-row">
            <span class="booking-list-thumb">${photo ? `<img src="${photo}" alt="${b.vehicle?.make || "Transport vehicle"}">` : passengerIcon("bus", 24)}</span>
            <span class="booking-list-main"><strong>${route}</strong><small>${tripDate}${b.driver?.full_name ? ` · ${b.driver.full_name}` : ""}</small></span>
            <span class="badge ${statusClass}">${displayStatus.replace("_", " ")}</span>
            <span class="booking-list-actions">
              <a class="passenger-text-link" href="#customer?tab=booking-details&id=${b.id}">View Details</a>
              <a class="booking-row-chevron" href="#customer?tab=booking-details&id=${b.id}" aria-label="Open booking">${passengerIcon("chevron", 20)}</a>
            </span>
          </article>`;
      }).join("")}</div>`;

      container.querySelectorAll(".btn-rate-driver").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const bookingId = e.currentTarget.getAttribute("data-booking-id");
          const driverId = e.currentTarget.getAttribute("data-driver-id");
          const rating = prompt("Rate your driver from 1 to 5 stars (1=Poor, 5=Excellent):", "5");
          const comment = prompt("Optional review comment:", "Great and safe ride!");
          if (rating && !isNaN(rating)) {
            BookingService.submitReview({
              bookingId,
              revieweeId: driverId,
              rating: parseInt(rating),
              comment
            }).then(() => alert("Thank you for your rating!")).catch((err) => alert(err.message));
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "No bookings found",
        description: "Your confirmed trips will be displayed here.",
        icon: "car"
      });
    }
  },

  async loadBookingDetails(bookingId) {
    const container = document.getElementById("booking-details-board");
    if (!container) return;

    try {
      let booking = bookingId ? await BookingService.getBookingById(bookingId) : null;
      if (!booking) booking = (await BookingService.getUserBookings())[0] || null;
      if (!booking) {
        container.innerHTML = renderEmptyState({
          title: "No booking selected",
          description: "Choose a booking to view its full trip details.",
          actionText: "View My Bookings",
          actionLink: "#customer?tab=bookings",
          icon: "car"
        });
        return;
      }

      const status = this.getDisplayStatus(booking.status);
      const statusClass = status === "COMPLETED" ? "badge-success" : status === "CANCELLED" ? "badge-neutral" : status === "IN_PROGRESS" ? "badge-info" : "badge-warning";
      const steps = ["confirmed", "driver_arriving", "in_progress", "completed"];
      const currentStep = Math.max(0, steps.indexOf(booking.status));
      const vehicleLabel = booking.vehicle
        ? `${booking.vehicle.make || ""} ${booking.vehicle.model || ""} · ${booking.vehicle.registration_number || "Registration pending"}`
        : "Vehicle details pending";
      const canCancel = ["confirmed", "driver_arriving"].includes(booking.status);

      container.innerHTML = `
        <div class="passenger-page-heading passenger-page-heading--inline">
          <div><h2>Booking Details</h2><p>Booking #${booking.id.slice(0, 12).toUpperCase()}</p></div>
          <span class="badge ${statusClass}">${status.replace("_", " ")}</span>
        </div>
        <div class="booking-detail-layout">
          <section class="card booking-detail-summary">
            <div class="booking-route-block">
              <span>Route</span><strong>${booking.request?.pickup_address || "Pickup"} → ${booking.request?.destination_address || "Destination"}</strong>
              <small>${booking.created_at ? new Date(booking.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Schedule pending"}</small>
            </div>
            <div class="booking-detail-facts">
              <div><span>Passengers</span><strong>${booking.request?.passenger_count || "—"}</strong></div>
              <div><span>Total Price</span><strong>$${Number.parseFloat(booking.final_price || 0).toFixed(2)}</strong></div>
              <div><span>Trip PIN</span><strong>${booking.trip_pin || "Pending"}</strong></div>
            </div>
            <div class="driver-profile-strip">
              <span class="driver-avatar">${booking.driver?.profile_photo_url ? `<img src="${booking.driver.profile_photo_url}" alt="${booking.driver.full_name || "Driver"}">` : (booking.driver?.full_name?.charAt(0) || "D")}</span>
              <span><small>Assigned Driver</small><strong>${booking.driver?.full_name || "Driver assignment pending"}</strong><em>${vehicleLabel}</em></span>
            </div>
            <div class="booking-detail-buttons">
              <a href="#messages?booking=${booking.id}" class="btn btn-primary">Contact Driver</a>
              ${canCancel ? `<button type="button" class="btn btn-outline btn-cancel-passenger-booking" data-booking-id="${booking.id}">Cancel Booking</button>` : ""}
            </div>
          </section>
          <section class="card booking-timeline-card">
            <h3>Trip Progress</h3>
            <div class="booking-timeline">
              ${steps.map((step, index) => `
                <div class="timeline-step ${index <= currentStep ? "complete" : ""} ${index === currentStep ? "current" : ""}">
                  <span class="timeline-dot"></span>
                  <div><strong>${step.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</strong><small>${index <= currentStep ? "Status recorded" : "Pending"}</small></div>
                </div>`).join("")}
            </div>
          </section>
        </div>`;

      container.querySelector(".btn-cancel-passenger-booking")?.addEventListener("click", async (event) => {
        if (!confirm("Cancel this booking?")) return;
        const reason = prompt("Please provide a cancellation reason:", "Cancelled by passenger") || "Cancelled by passenger";
        try {
          await BookingService.updateBookingStatus(event.currentTarget.getAttribute("data-booking-id"), "cancelled", reason);
          await this.loadBookingDetails(booking.id);
        } catch (error) {
          alert("Could not cancel booking: " + error.message);
        }
      });
    } catch (error) {
      container.innerHTML = renderEmptyState({ title: "Booking unavailable", description: "This booking could not be loaded.", icon: "car" });
    }
  },

  async loadPayments() {
    const container = document.getElementById("payments-board");
    if (!container) return;

    try {
      const profile = await AuthService.getCurrentProfile();
      const [transactions, bookings] = await Promise.all([
        profile?.id ? WalletService.getTransactionHistory(profile.id) : [],
        BookingService.getUserBookings()
      ]);
      const completed = (bookings || []).filter((booking) => booking.status === "completed");
      const totalSpent = completed.reduce((total, booking) => total + (Number.parseFloat(booking.final_price) || 0), 0);

      container.innerHTML = `
        <div class="payments-summary-grid">
          <article class="payment-summary-card"><span class="summary-icon-circle icon-blue">${passengerIcon("wallet", 23)}</span><div><small>Total Spent</small><strong>$${totalSpent.toFixed(2)}</strong><em>Completed bookings</em></div></article>
          <article class="payment-summary-card"><span class="summary-icon-circle icon-green">${passengerIcon("check", 23)}</span><div><small>Completed Trips</small><strong>${completed.length}</strong><em>Successfully delivered</em></div></article>
        </div>
        <section class="passenger-list-card payment-history-card">
          <div class="passenger-list-heading"><h3>Transaction History</h3><span>Wallet ledger</span></div>
          ${!transactions?.length ? `<div class="compact-empty-state"><span class="summary-icon-circle icon-blue">${passengerIcon("wallet", 23)}</span><div><strong>No payment records</strong><p>Verified transactions will appear here when recorded.</p></div></div>` : transactions.map((transaction) => `
            <div class="payment-history-row">
              <div><strong>${transaction.description || transaction.category || "Transaction"}</strong><small>${transaction.created_at ? new Date(transaction.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "Date unavailable"}</small></div>
              <strong class="payment-amount ${transaction.transaction_type === "credit" ? "credit" : ""}">${transaction.transaction_type === "credit" ? "+" : "−"}$${Math.abs(Number.parseFloat(transaction.amount || 0)).toFixed(2)}</strong>
              <span class="badge ${transaction.transaction_type === "credit" ? "badge-success" : "badge-info"}">${transaction.transaction_type || "recorded"}</span>
            </div>`).join("")}
        </section>`;
    } catch (error) {
      container.innerHTML = renderEmptyState({ title: "Payments unavailable", description: "Payment records could not be loaded right now.", icon: "inbox" });
    }
  },

  loadFavourites() {
    const container = document.getElementById("favourites-board");
    if (!container) return;
    container.innerHTML = `<section class="passenger-list-card favourites-empty-card">${renderEmptyState({
      title: "No saved drivers yet",
      description: "Saved drivers will appear here when favourites are enabled for your account.",
      icon: "heart"
    })}</section>`;
  },

  async loadNotificationsPage(filter = "all") {
    const container = document.getElementById("notifications-board");
    if (!container) return;

    try {
      const profile = await AuthService.getCurrentProfile();
      const notifications = profile?.id ? await NotificationService.getNotifications(profile.id) : [];
      const filtered = (notifications || []).filter((notification) => filter === "all" || notification.type === filter || notification.type?.includes(filter));
      if (!filtered.length) {
        container.innerHTML = `<section class="passenger-list-card">${renderEmptyState({ title: "No notifications", description: "Updates matching this category will appear here.", icon: "inbox" })}</section>`;
        return;
      }

      container.innerHTML = `<section class="passenger-list-card notification-list">${filtered.map((notification) => `
        <button type="button" class="notification-row ${notification.is_read ? "" : "unread"}" data-notification-id="${notification.id}">
          <span class="notification-icon ${notification.type || "general"}">${passengerIcon(notification.type === "payment" ? "wallet" : notification.type === "booking" ? "calendar" : "bus", 20)}</span>
          <span><strong>${notification.title}</strong><small>${notification.body}</small></span>
          <time>${notification.created_at ? new Date(notification.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}</time>
        </button>`).join("")}</section>`;

      container.querySelectorAll(".notification-row.unread").forEach((row) => {
        row.addEventListener("click", async () => {
          await NotificationService.markAsRead(row.getAttribute("data-notification-id"));
          row.classList.remove("unread");
        });
      });
    } catch (error) {
      container.innerHTML = renderEmptyState({ title: "Notifications unavailable", description: "Updates could not be loaded right now.", icon: "inbox" });
    }
  },

  setSelectionMode(mode) {
    this.selectionMode = mode;
    const banner = document.getElementById("map-selection-banner");
    const mapEl = document.getElementById("customer-map");
    const pBtn = document.getElementById("map-btn-pickup");
    const dBtn = document.getElementById("map-btn-dest");

    pBtn?.classList.toggle("btn-primary", mode === "pickup");
    dBtn?.classList.toggle("btn-primary", mode === "destination");

    if (mode === "pickup") {
      if (banner) banner.innerText = "🟢 Click anywhere on the map to set PICKUP location";
      mapEl?.classList.add("selecting-mode");
    } else if (mode === "destination") {
      if (banner) banner.innerText = "🔴 Click anywhere on the map to set DROP-OFF DESTINATION";
      mapEl?.classList.add("selecting-mode");
    } else {
      if (banner) banner.innerText = "Select pickup or destination using controls or enter address";
      mapEl?.classList.remove("selecting-mode");
    }
  },

  initMap() {
    const mapEl = document.getElementById("customer-map");
    if (!mapEl || !window.L) return;

    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
      this.pickupMarker = null;
      this.destMarker = null;
      this.routePolyline = null;
    }

    const initialCenter = this.pickupCoords ? [this.pickupCoords.lat, this.pickupCoords.lng] : [-17.8252, 31.0335];
    const initialZoom = this.pickupCoords ? 13 : 7;

    this.mapInstance = window.L.map(mapEl).setView(initialCenter, initialZoom);
    this.updateMapTheme();

    this.mapInstance.on("click", async (e) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (this.selectionMode === "pickup") {
        await this.setPickup(lat, lng);
        this.setSelectionMode(null);
      } else if (this.selectionMode === "destination") {
        await this.setDestination(lat, lng);
        this.setSelectionMode(null);
      } else {
        if (!this.pickupCoords) {
          await this.setPickup(lat, lng);
        } else if (!this.destCoords) {
          await this.setDestination(lat, lng);
        } else {
          await this.setDestination(lat, lng);
        }
      }
    });

    if (this.pickupCoords) this.renderPickupMarker();
    if (this.destCoords) this.renderDestMarker();
    if (this.pickupCoords && this.destCoords) {
      this.calculateAndDrawRoute();
    } else {
      this.updateDistanceUI("Enter a destination to calculate your route.");
    }
  },

  updateMapTheme() {
    if (!this.mapInstance || !window.L) return;
    if (this.tileLayer) {
      this.mapInstance.removeLayer(this.tileLayer);
    }
    this.tileLayer = window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
    }).addTo(this.mapInstance);
  },

  async setPickup(lat, lng, addressOverride = null) {
    this.pickupCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    let address = addressOverride;
    if (!address) {
      address = await LocationService.reverseGeocode(lat, lng);
    }
    const input = document.getElementById("req-pickup");
    if (input) input.value = address;

    const clearBtn = document.getElementById("btn-clear-pickup");
    if (clearBtn) clearBtn.style.display = "block";

    this.renderPickupMarker();

    if (this.mapInstance && !this.destCoords) {
      this.mapInstance.setView([lat, lng], 13);
    }

    if (this.pickupCoords && this.destCoords) {
      await this.calculateAndDrawRoute();
    } else {
      this.clearRoute();
      this.updateDistanceUI("Enter a destination to calculate your route.");
    }
    this.validateForm();
  },

  async setDestination(lat, lng, addressOverride = null) {
    this.destCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
    let address = addressOverride;
    if (!address) {
      address = await LocationService.reverseGeocode(lat, lng);
    }
    const input = document.getElementById("req-dest");
    if (input) input.value = address;

    const clearBtn = document.getElementById("btn-clear-dest");
    if (clearBtn) clearBtn.style.display = "block";

    this.renderDestMarker();

    if (this.pickupCoords && this.destCoords) {
      await this.calculateAndDrawRoute();
    } else {
      this.clearRoute();
      this.updateDistanceUI("Select a pickup location to calculate your route.");
    }
    this.validateForm();
  },

  clearPickup() {
    this.pickupCoords = null;
    const input = document.getElementById("req-pickup");
    if (input) input.value = "";
    const clearBtn = document.getElementById("btn-clear-pickup");
    if (clearBtn) clearBtn.style.display = "none";

    if (this.pickupMarker && this.mapInstance) {
      this.mapInstance.removeLayer(this.pickupMarker);
      this.pickupMarker = null;
    }
    this.clearRoute();
    this.validateForm();
  },

  clearDestination() {
    this.destCoords = null;
    const input = document.getElementById("req-dest");
    if (input) input.value = "";
    const clearBtn = document.getElementById("btn-clear-dest");
    if (clearBtn) clearBtn.style.display = "none";

    if (this.destMarker && this.mapInstance) {
      this.mapInstance.removeLayer(this.destMarker);
      this.destMarker = null;
    }
    this.clearRoute();
    this.validateForm();
  },

  clearRoute() {
    if (this.routePolyline && this.mapInstance) {
      this.mapInstance.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
    this.distanceKm = null;
    this.durationMins = null;
    
    if (this.pickupCoords && !this.destCoords) {
      this.updateDistanceUI("Enter a destination to calculate your route.");
    } else if (!this.pickupCoords && this.destCoords) {
      this.updateDistanceUI("Select a pickup location to calculate your route.");
    } else {
      this.updateDistanceUI("—");
    }
  },

  renderPickupMarker() {
    if (!this.mapInstance || !this.pickupCoords) return;

    const greenIcon = window.L.divIcon({
      className: "custom-map-marker-pickup",
      html: `<div style="background-color: #10b981; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 13px;">P</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (this.pickupMarker) {
      this.pickupMarker.setLatLng([this.pickupCoords.lat, this.pickupCoords.lng]);
    } else {
      this.pickupMarker = window.L.marker([this.pickupCoords.lat, this.pickupCoords.lng], {
        icon: greenIcon,
        draggable: true
      })
        .addTo(this.mapInstance)
        .bindPopup("🟢 Pickup Location");

      this.pickupMarker.on("dragend", async (e) => {
        const pos = e.target.getLatLng();
        await this.setPickup(pos.lat, pos.lng);
      });
    }
  },

  renderDestMarker() {
    if (!this.mapInstance || !this.destCoords) return;

    const redIcon = window.L.divIcon({
      className: "custom-map-marker-dest",
      html: `<div style="background-color: #ef4444; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 13px;">D</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    if (this.destMarker) {
      this.destMarker.setLatLng([this.destCoords.lat, this.destCoords.lng]);
    } else {
      this.destMarker = window.L.marker([this.destCoords.lat, this.destCoords.lng], {
        icon: redIcon,
        draggable: true
      })
        .addTo(this.mapInstance)
        .bindPopup("🔴 Drop-off Destination");

      this.destMarker.on("dragend", async (e) => {
        const pos = e.target.getLatLng();
        await this.setDestination(pos.lat, pos.lng);
      });
    }
  },

  async calculateAndDrawRoute() {
    if (!this.pickupCoords || !this.pickupCoords.lat || !this.pickupCoords.lng ||
        !this.destCoords || !this.destCoords.lat || !this.destCoords.lng ||
        !this.mapInstance) {
      this.clearRoute();
      return;
    }

    if (this.routePolyline) {
      this.mapInstance.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${this.pickupCoords.lng},${this.pickupCoords.lat};${this.destCoords.lng},${this.destCoords.lat}?overview=full&geometries=geojson`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = parseFloat((route.distance / 1000).toFixed(2));
          const durMins = Math.ceil(route.duration / 60);

          const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
          this.routePolyline = window.L.polyline(coords, {
            color: "#0284c7",
            weight: 5,
            opacity: 0.85,
            lineJoin: "round"
          }).addTo(this.mapInstance);

          this.mapInstance.fitBounds(this.routePolyline.getBounds(), { padding: [50, 50] });

          this.distanceKm = distKm;
          this.durationMins = durMins;
          this.updateDistanceUI(`${distKm} km (~${durMins} mins)`);
          this.validateForm();
          return;
        }
      }
    } catch (err) {
      console.warn("OSRM routing service fetch notice:", err.message);
    }

    const dist = LocationService.calculateDistance(this.pickupCoords.lat, this.pickupCoords.lng, this.destCoords.lat, this.destCoords.lng);
    const dur = LocationService.estimateDuration(dist);

    if (dist && !isNaN(dist)) {
      this.distanceKm = dist;
      this.durationMins = dur;

      this.routePolyline = window.L.polyline([
        [this.pickupCoords.lat, this.pickupCoords.lng],
        [this.destCoords.lat, this.destCoords.lng]
      ], {
        color: "#059669",
        weight: 4,
        dashArray: "8, 8",
        opacity: 0.8
      }).addTo(this.mapInstance);

      this.mapInstance.fitBounds(this.routePolyline.getBounds(), { padding: [50, 50] });
      this.updateDistanceUI(`${dist} km (~${dur} mins)`);
      this.validateForm();
    } else {
      this.updateDistanceUI("Unable to calculate this route. Please try selecting the locations again.");
      this.distanceKm = null;
      this.durationMins = null;
      this.validateForm();
    }
  },

  calculateAutoPrice(distKm) {
    if (!distKm || isNaN(distKm)) return 0;
    const type = document.getElementById("req-service-type")?.value || "ride";
    const baseFare = 3.0;
    const perKmRate = type === "logistics" ? 2.5 : type === "hire" ? 4.0 : 1.5;
    const calculated = baseFare + (distKm * perKmRate);
    return Math.max(5, Math.round(calculated * 2) / 2);
  },

  updateDistanceUI(text) {
    const input = document.getElementById("req-distance");
    if (input) input.value = text;

    if (this.distanceKm && !isNaN(this.distanceKm)) {
      const autoPrice = this.calculateAutoPrice(this.distanceKm);
      const priceInput = document.getElementById("req-suggested-price");
      if (priceInput && (!priceInput.value || priceInput.dataset.autoCalculated === "true")) {
        priceInput.value = autoPrice;
        priceInput.dataset.autoCalculated = "true";
      }
    }
  },

  validateForm() {
    const priceInput = document.getElementById("req-suggested-price");
    const priceVal = parseFloat(priceInput?.value || 0);
    const pickupVal = document.getElementById("req-pickup")?.value.trim();
    const destVal = document.getElementById("req-dest")?.value.trim();

    const isValid = Boolean(
      this.pickupCoords && this.pickupCoords.lat && this.pickupCoords.lng &&
      this.destCoords && this.destCoords.lat && this.destCoords.lng &&
      this.distanceKm && pickupVal && destVal && priceVal > 0
    );

    const btn = document.getElementById("btn-submit-request");
    if (btn) {
      btn.disabled = !isValid;
    }
  },

  setupAddressAutocomplete(inputId, dropdownId, onSelectCallback) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    let timeout = null;

    input.addEventListener("input", (e) => {
      clearTimeout(timeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        dropdown.style.display = "none";
        dropdown.innerHTML = "";
        return;
      }

      timeout = setTimeout(async () => {
        const results = await LocationService.searchAddress(query);
        if (results.length === 0) {
          dropdown.style.display = "none";
          dropdown.innerHTML = "";
          return;
        }

        dropdown.innerHTML = results.map((item) => `
          <div class="address-suggestion-item" data-lat="${item.lat}" data-lng="${item.lng}" data-address="${item.address.replace(/"/g, '&quot;')}">
            📍 <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem;">${item.address}</span>
          </div>
        `).join("");
        dropdown.style.display = "block";

        dropdown.querySelectorAll(".address-suggestion-item").forEach((el) => {
          el.addEventListener("click", () => {
            const lat = parseFloat(el.getAttribute("data-lat"));
            const lng = parseFloat(el.getAttribute("data-lng"));
            const address = el.getAttribute("data-address");
            onSelectCallback({ lat, lng, address });
            dropdown.style.display = "none";
            dropdown.innerHTML = "";
          });
        });
      }, 350);
    });

    document.addEventListener("click", (evt) => {
      if (!input.contains(evt.target) && !dropdown.contains(evt.target)) {
        dropdown.style.display = "none";
      }
    });
  }
};
