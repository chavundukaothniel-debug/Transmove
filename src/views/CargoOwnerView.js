// ==============================================================================
// TRANSMOVE CARGO OWNER DASHBOARD VIEW
// Dedicated dashboard for cargo owners to request goods transport & track freight
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { BidService, BookingService } from "../services/bids.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { LocationService } from "../services/location.js";
import { AdPlacement } from "../components/AdPlacement.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Only #tab-sec-create and #tab-sec-overview exist, so every nav/sidebar tab resolves onto one of them.
const CARGO_TAB_SECTIONS = {
  overview: "overview",
  create: "create",
  requests: "overview",
  deliveries: "overview",
  history: "overview",
  payments: "overview",
  offers: "overview",
  invoices: "overview",
  ratings: "overview"
};

const CARGO_TYPE_LABELS = {
  general_freight: "General Freight",
  agricultural: "Agricultural Produce",
  construction: "Construction Materials",
  containerized: "Containerized Cargo",
  perishable: "Perishable Goods",
  heavy_equipment: "Machinery / Heavy Items"
};

const OPEN_REQUEST_STATUSES = ["open_for_bids", "bids_received"];
const ACTIVE_BOOKING_STATUSES = ["confirmed", "driver_arriving", "in_progress"];

const humaniseEnum = (value) => {
  const key = String(value || "").trim();
  if (!key) return "";
  return CARGO_TYPE_LABELS[key] || key.replace(/_/g, " ");
};

