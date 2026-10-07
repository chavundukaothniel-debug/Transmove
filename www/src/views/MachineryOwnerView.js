// ==============================================================================
// TRANSMOVE MACHINERY OWNER VIEW
// Dedicated dashboard for heavy plant, agricultural & construction machinery owners.
// Supports complete listing creation & real inline editing via MachineryForm,
// Google Drive photo & doc management, availability controls, hire requests,
// sale enquiries, and high-contrast paid advertising via verified EcoCash.
// ==============================================================================
import { MachineryService } from "../services/machinery.js";
import { AuthService } from "../services/auth.js";
import { MachineryForm } from "../components/MachineryForm.js";
import { icon } from "../components/Icon.js";

const NEUTRAL_MACHINERY_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240" fill="none">
  <rect width="400" height="240" fill="#0f172a"/>
  <path d="M120 180H280M140 180L160 140H240L260 180M170 140V100H230V140M230 110H300L330 160H310" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="160" cy="180" r="14" fill="#1e293b" stroke="#10b981" stroke-width="4"/>
  <circle cx="240" cy="180" r="14" fill="#1e293b" stroke="#10b981" stroke-width="4"/>
  <text x="200" y="218" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="700">HEAVY MACHINERY</text>
</svg>
`);

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
  activeTab: "fleet", // 'fleet' | 'add' | 'requests' | 'enquiries'
  ownerListings: [],
  hireRequests: [],
  ownerEnquiries: [],
  currentProfile: null,
  activeEditingId: null,

  async render() {
    this.currentProfile = await AuthService.getCurrentProfile().catch(() => null);
    const activeRole = this.currentProfile?.activeRole || (this.currentProfile ? await AuthService.getActiveRole(this.currentProfile) : "guest");
    const isOwnerOrAdmin = activeRole === "machinery_owner" || this.currentProfile?.role === "admin";

    if (!isOwnerOrAdmin) {
      alert("Machinery management is available to Machinery Owner accounts.");
      setTimeout(() => {
        window.location.hash = "#machinery";
      }, 10);
      return `<div class="container" style="padding: 3rem; text-align: center; color: var(--text-muted);">Redirecting to Machinery Marketplace...</div>`;
    }

    return `
      <div class="machinery-owner-dashboard container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
        
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 14px; padding: 1.75rem; border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="badge" style="background: rgba(16,185,129,0.2); color: #10b981; border: 1px solid rgba(16,185,129,0.4); font-size: 0.75rem; font-weight: 700;">MACHINERY OWNER</span>
                <span style="font-size: 0.85rem; color: #94a3b8;">Heavy Plant &amp; Industrial Equipment Portal</span>
              </div>
              <h1 style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #ffffff;">Manage Your Machinery Fleet</h1>
              <p style="color: #94a3b8; font-size: 0.95rem; margin: 0; max-width: 600px;">
                List excavators, bulldozers, tippers, and tractors. Set multi-rate pricing, manage hire requests &amp; sale enquiries, and promote with sponsored ads.
              </p>
            </div>
            
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button type="button" id="btn-header-add-machinery" class="btn btn-primary" style="font-weight: 800; font-size: 0.95rem; padding: 0.65rem 1.25rem; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                ${icon("circle-plus", 20)} <span>+ Add Machinery</span>
              </button>
              <a href="#machinery" class="btn btn-outline" style="border-color: rgba(255,255,255,0.2); color: #ffffff; font-weight: 600;">
                ${icon("search", 18)} <span>Marketplace</span>
              </a>
              <a href="#subscriptions" class="btn btn-outline" style="border-color: rgba(255,255,255,0.2); color: #ffffff; font-weight: 600;">
                ${icon("credit-card", 18)} <span>Plans</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1.25rem; border-radius: 10px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Listed Equipment</div>
            <div id="kpi-mac-count" style="font-size: 1.75rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Active equipment</div>
          </div>
          <div class="card" style="padding: 1.25rem; border-radius: 10px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Hire Requests</div>
            <div id="kpi-mac-requests" style="font-size: 1.75rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Awaiting response</div>
          </div>
          <div class="card" style="padding: 1.25rem; border-radius: 10px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Sale Enquiries</div>
            <div id="kpi-mac-enquiries" style="font-size: 1.75rem; font-weight: 800; color: #8b5cf6; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Prospective buyers</div>
          </div>
          <div class="card" style="padding: 1.25rem; border-radius: 10px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Promoted Ads</div>
            <div id="kpi-mac-ads" style="font-size: 1.75rem; font-weight: 800; color: #3b82f6; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Active campaigns</div>
          </div>
        </div>

        <!-- NAVIGATION TABS -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; overflow-x: auto;">
          <button type="button" id="tab-btn-fleet" class="btn btn-outline btn-sm mac-tab-btn active" style="font-weight: 700; white-space: nowrap;">
            ${icon("tractor", 17)} <span>My Machinery Fleet</span>
          </button>
          <button type="button" id="tab-btn-add" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700; white-space: nowrap; color: #10b981; border-color: rgba(16,185,129,0.3);">
            ${icon("circle-plus", 17)} <span id="tab-add-label">+ Add Machinery</span>
          </button>
          <button type="button" id="tab-btn-requests" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700; white-space: nowrap;">
            ${icon("clipboard-list", 17)} <span>Rental Requests</span>
            <span id="badge-pending-hires-count" class="badge badge-warning" style="margin-left: 0.35rem; display: none;">0</span>
          </button>
          <button type="button" id="tab-btn-enquiries" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700; white-space: nowrap;">
            ${icon("message-circle", 17)} <span>Sale Enquiries</span>
            <span id="badge-pending-enquiries-count" class="badge badge-info" style="margin-left: 0.35rem; display: none;">0</span>
          </button>
        </div>

        <!-- SECTION 1: FLEET LISTINGS -->
        <div id="mac-section-fleet">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0;">Your Machinery Listings</h2>
            <button type="button" id="btn-grid-add-machinery" class="btn btn-primary btn-sm" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${icon("circle-plus", 16)} <span>+ Add Machinery</span>
            </button>
          </div>
          
          <div id="machinery-owner-fleet-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted); grid-column: 1 / -1;">
              Loading machinery fleet...
            </div>
          </div>
        </div>

        <!-- SECTION 2: ADD / EDIT MACHINERY FORM -->
        <div id="mac-section-add" style="display: none;">
          <div id="machinery-form-mount-point">
            ${MachineryForm.render(null)}
          </div>
        </div>

        <!-- SECTION 3: HIRE REQUESTS -->
        <div id="mac-section-requests" style="display: none;">
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 1rem 0;">Rental &amp; Hire Proposals</h2>
          <div id="machinery-owner-requests-feed">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Loading hire proposals...
            </div>
          </div>
        </div>

        <!-- SECTION 4: SALE ENQUIRIES -->
        <div id="mac-section-enquiries" style="display: none;">
          <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 1rem 0;">Purchase &amp; Sale Enquiries</h2>
          <div id="machinery-owner-enquiries-feed">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Loading purchase enquiries...
            </div>
          </div>
        </div>

      </div>

      <!-- MODAL: PROMOTE MACHINERY (HIGH-CONTRAST SOLID SURFACE) -->
      <div id="modal-promote-machinery" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; overflow-y: auto; padding: 1.25rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 540px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border-radius: 14px; padding: 1.5rem; margin: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem; color: #10b981;">
              ${icon("sparkles", 20)} <span>PROMOTE MACHINERY</span>
            </h3>
            <button type="button" id="btn-close-promote-modal" class="btn btn-outline btn-sm" style="min-height: 36px; min-width: 36px; padding: 0.25rem; font-weight: 800;">✕</button>
          </div>
          
          <div id="promote-modal-body"></div>
        </div>
      </div>

      <!-- MODAL: PHOTO MANAGER -->
      <div id="modal-photo-manager" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; overflow-y: auto; padding: 1.25rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 580px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border-radius: 14px; padding: 1.5rem; margin: auto; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem; color: #10b981;">
              ${icon("camera", 20)} <span>PHOTOS MANAGER</span>
            </h3>
            <button type="button" id="btn-close-photo-modal" class="btn btn-outline btn-sm" style="min-height: 36px; min-width: 36px; padding: 0.25rem; font-weight: 800;">✕</button>
          </div>
          <div id="photo-modal-body"></div>
        </div>
      </div>

      <!-- MODAL: DOCUMENT MANAGER -->
      <div id="modal-doc-manager" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; overflow-y: auto; padding: 1.25rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 580px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border-radius: 14px; padding: 1.5rem; margin: auto; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem; color: #3b82f6;">
              ${icon("shield-check", 20)} <span>EQUIPMENT DOCUMENTS</span>
            </h3>
            <button type="button" id="btn-close-doc-modal" class="btn btn-outline btn-sm" style="min-height: 36px; min-width: 36px; padding: 0.25rem; font-weight: 800;">✕</button>
          </div>
          <div id="doc-modal-body"></div>
        </div>
      </div>

      <!-- MODAL: AVAILABILITY MANAGER -->
      <div id="modal-avail-manager" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 9999; overflow-y: auto; padding: 1.25rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 440px; background: var(--bg-card, #ffffff); color: var(--text-main, #0f172a); border-radius: 14px; padding: 1.5rem; margin: auto; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 900; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
              ${icon("clock", 18)} <span>SET AVAILABILITY</span>
            </h3>
            <button type="button" id="btn-close-avail-modal" class="btn btn-outline btn-sm" style="min-height: 36px; min-width: 36px; padding: 0.25rem; font-weight: 800;">✕</button>
          </div>
          <div id="avail-modal-body"></div>
        </div>
      </div>
    `;
  },

  async init(containerArg = document) {
    const container = (containerArg && typeof containerArg.querySelector === "function") ? containerArg : document;
    try {
      this.currentProfile = await AuthService.getCurrentProfile().catch(() => null);
    } catch (_) {}

    this.bindTabs(container);
    this.initForm(container, null);
    await this.loadFleet(container);
    await this.loadRequests(container);
    await this.loadEnquiries(container);

    // Deep link tab handler
    const rawHash = window.location.hash || "";
    if (rawHash.includes("tab=add")) {
      container.querySelector("#tab-btn-add")?.click();
    } else if (rawHash.includes("tab=requests")) {
      container.querySelector("#tab-btn-requests")?.click();
    } else if (rawHash.includes("tab=enquiries")) {
      container.querySelector("#tab-btn-enquiries")?.click();
    }

    // Close modal handlers
    container.querySelector("#btn-close-promote-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-promote-machinery").style.display = "none";
    });
    container.querySelector("#btn-close-photo-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-photo-manager").style.display = "none";
    });
    container.querySelector("#btn-close-doc-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-doc-manager").style.display = "none";
    });
    container.querySelector("#btn-close-avail-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-avail-manager").style.display = "none";
    });
  },

  initForm(container, item = null) {
    const mountPoint = container.querySelector("#machinery-form-mount-point");
    if (!mountPoint) return;

    mountPoint.innerHTML = MachineryForm.render(item);
    MachineryForm.init(mountPoint, {
      onSubmitSuccess: async () => {
        this.activeEditingId = null;
        this.switchTab(container, "fleet");
        await this.loadFleet(container);
      },
      onCancel: () => {
        this.activeEditingId = null;
        this.switchTab(container, "fleet");
      }
    });

    const addLabel = container.querySelector("#tab-add-label");
    if (addLabel) {
      addLabel.textContent = item ? "Edit Machinery" : "+ Add Machinery";
    }
  },

  bindTabs(container) {
    const fleetBtn = container.querySelector("#tab-btn-fleet");
    const addBtn = container.querySelector("#tab-btn-add");
    const requestsBtn = container.querySelector("#tab-btn-requests");
    const enquiriesBtn = container.querySelector("#tab-btn-enquiries");
    const headerAddBtn = container.querySelector("#btn-header-add-machinery");
    const gridAddBtn = container.querySelector("#btn-grid-add-machinery");

    fleetBtn?.addEventListener("click", () => this.switchTab(container, "fleet"));
    addBtn?.addEventListener("click", () => {
      this.initForm(container, null);
      this.switchTab(container, "add");
    });
    headerAddBtn?.addEventListener("click", () => {
      this.initForm(container, null);
      this.switchTab(container, "add");
    });
    gridAddBtn?.addEventListener("click", () => {
      this.initForm(container, null);
      this.switchTab(container, "add");
    });

    requestsBtn?.addEventListener("click", () => this.switchTab(container, "requests"));
    enquiriesBtn?.addEventListener("click", () => this.switchTab(container, "enquiries"));
  },

  switchTab(container, tab) {
    this.activeTab = tab;
    const fleetBtn = container.querySelector("#tab-btn-fleet");
    const addBtn = container.querySelector("#tab-btn-add");
    const requestsBtn = container.querySelector("#tab-btn-requests");
    const enquiriesBtn = container.querySelector("#tab-btn-enquiries");

    fleetBtn?.classList.toggle("active", tab === "fleet");
    addBtn?.classList.toggle("active", tab === "add");
    requestsBtn?.classList.toggle("active", tab === "requests");
    enquiriesBtn?.classList.toggle("active", tab === "enquiries");

    const sFleet = container.querySelector("#mac-section-fleet");
    const sAdd = container.querySelector("#mac-section-add");
    const sReq = container.querySelector("#mac-section-requests");
    const sEnq = container.querySelector("#mac-section-enquiries");

    if (sFleet) sFleet.style.display = tab === "fleet" ? "block" : "none";
    if (sAdd) sAdd.style.display = tab === "add" ? "block" : "none";
    if (sReq) sReq.style.display = tab === "requests" ? "block" : "none";
    if (sEnq) sEnq.style.display = tab === "enquiries" ? "block" : "none";

    if (tab === "add") {
      sAdd?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },

  async loadFleet(containerArg) {
    const root = (containerArg && typeof containerArg.querySelector === "function") ? containerArg : document;
    const grid = root.querySelector("#machinery-owner-fleet-grid");
    if (!grid) return;

    try {
      this.ownerListings = await MachineryService.getOwnerListings();
      const kpiCount = root.querySelector("#kpi-mac-count");
      if (kpiCount) kpiCount.textContent = this.ownerListings.length;

      const activeAdsCount = this.ownerListings.filter((m) => m.is_sponsored).length;
      const kpiAds = root.querySelector("#kpi-mac-ads");
      if (kpiAds) kpiAds.textContent = activeAdsCount;

      if (this.ownerListings.length === 0) {
        grid.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
            <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">🚜</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">No Machinery in Your Fleet Yet</h3>
            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto;">
              Add your heavy machinery, plant, or agricultural equipment to start receiving rental requests and purchase enquiries.
            </p>
            <button type="button" class="btn btn-primary" id="btn-empty-add-machinery" style="font-weight: 700;">
              + Add Machinery
            </button>
          </div>
        `;
        grid.querySelector("#btn-empty-add-machinery")?.addEventListener("click", () => {
          this.initForm(root, null);
          this.switchTab(root, "add");
        });
        return;
      }

      grid.innerHTML = this.ownerListings.map((item) => this.renderFleetCard(item)).join("");
      this.bindFleetCardActions(root);
    } catch (err) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; color: #ef4444; text-align: center;" class="card">
          <h3>Your machinery fleet could not be loaded</h3><p>${escapeHtml(err.message)}</p><button type="button" class="btn btn-primary" id="retry-owner-fleet">Retry</button>
        </div>
      `;
      grid.querySelector("#retry-owner-fleet")?.addEventListener("click",()=>this.loadFleet(root));
    }
  },

  renderFleetCard(item) {
    const isSponsored = Boolean(item.is_sponsored);
    const photoUrl = item.primary_photo?.file_url || (Array.isArray(item.photos) && item.photos.length > 0 ? (item.photos[0].file_url || item.photos[0]) : NEUTRAL_MACHINERY_PLACEHOLDER);

    const rates = [];
    if (item.hourly_rate) rates.push(`$${Number(item.hourly_rate).toFixed(2)}/hr`);
    if (item.daily_rate || item.base_hire_rate) rates.push(`$${Number(item.daily_rate || item.base_hire_rate).toFixed(2)}/day`);
    if (item.weekly_rate) rates.push(`$${Number(item.weekly_rate).toFixed(2)}/wk`);
    if (item.monthly_rate) rates.push(`$${Number(item.monthly_rate).toFixed(2)}/mo`);

    const listingTypeLabel = item.listing_type === "sale" ? "FOR SALE" : (item.listing_type === "both" ? "FOR HIRE • FOR SALE" : "FOR HIRE");

    return `
      <div class="card machinery-owner-card" style="border-radius: 12px; overflow: hidden; padding: 0; border: ${isSponsored ? "2px solid #10b981" : "1px solid var(--border)"}; position: relative; display: flex; flex-direction: column;">
        
        <!-- SPONSORED ACTIVE BADGE -->
        ${isSponsored ? `
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; background: #10b981; color: #ffffff; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.5px; padding: 0.25rem 0.65rem; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            SPONSORED
          </div>
        ` : ""}

        <!-- PHOTO -->
        <div style="height: 180px; background: #0f172a; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${NEUTRAL_MACHINERY_PLACEHOLDER}'; this.style.objectFit='contain';" />
          <span class="badge" style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; font-weight: 700;">
            ${escapeHtml(listingTypeLabel)}
          </span>
        </div>

        <!-- DETAILS BODY -->
        <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
            <h3 style="font-size: 1.2rem; font-weight: 800; margin: 0; color: var(--text-main);">${escapeHtml(item.name)}</h3>
            <span class="badge ${item.availability_status === "available" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem; text-transform: capitalize; font-weight: 700;">
              ${escapeHtml(item.availability_status || "Available")}
            </span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            ${escapeHtml(item.category)} • 📍 ${escapeHtml(item.location || item.province || "Zimbabwe")}
          </div>

          <!-- VERIFICATION STATUS -->
          <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.75rem; font-size: 0.75rem;">
            <span style="color: var(--text-muted); font-weight: 600;">Verification:</span>
            <span class="badge ${item.verification_status === "approved" || item.verification_status === "verified" ? "badge-success" : "badge-warning"}" style="font-size: 0.7rem;">
              ${item.verification_status === "approved" || item.verification_status === "verified" ? "Approved · Live in marketplace" : item.verification_status === "rejected" ? "Rejected · Update and resubmit" : "Pending admin approval"}
            </span>
          </div>

          <div class="approval-feedback"><p>${item.verification_status === 'rejected' ? 'Admin feedback: '+escapeHtml(item.rejection_reason || 'Please contact support for the rejection details.') : ['approved','verified'].includes(item.verification_status) ? 'Customers can find and request this equipment while it is available.' : 'Your listing will appear in the marketplace after admin approval.'}</p>${item.verification_status === 'rejected' ? '<button type="button" class="btn btn-outline btn-sm btn-card-edit" data-id="'+escapeHtml(item.id)+'">Update and resubmit</button>' : ''}</div>
          <!-- PRICING SUMMARY -->
          <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem; border: 1px solid var(--border);">
            ${rates.length > 0 ? `
              <div style="margin-bottom: 0.25rem;">
                <span style="color: var(--text-muted);">Hire:</span> <strong>${rates.join(" • ")}</strong>
              </div>
            ` : ""}
            
            ${item.sale_price ? `
              <div style="margin-bottom: 0.25rem; color: #ec4899; font-weight: 700;">
                Sale: $${Number(item.sale_price).toLocaleString()}
              </div>
            ` : ""}

            <div>
              <span style="color: var(--text-muted);">Operator:</span> ${item.operator_available ? `<span style="color: #10b981; font-weight: 700;">Available</span>` : "<span style='color: var(--text-muted);'>Not available</span>"}
            </div>
          </div>

          <!-- ACTIONS BAR -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto;">
            
            <!-- ROW 1: ADVERTISE BUTTON -->
            <div style="display: flex; gap: 0.5rem;">
              ${isSponsored ? `
                <button type="button" class="btn btn-outline btn-sm btn-stop-ad" data-id="${escapeHtml(item.id)}" style="flex: 1; border-color: #ef4444; color: #ef4444; font-weight: 700; min-height: 44px;">
                  Pause Advertising
                </button>
              ` : `
                <button type="button" class="btn btn-primary btn-sm btn-advertise-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 800; min-height: 44px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                  ${icon("sparkles", 16)} <span>ADVERTISE</span>
                </button>
              `}
            </div>

            <!-- ROW 2: PRIMARY OWNER ACTIONS -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.35rem;">
              <a href="#machinery?id=${escapeHtml(item.id)}" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 0.45rem 0.2rem; text-align: center; font-weight: 700; min-height: 44px; display: flex; align-items: center; justify-content: center;">VIEW</a>
              <button type="button" class="btn btn-outline btn-sm btn-card-edit" data-id="${escapeHtml(item.id)}" style="font-size: 0.75rem; padding: 0.45rem 0.2rem; font-weight: 700; min-height: 44px;">EDIT</button>
              <button type="button" class="btn btn-outline btn-sm btn-card-photos" data-id="${escapeHtml(item.id)}" style="font-size: 0.75rem; padding: 0.45rem 0.2rem; font-weight: 700; min-height: 44px;">PHOTOS</button>
              <button type="button" class="btn btn-outline btn-sm btn-card-docs" data-id="${escapeHtml(item.id)}" style="font-size: 0.75rem; padding: 0.45rem 0.2rem; font-weight: 700; min-height: 44px;">DOCS</button>
            </div>

            <!-- ROW 3: MANAGEMENT ACTIONS -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem;">
              <button type="button" class="btn btn-outline btn-sm btn-toggle-avail" data-id="${escapeHtml(item.id)}" style="font-size: 0.72rem; padding: 0.45rem 0.2rem; font-weight: 600; min-height: 44px;">AVAILABILITY</button>
              <button type="button" class="btn btn-outline btn-sm btn-view-hires" data-id="${escapeHtml(item.id)}" style="font-size: 0.72rem; padding: 0.45rem 0.2rem; font-weight: 600; min-height: 44px;">HIRE REQS</button>
              <button type="button" class="btn btn-outline btn-sm btn-view-enqs" data-id="${escapeHtml(item.id)}" style="font-size: 0.72rem; padding: 0.45rem 0.2rem; font-weight: 600; min-height: 44px;">ENQUIRIES</button>
            </div>

          </div>

        </div>

      </div>
    `;
  },

  bindFleetCardActions(root) {
    // 1. EDIT BUTTON: Opens MachineryForm in edit mode
    root.querySelectorAll(".btn-card-edit").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = this.ownerListings.find((m) => m.id === id);
        if (!item) return;

        this.activeEditingId = id;
        this.initForm(root, item);
        this.switchTab(root, "add");
      });
    });

    // 2. PHOTOS BUTTON: Opens Photos Manager Modal
    root.querySelectorAll(".btn-card-photos").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = this.ownerListings.find((m) => m.id === id);
        if (item) this.openPhotoManagerModal(root, item);
      });
    });

    // 3. DOCS BUTTON: Opens Document Manager Modal
    root.querySelectorAll(".btn-card-docs").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = this.ownerListings.find((m) => m.id === id);
        if (item) this.openDocManagerModal(root, item);
      });
    });

    // 4. AVAILABILITY BUTTON: Opens Availability Selector Modal
    root.querySelectorAll(".btn-toggle-avail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = this.ownerListings.find((m) => m.id === id);
        if (item) this.openAvailabilityModal(root, item);
      });
    });

    // 5. ADVERTISE BUTTON: Opens Promote Modal with paid packages & EcoCash
    root.querySelectorAll(".btn-advertise-machinery").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const item = this.ownerListings.find((m) => m.id === id);
        if (item) this.openPromoteModal(root, item);
      });
    });

    // 6. PAUSE ADVERTISING
    root.querySelectorAll(".btn-stop-ad").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("Are you sure you want to pause advertising for this machinery?")) return;
        btn.disabled = true;
        btn.textContent = "Pausing...";
        try {
          await MachineryService.stopPromotion(id);
          alert("Advertising campaign paused.");
          await this.loadFleet(root);
        } catch (err) {
          alert("Error pausing ad: " + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });

    // 7. TAB SHORTCUTS
    root.querySelectorAll(".btn-view-hires").forEach((b) => {
      b.addEventListener("click", () => this.switchTab(root, "requests"));
    });
    root.querySelectorAll(".btn-view-enqs").forEach((b) => {
      b.addEventListener("click", () => this.switchTab(root, "enquiries"));
    });
  },

  // ============================================================================
  // PROMOTE MACHINERY MODAL (PART 11, 12, 13, 14, 18, 19)
  // High-contrast, solid surface, independent from subscriptions, paid EcoCash packages.
  // ============================================================================
  async openPromoteModal(root, item) {
    const modal = root.querySelector("#modal-promote-machinery");
    const body = root.querySelector("#promote-modal-body");
    if (!modal || !body) return;

    modal.style.display = "flex";

    // Load available advertising packages
    let packages = [
      { id: "pkg_7d", name: "7 Days Spotlight", duration_days: 7, price: 15, currency: "USD" },
      { id: "pkg_14d", name: "14 Days Featured", duration_days: 14, price: 25, currency: "USD" },
      { id: "pkg_30d", name: "30 Days Premier", duration_days: 30, price: 45, currency: "USD" }
    ];

    try {
      const res = await MachineryService.listAdPackages();
      if (Array.isArray(res.packages) && res.packages.length > 0) {
        packages = res.packages;
      }
    } catch (_) {}

    const photoUrl = item.primary_photo?.file_url || (Array.isArray(item.photos) && item.photos.length > 0 ? (item.photos[0].file_url || item.photos[0]) : NEUTRAL_MACHINERY_PLACEHOLDER);

    // STEP 1: PACKAGE SELECTION VIEW
    const renderStep1 = () => {
      body.innerHTML = `
        <div style="margin-bottom: 1.25rem;">
          <div style="display: flex; gap: 1rem; align-items: center; background: var(--bg-hover, #f1f5f9); padding: 0.85rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="width: 72px; height: 72px; border-radius: 8px; overflow: hidden; background: #0f172a; flex-shrink: 0;">
              <img src="${escapeHtml(photoUrl)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${NEUTRAL_MACHINERY_PLACEHOLDER}';" />
            </div>
            <div>
              <h4 style="font-size: 1.1rem; font-weight: 800; margin: 0 0 0.25rem 0; color: var(--text-main, #0f172a);">${escapeHtml(item.name)}</h4>
              <div style="font-size: 0.85rem; color: var(--text-muted, #64748b);">📍 ${escapeHtml(item.location || item.province || "Zimbabwe")} • ${escapeHtml(item.category)}</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <label style="font-weight: 800; font-size: 0.95rem; margin-bottom: 0.5rem; display: block; color: var(--text-main, #0f172a);">
            Choose Advertising Duration:
          </label>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <button type="button" id="btn-decrease" style="padding:0.3rem 0.6rem; font-size:1rem;">-</button>
            <input type="range" id="ad-duration-slider" min="1" max="720" value="24" style="flex:1;" />
            <button type="button" id="btn-increase" style="padding:0.3rem 0.6rem; font-size:1rem;">+</button>
            <span id="ad-duration-display" style="font-weight:800;"></span>
            <span id="ad-price-display" style="font-weight:800; margin-left:0.5rem;"></span>
          </div>
          <div style="margin-top:0.5rem;">
            <span style="font-weight:600;">Quick presets:</span>
            <button type="button" class="preset-btn" data-hours="1" style="margin:0 0.25rem;">1h</button>
            <button type="button" class="preset-btn" data-hours="6" style="margin:0 0.25rem;">6h</button>
            <button type="button" class="preset-btn" data-hours="12" style="margin:0 0.25rem;">12h</button>
            <button type="button" class="preset-btn" data-hours="24" style="margin:0 0.25rem;">24h</button>
            <button type="button" class="preset-btn" data-hours="48" style="margin:0 0.25rem;">48h</button>
            <button type="button" class="preset-btn" data-hours="168" style="margin:0 0.25rem;">7d</button>
            <button type="button" class="preset-btn" data-hours="336" style="margin:0 0.25rem;">14d</button>
            <button type="button" class="preset-btn" data-hours="720" style="margin:0 0.25rem;">30d</button>
          </div>

        </div>

        <div style="background: var(--bg-hover, #f8fafc); padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.85rem; border: 1px solid var(--border); line-height: 1.5; color: var(--text-main, #0f172a);">
          <div>✨ <strong>Placement:</strong> Featured Machinery banner</div>
          <div>🎯 <strong>Visibility:</strong> Passenger &amp; Driver dashboards, Top of Machinery Marketplace</div>
          <div>⏱️ <strong>Activation:</strong> Ad duration begins the moment admin approves your payment</div>
        </div>

        <button type="button" id="btn-ad-continue-payment" class="btn btn-primary" style="width: 100%; min-height: 46px; font-weight: 800; font-size: 1rem; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
          Continue to Payment
        </button>
      `;

      const slider = body.querySelector('#ad-duration-slider');
      const updateDuration = () => {
        const hours = Number(slider.value);
        body.querySelector('#ad-duration-display').textContent = hours + ' hour' + (hours === 1 ? '' : 's');
        body.querySelector('#ad-price-display').textContent = String.fromCharCode(36) + (hours * 2 / 24).toFixed(2);
      };
      slider.addEventListener('input', updateDuration);
      body.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', () => { slider.value = btn.dataset.hours; updateDuration(); }));
      for (const [id, delta] of [['btn-decrease', -1], ['btn-increase', 1]]) body.querySelector('#' + id).addEventListener('click', () => { slider.value = Math.min(720, Math.max(1, Number(slider.value) + delta)); updateDuration(); });
      updateDuration();
      body.querySelector("#btn-ad-continue-payment")?.addEventListener("click", () => {
        const slider = body.querySelector('#ad-duration-slider');
        const durationHours = Number(slider?.value || 24);
        const price = Number((durationHours * (2/24)).toFixed(2));
        const name = `${durationHours} Hour${durationHours !== 1 ? 's' : ''} Promotion`;
        renderStep2({
          id: "custom_dynamic",
          duration_hours: durationHours,
          duration_days: Math.ceil(durationHours / 24),
          price,
          name
        });
      });
    };

    // STEP 2: ECOCASH PAYMENT FLOW (PART 13, 14, 15)
    const renderStep2 = (selectedPkg) => {
      const destinations = [
        { id: "dest_nyasha", account_name: "Chavunduka Othniel Nyasha", account_number: "+263787692127" },
        { id: "dest_simba", account_name: "Simba Ernest Musasu", account_number: "+263786447601" }
      ];

      body.innerHTML = `
        <div style="margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); padding: 0.85rem 1rem; border-radius: 8px;">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #10b981;">Selected Package</div>
              <div style="font-weight: 800; font-size: 1.05rem; color: var(--text-main, #0f172a);">${escapeHtml(selectedPkg.name)}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted, #64748b);">${selectedPkg.duration_days} Days Promotion</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.5rem; font-weight: 900; color: #10b981;">$${selectedPkg.price}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">USD via EcoCash</div>
            </div>
          </div>
        </div>

        <form id="form-submit-ad-payment" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Destination Choice -->
          <div>
            <label style="font-weight: 800; font-size: 0.85rem; margin-bottom: 0.4rem; display: block; color: var(--text-main, #0f172a);">
              1. Select Official TransMove EcoCash Number:
            </label>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${destinations.map((d, i) => `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; background: var(--bg-card, #ffffff);">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="radio" name="ad_destination_id" value="${d.id}" data-num="${d.account_number}" data-name="${d.account_name}" ${i === 0 ? "checked" : ""} />
                    <div>
                      <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main, #0f172a);">${escapeHtml(d.account_name)}</div>
                      <div style="font-size: 0.8rem; font-family: monospace; color: #10b981; font-weight: 700;">${d.account_number}</div>
                    </div>
                  </div>
                  <span class="badge badge-success" style="font-size: 0.7rem;">Verified</span>
                </label>
              `).join("")}
            </div>
          </div>

          <!-- USSD Instructions -->
          <div style="background: var(--bg-hover, #f8fafc); border: 1px dashed var(--border); padding: 0.75rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.4; color: var(--text-main, #0f172a);">
            <strong>How to pay:</strong> Dial *151*1*1# on your EcoCash phone &gt; Send Money &gt; Enter chosen number &gt; Enter Amount: <strong>$${selectedPkg.price}</strong> &gt; Confirm with PIN. Copy the approval code below.
          </div>

          <!-- Payer Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.25rem; display: block; color: var(--text-main, #0f172a);">Sender Full Name *</label>
              <input type="text" id="ad-sender-name" class="form-input" placeholder="e.g. Kayler Chavunduka" style="min-height: 44px; width: 100%;" required />
            </div>
            <div>
              <label style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.25rem; display: block; color: var(--text-main, #0f172a);">Sender EcoCash Phone *</label>
              <input type="tel" id="ad-sender-phone" class="form-input" placeholder="e.g. 0771234567" style="min-height: 44px; width: 100%;" required />
            </div>
          </div>

          <!-- Transaction Reference -->
          <div>
            <label style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.25rem; display: block; color: var(--text-main, #0f172a);">EcoCash Approval / Reference Code *</label>
            <input type="text" id="ad-reference-code" class="form-input" placeholder="e.g. MP260925.1234.H00001" style="min-height: 44px; width: 100%; font-family: monospace;" required />
          </div>

          <!-- Proof file upload -->
          <div>
            <label style="font-weight: 700; font-size: 0.8rem; margin-bottom: 0.25rem; display: block; color: var(--text-main, #0f172a);">Payment Proof (Screenshot / SMS)</label>
            <input type="file" id="ad-proof-file" accept="image/*,.pdf" class="form-input" style="min-height: 44px; width: 100%;" />
          </div>

          <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
            <button type="button" id="btn-back-to-step1" class="btn btn-outline" style="flex: 1; min-height: 44px; font-weight: 700;">Back</button>
            <button type="submit" id="btn-submit-ad-final" class="btn btn-primary" style="flex: 2; min-height: 44px; font-weight: 800; font-size: 0.95rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
              Submit Payment for Verification
            </button>
          </div>
        </form>
      `;

      body.querySelector("#btn-back-to-step1")?.addEventListener("click", () => renderStep1());

      const form = body.querySelector("#form-submit-ad-payment");
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = body.querySelector("#btn-submit-ad-final");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting Proof...";

        try {
          const destRadio = form.querySelector("input[name='ad_destination_id']:checked");
          const destinationId = destRadio?.value || "dest_nyasha";
          const senderName = form.querySelector("#ad-sender-name").value.trim();
          const senderPhone = form.querySelector("#ad-sender-phone").value.trim();
          const reference = form.querySelector("#ad-reference-code").value.trim();
          const proofFileInput = form.querySelector("#ad-proof-file");
          const proofFile = proofFileInput?.files?.[0];

          let proofBase64 = null;
          let proofFilename = null;
          if (proofFile) {
            proofFilename = proofFile.name;
            proofBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(proofFile);
            });
          }

          const payload = {
            machinery_id: item.id,
            package_id: selectedPkg.id,
            duration_days: selectedPkg.duration_days,
            amount: selectedPkg.price,
            currency: "USD",
            destination_id: destinationId,
            sender_name: senderName,
            sender_phone: senderPhone,
            transaction_reference: reference,
            proof_base64: proofBase64,
            proof_filename: proofFilename
          };

          const res = await MachineryService.submitAdPayment(payload);
          modal.style.display = "none";
          alert(`Advertisement payment of $${selectedPkg.price} submitted successfully! Your advertisement will become active for ${selectedPkg.duration_days} days once verified by TransMove admin.`);
          await this.loadFleet(root);
        } catch (err) {
          alert("Error submitting payment proof: " + err.message);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Payment for Verification";
        }
      });
    };

    renderStep1();
  },

  // ============================================================================
  // PHOTOS MANAGER MODAL (PART 23)
  // Allows replacing main photo, adding gallery photos, and removing gallery photos.
  // ============================================================================
  openPhotoManagerModal(root, item) {
    const modal = root.querySelector("#modal-photo-manager");
    const body = root.querySelector("#photo-modal-body");
    if (!modal || !body) return;

    modal.style.display = "flex";

    let currentMain = item.primary_photo || { file_url: NEUTRAL_MACHINERY_PLACEHOLDER };
    let currentGallery = Array.isArray(item.gallery_photos)
      ? [...item.gallery_photos]
      : (Array.isArray(item.photos) && item.photos.length > 1 ? item.photos.slice(1).map(p => typeof p === "string" ? { file_url: p } : p) : []);

    const render = () => {
      body.innerHTML = `
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #10b981;">Main Machinery Photo</h4>
          <div style="display: flex; gap: 1rem; align-items: center; background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border);">
            <div style="width: 100px; height: 80px; border-radius: 6px; overflow: hidden; background: #0f172a; flex-shrink: 0;">
              <img id="pm-main-preview" src="${escapeHtml(currentMain?.file_url || NEUTRAL_MACHINERY_PLACEHOLDER)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${NEUTRAL_MACHINERY_PLACEHOLDER}';" />
            </div>
            <div>
              <input type="file" id="pm-main-file-input" accept="image/*" style="display: none;" />
              <button type="button" id="btn-pm-change-main" class="btn btn-outline btn-sm" style="font-weight: 700; min-height: 40px;">
                ${icon("upload", 16)} <span>Change Main Photo</span>
              </button>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">Displayed prominently across listings &amp; ads</div>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <h4 style="font-size: 0.95rem; font-weight: 800; margin: 0; color: var(--text-main);">Gallery Photos (${currentGallery.length})</h4>
            <input type="file" id="pm-gallery-file-input" accept="image/*" multiple style="display: none;" />
            <button type="button" id="btn-pm-add-gallery" class="btn btn-outline btn-sm" style="font-weight: 700; min-height: 38px;">
              ${icon("plus", 15)} <span>+ Add Photos</span>
            </button>
          </div>

          <div id="pm-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.65rem;">
            ${currentGallery.length === 0 ? `
              <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted); background: var(--bg-hover); border-radius: 8px; font-size: 0.85rem;">
                No additional gallery photos. Click "+ Add Photos" to upload.
              </div>
            ` : currentGallery.map((g, idx) => `
              <div style="position: relative; border-radius: 6px; overflow: hidden; height: 80px; border: 1px solid var(--border);">
                <img src="${escapeHtml(g.file_url || g)}" style="width: 100%; height: 100%; object-fit: cover;" />
                <button type="button" class="btn-pm-del-gal" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.9); color: #fff; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
              </div>
            `).join("")}
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button type="button" id="btn-pm-cancel" class="btn btn-outline" style="flex: 1; min-height: 44px; font-weight: 700;">Cancel</button>
          <button type="button" id="btn-pm-save" class="btn btn-primary" style="flex: 2; min-height: 44px; font-weight: 800;">Save Photos</button>
        </div>
      `;

      // Main photo file upload
      const mainInput = body.querySelector("#pm-main-file-input");
      body.querySelector("#btn-pm-change-main")?.addEventListener("click", () => mainInput?.click());
      mainInput?.addEventListener("change", async () => {
        const file = mainInput.files?.[0];
        if (!file) return;
        const btn = body.querySelector("#btn-pm-change-main");
        btn.disabled = true;
        btn.textContent = "Uploading...";
        try {
          const res = await MachineryService.uploadPhoto(file);
          currentMain = res;
          render();
        } catch (err) {
          alert("Photo upload failed: " + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      // Gallery photos file upload
      const galInput = body.querySelector("#pm-gallery-file-input");
      body.querySelector("#btn-pm-add-gallery")?.addEventListener("click", () => galInput?.click());
      galInput?.addEventListener("change", async () => {
        const files = Array.from(galInput.files || []);
        if (files.length === 0) return;
        const btn = body.querySelector("#btn-pm-add-gallery");
        btn.disabled = true;
        btn.textContent = `Uploading ${files.length}...`;
        try {
          for (const f of files) {
            const res = await MachineryService.uploadPhoto(f);
            currentGallery.push(res);
          }
          render();
        } catch (err) {
          alert("Gallery upload failed: " + err.message);
        } finally {
          btn.disabled = false;
        }
      });

      // Remove gallery photo
      body.querySelectorAll(".btn-pm-del-gal").forEach((b) => {
        b.addEventListener("click", () => {
          const idx = Number(b.getAttribute("data-index"));
          currentGallery.splice(idx, 1);
          render();
        });
      });

      body.querySelector("#btn-pm-cancel")?.addEventListener("click", () => {
        modal.style.display = "none";
      });

      // Save photos to backend
      body.querySelector("#btn-pm-save")?.addEventListener("click", async () => {
        const saveBtn = body.querySelector("#btn-pm-save");
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";
        try {
          await MachineryService.updateListing(item.id, {
            primary_photo: currentMain,
            gallery_photos: currentGallery,
            photos: [currentMain, ...currentGallery]
          });
          modal.style.display = "none";
          alert("Machinery photos updated successfully!");
          await this.loadFleet(root);
        } catch (err) {
          alert("Error saving photos: " + err.message);
        } finally {
          saveBtn.disabled = false;
        }
      });
    };

    render();
  },

  // ============================================================================
  // DOCUMENT MANAGER MODAL (PART 24)
  // Shows documents, allows adding/replacing without resetting owner profile.
  // ============================================================================
  openDocManagerModal(root, item) {
    const modal = root.querySelector("#modal-doc-manager");
    const body = root.querySelector("#doc-modal-body");
    if (!modal || !body) return;

    modal.style.display = "flex";

    const DOC_TYPES = [
      "Proof of Ownership",
      "Registration / Serial Number Document",
      "Insurance",
      "Inspection / Safety Certificate",
      "Other Document"
    ];

    let docs = Array.isArray(item.documents) ? [...item.documents] : [];

    const render = () => {
      body.innerHTML = `
        <div style="margin-bottom: 1.25rem;">
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
            Ownership and compliance documents for <strong>${escapeHtml(item.name)}</strong>. Documents are strictly private and reviewed exclusively by TransMove admins.
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem;">
            ${docs.length === 0 ? `
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); background: var(--bg-hover); border-radius: 8px;">
                No documents uploaded for this machine yet.
              </div>
            ` : docs.map((d) => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.65rem;">
                  ${icon("file-text", 20)}
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(d.original_filename || d.filename || d.document_type || "Document")}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.document_type || "Document")}</div>
                  </div>
                </div>
                <span class="badge ${d.verification_status === "verified" || d.verification_status === "approved" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem; text-transform: capitalize;">
                  ${escapeHtml(d.verification_status || "Pending Verification")}
                </span>
              </div>
            `).join("")}
          </div>

          <div style="border-top: 1px solid var(--border); padding-top: 1rem;">
            <label style="font-weight: 800; font-size: 0.85rem; margin-bottom: 0.4rem; display: block; color: var(--text-main);">Upload / Replace Document</label>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;">
              <select id="dm-doc-type" class="form-select" style="min-height: 44px;">
                ${DOC_TYPES.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("")}
              </select>
              <input type="file" id="dm-file-input" accept=".pdf,image/*" style="display: none;" />
              <button type="button" id="btn-dm-browse" class="btn btn-outline" style="font-weight: 700; min-height: 44px;">
                ${icon("upload", 16)} <span>Browse</span>
              </button>
            </div>
            <div id="dm-selected-file-label" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;"></div>

            <button type="button" id="btn-dm-upload-doc" class="btn btn-primary" style="width: 100%; min-height: 44px; font-weight: 800;" disabled>
              Upload Document
            </button>
          </div>
        </div>
      `;

      let selectedFile = null;
      const fileInput = body.querySelector("#dm-file-input");
      const browseBtn = body.querySelector("#btn-dm-browse");
      const label = body.querySelector("#dm-selected-file-label");
      const uploadBtn = body.querySelector("#btn-dm-upload-doc");

      browseBtn?.addEventListener("click", () => fileInput?.click());
      fileInput?.addEventListener("change", () => {
        selectedFile = fileInput.files?.[0];
        if (selectedFile) {
          label.textContent = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`;
          uploadBtn.disabled = false;
        } else {
          label.textContent = "";
          uploadBtn.disabled = true;
        }
      });

      uploadBtn?.addEventListener("click", async () => {
        if (!selectedFile) return;
        const docType = body.querySelector("#dm-doc-type").value;
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading to Private Storage...";

        try {
          const res = await MachineryService.uploadDocument(selectedFile, docType, item.id);
          docs.push(res);
          render();
          alert(`Document "${selectedFile.name}" uploaded successfully! It is now pending review.`);
          await this.loadFleet(root);
        } catch (err) {
          alert("Document upload failed: " + err.message);
        } finally {
          uploadBtn.disabled = false;
        }
      });
    };

    render();
  },

  // ============================================================================
  // AVAILABILITY SELECTOR MODAL (PART 25)
  // Available | Booked | Under Maintenance | Unavailable
  // ============================================================================
  openAvailabilityModal(root, item) {
    const modal = root.querySelector("#modal-avail-manager");
    const body = root.querySelector("#avail-modal-body");
    if (!modal || !body) return;

    modal.style.display = "flex";

    const statuses = [
      { id: "available", label: "Available", desc: "Open for rental hire and sale enquiries" },
      { id: "booked", label: "Booked", desc: "Currently hired or deployed on a project" },
      { id: "maintenance", label: "Under Maintenance", desc: "Temporarily offline for scheduled servicing" },
      { id: "unavailable", label: "Unavailable", desc: "Not currently taking any new bookings" }
    ];

    const currentStatus = item.availability_status || "available";

    body.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
          Update operational status for <strong>${escapeHtml(item.name)}</strong>:
        </p>

        <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem;">
          ${statuses.map((s) => `
            <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; border: 2px solid ${s.id === currentStatus ? "#10b981" : "var(--border)"}; border-radius: 8px; cursor: pointer; background: var(--bg-card);">
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <input type="radio" name="opt_avail_choice" value="${s.id}" ${s.id === currentStatus ? "checked" : ""} />
                <div>
                  <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(s.label)}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(s.desc)}</div>
                </div>
              </div>
            </label>
          `).join("")}
        </div>

        <div style="display: flex; gap: 0.75rem;">
          <button type="button" id="btn-avail-cancel" class="btn btn-outline" style="flex: 1; min-height: 44px; font-weight: 700;">Cancel</button>
          <button type="button" id="btn-avail-save" class="btn btn-primary" style="flex: 2; min-height: 44px; font-weight: 800;">Save Status</button>
        </div>
      </div>
    `;

    body.querySelector("#btn-avail-cancel")?.addEventListener("click", () => {
      modal.style.display = "none";
    });

    body.querySelector("#btn-avail-save")?.addEventListener("click", async () => {
      const selected = body.querySelector("input[name='opt_avail_choice']:checked")?.value;
      if (!selected) return;

      const saveBtn = body.querySelector("#btn-avail-save");
      saveBtn.disabled = true;
      saveBtn.textContent = "Updating...";

      try {
        await MachineryService.updateListing(item.id, { availability_status: selected });
        modal.style.display = "none";
        alert(`Status updated to "${selected}"!`);
        await this.loadFleet(root);
      } catch (err) {
        alert("Error updating status: " + err.message);
      } finally {
        saveBtn.disabled = false;
      }
    });
  },

  async loadRequests(container) {
    const feed = container.querySelector("#machinery-owner-requests-feed");
    if (!feed) return;

    try {
      this.hireRequests = await MachineryService.getOwnerHires();
      const kpiRequests = container.querySelector("#kpi-mac-requests");
      const badgeRequests = container.querySelector("#badge-pending-hires-count");

      const pendingCount = this.hireRequests.filter((r) => r.status === "pending").length;
      if (kpiRequests) kpiRequests.textContent = pendingCount;
      if (badgeRequests) {
        badgeRequests.textContent = pendingCount;
        badgeRequests.style.display = pendingCount > 0 ? "inline-block" : "none";
      }

      if (this.hireRequests.length === 0) {
        feed.innerHTML = `
          <div class="card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
            ${icon("clipboard-list", 32)}
            <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0.75rem 0 0.25rem 0; color: var(--text-main);">No Hire Proposals Yet</h3>
            <p style="margin: 0; font-size: 0.9rem;">When contractors or customers request to hire your equipment, their proposals will appear here for you to accept or decline.</p>
          </div>
        `;
        return;
      }

      feed.innerHTML = this.hireRequests.map((req) => `
        <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="badge ${req.status === "pending" ? "badge-warning" : (req.status === "accepted" ? "badge-success" : "badge-outline")}" style="font-size: 0.75rem; text-transform: uppercase;">
                ${escapeHtml(req.status)}
              </span>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0.35rem 0 0 0;">
                ${escapeHtml(req.machinery_name || req.machinery?.name || "Machinery Hire")}
              </h3>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1.25rem; font-weight: 800; color: #10b981;">$${Number(req.calculated_total).toFixed(2)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(req.duration_units)} ${escapeHtml(req.rate_period || "day")}(s)</div>
            </div>
          </div>

          <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.85rem; line-height: 1.5;">
            <div>👤 <strong>Hirer:</strong> ${escapeHtml(req.contact_name)} (${escapeHtml(req.contact_phone || "Phone provided on acceptance")})</div>
            <div>📍 <strong>Job Location:</strong> ${escapeHtml(req.job_location || "Not specified")}</div>
            <div>⚙️ <strong>Operator:</strong> ${req.with_operator ? "<span style='color: #10b981; font-weight: 700;'>With certified operator</span>" : "Machinery only (Hirer provides operator)"}</div>
            ${req.notes ? `<div>📝 <strong>Hirer Notes:</strong> "${escapeHtml(req.notes)}"</div>` : ""}
          </div>

          ${req.status === "pending" ? `
            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              <button type="button" class="btn btn-primary btn-sm btn-accept-hire" data-id="${escapeHtml(req.id)}" style="flex: 1; font-weight: 700; min-height: 44px;">
                Accept Proposal
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-decline-hire" data-id="${escapeHtml(req.id)}" style="flex: 1; font-weight: 700; color: #ef4444; border-color: rgba(239,68,68,0.3); min-height: 44px;">
                Decline
              </button>
            </div>
          ` : ""}
        </div>
      `).join("");

      feed.querySelectorAll(".btn-accept-hire").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = b.getAttribute("data-id");
          try {
            await MachineryService.updateHireStatus(id, "accepted");
            alert("Hire proposal accepted! Contact details shared with hirer.");
            await this.loadRequests(container);
          } catch (err) {
            alert("Error: " + err.message);
          }
        });
      });

      feed.querySelectorAll(".btn-decline-hire").forEach((b) => {
        b.addEventListener("click", async () => {
          const id = b.getAttribute("data-id");
          const reason = prompt("Please provide a reason for declining:", "Equipment currently committed to another project.");
          if (reason === null) return;
          try {
            await MachineryService.updateHireStatus(id, "declined", reason);
            alert("Hire proposal declined.");
            await this.loadRequests(container);
          } catch (err) {
            alert("Error: " + err.message);
          }
        });
      });
    } catch (err) {
      feed.innerHTML = `<div style="padding: 1.5rem; color: #ef4444;">Error loading hire requests: ${escapeHtml(err.message)}</div>`;
    }
  },

  async loadEnquiries(container) {
    const feed = container.querySelector("#machinery-owner-enquiries-feed");
    if (!feed) return;

    try {
      this.ownerEnquiries = await MachineryService.getOwnerEnquiries();
      const kpiEnquiries = container.querySelector("#kpi-mac-enquiries");
      const badgeEnquiries = container.querySelector("#badge-pending-enquiries-count");

      if (kpiEnquiries) kpiEnquiries.textContent = this.ownerEnquiries.length;
      if (badgeEnquiries) {
        badgeEnquiries.textContent = this.ownerEnquiries.length;
        badgeEnquiries.style.display = this.ownerEnquiries.length > 0 ? "inline-block" : "none";
      }

      if (this.ownerEnquiries.length === 0) {
        feed.innerHTML = `
          <div class="card" style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
            ${icon("message-circle", 32)}
            <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0.75rem 0 0.25rem 0; color: var(--text-main);">No Sale Enquiries Yet</h3>
            <p style="margin: 0; font-size: 0.9rem;">Enquiries from prospective equipment buyers will appear here.</p>
          </div>
        `;
        return;
      }

      feed.innerHTML = this.ownerEnquiries.map((enq) => `
        <div class="card" style="margin-bottom: 1rem; padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span class="badge badge-info" style="font-size: 0.75rem; text-transform: uppercase;">
                ${escapeHtml(enq.enquiry_type || "Sale Enquiry")}
              </span>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0.35rem 0 0 0;">
                ${escapeHtml(enq.machinery?.name || "Equipment Sale Enquiry")}
              </h3>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              ${new Date(enq.created_at).toLocaleDateString()}
            </div>
          </div>

          <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; font-size: 0.85rem; line-height: 1.5;">
            <div>👤 <strong>Prospective Buyer:</strong> ${escapeHtml(enq.contact_name)}</div>
            ${enq.contact_phone ? `<div>📞 <strong>Phone:</strong> <a href="tel:${escapeHtml(enq.contact_phone)}">${escapeHtml(enq.contact_phone)}</a></div>` : ""}
            ${enq.contact_email ? `<div>✉️ <strong>Email:</strong> <a href="mailto:${escapeHtml(enq.contact_email)}">${escapeHtml(enq.contact_email)}</a></div>` : ""}
            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px dashed var(--border);">
              💬 <strong>Message:</strong> "${escapeHtml(enq.message)}"
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      feed.innerHTML = `<div style="padding: 1.5rem; color: #ef4444;">Error loading enquiries: ${escapeHtml(err.message)}</div>`;
    }
  }
};
