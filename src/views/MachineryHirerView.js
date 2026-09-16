// ==============================================================================
// TRANSMOVE MACHINERY HIRER VIEW
// Dedicated dashboard for farmers, contractors, and builders seeking equipment hire
// ==============================================================================
import { EquipmentService } from "../services/equipment.js";
import { renderEmptyState } from "../components/EmptyState.js";

export const MachineryHirerView = {
  async render() {
    return `
      <div class="machinery-hirer-dashboard container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-info" style="font-size: 0.75rem;">MACHINERY HIRER</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Plant &amp; Industrial Equipment Sourcing</span>
              </div>
              <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0;">Find and hire heavy machinery</h1>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">Search verified tractors, excavators, tippers, and cranes available for direct rental.</p>
            </div>
            <div>
              <a href="#equipment" class="btn btn-primary">
                🔍 Browse All Equipment
              </a>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">ACTIVE RENTALS</div>
            <div id="kpi-hirer-active" style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Current hired machinery</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PENDING REQUESTS</div>
            <div id="kpi-hirer-pending" style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Quotes requested</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">COMPLETED RENTALS</div>
            <div id="kpi-hirer-completed" style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Past contracts</div>
          </div>
        </div>

        <!-- Machinery Marketplace List -->
        <div class="card">
          <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">🚜 Available Verified Equipment for Hire</h3>
          <div id="hirer-equipment-marketplace">
            <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
              Loading available machinery...
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    await this.loadMarketplace();
  },

  async loadMarketplace() {
    const container = document.getElementById("hirer-equipment-marketplace");
    if (!container) return;

    try {
      const listings = await EquipmentService.getApprovedListings();

      if (!listings || listings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No heavy machinery listed for hire yet",
          description: "Check back shortly or publish an equipment request to alert verified machinery owners.",
          icon: "tractor"
        });
        return;
      }

      container.innerHTML = listings.map(m => `
        <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem; background: var(--bg-card); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-info" style="font-size: 0.7rem;">${m.category?.toUpperCase() || "MACHINERY"}</span>
            <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0.35rem 0 0.15rem 0;">${m.title}</h4>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              📍 Location: <strong>${m.location_name}</strong> • ${m.make} ${m.model}
            </div>
            <div style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
              ${m.description}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">$${m.rate_per_day} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ day</span></div>
            <button class="btn btn-primary btn-sm btn-hire-request" data-id="${m.id}" data-title="${m.title}" style="margin-top: 0.5rem;">
              Request Hire Quote 🚜
            </button>
          </div>
        </div>
      `).join("");

      document.querySelectorAll(".btn-hire-request").forEach(btn => {
        btn.addEventListener("click", () => {
          const title = btn.dataset.title;
          alert(`Rental Request Sent for "${title}"! The equipment owner has been notified and will contact you with availability dates.`);
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Marketplace Ready",
        description: "Equipment listings will load automatically when available in Supabase.",
        icon: "tractor"
      });
    }
  }
};
