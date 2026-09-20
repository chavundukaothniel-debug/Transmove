// ==============================================================================
// TRANSMOVE MACHINERY HIRER VIEW
// Dedicated dashboard for farmers, contractors, and builders seeking equipment hire
// ==============================================================================
import { EquipmentService } from "../services/equipment.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { icon } from "../components/Icon.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

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
          ${icon("search", 18)}<span>Browse All Equipment</span>
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
        <h3 class="icon-label" style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">${icon("tractor", 20)}<span>Available Verified Equipment for Hire</span></h3>
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
      const listings = await EquipmentService.getMarketplaceListings();

      if (!listings || listings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No machinery listings are available yet",
          description: "The equipment hire marketplace is not live on TransMove yet. Please check back later.",
          icon: "tractor"
        });
        return;
      }

      container.innerHTML = listings.map(m => `
        <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem; background: var(--bg-card); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="badge badge-info" style="font-size: 0.7rem;">${escapeHtml(m.category?.toUpperCase() || "MACHINERY")}</span>
            <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0.35rem 0 0.15rem 0;">${escapeHtml(m.title)}</h4>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              <span class="icon-label icon-label--inline">${icon("map-pin", 15)}<span>Location: <strong>${escapeHtml(m.location_name)}</strong></span></span> • ${escapeHtml(m.make)} ${escapeHtml(m.model)}
            </div>
            <div style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-muted);">
              ${escapeHtml(m.description)}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">$${escapeHtml(m.rate_per_day)} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ day</span></div>
            <button class="btn btn-primary btn-sm" disabled title="Equipment hire requests are not available on TransMove yet" style="margin-top: 0.5rem;">
              ${icon("calendar-plus", 17)}<span>Request Hire Quote</span>
            </button>
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.warn("Machinery marketplace load failed:", err);
      container.innerHTML = renderEmptyState({
        title: "No machinery listings are available yet",
        description: "The equipment hire marketplace is not live on TransMove yet. Please check back later.",
        icon: "tractor"
      });
    }
  }
};
