// ==============================================================================
// TRANSMOVE PASSENGER DASHBOARD VIEW
// Supabase-backed requests, bids, and bookings via the trusted API.
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { BidService, BookingService } from "../services/bids.js";
import { LocationService } from "../services/location.js";
import { NotificationService } from "../services/notifications.js";
import { AuthService } from "../services/auth.js";
import { PaymentService } from "../services/payments.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { ReviewService } from "../services/reviews.js";
import { FavouritesService } from "../services/favourites.js";
import { AddressService } from "../services/addresses.js";
import { DisputeService } from "../services/disputes.js";
import { ReceiptService } from "../services/receipts.js";
import { SocialService } from "../services/social.js";
import { SmartPopup } from "../components/SmartPopup.js";
import { AdvertisingService } from "../services/advertising.js";
import { MachineryService } from "../services/machinery.js";
import { icon } from "../components/Icon.js";
import { resolveAvatarUrl } from "../utils/avatar.js";
import { getFilePreviewUrl } from "../config/appwrite.js";

const passengerIcon = (name, size = 20) => {
  const aliases = {
    bus: "bus-front",
    wallet: "wallet-cards",
    users: "users-round",
    calendar: "calendar-days",
    shield: "shield-check",
    pin: "map-pin",
    chevron: "chevron-right",
    chat: "message-circle",
    home: "house",
    briefcase: "briefcase-business",
    building: "building-2"
  };
  return icon(aliases[name] || name || "bus-front", size, { className: "passenger-icon" });
};

const ratingIcons = (rating, size = 16) => {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return `<span class="rating-icons" aria-label="${value} out of 5 stars">${Array.from({ length: 5 }, (_, index) => icon("star", size, { className: index < value ? "is-filled" : "" })).join("")}</span>`;
};

const OPEN_REQUEST_STATUSES = ["open_for_bids", "bids_received", "offers_received", "negotiating"];
const JOURNEY_REQUEST_STATUSES = [...OPEN_REQUEST_STATUSES, "accepted"];
const ACTIVE_BOOKING_STATUSES = ["confirmed", "driver_arriving", "arrived", "in_progress"];

const fileViewUrl = (fileId) => {
  if (!fileId) return "";
  return getFilePreviewUrl(fileId);
};

const profileImageUrl = (profile) => {
  return resolveAvatarUrl(profile);
};

