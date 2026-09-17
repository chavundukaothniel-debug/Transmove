// ==============================================================================
// TRANSMOVE LOGISTICS PROVIDER & TRANSPORT OPERATOR VIEW
// Dedicated dashboard for fleet operators and commercial freight providers
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { BidService, BookingService } from "../services/bids.js";
import { VehicleService } from "../services/vehicles.js";
import { renderEmptyState } from "../components/EmptyState.js";
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

// This dashboard only has two panels, so sidebar tabs resolve onto one of them.
const LOGISTICS_TAB_PANELS = {
  cargo: "available-cargo-jobs-list",
  deliveries: "my-logistics-offers-list"
};
const DEFAULT_LOGISTICS_PANEL = "available-cargo-jobs-list";

const LOGISTICS_VEHICLE_CATEGORIES = ["heavy_goods", "light_goods", "courier_express", "general_transport"];
const ACTIVE_BOOKING_STATUSES = ["confirmed", "driver_arriving", "in_progress"];

const formatMoney = (value) => `$${(Number.parseFloat(value) || 0).toFixed(2)}`;

const isSameDay = (value, reference) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate();
};

const friendlyError = (err, fallback) => {
  console.warn(`${fallback}:`, err);
  const raw = String(err?.message || "").trim();
  if (!raw || /https?:\/\/|stack|api[_ -]?key|jwt|bearer|undefined|fetch failed/i.test(raw)) {
    return `${fallback}. Please try again.`;
  }
  return `${fallback}: ${raw}`;
};

