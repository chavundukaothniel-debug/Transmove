// ==============================================================================
// TRANSMOVE MACHINERY OWNER VIEW
// Dedicated dashboard for heavy plant, agricultural & construction machinery owners.
// Supports listing creation, operator pricing, Google Drive photo uploads,
// hire request lifecycle (Accept/Decline), and machinery advertising promotion.
// ==============================================================================
import { MachineryService, MACHINERY_CATEGORIES } from "../services/machinery.js";
import { AuthService } from "../services/auth.js";
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

export const MachineryOwnerView = {
  activeTab: "fleet", // 'fleet' | 'add' | 'requests'
  ownerListings: [],
  hireRequests: [],
  uploadedPhotos: [],

  async render() {
    return `
      <div class="machinery-owner-dashboard container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
        
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 12px; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="badge" style="background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.4); font-size: 0.75rem; font-weight: 700;">MACHINERY OWNER</span>
                <span style="font-size: 0.85rem; color: #94a3b8;">Heavy Plant &amp; Industrial Equipment Portal</span>
              </div>
              <h1 style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #ffffff;">Manage Your Machinery Fleet</h1>
              <p style="color: #94a3b8; font-size: 0.95rem; margin: 0;">
                List excavators, bulldozers, tippers, and tractors. Set machinery-only and operator-inclusive rates, handle bookings, and advertise.
              </p>
            </div>
            <div style="display: flex; gap: 0.75rem;">
              <a href="#machinery" class="btn btn-outline" style="border-color: rgba(255,255,255,0.2); color: #ffffff;">
                ${icon("search", 18)} <span>Open Marketplace</span>
              </a>
              <a href="#subscriptions" class="btn btn-primary" style="font-weight: 700;">
                ${icon("credit-card", 18)} <span>Subscription Plans</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Listed Machinery</div>
            <div id="kpi-mac-count" style="font-size: 1.75rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Active equipment</div>
          </div>
          <div class="card" style="padding: 1.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Hire Requests</div>
            <div id="kpi-mac-requests" style="font-size: 1.75rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Awaiting response</div>
          </div>
          <div class="card" style="padding: 1.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Active Hires</div>
            <div id="kpi-mac-active-hires" style="font-size: 1.75rem; font-weight: 800; color: #3b82f6; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Currently on site</div>
          </div>
          <div class="card" style="padding: 1.25rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Advertising Active</div>
            <div id="kpi-mac-ads" style="font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Promoted listings</div>
          </div>
        </div>

        <!-- DASHBOARD NAVIGATION TABS -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">
          <button type="button" id="tab-btn-fleet" class="btn btn-outline btn-sm mac-tab-btn active" style="font-weight: 700;">
            ${icon("tractor", 17)} <span>My Machinery Fleet</span>
          </button>
          <button type="button" id="tab-btn-add" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700;">
            ${icon("circle-plus", 17)} <span>Add Machinery</span>
          </button>
          <button type="button" id="tab-btn-requests" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700;">
            ${icon("clipboard-list", 17)} <span>Hire Requests</span>
            <span id="badge-pending-hires-count" class="badge badge-warning" style="margin-left: 0.35rem; display: none;">0</span>
          </button>
        </div>

        <!-- SECTION 1: FLEET LISTINGS -->
        <div id="mac-section-fleet">
          <div id="machinery-owner-fleet-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
              Loading machinery fleet...
            </div>
          </div>
        </div>

        <!-- SECTION 2: ADD MACHINERY FORM -->
        <div id="mac-section-add" style="display: none;">
          <div class="card" style="max-width: 800px; margin: 0 auto; padding: 2rem; border-radius: 12px;">
            <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0 0 1.25rem 0; display: flex; align-items: center; gap: 0.5rem;">
              ${icon("circle-plus", 24)} <span>New Machinery Listing</span>
            </h2>

            <form id="form-add-machinery">
              
              <!-- Basic Info -->
              <div class="form-group" style="margin-bottom: 1rem;">
                <label class="form-label">Machinery Name / Title</label>
                <input type="text" id="add-mac-name" class="form-input" placeholder="e.g. CAT 320 Hydraulic Excavator" required />
              </div>

              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select id="add-mac-category" class="form-select" required>
                    ${MACHINERY_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Brand / Manufacturer</label>
                  <input type="text" id="add-mac-brand" class="form-input" placeholder="e.g. Caterpillar, Komatsu, JCB" required />
                </div>
              </div>

              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group">
                  <label class="form-label">Model</label>
                  <input type="text" id="add-mac-model" class="form-input" placeholder="e.g. 320D, 3CX, D6R" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Year of Manufacture</label>
                  <input type="number" id="add-mac-year" class="form-input" placeholder="e.g. 2018" min="1980" max="2030" />
                </div>
              </div>

              <!-- Location & Condition -->
              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div class="form-group">
                  <label class="form-label">City / Town Location</label>
                  <input type="text" id="add-mac-location" class="form-input" placeholder="e.g. Gweru, Midlands" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Condition</label>
                  <select id="add-mac-condition" class="form-select">
                    <option value="excellent">Excellent / Like New</option>
                    <option value="good" selected>Good / Work Ready</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>

              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                <div class="form-group">
                  <label class="form-label">Operating Hours</label>
                  <input type="number" id="add-mac-hours" class="form-input" placeholder="e.g. 3200" min="0" />
                </div>
                <div class="form-group">
                  <label class="form-label">Fuel Type</label>
                  <select id="add-mac-fuel" class="form-select">
                    <option value="diesel" selected>Diesel</option>
                    <option value="petrol">Petrol</option>
                    <option value="electric">Electric</option>
                  </select>
                </div>
              </div>

              <!-- PRICING & OPERATOR SECTION (STRICT BUSINESS RULES) -->
              <div style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; margin-bottom: 1.25rem;">
                <h3 style="font-size: 1rem; font-weight: 800; margin: 0 0 1rem 0; color: var(--text-main);">
                  Hire Rates &amp; Operator Settings
                </h3>

                <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                  <div class="form-group">
                    <label class="form-label">Base Hire Rate ($ USD) <span style="color: #ef4444;">*</span></label>
                    <input type="number" id="add-mac-base-rate" class="form-input" placeholder="e.g. 180" min="1" step="0.50" required />
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Machinery-only rate charged to renter.</div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Rate Billing Period</label>
                    <select id="add-mac-rate-period" class="form-select">
                      <option value="per_day" selected>Per Day</option>
                      <option value="per_hour">Per Hour</option>
                      <option value="per_week">Per Week</option>
                      <option value="per_month">Per Month</option>
                    </select>
                  </div>
                </div>

                <!-- Operator Toggle -->
                <div style="border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: 0.5rem;">
                  <label style="display: inline-flex; align-items: center; gap: 0.6rem; cursor: pointer; font-weight: 700; font-size: 0.95rem; margin-bottom: 0.75rem;">
                    <input type="checkbox" id="add-mac-operator-available" style="width: 18px; height: 18px;" />
                    <span>Certified Operator Available</span>
                  </label>

                  <!-- Operator inclusive rate input -->
                  <div id="add-mac-operator-rate-group" style="display: none; padding: 1rem; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border);">
                    <div class="form-group" style="margin-bottom: 0.5rem;">
                      <label class="form-label">Operator-Inclusive Total Rate ($ USD) <span style="color: #ef4444;">*</span></label>
                      <input type="number" id="add-mac-operator-inclusive-rate" class="form-input" placeholder="e.g. 230" min="1" step="0.50" />
                      <div id="add-mac-operator-validation-hint" style="font-size: 0.75rem; color: #10b981; margin-top: 0.25rem;">
                        Must be strictly greater than machinery-only base rate.
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- PHOTO UPLOAD (PRIVATE GOOGLE DRIVE STORAGE) -->
              <div class="form-group" style="margin-bottom: 1.25rem;">
                <label class="form-label">Machinery Photos (Private Google Drive Storage)</label>
                <input type="file" id="add-mac-photo-input" class="form-input" accept="image/jpeg,image/png,image/webp" />
                <div id="add-mac-photo-preview-box" style="margin-top: 0.5rem; display: flex; gap: 0.5rem; flex-wrap: wrap;"></div>
              </div>

              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label class="form-label">Description &amp; Capability Terms</label>
                <textarea id="add-mac-description" class="form-input" rows="3" placeholder="Describe machinery condition, attachments included (e.g. bucket sizes, ripper, hammer), and transport options..."></textarea>
              </div>

              <div id="add-mac-error" style="color: #ef4444; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>

              <button type="submit" id="btn-submit-add-machinery" class="btn btn-primary" style="font-weight: 700; width: 100%; padding: 0.75rem;">
                ${icon("circle-plus", 18)} <span>Publish Machinery Listing</span>
              </button>
            </form>
          </div>
        </div>

        <!-- SECTION 3: HIRE REQUESTS -->
        <div id="mac-section-requests" style="display: none;">
          <div id="machinery-owner-requests-feed">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Loading hire requests...
            </div>
          </div>
        </div>

      </div>
    `;
  },

  async init(container = document) {
    this.bindTabNavigation(container);
    this.bindAddForm(container);
    await this.loadFleet(container);
    await this.loadRequests(container);
  },

  bindTabNavigation(container) {
    const tabFleet = container.querySelector("#tab-btn-fleet");
    const tabAdd = container.querySelector("#tab-btn-add");
    const tabRequests = container.querySelector("#tab-btn-requests");

    const secFleet = container.querySelector("#mac-section-fleet");
    const secAdd = container.querySelector("#mac-section-add");
    const secRequests = container.querySelector("#mac-section-requests");

    const setTab = (tabName) => {
      this.activeTab = tabName;
      [tabFleet, tabAdd, tabRequests].forEach((b) => b?.classList.remove("active"));
      if (secFleet) secFleet.style.display = "none";
      if (secAdd) secAdd.style.display = "none";
      if (secRequests) secRequests.style.display = "none";

      if (tabName === "fleet") {
        tabFleet?.classList.add("active");
        if (secFleet) secFleet.style.display = "block";
        this.loadFleet(container);
      } else if (tabName === "add") {
        tabAdd?.classList.add("active");
        if (secAdd) secAdd.style.display = "block";
      } else if (tabName === "requests") {
        tabRequests?.classList.add("active");
        if (secRequests) secRequests.style.display = "block";
        this.loadRequests(container);
      }
    };

    tabFleet?.addEventListener("click", () => setTab("fleet"));
    tabAdd?.addEventListener("click", () => setTab("add"));
    tabRequests?.addEventListener("click", () => setTab("requests"));

    // Check hash parameter ?tab=
    const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const tabParam = urlParams.get("tab");
    if (tabParam === "add") setTab("add");
    else if (tabParam === "requests") setTab("requests");
  },

  bindAddForm(container) {
    const form = container.querySelector("#form-add-machinery");
    const opCheckbox = container.querySelector("#add-mac-operator-available");
    const opGroup = container.querySelector("#add-mac-operator-rate-group");
    const photoInput = container.querySelector("#add-mac-photo-input");
    const previewBox = container.querySelector("#add-mac-photo-preview-box");
    const errorEl = container.querySelector("#add-mac-error");

    opCheckbox?.addEventListener("change", () => {
      if (opGroup) opGroup.style.display = opCheckbox.checked ? "block" : "none";
    });

    photoInput?.addEventListener("change", async () => {
      const file = photoInput.files?.[0];
      if (!file) return;

      if (previewBox) {
        previewBox.innerHTML = `<div style="font-size: 0.8rem; color: var(--text-muted);">Uploading to Google Drive...</div>`;
      }

      try {
        const upload = await MachineryService.uploadPhoto(file);
        this.uploadedPhotos = [upload];
        if (previewBox) {
          previewBox.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--bg-hover); padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.8rem;">
              <span>✅ Photo uploaded to Google Drive:</span> <strong>${escapeHtml(file.name)}</strong>
            </div>
          `;
        }
      } catch (err) {
        console.warn("Drive upload error:", err);
        if (previewBox) {
          previewBox.innerHTML = `<div style="font-size: 0.8rem; color: #ef4444;">Upload error: ${err.message}</div>`;
        }
      }
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";
      const submitBtn = form.querySelector("#btn-submit-add-machinery");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Publishing Machinery...";
      }

      try {
        const baseRate = parseFloat(container.querySelector("#add-mac-base-rate")?.value);
        const opAvail = Boolean(opCheckbox?.checked);
        let opInclusiveRate = null;

        if (opAvail) {
          opInclusiveRate = parseFloat(container.querySelector("#add-mac-operator-inclusive-rate")?.value);
          if (!opInclusiveRate || opInclusiveRate <= baseRate) {
            throw new Error("Operator-inclusive rate must be greater than machinery-only base rate.");
          }
        }

        await MachineryService.createListing({
          name: container.querySelector("#add-mac-name")?.value.trim(),
          category: container.querySelector("#add-mac-category")?.value,
          brand: container.querySelector("#add-mac-brand")?.value.trim(),
          model: container.querySelector("#add-mac-model")?.value.trim(),
          year: container.querySelector("#add-mac-year")?.value ? parseInt(container.querySelector("#add-mac-year").value) : null,
          condition: container.querySelector("#add-mac-condition")?.value,
          location: container.querySelector("#add-mac-location")?.value.trim(),
          operating_hours: container.querySelector("#add-mac-hours")?.value ? parseFloat(container.querySelector("#add-mac-hours").value) : 0,
          fuel_type: container.querySelector("#add-mac-fuel")?.value,
          base_hire_rate: baseRate,
          rate_period: container.querySelector("#add-mac-rate-period")?.value,
          operator_available: opAvail,
          operator_inclusive_rate: opInclusiveRate,
          description: container.querySelector("#add-mac-description")?.value.trim(),
          photos: this.uploadedPhotos
        });

        alert("Machinery listing created successfully!");
        form.reset();
        this.uploadedPhotos = [];
        if (previewBox) previewBox.innerHTML = "";
        if (opGroup) opGroup.style.display = "none";

        // Return to fleet tab
        container.querySelector("#tab-btn-fleet")?.click();
      } catch (err) {
        console.error("Machinery listing creation failed:", err);
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to create listing.";
          errorEl.style.display = "block";
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `${icon("circle-plus", 18)} <span>Publish Machinery Listing</span>`;
        }
      }
    });
  },

  async loadFleet(container) {
    const grid = container.querySelector("#machinery-owner-fleet-grid");
    if (!grid) return;

    try {
      const user = await AuthService.getCurrentUser().catch(() => null);
      const allListings = await MachineryService.listMarketplace();
      this.ownerListings = user ? allListings.filter((m) => m.owner_id === user.id) : allListings;

      const kpiCount = container.querySelector("#kpi-mac-count");
      if (kpiCount) kpiCount.textContent = this.ownerListings.length;

      const activeAdsCount = this.ownerListings.filter((m) => m.is_sponsored).length;
      const kpiAds = container.querySelector("#kpi-mac-ads");
      if (kpiAds) kpiAds.textContent = activeAdsCount;

      if (this.ownerListings.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-muted);">${icon("tractor", 48)}</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No machinery listed yet</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.25rem auto;">
              Add your heavy machinery fleet to receive hire requests from contractors and individuals.
            </p>
            <button type="button" class="btn btn-primary" onclick="document.querySelector('#tab-btn-add').click()">
              ${icon("circle-plus", 18)} <span>Add First Machine</span>
            </button>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.ownerListings.map((item) => this.renderFleetCard(item)).join("");
      this.bindFleetCardActions(container);
    } catch (err) {
      console.warn("Fleet load error:", err);
      grid.innerHTML = `<div style="color: #ef4444; padding: 1.5rem;">Failed to load fleet: ${err.message}</div>`;
    }
  },

  renderFleetCard(item) {
    const isSponsored = Boolean(item.is_sponsored);
    const photoUrl = Array.isArray(item.photos) && item.photos.length > 0
      ? (item.photos[0].file_url || item.photos[0].url || item.photos[0])
      : "/assets/images/logo.png";

    return `
      <div class="card" style="border-radius: 12px; overflow: hidden; padding: 0; border: ${isSponsored ? "2px solid #10b981" : "1px solid var(--border)"}; position: relative; display: flex; flex-direction: column;">
        
        ${isSponsored ? `
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; background: #10b981; color: #ffffff; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.5px; padding: 0.25rem 0.65rem; border-radius: 4px;">
            ADVERTISING ACTIVE
          </div>
        ` : ""}

        <div style="height: 160px; background: #0f172a; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png'; this.style.objectFit='contain';" />
        </div>

        <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
            <h3 style="font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--text-main);">${escapeHtml(item.name)}</h3>
            <span class="badge ${item.availability_status === "available" ? "badge-success" : "badge-warning"}" style="font-size: 0.7rem;">
              ${escapeHtml(item.availability_status || "Available")}
            </span>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${escapeHtml(item.brand)} ${escapeHtml(item.model)} • 📍 ${escapeHtml(item.location)}
          </div>

          <div style="background: var(--bg-hover); padding: 0.65rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem;">
            <div>Machinery Only: <strong>$${Number(item.base_hire_rate).toFixed(2)}</strong> /day</div>
            <div>
              With Operator: ${item.operator_available && item.operator_inclusive_rate ? `<strong style="color: #10b981;">$${Number(item.operator_inclusive_rate).toFixed(2)}</strong> /day` : "<span style='color: var(--text-muted);'>Not offered</span>"}
            </div>
          </div>

          <!-- ACTIONS: ADVERTISE TOGGLE -->
          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            ${isSponsored ? `
              <button type="button" class="btn btn-outline btn-sm btn-stop-ad" data-id="${escapeHtml(item.id)}" style="flex: 1; border-color: #ef4444; color: #ef4444; font-weight: 700;">
                Stop Advertising
              </button>
            ` : `
              <button type="button" class="btn btn-primary btn-sm btn-start-ad" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 700;">
                ${icon("sparkles", 15)} <span>Advertise Machinery</span>
              </button>
            `}
          </div>

        </div>

      </div>
    `;
  },

  bindFleetCardActions(container) {
    container.querySelectorAll(".btn-start-ad").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        btn.textContent = "Activating Ad...";
        try {
          await MachineryService.promoteListing(id, 30);
          alert("Sponsored advertising activated! This listing is now promoted at the top of the marketplace and on passenger/driver dashboards.");
          this.loadFleet(container);
        } catch (err) {
          console.warn("Promotion error:", err);
          if (err.message && err.message.includes("Advertising is not included")) {
            if (confirm(err.message + "\n\nWould you like to view subscription plans now?")) {
              window.location.hash = "#subscriptions";
            }
          } else {
            alert("Could not activate advertising: " + err.message);
          }
        } finally {
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-stop-ad").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        btn.textContent = "Stopping Ad...";
        try {
          await MachineryService.stopPromotion(id);
          alert("Advertising paused for this machinery listing.");
          this.loadFleet(container);
        } catch (err) {
          alert("Could not stop advertising: " + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });
  },

  async loadRequests(container) {
    const feed = container.querySelector("#machinery-owner-requests-feed");
    if (!feed) return;

    try {
      this.hireRequests = await MachineryService.getOwnerHires();
      const pendingCount = this.hireRequests.filter((h) => h.status === "pending").length;
      const activeCount = this.hireRequests.filter((h) => h.status === "accepted" || h.status === "active").length;

      const kpiRequests = container.querySelector("#kpi-mac-requests");
      if (kpiRequests) kpiRequests.textContent = pendingCount;

      const kpiActive = container.querySelector("#kpi-mac-active-hires");
      if (kpiActive) kpiActive.textContent = activeCount;

      const badgeCount = container.querySelector("#badge-pending-hires-count");
      if (badgeCount) {
        if (pendingCount > 0) {
          badgeCount.textContent = pendingCount;
          badgeCount.style.display = "inline-block";
        } else {
          badgeCount.style.display = "none";
        }
      }

      if (this.hireRequests.length === 0) {
        feed.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-muted);">${icon("clipboard-list", 48)}</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No hire requests yet</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto;">
              When customers or contractors request your machinery, their proposals will appear here for you to accept or decline.
            </p>
          </div>
        `;
        return;
      }

      feed.innerHTML = this.hireRequests.map((req) => this.renderRequestRow(req)).join("");
      this.bindRequestActions(container);
    } catch (err) {
      console.warn("Requests load error:", err);
      feed.innerHTML = `<div style="color: #ef4444; padding: 1.5rem;">Failed to load requests: ${err.message}</div>`;
    }
  },

  renderRequestRow(req) {
    const isPending = req.status === "pending";
    const statusColor = req.status === "accepted" ? "#10b981" : req.status === "declined" ? "#ef4444" : "#f59e0b";

    return `
      <div class="card" style="border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid var(--border);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0;">${escapeHtml(req.machinery_name || "Machinery")}</h3>
              <span class="badge" style="background: ${statusColor}20; color: ${statusColor}; font-weight: 700; text-transform: uppercase;">
                ${escapeHtml(req.status)}
              </span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              Hirer: <strong>${escapeHtml(req.contact_name)}</strong> • 📞 ${escapeHtml(req.contact_phone || "No phone provided")}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.35rem; font-weight: 800; color: #10b981;">
              $${Number(req.calculated_total).toFixed(2)} USD
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">
              ${req.with_operator ? "🛡️ With Operator" : "Machinery Only"} • ${escapeHtml(req.duration_units)} day(s)
            </div>
          </div>
        </div>

        <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem;">
          <div>📍 <strong>Job Location:</strong> ${escapeHtml(req.job_location || "Not specified")}</div>
          ${req.notes ? `<div style="margin-top: 0.25rem;">📝 <strong>Notes:</strong> ${escapeHtml(req.notes)}</div>` : ""}
          <div style="margin-top: 0.25rem; font-size: 0.75rem; color: var(--text-muted);">
            Dates: ${new Date(req.start_date).toLocaleDateString()} to ${new Date(req.end_date).toLocaleDateString()}
          </div>
        </div>

        ${isPending ? `
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button type="button" class="btn btn-outline btn-sm btn-decline-hire" data-id="${escapeHtml(req.id)}" style="border-color: #ef4444; color: #ef4444; font-weight: 700; padding: 0.4rem 1rem;">
              Decline Request
            </button>
            <button type="button" class="btn btn-primary btn-sm btn-accept-hire" data-id="${escapeHtml(req.id)}" style="font-weight: 700; padding: 0.4rem 1.25rem;">
              Accept Request
            </button>
          </div>
        ` : `
          <div style="font-size: 0.8rem; color: var(--text-muted); text-align: right;">
            Request finalized on ${new Date(req.updated_at || req.created_at).toLocaleString()}
          </div>
        `}
      </div>
    `;
  },

  bindRequestActions(container) {
    container.querySelectorAll(".btn-accept-hire").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        btn.textContent = "Accepting...";
        try {
          await MachineryService.updateHireStatus(id, "accepted");
          alert("Hire request accepted successfully! Hirer has been notified.");
          this.loadRequests(container);
        } catch (err) {
          alert("Could not accept hire: " + err.message);
          btn.disabled = false;
          btn.textContent = "Accept Request";
        }
      });
    });

    container.querySelectorAll(".btn-decline-hire").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const reason = prompt("Enter reason for declining this hire request (optional):", "Equipment currently unavailable on these dates");
        if (reason === null) return; // user cancelled

        btn.disabled = true;
        btn.textContent = "Declining...";
        try {
          await MachineryService.updateHireStatus(id, "declined", reason);
          alert("Hire request declined.");
          this.loadRequests(container);
        } catch (err) {
          alert("Could not decline hire: " + err.message);
          btn.disabled = false;
          btn.textContent = "Decline Request";
        }
      });
    });
  }
};