const actionableBidAmount = (bid) => {
  for (const value of [bid?.current_amount, bid?.counter_amount, bid?.amount, bid?.proposed_price]) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return null;
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

const SmartPriceEditor = {
  render(inputId, value) {
    return `<div class="smart-price-editor"><div class="smart-price-stepper"><button type="button" data-price-delta="-1" aria-label="Decrease price">−</button><input id="${escapeHtml(inputId)}" type="number" min="0.01" step="0.50" inputmode="decimal" value="${Number(value || 1).toFixed(2)}" aria-label="Counter offer"><button type="button" data-price-delta="1" aria-label="Increase price">+</button></div><div class="smart-price-quick"><button type="button" data-price-delta="-2">−$2</button><button type="button" data-price-delta="-1">−$1</button><button type="button" data-price-delta="1">+$1</button><button type="button" data-price-delta="2">+$2</button></div></div>`;
  },
  bind(backdrop, inputId, onChange) {
    const input = backdrop.querySelector(`#${inputId}`);
    if (!input) return;
    const apply = (value) => {
      const next = Math.max(0.01, Number(value || 0));
      input.value = next.toFixed(2);
      onChange?.(next);
    };
    backdrop.querySelectorAll("[data-price-delta]").forEach((button) => button.addEventListener("click", () => apply(Number(input.value || 0) + Number(button.dataset.priceDelta || 0))));
    input.addEventListener("change", () => apply(input.value));
  }
};

export const CustomerView = {
  activeTab: "overview", // 'overview' | 'new-request' | 'active-bids' | 'bookings'
  pickupCoords: null,
  destCoords: null,
  distanceKm: null,
  durationMins: null,
  selectionMode: null, // 'pickup' | 'destination' | null
  pendingRequestMeta: null, // { requestDate, passengerCount } carried from the search forms
  
  mapInstance: null,
  tileLayer: null,
  pickupMarker: null,
  destMarker: null,
  routePolyline: null,
  matchingPollInterval: null,
  matchingRequestId: null,
  journeyPollInterval: null,
  journeyRealtimeSubscription: null,
  notificationRealtimeSubscription: null,
  journeyRefreshTimer: null,
  journeySyncBusy: false,
  journeyStateSignature: "",
  journeyBaselineReady: false,
  knownBidStates: new Map(),
  seenQuotationBidIds: new Set(),
  latestBidsByRequest: new Map(),
  smartSheetRestored: false,
  connectionHandlers: null,
  knownBookingStates: new Map(),
  adPopupTimer: null,
  liveLocationWatchId: null,
  activeTripMap: null,
  currentProfile: null,

  async render(currentProfile = null) {
    this.currentProfile = currentProfile;
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
          <div id="promoted-machinery-banner-container"></div>
          <section class="passenger-overview-card" aria-labelledby="passenger-welcome-title">
            <div class="passenger-welcome-row">
              <div>
            <h2 id="passenger-welcome-title" class="passenger-welcome-title">Hello, ${firstName} ${icon("hand", 24)}</h2>
                <p class="passenger-welcome-sub">Where are you going today?</p>
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

          <!-- ACTIVE REQUESTS & DRIVER QUOTATIONS ON OVERVIEW -->
          <section id="cust-overview-active-requests-section" style="display: none; margin-bottom: 1.5rem;" aria-label="Active requests and quotations"></section>

          <div class="passenger-main-grid">
            <section class="passenger-panel passenger-find-panel" aria-labelledby="find-transport-title">
              <div class="passenger-panel-header">
                <h3 id="find-transport-title">Where are you going?</h3>
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
                  <span>Find Transport</span>
                </button>
                <div class="passenger-place-shortcuts" aria-label="Quick destinations">
                  <button type="button" data-quick-place="Home" aria-label="Use Home as destination">
                    <span>${passengerIcon("home", 19)}</span><small>Home</small>
                  </button>
                  <button type="button" data-quick-place="Work" aria-label="Use Work as destination">
                    <span>${passengerIcon("briefcase", 19)}</span><small>Work</small>
                  </button>
                  <button type="button" data-quick-place="Midlands State University" aria-label="Use MSU as destination">
                    <span>${passengerIcon("building", 19)}</span><small>MSU</small>
                  </button>
                  <button type="button" data-customer-tab="bookings" aria-label="Open recent trips">
                    <span>${passengerIcon("clock", 19)}</span><small>Recent</small>
                  </button>
                </div>
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
            <div><h2>Request details</h2><p>Choose the route, timing and fare you want to offer.</p></div>
          </div>
          <div class="grid-2 passenger-request-layout">
            <!-- Left Form Column -->
            <div class="card passenger-form-card">
              <form id="create-request-form">
                <div class="mobile-ride-sheet-heading">
                  <h3>Ride details</h3>
                  <p>Set your trip and choose what you want to pay.</p>
                </div>
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
                  <div id="saved-pickup-chips" style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem;"></div>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="req-pickup" class="form-input" placeholder="Enter pickup location or click map" autocomplete="off" required />
                    <button type="button" id="btn-clear-pickup" class="btn btn-outline btn-sm icon-button" title="Clear pickup" aria-label="Clear pickup" style="display: none;">${icon("x", 17)}</button>
                    <button type="button" id="btn-cust-gps" class="btn btn-outline btn-sm" title="Auto-detect current GPS">
              ${icon("locate-fixed", 17)}<span>GPS</span>
                    </button>
                  </div>
                  <div id="pickup-suggestions" class="address-suggestions-dropdown" style="display: none;"></div>
                </div>

                <!-- Destination Input -->
                <div class="form-group" style="position: relative;">
                  <label class="form-label">Drop-off Destination</label>
                  <div id="saved-dest-chips" style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.4rem;"></div>
                  <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="req-dest" class="form-input" placeholder="Enter drop-off destination or click map" autocomplete="off" required />
                    <button type="button" id="btn-clear-dest" class="btn btn-outline btn-sm icon-button" title="Clear destination" aria-label="Clear destination" style="display: none;">${icon("x", 17)}</button>
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

                <div class="mobile-ride-options" aria-label="Ride options">
                  <div class="mobile-ride-option-row">
                    <span>Passengers</span>
                    <div class="mobile-count-stepper">
                      <button type="button" data-passenger-delta="-1" aria-label="Remove passenger">−</button>
                      <strong id="mobile-passenger-count">1</strong>
                      <button type="button" data-passenger-delta="1" aria-label="Add passenger">+</button>
                    </div>
                  </div>
                  <div class="mobile-ride-option-row">
                    <span>When</span>
                    <div class="mobile-time-toggle" role="group" aria-label="Trip time">
                      <button type="button" class="active" data-trip-time="now">Now</button>
                      <button type="button" data-trip-time="later">Later</button>
                    </div>
                  </div>
                </div>

                <div class="grid-2 request-fare-grid">
                  <div class="form-group">
                    <label class="form-label">Estimated Route Distance</label>
                    <input type="text" id="req-distance" class="form-input" value="Enter a destination to calculate your route." readonly style="font-size: 0.85rem; font-weight: 600; color: var(--primary);" />
                  </div>
                  <div class="form-group request-price-group">
                    <div class="request-price-label-row"><label class="form-label">Your price</label><span>Suggested <strong id="mobile-suggested-price">$10</strong></span></div>
                    <div class="request-price-stepper">
                      <button type="button" data-request-price-delta="-1" aria-label="Decrease price">−</button>
                      <span>$</span><input type="number" id="req-suggested-price" class="form-input" value="10" min="1" step="0.5" required />
                      <button type="button" data-request-price-delta="1" aria-label="Increase price">+</button>
                    </div>
                    <div class="request-price-chips" aria-label="Quick price adjustments">
                      <button type="button" data-request-price-delta="-2">−$2</button>
                      <button type="button" data-request-price-delta="-1">−$1</button>
                      <button type="button" data-request-price-delta="1">+$1</button>
                      <button type="button" data-request-price-delta="2">+$2</button>
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Special Notes for Driver (Optional)</label>
                  <textarea id="req-notes" class="form-textarea" rows="2" placeholder="e.g. Waiting at main gate, 2 small suitcases"></textarea>
                </div>

                <button type="submit" id="btn-submit-request" class="btn btn-primary btn-lg btn-full passenger-submit-button" disabled>
                  Find Drivers
                </button>
              </form>
            </div>

            <!-- Right Map Column -->
            <div class="card passenger-map-card" style="display: flex; flex-direction: column;">
              <div class="card-header" style="flex-wrap: wrap; gap: 0.5rem;">
                <div>
              <h3 class="card-title icon-label">${icon("map", 20)}<span>Interactive Route Map</span></h3>
                  <div id="map-selection-banner" style="font-size: 0.8rem; color: var(--primary); font-weight: 600; margin-top: 0.2rem;">
                    Select pickup or destination using controls or enter address
                  </div>
                </div>
                <!-- Map Action Controls -->
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                <button type="button" id="map-btn-gps" class="btn btn-outline btn-sm" title="Use current GPS location">${icon("locate-fixed", 16)}<span>Use My Location</span></button>
                <button type="button" id="map-btn-pickup" class="btn btn-outline btn-sm">${icon("map-pin", 16)}<span>Select Pickup</span></button>
                <button type="button" id="map-btn-dest" class="btn btn-outline btn-sm">${icon("flag", 16)}<span>Select Destination</span></button>
                  <button type="button" id="map-btn-reset" class="btn btn-outline btn-sm" title="Reset Locations">↻ Reset</button>
                </div>
              </div>

              <div id="customer-map" class="map-container" style="height: 420px; width: 100%; border-radius: var(--radius-md); overflow: hidden; position: relative;"></div>

              <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--text-muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <span class="icon-label icon-label--inline">${icon("map-pin", 15)}<span>Green Marker: Pickup</span></span>
                <span class="icon-label icon-label--inline">${icon("flag", 15)}<span>Red Marker: Destination</span></span>
                <span class="icon-label icon-label--inline">${icon("route", 15)}<span>Solid Line: Route</span></span>
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
            <button class="passenger-filter-btn" type="button" id="btn-mark-all-notifications-read">Mark all read</button>
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
      const travelDate = document.getElementById("dashboard-travel-date")?.value || "";
      const passengerCount = document.getElementById("dashboard-passenger-count")?.value || "";

      this.pendingRequestMeta = {
        requestDate: travelDate ? `${travelDate}T00:00:00.000Z` : null,
        passengerCount: passengerCount ? Number.parseInt(passengerCount, 10) : null
      };

      try {
        sessionStorage.setItem("transmove_pending_request", JSON.stringify({
          pickup,
          dest: destination,
          type: quickService,
          price: "",
          date: travelDate,
          passenger_count: passengerCount
        }));
      } catch (_) {}

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

    document.querySelectorAll("[data-quick-place]").forEach((button) => {
      button.addEventListener("click", () => {
        const destinationInput = document.getElementById("dashboard-destination");
        if (!destinationInput) return;
        destinationInput.value = button.getAttribute("data-quick-place") || "";
        destinationInput.focus();
      });
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

    document.getElementById("btn-mark-all-notifications-read")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      const activeFilter = document.querySelector("[data-notification-filter].active")?.getAttribute("data-notification-filter") || "all";
      button.disabled = true;
      try {
        await NotificationService.markAllAsRead();
        await this.loadNotificationsPage(activeFilter);
      } catch (err) {
        alert("Could not mark notifications as read: " + err.message);
      } finally {
        button.disabled = false;
      }
    });

    // Clear Location Buttons
    document.getElementById("btn-clear-pickup")?.addEventListener("click", () => this.clearPickup());
    document.getElementById("btn-clear-dest")?.addEventListener("click", () => this.clearDestination());

    // Suggested Price Input Validation
    document.getElementById("req-suggested-price")?.addEventListener("input", (e) => {
      delete e.target.dataset.autoCalculated;
      this.validateForm();
    });

    document.querySelectorAll("[data-request-price-delta]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = document.getElementById("req-suggested-price");
        if (!input) return;
        input.value = Math.max(1, Number(input.value || 10) + Number(button.getAttribute("data-request-price-delta") || 0));
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    document.querySelectorAll("[data-passenger-delta]").forEach((button) => {
      button.addEventListener("click", () => {
        const countNode = document.getElementById("mobile-passenger-count");
        const count = Math.min(8, Math.max(1, Number(countNode?.textContent || 1) + Number(button.getAttribute("data-passenger-delta") || 0)));
        if (countNode) countNode.textContent = String(count);
        this.pendingRequestMeta = { ...(this.pendingRequestMeta || {}), passengerCount: count };
      });
    });

    document.querySelectorAll("[data-trip-time]").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-trip-time]").forEach((item) => item.classList.toggle("active", item === button));
        const later = button.getAttribute("data-trip-time") === "later";
        this.pendingRequestMeta = { ...(this.pendingRequestMeta || {}), requestDate: later ? new Date(Date.now() + 86400000).toISOString() : null };
      });
    });

    document.getElementById("req-pickup")?.addEventListener("input", () => this.validateForm());
    document.getElementById("req-dest")?.addEventListener("input", () => this.validateForm());
    document.getElementById("req-pickup")?.addEventListener("change", () => this.validateForm());
    document.getElementById("req-dest")?.addEventListener("change", () => this.validateForm());

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
        if (btn) btn.innerHTML = `${icon("check", 17)}<span>Found</span>`;
      } catch (err) {
        NotificationService.showToast("GPS Notice", err.message, "info");
      if (btn) btn.innerHTML = `${icon("locate-fixed", 17)}<span>GPS</span>`;
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

      // Single-submit guard: completely ignore double-clicks and repeated submissions
      if (this.isPublishingRequest) {
        return;
      }

      const submitBtn = document.getElementById("btn-submit-request");
      const pickupVal = document.getElementById("req-pickup")?.value?.trim();
      const destVal = document.getElementById("req-dest")?.value?.trim();

      if (!pickupVal) {
        NotificationService.showToast("Pickup Location Required", "Please enter a pickup location.", "error");
        return;
      }

      if (!destVal) {
        NotificationService.showToast("Destination Required", "Please enter a destination.", "error");
        return;
      }

      const priceVal = parseFloat(document.getElementById("req-suggested-price")?.value);
      if (!priceVal || priceVal <= 0) {
        NotificationService.showToast("Suggested Price Required", "Please enter your suggested price.", "error");
        return;
      }

      // Immediately disable button and indicate publishing state
      this.isPublishingRequest = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Publishing...";
      }

      try {
        // Section 2: Request creation must NOT depend on optional map calls.
        // Use coordinates already resolved in form state without calling geocoding again.
        if (!this.pickupCoords || !this.pickupCoords.lat || !this.pickupCoords.lng) {
          const cached = LocationService.searchAddressFromCache?.(pickupVal);
          if (cached && cached.length > 0) {
            this.pickupCoords = { lat: cached[0].lat, lng: cached[0].lng };
          } else {
            try {
              const pResults = await LocationService.searchAddress(pickupVal);
              if (pResults && pResults.length > 0) {
                this.pickupCoords = { lat: pResults[0].lat, lng: pResults[0].lng };
              } else {
                this.pickupCoords = { lat: LocationService.DEFAULT_CENTER.lat, lng: LocationService.DEFAULT_CENTER.lng };
              }
            } catch (_) {
              this.pickupCoords = { lat: LocationService.DEFAULT_CENTER.lat, lng: LocationService.DEFAULT_CENTER.lng };
            }
          }
        }

        if (!this.destCoords || !this.destCoords.lat || !this.destCoords.lng) {
          const cached = LocationService.searchAddressFromCache?.(destVal);
          if (cached && cached.length > 0) {
            this.destCoords = { lat: cached[0].lat, lng: cached[0].lng };
          } else {
            try {
              const dResults = await LocationService.searchAddress(destVal);
              if (dResults && dResults.length > 0) {
                this.destCoords = { lat: dResults[0].lat, lng: dResults[0].lng };
              } else {
                this.destCoords = { lat: this.pickupCoords.lat + 0.05, lng: this.pickupCoords.lng + 0.05 };
              }
            } catch (_) {
              this.destCoords = { lat: this.pickupCoords.lat + 0.05, lng: this.pickupCoords.lng + 0.05 };
            }
          }
        }

        // Use resolved distance if available; otherwise calculate Haversine distance without external network calls
        if (!this.distanceKm) {
          const dist = LocationService.calculateDistance(this.pickupCoords.lat, this.pickupCoords.lng, this.destCoords.lat, this.destCoords.lng);
          this.distanceKm = (dist && !isNaN(dist)) ? dist : 5.0;
          this.durationMins = LocationService.estimateDuration(this.distanceKm);
        }

        const serviceType = document.getElementById("req-service-type")?.value || "ride";
        const detailParts = [
          document.getElementById("req-load-desc")?.value?.trim(),
          document.getElementById("req-load-weight")?.value?.trim()
            ? `Estimated weight: ${document.getElementById("req-load-weight").value.trim()} kg`
            : "",
          document.getElementById("req-load-dims")?.value?.trim()
            ? `Dimensions: ${document.getElementById("req-load-dims").value.trim()}`
            : "",
          document.getElementById("req-notes")?.value?.trim()
        ].filter(Boolean);

        // Explicit idempotency submission key preserved across any retries
        const submissionId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const newReq = await RequestService.createRequest({
          submission_id: submissionId,
          service_type: serviceType,
          pickup_location: pickupVal,
          pickup_latitude: this.pickupCoords?.lat || null,
          pickup_longitude: this.pickupCoords?.lng || null,
          destination: destVal,
          destination_latitude: this.destCoords?.lat || null,
          destination_longitude: this.destCoords?.lng || null,
          request_date: this.pendingRequestMeta?.requestDate || null,
          passenger_count: this.pendingRequestMeta?.passengerCount || null,
          goods_type: serviceType === "logistics" ? (document.getElementById("req-load-desc")?.value?.trim() || "") : "",
          details: detailParts.join(" · "),
          budget: priceVal
        });

        this.pendingRequestMeta = null;

        // Button remains disabled while navigation / matching experience loads
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = "Publishing...";
        }

        await this.openRequestMatchingExperience(newReq);
        this.scheduleJourneySync(0);
        this.isPublishingRequest = false;
      } catch (err) {
        console.error("Error publishing request:", err);
        this.isPublishingRequest = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerText = "Post Request";
        }

        // Section 8: Improved user error message using in-app toast instead of browser alert()
        NotificationService.showToast(
          "Unable to publish request",
          "We're having trouble reaching one of our services. Your request has not been duplicated.",
          "error",
          {
            actionLabel: "Try Again",
            duration: 8000,
            onAction: () => {
              const btn = document.getElementById("btn-submit-request");
              if (btn && !btn.disabled) btn.click();
            }
          }
        );
      }
    });

    const hashParams = new URLSearchParams((window.location.hash.split("?")[1] || ""));
    const requestedTab = {
      search: "new-request",
      "new-request": "new-request",
      overview: "overview",
      bookings: "bookings",
      quotes: "active-bids",
      "active-bids": "active-bids",
      "booking-details": "booking-details",
      payments: "payments",
      favourites: "favourites",
      notifications: "notifications"
    }[hashParams.get("tab")];

    let handoff = null;
    try {
      const raw = sessionStorage.getItem("transmove_pending_request");
      if (raw) {
        handoff = JSON.parse(raw);
        sessionStorage.removeItem("transmove_pending_request");
      }
    } catch (_) {
      handoff = null;
    }

    if (handoff && (handoff.pickup || handoff.dest)) {
      this.pendingRequestMeta = {
        requestDate: handoff.date ? `${handoff.date}T00:00:00.000Z` : null,
        passengerCount: handoff.passenger_count ? Number.parseInt(handoff.passenger_count, 10) : null
      };

      const serviceSelect = document.getElementById("req-service-type");
      if (serviceSelect) {
        serviceSelect.value = handoff.type || "ride";
        serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const pickupInput = document.getElementById("req-pickup");
      const destinationInput = document.getElementById("req-dest");
      const priceInput = document.getElementById("req-suggested-price");
      if (pickupInput) pickupInput.value = handoff.pickup || "";
      if (destinationInput) destinationInput.value = handoff.dest || "";
      if (priceInput && handoff.price) priceInput.value = handoff.price;
      this.switchTab("new-request");
      this.validateForm();

      (async () => {
        try {
          if (handoff.pickup) {
            const pRes = await LocationService.searchAddress(handoff.pickup);
            if (pRes && pRes.length > 0) {
              await this.setPickup(pRes[0].lat, pRes[0].lng, handoff.pickup);
            }
          }
          if (handoff.dest) {
            const dRes = await LocationService.searchAddress(handoff.dest);
            if (dRes && dRes.length > 0) {
              await this.setDestination(dRes[0].lat, dRes[0].lng, handoff.dest);
            }
          }
        } catch (_) {}
      })();
      await this.startJourneySync();
      return;
    }

    if (requestedTab) {
      this.switchTab(requestedTab);
    } else {
      await this.loadOverviewData();
    }

    await this.loadPromotedMachineryBanner();
    await this.startJourneySync();
  },

  async loadPromotedMachineryBanner() {
    const container = document.getElementById("promoted-machinery-banner-container");
    if (!container) return;

    try {
      const sponsoredList = await MachineryService.getActiveSponsoredAd();
      if (!Array.isArray(sponsoredList) || sponsoredList.length === 0) {
        container.innerHTML = "";
        return;
      }

      const item = sponsoredList[0];
      const photoUrl = Array.isArray(item.photos) && item.photos.length > 0
        ? (item.photos[0].file_url || item.photos[0].url || item.photos[0])
        : "/assets/images/logo.png";

      const isSaleOnly = item.listing_type === "sale";
      const priceText = isSaleOnly && item.sale_price
        ? `<strong style="color: #ec4899;">Sale: $${Number(item.sale_price).toLocaleString()} USD</strong>`
        : `<strong style="color: #10b981;">From $${Number(item.daily_rate || item.base_hire_rate || item.hourly_rate || 0).toFixed(2)}/${item.hourly_rate ? "hr" : "day"}</strong>`;

      container.innerHTML = `
        <div class="sponsored-machinery-bar card" id="sponsored-machinery-card-${escapeHtml(item.id)}" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 0.85rem 1.15rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.85rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);">
          <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 260px;">
            <div style="width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: #0f172a; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png'; this.style.objectFit='contain';" />
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <span class="badge" style="background: #10b981; color: #fff; font-weight: 800; font-size: 0.65rem; letter-spacing: 0.5px; padding: 0.15rem 0.45rem; border-radius: 3px;">SPONSORED MACHINERY</span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.category)}</span>
              </div>
              <div style="font-weight: 800; font-size: 1rem; color: var(--text-main); line-height: 1.2;">
                ${escapeHtml(item.name)} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 400;">(${escapeHtml(item.brand)} ${escapeHtml(item.model)})</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">
                Available in <strong>${escapeHtml(item.location || item.province || "Zimbabwe")}</strong> • ${priceText}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <a href="#machinery" class="btn btn-outline btn-sm" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; font-weight: 600;">View</a>
            ${isSaleOnly ? `
              <a href="#machinery?id=${escapeHtml(item.id)}" class="btn btn-sm" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; font-weight: 700; background: #8b5cf6; color: #fff;">Enquire</a>
            ` : `
              <a href="#machinery?hire=${escapeHtml(item.id)}" class="btn btn-primary btn-sm" style="font-size: 0.8rem; padding: 0.35rem 0.85rem; font-weight: 700;">Hire</a>
            `}
            <button type="button" class="btn btn-outline btn-sm btn-dismiss-promoted-ad" data-ad-id="${escapeHtml(item.advertisement_id)}" data-card-id="sponsored-machinery-card-${escapeHtml(item.id)}" style="font-size: 0.8rem; padding: 0.35rem 0.55rem; color: var(--text-muted);" title="Dismiss this ad">Dismiss</button>
          </div>
        </div>
      `;

      container.querySelector(".btn-dismiss-promoted-ad")?.addEventListener("click", async (e) => {
        const adId = e.currentTarget.getAttribute("data-ad-id");
        const cardId = e.currentTarget.getAttribute("data-card-id");
        const card = document.getElementById(cardId);
        if (card) {
          card.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          card.style.opacity = "0";
          card.style.transform = "translateY(-10px)";
          setTimeout(() => card.remove(), 300);
        }
        if (adId) {
          await MachineryService.dismissSponsoredAd(adId).catch(() => {});
        }
      });
    } catch (err) {
      console.warn("Could not load promoted machinery banner:", err);
      container.innerHTML = "";
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
      this.loadPromotedMachineryBanner();
    } else if (tab === "new-request") {
      setTimeout(() => {
        this.initMap();
        this.loadSavedAddressChips();
      }, 150);
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

  scheduleJourneySync(delay = 120) {
    if (this.journeyRefreshTimer) clearTimeout(this.journeyRefreshTimer);
    this.journeyRefreshTimer = setTimeout(() => {
      this.journeyRefreshTimer = null;
      this.syncPassengerJourneyState().catch((error) => {
        console.warn("Passenger journey refresh notice:", error.message);
      });
    }, delay);
  },

  async startJourneySync() {
    this.stopJourneySync();
    const userId = this.currentProfile?.user_id || this.currentProfile?.id;

    this.journeyRealtimeSubscription = BidService.subscribeToJourneyUpdates(() => {
      this.scheduleJourneySync();
    });

    if (userId) {
      this.notificationRealtimeSubscription = NotificationService.subscribeToNotifications(userId, (notification) => {
        const popupTypes = new Set(["bid_received", "bid_accepted", "booking_confirmed", "driver_en_route", "driver_arrived", "journey_started", "journey_completed", "counter_offer", "counter_accepted", "trip_payment_confirmed"]);
        if (!popupTypes.has(notification.type)) {
          NotificationService.showToast(
            notification.title || "TransMove update",
            notification.body || notification.message || "Your journey has been updated.",
            "info"
          );
        }
        this.scheduleJourneySync();
      });
    }

    const state = await this.syncPassengerJourneyState({ force: true });
    this.setupConnectionAwareness();
    this.restorePassengerSmartSheetState(state);
    this.scheduleDashboardAd();
  },

  stopJourneySync() {
    if (this.journeyPollInterval) clearInterval(this.journeyPollInterval);
    if (this.journeyRefreshTimer) clearTimeout(this.journeyRefreshTimer);
    this.journeyPollInterval = null;
    this.journeyRefreshTimer = null;
    this.journeySyncBusy = false;

    this.journeyRealtimeSubscription?.unsubscribe?.();
    this.notificationRealtimeSubscription?.unsubscribe?.();
    this.journeyRealtimeSubscription = null;
    this.notificationRealtimeSubscription = null;
  },

  destroy() {
    this.stopJourneySync();
    if (this.matchingPollInterval) clearInterval(this.matchingPollInterval);
    this.matchingPollInterval = null;
    this.matchingRequestId = null;
    document.getElementById("matching-experience-modal")?.remove();
    if (this.adPopupTimer) clearTimeout(this.adPopupTimer);
    this.adPopupTimer = null;
    this.journeyBaselineReady = false;
    this.knownBidStates = new Map();
    this.knownBookingStates = new Map();
    if (this.connectionHandlers) {
      window.removeEventListener("offline", this.connectionHandlers.offline);
      window.removeEventListener("online", this.connectionHandlers.online);
      this.connectionHandlers = null;
    }
    this.smartSheetRestored = false;
    if (this.activeTripMap) {
      try { this.activeTripMap.remove(); } catch (_) {}
      this.activeTripMap = null;
    }
    if (!(window.location.hash || "").startsWith("#customer")) SmartPopup.clear();
  },

  async syncPassengerJourneyState({ force = false } = {}) {
    if (this.journeySyncBusy || !document.querySelector(".customer-dashboard")) return null;
    this.journeySyncBusy = true;

    try {
      const userId = this.currentProfile?.user_id || this.currentProfile?.id;
      const [requests, bookings, notifications] = await Promise.all([
        RequestService.getCustomerRequests(),
        BookingService.getPassengerBookings(),
        userId ? NotificationService.getNotifications(userId) : []
      ]);

      const relevantRequests = (requests || []).filter((request) =>
        JOURNEY_REQUEST_STATUSES.includes(request.status)
      );
      const bidsByRequest = new Map();
      await Promise.all(relevantRequests.map(async (request) => {
        const reqId = request.$id || request.id;
        try {
          const result = await BidService.getBidsForRequest(reqId);
          bidsByRequest.set(reqId, Array.isArray(result) ? result : (result?.bids || []));
        } catch (_) {
          bidsByRequest.set(reqId, []);
        }
      }));

      const activeBookings = (bookings || [])
        .filter((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status))
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
      const activeBooking = activeBookings[0] || null;
      const allBids = [...bidsByRequest.values()].flat();
      this.latestBidsByRequest = bidsByRequest;
      const newBids = this.journeyBaselineReady
        ? allBids.filter((bid) => !this.knownBidStates.has(bid.id || bid.$id) && bid.status === "pending")
        : [];
      const driverCounters = this.journeyBaselineReady
        ? allBids.filter((bid) => {
            const id = bid.id || bid.$id;
            return bid.negotiation_status === "countered_by_driver" && this.knownBidStates.get(id)?.negotiation !== bid.negotiation_status;
          })
        : [];
      const acceptedCounters = this.journeyBaselineReady
        ? allBids.filter((bid) => {
            const previous = this.knownBidStates.get(bid.id || bid.$id);
            return bid.negotiation_status === "accepted" && previous?.negotiation === "countered_by_passenger";
          })
        : [];
      const newConfirmedBookings = this.journeyBaselineReady
        ? (bookings || []).filter((booking) => booking.status === "confirmed" && this.knownBookingStates.get(booking.id || booking.$id)?.status !== "confirmed")
        : [];
      const bookingTransitions = this.journeyBaselineReady
        ? (bookings || []).filter((booking) => {
            const previous = this.knownBookingStates.get(booking.id || booking.$id);
            return previous && previous.status !== booking.status;
          })
        : [];
      const paymentConfirmations = this.journeyBaselineReady
        ? (bookings || []).filter((booking) => {
            const previous = this.knownBookingStates.get(booking.id || booking.$id);
            return booking.payment_status === "received" && previous?.paymentStatus !== "received";
          })
        : [];
      const signature = JSON.stringify({
        requests: relevantRequests.map((request) => [request.$id || request.id, request.status, request.updated_at]),
        bids: relevantRequests.map((request) => {
          const reqId = request.$id || request.id;
          const requestBids = bidsByRequest.get(reqId) || [];
          return [reqId, ...requestBids.map((bid) => [bid.id || bid.$id, bid.status, bid.negotiation_status, bid.counter_amount, bid.updated_at])];
        }),
        bookings: (bookings || []).map((booking) => [booking.id || booking.$id, booking.request_id, booking.status, booking.payment_status, booking.updated_at]),
        notifications: (notifications || []).slice(0, 10).map((notification) => [notification.id || notification.$id, notification.is_read ?? notification.read])
      });
      const changed = force || signature !== this.journeyStateSignature;
      this.journeyStateSignature = signature;

      const shouldPoll = relevantRequests.some((request) => JOURNEY_REQUEST_STATUSES.includes(request.status))
        || Boolean(activeBooking);
      if (shouldPoll && !this.journeyPollInterval) {
        this.journeyPollInterval = setInterval(() => {
          this.syncPassengerJourneyState().catch(() => {});
        }, 6000);
      } else if (!shouldPoll && this.journeyPollInterval) {
        clearInterval(this.journeyPollInterval);
        this.journeyPollInterval = null;
      }

      if (!changed) return { requests, bookings, bidsByRequest, notifications, activeBooking };

      this.seedPassengerJourneyBaseline(allBids, bookings || []);
      newBids.forEach((bid) => this.showQuotationPopup(bid));
      driverCounters.forEach((bid) => this.showQuotationPopup(bid, true));
      acceptedCounters.forEach((bid) => this.showQuotationPopup(bid, true));
      newConfirmedBookings.forEach((booking) => this.showDriverConfirmedPopup(booking));
      bookingTransitions.forEach((booking) => this.showPassengerJourneyPopup(booking));
      paymentConfirmations.forEach((booking) => this.showPassengerPaymentPopup(booking));

      const matchingModal = document.getElementById("matching-experience-modal");
      if (activeBooking && matchingModal?.style.display !== "none") {
        matchingModal.style.display = "none";
        if (this.matchingPollInterval) clearInterval(this.matchingPollInterval);
        this.matchingPollInterval = null;
        window.location.hash = `#customer?tab=booking-details&id=${activeBooking.id || activeBooking.$id}`;
        return { requests, bookings, bidsByRequest, notifications, activeBooking };
      }

      if (matchingModal?.style.display !== "none" && this.matchingRequestId) {
        const matchingBids = bidsByRequest.get(this.matchingRequestId) || [];
        const pendingBids = matchingBids.filter((bid) => bid.status === "pending");
        const acceptedBid = matchingBids.find((bid) => bid.status === "accepted");
        const banner = document.getElementById("matching-quotes-banner");
        const viewButton = document.getElementById("btn-matching-view-quotes");
        const countSpan = document.getElementById("matching-quote-count");
        if (acceptedBid && banner) {
          banner.style.background = "#ecfdf5";
          banner.style.borderColor = "#a7f3d0";
          banner.style.color = "#065f46";
          banner.textContent = "Quotation accepted. Preparing your active booking…";
        } else if (pendingBids.length > 0) {
          if (banner) {
            banner.style.background = "#ecfdf5";
            banner.style.borderColor = "#a7f3d0";
            banner.style.color = "#065f46";
          banner.innerHTML = `${icon("party-popper", 18)} <strong>${pendingBids.length} Quotation${pendingBids.length === 1 ? "" : "s"} Received!</strong> Drivers are ready for your review.`;
          }
          if (viewButton && countSpan) {
            countSpan.textContent = String(pendingBids.length);
            viewButton.style.display = "block";
          }
        }
      }

      if (this.activeTab === "active-bids") {
        if (activeBooking) {
          window.location.hash = `#customer?tab=booking-details&id=${activeBooking.id || activeBooking.$id}`;
        } else {
          await this.loadActiveBids();
        }
      } else if (this.activeTab === "booking-details") {
        const params = new URLSearchParams((window.location.hash.split("?")[1] || ""));
        await this.loadBookingDetails(params.get("id") || activeBooking?.id || activeBooking?.$id);
      } else if (this.activeTab === "bookings") {
        await this.loadBookings();
      } else if (this.activeTab === "notifications") {
        await this.loadNotificationsPage();
      } else if (this.activeTab === "overview") {
        await this.loadOverviewData();
      }

      return { requests, bookings, bidsByRequest, notifications, activeBooking };
    } finally {
      this.journeySyncBusy = false;
    }
  },

  getPopupUserId() {
    return this.currentProfile?.user_id || this.currentProfile?.id || "passenger";
  },

  setupConnectionAwareness() {
    if (this.connectionHandlers) return;
    const offline = () => SmartPopup.setConnectionStatus(true);
    const online = async () => {
      SmartPopup.setConnectionStatus(false);
      const state = await this.syncPassengerJourneyState({ force: true }).catch(() => null);
      this.restorePassengerSmartSheetState(state, { force: true });
    };
    this.connectionHandlers = { offline, online };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    if (navigator.onLine === false) offline();
  },

  passengerDraftKey() {
    return `transmove_passenger_sheet_draft:${this.getPopupUserId()}`;
  },

  readPassengerDraft() {
    try { return JSON.parse(sessionStorage.getItem(this.passengerDraftKey()) || "null"); } catch (_) { return null; }
  },

  savePassengerDraft(bidId, backdrop) {
    try {
      sessionStorage.setItem(this.passengerDraftKey(), JSON.stringify({
        bidId,
        amount: backdrop.querySelector("#counter-amount-input")?.value || "",
        message: backdrop.querySelector("#counter-note-input")?.value || ""
      }));
    } catch (_) {}
  },

  clearPassengerDraft() {
    try { sessionStorage.removeItem(this.passengerDraftKey()); } catch (_) {}
  },

  restorePassengerSmartSheetState(state, { force = false } = {}) {
    if (!state || (this.smartSheetRestored && !force)) return;
    this.smartSheetRestored = true;
    if (state.activeBooking) {
      if (["driver_arriving", "arrived", "in_progress"].includes(state.activeBooking.status)) this.showPassengerJourneyPopup(state.activeBooking, { force: true });
      else this.showDriverConfirmedPopup(state.activeBooking, { force: true });
      setTimeout(() => SmartPopup.current && SmartPopup.minimize(), 60);
      return;
    }
    const bids = [...(state.bidsByRequest?.values?.() || [])].flat().filter((bid) => bid.status === "pending");
    if (!bids.length) return;
    const decisionBid = bids.find((bid) => bid.negotiation_status === "countered_by_driver");
    const selected = decisionBid || bids[0];
    this.showQuotationPopup(selected, Boolean(decisionBid), { force: true });
    bids.forEach((bid) => this.seenQuotationBidIds.add(bid.id || bid.$id));
    if (!decisionBid) setTimeout(() => SmartPopup.current && SmartPopup.minimize(), 60);
  },

  seedPassengerJourneyBaseline(bids, bookings) {
    this.knownBidStates = new Map((bids || []).map((bid) => [bid.id || bid.$id, {
      status: bid.status,
      negotiation: bid.negotiation_status,
      counterAmount: bid.counter_amount
    }]));
    this.knownBookingStates = new Map((bookings || []).map((booking) => [booking.id || booking.$id, {
      status: booking.status,
      paymentStatus: booking.payment_status
    }]));
    this.journeyBaselineReady = true;
  },

  showQuotationPopup(bid, isCounter = false, { force = false } = {}) {
    const id = bid.id || bid.$id;
    if (!id) return;
    if (!isCounter && !force) {
      if (this.seenQuotationBidIds.has(id)) return;
      this.seenQuotationBidIds.add(id);
    }
    const requestId = bid.request_id || bid.request?.id || bid.request?.$id || id;
    const requestBids = this.latestBidsByRequest.get(requestId) || [bid];
    const visibleBids = requestBids.filter((item) => !item.status || item.status === "pending" || item.status === "accepted");
    const count = visibleBids.length || 1;
    const options = {
      userId: this.getPopupUserId(),
      eventKey: force ? undefined : `${isCounter ? "driver-counter" : "new-quotation"}:${id}:${bid.updated_at || bid.created_at || bid.amount}`,
      flowKey: `passenger-request:${requestId}`,
      state: isCounter ? "updated_offer" : "offers",
      eyebrow: isCounter ? "Fare negotiation" : "Driver response",
      title: `${count} driver${count === 1 ? "" : "s"} responded`,
      minimizable: true,
      pillText: `${count} offer${count === 1 ? "" : "s"} • Tap to review`,
      html: `${this.renderSmartOfferList(visibleBids.length ? visibleBids : [bid])}`,
      actions: visibleBids.length > 1 ? [{ label: "View all offers", primary: true, onClick: () => { window.location.hash = "#customer?tab=quotes"; } }] : [],
      onRender: ({ backdrop }) => this.bindSmartOfferActions(backdrop, visibleBids.length ? visibleBids : [bid])
    };
    return SmartPopup.current?.flowKey === options.flowKey ? SmartPopup.update(options) : SmartPopup.open(options);
  },

  renderSmartOfferList(bids) {
    return `<div class="smart-offer-list">${(bids || []).map((bid) => {
      const bidId = bid.id || bid.$id;
      const name = bid.driver?.full_name || "Driver details unavailable";
      const avatar = profileImageUrl(bid.driver);
      const rating = Number(bid.driver?.rating || bid.driver?.rating_avg || 0);
      const vehicle = [bid.vehicle?.make, bid.vehicle?.model].filter(Boolean).join(" ");
      const registration = bid.vehicle?.registration_number || bid.vehicle?.plate_number || "";
      const trips = Number(bid.driver?.completed_trips || bid.driver?.trip_count || 0);
      const verified = bid.driver?.verification_status === "approved" || bid.driver?.is_verified === true;
      const eta = bid.estimated_arrival_minutes || bid.estimated_arrival_mins || bid.arrival_minutes;
      const amount = actionableBidAmount(bid);
      const isPositiveAmount = amount !== null;
      const amountFormatted = isPositiveAmount ? (Number.isInteger(amount) ? String(amount) : amount.toFixed(2)) : null;

      return `
        <article class="smart-sheet-driver-card" data-bid-id="${escapeHtml(bidId)}">
          <div class="smart-popup-profile">
            <div class="smart-popup-avatar">
              ${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">` : escapeHtml(name.charAt(0))}
            </div>
            <div>
              <strong style="font-size: 1.05rem; display: block; color: var(--text-main);">${escapeHtml(name)} ${verified ? `<span class="smart-driver-verified" title="Verified driver">${icon("badge-check", 16)}</span>` : ""}</strong>
              ${rating > 0 ? `<span class="icon-label icon-label--inline" style="color: #f59e0b; font-weight: 700; font-size: 0.85rem;">${icon("star", 15, { className: "is-filled" })}<span>${rating.toFixed(1)}${bid.driver?.review_count ? ` (${Number(bid.driver.review_count)})` : ""}</span></span>` : ""}
              ${trips ? `<span class="smart-driver-trips">${trips} trips</span>` : ""}
              ${vehicle ? `<span style="color: var(--text-muted); font-size: 0.85rem; display: block;">${escapeHtml(vehicle)}${registration ? ` • ${escapeHtml(registration)}` : ""}</span>` : ""}
            </div>
          </div>

          <div class="smart-sheet-offer-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--bg-subtle); padding: 0.75rem 1rem; border-radius: 10px; margin: 0.85rem 0;">
            <div>
              <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Offer</div>
              ${isPositiveAmount
                ? `<div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.15rem;">$${amountFormatted}</div>`
                : `<div style="font-size: 1.15rem; font-weight: 800; color: #dc2626; margin-top: 0.15rem;">Offer unavailable</div>`
              }
            </div>
            ${eta ? `
              <div>
                <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Arrival</div>
                <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin-top: 0.2rem;">${escapeHtml(eta)} min</div>
              </div>
            ` : ""}
          </div>

          ${bid.message ? `<p style="font-size: 0.85rem; font-style: italic; color: var(--text-muted); margin: 0.4rem 0;">“${escapeHtml(bid.message)}”</p>` : ""}

          <div style="display: flex; gap: 0.5rem; margin-top: 0.85rem;">
            <button type="button" class="btn btn-outline smart-view-driver" style="flex: 1; padding: 0.65rem 0.45rem; font-weight: 700; border-radius: 8px;">View profile</button>
            <button type="button" class="btn btn-outline smart-counter-offer" style="flex: 1; padding: 0.65rem 1rem; font-weight: 700; border-radius: 8px;" ${!isPositiveAmount ? "disabled" : ""}>Counter</button>
            ${isPositiveAmount
              ? `<button type="button" class="btn btn-primary smart-accept-offer" style="flex: 1.3; padding: 0.65rem 1rem; font-weight: 800; border-radius: 8px;">Accept $${amountFormatted}</button>`
              : `<button type="button" class="btn btn-primary smart-accept-offer" style="flex: 1.3; padding: 0.65rem 1rem; font-weight: 800; border-radius: 8px; opacity: 0.6; cursor: not-allowed;" disabled>Offer unavailable</button>`
            }
          </div>
        </article>
      `;
    }).join("")}</div>`;
  },

  bindSmartOfferActions(backdrop, bids) {
    const bidMap = new Map((bids || []).map((bid) => [bid.id || bid.$id, bid]));
    backdrop.querySelectorAll(".smart-sheet-driver-card, .smart-offer-card").forEach((card) => {
      const bid = bidMap.get(card.dataset.bidId);
      if (!bid) return;
      card.querySelector(".smart-counter-offer")?.addEventListener("click", () => {
        this.openPassengerCounterModal(card.dataset.bidId, actionableBidAmount(bid), bid);
      });
      card.querySelector(".smart-view-driver")?.addEventListener("click", () => {
        this.showDriverProfilePeek(bid);
      });
      card.querySelector(".smart-accept-offer")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const currentAmount = actionableBidAmount(bid);
        if (currentAmount === null) {
          const errorBox = backdrop.querySelector(".smart-popup-error");
          if (errorBox) { errorBox.textContent = "Cannot accept an invalid or $0 offer."; errorBox.hidden = false; }
          return;
        }
        button.disabled = true;
        button.textContent = "Accepting…";
        try {
          if (bid.negotiation_status === "countered_by_driver") await BidService.acceptCounterOffer(card.dataset.bidId);
          const result = await BidService.acceptBid(card.dataset.bidId);
          const bookingId = result.bookingId || result.booking?.id || result.booking?.$id;
          const confirmed = result.booking || (await BookingService.getPassengerBookings()).find((item) => (item.id || item.$id) === bookingId);
          if (confirmed) this.showDriverConfirmedPopup(confirmed, { force: true });
        } catch (error) {
          const errorBox = backdrop.querySelector(".smart-popup-error");
          if (errorBox) { errorBox.textContent = error.message; errorBox.hidden = false; }
          button.disabled = false;
          const fmt = Number.isInteger(currentAmount) ? String(currentAmount) : currentAmount.toFixed(2);
          button.textContent = `Accept $${fmt}`;
        }
      });
    });
  },

  showDriverProfilePeek(bid) {
    const name = bid.driver?.full_name || "Driver details unavailable";
    const avatar = profileImageUrl(bid.driver);
    const rating = Number(bid.driver?.rating || bid.driver?.rating_avg || 0);
    const vehicle = [bid.vehicle?.make, bid.vehicle?.model, bid.vehicle?.year].filter(Boolean).join(" ");
    const registration = bid.vehicle?.registration_number || bid.vehicle?.plate_number || "";
    const trips = Number(bid.driver?.completed_trips || bid.driver?.trip_count || 0);
    const isVerified = bid.driver?.verification_status === "approved" || bid.driver?.is_verified === true;
    SmartPopup.update({
      state: "driver_profile",
      eyebrow: "Driver profile",
      title: name,
      html: `
        <div class="smart-profile-peek">
          <div class="smart-popup-profile">
            <div class="smart-popup-avatar">
              ${avatar ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}">` : escapeHtml(name.charAt(0))}
            </div>
            <div>
              <strong style="font-size: 1.05rem; display: block; color: var(--text-main);">${escapeHtml(name)}</strong>
              ${rating > 0 ? `<span class="icon-label icon-label--inline" style="color: #f59e0b; font-weight: 700; font-size: 0.85rem;">${icon("star", 15, { className: "is-filled" })}<span>${rating.toFixed(1)}${bid.driver?.review_count ? ` • ${Number(bid.driver.review_count)} reviews` : ""}</span></span>` : ""}
              ${trips > 0 ? `<span class="smart-driver-trips">${trips} completed trips</span>` : ""}
            </div>
          </div>
          ${isVerified ? `<span class="smart-profile-verified icon-label" style="margin-top: 0.5rem;">${icon("badge-check", 16)}<span>Verified driver</span></span>` : ""}
          <div class="smart-popup-detail-grid" style="margin-top: 0.75rem;">
            ${vehicle ? `<span>Vehicle</span><strong>${escapeHtml(vehicle)}</strong>` : "<span>Vehicle</span><span style='color: var(--text-muted);'>Not specified</span>"}
            ${registration ? `<span>Registration</span><strong>${escapeHtml(registration)}</strong>` : ""}
            ${bid.vehicle?.vehicle_type ? `<span>Type</span><strong>${escapeHtml(bid.vehicle.vehicle_type)}</strong>` : ""}
          </div>
        </div>
      `,
      actions: [{ label: "Back to offers", primary: true, close: false, onClick: () => { this.showQuotationPopup(bid, bid.negotiation_status === "countered_by_driver", { force: true }); return false; } }]
    });
  },

  showDriverConfirmedPopup(booking, { force = false } = {}) {
    if (!booking) return;
    const id = booking.id || booking.$id;
    const driverName = booking.driver?.full_name?.trim() || "Assigned Driver";
    const vehicleParts = [booking.vehicle?.make, booking.vehicle?.model].filter(Boolean);
    const vehicleName = vehicleParts.length > 0 ? vehicleParts.join(" ") : (booking.vehicle ? "Verified Vehicle" : "Vehicle Assigned");
    const regNumber = booking.vehicle?.registration_number?.trim() || "";
    const avatarUrl = profileImageUrl(booking.driver);
    const requestId = booking.request_id || booking.request?.id || booking.request?.$id || id;
    const rawFare = booking.amount !== undefined && booking.amount !== null ? booking.amount : (booking.final_price || 0);
    const amount = Number(rawFare);
    const amountFormatted = Number.isFinite(amount) && amount > 0
      ? (Number.isInteger(amount) ? String(amount) : amount.toFixed(2))
      : "--";

    const options = {
      userId: this.getPopupUserId(),
      eventKey: force ? undefined : `driver-confirmed:${id}`,
      flowKey: `passenger-request:${requestId}`,
      state: "driver_confirmed",
      eyebrow: "Booking confirmed",
      title: "Driver confirmed",
      minimizable: true,
      pillText: `${driverName} • Confirmed`,
      html: `
        <div class="smart-sheet-status-box" style="text-align: left;">
          <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.75rem;">
            <div class="smart-sheet-success-badge" style="margin: 0; width: 32px; height: 32px; font-size: 1.1rem;">${icon("check", 18)}</div>
            <h3 class="smart-sheet-status-heading icon-label" style="margin: 0; font-size: 1.25rem;">${icon("circle-check", 20)}<span>Driver confirmed</span></h3>
          </div>

          <div class="smart-sheet-driver-card" style="margin: 0.75rem 0;">
            <div class="smart-popup-profile">
              <div class="smart-popup-avatar">
                ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(driverName)}">` : escapeHtml(driverName.charAt(0))}
              </div>
              <div>
                <strong style="font-size: 1.05rem; display: block; color: var(--text-main);">${escapeHtml(driverName)}</strong>
                <span style="color: var(--text-muted); font-size: 0.88rem; display: block;">${escapeHtml(vehicleName)}</span>
                ${regNumber ? `<span style="color: var(--text-muted); font-size: 0.82rem; font-weight: 700;">${escapeHtml(regNumber)}</span>` : ""}
              </div>
            </div>
          </div>

          <div class="smart-sheet-status-price-card" style="margin: 0.75rem 0;">
            <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 700;">Agreed fare</div>
            <div style="font-size: 2.2rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">${amountFormatted !== "--" ? `$${amountFormatted}` : "--"}</div>
          </div>
        </div>
      `,
      actions: [
        { label: "Message", onClick: () => { window.location.hash = `#messages?booking=${id}`; } },
        { label: "View journey", primary: true, onClick: () => { window.location.hash = `#customer?tab=booking-details&id=${id}`; } }
      ]
    };
    return SmartPopup.current ? SmartPopup.update(options) : SmartPopup.open(options);
  },

  showPassengerJourneyPopup(booking, { force = false } = {}) {
    const id = booking.id || booking.$id;
    const driverName = escapeHtml(booking.driver?.full_name || "Your driver");
    const flowKey = `passenger-request:${booking.request_id || id}`;
    const routeAction = { label: "View trip", primary: true, onClick: () => { window.location.hash = `#customer?tab=booking-details&id=${id}`; } };
    const liveOptions = { userId: this.getPopupUserId(), flowKey, minimizable: true, state: "active_trip" };
    if (booking.status === "driver_arriving") {
      SmartPopup.open({ ...liveOptions, eventKey: force ? undefined : `driver-en-route:${id}`, eyebrow: "Your driver", title: "YOUR DRIVER", pillText: `${driverName} • On the way`, html: `<div class="smart-popup-profile"><div class="smart-popup-avatar">${driverName.charAt(0)}</div><div><strong>${driverName}</strong><span>On the way to your pickup</span></div></div>`, actions: [{ label: "Message", onClick: () => { window.location.hash = `#messages?booking=${id}`; } }, routeAction] });
    } else if (booking.status === "arrived") {
      SmartPopup.open({ ...liveOptions, eventKey: force ? undefined : `driver-arrived:${id}`, eyebrow: "Pickup update", title: "YOUR DRIVER HAS ARRIVED", pillText: `${driverName} • Arrived`, html: `<p>Your driver is at the pickup point.</p><div class="smart-popup-pin"><span>Trip PIN</span><strong>${escapeHtml(booking.trip_pin || "— — — —")}</strong></div><p class="smart-popup-warning">Share this PIN only when you meet your driver.</p>`, dismissible: false, actions: [routeAction] });
    } else if (booking.status === "in_progress") {
      SmartPopup.open({ ...liveOptions, eventKey: force ? undefined : `journey-started:${id}`, eyebrow: "PIN verified", title: "JOURNEY STARTED", pillText: "Journey in progress", html: `<p>Your trip is now in progress. You can follow the journey and use the safety tools from the booking page.</p>`, actions: [routeAction] });
    } else if (booking.status === "completed") {
      SmartPopup.open({ userId: this.getPopupUserId(), eventKey: `journey-completed:${id}`, eyebrow: "Arrived", title: "JOURNEY COMPLETED", html: `<p>You have reached your destination. Thank you for travelling with TransMove.</p><div class="smart-popup-detail-grid"><span>Total fare</span><strong>$${Number(booking.amount || 0).toFixed(2)}</strong></div>`, actions: [
        { label: "VIEW RECEIPT", onClick: () => { window.location.hash = `#customer?tab=booking-details&id=${id}`; } },
        { label: "RATE DRIVER", primary: true }
      ] });
      setTimeout(() => this.showRatingPopup(booking, true), 200);
    }
  },

  showRatingPopup(booking, queued = false) {
    const id = booking.id || booking.$id;
    SmartPopup.open({
      userId: this.getPopupUserId(),
      eventKey: queued ? `rate-driver:${id}` : undefined,
      eyebrow: "Trip feedback",
      title: "RATE YOUR DRIVER",
      html: `<p>How was your journey with ${escapeHtml(booking.driver?.full_name || "your driver")}?</p><label class="smart-popup-field">Rating<select id="smart-rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Okay</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label><label class="smart-popup-field">Comment (optional)<textarea id="smart-rating-comment" rows="3" maxlength="500" placeholder="Share a short comment"></textarea></label>`,
      actions: [
        { label: "LATER" },
        { label: "SUBMIT RATING", primary: true, busyLabel: "Submitting…", onClick: async ({ backdrop }) => {
          await ReviewService.submitReview({ bookingId: id, rating: Number(backdrop.querySelector("#smart-rating")?.value || 5), comment: backdrop.querySelector("#smart-rating-comment")?.value?.trim() || "" });
          NotificationService.showToast("Thank you", "Your rating has been submitted.", "success");
        } }
      ]
    });
  },

  showPassengerPaymentPopup(booking) {
    const id = booking.id || booking.$id;
    SmartPopup.open({ userId: this.getPopupUserId(), eventKey: `payment-confirmed:${id}`, eyebrow: "Payment update", title: "PAYMENT CONFIRMED BY DRIVER", html: `<p>Your driver confirmed receipt of <strong>$${Number(booking.amount || 0).toFixed(2)}</strong>. This trip is fully settled.</p>`, actions: [{ label: "DONE", primary: true }] });
  },

  scheduleDashboardAd() {
    if (this.adPopupTimer) clearTimeout(this.adPopupTimer);
    this.adPopupTimer = setTimeout(async () => {
      this.adPopupTimer = null;
      const matchingModal = document.getElementById("matching-experience-modal");
      const matchingVisible = Boolean(matchingModal && matchingModal.style.display !== "none");
      const hasActiveJourney = [...this.knownBookingStates.values()].some((state) => ACTIVE_BOOKING_STATUSES.includes(state.status));
      if (!document.querySelector(".customer-dashboard") || matchingVisible || hasActiveJourney || SmartPopup.current) return;
      try {
        const [campaign] = await AdvertisingService.getActivePopupAds();
        if (campaign) this.showDashboardAd(campaign);
      } catch (error) {
        console.warn("Dashboard ad notice:", error.message);
      }
    }, 10000);
  },

  showDashboardAd(campaign) {
    const destination = /^https?:\/\//i.test(campaign.destination_url || "") ? campaign.destination_url : "";
    SmartPopup.open({
      userId: this.getPopupUserId(),
      eventKey: `sponsored-campaign:${campaign.id}`,
      kind: "sponsored",
      eyebrow: "Sponsored",
      title: campaign.title || campaign.business_name || "TransMove partner",
      html: `${campaign.image_url ? `<img class="smart-popup-ad-image" src="${escapeHtml(campaign.image_url)}" alt="">` : ""}<p>${escapeHtml(campaign.description || "")}</p><strong>${escapeHtml(campaign.business_name || "")}</strong>`,
      actions: destination ? [{ label: "LEARN MORE", primary: true, onClick: () => window.open(destination, "_blank", "noopener,noreferrer") }] : []
    });
  },

  async loadOverviewData() {
    await Promise.all([
      this.loadDashboardSummary(),
      this.loadOverviewBookings(),
      this.loadOverviewActiveRequests()
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
        OPEN_REQUEST_STATUSES.includes(request.status)
      ).length;
      const completedBookings = (bookings || []).filter((booking) => booking.status === "completed");
      const totalSpent = completedBookings.reduce((total, booking) => {
        const amount = Number.parseFloat(booking.amount);
        return total + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      activeEl.textContent = String(activeCount);
      completedEl.textContent = String(completedBookings.length);
      spentEl.textContent = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0
      }).format(totalSpent);
      try {
        const favs = await FavouritesService.getFavourites();
        driversEl.textContent = String(favs.length);
      } catch (_) {
        driversEl.textContent = "0";
      }
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
    if (s === "open_for_bids") return "QUOTING";
    if (s === "bids_received" || s === "offers_received" || s === "negotiating") return "QUOTED";
    if (s === "accepted" || s === "confirmed") return "ACCEPTED";
    if (s === "driver_arriving") return "DRIVER ON THE WAY";
    if (s === "arrived") return "DRIVER ARRIVED";
    if (s === "in_progress") return "IN_PROGRESS";
    if (s === "completed") return "COMPLETED";
    if (s === "cancelled") return "CANCELLED";
    return status.toUpperCase();
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
        const pickup = escapeHtml(booking.request?.pickup_location || "Pickup");
        const destination = escapeHtml(booking.request?.destination || "Destination");
        const thumbnailUrl = fileViewUrl(booking.driver?.profile_image_id);
        const thumbnailAlt = booking.driver?.full_name
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

  async loadOverviewData() {
    await Promise.all([
      this.loadDashboardSummary(),
      this.loadOverviewBookings(),
      this.loadOverviewActiveRequests()
    ]);
  },

  async loadOverviewActiveRequests() {
    const section = document.getElementById("cust-overview-active-requests-section");
    if (!section) return;

    try {
      const [requests, bookings] = await Promise.all([
        RequestService.getCustomerRequests(),
        BookingService.getPassengerBookings()
      ]);
      const bookingsByRequest = new Map((bookings || []).map((booking) => [booking.request_id, booking]));
      const openRequests = (requests || []).filter((request) =>
        !bookingsByRequest.has(request.$id || request.id)
        && !["cancelled", "completed"].includes(request.status)
      );

      if (openRequests.length === 0) {
        section.style.display = "none";
        section.innerHTML = "";
        return;
      }

      section.style.display = "block";
      const bidsByRequest = await Promise.all(
        openRequests.map(async (req) => {
          try {
            const reqId = req.$id || req.id;
            const result = await BidService.getBidsForRequest(reqId);
            return Array.isArray(result) ? result : (result?.bids || []);
          } catch (err) {
            console.warn("Could not load quotations for overview request:", err.message);
            return [];
          }
        })
      );

      section.innerHTML = `
        <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-main, #0f172a);">
            Active Requests &amp; Driver Quotations
          </h3>
          <button type="button" class="passenger-link-button btn-go-to-quotes" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; background: none; border: none; cursor: pointer;">
            <span>View Full Board</span>${icon("arrow-right", 16)}
          </button>
        </div>
        ${this.renderActiveRequestsHtml(openRequests, bidsByRequest)}
      `;

      section.querySelector(".btn-go-to-quotes")?.addEventListener("click", () => {
        this.switchTab("active-bids");
      });
      this.attachBidActionHandlers(section);
    } catch (err) {
      console.warn("Notice: loadOverviewActiveRequests:", err.message);
    }
  },

  renderQuotationCardHtml(bid, req) {
    const driverName = bid.driver?.full_name || "Driver details unavailable";
    const avatarUrl = profileImageUrl(bid.driver);
    const vehicleSummary = bid.vehicle
      ? [bid.vehicle.make, bid.vehicle.model, bid.vehicle.year].filter(Boolean).join(" ")
      : "";
    const isVerified = bid.driver?.verification_status === "approved" || bid.driver?.is_verified === true;
    const isPending = ["pending", "countered_by_passenger", "countered_by_driver"].includes(bid.status);
    const driverRating = Number(bid.driver?.rating || bid.driver?.rating_avg || 0);
    const etaMinutes = bid.estimated_arrival_minutes || bid.estimated_arrival_mins || bid.arrival_minutes || 15;
    const bidId = bid.$id || bid.id;
    const numAmt = actionableBidAmount(bid);
    const hasValidAmt = numAmt !== null;
    const bidAmount = hasValidAmt ? (Number.isInteger(numAmt) ? String(numAmt) : numAmt.toFixed(2)) : "--";

    return `
    <div class="bid-card quote-driver-row" data-bid-id="${escapeHtml(bidId)}" style="margin-bottom: 0.85rem; padding: 1rem 1.15rem; border: 1.5px solid var(--border-light, #e2e8f0); border-radius: 10px; background: var(--bg-surface, #ffffff); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div class="bid-driver-info" style="display: flex; gap: 0.85rem; align-items: flex-start;">
        <div class="driver-avatar" style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #e0e7ff; display: grid; place-items: center; font-weight: 800; font-size: 1.1rem; color: #4338ca; flex-shrink: 0;">
          ${avatarUrl ? `<img src="${avatarUrl}" alt="${escapeHtml(driverName)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(driverName.charAt(0))}
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 800; font-size: 1rem; color: var(--text-main, #0f172a);">${escapeHtml(driverName)}</div>
          <div class="quote-driver-meta" style="font-size: 0.8rem; color: var(--text-muted, #64748b); margin-top: 0.15rem;">
            ${isVerified ? `${icon("badge-check", 15)} Verified · ` : ""}${escapeHtml(bid.driver?.city || "Harare")}${vehicleSummary ? ` · ${escapeHtml(vehicleSummary)}` : ""}
          </div>
          <div class="quote-driver-meta" style="font-size: 0.8rem; color: var(--text-muted, #64748b); margin-top: 0.15rem;">
            ${driverRating > 0 ? `${icon("star", 15, { className: "is-filled" })} ${driverRating.toFixed(1)} (${Number(bid.driver?.review_count || 0)})` : "No ratings yet"} · ${icon("clock-3", 15)} ETA ${escapeHtml(etaMinutes)} mins
          </div>
          ${bid.message ? `<div class="quote-driver-meta" style="margin-top: 0.35rem; font-size: 0.83rem; font-style: italic; color: var(--text-main, #334155); background: var(--bg-subtle, #f8fafc); padding: 0.35rem 0.6rem; border-radius: 6px;">“${escapeHtml(bid.message)}”</div>` : ""}
        </div>
      </div>

      <div class="quote-actions" style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid var(--border-light, #f1f5f9); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
        <div class="bid-price" style="font-size: 1.35rem; font-weight: 900; color: #059669;">
          ${hasValidAmt ? `$${bidAmount}` : `<span style="font-size: 1rem; font-weight: 800; color: #dc2626;">Offer unavailable</span>`}
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          ${isPending ? `
            ${bid.negotiation_status === "countered_by_passenger" && hasValidAmt ? `
              <span style="font-size: 0.8rem; color: #1e40af; font-weight: 600;">Counter pending ($${Number.parseFloat(bid.counter_amount || 0).toFixed(2)})</span>
            ` : bid.negotiation_status === "countered_by_driver" && hasValidAmt ? `
              <button type="button" class="btn btn-primary btn-sm btn-accept-driver-counter" data-bid-id="${escapeHtml(bidId)}" data-current-amount="${escapeHtml(numAmt)}" style="background: #16a34a; font-weight: 700; padding: 0.4rem 0.85rem;">
                Accept $${numAmt.toFixed(2)}
              </button>
            ` : ""}
            <button type="button" class="btn btn-outline btn-sm btn-counter-offer" data-bid-id="${escapeHtml(bidId)}" data-current-amount="${escapeHtml(numAmt || "")}" style="padding: 0.4rem 0.85rem; font-weight: 700;" ${!hasValidAmt ? "disabled" : ""}>
              COUNTER OFFER
            </button>
            ${hasValidAmt ? `
              <button type="button" class="btn btn-primary btn-sm btn-accept-offer" data-bid-id="${escapeHtml(bidId)}" data-current-amount="${escapeHtml(numAmt)}" style="font-weight: 700; background: #2563eb; color: #ffffff; padding: 0.4rem 0.95rem;">
                ACCEPT QUOTE
              </button>
            ` : `
              <button type="button" class="btn btn-primary btn-sm btn-accept-offer" data-bid-id="${escapeHtml(bidId)}" style="font-weight: 700; background: #94a3b8; color: #ffffff; padding: 0.4rem 0.95rem; cursor: not-allowed;" disabled>
                UNAVAILABLE
              </button>
            `}
          ` : `
            <span class="badge ${bid.status === "accepted" ? "badge-success" : "badge-neutral"}">${escapeHtml(String(bid.status || "").toUpperCase())}</span>
          `}
        </div>
      </div>
    </div>
    `;
  },

  renderActiveRequestsHtml(openRequests, bidsByRequest) {
    return openRequests.map((req, index) => {
      const bids = bidsByRequest[index] || [];
      const bidList = Array.isArray(bids) ? bids : (bids.bids || []);
      const reqId = req.$id || req.id;

      return `
      <div class="card passenger-quote-request" data-request-id="${escapeHtml(reqId)}" style="margin-bottom: 1.25rem; border: 1.5px solid var(--border-light, #e2e8f0); border-radius: 12px; padding: 1.25rem; background: var(--bg-card, #ffffff);">
        <div class="card-header quote-request-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-light, #f1f5f9); padding-bottom: 0.65rem;">
          <div>
            <span class="badge ${bidList.length > 0 ? "badge-success" : "badge-warning"}">
              ${bidList.length > 0 ? "QUOTATION RECEIVED" : "OPEN FOR BIDS"}
            </span>
            <span style="font-weight: 700; margin-left: 0.5rem;">${escapeHtml((req.request_type || req.service_type || "ride").toUpperCase())}</span>
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--primary, #2563eb);">
            Budget: $${Number.parseFloat(req.budget || req.suggested_price || 0).toFixed(2)}
          </div>
        </div>

        <div class="quote-route-summary" style="display: flex; gap: 1.5rem; margin-bottom: 1rem; font-size: 0.9rem;">
          <div><small style="color: #64748b; display: block;">Route</small><strong>${escapeHtml(req.pickup_address || req.pickup_location)} → ${escapeHtml(req.destination_address || req.destination)}</strong></div>
          <div><small style="color: #64748b; display: block;">Request ID</small><strong style="font-family: monospace;">#${escapeHtml(String(reqId).slice(0, 10).toUpperCase())}</strong></div>
        </div>

        ${bidList.length > 0 ? `
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #065f46; margin-bottom: 0.75rem;">
            Quotation received (${bidList.length})
          </h4>
          <div class="offers-list">
            ${bidList.map((bid) => this.renderQuotationCardHtml(bid, req)).join("")}
          </div>
        ` : `
          <div class="waiting-quotes-box" style="background: var(--bg-subtle, #f8fafc); padding: 1.25rem; border-radius: 8px; text-align: center; color: var(--text-muted, #64748b); font-size: 0.9rem;">
            ${icon("clock-3", 17)}<span>Waiting for driver's quotations...</span>
          </div>
        `}
      </div>
      `;
    }).join("");
  },

  attachBidActionHandlers(container) {
    if (!container) return;

    container.querySelectorAll(".btn-counter-offer").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const bidId = e.currentTarget.getAttribute("data-bid-id");
        const currentAmt = parseFloat(e.currentTarget.getAttribute("data-current-amount") || "0");
        this.openPassengerCounterModal(bidId, currentAmt);
      });
    });

    container.querySelectorAll(".btn-accept-driver-counter").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const bidId = e.currentTarget.getAttribute("data-bid-id");
        if (!bidId) return;
        const actionBtn = e.currentTarget;
        const currentAmount = Number(actionBtn.getAttribute("data-current-amount"));
        if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
          alert("Cannot accept an invalid or $0 offer.");
          return;
        }
        actionBtn.disabled = true;
        actionBtn.innerText = "Accepting...";
        try {
          await BidService.acceptCounterOffer(bidId);
          const result = await BidService.acceptBid(bidId);
          const bookingId = result.bookingId || result.booking?.id || result.booking?.$id;
          const confirmed = (await BookingService.getPassengerBookings().catch(() => [])).find((booking) => (booking.id || booking.$id) === bookingId);
          if (confirmed) this.showDriverConfirmedPopup(confirmed);
          window.location.hash = `#customer?tab=booking-details&id=${bookingId}`;
        } catch (err) {
          alert("Could not accept counter offer: " + err.message);
          actionBtn.disabled = false;
          actionBtn.innerText = "Accept";
        }
      });
    });

    container.querySelectorAll(".btn-decline-counter").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const bidId = e.currentTarget.getAttribute("data-bid-id");
        if (!bidId) return;
        if (!confirm("Decline this driver counter offer?")) return;
        try {
          await BidService.declineCounterOffer(bidId);
          alert("Counter offer declined.");
          await Promise.allSettled([this.loadActiveBids(), this.loadOverviewActiveRequests()]);
        } catch (err) {
          alert("Could not decline counter offer: " + err.message);
        }
      });
    });

    container.querySelectorAll(".btn-accept-offer").forEach((button) => {
      button.addEventListener("click", async (event) => {
        const bidId = event.currentTarget.getAttribute("data-bid-id");
        if (!bidId) return;
        const currentAmount = Number(event.currentTarget.getAttribute("data-current-amount"));
        if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
          alert("Cannot accept an invalid or $0 offer.");
          return;
        }
        if (!confirm("Accept this driver quotation? (This locks the driver for this request and closes other quotes)")) return;

        const acceptButton = event.currentTarget;
        const originalLabel = acceptButton.innerText;
        acceptButton.disabled = true;
        acceptButton.innerText = "Accepting...";

        try {
          const result = await BidService.acceptBid(bidId);
          const bookingId = result.bookingId || result.booking?.id || result.booking?.$id;
          if (!bookingId) throw new Error("The booking was created but no booking ID was returned.");
          const confirmed = (await BookingService.getPassengerBookings().catch(() => [])).find((booking) => (booking.id || booking.$id) === bookingId);
          if (confirmed) this.showDriverConfirmedPopup(confirmed);
          window.location.hash = `#customer?tab=booking-details&id=${bookingId}`;
        } catch (err) {
          if (err.subscriptionRequired) {
            alert("That provider is currently unavailable. Please choose another quotation.");
          } else {
            alert("Could not accept quotation: " + err.message);
          }
          acceptButton.disabled = false;
          acceptButton.innerText = originalLabel;
        }
      });
    });
  },

  async loadActiveBids() {
    const container = document.getElementById("active-requests-board");
    if (!container) return;

    try {
      const [requests, bookings] = await Promise.all([
        RequestService.getCustomerRequests(),
        BookingService.getPassengerBookings()
      ]);
      const bookingsByRequest = new Map((bookings || []).map((booking) => [booking.request_id, booking]));
      const activeBooking = (bookings || []).find((booking) => ACTIVE_BOOKING_STATUSES.includes(booking.status));
      if (activeBooking) {
        window.location.hash = `#customer?tab=booking-details&id=${activeBooking.id || activeBooking.$id}`;
        return;
      }

      const openRequests = (requests || []).filter((request) =>
        !bookingsByRequest.has(request.$id || request.id)
        && !["cancelled", "completed"].includes(request.status)
      );

      if (openRequests.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "You don't have any active requests",
          description: "Post a ride or cargo request to receive real-time driver quotations.",
          actionText: "Request a Service",
          actionLink: "#customer?tab=search",
          icon: "car"
        });
        return;
      }

      const bidsByRequest = await Promise.all(
        openRequests.map(async (req) => {
          try {
            const reqId = req.$id || req.id;
            const result = await BidService.getBidsForRequest(reqId);
            return Array.isArray(result) ? result : (result?.bids || []);
          } catch (err) {
            console.warn(`Could not load quotations for request ${req.$id || req.id}:`, err.message);
            return [];
          }
        })
      );

      container.innerHTML = this.renderActiveRequestsHtml(openRequests, bidsByRequest);
      this.attachBidActionHandlers(container);
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Quotations unavailable",
        description: "Your driver quotations could not be loaded right now. Please try again.",
        icon: "car"
      });
    }
  },

  openPassengerCounterModal(bidId, currentAmount, suppliedBid = null) {
    const bid = suppliedBid || [...this.latestBidsByRequest.values()].flat().find((item) => (item.id || item.$id) === bidId) || { id: bidId, amount: currentAmount };
    const requestId = bid.request_id || bid.request?.id || bid.request?.$id || bidId;
    const rawDriverAsked = actionableBidAmount(bid) ?? Number(currentAmount);
    if (!Number.isFinite(rawDriverAsked) || rawDriverAsked <= 0) {
      alert("Cannot counter an invalid or missing offer.");
      return;
    }
    const driverAsked = rawDriverAsked;
    const initialCounter = driverAsked;
    const askedFormatted = Number.isInteger(driverAsked) ? String(driverAsked) : driverAsked.toFixed(2);
    const counterFormatted = Number.isInteger(initialCounter) ? String(initialCounter) : initialCounter.toFixed(2);

    SmartPopup.update({
      flowKey: `passenger-request:${requestId}`,
      state: "counter_edit",
      eyebrow: "Fare negotiation",
      title: "Counter offer",
      minimizable: true,
      pillText: `Countering • $${counterFormatted}`,
      html: `
        <div class="smart-sheet-budget-card" style="margin-bottom: 0.5rem; background: var(--bg-subtle); border-color: var(--border-light);">
          <span style="color: var(--text-muted);">Driver asked</span>
          <strong style="color: var(--text-main); font-size: 1.15rem;">$${askedFormatted}</strong>
        </div>

        <div class="smart-sheet-price-editor-wrap">
          <div class="smart-sheet-price-display-box">
            <span class="smart-sheet-currency-symbol">$</span>
            <input type="number" id="passenger-counter-price" class="smart-sheet-price-number-input" value="${initialCounter}" step="0.5" min="1" />
          </div>

          <div class="smart-sheet-price-steppers-grid">
            <button type="button" class="smart-stepper-pill btn-passenger-stepper" data-delta="-1">- $1</button>
            <button type="button" class="smart-stepper-pill btn-passenger-stepper" data-delta="+1">+ $1</button>
            <button type="button" class="smart-stepper-pill btn-passenger-stepper" data-delta="-2">- $2</button>
            <button type="button" class="smart-stepper-pill btn-passenger-stepper" data-delta="+2">+ $2</button>
          </div>
        </div>
      `,
      onRender: ({ backdrop }) => {
        const input = backdrop.querySelector("#passenger-counter-price");
        const sendBtn = backdrop.querySelector(".smart-popup-action.btn-primary");
        const updateSend = (val) => {
          const num = Number(val || 0);
          const label = Number.isInteger(num) ? String(num) : num.toFixed(2);
          if (sendBtn) sendBtn.textContent = `Send $${label}`;
        };
        input?.addEventListener("input", (e) => updateSend(e.target.value));
        backdrop.querySelectorAll(".btn-passenger-stepper").forEach((btn) => {
          btn.addEventListener("click", () => {
            const delta = Number(btn.getAttribute("data-delta") || 0);
            const current = Number(input.value || initialCounter);
            const next = Math.max(1, current + delta);
            input.value = next;
            updateSend(next);
          });
        });
        updateSend(input?.value || initialCounter);
      },
      actions: [
        {
          label: "Back",
          close: false,
          onClick: () => {
            this.showQuotationPopup(bid, bid.negotiation_status === "countered_by_driver", { force: true });
            return false;
          }
        },
        {
          label: `Send $${counterFormatted}`,
          primary: true,
          close: false,
          busyLabel: "Sending…",
          onClick: async ({ backdrop }) => {
            const amount = Number(backdrop.querySelector("#passenger-counter-price")?.value || 0);
            if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid counter amount greater than zero.");
            await BidService.counterBid({ bidId, counterAmount: amount });
            this.clearPassengerDraft();
            const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
            SmartPopup.update({
              state: "counter_sent",
              eyebrow: "Fare negotiation",
              title: "Counter sent",
              minimizable: true,
              pillText: `$${formatted} counter • Waiting`,
              autoMinimizeAfter: 2000,
              html: `
                <div class="smart-sheet-status-box">
                  <div class="smart-sheet-success-badge">${icon("check", 20)}</div>
                  <h3 class="smart-sheet-status-heading icon-label">${icon("circle-check", 20)}<span>Counter sent</span></h3>
                  <div class="smart-sheet-status-price-card">
                    <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 700;">Your counter</div>
                    <div style="font-size: 2.2rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">$${formatted}</div>
                  </div>
                  <p class="smart-sheet-waiting-text">Waiting for driver...</p>
                </div>
              `,
              actions: []
            });
            NotificationService.showToast("Counter sent", "Waiting for driver response", "success");
            this.scheduleJourneySync(0);
            return false;
          }
        }
      ]
    });
  },

  async loadBookings(filter = "all") {
    const container = document.getElementById("my-bookings-board");
    if (!container) return;

    try {
      const bookings = await BookingService.getUserBookings();
      const filteredBookings = (bookings || []).filter((booking) => {
        if (filter === "all") return true;
        if (filter === "upcoming") return ["confirmed", "driver_arriving", "arrived"].includes(booking.status);
        if (filter === "in_progress") return booking.status === "in_progress";
        return booking.status === filter;
      });

      if (filteredBookings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: filter === "all" ? "No bookings yet" : `No ${filter.replace("_", " ")} bookings`,
          description: filter === "all"
            ? "When you accept a driver quotation, your confirmed trips will appear here."
            : "Bookings matching this status will appear here.",
          actionText: "Request a Service",
          actionLink: "#customer?tab=search",
          icon: "car"
        });
        return;
      }

      container.innerHTML = `<div class="passenger-list-card">${filteredBookings.map((b) => {
        const displayStatus = this.getDisplayStatus(b.status);
        const statusClass = displayStatus === "COMPLETED" ? "badge-success" : displayStatus === "CANCELLED" ? "badge-neutral" : displayStatus === "IN_PROGRESS" ? "badge-info" : "badge-warning";
        const route = `${escapeHtml(b.request?.pickup_location || "Pickup")} → ${escapeHtml(b.request?.destination || "Destination")}`;
        const tripDate = b.created_at ? new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date pending";
        const photo = fileViewUrl(b.driver?.profile_image_id);
        const driverName = b.driver?.full_name || "";
        return `
          <article class="booking-list-row">
            <span class="booking-list-thumb">${photo ? `<img src="${photo}" alt="${escapeHtml(driverName || "Assigned driver")}">` : passengerIcon("bus", 24)}</span>
            <span class="booking-list-main"><strong>${route}</strong><small>${tripDate}${driverName ? ` · ${escapeHtml(driverName)}` : ""}</small></span>
            <span class="badge ${statusClass}">${displayStatus.replace("_", " ")}</span>
            <span class="booking-list-actions">
              <a class="passenger-text-link" href="#customer?tab=booking-details&id=${escapeHtml(b.id)}">View Details</a>
              <a class="booking-row-chevron" href="#customer?tab=booking-details&id=${escapeHtml(b.id)}" aria-label="Open booking">${passengerIcon("chevron", 20)}</a>
            </span>
          </article>`;
      }).join("")}</div>`;
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
      const allBookings = await BookingService.getUserBookings();
      const booking = bookingId
        ? (allBookings || []).find((b) => (b.id || b.$id) === bookingId) || null
        : (allBookings || [])[0] || null;
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

      let passengerCount = booking.request?.passenger_count;
      if (passengerCount == null && booking.request_id) {
        try {
          const requests = await RequestService.getCustomerRequests();
          passengerCount = (requests || []).find((r) => (r.id || r.$id) === booking.request_id)?.passenger_count;
        } catch (_) {
          passengerCount = null;
        }
      }

      const status = this.getDisplayStatus(booking.status);
      const statusClass = status === "COMPLETED" ? "badge-success" : status === "CANCELLED" ? "badge-neutral" : status === "IN_PROGRESS" ? "badge-info" : "badge-warning";
      const steps = ["confirmed", "driver_arriving", "arrived", "in_progress", "completed"];
      const stepLabels = {
        confirmed: "Booking confirmed",
        driver_arriving: "Driver is on the way",
        arrived: "Driver has arrived",
        in_progress: "Journey in progress",
        completed: "Journey completed"
      };
      const currentStep = Math.max(0, steps.indexOf(booking.status));
      const vehicleLabel = booking.vehicle
        ? escapeHtml(`${booking.vehicle.make || ""} ${booking.vehicle.model || ""} · ${booking.vehicle.registration_number || "Registration pending"}`.trim())
        : "Vehicle details pending";
      const canCancel = ["confirmed", "driver_arriving"].includes(booking.status);
      const driverName = escapeHtml(booking.driver?.full_name || "Driver assignment pending");
      const driverPhoto = fileViewUrl(booking.driver?.profile_image_id);
      const pickup = escapeHtml(booking.request?.pickup_location || "Pickup");
      const destination = escapeHtml(booking.request?.destination || "Destination");

      const isCompleted = booking.status === "completed";
      const isCancelled = booking.status === "cancelled";

      let existingReview = null;
      if (isCompleted) {
        try {
          const revs = await ReviewService.getBookingReviews(booking.id);
          existingReview = (revs || [])[0] || null;
        } catch (_) {}
      }

      let isDriverFav = false;
      if (booking.driver_id) {
        try {
          isDriverFav = await FavouritesService.isFavourite(booking.driver_id);
        } catch (_) {}
      }

      container.innerHTML = `
        <div class="passenger-page-heading passenger-page-heading--inline">
          <div><h2>Booking Details</h2><p>Booking #${String(booking.id).slice(0, 12).toUpperCase()}</p></div>
          <span class="badge ${statusClass}">${status.replace("_", " ")}</span>
        </div>
        ${ACTIVE_BOOKING_STATUSES.includes(booking.status) ? `
          <section class="card passenger-active-trip-map-card" aria-label="Live trip map">
            <div class="passenger-active-trip-map-head">
              <div><small>Active trip</small><strong>${pickup} → ${destination}</strong></div>
              <span>${status.replace("_", " ")}</span>
            </div>
            <div id="passenger-active-trip-map" class="map-container"></div>
          </section>
        ` : ""}
        <div class="booking-detail-layout">
          <section class="card booking-detail-summary">
            <div class="booking-route-block">
              <span>Route</span><strong>${pickup} → ${destination}</strong>
              <small>${booking.created_at ? new Date(booking.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Schedule pending"}</small>
            </div>
            <div class="booking-detail-facts">
              <div><span>Passengers</span><strong>${passengerCount ?? "—"}</strong></div>
              <div><span>Total Price</span><strong>$${Number.parseFloat(booking.amount || 0).toFixed(2)}</strong></div>
              <div><span>Booking Ref</span><strong>#${String(booking.id).slice(0, 8).toUpperCase()}</strong></div>
            </div>
            <div class="driver-profile-strip">
              <span class="driver-avatar">${driverPhoto ? `<img src="${driverPhoto}" alt="${driverName}">` : (booking.driver?.full_name?.charAt(0) || "D")}</span>
              <span><small>Assigned Driver</small><strong>${driverName}</strong><em>${vehicleLabel}</em></span>
            </div>

            ${booking.trip_pin ? `
              <div class="trip-pin-box" style="margin-top: 1rem; background: ${booking.status === "arrived" ? "#fef3c7" : "#ecfdf5"}; border: 2px ${booking.status === "arrived" ? "solid #f59e0b" : "dashed #059669"}; padding: 1rem; border-radius: 10px; box-shadow: ${booking.status === "arrived" ? "0 4px 14px rgba(245, 158, 11, 0.25)" : "none"};">
                ${booking.status === "arrived" ? `
                  <div style="font-weight: 800; color: #b45309; font-size: 0.95rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
                    ${icon("bell-ring", 17)}<span>Your driver has arrived!</span>
                  </div>
                  <div style="font-size: 0.82rem; color: #78350f; margin-bottom: 0.6rem;">
                    Please meet your driver and share your Trip PIN to begin the journey:
                  </div>
                ` : ""}
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="display: flex; align-items: center; gap: 0.65rem;">
                    <span style="font-weight: 800; font-size: 0.85rem; color: ${booking.status === "arrived" ? "#92400e" : "#065f46"};">TRIP PIN:</span>
                    <span class="trip-pin-code" style="font-size: 1.75rem; letter-spacing: 5px; font-weight: 900; color: ${booking.status === "arrived" ? "#b45309" : "#047857"}; font-family: monospace;">${escapeHtml(booking.trip_pin)}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${booking.status !== "arrived" ? `<small style="color: #047857;">Share with driver to start trip</small>` : ""}
                    <button type="button" class="btn btn-outline btn-sm btn-copy-pin" data-pin="${escapeHtml(booking.trip_pin)}" style="padding: 0.25rem 0.65rem; font-size: 0.8rem; background: #ffffff; border-color: ${booking.status === "arrived" ? "#d97706" : "#059669"}; color: ${booking.status === "arrived" ? "#b45309" : "#047857"}; font-weight: 700;">${icon("clipboard", 16)}<span>Copy PIN</span></button>
                  </div>
                </div>
              </div>
            ` : ""}

            ${["confirmed", "driver_arriving", "arrived"].includes(booking.status) ? `
              <div class="card" style="margin-top: 1rem; padding: 0.85rem 1rem; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 700; font-size: 0.88rem; color: #1e293b;">
                    <span class="icon-label">${icon("map-pin", 16)}<span>Share live pickup location with driver</span></span>
                  </div>
                  <small style="color: #64748b; font-size: 0.78rem;">Allows your driver to see your exact pickup point in real time.</small>
                </div>
                <label style="position: relative; display: inline-block; width: 44px; height: 24px; margin: 0; cursor: pointer;">
                  <input type="checkbox" id="toggle-passenger-live-loc" ${booking.live_location_active ? "checked" : ""} style="opacity: 0; width: 0; height: 0;">
                  <span style="position: absolute; inset: 0; background-color: ${booking.live_location_active ? '#059669' : '#cbd5e1'}; border-radius: 24px; transition: .3s;" id="toggle-live-loc-slider"></span>
                </label>
              </div>
            ` : ""}

            <div class="booking-detail-buttons" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1.25rem;">
              <a href="#messages?booking=${booking.id}" class="btn btn-primary">Contact Driver</a>
              <button type="button" class="btn btn-outline btn-share-trip" data-booking-id="${booking.id}">${icon("share-2", 17)}<span>Share Trip</span></button>
              <button type="button" class="btn btn-outline btn-view-receipt" data-booking-id="${booking.id}">${icon("file-text", 17)}<span>View Receipt</span></button>
              ${booking.driver_id ? `<button type="button" class="btn btn-outline btn-save-driver" data-driver-id="${booking.driver_id}">${icon("heart", 17, { className: isDriverFav ? "is-filled" : "" })}<span>${isDriverFav ? "Saved" : "Save Driver"}</span></button>` : ""}
              ${(isCompleted || isCancelled) ? `<button type="button" class="btn btn-outline btn-repeat-booking">${icon("repeat-2", 17)}<span>Request Again</span></button>` : ""}
              ${canCancel ? `<button type="button" class="btn btn-outline btn-cancel-passenger-booking" data-booking-id="${booking.id}">Cancel Booking</button>` : ""}
              <button type="button" class="btn btn-outline btn-dispute-booking" data-booking-id="${booking.id}" style="color: #dc2626; border-color: #fca5a5;">${icon("triangle-alert", 17)}<span>Report Issue</span></button>
            </div>
          </section>
          <section class="card booking-timeline-card">
            <h3>Trip Progress</h3>
            <div class="booking-timeline">
              ${steps.map((step, index) => `
                <div class="timeline-step ${index <= currentStep ? "complete" : ""} ${index === currentStep ? "current" : ""}">
                  <span class="timeline-dot"></span>
                  <div><strong>${stepLabels[step]}</strong><small>${index <= currentStep ? "Status recorded" : "Pending"}</small></div>
                </div>`).join("")}
            </div>
          </section>
        </div>

        ${isCompleted ? `
          <div class="card" style="margin-top: 1.25rem; padding: 1rem 1.25rem; background: #ffffff; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; border-left: 4px solid ${booking.payment_status === "received" ? "#10b981" : "#f59e0b"};">
            <div>
              <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">Trip Fare Settlement</div>
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">$${Number.parseFloat(booking.amount || 0).toFixed(2)}</div>
            </div>
            <div>
              ${booking.payment_status === "received" ? `
                <span class="settlement-badge-received icon-label">${icon("circle-check", 15)}<span>Payment Confirmed by Driver</span></span>
              ` : `
                <span class="settlement-badge-pending icon-label">${icon("clock-3", 15)}<span>Awaiting Driver Payment Confirmation</span></span>
              `}
            </div>
          </div>

          <section class="card" style="margin-top: 1.25rem; padding: 1.25rem; background: #ffffff;">
            <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">Driver Rating &amp; Review</h3>
            ${existingReview ? `
              <div style="color: #f59e0b; font-size: 1.2rem; margin-bottom: 0.35rem;">
                ${ratingIcons(existingReview.rating, 18)} (${existingReview.rating}/5)
              </div>
              ${existingReview.comment ? `<div style="font-size: 0.88rem; color: #475569; font-style: italic;">“${escapeHtml(existingReview.comment)}”</div>` : ""}
            ` : `
              <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.75rem;">Your review helps maintain safety and trust on TransMove.</p>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-bottom: 0.75rem;">
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.25rem;">Rating</label>
                  <select id="review-rating-select" class="form-select" style="padding: 0.4rem 0.75rem; font-size: 0.9rem;">
                    <option value="5">5 Stars — Excellent</option>
                    <option value="4">4 Stars — Good</option>
                    <option value="3">3 Stars — Average</option>
                    <option value="2">2 Stars — Poor</option>
                    <option value="1">1 Star — Terrible</option>
                  </select>
                </div>
              </div>
              <div style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #64748b; display: block; margin-bottom: 0.25rem;">Feedback (Optional)</label>
                <textarea id="review-comment-input" class="form-textarea" rows="2" placeholder="Tell us about the vehicle condition, punctuality, and route..."></textarea>
              </div>
              <button type="button" class="btn btn-primary btn-sm" id="btn-submit-booking-review">
                Submit Review
              </button>
            `}
          </section>
        ` : ""}
      `;

      if (ACTIVE_BOOKING_STATUSES.includes(booking.status)) this.initPassengerActiveTripMap(booking);

      container.querySelector(".btn-share-trip")?.addEventListener("click", async () => {
        try {
          const res = await BookingService.generateShareLink(booking.id);
          const shareUrl = `${window.location.origin}${window.location.pathname}#shared-trip?token=${res.share_token}`;
          await SocialService.shareTransMove({
            title: `My TransMove Trip: ${pickup} → ${destination}`,
            text: `Track my live trip status on TransMove:`,
            url: shareUrl
          });
        } catch (err) {
          alert("Could not generate share link: " + err.message);
        }
      });

      container.querySelector(".btn-view-receipt")?.addEventListener("click", async () => {
        try {
          await ReceiptService.printReceipt(booking.id);
        } catch (err) {
          alert("Could not generate receipt: " + err.message);
        }
      });

      container.querySelector(".btn-save-driver")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const dId = btn.getAttribute("data-driver-id");
        btn.disabled = true;
        try {
          await FavouritesService.addFavourite(dId);
          btn.innerHTML = `${icon("heart", 17, { className: "is-filled" })}<span>Saved</span>`;
          alert("Driver added to your saved favourites!");
          await this.loadDashboardSummary();
        } catch (err) {
          alert("Could not save driver: " + err.message);
          btn.disabled = false;
        }
      });

      container.querySelector(".btn-repeat-booking")?.addEventListener("click", () => {
        this.repeatRequest(booking);
      });

      container.querySelector(".btn-dispute-booking")?.addEventListener("click", async () => {
        const reason = prompt("Describe the dispute/issue category (e.g. driver_no_show, wrong_vehicle, safety, overcharge, other):", "driver_no_show");
        if (!reason) return;
        const details = prompt("Please provide details for the support team:") || "";
        try {
          await DisputeService.createDispute({
            bookingId: booking.id,
            reason: reason.trim(),
            details: details.trim()
          });
          alert("Dispute ticket submitted to TransMove Support desk.");
        } catch (err) {
          alert("Could not submit dispute: " + err.message);
        }
      });

      container.querySelector(".btn-cancel-passenger-booking")?.addEventListener("click", async (event) => {
        if (!confirm("Cancel this booking?")) return;
        const reasons = [
          "Driver was delayed / taking too long",
          "Changed travel plans",
          "Found alternative transport",
          "Booked by mistake",
          "Safety / vehicle concern",
          "Other"
        ];
        const reasonPrompt = prompt("Select cancellation reason:\n" + reasons.map((r, i) => `${i + 1}. ${r}`).join("\n") + "\n\nEnter number (1-6):", "2");
        if (!reasonPrompt) return;
        const idx = parseInt(reasonPrompt, 10) - 1;
        const reasonText = (idx >= 0 && idx < reasons.length) ? reasons[idx] : "Cancelled by passenger";
        try {
          await BookingService.cancelBookingWithReason(booking.id, { reason: reasonText });
          alert("Booking cancelled.");
          await this.loadBookingDetails(booking.id);
        } catch (error) {
          alert("Could not cancel booking: " + error.message);
        }
      });

      container.querySelector("#btn-submit-booking-review")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const rating = parseInt(document.getElementById("review-rating-select")?.value || "5", 10);
        const comment = document.getElementById("review-comment-input")?.value?.trim() || "";
        btn.disabled = true;
        btn.innerText = "Submitting...";
        try {
          await ReviewService.submitReview({ bookingId: booking.id, rating, comment });
          alert("Thank you for reviewing your driver!");
          await this.loadBookingDetails(booking.id);
        } catch (err) {
          alert("Could not submit review: " + err.message);
          btn.disabled = false;
          btn.innerText = "Submit Review";
        }
      });

      container.querySelectorAll(".btn-copy-pin").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const pin = e.currentTarget.getAttribute("data-pin");
          if (pin) {
            navigator.clipboard?.writeText(pin).then(() => {
              e.currentTarget.innerHTML = `${icon("check", 16)}<span>Copied!</span>`;
            setTimeout(() => { e.currentTarget.innerHTML = `${icon("clipboard", 16)}<span>Copy PIN</span>`; }, 2000);
            }).catch(() => {
              prompt("Your Trip PIN:", pin);
            });
          }
        });
      });

      const liveLocToggle = container.querySelector("#toggle-passenger-live-loc");
      if (liveLocToggle) {
        liveLocToggle.addEventListener("change", async (e) => {
          const isSharing = e.target.checked;
          const slider = document.getElementById("toggle-live-loc-slider");
          if (slider) slider.style.backgroundColor = isSharing ? "#059669" : "#cbd5e1";

          if (isSharing) {
            try {
              const coords = await LocationService.getCurrentPosition();
              await BookingService.updatePassengerLiveLocation({
                bookingId: booking.id,
                active: true,
                latitude: coords.lat,
                longitude: coords.lng
              });
              if (this.liveLocationWatchId) await LocationService.clearWatch(this.liveLocationWatchId);
              this.liveLocationWatchId = await LocationService.watchPosition(
                async (nextCoords) => {
                  try {
                    await BookingService.updatePassengerLiveLocation({
                      bookingId: booking.id,
                      active: true,
                      latitude: nextCoords.lat,
                      longitude: nextCoords.lng
                    });
                  } catch (err) {
                    console.warn("Live location watch update error:", err.message);
                  }
                },
                (err) => console.warn("Live location watch error:", err.message)
              );
            } catch (err) {
              NotificationService.showToast("Location unavailable", `${err.message} You can continue using the address fields manually.`, "info");
              e.target.checked = false;
              if (slider) slider.style.backgroundColor = "#cbd5e1";
            }
          } else {
            if (this.liveLocationWatchId) {
              await LocationService.clearWatch(this.liveLocationWatchId);
              this.liveLocationWatchId = null;
            }
            try {
              await BookingService.updatePassengerLiveLocation({ bookingId: booking.id, active: false });
            } catch (err) {
              console.warn("Could not deactivate live location:", err.message);
            }
          }
        });
      }

      if (["in_progress", "completed", "cancelled"].includes(booking.status) && this.liveLocationWatchId) {
        await LocationService.clearWatch(this.liveLocationWatchId);
        this.liveLocationWatchId = null;
      }
    } catch (error) {
      container.innerHTML = renderEmptyState({ title: "Booking unavailable", description: "This booking could not be loaded.", icon: "car" });
    }
  },

  initPassengerActiveTripMap(booking) {
    const mapElement = document.getElementById("passenger-active-trip-map");
    if (!mapElement || !window.L) return;
    if (this.activeTripMap) {
      try { this.activeTripMap.remove(); } catch (_) {}
    }

    const pickup = [Number(booking.request?.pickup_latitude), Number(booking.request?.pickup_longitude)];
    const destination = [Number(booking.request?.destination_latitude), Number(booking.request?.destination_longitude)];
    const driver = [Number(booking.driver_live_lat || booking.driver_latitude), Number(booking.driver_live_lng || booking.driver_longitude)];
    const valid = (coords) => coords.every(Number.isFinite);
    const points = [pickup, destination, driver].filter(valid);
    const center = points[0] || [LocationService.DEFAULT_CENTER.lat, LocationService.DEFAULT_CENTER.lng];
    const map = window.L.map(mapElement, { zoomControl: false, attributionControl: false }).setView(center, 13);
    this.activeTripMap = map;
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    window.L.control.zoom({ position: "bottomright" }).addTo(map);

    if (valid(pickup)) window.L.circleMarker(pickup, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#2495ff", fillOpacity: 1 }).addTo(map).bindPopup("Pickup");
    if (valid(destination)) window.L.circleMarker(destination, { radius: 8, color: "#ffffff", weight: 3, fillColor: "#ef3340", fillOpacity: 1 }).addTo(map).bindPopup("Destination");
    if (valid(driver)) window.L.circleMarker(driver, { radius: 9, color: "#ffffff", weight: 3, fillColor: "#18a66a", fillOpacity: 1 }).addTo(map).bindPopup("Driver location");
    if (valid(pickup) && valid(destination)) window.L.polyline([pickup, destination], { color: "#2495ff", weight: 5, opacity: 0.78 }).addTo(map);
    if (points.length > 1) map.fitBounds(window.L.latLngBounds(points), { padding: [34, 34], maxZoom: 15 });
    setTimeout(() => map.invalidateSize(), 180);
  },

  async loadPayments() {
    const container = document.getElementById("payments-board");
    if (!container) return;

    try {
      const profile = await AuthService.getCurrentProfile();
      const [transactions, bookings] = await Promise.all([
        profile?.id ? PaymentService.getUserPayments() : [],
        BookingService.getUserBookings()
      ]);
      const completed = (bookings || []).filter((booking) => booking.status === "completed");
      const totalSpent = completed.reduce((total, booking) => total + (Number.parseFloat(booking.amount) || 0), 0);

      container.innerHTML = `
        <div class="payments-summary-grid">
          <article class="payment-summary-card"><span class="summary-icon-circle icon-blue">${passengerIcon("wallet", 23)}</span><div><small>Total Spent</small><strong>$${totalSpent.toFixed(2)}</strong><em>Completed bookings</em></div></article>
          <article class="payment-summary-card"><span class="summary-icon-circle icon-green">${passengerIcon("check", 23)}</span><div><small>Completed Trips</small><strong>${completed.length}</strong><em>Successfully delivered</em></div></article>
        </div>
        <section class="passenger-list-card payment-history-card">
          <div class="passenger-list-heading"><h3>Transaction History</h3><span>Payment records</span></div>
          ${!transactions?.length ? `<div class="compact-empty-state"><span class="summary-icon-circle icon-blue">${passengerIcon("wallet", 23)}</span><div><strong>No payment records</strong><p>Verified transactions will appear here when recorded.</p></div></div>` : transactions.map((transaction) => `
            <div class="payment-history-row">
              <div><strong>${escapeHtml(transaction.plan?.name || transaction.plan_name || transaction.payment_type || "Payment")}</strong><small>${transaction.created_at ? new Date(transaction.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "Date unavailable"}</small></div>
              <strong class="payment-amount">$${Math.abs(Number.parseFloat(transaction.amount ?? transaction.amount_declared ?? 0)).toFixed(2)}</strong>
              <span class="badge ${transaction.status === "approved" ? "badge-success" : "badge-info"}">${escapeHtml(transaction.status || "pending_review")}</span>
            </div>`).join("")}
        </section>`;
    } catch (error) {
      container.innerHTML = renderEmptyState({ title: "Payments unavailable", description: "Payment records could not be loaded right now.", icon: "inbox" });
    }
  },

  async loadFavourites() {
    const container = document.getElementById("favourites-board");
    if (!container) return;

    try {
      const favs = await FavouritesService.getFavourites();
      if (!favs || favs.length === 0) {
        container.innerHTML = `<section class="passenger-list-card favourites-empty-card">${renderEmptyState({
          title: "No saved drivers yet",
          description: "Save verified drivers to your favourites after a trip or quotation for quick repeat access.",
          icon: "heart"
        })}</section>`;
        return;
      }

      container.innerHTML = `
        <div class="grid-2">
          ${favs.map((fav) => {
            const d = fav.driver || {};
            const name = escapeHtml(d.full_name || "Verified Driver");
            const photo = fileViewUrl(d.profile_image_id);
            const category = escapeHtml(d.service_category || "Passenger Transport");
            const rating = d.rating ? Number(d.rating).toFixed(1) : "New";

            return `
              <div class="card" style="padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--border-light);">
                <div>
                  <div style="display: flex; gap: 0.85rem; align-items: center; margin-bottom: 0.75rem;">
                    <div style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: var(--primary); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0;">
                      ${photo ? `<img src="${photo}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;" />` : name.charAt(0)}
                    </div>
                    <div>
                      <div style="font-weight: 800; font-size: 1rem; color: #0f172a;">${name}</div>
              <div class="icon-label icon-label--inline" style="font-size: 0.8rem; color: #64748b;"><span>${category} ·</span>${icon("star", 15, { className: "is-filled" })}<span>${rating}</span></div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 0.75rem; margin-top: 0.5rem;">
                  <button type="button" class="btn btn-outline btn-sm btn-remove-fav" data-fav-id="${fav.id}">
              ${icon("heart-off", 16)}<span>Remove</span>
                  </button>
                  <button type="button" class="btn btn-primary btn-sm btn-request-fav" data-driver-name="${name}">
                    Post Request
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-remove-fav").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const fid = e.currentTarget.getAttribute("data-fav-id");
          btn.disabled = true;
          try {
            await FavouritesService.removeFavourite(fid);
            await this.loadFavourites();
            await this.loadDashboardSummary();
          } catch (err) {
            alert("Could not remove favourite: " + err.message);
            btn.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-request-fav").forEach((btn) => {
        btn.addEventListener("click", () => {
          this.switchTab("new-request");
        });
      });
    } catch (err) {
      container.innerHTML = `<section class="passenger-list-card favourites-empty-card">${renderEmptyState({
        title: "Favourites unavailable",
        description: "Could not load saved drivers right now: " + err.message,
        icon: "heart"
      })}</section>`;
    }
  },

  async loadNotificationsPage(filter = "all") {
    const container = document.getElementById("notifications-board");
    if (!container) return;

    const categoryTypes = {
      request: ["bid_received", "bid_accepted", "bid_rejected"],
      booking: ["booking_confirmed", "booking_status_changed", "driver_en_route", "driver_arrived", "journey_started", "journey_completed", "booking", "trip"],
      message: ["new_message", "message"],
      payment: ["payment", "wallet", "subscription"]
    };
    const matches = (notification) => {
      if (filter === "all") return true;
      const types = categoryTypes[filter];
      if (!types) return notification.type === filter;
      return types.includes(notification.type);
    };
    const iconFor = (type) => {
      if (type === "new_message" || type === "message") return "chat";
      if (type === "payment" || type === "wallet" || type === "subscription") return "wallet";
      if (["booking_confirmed", "booking_status_changed", "driver_en_route", "driver_arrived", "journey_started", "journey_completed"].includes(type)) return "calendar";
      return "bus";
    };

    try {
      const profile = await AuthService.getCurrentProfile();
      const notifications = profile?.id ? await NotificationService.getNotifications(profile.id) : [];
      const filtered = (notifications || []).filter(matches);
      if (!filtered.length) {
        container.innerHTML = `<section class="passenger-list-card">${renderEmptyState({ title: "No notifications", description: "Updates matching this category will appear here.", icon: "inbox" })}</section>`;
        return;
      }

      container.innerHTML = `<section class="passenger-list-card notification-list">${filtered.map((notification) => `
        <button type="button" class="notification-row ${notification.is_read ? "" : "unread"}" data-notification-id="${notification.id}">
          <span class="notification-icon ${notification.type || "general"}">${passengerIcon(iconFor(notification.type), 20)}</span>
          <span><strong>${escapeHtml(notification.title)}</strong><small>${escapeHtml(notification.body)}</small></span>
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
      if (banner) banner.innerHTML = `${icon("map-pin", 16)}<span>Click anywhere on the map to set PICKUP location</span>`;
      mapEl?.classList.add("selecting-mode");
    } else if (mode === "destination") {
      if (banner) banner.innerHTML = `${icon("flag", 16)}<span>Click anywhere on the map to set DROP-OFF DESTINATION</span>`;
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
    this._lastCalculatedRouteKey = null;
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
      .bindPopup(`${icon("map-pin", 16)} Pickup Location`);

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
      .bindPopup(`${icon("flag", 16)} Drop-off Destination`);

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

    const routeKey = `${Number(this.pickupCoords.lat).toFixed(4)},${Number(this.pickupCoords.lng).toFixed(4)}->${Number(this.destCoords.lat).toFixed(4)},${Number(this.destCoords.lng).toFixed(4)}`;
    if (this._lastCalculatedRouteKey === routeKey && this.routePolyline && this.distanceKm) {
      return; // Already drawn with identical coordinates
    }

    if (this.routePolyline) {
      this.mapInstance.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }

    const routeData = await LocationService.calculateRoute(
      this.pickupCoords.lat,
      this.pickupCoords.lng,
      this.destCoords.lat,
      this.destCoords.lng
    );

    if (routeData && routeData.distanceKm) {
      this.distanceKm = routeData.distanceKm;
      this.durationMins = routeData.durationMins;
      this._lastCalculatedRouteKey = routeKey;

      const polylineCoords = routeData.source === "osrm"
        ? routeData.coordinates
        : [
            [this.pickupCoords.lat, this.pickupCoords.lng],
            [this.destCoords.lat, this.destCoords.lng]
          ];

      this.routePolyline = window.L.polyline(polylineCoords, {
        color: routeData.source === "osrm" ? "#0284c7" : "#059669",
        weight: routeData.source === "osrm" ? 5 : 4,
        dashArray: routeData.source === "osrm" ? null : "8, 8",
        opacity: 0.85,
        lineJoin: "round"
      }).addTo(this.mapInstance);

      this.mapInstance.fitBounds(this.routePolyline.getBounds(), { padding: [50, 50] });
      this.updateDistanceUI(`${routeData.distanceKm} km (~${routeData.durationMins} mins)`);
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
    const pickupVal = document.getElementById("req-pickup")?.value?.trim();
    const destVal = document.getElementById("req-dest")?.value?.trim();

    const isValid = Boolean(pickupVal && destVal && priceVal > 0);

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

    const renderSuggestions = (results) => {
      if (!results || results.length === 0) {
        dropdown.style.display = "none";
        dropdown.innerHTML = "";
        return;
      }

      dropdown.innerHTML = results.map((item) => `
        <div class="address-suggestion-item" data-lat="${item.lat}" data-lng="${item.lng}" data-address="${item.address.replace(/"/g, '&quot;')}">
                  ${icon("map-pin", 15)}<span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem;">${item.address}</span>
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
    };

    input.addEventListener("input", (e) => {
      clearTimeout(timeout);
      const query = e.target.value.trim();

      if (query.length < 2) {
        dropdown.style.display = "none";
        dropdown.innerHTML = "";
        return;
      }

      // Check instant in-memory cache first
      const cached = LocationService.searchAddressFromCache(query);
      if (cached && cached.length > 0) {
        renderSuggestions(cached);
        return;
      }

      // 400ms debounce for network searches
      timeout = setTimeout(async () => {
        const results = await LocationService.searchAddress(query);
        renderSuggestions(results);
      }, 400);
    });

    document.addEventListener("click", (evt) => {
      if (!input.contains(evt.target) && !dropdown.contains(evt.target)) {
        dropdown.style.display = "none";
      }
    });
  },

  repeatRequest(booking) {
    if (!booking) return;
    const pickup = booking.request?.pickup_location || booking.pickup_address || "";
    const dest = booking.request?.destination || booking.destination_address || "";
    const serviceType = booking.request?.service_type || "ride";
    const budget = booking.amount || booking.request?.budget || 0;

    const pickupInput = document.getElementById("req-pickup");
    const destInput = document.getElementById("req-dest");
    const serviceSelect = document.getElementById("req-service-type");
    const priceInput = document.getElementById("req-suggested-price");

    if (pickupInput) pickupInput.value = pickup;
    if (destInput) destInput.value = dest;
    if (serviceSelect) {
      serviceSelect.value = serviceType;
      serviceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (priceInput) priceInput.value = budget;

    this.switchTab("new-request");
    this.validateForm();
    NotificationService.showToast("Trip Details Prefilled", "You can review route and submit your new request.", "info");
  },

  async loadSavedAddressChips() {
    const pickupChipsContainer = document.getElementById("saved-pickup-chips");
    const destChipsContainer = document.getElementById("saved-dest-chips");
    if (!pickupChipsContainer && !destChipsContainer) return;

    try {
      const addresses = await AddressService.getSavedAddresses();
      if (!addresses || addresses.length === 0) {
        if (pickupChipsContainer) {
          pickupChipsContainer.innerHTML = `<span style="font-size: 0.75rem; color: #94a3b8;">Tip: Save favorite addresses for 1-click entry.</span>`;
        }
        return;
      }

      const getIcon = (label) => {
        const l = (label || "").toLowerCase();
        if (l === "home") return icon("house", 15);
        if (l === "work") return icon("building-2", 15);
        if (l === "school") return icon("school", 15);
        return icon("map-pin", 15);
      };

      const renderChips = () => {
        return addresses.map((addr) => `
          <button type="button" class="saved-address-chip" data-addr-lat="${addr.lat || ''}" data-addr-lng="${addr.lng || ''}" data-addr-text="${escapeHtml(addr.address || addr.title)}" title="${escapeHtml(addr.address)}">
            <span>${getIcon(addr.label)}</span>
            <span>${escapeHtml(addr.title || addr.label)}</span>
          </button>
        `).join("");
      };

      if (pickupChipsContainer) {
        pickupChipsContainer.innerHTML = renderChips();
        pickupChipsContainer.querySelectorAll(".saved-address-chip").forEach((chip) => {
          chip.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const text = btn.getAttribute("data-addr-text");
            const lat = parseFloat(btn.getAttribute("data-addr-lat"));
            const lng = parseFloat(btn.getAttribute("data-addr-lng"));
            const input = document.getElementById("req-pickup");
            if (input) input.value = text;
            if (!isNaN(lat) && !isNaN(lng)) {
              await this.setPickup(lat, lng, text);
            } else {
              this.validateForm();
            }
          });
        });
      }

      if (destChipsContainer) {
        destChipsContainer.innerHTML = renderChips();
        destChipsContainer.querySelectorAll(".saved-address-chip").forEach((chip) => {
          chip.addEventListener("click", async (e) => {
            const btn = e.currentTarget;
            const text = btn.getAttribute("data-addr-text");
            const lat = parseFloat(btn.getAttribute("data-addr-lat"));
            const lng = parseFloat(btn.getAttribute("data-addr-lng"));
            const input = document.getElementById("req-dest");
            if (input) input.value = text;
            if (!isNaN(lat) && !isNaN(lng)) {
              await this.setDestination(lat, lng, text);
            } else {
              this.validateForm();
            }
          });
        });
      }
    } catch (err) {
      console.warn("Saved address chips notice:", err.message);
    }
  },

  async openRequestMatchingExperience(request) {
    if (!request) return;
    const requestId = request.id || request.$id;
    this.matchingRequestId = requestId;

    if (this.matchingPollInterval) {
      clearInterval(this.matchingPollInterval);
      this.matchingPollInterval = null;
    }

    const oldModal = document.getElementById("matching-experience-modal");
    if (oldModal) oldModal.remove();

    const pickup = escapeHtml(request.pickup_location || request.pickup_address || "Pickup");
    const dest = escapeHtml(request.destination || request.destination_address || "Destination");
    const budget = Number.parseFloat(request.budget || request.suggested_price || 0);

    let onlineCount = 0;
    try {
      onlineCount = await RequestService.getCompatibleOnlineProvidersCount(request.service_type || "ride");
    } catch (_) {
      onlineCount = 0;
    }

    const providerStatusText = onlineCount > 0
        ? `${icon("circle-dot", 15)} ${onlineCount} compatible driver${onlineCount === 1 ? "" : "s"} nearby`
      : `Looking for nearby drivers…`;

    SmartPopup.open({
      userId: this.getPopupUserId(),
      flowKey: `passenger-request:${requestId}`,
      state: "waiting",
      eyebrow: "Trip request",
      title: "Finding nearby drivers",
      minimizable: true,
      pillText: `Searching • ${pickup} → ${dest}`,
      html: `
        <div class="smart-sheet-route-flow">
          <div class="smart-sheet-stop">
            <span class="smart-sheet-dot"></span>
            <strong class="smart-sheet-location-name">${pickup}</strong>
          </div>
          <div class="smart-sheet-arrow-connector">↓</div>
          <div class="smart-sheet-stop">
            <span class="smart-sheet-dot smart-sheet-dot--dest"></span>
            <strong class="smart-sheet-location-name">${dest}</strong>
          </div>
        </div>
        ${budget > 0 ? `
          <div class="smart-sheet-budget-card">
            <span>Your budget</span>
            <strong>$${budget.toFixed(2)}</strong>
          </div>
        ` : ""}
        <div class="smart-sheet-status-box" style="padding: 1.25rem 0 0.5rem;">
          <div class="smart-popup-spinner" style="margin: 0 auto 0.75rem; width: 32px; height: 32px; border: 3px solid rgba(16,185,129,0.2); border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <h4 style="margin: 0 0 0.25rem; font-size: 1.05rem; font-weight: 800; color: var(--text-main);">Looking for drivers…</h4>
          <p class="smart-sheet-waiting-text" style="margin: 0; font-size: 0.88rem;">${providerStatusText}</p>
        </div>
      `,
      actions: [
        {
          label: "Cancel request",
          danger: true,
          onClick: async () => {
            if (!confirm("Are you sure you want to cancel this request?")) return;
            try {
              await RequestService.cancelRequest(requestId);
              if (this.matchingPollInterval) {
                clearInterval(this.matchingPollInterval);
                this.matchingPollInterval = null;
              }
              this.matchingRequestId = null;
              SmartPopup.close();
              NotificationService.showToast("Request cancelled", "Your request has been withdrawn.", "info");
              this.switchTab("overview");
            } catch (err) {
              alert("Could not cancel request: " + err.message);
            }
          }
        }
      ]
    });

    let matchingPollBusy = false;
    const checkBids = async () => {
      if (matchingPollBusy || this.matchingRequestId !== requestId) return;
      matchingPollBusy = true;
      try {
        const [bidResult, bookings, currentRequests] = await Promise.all([
          BidService.getBidsForRequest(requestId),
          BookingService.getPassengerBookings(),
          RequestService.getCustomerRequests()
        ]);
        const booking = (bookings || []).find((item) => item.request_id === requestId);
        if (booking) {
          if (this.matchingPollInterval) {
            clearInterval(this.matchingPollInterval);
            this.matchingPollInterval = null;
          }
          this.matchingRequestId = null;
          this.showDriverConfirmedPopup(booking, { force: true });
          return;
        }

        const currentRequest = (currentRequests || []).find((item) => (item.id || item.$id) === requestId);
        if (currentRequest?.status === "cancelled") {
          if (this.matchingPollInterval) {
            clearInterval(this.matchingPollInterval);
            this.matchingPollInterval = null;
          }
          this.matchingRequestId = null;
          SmartPopup.close();
          this.switchTab("overview");
          return;
        }

        const bids = Array.isArray(bidResult) ? bidResult : (bidResult?.bids || []);
        const pendingBids = bids.filter((bid) => bid.status === "pending");

        if (pendingBids.length > 0) {
          // In-place transition from waiting sheet directly to offers sheet
          this.showQuotationPopup(pendingBids[0], false, { force: true });
        }
      } catch (err) {
        console.warn("Matching quotes poll notice:", err.message);
      } finally {
        matchingPollBusy = false;
      }
    };

    await checkBids();
    if (this.matchingRequestId === requestId) {
      this.matchingPollInterval = setInterval(() => {
        checkBids().catch(() => {});
      }, 4000);
    }
    this.scheduleJourneySync(0);
  }
};