const formatMoney = (value) => `$${(Number.parseFloat(value) || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const friendlyError = (err, fallback) => {
  console.warn(`${fallback}:`, err);
  const raw = String(err?.message || "").trim();
  if (!raw || /https?:\/\/|stack|api[_ -]?key|jwt|bearer|undefined|fetch failed/i.test(raw)) {
    return `${fallback}. Please try again.`;
  }
  return `${fallback}: ${raw}`;
};

export const CargoOwnerView = {
  activeTab: "overview",
  
  async render() {
    return `
      <div class="cargo-owner-dashboard container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-info" style="font-size: 0.75rem;">CARGO OWNER</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Real-time Freight &amp; Goods Logistics</span>
              </div>
              <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0;">Manage your cargo and freight deliveries</h1>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">Request commercial freight, receive bids from logistics providers, and track active cargo.</p>
            </div>
            <div>
              <button id="btn-tab-create-cargo" class="btn btn-primary">
                📦 Create Cargo Request
              </button>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">ACTIVE DELIVERIES</div>
            <div id="kpi-active-deliveries" style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">En-route or dispatched</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">PENDING REQUESTS</div>
            <div id="kpi-pending-cargo" style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Awaiting bids</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">OFFERS RECEIVED</div>
            <div id="kpi-offers-received" style="font-size: 1.6rem; font-weight: 800; color: #3b82f6; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Provider bids</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">COMPLETED DELIVERIES</div>
            <div id="kpi-completed-cargo" style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Successful freight</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">TOTAL SPENT</div>
            <div id="kpi-total-spent" style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">$0.00</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Verified payments</div>
          </div>
        </div>

        ${AdPlacement.renderContainer("CARGO_OWNER_DASHBOARD")}

        <!-- Dashboard Workspace Grid -->
        <div class="grid-3" style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem;">
          <!-- Left Navigation Sidebar -->
          <div class="card" style="padding: 1rem;">
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.05em;">
              Cargo Navigation
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.35rem;" id="cargo-nav-menu">
              <button data-tab="overview" class="btn btn-outline cargo-nav-btn active" style="justify-content: flex-start; text-align: left;">
                📊 Dashboard
              </button>
              <button data-tab="create" class="btn btn-outline cargo-nav-btn" style="justify-content: flex-start; text-align: left;">
                ➕ Create Cargo Request
              </button>
              <button data-tab="requests" class="btn btn-outline cargo-nav-btn" style="justify-content: flex-start; text-align: left;">
                📦 My Cargo Requests
              </button>
              <button data-tab="deliveries" class="btn btn-outline cargo-nav-btn" style="justify-content: flex-start; text-align: left;">
                🚚 Active Deliveries
              </button>
              <button data-tab="history" class="btn btn-outline cargo-nav-btn" style="justify-content: flex-start; text-align: left;">
                📜 Delivery History
              </button>
              <button data-tab="payments" class="btn btn-outline cargo-nav-btn" style="justify-content: flex-start; text-align: left;">
                💳 Payments &amp; Invoices
              </button>
              <a href="#messages" class="btn btn-outline" style="justify-content: flex-start; text-align: left;">
                💬 Messages
              </a>
              <a href="#support" class="btn btn-outline" style="justify-content: flex-start; text-align: left;">
                🎧 Support
              </a>
            </div>
          </div>

          <!-- Main Content Pane -->
          <div>
            <!-- Create Cargo Form Tab -->
            <div id="tab-sec-create" class="card cargo-tab-content" style="display: none;">
              <h3 style="font-weight: 800; font-size: 1.25rem; margin-bottom: 1.25rem;">📦 Create New Cargo Transport Request</h3>
              <form id="cargo-request-form">
                <div class="grid-2">
                  <div class="form-group">
                    <label class="form-label">Pickup Location &amp; Address</label>
                    <input type="text" id="crg-pickup" class="form-input" placeholder="e.g. 15 Workington Ave, Harare" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Destination Address</label>
                    <input type="text" id="crg-dest" class="form-input" placeholder="e.g. Belmont Industrial Area, Bulawayo" required />
                  </div>
                </div>

                <div class="grid-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label">Cargo Type</label>
                    <select id="crg-type" class="form-select" required>
                      <option value="general_freight">General Freight</option>
                      <option value="agricultural">Agricultural Produce</option>
                      <option value="construction">Construction Materials</option>
                      <option value="containerized">Containerized Cargo</option>
                      <option value="perishable">Perishable Goods</option>
                      <option value="heavy_equipment">Machinery / Heavy Items</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Estimated Weight (kg)</label>
                    <input type="number" id="crg-weight" class="form-input" placeholder="e.g. 5000" min="10" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label">Cargo Dimensions (L x W x H)</label>
                    <input type="text" id="crg-dimensions" class="form-input" placeholder="e.g. 4m x 2m x 2m" />
                  </div>
                </div>

                <div class="grid-2">
                  <div class="form-group">
                    <label class="form-label">Vehicle Required</label>
                    <select id="crg-vehicle" class="form-select" required>
                      <option value="3_ton_truck">3-Tonne Light Truck</option>
                      <option value="7_ton_truck">7-Tonne Rigid Truck</option>
                      <option value="10_ton_truck">10-Tonne Freight Truck</option>
                      <option value="30_ton_horse">30-Tonne Horse &amp; Trailer</option>
                      <option value="refrigerated">Refrigerated Truck</option>
                      <option value="flatbed">Flatbed Trailer</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Target Budget ($ USD)</label>
                    <input type="number" id="crg-budget" class="form-input" placeholder="e.g. 350" min="5" step="5" required />
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Special Loading Requirements &amp; Instructions</label>
                  <textarea id="crg-notes" class="form-textarea" rows="3" placeholder="Specify crane assistance required, tarpaulin cover, fragile handling instructions..."></textarea>
                </div>

                <button type="submit" id="btn-submit-cargo" class="btn btn-primary btn-full">
                  Post Cargo Transport Request 📦
                </button>
              </form>
            </div>

            <!-- Requests & Overview Tab -->
            <div id="tab-sec-overview" class="cargo-tab-content">
              <div class="card" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                  <h3 style="font-weight: 800; font-size: 1.1rem; margin: 0;">Active Freight &amp; Cargo Requests</h3>
                  <button id="btn-refresh-cargo" class="btn btn-outline btn-sm">🔄 Refresh</button>
                </div>
                <div id="cargo-requests-list">
                  <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                    Loading cargo requests from database...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this.bindEvents();

    const hashParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const requestedTab = hashParams.get("tab");
    this.switchTab(CARGO_TAB_SECTIONS[requestedTab] ? requestedTab : "overview");

    await this.loadCargoData();
    AdPlacement.init("CARGO_OWNER_DASHBOARD");
  },

  switchTab(tab) {
    const section = CARGO_TAB_SECTIONS[tab] || "overview";
    this.activeTab = section;

    const navButtons = Array.from(document.querySelectorAll(".cargo-nav-btn"));
    const hasOwnButton = navButtons.some(btn => btn.dataset.tab === tab);
    const highlighted = hasOwnButton ? tab : section;
    navButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === highlighted));

    document.querySelectorAll(".cargo-tab-content").forEach(el => { el.style.display = "none"; });
    const target = document.getElementById(section === "create" ? "tab-sec-create" : "tab-sec-overview");
    if (target) target.style.display = "block";
  },

  setKpi(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  },

  bindEvents() {
    document.querySelectorAll(".cargo-nav-btn").forEach(btn => {
      btn.addEventListener("click", () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById("btn-tab-create-cargo")?.addEventListener("click", () => {
      this.switchTab("create");
    });

    document.getElementById("btn-refresh-cargo")?.addEventListener("click", () => {
      this.loadCargoData();
    });

    document.getElementById("cargo-request-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-cargo");
      submitBtn.disabled = true;
      submitBtn.innerText = "Posting Cargo Request...";

      try {
        const pickupAddr = document.getElementById("crg-pickup").value.trim();
        const destAddr = document.getElementById("crg-dest").value.trim();
        const budget = Number.parseFloat(document.getElementById("crg-budget").value);
        const weight = Number.parseFloat(document.getElementById("crg-weight").value);
        const cargoType = document.getElementById("crg-type").value;
        const vehicleType = document.getElementById("crg-vehicle").value;
        const dimensions = document.getElementById("crg-dimensions").value.trim();
        const notes = document.getElementById("crg-notes").value.trim();

        if (!pickupAddr || !destAddr) throw new Error("Both pickup and destination addresses are required.");
        if (!Number.isFinite(budget) || budget <= 0) throw new Error("A target budget is required.");

        const routeEstimate = await this.estimateRoute(pickupAddr, destAddr);

        const details = [
          `Vehicle required: ${humaniseEnum(vehicleType) || vehicleType}`,
          Number.isFinite(weight) ? `Estimated weight: ${weight} kg` : "",
          dimensions ? `Dimensions: ${dimensions}` : "",
          notes,
          routeEstimate
        ].filter(Boolean).join(" · ");

        await RequestService.createRequest({
          service_type: "logistics",
          pickup_location: pickupAddr,
          destination: destAddr,
          request_date: null,
          preferred_time: "",
          passenger_count: null,
          goods_type: cargoType,
          details,
          budget
        });

        alert("Cargo transport request posted successfully! Logistics operators can now submit bids.");
        document.getElementById("cargo-request-form").reset();
        this.switchTab("overview");
        await this.loadCargoData();
      } catch (err) {
        alert(friendlyError(err, "Could not post your cargo request"));
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Post Cargo Transport Request 📦";
      }
    });
  },

  // Coordinates cannot be persisted (no lat/lng columns), so this only enriches `details` and never blocks submission.
  async estimateRoute(pickupAddr, destAddr) {
    try {
      const [pickupResults, destResults] = await Promise.all([
        LocationService.searchAddress(pickupAddr),
        LocationService.searchAddress(destAddr)
      ]);
      const from = pickupResults?.[0];
      const to = destResults?.[0];
      if (!from || !to) return "";

      const distanceKm = LocationService.calculateDistance(from.lat, from.lng, to.lat, to.lng);
      if (!distanceKm) return "";

      const minutes = LocationService.estimateDuration(distanceKm, "logistics");
      return minutes
        ? `Approx. distance: ${distanceKm} km · Est. transit: ${(minutes / 60).toFixed(1)} h`
        : `Approx. distance: ${distanceKm} km`;
    } catch (err) {
      console.warn("Cargo route estimate skipped:", err?.message || err);
      return "";
    }
  },

  async loadCargoData() {
    const container = document.getElementById("cargo-requests-list");
    if (!container) return;

    let cargoRequests = [];
    let bookings = [];
    let requestsFailed = false;

    try {
      const requests = (await RequestService.getCustomerRequests()) || [];
      cargoRequests = requests.filter(r => (r.service_type || r.request_type) === "logistics");
    } catch (err) {
      requestsFailed = true;
      console.warn("Cargo requests load failed:", err?.message || err);
    }

    try {
      const allBookings = (await BookingService.getUserBookings()) || [];
      bookings = allBookings.filter(b => b.request?.service_type === "logistics");
    } catch (err) {
      console.warn("Cargo bookings load failed:", err?.message || err);
    }

    const bidTotals = await Promise.all(cargoRequests.map(async (r) => {
      try {
        const res = await BidService.getBidsForRequest(r.id);
        return Number(res?.total ?? res?.bids?.length ?? 0) || 0;
      } catch (err) {
        console.warn(`Bid count unavailable for request ${r.id}:`, err?.message || err);
        return 0;
      }
    }));

    const activeIds = new Set();
    cargoRequests.filter(r => r.status === "accepted").forEach(r => activeIds.add(r.id));
    bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status)).forEach(b => activeIds.add(b.request_id || b.id));

    const completedIds = new Set();
    cargoRequests.filter(r => r.status === "completed").forEach(r => completedIds.add(r.id));
    const completedBookings = bookings.filter(b => b.status === "completed");
    completedBookings.forEach(b => completedIds.add(b.request_id || b.id));

    const totalSpent = completedBookings.reduce((sum, b) => sum + (Number.parseFloat(b.amount) || 0), 0);

    this.setKpi("kpi-active-deliveries", activeIds.size);
    this.setKpi("kpi-pending-cargo", cargoRequests.filter(r => OPEN_REQUEST_STATUSES.includes(r.status)).length);
    this.setKpi("kpi-offers-received", bidTotals.reduce((sum, n) => sum + n, 0));
    this.setKpi("kpi-completed-cargo", completedIds.size);
    const spentEl = document.getElementById("kpi-total-spent");
    if (spentEl) spentEl.innerText = formatMoney(totalSpent);

    if (requestsFailed) {
      container.innerHTML = renderEmptyState({
        title: "Could not load your cargo requests",
        description: "We could not reach your freight records just now. Use Refresh to try again.",
        icon: "truck"
      });
      return;
    }

    if (cargoRequests.length === 0) {
      container.innerHTML = renderEmptyState({
        title: "No cargo transport requests yet",
        description: "Create your first cargo request to receive competitive bids from verified logistics providers across Zimbabwe.",
        icon: "box"
      });
      return;
    }

    container.innerHTML = cargoRequests.map(r => {
      const status = String(r.status || "open_for_bids");
      const badgeClass = status === "completed"
        ? "badge-success"
        : status === "cancelled"
          ? "badge-danger"
          : status === "accepted"
            ? "badge-info"
            : "badge-warning";
      const budget = Number.parseFloat(r.budget ?? r.suggested_price);
      const cargoLabel = humaniseEnum(r.goods_type);
      const details = String(r.details || r.load_description || "").trim();
      const detailsText = details.length > 160 ? `${details.slice(0, 157)}…` : details;
      const requestedOn = formatDate(r.request_date || r.created_at);

      return `
        <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="badge badge-info" style="font-size: 0.75rem;">FREIGHT REQUEST</span>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0.35rem 0 0.15rem 0;">${escapeHtml(cargoLabel || "Commercial Freight Cargo")}</h4>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                📍 <strong>Pickup:</strong> ${escapeHtml(r.pickup_location || r.pickup_address)} &rarr; 📍 <strong>Destination:</strong> ${escapeHtml(r.destination || r.destination_address)}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${formatMoney(budget)}</div>
              <span class="badge ${badgeClass}">
                ${escapeHtml(status.replace(/_/g, " ").toUpperCase())}
              </span>
            </div>
          </div>
          ${detailsText || requestedOn ? `
            <div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-hover); padding: 0.5rem 0.75rem; border-radius: 4px; display: flex; gap: 1rem;">
              ${detailsText ? `<span>📋 ${escapeHtml(detailsText)}</span>` : ""}
              ${requestedOn ? `<span>📅 Posted: <strong>${escapeHtml(requestedOn)}</strong></span>` : ""}
            </div>
          ` : ""}
        </div>
      `;
    }).join("");
  }
};