export const LogisticsView = {
  activePanel: null,

  async render() {
    return `
      <div class="logistics-dashboard container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: #ffffff;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-success" style="font-size: 0.75rem;">LOGISTICS OPERATOR</span>
                <span style="font-size: 0.85rem; color: #94a3b8;">Fleet Operations &amp; Commercial Transport</span>
              </div>
              <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0; color: #ffffff;">Manage your transport operations</h1>
              <p style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem;">Bid on commercial cargo, dispatch approved drivers, and manage haulage fleet revenue.</p>
            </div>
            <div>
              <button id="btn-refresh-logistics" class="btn btn-primary btn-sm">
                🔄 Sync Live Cargo Jobs
              </button>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">AVAILABLE CARGO</div>
            <div id="kpi-available-cargo" style="font-size: 1.6rem; font-weight: 800; color: #3b82f6; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Open freight jobs</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PENDING OFFERS</div>
            <div id="kpi-pending-bids" style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Submitted bids</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">ACTIVE DELIVERIES</div>
            <div id="kpi-active-hauls" style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Dispatched freights</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">TODAY'S REVENUE</div>
            <div id="kpi-today-revenue" style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">$0.00</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Verified earnings</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">FLEET SIZE</div>
            <div id="kpi-fleet-count" style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Registered trucks</div>
          </div>
        </div>

        ${AdPlacement.renderContainer("LOGISTICS_DASHBOARD")}

        <!-- Dashboard Layout -->
        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Available Commercial Cargo Jobs -->
          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
              <span>📦 Available Cargo Jobs</span>
              <span class="badge badge-info" style="font-weight: 600;">LIVE MARKET</span>
            </h3>
            <div id="available-cargo-jobs-list">
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                Searching for open freight jobs...
              </div>
            </div>
          </div>

          <!-- My Bids & Active Dispatch -->
          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1rem;">
              🚚 Active Freight Dispatches &amp; Offers
            </h3>
            <div id="my-logistics-offers-list">
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                Loading active dispatches...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    const hashParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const requestedTab = hashParams.get("tab");
    this.activePanel = requestedTab
      ? (LOGISTICS_TAB_PANELS[requestedTab] || DEFAULT_LOGISTICS_PANEL)
      : null;

    document.getElementById("btn-refresh-logistics")?.addEventListener("click", () => {
      this.loadLogisticsData();
    });

    await this.loadLogisticsData();
    this.focusActivePanel();
    AdPlacement.init("LOGISTICS_DASHBOARD");
  },

  focusActivePanel() {
    if (!this.activePanel || this.activePanel === DEFAULT_LOGISTICS_PANEL) return;
    document.getElementById(this.activePanel)?.closest(".card")?.scrollIntoView({ block: "start" });
  },

  setKpi(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  },

  async loadLogisticsData() {
    const jobsContainer = document.getElementById("available-cargo-jobs-list");
    const offersContainer = document.getElementById("my-logistics-offers-list");
    if (!jobsContainer || !offersContainer) return;

    await Promise.all([
      this.loadAvailableJobs(jobsContainer),
      this.loadMyBids(offersContainer),
      this.loadFleetStats()
    ]);
  },

  async loadAvailableJobs(container) {
    try {
      const available = (await RequestService.getAvailableRequestsForDrivers()) || [];
      const cargoJobs = available.filter(r => (r.service_type || r.request_type) === "logistics");

      this.setKpi("kpi-available-cargo", cargoJobs.length);

      if (cargoJobs.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No available cargo jobs right now",
          description: "When cargo owners and companies post freight requests, they will appear here in real-time for your fleet to bid on.",
          icon: "box"
        });
        return;
      }

      container.innerHTML = cargoJobs.map(job => {
        const budget = Number.parseFloat(job.budget ?? job.suggested_price) || 0;
        const summary = String(job.details || job.load_description || "").trim();
        const title = summary.length > 110 ? `${summary.slice(0, 107)}…` : (summary || "Freight Deliveries");
        const goodsLabel = String(job.goods_type || "freight").replace(/_/g, " ").toUpperCase();

        return `
          <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; background: var(--bg-hover);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span class="badge badge-info" style="font-size: 0.7rem;">${escapeHtml(goodsLabel)}</span>
                <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.25rem 0;">${escapeHtml(title)}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                  📍 ${escapeHtml(job.pickup_location || job.pickup_address)} &rarr; 📍 ${escapeHtml(job.destination || job.destination_address)}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; color: var(--primary); font-size: 1.1rem;">${formatMoney(budget)}</div>
                <button class="btn btn-primary btn-sm btn-bid-cargo" data-id="${escapeHtml(job.id)}" data-price="${budget}" style="margin-top: 0.35rem; padding: 0.25rem 0.65rem; font-size: 0.75rem;">
                  Submit Bid 💬
                </button>
              </div>
            </div>
          </div>
        `;
      }).join("");

      container.querySelectorAll(".btn-bid-cargo").forEach(btn => {
        btn.addEventListener("click", () => this.handleBidClick(btn));
      });
    } catch (err) {
      console.warn("Available cargo load failed:", err?.message || err);
      container.innerHTML = renderEmptyState({
        title: "Could not load available cargo",
        description: "We could not reach the freight market just now. Use Sync Live Cargo Jobs to try again.",
        icon: "truck"
      });
    }
  },

  pickBidVehicle(vehicles) {
    const active = (Array.isArray(vehicles) ? vehicles : []).filter(v => (v.status || "active") === "active");
    return active.find(v => LOGISTICS_VEHICLE_CATEGORIES.includes(String(v.service_category || "").toLowerCase())) || active[0] || null;
  },

  async handleBidClick(btn) {
    const requestId = btn.dataset.id;
    const rawPrice = prompt("Enter your freight bid for this cargo ($ USD):", btn.dataset.price);
    if (rawPrice === null) return;

    const amount = Number.parseFloat(String(rawPrice).trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Please enter a valid bid amount in USD.");
      return;
    }

    let vehicle = null;
    try {
      vehicle = this.pickBidVehicle(await VehicleService.getDriverVehicles());
    } catch (err) {
      console.warn("Vehicle lookup failed:", err?.message || err);
    }

    if (!vehicle) {
      alert("You need at least one active registered vehicle before you can bid on cargo. Register a vehicle first, then bid again.");
      return;
    }

    const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() || "registered vehicle";
    btn.disabled = true;

    try {
      await BidService.submitBid({
        requestId,
        vehicleId: vehicle.id,
        proposedPrice: amount,
        message: `Bidding with ${vehicleLabel}${vehicle.registration_number ? ` · ${vehicle.registration_number}` : ""}`
      });
      alert("Freight bid submitted to the cargo owner.");
      await this.loadLogisticsData();
    } catch (err) {
      if (err?.subscriptionRequired) {
        alert("You have used all 5 free jobs. An active subscription is required to submit more bids.");
      } else {
        alert(friendlyError(err, "Could not submit your bid"));
      }
    } finally {
      btn.disabled = false;
    }
  },

  async loadMyBids(container) {
    try {
      const myBids = (await BidService.getDriverBids()) || [];
      this.setKpi("kpi-pending-bids", myBids.filter(b => b.status === "pending").length);

      if (myBids.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No active bids submitted",
          description: "Submit offers on available cargo jobs on the left panel to start winning haulage contracts.",
          icon: "truck"
        });
        return;
      }

      container.innerHTML = myBids.map(bid => {
        const request = bid.request || {};
        const route = [request.pickup_location, request.destination].filter(Boolean).join(" → ");
        const badgeClass = bid.status === "accepted"
          ? "badge-success"
          : bid.status === "rejected" || bid.status === "withdrawn"
            ? "badge-danger"
            : "badge-warning";

        return `
          <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">Bid Amount: ${formatMoney(bid.amount)}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(route || "Cargo job details unavailable")}</div>
              </div>
              <span class="badge ${badgeClass}">
                ${escapeHtml(String(bid.status || "pending").replace(/_/g, " ").toUpperCase())}
              </span>
            </div>
          </div>
        `;
      }).join("");
    } catch (err) {
      console.warn("Driver bids load failed:", err?.message || err);
      container.innerHTML = renderEmptyState({
        title: "Could not load your bids",
        description: "We could not reach your submitted bids just now. Use Sync Live Cargo Jobs to try again.",
        icon: "truck"
      });
    }
  },

  async loadFleetStats() {
    try {
      const vehicles = (await VehicleService.getDriverVehicles()) || [];
      this.setKpi("kpi-fleet-count", vehicles.length);
    } catch (err) {
      console.warn("Fleet count load failed:", err?.message || err);
    }

    try {
      const bookings = (await BookingService.getDriverBookings()) || [];
      this.setKpi("kpi-active-hauls", bookings.filter(b => ACTIVE_BOOKING_STATUSES.includes(b.status)).length);

      const today = new Date();
      const todayRevenue = bookings
        .filter(b => b.status === "completed" && isSameDay(b.completed_at || b.created_at, today))
        .reduce((sum, b) => sum + (Number.parseFloat(b.amount) || 0), 0);

      const revenueEl = document.getElementById("kpi-today-revenue");
      if (revenueEl) revenueEl.innerText = formatMoney(todayRevenue);
    } catch (err) {
      console.warn("Driver bookings load failed:", err?.message || err);
    }
  }
};
