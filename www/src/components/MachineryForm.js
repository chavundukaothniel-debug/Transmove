// ==============================================================================
// TRANSMOVE DEDICATED MACHINERY FORM COMPONENT
// Dedicated machinery listing form. Submits exclusively via MachineryService.createListing
// to authoritative endpoint "create_machinery_listing".
// NEVER calls VehicleService or create_vehicle.
// Machinery categories ONLY — ABSOLUTELY NO SUV, Sedan, or Passenger Cars.
// ==============================================================================
import { MachineryService, MACHINERY_CATEGORIES } from "../services/machinery.js";
import { icon } from "./Icon.js";

const ZIM_PROVINCES = [
  "Bulawayo",
  "Harare",
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

export const MachineryForm = {
  mainPhotoData: null,
  galleryPhotosData: [],
  uploadedDocsData: [],

  render() {
    return `
      <div class="card machinery-dedicated-form" style="max-width: 880px; margin: 0 auto; padding: 1.75rem; border-radius: 14px; box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
              ${icon("circle-plus", 24)} <span>ADD MACHINERY</span>
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0 0;">Dedicated heavy equipment &amp; plant listing form. Fill in technical details, multi-rate pricing, photos, and documents.</p>
          </div>
        </div>

        <form id="form-add-machinery">
          
          <!-- TOP SECTION: MACHINERY PHOTOS -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("camera", 20)} MACHINERY PHOTOS
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
              Upload your high-resolution equipment photos. Main photo is required and will be featured in the marketplace and advertisements.
            </p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 1rem;">
              
              <!-- Main Machinery Photo -->
              <div class="card" style="padding: 1.25rem; border: 2px dashed #10b981; background: var(--bg-card); border-radius: 10px; text-align: center;">
                <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 0.5rem; color: #10b981;">Main Machinery Photo *</div>
                <input type="file" id="add-mac-main-photo-input" accept="image/*" style="display: none;" />
                
                <div id="dropzone-main-photo" style="cursor: pointer; padding: 1rem; border-radius: 8px; background: rgba(16,185,129,0.05); margin-bottom: 0.75rem; border: 1px solid rgba(16,185,129,0.2);">
                  <div style="font-size: 2.5rem; margin-bottom: 0.25rem;">🚜</div>
                  <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">Click to Upload Main Photo</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted);">PNG, JPG, WebP up to 10MB</div>
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                  <button type="button" id="btn-select-main-photo" class="btn btn-outline btn-sm" style="min-height: 40px; font-weight: 700; border-color: #10b981; color: #10b981;">
                    ${icon("upload", 16)} <span>+ Add Main Machinery Photo</span>
                  </button>
                  <button type="button" id="btn-remove-main-photo" class="btn btn-outline btn-sm" style="min-height: 40px; font-weight: 700; border-color: #ef4444; color: #ef4444; display: none;">
                    ${icon("trash", 16)} <span>Remove</span>
                  </button>
                </div>

                <div id="preview-main-photo" style="margin-top: 1rem; text-align: center; display: none;">
                  <img id="img-main-preview" src="" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);" />
                  <div id="txt-main-filename" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; word-break: break-all;"></div>
                </div>
              </div>

              <!-- Additional Gallery Photos -->
              <div class="card" style="padding: 1.25rem; border: 2px dashed var(--border); background: var(--bg-card); border-radius: 10px;">
                <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main);">Additional Photos</div>
                <input type="file" id="add-mac-gallery-photos-input" accept="image/*" multiple style="display: none;" />
                
                <div style="margin-bottom: 0.75rem;">
                  <button type="button" id="btn-select-gallery-photos" class="btn btn-outline btn-sm" style="width: 100%; min-height: 40px; font-weight: 700;">
                    ${icon("images", 16)} <span>+ Add More Photos</span>
                  </button>
                </div>
                
                <div id="preview-gallery-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.5rem; margin-top: 0.75rem;"></div>
              </div>

            </div>
          </div>

          <!-- SECTION A: MACHINE DETAILS -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 1rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("tractor", 18)} Machine Details
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
                <label class="form-label" style="font-weight: 700;">Brand *</label>
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
                <input type="number" id="add-mac-year" class="form-input" placeholder="e.g. 2019" min="1970" max="2030" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Condition *</label>
                <select id="add-mac-condition" class="form-select" style="min-height: 44px;" required>
                  <option value="New">New</option>
                  <option value="Excellent">Excellent</option>
                  <option value="Good" selected>Good</option>
                  <option value="Fair">Fair</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Operating Hours</label>
                <input type="number" id="add-mac-hours" class="form-input" placeholder="e.g. 5240" min="0" style="min-height: 44px;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
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
                <label class="form-label" style="font-weight: 700;">Power</label>
                <input type="text" id="add-mac-power" class="form-input" placeholder="e.g. 110 kW / 148 HP" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Capacity</label>
                <input type="text" id="add-mac-capacity" class="form-input" placeholder="e.g. 20 tonnes / 1.2 m³" style="min-height: 44px;" />
              </div>
            </div>

            <!-- Optional Machinery Technical Fields -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Serial / Machine Number</label>
                <input type="text" id="add-mac-serial" class="form-input" placeholder="Optional" style="min-height: 40px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Operating Weight</label>
                <input type="text" id="add-mac-weight" class="form-input" placeholder="e.g. 22 tonnes" style="min-height: 40px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Bucket / Blade / Boom Size</label>
                <input type="text" id="add-mac-boom" class="form-input" placeholder="e.g. 1.2 m³ digging bucket" style="min-height: 40px;" />
              </div>
            </div>
          </div>

          <!-- SECTION B: LOCATION -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 1rem; color: #3b82f6; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("map-pin", 18)} Location
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Province *</label>
                <select id="add-mac-province" class="form-select" style="min-height: 44px;" required>
                  ${ZIM_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === "Midlands" ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Town / City *</label>
                <input type="text" id="add-mac-location" class="form-input" placeholder="e.g. Gweru" style="min-height: 44px;" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Specific Area / Base (optional)</label>
                <input type="text" id="add-mac-area" class="form-input" placeholder="e.g. Heavy Industrial Site" style="min-height: 44px;" />
              </div>
            </div>
          </div>

          <!-- SECTION C: LISTING PURPOSE -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #8b5cf6; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("tag", 18)} WHAT ARE YOU OFFERING?
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">Choose whether this machinery is available for hire, outright sale, or both.</p>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                <input type="radio" name="listing_type" value="hire" />
                <span>For Hire</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                <input type="radio" name="listing_type" value="sale" />
                <span>For Sale</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                <input type="radio" name="listing_type" value="both" checked />
                <span>Hire &amp; Sale</span>
              </label>
            </div>
          </div>

          <!-- SECTION D: HIRE PRICING -->
          <div id="section-hire-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("wallet", 18)} HIRE PRICING
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">At least one hire rate required. You do not need to fill all rates.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Hour ($)</label>
                <input type="number" id="add-mac-rate-hourly" class="form-input" placeholder="e.g. 35" min="0" step="0.5" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Day ($)</label>
                <input type="number" id="add-mac-rate-daily" class="form-input" placeholder="e.g. 180" min="0" step="1" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Week ($)</label>
                <input type="number" id="add-mac-rate-weekly" class="form-input" placeholder="e.g. 950" min="0" step="10" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Month ($)</label>
                <input type="number" id="add-mac-rate-monthly" class="form-input" placeholder="e.g. 3600" min="0" step="50" style="min-height: 44px;" />
              </div>
            </div>
          </div>

          <!-- SECTION E: OPERATOR -->
          <div id="section-operator-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-weight: 800; font-size: 1rem; color: #f59e0b; display: flex; align-items: center; gap: 0.4rem;">
                ${icon("user-check", 18)} Can you provide an operator?
              </div>
              <div style="display: flex; gap: 1rem;">
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="operator_choice" value="yes" checked />
                  <span>Yes</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="operator_choice" value="no" />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div id="notice-no-operator" style="display: none; padding: 0.75rem; background: var(--bg-card); border-radius: 6px; font-size: 0.85rem; color: var(--text-muted); border: 1px solid var(--border);">
              Hirer must provide their own suitably qualified operator.
            </div>
            
            <div id="container-operator-rates" style="border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: 0.5rem;">
              <div style="font-weight: 700; font-size: 0.9rem; color: #f59e0b; margin-bottom: 0.5rem;">WITH OPERATOR PRICING</div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 1rem 0;">Each corresponding operator-inclusive rate must be higher than machinery-only rate.</p>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Hour ($)</label>
                  <input type="number" id="add-mac-op-hourly" class="form-input" placeholder="e.g. 50" min="0" step="0.5" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Day ($)</label>
                  <input type="number" id="add-mac-op-daily" class="form-input" placeholder="e.g. 230" min="0" step="1" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Week ($)</label>
                  <input type="number" id="add-mac-op-weekly" class="form-input" placeholder="e.g. 1200" min="0" step="10" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Month ($)</label>
                  <input type="number" id="add-mac-op-monthly" class="form-input" placeholder="e.g. 4500" min="0" step="50" style="min-height: 44px;" />
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION F: SALE INFORMATION -->
          <div id="section-sale-price" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #ec4899; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("badge-dollar-sign", 18)} Sale Information
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Sale Price ($ USD) *</label>
                <input type="number" id="add-mac-sale-price" class="form-input" placeholder="e.g. 52000" min="1" step="100" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Negotiable?</label>
                <select id="add-mac-sale-negotiable" class="form-select" style="min-height: 44px;">
                  <option value="yes" selected>Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Sale Notes (optional)</label>
              <input type="text" id="add-mac-sale-notes" class="form-input" placeholder="e.g. Cash or bank transfer accepted. Inspection in Gweru welcome." style="min-height: 40px;" />
            </div>
          </div>

          <!-- SECTION G: TRANSPORT -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-weight: 800; font-size: 1rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                ${icon("truck", 18)} Can you transport the machinery to the customer's site?
              </div>
              <div style="display: flex; gap: 1rem;">
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="transport_choice" value="yes" checked />
                  <span>Yes</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="transport_choice" value="no" />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div id="container-transport-notes" class="form-group" style="margin-top: 0.5rem;">
              <label class="form-label" style="font-weight: 700;">Transport Conditions / Notes</label>
              <input type="text" id="add-mac-transport-notes" class="form-input" placeholder="e.g. Lowbed transport arranged at competitive rates across Midlands &amp; Harare." style="min-height: 44px;" />
            </div>
          </div>

          <!-- SECTION H: MINIMUM HIRE -->
          <div id="section-minimum-hire" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              ${icon("clock", 18)} Minimum Hire
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Minimum Hire Quantity</label>
                <input type="number" id="add-mac-min-qty" class="form-input" value="1" min="1" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Unit</label>
                <select id="add-mac-min-unit" class="form-select" style="min-height: 44px;">
                  <option value="Days" selected>Days</option>
                  <option value="Hours">Hours</option>
                  <option value="Weeks">Weeks</option>
                  <option value="Months">Months</option>
                </select>
              </div>
            </div>
          </div>

          <!-- SECTION I: AVAILABILITY -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              ${icon("check-circle", 18)} Availability
            </div>
            <div class="form-group" style="max-width: 320px;">
              <select id="add-mac-availability" class="form-select" style="min-height: 44px;">
                <option value="available" selected>Available</option>
                <option value="booked">Booked</option>
                <option value="maintenance">Under Maintenance</option>
                <option value="unavailable">Unavailable</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          </div>

          <!-- SECTION J: DESCRIPTION -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              ${icon("file-text", 18)} MACHINERY DESCRIPTION
            </div>
            <div class="form-group">
              <textarea id="add-mac-description" class="form-input" rows="4" placeholder="Describe the machine, attachments, working condition, recent maintenance, ideal uses and site requirements..."></textarea>
            </div>
          </div>

          <!-- SECTION K: OWNERSHIP / VERIFICATION DOCUMENTS -->
          <div style="margin-bottom: 1.75rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #3b82f6; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("shield-check", 18)} MACHINERY DOCUMENTS
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
              Ownership documents are PRIVATE and never accessible to passengers or drivers. Verified owners receive a verified badge.
            </p>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
              <button type="button" class="btn btn-outline btn-sm btn-doc-trigger" data-type="Proof of Ownership">
                ${icon("file-plus", 15)} <span>+ Proof of Ownership</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-doc-trigger" data-type="Registration / Serial Number Document">
                ${icon("file-plus", 15)} <span>+ Registration / Serial Document</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-doc-trigger" data-type="Insurance">
                ${icon("file-plus", 15)} <span>+ Insurance</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-doc-trigger" data-type="Inspection / Safety Certificate">
                ${icon("file-plus", 15)} <span>+ Inspection / Safety Certificate</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm btn-doc-trigger" data-type="Other Document">
                ${icon("file-plus", 15)} <span>+ Other Document</span>
              </button>
              <input type="file" id="add-mac-doc-hidden-input" accept=".pdf,image/*" style="display: none;" />
            </div>

            <div id="preview-docs-container" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
          </div>

          <!-- PUBLISH BUTTON -->
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button type="submit" id="btn-submit-add-machinery" class="btn btn-primary" style="flex: 2; min-height: 48px; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
              ${icon("check", 20)} <span>PUBLISH MACHINERY</span>
            </button>
          </div>

        </form>
      </div>
    `;
  }
};
