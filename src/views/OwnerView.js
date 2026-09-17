// ==============================================================================
// TRANSMOVE MACHINERY & FLEET OWNER VIEW
// List Heavy Equipment, Tractors, Tipper Trucks & Manage Hire Requests
// ==============================================================================
import { EquipmentService } from "../services/equipment.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const OwnerView = {
  async render() {
    return `
      <div class="owner-dashboard">
        <div class="card-header" style="margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800;">Heavy Machinery &amp; Fleet Owner</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">List your construction, agricultural machinery, and freight fleet for direct hire</p>
          </div>
        </div>

        <div class="grid-2">
          <!-- Add Machinery Form -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">🚜 List New Equipment</h3>
            <form id="add-equipment-form">
              <div class="form-group">
                <label class="form-label">Equipment Title</label>
                <input type="text" id="eq-title" class="form-input" placeholder="e.g. 20-Tonne Tipper Truck or CAT Excavator" required />
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="eq-category" class="form-select" required>
                    <option value="tractor">Agricultural Tractor</option>
                    <option value="excavator">Excavator / Earthmover</option>
                    <option value="truck">Tipper / Haulage Truck</option>
                    <option value="trailer">Flatbed / Lowbed Trailer</option>
                    <option value="crane">Mobile Crane / Hoist</option>
                    <option value="construction">General Construction</option>
                    <option value="other">Other Heavy Machinery</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Location / Base City</label>
                  <input type="text" id="eq-location" class="form-input" placeholder="e.g. Harare, Msasa" required />
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Make</label>
                  <input type="text" id="eq-make" class="form-input" placeholder="e.g. Massey Ferguson" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Model</label>
                  <input type="text" id="eq-model" class="form-input" placeholder="e.g. 385" required />
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Rate Per Day ($)</label>
                  <input type="number" id="eq-rate-day" class="form-input" placeholder="e.g. 250" min="1" step="5" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Rate Per Hour ($)</label>
                  <input type="number" id="eq-rate-hour" class="form-input" placeholder="e.g. 35" min="1" step="1" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Technical Description &amp; Conditions</label>
                <textarea id="eq-desc" class="form-textarea" rows="3" placeholder="Specify operator inclusion, fuel terms, attachments, and capacity..." required></textarea>
              </div>

              <button type="submit" id="btn-save-eq" class="btn btn-primary btn-full">
                Publish Equipment Listing 🚜
              </button>
            </form>
          </div>

          <!-- Existing Listings -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">My Active Equipment Fleet</h3>
            <div id="owner-equipment-list">
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                Loading equipment fleet...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    const profile = await AuthService.getCurrentProfile();
    const roles = profile ? await AuthService.getApprovedRoles(profile) : [];
    const isOwner = Boolean(profile) && (roles.includes("owner") || roles.includes("admin") || profile.role === "owner");
    if (!isOwner) {
      const restrictedBtn = document.getElementById("btn-save-eq");
      if (restrictedBtn) {
        restrictedBtn.disabled = true;
        restrictedBtn.title = "Your account does not have an approved machinery & fleet owner role.";
      }
      const restrictedContainer = document.getElementById("owner-equipment-list");
      if (restrictedContainer) {
        restrictedContainer.innerHTML = renderEmptyState({
          title: "Access restricted",
          description: "Your account does not have an approved machinery & fleet owner role.",
          icon: "tractor"
        });
      }
      return;
    }

    this.loadOwnerListings();

    document.getElementById("add-equipment-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-save-eq");
      btn.disabled = true;
      btn.innerText = "Publishing...";

      try {
        await EquipmentService.addListing({
          title: document.getElementById("eq-title").value.trim(),
          category: document.getElementById("eq-category").value,
          location_name: document.getElementById("eq-location").value.trim(),
          make: document.getElementById("eq-make").value.trim(),
          model: document.getElementById("eq-model").value.trim(),
          rate_per_day: document.getElementById("eq-rate-day").value,
          rate_per_hour: document.getElementById("eq-rate-hour").value || null,
          description: document.getElementById("eq-desc").value.trim()
        });

        alert("Equipment listing submitted successfully! Pending verification before appearing in marketplace.");
        document.getElementById("add-equipment-form")?.reset();
        await this.loadOwnerListings();
      } catch (err) {
        console.warn("Equipment listing publish failed:", err);
        alert("Could not publish listing: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "Publish Equipment Listing 🚜";
      }
    });
  },

  async loadOwnerListings() {
    const container = document.getElementById("owner-equipment-list");
    if (!container) return;

    try {
      const listings = await EquipmentService.getOwnerListings();

      if (!listings || listings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No machinery listings are available yet",
          description: "Equipment listings are not live on TransMove yet. Please check back later.",
          icon: "tractor"
        });
        return;
      }

      container.innerHTML = listings.map((item) => `
        <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 1.05rem;">${escapeHtml(item.title)}</div>
            <span class="badge ${item.verification_status === "approved" ? "badge-success" : "badge-warning"}">
              ${escapeHtml(item.verification_status || "unverified")}
            </span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin: 0.35rem 0;">
            ${escapeHtml(item.make)} ${escapeHtml(item.model)} • ${escapeHtml(item.location_name)}
          </div>
          <div style="font-weight: 800; color: var(--primary);">
            $${escapeHtml(item.rate_per_day)} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ day</span>
            ${item.rate_per_hour ? `• $${escapeHtml(item.rate_per_hour)} / hr` : ""}
          </div>
        </div>
      `).join("");
    } catch (err) {
      console.warn("Owner equipment load failed:", err);
      container.innerHTML = renderEmptyState({
        title: "No machinery listings are available yet",
        description: "Equipment listings are not live on TransMove yet. Please check back later.",
        icon: "tractor"
      });
    }
  }
};
