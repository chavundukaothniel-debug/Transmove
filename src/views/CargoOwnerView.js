// ==============================================================================
// TRANSMOVE CARGO OWNER DASHBOARD VIEW
// Dedicated dashboard for cargo owners to request goods transport & track freight
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { LocationService } from "../services/location.js";
import { AdPlacement } from "../components/AdPlacement.js";

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
    await this.loadCargoData();
    AdPlacement.init("CARGO_OWNER_DASHBOARD");
  },

  bindEvents() {
    const navButtons = document.querySelectorAll(".cargo-nav-btn");
    navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        navButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        document.querySelectorAll(".cargo-tab-content").forEach(el => el.style.display = "none");
        if (tab === "create") {
          document.getElementById("tab-sec-create").style.display = "block";
        } else {
          document.getElementById("tab-sec-overview").style.display = "block";
        }
      });
    });

    document.getElementById("btn-tab-create-cargo")?.addEventListener("click", () => {
      document.querySelector('[data-tab="create"]')?.click();
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
        const budget = parseFloat(document.getElementById("crg-budget").value);
        const weight = parseFloat(document.getElementById("crg-weight").value);
        const cargoType = document.getElementById("crg-type").value;
        const vehicleType = document.getElementById("crg-vehicle").value;
        const dimensions = document.getElementById("crg-dimensions").value.trim();
        const notes = document.getElementById("crg-notes").value.trim();

        // Geocode addresses safely via LocationService
        const pickupCoords = await LocationService.geocode(pickupAddr) || { lat: -17.8292, lng: 31.0522 };
        const destCoords = await LocationService.geocode(destAddr) || { lat: -17.8500, lng: 31.0800 };

        await RequestService.createRequest({
          requestType: "logistics",
          pickupAddress: pickupAddr,
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          destinationAddress: destAddr,
          destLat: destCoords.lat,
          destLng: destCoords.lng,
          suggestedPrice: budget,
          requestedVehicleType: vehicleType,
          loadDescription: `[${cargoType.toUpperCase()}] ${notes}`,
          loadWeightKg: weight,
          loadDimensions: dimensions
        });

        alert("Cargo transport request posted successfully! Logistics operators can now submit bids.");
        document.getElementById("cargo-request-form").reset();
        document.querySelector('[data-tab="overview"]')?.click();
        await this.loadCargoData();
      } catch (err) {
        alert("Could not post cargo request: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Post Cargo Transport Request 📦";
      }
    });
  },

  async loadCargoData() {
    const container = document.getElementById("cargo-requests-list");
    if (!container) return;

    try {
      const requests = await RequestService.getCustomerRequests();
      const cargoRequests = requests ? requests.filter(r => r.request_type === "logistics") : [];

      // Update KPI widgets with real numbers
      document.getElementById("kpi-active-deliveries").innerText = cargoRequests.filter(r => ["accepted", "in_progress", "driver_arriving"].includes(r.status)).length;
      document.getElementById("kpi-pending-cargo").innerText = cargoRequests.filter(r => ["searching", "offers_received", "negotiating"].includes(r.status)).length;
      document.getElementById("kpi-completed-cargo").innerText = cargoRequests.filter(r => r.status === "completed").length;

      if (!cargoRequests || cargoRequests.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No cargo transport requests yet",
          description: "Create your first cargo request to receive competitive bids from verified logistics providers across Zimbabwe.",
          icon: "box"
        });
        return;
      }

      container.innerHTML = cargoRequests.map(r => `
        <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem; background: var(--bg-card);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="badge badge-info" style="font-size: 0.75rem;">FREIGHT REQUEST</span>
              <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0.35rem 0 0.15rem 0;">${r.load_description || "Commercial Freight Cargo"}</h4>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                📍 <strong>Pickup:</strong> ${r.pickup_address} &rarr; 📍 <strong>Destination:</strong> ${r.destination_address}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">$${r.suggested_price}</div>
              <span class="badge ${r.status === "completed" ? "badge-success" : r.status === "accepted" ? "badge-info" : "badge-warning"}">
                ${r.status.toUpperCase()}
              </span>
            </div>
          </div>
          ${r.load_weight_kg ? `
            <div style="margin-top: 0.75rem; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-hover); padding: 0.5rem 0.75rem; border-radius: 4px; display: flex; gap: 1rem;">
              <span>⚖️ Weight: <strong>${r.load_weight_kg} kg</strong></span>
              ${r.load_dimensions ? `<span>📏 Dimensions: <strong>${r.load_dimensions}</strong></span>` : ""}
            </div>
          ` : ""}
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "No cargo records",
        description: "Post a freight request to load records from Supabase.",
        icon: "box"
      });
    }
  }
};
