// ==============================================================================
// TRANSMOVE MACHINERY OWNER VIEW
// Dedicated dashboard for heavy equipment, agricultural & construction machinery owners
// ==============================================================================
import { EquipmentService } from "../services/equipment.js";
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

export const MachineryOwnerView = {
  async render() {
    return `
      <div class="machinery-owner-dashboard container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-info" style="font-size: 0.75rem;">MACHINERY OWNER</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Industrial &amp; Agricultural Equipment Fleet</span>
              </div>
              <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0;">Manage your equipment rentals</h1>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">List tractors, excavators, tippers, cranes, and heavy plant equipment for rental contracts.</p>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" id="machinery-owner-section-overview" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">LISTED MACHINERY</div>
            <div id="kpi-mac-count" style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Equipment active</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">ACTIVE RENTALS</div>
            <div id="kpi-mac-rentals" style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">—</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Hired on site</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">PENDING OFFERS</div>
            <div id="kpi-mac-offers" style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">—</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Contract proposals</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">TOTAL REVENUE</div>
            <div id="kpi-mac-revenue" style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">—</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Equipment earnings</div>
          </div>
        </div>

        ${AdPlacement.renderContainer("MACHINERY_OWNER_DASHBOARD")}

        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Publish Machinery Form -->
          <div class="card" id="machinery-owner-section-add">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">🚜 Add Heavy Machinery Listing</h3>
            <form id="machinery-owner-form">
              <div class="form-group">
                <label class="form-label">Equipment Title</label>
                <input type="text" id="mac-title" class="form-input" placeholder="e.g. CAT 320 Excavator or MF 385 Tractor" required />
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="mac-category" class="form-select" required>
                    <option value="tractor">Tractor (Agricultural)</option>
                    <option value="excavator">Excavator / Digger</option>
                    <option value="loader">Front Loader / Backhoe</option>
                    <option value="grader">Motor Grader</option>
                    <option value="tipper">Tipper Truck</option>
                    <option value="crane">Mobile Crane</option>
                    <option value="generator">Industrial Generator</option>
                    <option value="trailer">Lowbed / Flatbed Trailer</option>
                    <option value="other">Other Plant Equipment</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Base Location / City</label>
                  <input type="text" id="mac-location" class="form-input" placeholder="e.g. Msasa, Harare" required />
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Rate Per Day ($ USD)</label>
                  <input type="number" id="mac-rate-day" class="form-input" placeholder="e.g. 250" min="5" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Rate Per Hour ($ USD)</label>
                  <input type="number" id="mac-rate-hour" class="form-input" placeholder="e.g. 35" min="1" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Technical Specifications &amp; Operator Terms</label>
                <textarea id="mac-desc" class="form-textarea" rows="3" placeholder="Specify certified operator inclusion, fuel terms, attachments, and capacity..." required></textarea>
              </div>

              <button type="submit" id="btn-save-machinery" class="btn btn-primary btn-full">
                Publish Machinery Listing 🚜
              </button>
            </form>
          </div>

          <!-- Listed Machinery List -->
          <div class="card" id="machinery-owner-section-fleet">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">🚜 Active Heavy Machinery Fleet</h3>
            <div id="machinery-owner-list">
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                Loading heavy machinery...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    const tab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");
    const sectionMap = {
      machinery: "machinery-owner-section-fleet",
      add: "machinery-owner-section-add",
      earnings: "machinery-owner-section-overview"
    };
    const section = document.getElementById(sectionMap[tab] || "machinery-owner-section-overview");
    section?.scrollIntoView({ block: "start" });

    this.bindEvents();
    await this.loadMachinery();
    AdPlacement.init("MACHINERY_OWNER_DASHBOARD");
  },

  bindEvents() {
    document.getElementById("machinery-owner-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-machinery");
      saveBtn.disabled = true;
      saveBtn.innerText = "Publishing Machinery...";

      try {
        await EquipmentService.addListing({
          title: document.getElementById("mac-title").value.trim(),
          category: document.getElementById("mac-category").value,
          location_name: document.getElementById("mac-location").value.trim(),
          make: "Heavy Plant",
          model: "Equipment",
          rate_per_day: parseFloat(document.getElementById("mac-rate-day").value),
          rate_per_hour: document.getElementById("mac-rate-hour").value ? parseFloat(document.getElementById("mac-rate-hour").value) : null,
          description: document.getElementById("mac-desc").value.trim()
        });

        alert("Machinery listing submitted successfully! Pending verification before appearing in marketplace.");
        document.getElementById("machinery-owner-form")?.reset();
        await this.loadMachinery();
      } catch (err) {
        console.warn("Machinery listing publish failed:", err);
        alert("Could not publish machinery: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Publish Machinery Listing 🚜";
      }
    });
  },

  async loadMachinery() {
    const container = document.getElementById("machinery-owner-list");
    if (!container) return;

    try {
      const listings = await EquipmentService.getOwnerListings();
      document.getElementById("kpi-mac-count").innerText = listings ? listings.length : 0;

      if (!listings || listings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No machinery listings are available yet",
          description: "Equipment listings are not live on TransMove yet. Please check back later.",
          icon: "tractor"
        });
        return;
      }

      container.innerHTML = listings.map(m => `
        <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 1rem;">${escapeHtml(m.title)}</div>
            <span class="badge ${m.verification_status === "approved" ? "badge-success" : "badge-warning"}">
              ${escapeHtml((m.verification_status || "unverified").toUpperCase())}
            </span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin: 0.25rem 0;">
            Location: <strong>${escapeHtml(m.location_name)}</strong> • Category: ${escapeHtml(m.category)}
          </div>
          <div style="font-weight: 800; color: var(--primary);">
            $${escapeHtml(m.rate_per_day)} / day ${m.rate_per_hour ? `• $${escapeHtml(m.rate_per_hour)} / hr` : ""}
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.warn("Machinery fleet load failed:", err);
      container.innerHTML = renderEmptyState({
        title: "No machinery listings are available yet",
        description: "Equipment listings are not live on TransMove yet. Please check back later.",
        icon: "tractor"
      });
    }
  }
};
