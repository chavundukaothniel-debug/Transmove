// ==============================================================================
// TRANSMOVE EQUIPMENT MARKETPLACE VIEW
// Browse and hire heavy machinery, tractors, excavators & tippers
// ==============================================================================
import { EquipmentService } from "../services/equipment.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { Modal } from "../components/Modal.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const EquipmentView = {
  activeCategory: "all",

  async render() {
    return `
      <div class="equipment-marketplace">
        <div class="card-header" style="margin-bottom: 2rem;">
          <div>
            <h1 style="font-size: 2rem; font-weight: 900;">Heavy Machinery &amp; Equipment Hire</h1>
            <p style="color: var(--text-muted); font-size: 0.95rem;">Hire verified agricultural, earthmoving and haulage machinery directly from real owners</p>
          </div>
          <a href="#owner" class="btn btn-primary btn-sm">
            🚜 List Your Equipment
          </a>
        </div>

        <!-- Filter Chips -->
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 2rem;">
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "all" ? "active" : ""}" data-cat="all">All Machinery</button>
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "tractor" ? "active" : ""}" data-cat="tractor">Tractors</button>
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "excavator" ? "active" : ""}" data-cat="excavator">Excavators</button>
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "truck" ? "active" : ""}" data-cat="truck">Tipper Trucks</button>
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "trailer" ? "active" : ""}" data-cat="trailer">Flatbeds / Trailers</button>
          <button class="btn btn-outline btn-sm eq-filter-btn ${this.activeCategory === "crane" ? "active" : ""}" data-cat="crane">Mobile Cranes</button>
        </div>

        <div id="equipment-grid-container">
          <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
            Loading available machinery...
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this.loadListings();

    document.querySelectorAll(".eq-filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.activeCategory = e.currentTarget.getAttribute("data-cat");
        document.querySelectorAll(".eq-filter-btn").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-cat") === this.activeCategory);
        });
        this.loadListings();
      });
    });
  },

  async loadListings() {
    const container = document.getElementById("equipment-grid-container");
    if (!container) return;

    try {
      const listings = await EquipmentService.getMarketplaceListings(this.activeCategory);

      if (!listings || listings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No machinery listings are available yet",
          description: "The equipment hire marketplace is not live on TransMove yet. Please check back later.",
          icon: "tractor"
        });
        return;
      }

      container.innerHTML = `
        <div class="grid-3">
          ${listings.map((item) => `
            <div class="card" style="display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <span class="badge badge-info">${escapeHtml((item.category || "machinery").toUpperCase())}</span>
                <span class="badge badge-success">VERIFIED OWNER</span>
              </div>

              <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.25rem;">${escapeHtml(item.title)}</h3>
              <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">
                ${escapeHtml(item.make)} ${escapeHtml(item.model)} • 📍 ${escapeHtml(item.location_name)}
              </div>

              <p style="color: var(--text-muted); font-size: 0.9rem; flex: 1; margin-bottom: 1.25rem;">
                ${escapeHtml(item.description)}
              </p>

              <div style="border-top: 1px solid var(--border-light); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-size: 1.4rem; font-weight: 900; color: var(--primary);">$${escapeHtml(item.rate_per_day)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">per day ${item.rate_per_hour ? `($${escapeHtml(item.rate_per_hour)}/hr)` : ""}</div>
                </div>

                <button class="btn btn-primary btn-sm" disabled title="Equipment hire is not available on TransMove yet">
                  Hire Machine 🚜
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      console.warn("Equipment marketplace load failed:", err);
      container.innerHTML = renderEmptyState({
        title: "No machinery listings are available yet",
        description: "The equipment hire marketplace is not live on TransMove yet. Please check back later.",
        icon: "tractor"
      });
    }
  }
};
