// ==============================================================================
// TRANSMOVE LOGISTICS PROVIDER & TRANSPORT OPERATOR VIEW
// Dedicated dashboard for fleet operators and commercial freight providers
// ==============================================================================
import { RequestService } from "../services/requests.js";
import { OfferService } from "../services/offers.js";
import { VehicleService } from "../services/vehicles.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { AdPlacement } from "../components/AdPlacement.js";

export const LogisticsView = {
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
    document.getElementById("btn-refresh-logistics")?.addEventListener("click", () => {
      this.loadLogisticsData();
    });

    await this.loadLogisticsData();
    AdPlacement.init("LOGISTICS_DASHBOARD");
  },

  async loadLogisticsData() {
    const jobsContainer = document.getElementById("available-cargo-jobs-list");
    const offersContainer = document.getElementById("my-logistics-offers-list");
    if (!jobsContainer || !offersContainer) return;

    try {
      // 1. Fetch searching cargo requests
      const searchingRequests = await RequestService.getSearchingRequests();
      const cargoJobs = searchingRequests ? searchingRequests.filter(r => r.request_type === "logistics") : [];

      document.getElementById("kpi-available-cargo").innerText = cargoJobs.length;

      if (!cargoJobs || cargoJobs.length === 0) {
        jobsContainer.innerHTML = renderEmptyState({
          title: "No available cargo jobs right now",
          description: "When cargo owners and companies post freight requests, they will appear here in real-time for your fleet to bid on.",
          icon: "box"
        });
      } else {
        jobsContainer.innerHTML = cargoJobs.map(job => `
          <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem; background: var(--bg-hover);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span class="badge badge-info" style="font-size: 0.7rem;">${job.requested_vehicle_type || "TRUCK"}</span>
                <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0.25rem 0;">${job.load_description || "Freight Deliveries"}</h4>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                  📍 ${job.pickup_address} &rarr; 📍 ${job.destination_address}
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; color: var(--primary); font-size: 1.1rem;">$${job.suggested_price}</div>
                <button class="btn btn-primary btn-sm btn-bid-cargo" data-id="${job.id}" data-price="${job.suggested_price}" style="margin-top: 0.35rem; padding: 0.25rem 0.65rem; font-size: 0.75rem;">
                  Submit Bid 💬
                </button>
              </div>
            </div>
          </div>
        `).join("");

        // Bind bid buttons
        document.querySelectorAll(".btn-bid-cargo").forEach(btn => {
          btn.addEventListener("click", async () => {
            const reqId = btn.dataset.id;
            const targetPrice = btn.dataset.price;
            const offerPrice = prompt(`Enter your freight bid for this cargo ($ USD):`, targetPrice);
            if (offerPrice && !isNaN(offerPrice)) {
              try {
                await OfferService.submitOffer({
                  requestId: reqId,
                  proposedPrice: parseFloat(offerPrice),
                  estimatedArrivalMins: 45,
                  message: "Logistics provider ready with commercial heavy vehicle."
                });
                alert("Freight offer submitted to cargo owner!");
                this.loadLogisticsData();
              } catch (e) {
                alert("Could not submit bid: " + e.message);
              }
            }
          });
        });
      }

      // 2. Fetch driver's/operator's active offers
      const myOffers = await OfferService.getDriverOffers();
      document.getElementById("kpi-pending-bids").innerText = myOffers ? myOffers.filter(o => o.status === "pending").length : 0;

      if (!myOffers || myOffers.length === 0) {
        offersContainer.innerHTML = renderEmptyState({
          title: "No active bids submitted",
          description: "Submit offers on available cargo jobs on the left panel to start winning haulage contracts.",
          icon: "truck"
        });
      } else {
        offersContainer.innerHTML = myOffers.map(o => `
          <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem;">Bid Amount: $${o.proposed_price}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">ETA: ${o.estimated_arrival_mins} mins</div>
              </div>
              <span class="badge ${o.status === "accepted" ? "badge-success" : o.status === "rejected" ? "badge-danger" : "badge-warning"}">
                ${o.status.toUpperCase()}
              </span>
            </div>
          </div>
        `).join("");
      }

      // 3. Vehicles count
      const vehicles = await VehicleService.getDriverVehicles();
      document.getElementById("kpi-fleet-count").innerText = vehicles ? vehicles.length : 0;

    } catch (err) {
      jobsContainer.innerHTML = renderEmptyState({
        title: "Logistics Engine Ready",
        description: "Post jobs in Supabase to start live transport matching.",
        icon: "truck"
      });
    }
  }
};
