// ==============================================================================
// TRANSMOVE ADVERTISING MARKETPLACE VIEW (#advertise)
// Campaign Creation, Ad Slots, Advertiser Dashboard & Analytics
// ==============================================================================
import { AdvertisingService } from "../services/advertising.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { Modal } from "../components/Modal.js";

export const AdvertiseView = {
  currentProfile: null,

  async render() {
    return `
      <div style="max-width: 1040px; margin: 0 auto;">
        <!-- Hero Header -->
        <div style="background: linear-gradient(135deg, var(--bg-surface), var(--bg-subtle)); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-light); margin-bottom: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span class="badge badge-info" style="margin-bottom: 0.5rem;">ADVERTISER DASHBOARD</span>
              <h1 style="font-size: 1.8rem; font-weight: 900; margin-bottom: 0.35rem;">Manage your TransMove campaigns</h1>
              <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; margin: 0;">
                Reach active passengers, drivers, freight shippers, and equipment hirers across Zimbabwe.
              </p>
            </div>
            <button id="btn-open-create-ad" class="btn btn-primary btn-lg">
              📢 Launch Campaign
            </button>
          </div>
        </div>

        <!-- Ad Placements Grid -->
        <h2 style="font-size: 1.3rem; font-weight: 800; margin-bottom: 1rem;">Available Campaign Placements</h2>
        <div class="grid-3" style="margin-bottom: 2.5rem;">
          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🏙️</div>
            <h3 style="font-size: 1.1rem; font-weight: 800;">Marketplace Banner</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Displayed prominently at the top of passenger and cargo transport feeds.</p>
          </div>
          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🚜</div>
            <h3 style="font-size: 1.1rem; font-weight: 800;">Machinery &amp; Logistics Feature</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Targeted placement on heavy machinery rental and freight shipping boards.</p>
          </div>
          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">⭐</div>
            <h3 style="font-size: 1.1rem; font-weight: 800;">Sponsored Business Listing</h3>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Featured badge and priority positioning for fleet and equipment companies.</p>
          </div>
        </div>

        <!-- My Active Campaigns Dashboard -->
        <div class="card">
          <div class="card-header" style="margin-bottom: 1.25rem;">
            <div>
              <h3 class="card-title">📊 My Advertising Campaigns</h3>
              <p style="color: var(--text-muted); font-size: 0.85rem;">Real event tracking for impressions, clicks, and CTR</p>
            </div>
            <button id="btn-refresh-ads" class="btn btn-outline btn-sm">🔄 Refresh Stats</button>
          </div>

          <div id="advertiser-campaigns-list">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Loading campaigns...
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this.currentProfile = await AuthService.getCurrentProfile();

    // Create ad campaign modal trigger
    document.getElementById("btn-open-create-ad")?.addEventListener("click", () => {
      if (!this.currentProfile) {
        alert("Please sign in to launch an advertising campaign.");
        window.location.hash = "#login";
        return;
      }
      this.openCreateAdModal();
    });

    document.getElementById("btn-refresh-ads")?.addEventListener("click", () => {
      this.loadCampaigns();
    });

    this.loadCampaigns();
  },

  openCreateAdModal() {
    Modal.open(
      "Create Advertising Campaign",
      `
        <form id="form-create-ad">
          <div class="form-group">
            <label class="form-label">Business / Company Name</label>
            <input type="text" id="ad-company" class="form-input" placeholder="e.g. ZimFreight Express" required />
          </div>

          <div class="form-group">
            <label class="form-label">Campaign Headline / Title</label>
            <input type="text" id="ad-title" class="form-input" placeholder="e.g. 24/7 Heavy Cargo & Logistics Services" required />
          </div>

          <div class="form-group">
            <label class="form-label">Ad Description</label>
            <textarea id="ad-desc" class="form-textarea" rows="2" placeholder="Brief copy describing your service or promotion" required></textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Banner Image URL</label>
              <input type="text" id="ad-img" class="form-input" placeholder="https://..." required />
            </div>
            <div class="form-group">
              <label class="form-label">Destination Website URL</label>
              <input type="text" id="ad-url" class="form-input" placeholder="https://..." required />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Placement Slot</label>
              <select id="ad-placement" class="form-select">
                <option value="DRIVER_DASHBOARD">Driver Dashboard</option>
                <option value="VEHICLE_OWNER_DASHBOARD">Vehicle Owner Dashboard</option>
                <option value="MACHINERY_OWNER_DASHBOARD">Machinery Owner Dashboard</option>
                <option value="LOGISTICS_DASHBOARD">Logistics Provider Dashboard</option>
                <option value="CARGO_OWNER_DASHBOARD">Cargo Owner Dashboard</option>
                <option value="MARKETPLACE">General Marketplace Banner</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Campaign Budget ($)</label>
              <input type="number" id="ad-budget" class="form-input" value="50" min="10" required />
            </div>
          </div>

          <button type="submit" id="btn-submit-campaign" class="btn btn-primary btn-full" style="margin-top: 0.5rem;">
            Submit Campaign for Review 🚀
          </button>
        </form>
      `
    );

    document.getElementById("form-create-ad")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-submit-campaign");
      btn.disabled = true;
      btn.innerText = "Submitting...";

      try {
        await AdvertisingService.createCampaign({
          company_name: document.getElementById("ad-company").value.trim(),
          title: document.getElementById("ad-title").value.trim(),
          description: document.getElementById("ad-desc").value.trim(),
          image_url: document.getElementById("ad-img").value.trim(),
          destination_url: document.getElementById("ad-url").value.trim(),
          placement: document.getElementById("ad-placement").value,
          budget: parseFloat(document.getElementById("ad-budget").value)
        });

        Modal.close();
        alert("Campaign submitted successfully! It is now pending administrator review.");
        this.loadCampaigns();
      } catch (err) {
        alert("Error creating campaign: " + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  },

  async loadCampaigns() {
    const container = document.getElementById("advertiser-campaigns-list");
    if (!container) return;

    if (!this.currentProfile) {
      container.innerHTML = renderEmptyState({
        title: "Sign in to view your advertising campaigns",
        description: "Promote your business on TransMove and track real impressions and clicks.",
        actionText: "Sign In",
        actionLink: "#login",
        icon: "inbox"
      });
      return;
    }

    try {
      const campaigns = await AdvertisingService.getAdvertiserCampaigns(this.currentProfile.id);

      if (!campaigns || campaigns.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No advertising campaigns yet",
          description: "Launch your first business campaign to reach ride customers and transport operators.",
          actionText: "Launch Campaign",
          actionLink: "#advertise",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div class="grid-2">
          ${campaigns.map((ad) => {
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
            return `
              <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-lg); background: var(--bg-surface);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                  <div>
                    <span class="badge ${ad.status === "approved" ? "badge-success" : ad.status === "rejected" ? "badge-danger" : "badge-warning"}">
                      ${ad.status.replace("_", " ").toUpperCase()}
                    </span>
                    <span style="font-weight: 700; font-size: 1.05rem; margin-left: 0.5rem;">${ad.title}</span>
                  </div>
                  <span style="font-weight: 800; color: var(--primary);">$${ad.budget}</span>
                </div>

                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
                  ${ad.company_name} • Placement: ${ad.placement.replace("_", " ")}
                </div>

                <!-- Real Metrics Box -->
                <div style="background: var(--bg-subtle); padding: 0.85rem; border-radius: var(--radius-md); display: flex; justify-content: space-around; text-align: center;">
                  <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Impressions</div>
                    <div style="font-size: 1.2rem; font-weight: 800;">${ad.impressions}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Clicks</div>
                    <div style="font-size: 1.2rem; font-weight: 800; color: #10b981;">${ad.clicks}</div>
                  </div>
                  <div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">CTR</div>
                    <div style="font-size: 1.2rem; font-weight: 800; color: #38bdf8;">${ctr}%</div>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Database Ready",
        description: "Campaigns will be displayed here.",
        icon: "inbox"
      });
    }
  }
};
