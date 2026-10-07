// ==============================================================================
// TRANSMOVE DEDICATED MACHINERY FORM COMPONENT
// Dedicated machinery listing and editing form.
// Submits via MachineryService.createListing (new) or MachineryService.updateListing (edit).
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
  currentItem: null,

  render(item = null) {
    this.currentItem = item;
    const isEdit = Boolean(item && item.id);

    // Photos
    const mainPhoto = item?.primary_photo?.file_url
      ? item.primary_photo
      : (Array.isArray(item?.photos) && item.photos.length > 0 ? (typeof item.photos[0] === "string" ? { file_url: item.photos[0], filename: "main.jpg" } : item.photos[0]) : null);
    const galleryPhotos = Array.isArray(item?.gallery_photos)
      ? item.gallery_photos
      : (Array.isArray(item?.photos) && item.photos.length > 1 ? item.photos.slice(1).map(p => typeof p === "string" ? { file_url: p } : p) : []);
    const docs = Array.isArray(item?.documents) ? item.documents : [];

    const category = item?.category || item?.machine_category || "";
    const brand = item?.brand || "";
    const model = item?.model || "";
    const year = item?.year || "";
    const condition = item?.condition || "Good";
    const hours = item?.operating_hours ?? "";
    const fuel = item?.fuel_type || "Diesel";
    const power = item?.power || "";
    const capacity = item?.capacity || "";
    const serial = item?.serial_number || "";
    const weight = item?.operating_weight || "";
    const boom = item?.boom_size || "";
    const province = item?.province || "Midlands";
    const location = item?.location || "";
    const listingType = item?.listing_type || "both";
    const hourly = item?.hourly_rate ?? "";
    const daily = item?.daily_rate ?? item?.base_hire_rate ?? "";
    const weekly = item?.weekly_rate ?? "";
    const monthly = item?.monthly_rate ?? "";
    const operatorChoice = item?.operator_available === false ? "no" : "yes";
    const opHourly = item?.operator_hourly_rate ?? "";
    const opDaily = item?.operator_daily_rate ?? "";
    const opWeekly = item?.operator_weekly_rate ?? "";
    const opMonthly = item?.operator_monthly_rate ?? "";
    const salePrice = item?.sale_price ?? "";
    const saleNeg = item?.sale_negotiable === false ? "no" : "yes";
    const saleNotes = item?.sale_notes || "";
    const transportChoice = item?.transport_available === false ? "no" : "yes";
    const transportNotes = item?.transport_notes || "";
    const minQty = item?.minimum_hire_period ?? 1;
    const minUnit = item?.minimum_hire_unit || "Days";
    const availability = item?.availability_status || "available";
    const description = item?.description || "";

    return `
      <div class="card machinery-dedicated-form" style="max-width: 880px; margin: 0 auto; padding: 1.75rem; border-radius: 14px; box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main);">
              ${icon(isEdit ? "edit-3" : "circle-plus", 24)} <span>${isEdit ? "EDIT MACHINERY" : "ADD MACHINERY"}</span>
            </h2>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0 0;">
              ${isEdit ? `Update technical specs, multi-rate pricing, availability, and media for "${escapeHtml(item.name || brand + " " + model)}".` : "Dedicated heavy equipment &amp; plant listing form. Fill in technical details, multi-rate pricing, photos, and documents."}
            </p>
          </div>
          <button type="button" id="btn-cancel-machinery-form-top" class="btn btn-outline btn-sm">Cancel</button>
        </div>

        <form id="form-add-machinery">
          <input type="hidden" id="machinery-edit-id" value="${escapeHtml(item?.id || "")}" />
          
          <!-- TOP SECTION: MACHINERY PHOTOS -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1.05rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("camera", 20)} MACHINERY PHOTOS
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
              Upload high-resolution equipment photos. Main photo is required and will be featured in the marketplace and advertisements.
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
                    ${icon("upload", 16)} <span>${mainPhoto ? "Change Main Photo" : "+ Add Main Machinery Photo"}</span>
                  </button>
                  <button type="button" id="btn-remove-main-photo" class="btn btn-outline btn-sm" style="min-height: 40px; font-weight: 700; border-color: #ef4444; color: #ef4444; display: ${mainPhoto ? "inline-flex" : "none"};">
                    ${icon("trash", 16)} <span>Remove</span>
                  </button>
                </div>

                <div id="preview-main-photo" style="margin-top: 1rem; text-align: center; display: ${mainPhoto ? "block" : "none"};">
                  <img id="img-main-preview" src="${escapeHtml(mainPhoto?.file_url || "")}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);" />
                  <div id="txt-main-filename" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.35rem; word-break: break-all;">
                    ${mainPhoto?.filename ? escapeHtml(mainPhoto.filename) : (mainPhoto ? "Current Main Photo" : "")}
                  </div>
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
                
                <div id="preview-gallery-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: 0.5rem; margin-top: 0.75rem;">
                  ${galleryPhotos.map((g, idx) => `
                    <div style="position: relative; border-radius: 6px; overflow: hidden; height: 70px; border: 1px solid var(--border);">
                      <img src="${escapeHtml(g.file_url || g)}" style="width: 100%; height: 100%; object-fit: cover;" />
                      <button type="button" class="btn-remove-gallery-item" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.85); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
                    </div>
                  `).join("")}
                </div>
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
                ${MACHINERY_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${c === category ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Brand *</label>
                <input type="text" id="add-mac-brand" class="form-input" placeholder="e.g. Caterpillar, Komatsu, JCB" value="${escapeHtml(brand)}" style="min-height: 44px;" required />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Model *</label>
                <input type="text" id="add-mac-model" class="form-input" placeholder="e.g. 320D, D6R, 3CX" value="${escapeHtml(model)}" style="min-height: 44px;" required />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Year</label>
                <input type="number" id="add-mac-year" class="form-input" placeholder="e.g. 2019" min="1970" max="2030" value="${escapeHtml(year)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Condition *</label>
                <select id="add-mac-condition" class="form-select" style="min-height: 44px;" required>
                  <option value="New" ${condition === "New" ? "selected" : ""}>New</option>
                  <option value="Excellent" ${condition === "Excellent" ? "selected" : ""}>Excellent</option>
                  <option value="Good" ${condition === "Good" || !condition ? "selected" : ""}>Good</option>
                  <option value="Fair" ${condition === "Fair" ? "selected" : ""}>Fair</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Operating Hours</label>
                <input type="number" id="add-mac-hours" class="form-input" placeholder="e.g. 5240" min="0" value="${escapeHtml(hours)}" style="min-height: 44px;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Fuel Type</label>
                <select id="add-mac-fuel" class="form-select" style="min-height: 44px;">
                  <option value="Diesel" ${fuel === "Diesel" ? "selected" : ""}>Diesel</option>
                  <option value="Petrol" ${fuel === "Petrol" ? "selected" : ""}>Petrol</option>
                  <option value="Electric" ${fuel === "Electric" ? "selected" : ""}>Electric</option>
                  <option value="Hybrid" ${fuel === "Hybrid" ? "selected" : ""}>Hybrid</option>
                  <option value="Other" ${fuel === "Other" ? "selected" : ""}>Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Power</label>
                <input type="text" id="add-mac-power" class="form-input" placeholder="e.g. 110 kW / 148 HP" value="${escapeHtml(power)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Capacity</label>
                <input type="text" id="add-mac-capacity" class="form-input" placeholder="e.g. 20 tonnes / 1.2 m³" value="${escapeHtml(capacity)}" style="min-height: 44px;" />
              </div>
            </div>

            <!-- Optional Machinery Technical Fields -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Serial / Machine Number</label>
                <input type="text" id="add-mac-serial" class="form-input" placeholder="Optional" value="${escapeHtml(serial)}" style="min-height: 40px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Operating Weight</label>
                <input type="text" id="add-mac-weight" class="form-input" placeholder="e.g. 22 tonnes" value="${escapeHtml(weight)}" style="min-height: 40px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Bucket / Blade / Boom Size</label>
                <input type="text" id="add-mac-boom" class="form-input" placeholder="e.g. 1.2 m³ digging bucket" value="${escapeHtml(boom)}" style="min-height: 40px;" />
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
                  ${ZIM_PROVINCES.map((p) => `<option value="${escapeHtml(p)}" ${p === province ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Town / City *</label>
                <input type="text" id="add-mac-location" class="form-input" placeholder="e.g. Gweru" value="${escapeHtml(location)}" style="min-height: 44px;" required />
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
                <input type="radio" name="listing_type" value="hire" ${listingType === "hire" ? "checked" : ""} />
                <span>For Hire</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                <input type="radio" name="listing_type" value="sale" ${listingType === "sale" ? "checked" : ""} />
                <span>For Sale</span>
              </label>
              <label style="display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); font-weight: 700;">
                <input type="radio" name="listing_type" value="both" ${listingType === "both" ? "checked" : ""} />
                <span>Hire &amp; Sale</span>
              </label>
            </div>
          </div>

          <!-- SECTION D: HIRE PRICING -->
          <div id="section-hire-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border); display: ${listingType === "sale" ? "none" : "block"};">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #10b981; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("wallet", 18)} HIRE PRICING
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">At least one hire rate required for hire listings.</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Hour ($)</label>
                <input type="number" id="add-mac-rate-hourly" class="form-input" placeholder="e.g. 35" min="0" step="0.5" value="${escapeHtml(hourly)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Day ($)</label>
                <input type="number" id="add-mac-rate-daily" class="form-input" placeholder="e.g. 180" min="0" step="1" value="${escapeHtml(daily)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Week ($)</label>
                <input type="number" id="add-mac-rate-weekly" class="form-input" placeholder="e.g. 950" min="0" step="10" value="${escapeHtml(weekly)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Price per Month ($)</label>
                <input type="number" id="add-mac-rate-monthly" class="form-input" placeholder="e.g. 3600" min="0" step="50" value="${escapeHtml(monthly)}" style="min-height: 44px;" />
              </div>
            </div>
          </div>

          <!-- SECTION E: OPERATOR -->
          <div id="section-operator-pricing" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border); display: ${listingType === "sale" ? "none" : "block"};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-weight: 800; font-size: 1rem; color: #f59e0b; display: flex; align-items: center; gap: 0.4rem;">
                ${icon("user-check", 18)} Can you provide an operator?
              </div>
              <div style="display: flex; gap: 1rem;">
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="operator_choice" value="yes" ${operatorChoice === "yes" ? "checked" : ""} />
                  <span>Yes</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="operator_choice" value="no" ${operatorChoice === "no" ? "checked" : ""} />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div id="container-operator-rates" style="border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: 0.5rem; display: ${operatorChoice === "yes" ? "block" : "none"};">
              <div style="font-weight: 700; font-size: 0.9rem; color: #f59e0b; margin-bottom: 0.5rem;">WITH OPERATOR PRICING</div>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0 0 1rem 0;">Each operator-inclusive rate must be strictly higher than the machinery-only rate.</p>
              
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem;">
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Hour ($)</label>
                  <input type="number" id="add-mac-op-hourly" class="form-input" placeholder="e.g. 50" min="0" step="0.5" value="${escapeHtml(opHourly)}" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Day ($)</label>
                  <input type="number" id="add-mac-op-daily" class="form-input" placeholder="e.g. 230" min="0" step="1" value="${escapeHtml(opDaily)}" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Week ($)</label>
                  <input type="number" id="add-mac-op-weekly" class="form-input" placeholder="e.g. 1200" min="0" step="10" value="${escapeHtml(opWeekly)}" style="min-height: 44px;" />
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-weight: 700;">Per Month ($)</label>
                  <input type="number" id="add-mac-op-monthly" class="form-input" placeholder="e.g. 4500" min="0" step="50" value="${escapeHtml(opMonthly)}" style="min-height: 44px;" />
                </div>
              </div>
            </div>
          </div>

          <!-- SECTION F: SALE INFORMATION -->
          <div id="section-sale-price" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border); display: ${listingType === "hire" ? "none" : "block"};">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #ec4899; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("badge-dollar-sign", 18)} Sale Information
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Sale Price ($ USD) *</label>
                <input type="number" id="add-mac-sale-price" class="form-input" placeholder="e.g. 52000" min="1" step="100" value="${escapeHtml(salePrice)}" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Negotiable?</label>
                <select id="add-mac-sale-negotiable" class="form-select" style="min-height: 44px;">
                  <option value="yes" ${saleNeg === "yes" ? "selected" : ""}>Yes</option>
                  <option value="no" ${saleNeg === "no" ? "selected" : ""}>No</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-size: 0.85rem; color: var(--text-muted);">Sale Notes (optional)</label>
              <input type="text" id="add-mac-sale-notes" class="form-input" placeholder="e.g. Cash or bank transfer accepted. Inspection in Gweru welcome." value="${escapeHtml(saleNotes)}" style="min-height: 40px;" />
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
                  <input type="radio" name="transport_choice" value="yes" ${transportChoice === "yes" ? "checked" : ""} />
                  <span>Yes</span>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 700;">
                  <input type="radio" name="transport_choice" value="no" ${transportChoice === "no" ? "checked" : ""} />
                  <span>No</span>
                </label>
              </div>
            </div>

            <div id="container-transport-notes" class="form-group" style="margin-top: 0.5rem; display: ${transportChoice === "yes" ? "block" : "none"};">
              <label class="form-label" style="font-weight: 700;">Transport Conditions / Notes</label>
              <input type="text" id="add-mac-transport-notes" class="form-input" placeholder="e.g. Lowbed transport arranged at competitive rates across Midlands &amp; Harare." value="${escapeHtml(transportNotes)}" style="min-height: 44px;" />
            </div>
          </div>

          <!-- SECTION H: MINIMUM HIRE -->
          <div id="section-minimum-hire" style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border); display: ${listingType === "sale" ? "none" : "block"};">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              ${icon("clock", 18)} Minimum Hire
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Minimum Hire Quantity</label>
                <input type="number" id="add-mac-min-qty" class="form-input" value="${escapeHtml(minQty)}" min="1" style="min-height: 44px;" />
              </div>
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">Unit</label>
                <select id="add-mac-min-unit" class="form-select" style="min-height: 44px;">
                  <option value="Days" ${minUnit === "Days" ? "selected" : ""}>Days</option>
                  <option value="Hours" ${minUnit === "Hours" ? "selected" : ""}>Hours</option>
                  <option value="Weeks" ${minUnit === "Weeks" ? "selected" : ""}>Weeks</option>
                  <option value="Months" ${minUnit === "Months" ? "selected" : ""}>Months</option>
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
                <option value="available" ${availability === "available" ? "selected" : ""}>Available</option>
                <option value="booked" ${availability === "booked" ? "selected" : ""}>Booked</option>
                <option value="maintenance" ${availability === "maintenance" ? "selected" : ""}>Under Maintenance</option>
                <option value="unavailable" ${availability === "unavailable" ? "selected" : ""}>Unavailable</option>
                <option value="sold" ${availability === "sold" ? "selected" : ""}>Sold</option>
              </select>
            </div>
          </div>

          <!-- SECTION J: DESCRIPTION -->
          <div style="margin-bottom: 1.5rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
              ${icon("file-text", 18)} MACHINERY DESCRIPTION
            </div>
            <div class="form-group">
              <textarea id="add-mac-description" class="form-input" rows="4" placeholder="Describe the machine, attachments, working condition, recent maintenance, ideal uses and site requirements...">${escapeHtml(description)}</textarea>
            </div>
          </div>

          <!-- SECTION K: OWNERSHIP / VERIFICATION DOCUMENTS -->
          <div style="margin-bottom: 1.75rem; background: var(--bg-hover); padding: 1.25rem; border-radius: 10px; border: 1px solid var(--border);">
            <div style="font-weight: 800; font-size: 1rem; margin-bottom: 0.5rem; color: #3b82f6; display: flex; align-items: center; gap: 0.4rem;">
              ${icon("shield-check", 18)} MACHINERY DOCUMENTS
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
              Ownership documents are PRIVATE and never accessible to passengers or drivers. Verified machinery receives an authoritative verified badge.
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

            <div id="preview-docs-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${docs.map((d) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 0.65rem 0.85rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.85rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${icon("file-check", 18)}
                    <div>
                      <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(d.original_filename || d.filename || d.document_type || "Document")}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.document_type || "Document")}</div>
                    </div>
                  </div>
                  <span class="badge ${d.verification_status === "verified" || d.verification_status === "approved" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem;">
                    ${d.verification_status === "verified" || d.verification_status === "approved" ? "Verified" : "Pending Verification"}
                  </span>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- SUBMIT BUTTONS -->
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button type="submit" id="btn-submit-add-machinery" class="btn btn-primary" style="flex: 2; min-height: 48px; font-weight: 800; font-size: 1.05rem; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
              ${icon("check", 20)} <span>${isEdit ? "SAVE CHANGES" : "PUBLISH MACHINERY"}</span>
            </button>
            <button type="button" id="btn-cancel-machinery-form" class="btn btn-outline" style="flex: 1; min-height: 48px; font-weight: 700;">
              Cancel
            </button>
          </div>

        </form>
      </div>
    `;
  },

  init(containerArg = document, callbacks = {}) {
    const container = (containerArg && typeof containerArg.querySelector === "function") ? containerArg : document;
    const form = container.querySelector("#form-add-machinery");
    if (!form) return;

    const editIdInput = form.querySelector("#machinery-edit-id");
    const editId = editIdInput ? editIdInput.value.trim() : "";
    const isEdit = Boolean(editId);

    // Initialise component state from current item
    if (isEdit && this.currentItem) {
      this.mainPhotoData = this.currentItem.primary_photo || null;
      this.galleryPhotosData = Array.isArray(this.currentItem.gallery_photos)
        ? [...this.currentItem.gallery_photos]
        : (Array.isArray(this.currentItem.photos) && this.currentItem.photos.length > 1 ? this.currentItem.photos.slice(1).map(p => typeof p === "string" ? { file_url: p } : p) : []);
      this.uploadedDocsData = Array.isArray(this.currentItem.documents) ? [...this.currentItem.documents] : [];
    } else {
      this.mainPhotoData = null;
      this.galleryPhotosData = [];
      this.uploadedDocsData = [];
    }

    // Cancel callbacks
    const handleCancel = () => {
      if (typeof callbacks.onCancel === "function") {
        callbacks.onCancel();
      }
    };
    container.querySelector("#btn-cancel-machinery-form")?.addEventListener("click", handleCancel);
    container.querySelector("#btn-cancel-machinery-form-top")?.addEventListener("click", handleCancel);

    // Listing type toggle
    const listingRadios = container.querySelectorAll("input[name='listing_type']");
    const secHire = container.querySelector("#section-hire-pricing");
    const secOp = container.querySelector("#section-operator-pricing");
    const secMinHire = container.querySelector("#section-minimum-hire");
    const secSale = container.querySelector("#section-sale-price");

    const updateListingTypeView = (val) => {
      if (secHire) secHire.style.display = val === "sale" ? "none" : "block";
      if (secOp) secOp.style.display = val === "sale" ? "none" : "block";
      if (secMinHire) secMinHire.style.display = val === "sale" ? "none" : "block";
      if (secSale) secSale.style.display = val === "hire" ? "none" : "block";
    };
    listingRadios.forEach((r) => {
      r.addEventListener("change", () => updateListingTypeView(r.value));
    });

    // Operator toggle
    const opRadios = container.querySelectorAll("input[name='operator_choice']");
    const opRatesContainer = container.querySelector("#container-operator-rates");
    opRadios.forEach((r) => {
      r.addEventListener("change", () => {
        if (opRatesContainer) opRatesContainer.style.display = r.value === "yes" ? "block" : "none";
      });
    });

    // Transport toggle
    const transRadios = container.querySelectorAll("input[name='transport_choice']");
    const transNotes = container.querySelector("#container-transport-notes");
    transRadios.forEach((r) => {
      r.addEventListener("change", () => {
        if (transNotes) transNotes.style.display = r.value === "yes" ? "block" : "none";
      });
    });

    // Main photo upload
    const mainPhotoInput = container.querySelector("#add-mac-main-photo-input");
    const dropzoneMain = container.querySelector("#dropzone-main-photo");
    const btnSelectMain = container.querySelector("#btn-select-main-photo");
    const btnRemoveMain = container.querySelector("#btn-remove-main-photo");
    const previewMain = container.querySelector("#preview-main-photo");
    const imgMainPreview = container.querySelector("#img-main-preview");
    const txtMainFilename = container.querySelector("#txt-main-filename");

    const triggerMainUpload = () => mainPhotoInput?.click();
    dropzoneMain?.addEventListener("click", triggerMainUpload);
    btnSelectMain?.addEventListener("click", triggerMainUpload);

    mainPhotoInput?.addEventListener("change", async () => {
      const file = mainPhotoInput.files?.[0];
      if (!file) return;

      btnSelectMain.disabled = true;
      btnSelectMain.textContent = "Uploading to Cloud...";
      try {
        const uploadRes = await MachineryService.uploadPhoto(file);
        this.mainPhotoData = uploadRes;
        if (imgMainPreview) imgMainPreview.src = uploadRes.file_url;
        if (txtMainFilename) txtMainFilename.textContent = `✓ Main Photo: ${file.name}`;
        if (previewMain) previewMain.style.display = "block";
        if (btnRemoveMain) btnRemoveMain.style.display = "inline-flex";
        btnSelectMain.innerHTML = `${icon("upload", 16)} <span>Change Photo</span>`;
      } catch (err) {
        alert("Could not upload photo: " + err.message);
      } finally {
        btnSelectMain.disabled = false;
      }
    });

    btnRemoveMain?.addEventListener("click", () => {
      this.mainPhotoData = null;
      if (imgMainPreview) imgMainPreview.src = "";
      if (previewMain) previewMain.style.display = "none";
      if (btnRemoveMain) btnRemoveMain.style.display = "none";
      btnSelectMain.innerHTML = `${icon("upload", 16)} <span>+ Add Main Machinery Photo</span>`;
      if (mainPhotoInput) mainPhotoInput.value = "";
    });

    // Gallery photos
    const galleryInput = container.querySelector("#add-mac-gallery-photos-input");
    const btnSelectGallery = container.querySelector("#btn-select-gallery-photos");
    const previewGallery = container.querySelector("#preview-gallery-container");

    btnSelectGallery?.addEventListener("click", () => galleryInput?.click());
    galleryInput?.addEventListener("change", async () => {
      const files = Array.from(galleryInput.files || []);
      if (files.length === 0) return;

      btnSelectGallery.disabled = true;
      btnSelectGallery.textContent = `Uploading ${files.length} photo(s)...`;
      try {
        for (const file of files) {
          const uploadRes = await MachineryService.uploadPhoto(file);
          this.galleryPhotosData.push(uploadRes);

          const idx = this.galleryPhotosData.length - 1;
          const thumb = document.createElement("div");
          thumb.style.cssText = "position: relative; border-radius: 6px; overflow: hidden; height: 70px; border: 1px solid var(--border);";
          thumb.innerHTML = `
            <img src="${uploadRes.file_url}" style="width: 100%; height: 100%; object-fit: cover;" />
            <button type="button" class="btn-remove-gallery-item" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; background: rgba(239,68,68,0.85); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          `;
          previewGallery?.appendChild(thumb);
        }

        this._bindGalleryRemoveButtons(previewGallery);
      } catch (err) {
        alert("Failed to upload gallery photos: " + err.message);
      } finally {
        btnSelectGallery.disabled = false;
        btnSelectGallery.innerHTML = `${icon("images", 16)} <span>+ Add More Photos</span>`;
      }
    });

    this._bindGalleryRemoveButtons(previewGallery);

    // Docs upload
    const hiddenDocInput = container.querySelector("#add-mac-doc-hidden-input");
    const previewDocsContainer = container.querySelector("#preview-docs-container");
    let currentPendingDocType = "Proof of Ownership";

    container.querySelectorAll(".btn-doc-trigger").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPendingDocType = btn.getAttribute("data-type") || "Proof of Ownership";
        hiddenDocInput?.click();
      });
    });

    hiddenDocInput?.addEventListener("change", async () => {
      const file = hiddenDocInput.files?.[0];
      if (!file) return;

      try {
        const uploadRes = await MachineryService.uploadDocument(file, currentPendingDocType, isEdit ? editId : null);
        this.uploadedDocsData.push(uploadRes);

        const docItem = document.createElement("div");
        docItem.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 0.65rem 0.85rem; border-radius: 8px; border: 1px solid var(--border); font-size: 0.85rem;";
        docItem.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${icon("file-check", 18)}
            <div>
              <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(file.name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(currentPendingDocType)}</div>
            </div>
          </div>
          <span class="badge" style="background: rgba(245,158,11,0.15); color: #f59e0b; font-weight: 700; font-size: 0.75rem;">Pending Verification</span>
        `;
        previewDocsContainer?.appendChild(docItem);
      } catch (err) {
        alert("Document upload failed: " + err.message);
      } finally {
        hiddenDocInput.value = "";
      }
    });

    // Form submit
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = form.querySelector("#btn-submit-add-machinery");
      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? "Saving Changes..." : "Publishing Machinery...";

      try {
        const listingType = container.querySelector("input[name='listing_type']:checked")?.value || "both";
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
        const availabilityStatus = container.querySelector("#add-mac-availability").value;

        // Pricing
        const hourlyRate = container.querySelector("#add-mac-rate-hourly").value;
        const dailyRate = container.querySelector("#add-mac-rate-daily").value;
        const weeklyRate = container.querySelector("#add-mac-rate-weekly").value;
        const monthlyRate = container.querySelector("#add-mac-rate-monthly").value;
        const salePrice = container.querySelector("#add-mac-sale-price").value;
        const saleNegotiable = container.querySelector("#add-mac-sale-negotiable").value === "yes";
        const saleNotes = container.querySelector("#add-mac-sale-notes").value;

        // Operator
        const operatorAvailable = container.querySelector("input[name='operator_choice']:checked")?.value === "yes";
        const opHourly = container.querySelector("#add-mac-op-hourly").value;
        const opDaily = container.querySelector("#add-mac-op-daily").value;
        const opWeekly = container.querySelector("#add-mac-op-weekly").value;
        const opMonthly = container.querySelector("#add-mac-op-monthly").value;

        // Transport & Min Hire
        const transportAvailable = container.querySelector("input[name='transport_choice']:checked")?.value === "yes";
        const transportNotes = container.querySelector("#add-mac-transport-notes").value;
        const minHireQty = container.querySelector("#add-mac-min-qty").value;
        const minHireUnit = container.querySelector("#add-mac-min-unit").value;

        // Optional fields
        const serialNumber = container.querySelector("#add-mac-serial").value;
        const operatingWeight = container.querySelector("#add-mac-weight").value;
        const boomSize = container.querySelector("#add-mac-boom").value;

        // Client validations
        if (listingType === "hire" || listingType === "both") {
          if (!hourlyRate && !dailyRate && !weeklyRate && !monthlyRate) {
            throw new Error("Please enter at least one hire rate (Price per Hour, Day, Week, or Month).");
          }
        }
        if (listingType === "sale" || listingType === "both") {
          if (!salePrice || Number(salePrice) <= 0) {
            throw new Error("Please enter a valid positive Sale Price.");
          }
        }

        // Operator rate checks
        if (operatorAvailable) {
          if (hourlyRate && opHourly && Number(opHourly) <= Number(hourlyRate)) {
            throw new Error("With-operator hourly rate must be strictly higher than machinery-only hourly rate.");
          }
          if (dailyRate && opDaily && Number(opDaily) <= Number(dailyRate)) {
            throw new Error("With-operator daily rate must be strictly higher than machinery-only daily rate.");
          }
          if (weeklyRate && opWeekly && Number(opWeekly) <= Number(weeklyRate)) {
            throw new Error("With-operator weekly rate must be strictly higher than machinery-only weekly rate.");
          }
          if (monthlyRate && opMonthly && Number(opMonthly) <= Number(monthlyRate)) {
            throw new Error("With-operator monthly rate must be strictly higher than machinery-only monthly rate.");
          }
        }

        const photoToUse = this.mainPhotoData || {
          id: `mach_photo_${Date.now()}`,
          file_url: "/assets/images/machinery_primary.jpg",
          filename: "machinery_primary.jpg"
        };

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
          sale_negotiable: saleNegotiable,
          sale_notes: saleNotes,
          operator_available: operatorAvailable,
          operator_hourly_rate: opHourly ? Number(opHourly) : null,
          operator_daily_rate: opDaily ? Number(opDaily) : null,
          operator_weekly_rate: opWeekly ? Number(opWeekly) : null,
          operator_monthly_rate: opMonthly ? Number(opMonthly) : null,
          transport_available: transportAvailable,
          transport_notes: transportNotes,
          minimum_hire_period: minHireQty ? Number(minHireQty) : 1,
          minimum_hire_unit: minHireUnit || "days",
          serial_number: serialNumber || null,
          operating_weight: operatingWeight || null,
          boom_size: boomSize || null,
          description,
          availability_status: availabilityStatus,
          primary_photo: photoToUse,
          gallery_photos: this.galleryPhotosData,
          photos: [photoToUse, ...this.galleryPhotosData],
          documents: this.uploadedDocsData
        };

        let result;
        if (isEdit) {
          result = await MachineryService.updateListing(editId, payload);
          alert(`Machinery "${payload.name}" updated and submitted for admin review!`);
        } else {
          result = await MachineryService.createListing(payload);
          alert(`Machinery "${result.name}" submitted for admin approval!`);
        }

        if (typeof callbacks.onSubmitSuccess === "function") {
          callbacks.onSubmitSuccess(result || payload);
        }
      } catch (err) {
        alert("Error saving machinery: " + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${icon("check", 20)} <span>${isEdit ? "SAVE CHANGES" : "PUBLISH MACHINERY"}</span>`;
      }
    });
  },

  _bindGalleryRemoveButtons(previewGallery) {
    if (!previewGallery) return;
    previewGallery.querySelectorAll(".btn-remove-gallery-item").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const index = Number(b.getAttribute("data-index"));
        this.galleryPhotosData.splice(index, 1);
        b.parentElement?.remove();
        // Re-index remaining buttons
        previewGallery.querySelectorAll(".btn-remove-gallery-item").forEach((btn, newIdx) => {
          btn.setAttribute("data-index", String(newIdx));
        });
      };
    });
  }
};
