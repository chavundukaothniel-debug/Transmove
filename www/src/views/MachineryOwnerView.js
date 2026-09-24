// ==============================================================================
// TRANSMOVE MACHINERY OWNER VIEW
// Dedicated dashboard for heavy plant, agricultural & construction machinery owners.
// Supports complete listing creation (Sections A-K), multi-rate pricing,
// operator pricing, Google Drive photo & doc uploads, hire request lifecycle,
// sale enquiries, and sponsored machinery advertising promotion with plan enforcement.
// ==============================================================================
import { MachineryService, MACHINERY_CATEGORIES } from "../services/machinery.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { icon } from "../components/Icon.js";

const ZIM_PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands"
];

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
  mainPhotoData: null,
  galleryPhotosData: [],
  uploadedDocsData: [],
  currentProfile: null,

  async render() {
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
            ${icon("circle-plus", 17)} <span>+ Add Machinery</span>
          </button>
          <button type="button" id="tab-btn-requests" class="btn btn-outline btn-sm mac-tab-btn" style="font-weight: 700; white-space: nowrap;">
            ${icon("clipboard-list", 17)} <span>Hire Requests</span>
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

        <!-- SECTION 2: ADD MACHINERY FORM -->
        <div id="mac-section-add" style="display: none;">
          <div class="card" style="max-width: 860px; margin: 0 auto; padding: 1.75rem; border-radius: 14px; box-shadow: var(--shadow-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
              <div>
                <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                  ${icon("circle-plus", 22)} <span>List Heavy Machinery</span>
                </h2>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0 0;">Fill in technical details, multi-rate pricing, photos, and ownership documents.</p>
              </div>
              <button type="button" id="btn-cancel-add-top" class="btn btn-outline btn-sm">Cancel</button>
            </div>

            <form id="form-add-machinery">
              
              <!-- SECTION A: MACHINE DETAILS -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 1rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("tractor", 18)} A. Machine Details
                </div>

                <div class="form-group" style="margin-bottom: 1rem;">
                  <label class="form-label" style="font-weight: 700;">Machine Category *</label>
                  <select id="add-mac-category" class="form-select" style="min-height: 44px;" required>
                    <option value="">Select Category...</option>
                    ${MACHINERY_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}
                  </select>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Brand / Manufacturer *</label>
                    <input type="text" id="add-mac-brand" class="form-input" placeholder="e.g. Caterpillar, Komatsu, JCB" style="min-height: 44px;" required />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Model *</label>
                    <input type="text" id="add-mac-model" class="form-input" placeholder="e.g. 320D, D6R, 3CX" style="min-height: 44px;" required />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Year</label>
                    <input type="number" id="add-mac-year" class="form-input" placeholder="e.g. 2018" min="1970" max="2030" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Condition *</label>
                    <select id="add-mac-condition" class="form-select" style="min-height: 44px;" required>
                      <option value="New">New</option>
                      <option value="Excellent" selected>Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Operating Hours</label>
                    <input type="number" id="add-mac-hours" class="form-input" placeholder="e.g. 2400" min="0" style="min-height: 44px;" />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Fuel Type</label>
                    <select id="add-mac-fuel" class="form-select" style="min-height: 44px;">
                      <option value="Diesel" selected>Diesel</option>
                      <option value="Petrol">Petrol</option>
                      <option value="Electric">Electric</option>
                      <option value="Hybrid">Hybrid</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Power Rating</label>
                    <input type="text" id="add-mac-power" class="form-input" placeholder="e.g. 110 kW / 148 HP" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Capacity</label>
                    <input type="text" id="add-mac-capacity" class="form-input" placeholder="e.g. 20 Tonnes / 1.2 m³" style="min-height: 44px;" />
                  </div>
                </div>
              </div>

              <!-- SECTION B: LOCATION -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 1rem; color: #3b82f6; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("map-pin", 18)} B. Location
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Province *</label>
                    <select id="add-mac-province" class="form-select" style="min-height: 44px;" required>
                      ${ZIM_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === "Harare" ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Town / City / Base Location *</label>
                    <input type="text" id="add-mac-location" class="form-input" placeholder="e.g. Msasa, Harare / Gweru Industrial" style="min-height: 44px;" required />
                  </div>
                </div>
              </div>

              <!-- SECTION C: LISTING TYPE -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.75rem; color: #8b5cf6; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("tag", 18)} C. Listing Type
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">Choose whether this machinery is available for hire, outright sale, or both.</p>

                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                  <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.65rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                    <input type="radio" name="listing_type" value="hire" checked />
                    <span>For Hire</span>
                  </label>
                  <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.65rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                    <input type="radio" name="listing_type" value="sale" />
                    <span>For Sale</span>
                  </label>
                  <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.65rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                    <input type="radio" name="listing_type" value="both" />
                    <span>Both (Hire &amp; Sale)</span>
                  </label>
                </div>
              </div>

              <!-- SECTION D: HIRE PRICING (MULTI-RATE) -->
              <div id="section-hire-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("wallet", 18)} D. Hire Rates (Machinery Only)
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">Enter rates for hire periods you support. At least one rate must be provided.</p>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Price per Hour ($)</label>
                    <input type="number" id="add-mac-rate-hourly" class="form-input" placeholder="e.g. 45.00" min="0" step="0.5" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Price per Day ($)</label>
                    <input type="number" id="add-mac-rate-daily" class="form-input" placeholder="e.g. 250.00" min="0" step="1" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Price per Week ($)</label>
                    <input type="number" id="add-mac-rate-weekly" class="form-input" placeholder="e.g. 1500.00" min="0" step="10" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Price per Month ($)</label>
                    <input type="number" id="add-mac-rate-monthly" class="form-input" placeholder="e.g. 5000.00" min="0" step="50" style="min-height: 44px;" />
                  </div>
                </div>
              </div>

              <!-- SECTION E: OPERATOR PRICING -->
              <div id="section-operator-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="font-weight: 800; font-size: 1rem; color: #f59e0b; display: flex; align-items: center; gap: 0.4rem;">
                    ${icon("user-check", 18)} E. Operator Pricing
                  </div>
                  <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 700;">
                    <span>Operator Available?</span>
                    <input type="checkbox" id="add-mac-operator-available" style="width: 20px; height: 20px;" />
                  </label>
                </div>
                
                <div id="container-operator-rates" style="display: none; border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: 0.5rem;">
                  <p style="font-size: 0.85rem; color: #f59e0b; margin: 0 0 1rem 0; font-weight: 600;">
                    Rule: Each operator-inclusive rate must be strictly greater than the machinery-only rate for the same period.
                  </p>
                  
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
                    <div class="form-group">
                      <label class="form-label" style="font-weight: 700;">With Operator / Hour ($)</label>
                      <input type="number" id="add-mac-op-hourly" class="form-input" placeholder="e.g. 60.00" min="0" step="0.5" style="min-height: 44px;" />
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-weight: 700;">With Operator / Day ($)</label>
                      <input type="number" id="add-mac-op-daily" class="form-input" placeholder="e.g. 320.00" min="0" step="1" style="min-height: 44px;" />
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-weight: 700;">With Operator / Week ($)</label>
                      <input type="number" id="add-mac-op-weekly" class="form-input" placeholder="e.g. 1900.00" min="0" step="10" style="min-height: 44px;" />
                    </div>
                    <div class="form-group">
                      <label class="form-label" style="font-weight: 700;">With Operator / Month ($)</label>
                      <input type="number" id="add-mac-op-monthly" class="form-input" placeholder="e.g. 6200.00" min="0" step="50" style="min-height: 44px;" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- SECTION F: SALE PRICE -->
              <div id="section-sale-price" style="display: none; margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #ec4899; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("badge-dollar-sign", 18)} F. Sale Price
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">Outright purchase price in USD. Prospective buyers will submit purchase enquiries.</p>

                <div class="form-group" style="max-width: 320px;">
                  <label class="form-label" style="font-weight: 700;">Sale Price ($ USD) *</label>
                  <input type="number" id="add-mac-sale-price" class="form-input" placeholder="e.g. 45000.00" min="1" step="100" style="min-height: 44px;" />
                </div>
              </div>

              <!-- SECTION G: TRANSPORT -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                  <div style="font-weight: 800; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                    ${icon("truck", 18)} G. Transport / Lowbed Delivery
                  </div>
                  <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 700;">
                    <span>Delivery Available?</span>
                    <input type="checkbox" id="add-mac-transport-available" style="width: 20px; height: 20px;" />
                  </label>
                </div>

                <div class="form-group" style="margin-top: 0.5rem;">
                  <label class="form-label" style="font-weight: 700;">Transport Notes / Conditions</label>
                  <input type="text" id="add-mac-transport-notes" class="form-input" placeholder="e.g. Lowbed delivery available at $3.50/km. Self-collection from Msasa yard accepted." style="min-height: 44px;" />
                </div>
              </div>

              <!-- SECTION H: MINIMUM HIRE -->
              <div id="section-minimum-hire" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("clock", 18)} H. Minimum Hire Period
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Minimum Quantity</label>
                    <input type="number" id="add-mac-min-qty" class="form-input" value="1" min="1" style="min-height: 44px;" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" style="font-weight: 700;">Minimum Unit</label>
                    <select id="add-mac-min-unit" class="form-select" style="min-height: 44px;">
                      <option value="days" selected>Days</option>
                      <option value="hours">Hours</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- SECTION I: DESCRIPTION -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("file-text", 18)} I. Description
                </div>
                <div class="form-group">
                  <textarea id="add-mac-description" class="form-input" rows="4" placeholder="Describe machinery condition, attachments included (e.g. standard digging bucket, rock bucket, hydraulic breaker, ripper shank), maintenance history, and site requirements..."></textarea>
                </div>
              </div>

              <!-- SECTION J: PHOTOS (GOOGLE DRIVE STORAGE) -->
              <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("camera", 18)} J. Machinery Photos
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">Stored privately via Google Drive. Main photo is required. You can add multiple gallery photos.</p>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
                  <!-- Main Photo -->
                  <div class="card" style="padding: 1rem; border: 2px dashed #10b981; background: var(--bg-card); border-radius: 8px;">
                    <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem; color: #10b981;">Main / Primary Photo *</div>
                    <input type="file" id="add-mac-main-photo-input" accept="image/*" style="display: none;" />
                    <button type="button" id="btn-select-main-photo" class="btn btn-outline btn-sm" style="width: 100%; min-height: 44px; font-weight: 600;">
                      ${icon("upload", 16)} <span>Select Main Photo</span>
                    </button>
                    <div id="preview-main-photo" style="margin-top: 0.75rem; text-align: center; display: none;">
                      <img id="img-main-preview" src="" style="width: 100%; height: 140px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border);" />
                      <div id="txt-main-filename" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; word-break: break-all;"></div>
                    </div>
                  </div>

                  <!-- Gallery Photos -->
                  <div class="card" style="padding: 1rem; border: 2px dashed var(--border); background: var(--bg-card); border-radius: 8px;">
                    <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">Additional Gallery Photos</div>
                    <input type="file" id="add-mac-gallery-photos-input" accept="image/*" multiple style="display: none;" />
                    <button type="button" id="btn-select-gallery-photos" class="btn btn-outline btn-sm" style="width: 100%; min-height: 44px; font-weight: 600;">
                      ${icon("images", 16)} <span>Add Gallery Photos</span>
                    </button>
                    <div id="preview-gallery-container" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;"></div>
                  </div>
                </div>
              </div>

              <!-- SECTION K: OWNERSHIP & VERIFICATION DOCUMENTS -->
              <div style="margin-bottom: 1.75rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
                <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #3b82f6; display: flex; align-items: center; gap: 0.4rem;">
                  ${icon("shield-check", 18)} K. Ownership &amp; Verification Documents
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
                  Upload proof of ownership (Registration book, invoice/receipt, serial number plate photo, insurance or safety inspection). Verified owners receive a verified badge.
                </p>

                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
                  <select id="add-mac-doc-type" class="form-select" style="flex: 1; min-width: 200px; min-height: 44px;">
                    <option value="ownership_proof">Proof of Ownership / Invoice</option>
                    <option value="registration">Registration / Serial Number Plate</option>
                    <option value="insurance">Insurance Certificate</option>
                    <option value="inspection">Safety / Mechanical Inspection</option>
                    <option value="other">Other Supporting Document</option>
                  </select>
                  <input type="file" id="add-mac-doc-input" accept=".pdf,image/*" style="display: none;" />
                  <button type="button" id="btn-select-doc" class="btn btn-outline btn-sm" style="min-height: 44px; font-weight: 600;">
                    ${icon("upload", 16)} <span>Upload Document</span>
                  </button>
                </div>

                <div id="preview-docs-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
              </div>

              <!-- SUBMIT BUTTONS -->
              <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button type="submit" id="btn-submit-add-machinery" class="btn btn-primary" style="flex: 2; min-height: 48px; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                  ${icon("check", 20)} <span>Publish Machinery Listing</span>
                </button>
                <button type="button" id="btn-cancel-add" class="btn btn-outline" style="flex: 1; min-height: 48px; font-weight: 700;">
                  Cancel
                </button>
              </div>

            </form>
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

      <!-- MODAL: PROMOTE MACHINERY -->
      <div id="modal-promote-machinery" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 520px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; color: #10b981;">
              ${icon("sparkles", 20)} <span>Promote Machinery</span>
            </h3>
            <button type="button" id="btn-close-promote-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;">✕</button>
          </div>
          
          <div id="promote-modal-body"></div>
        </div>
      </div>

      <!-- MODAL: PLAN INELIGIBLE -->
      <div id="modal-ineligible-plan" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 480px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; margin: auto; text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(245, 158, 11, 0.15); color: #f59e0b; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto;">
            ${icon("sparkles", 28)}
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 0.5rem 0;">Upgrade to Promote Machinery</h3>
          <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0 0 1.5rem 0; line-height: 1.5;">
            Sponsored advertising is not included in your current plan. Upgrade to <strong>Machinery Fleet Pro</strong> to promote your fleet to all passengers and drivers across Zimbabwe.
          </p>
          <div style="display: flex; gap: 0.75rem;">
            <button type="button" id="btn-cancel-ineligible" class="btn btn-outline" style="flex: 1; min-height: 44px; font-weight: 700;">Cancel</button>
            <a href="#subscriptions" id="btn-view-plans" class="btn btn-primary" style="flex: 1; min-height: 44px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;">View Plans</a>
          </div>
        </div>
      </div>
    `;
  },

  async init(container = document) {
    try {
      this.currentProfile = await AuthService.getCurrentProfile().catch(() => null);
    } catch (_) {}

    this.bindTabs(container);
    this.bindFormInteractions(container);
    await this.loadFleet(container);
    await this.loadRequests(container);
    await this.loadEnquiries(container);

    // Close promote modal listeners
    container.querySelector("#btn-close-promote-modal")?.addEventListener("click", () => {
      container.querySelector("#modal-promote-machinery").style.display = "none";
    });
    container.querySelector("#btn-cancel-ineligible")?.addEventListener("click", () => {
      container.querySelector("#modal-ineligible-plan").style.display = "none";
    });
  },

  bindTabs(container) {
    const fleetBtn = container.querySelector("#tab-btn-fleet");
    const addBtn = container.querySelector("#tab-btn-add");
    const requestsBtn = container.querySelector("#tab-btn-requests");
    const enquiriesBtn = container.querySelector("#tab-btn-enquiries");

    const headerAddBtn = container.querySelector("#btn-header-add-machinery");
    const gridAddBtn = container.querySelector("#btn-grid-add-machinery");
    const cancelAddBtn = container.querySelector("#btn-cancel-add");
    const cancelAddTopBtn = container.querySelector("#btn-cancel-add-top");

    const switchTab = (tab) => {
      this.activeTab = tab;
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

      if (tab === "fleet") this.loadFleet(container);
      if (tab === "requests") this.loadRequests(container);
      if (tab === "enquiries") this.loadEnquiries(container);
    };

    fleetBtn?.addEventListener("click", () => switchTab("fleet"));
    addBtn?.addEventListener("click", () => switchTab("add"));
    requestsBtn?.addEventListener("click", () => switchTab("requests"));
    enquiriesBtn?.addEventListener("click", () => switchTab("enquiries"));

    headerAddBtn?.addEventListener("click", () => switchTab("add"));
    gridAddBtn?.addEventListener("click", () => switchTab("add"));
    cancelAddBtn?.addEventListener("click", () => switchTab("fleet"));
    cancelAddTopBtn?.addEventListener("click", () => switchTab("fleet"));
  },

  bindFormInteractions(container) {
    // 1. Listing Type Toggle (Hire / Sale / Both)
    const listingTypeRadios = container.querySelectorAll("input[name='listing_type']");
    const hireSection = container.querySelector("#section-hire-pricing");
    const opSection = container.querySelector("#section-operator-pricing");
    const saleSection = container.querySelector("#section-sale-price");
    const minHireSection = container.querySelector("#section-minimum-hire");

    const updateListingTypeView = () => {
      const selected = container.querySelector("input[name='listing_type']:checked")?.value || "hire";
      if (selected === "hire") {
        if (hireSection) hireSection.style.display = "block";
        if (opSection) opSection.style.display = "block";
        if (minHireSection) minHireSection.style.display = "block";
        if (saleSection) saleSection.style.display = "none";
      } else if (selected === "sale") {
        if (hireSection) hireSection.style.display = "none";
        if (opSection) opSection.style.display = "none";
        if (minHireSection) minHireSection.style.display = "none";
        if (saleSection) saleSection.style.display = "block";
      } else {
        // Both
        if (hireSection) hireSection.style.display = "block";
        if (opSection) opSection.style.display = "block";
        if (minHireSection) minHireSection.style.display = "block";
        if (saleSection) saleSection.style.display = "block";
      }
    };
    listingTypeRadios.forEach((r) => r.addEventListener("change", updateListingTypeView));
    updateListingTypeView();

    // 2. Operator Available Toggle
    const opAvailableCb = container.querySelector("#add-mac-operator-available");
    const opRatesContainer = container.querySelector("#container-operator-rates");
    opAvailableCb?.addEventListener("change", () => {
      if (opRatesContainer) {
        opRatesContainer.style.display = opAvailableCb.checked ? "block" : "none";
      }
    });

    // 3. Main Photo Upload & Preview
    const mainPhotoInput = container.querySelector("#add-mac-main-photo-input");
    const btnSelectMain = container.querySelector("#btn-select-main-photo");
    const previewMain = container.querySelector("#preview-main-photo");
    const imgMainPreview = container.querySelector("#img-main-preview");
    const txtMainFilename = container.querySelector("#txt-main-filename");

    btnSelectMain?.addEventListener("click", () => mainPhotoInput?.click());
    mainPhotoInput?.addEventListener("change", async () => {
      const file = mainPhotoInput.files?.[0];
      if (!file) return;

      btnSelectMain.disabled = true;
      btnSelectMain.textContent = "Uploading to Drive...";
      try {
        const uploadRes = await MachineryService.uploadPhoto(file);
        this.mainPhotoData = uploadRes;
        if (imgMainPreview) imgMainPreview.src = uploadRes.file_url;
        if (txtMainFilename) txtMainFilename.textContent = `✓ Uploaded: ${file.name}`;
        if (previewMain) previewMain.style.display = "block";
      } catch (err) {
        alert("Could not upload photo: " + err.message);
      } finally {
        btnSelectMain.disabled = false;
        btnSelectMain.innerHTML = `${icon("upload", 16)} <span>Change Main Photo</span>`;
      }
    });

    // 4. Gallery Photos Upload & Preview
    const galleryInput = container.querySelector("#add-mac-gallery-photos-input");
    const btnSelectGallery = container.querySelector("#btn-select-gallery-photos");
    const previewGallery = container.querySelector("#preview-gallery-container");

    btnSelectGallery?.addEventListener("click", () => galleryInput?.click());
    galleryInput?.addEventListener("change", async () => {
      const files = Array.from(galleryInput.files || []);
      if (files.length === 0) return;

      btnSelectGallery.disabled = true;
      btnSelectGallery.textContent = `Uploading ${files.length} images...`;

      for (const file of files) {
        try {
          const uploadRes = await MachineryService.uploadPhoto(file);
          this.galleryPhotosData.push(uploadRes);

          const thumb = document.createElement("div");
          thumb.style.cssText = "width: 64px; height: 64px; border-radius: 6px; overflow: hidden; position: relative; border: 1px solid var(--border);";
          thumb.innerHTML = `
            <img src="${uploadRes.file_url}" style="width: 100%; height: 100%; object-fit: cover;" />
          `;
          previewGallery?.appendChild(thumb);
        } catch (err) {
          console.warn("Gallery upload error:", err);
        }
      }

      btnSelectGallery.disabled = false;
      btnSelectGallery.innerHTML = `${icon("images", 16)} <span>Add More Gallery Photos (${this.galleryPhotosData.length})</span>`;
    });

    // 5. Verification Document Upload & Preview
    const docInput = container.querySelector("#add-mac-doc-input");
    const btnSelectDoc = container.querySelector("#btn-select-doc");
    const docTypeSelect = container.querySelector("#add-mac-doc-type");
    const previewDocsContainer = container.querySelector("#preview-docs-container");

    btnSelectDoc?.addEventListener("click", () => docInput?.click());
    docInput?.addEventListener("change", async () => {
      const file = docInput.files?.[0];
      if (!file) return;

      const docType = docTypeSelect?.value || "ownership_proof";
      btnSelectDoc.disabled = true;
      btnSelectDoc.textContent = "Uploading Doc...";

      try {
        const uploadRes = await MachineryService.uploadDocument(file, docType);
        this.uploadedDocsData.push(uploadRes);

        const docItem = document.createElement("div");
        docItem.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border); font-size: 0.85rem;";
        docItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${icon("file-check", 16)}
            <span style="font-weight: 700;">${escapeHtml(file.name)}</span>
            <span class="badge" style="background: rgba(59,130,246,0.15); color: #3b82f6; font-size: 0.7rem;">${escapeHtml(docType)}</span>
          </div>
          <span style="color: #10b981; font-weight: 700; font-size: 0.8rem;">✓ Uploaded</span>
        `;
        previewDocsContainer?.appendChild(docItem);
      } catch (err) {
        alert("Document upload failed: " + err.message);
      } finally {
        btnSelectDoc.disabled = false;
        btnSelectDoc.innerHTML = `${icon("upload", 16)} <span>Upload Another Document</span>`;
      }
    });

    // 6. Submit Add Machinery Form
    const form = container.querySelector("#form-add-machinery");
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector("#btn-submit-add-machinery");
      submitBtn.disabled = true;
      submitBtn.textContent = "Publishing Machinery Listing...";

      try {
        const listingType = container.querySelector("input[name='listing_type']:checked")?.value || "hire";
        const category = container.querySelector("#add-mac-category").value;
        const brand = container.querySelector("#add-mac-brand").value;
        const model = container.querySelector("#add-mac-model").value;
        const year = container.querySelector("#add-mac-year").value;
        const condition = container.querySelector("#add-mac-condition").value;
        const operatingHours = container.querySelector("#add-mac-hours").value;
        const fuelType = container.querySelector("#add-mac-fuel").value;
        const power = container.querySelector("#add-mac-power").value;
        const capacity = container.querySelector("#add-mac-capacity").value;
        const province = container.querySelector("#add-mac-province").value;
        const location = container.querySelector("#add-mac-location").value;
        const description = container.querySelector("#add-mac-description").value;

        // Pricing
        const hourlyRate = container.querySelector("#add-mac-rate-hourly").value;
        const dailyRate = container.querySelector("#add-mac-rate-daily").value;
        const weeklyRate = container.querySelector("#add-mac-rate-weekly").value;
        const monthlyRate = container.querySelector("#add-mac-rate-monthly").value;
        const salePrice = container.querySelector("#add-mac-sale-price").value;

        // Operator
        const operatorAvailable = container.querySelector("#add-mac-operator-available").checked;
        const opHourly = container.querySelector("#add-mac-op-hourly").value;
        const opDaily = container.querySelector("#add-mac-op-daily").value;
        const opWeekly = container.querySelector("#add-mac-op-weekly").value;
        const opMonthly = container.querySelector("#add-mac-op-monthly").value;

        // Transport & Min Hire
        const transportAvailable = container.querySelector("#add-mac-transport-available").checked;
        const transportNotes = container.querySelector("#add-mac-transport-notes").value;
        const minHireQty = container.querySelector("#add-mac-min-qty").value;
        const minHireUnit = container.querySelector("#add-mac-min-unit").value;

        // Client validations
        if (listingType === "hire" || listingType === "both") {
          if (!hourlyRate && !dailyRate && !weeklyRate && !monthlyRate) {
            throw new Error("Please enter at least one hire rate (hourly, daily, weekly, or monthly).");
          }
        }
        if (listingType === "sale" || listingType === "both") {
          if (!salePrice || Number(salePrice) <= 0) {
            throw new Error("Please enter a valid positive sale price.");
          }
        }

        // Operator rate checks
        if (operatorAvailable) {
          if (hourlyRate && opHourly && Number(opHourly) <= Number(hourlyRate)) {
            throw new Error("Operator hourly rate must be greater than machinery-only hourly rate.");
          }
          if (dailyRate && opDaily && Number(opDaily) <= Number(dailyRate)) {
            throw new Error("Operator daily rate must be greater than machinery-only daily rate.");
          }
          if (weeklyRate && opWeekly && Number(opWeekly) <= Number(weeklyRate)) {
            throw new Error("Operator weekly rate must be greater than machinery-only weekly rate.");
          }
          if (monthlyRate && opMonthly && Number(opMonthly) <= Number(monthlyRate)) {
            throw new Error("Operator monthly rate must be greater than machinery-only monthly rate.");
          }
        }

        if (!this.mainPhotoData) {
          throw new Error("A main machinery photo is required. Please upload one.");
        }

        const payload = {
          category,
          machine_category: category,
          brand,
          model,
          name: `${brand} ${model} ${category}`,
          year: year ? Number(year) : null,
          condition,
          operating_hours: operatingHours ? Number(operatingHours) : 0,
          fuel_type: fuelType,
          power,
          capacity,
          province,
          location,
          listing_type: listingType,
          hourly_rate: hourlyRate ? Number(hourlyRate) : null,
          daily_rate: dailyRate ? Number(dailyRate) : null,
          weekly_rate: weeklyRate ? Number(weeklyRate) : null,
          monthly_rate: monthlyRate ? Number(monthlyRate) : null,
          base_hire_rate: dailyRate ? Number(dailyRate) : (hourlyRate ? Number(hourlyRate) : (weeklyRate ? Number(weeklyRate) : null)),
          sale_price: salePrice ? Number(salePrice) : null,
          operator_available: operatorAvailable,
          operator_hourly_rate: opHourly ? Number(opHourly) : null,
          operator_daily_rate: opDaily ? Number(opDaily) : null,
          operator_weekly_rate: opWeekly ? Number(opWeekly) : null,
          operator_monthly_rate: opMonthly ? Number(opMonthly) : null,
          transport_available: transportAvailable,
          transport_notes: transportNotes,
          minimum_hire_period: minHireQty ? Number(minHireQty) : 1,
          minimum_hire_unit: minHireUnit || "days",
          description,
          primary_photo: this.mainPhotoData,
          gallery_photos: this.galleryPhotosData,
          photos: [this.mainPhotoData, ...this.galleryPhotosData],
          documents: this.uploadedDocsData
        };

        const created = await MachineryService.createListing(payload);
        alert(`Machinery "${created.name}" listed successfully!`);

        // Reset form and state
        form.reset();
        this.mainPhotoData = null;
        this.galleryPhotosData = [];
        this.uploadedDocsData = [];
        if (previewMain) previewMain.style.display = "none";
        if (previewGallery) previewGallery.innerHTML = "";
        if (previewDocsContainer) previewDocsContainer.innerHTML = "";

        // Switch to fleet view
        container.querySelector("#tab-btn-fleet")?.click();
      } catch (err) {
        alert("Error publishing listing: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon("check", 20)} <span>Publish Machinery Listing</span>`;
      }
    });
  },

  async loadFleet(container) {
    const grid = container.querySelector("#machinery-owner-fleet-grid");
    if (!grid) return;

    try {
      const all = await MachineryService.listMarketplace();
      const myId = this.currentProfile?.id || this.currentProfile?.user_id;
      this.ownerListings = all.filter((item) => item.owner_id === myId || (this.currentProfile?.role === "admin"));

      const kpiCount = container.querySelector("#kpi-mac-count");
      const kpiAds = container.querySelector("#kpi-mac-ads");
      if (kpiCount) kpiCount.textContent = this.ownerListings.length;

      const activeAdsCount = this.ownerListings.filter((m) => m.is_sponsored).length;
      if (kpiAds) kpiAds.textContent = activeAdsCount;

      if (this.ownerListings.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;" class="card">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🚜</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No machinery listed yet</h3>
            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto;">
              Add your heavy machinery fleet to receive hire requests and outright purchase enquiries from across Zimbabwe.
            </p>
            <button type="button" class="btn btn-primary" onclick="document.querySelector('#tab-btn-add').click();" style="font-weight: 700;">
              + Add Your First Machine
            </button>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.ownerListings.map((item) => this.renderFleetCard(item)).join("");
      this.bindFleetCardActions(container);
    } catch (err) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2rem; color: #ef4444; text-align: center;" class="card">
          Could not load your machinery fleet: ${escapeHtml(err.message)}
        </div>
      `;
    }
  },

  renderFleetCard(item) {
    const isSponsored = Boolean(item.is_sponsored);
    const photoUrl = item.primary_photo?.file_url || (Array.isArray(item.photos) && item.photos.length > 0 ? (item.photos[0].file_url || item.photos[0]) : "/assets/images/logo.png");

    // Rates formatting
    const rates = [];
    if (item.hourly_rate) rates.push(`$${Number(item.hourly_rate).toFixed(2)}/hr`);
    if (item.daily_rate || item.base_hire_rate) rates.push(`$${Number(item.daily_rate || item.base_hire_rate).toFixed(2)}/day`);
    if (item.weekly_rate) rates.push(`$${Number(item.weekly_rate).toFixed(2)}/wk`);
    if (item.monthly_rate) rates.push(`$${Number(item.monthly_rate).toFixed(2)}/mo`);

    const listingTypeLabel = item.listing_type === "sale" ? "FOR SALE" : (item.listing_type === "both" ? "FOR HIRE & SALE" : "FOR HIRE");

    return `
      <div class="card machinery-owner-card" style="border-radius: 12px; overflow: hidden; padding: 0; border: ${isSponsored ? "2px solid #10b981" : "1px solid var(--border)"}; position: relative; display: flex; flex-direction: column;">
        
        <!-- SPONSORED ACTIVE BADGE -->
        ${isSponsored ? `
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; background: #10b981; color: #ffffff; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.5px; padding: 0.25rem 0.65rem; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            SPONSORED / ADVERTISING ACTIVE
          </div>
        ` : ""}

        <!-- PHOTO -->
        <div style="height: 170px; background: #0f172a; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png'; this.style.objectFit='contain';" />
          <span class="badge" style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; font-weight: 700;">
            ${escapeHtml(listingTypeLabel)}
          </span>
        </div>

        <!-- DETAILS BODY -->
        <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: var(--text-main);">${escapeHtml(item.name)}</h3>
            <span class="badge ${item.availability_status === "available" ? "badge-success" : "badge-warning"}" style="font-size: 0.7rem; text-transform: capitalize;">
              ${escapeHtml(item.availability_status || "Available")}
            </span>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${escapeHtml(item.category)} • 📍 ${escapeHtml(item.location || item.province || "Zimbabwe")}
          </div>

          <!-- PRICING SUMMARY -->
          <div style="background: var(--bg-hover); padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.85rem; border: 1px solid var(--border);">
            ${rates.length > 0 ? `
              <div style="margin-bottom: 0.25rem;">
                <span style="color: var(--text-muted);">Hire:</span> <strong>${rates.join(" • ")}</strong>
              </div>
            ` : ""}
            
            ${item.sale_price ? `
              <div style="margin-bottom: 0.25rem; color: #ec4899; font-weight: 700;">
                Sale Price: $${Number(item.sale_price).toLocaleString()}
              </div>
            ` : ""}

            <div>
              <span style="color: var(--text-muted);">Operator:</span> ${item.operator_available ? `<span style="color: #10b981; font-weight: 700;">Available</span>` : "<span style='color: var(--text-muted);'>Not available</span>"}
            </div>
          </div>

          <!-- ACTIONS BAR (Part 5 & 6) -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: auto;">
            
            <!-- ROW 1: ADVERTISE BUTTON (PROMINENT!) -->
            <div style="display: flex; gap: 0.5rem;">
              ${isSponsored ? `
                <button type="button" class="btn btn-outline btn-sm btn-stop-ad" data-id="${escapeHtml(item.id)}" style="flex: 1; border-color: #ef4444; color: #ef4444; font-weight: 700; min-height: 40px;">
                  Pause Advertising
                </button>
              ` : `
                <button type="button" class="btn btn-primary btn-sm btn-advertise-machinery" data-id="${escapeHtml(item.id)}" data-name="${escapeHtml(item.name)}" data-photo="${escapeHtml(photoUrl)}" data-location="${escapeHtml(item.location)}" style="flex: 1; font-weight: 800; min-height: 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
                  ${icon("sparkles", 16)} <span>Advertise</span>
                </button>
              `}
            </div>

            <!-- ROW 2: OTHER ACTIONS -->
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              <a href="#machinery?id=${escapeHtml(item.id)}" class="btn btn-outline btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.35rem 0.5rem; text-align: center;">View</a>
              <button type="button" class="btn btn-outline btn-sm btn-toggle-avail" data-id="${escapeHtml(item.id)}" data-status="${escapeHtml(item.availability_status || "available")}" style="flex: 1; font-size: 0.75rem; padding: 0.35rem 0.5rem;">Availability</button>
              <button type="button" class="btn btn-outline btn-sm btn-deactivate-machinery" data-id="${escapeHtml(item.id)}" style="font-size: 0.75rem; padding: 0.35rem 0.5rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" title="Deactivate">Deactivate</button>
            </div>

          </div>

        </div>

      </div>
    `;
  },

  bindFleetCardActions(container) {
    // 1. ADVERTISE BUTTON CLICK (Part 6, 7, 8)
    container.querySelectorAll(".btn-advertise-machinery").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        const photo = btn.getAttribute("data-photo");
        const loc = btn.getAttribute("data-location");

        // Check subscription privilege first
        try {
          // Attempt promote or open confirmation modal
          const modalBody = container.querySelector("#promote-modal-body");
          if (!modalBody) return;

          modalBody.innerHTML = `
            <div style="text-align: center; margin-bottom: 1.25rem;">
              <div style="width: 100%; height: 160px; border-radius: 8px; overflow: hidden; background: #0f172a; margin-bottom: 0.75rem;">
                <img src="${escapeHtml(photo)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png';" />
              </div>
              <h4 style="font-size: 1.15rem; font-weight: 800; margin: 0 0 0.25rem 0;">${escapeHtml(name)}</h4>
              <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0;">📍 Location: ${escapeHtml(loc || "Zimbabwe")}</p>
            </div>

            <div style="background: var(--bg-hover); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.9rem; line-height: 1.5; border: 1px solid var(--border);">
              <div>⚡ <strong>Placement:</strong> Promoted at the very top of the Machinery Marketplace.</div>
              <div>🎯 <strong>Dashboard Visibility:</strong> Sponsored card displayed on both Passenger and Driver dashboards.</div>
              <div>📅 <strong>Duration:</strong> 30 Days promotion.</div>
            </div>

            <button type="button" id="btn-confirm-start-ad" class="btn btn-primary" style="width: 100%; min-height: 46px; font-weight: 800; font-size: 1rem;">
              ${icon("sparkles", 18)} <span>Start Advertising</span>
            </button>
          `;

          container.querySelector("#modal-promote-machinery").style.display = "flex";

          container.querySelector("#btn-confirm-start-ad")?.addEventListener("click", async () => {
            const confirmBtn = container.querySelector("#btn-confirm-start-ad");
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Activating Promotion...";

            try {
              await MachineryService.promoteListing(id, 30);
              container.querySelector("#modal-promote-machinery").style.display = "none";
              alert(`Sponsored advertising activated for "${name}"!`);
              await this.loadFleet(container);
            } catch (err) {
              container.querySelector("#modal-promote-machinery").style.display = "none";
              if (err.message && err.message.includes("Sponsored advertising is not included")) {
                container.querySelector("#modal-ineligible-plan").style.display = "flex";
              } else {
                alert("Could not activate advertising: " + err.message);
              }
            } finally {
              confirmBtn.disabled = false;
            }
          });
        } catch (err) {
          alert("Could not open promotion: " + err.message);
        }
      });
    });

    // 2. PAUSE ADVERTISING
    container.querySelectorAll(".btn-stop-ad").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("Are you sure you want to pause advertising for this machinery?")) return;
        btn.disabled = true;
        btn.textContent = "Pausing...";
        try {
          await MachineryService.stopPromotion(id);
          alert("Advertising campaign paused.");
          await this.loadFleet(container);
        } catch (err) {
          alert("Error pausing ad: " + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });

    // 3. TOGGLE AVAILABILITY
    container.querySelectorAll(".btn-toggle-avail").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const current = btn.getAttribute("data-status");
        const next = current === "available" ? "booked" : (current === "booked" ? "maintenance" : "available");
        
        try {
          await MachineryService.updateListing(id, { availability_status: next });
          await this.loadFleet(container);
        } catch (err) {
          alert("Error updating status: " + err.message);
        }
      });
    });

    // 4. DEACTIVATE LISTING
    container.querySelectorAll(".btn-deactivate-machinery").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!confirm("Are you sure you want to deactivate this listing? It will no longer appear in the marketplace.")) return;
        try {
          await MachineryService.deactivateListing(id);
          alert("Listing deactivated.");
          await this.loadFleet(container);
        } catch (err) {
          alert("Error deactivating listing: " + err.message);
        }
      });
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
              <button type="button" class="btn btn-primary btn-sm btn-accept-hire" data-id="${escapeHtml(req.id)}" style="flex: 1; font-weight: 700;">
                Accept Proposal
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-decline-hire" data-id="${escapeHtml(req.id)}" style="flex: 1; font-weight: 700; color: #ef4444; border-color: rgba(239,68,68,0.3);">
                Decline
              </button>
            </div>
          ` : ""}
        </div>
      `).join("");

      // Bind accept / decline
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
