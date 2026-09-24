// ==============================================================================
// TRANSMOVE MACHINERY MARKETPLACE VIEW
// Heavy plant, agricultural & construction equipment search, multi-rate pricing,
// operator-inclusive hiring, sale enquiries, and sponsored listing prioritization.
// Accessible by Passengers and Drivers via #machinery route.
// ==============================================================================
import { MachineryService, MACHINERY_CATEGORIES } from "../services/machinery.js";
import { AuthService } from "../services/auth.js";
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

const NEUTRAL_MACHINERY_PLACEHOLDER = "data:image/svg+xml;utf8," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240" fill="none">
  <rect width="400" height="240" fill="#0f172a"/>
  <path d="M120 180H280M140 180L160 140H240L260 180M170 140V100H230V140M230 110H300L330 160H310" stroke="#10b981" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="160" cy="180" r="14" fill="#1e293b" stroke="#10b981" stroke-width="4"/>
  <circle cx="240" cy="180" r="14" fill="#1e293b" stroke="#10b981" stroke-width="4"/>
  <text x="200" y="218" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="700">HEAVY MACHINERY</text>
</svg>
`);

export const MachineryMarketplaceView = {
  listings: [],
  filters: {
    query: "",
    category: "all",
    listing_type: "all",
    location: "",
    available_only: false,
    operator_available: "",
    verified_only: false,
    sponsored_only: false,
    min_price: "",
    max_price: ""
  },
  currentProfile: null,
  selectedMachineForHire: null,

  async render() {
    this.currentProfile = await AuthService.getCurrentProfile();
    const activeRole = this.currentProfile?.activeRole || (this.currentProfile ? await AuthService.getActiveRole(this.currentProfile) : "guest");
    const isOwnerOrAdmin = activeRole === "machinery_owner" || this.currentProfile?.role === "admin";

    return `
      <div class="machinery-marketplace-container container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
        
        <!-- HEADER HERO -->
        <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.75rem;">
                ${icon("tractor", 16)} HEAVY PLANT &amp; MACHINERY MARKETPLACE
              </div>
              <h1 style="font-size: 2rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #ffffff;">Heavy Equipment &amp; Machinery</h1>
              <p style="color: #94a3b8; font-size: 1rem; margin: 0; max-width: 650px;">
                Verified excavators, bulldozers, tippers, tractors, and cranes available across Zimbabwe for hire and outright sale. Hire with or without certified operators.
              </p>
            </div>
            ${isOwnerOrAdmin ? `
              <div>
                <a href="#machinery_owner" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 800; box-shadow: 0 4px 14px rgba(16,185,129,0.3);">
                  ${icon("circle-plus", 18)} <span>List Machinery</span>
                </a>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- SEARCH & FILTER BAR -->
        <div class="card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-radius: 12px;">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <!-- Keyword search -->
            <div style="flex: 2; min-width: 220px; position: relative;">
              <input type="text" id="mach-search-input" class="form-input" placeholder="Search by brand, model, city, category..." style="width: 100%; padding-left: 2.25rem; min-height: 44px;" />
              <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
                ${icon("search", 18)}
              </span>
            </div>

            <!-- Category selector -->
            <div style="flex: 1; min-width: 170px;">
              <select id="mach-category-select" class="form-select" style="width: 100%; min-height: 44px;">
                <option value="all">All Categories</option>
                ${MACHINERY_CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("")}
              </select>
            </div>

            <!-- Listing Type Filter -->
            <div style="flex: 1; min-width: 140px;">
              <select id="mach-type-select" class="form-select" style="width: 100%; min-height: 44px;">
                <option value="all">Hire &amp; Sale</option>
                <option value="hire">For Hire</option>
                <option value="sale">For Sale</option>
              </select>
            </div>

            <!-- Operator Filter -->
            <div style="flex: 1; min-width: 160px;">
              <select id="mach-operator-select" class="form-select" style="width: 100%; min-height: 44px;">
                <option value="">Any Operator Option</option>
                <option value="true">Operator Available</option>
                <option value="false">Machinery Only</option>
              </select>
            </div>

            <!-- Search Button -->
            <button id="mach-btn-search" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-weight: 700; min-height: 44px;">
              Filter
            </button>
          </div>

          <!-- Quick Toggle Badges -->
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
            <span style="font-weight: 700; font-size: 0.8rem; text-transform: uppercase;">Quick Filters:</span>
            
            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.3rem 0.75rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-available" />
              <span>Available Now</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.3rem 0.75rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-verified" />
              <span style="color: #3b82f6; font-weight: 600;">Verified Owners Only</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.3rem 0.75rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-sponsored" />
              <span style="color: #10b981; font-weight: 600;">Sponsored Listings</span>
            </label>

            <button type="button" id="mach-btn-reset" class="btn btn-outline btn-sm" style="margin-left: auto; font-size: 0.75rem; padding: 0.25rem 0.65rem;">
              Reset Filters
            </button>
          </div>
        </div>

        <!-- LISTINGS FEED -->
        <div id="machinery-feed-status" style="margin-bottom: 1rem; font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">
          Loading machinery listings...
        </div>

        <div id="machinery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem;">
          <!-- Rendered dynamically -->
        </div>

      </div>

      <!-- HIRE MODAL SHELL (MULTI-RATE & OPERATOR PRICING) -->
      <div id="machinery-hire-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 620px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; max-height: 90vh; overflow-y: auto; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 id="hire-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #10b981;">Hire Machinery</h3>
            <button type="button" id="btn-close-hire-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;">✕</button>
          </div>
          <div id="hire-modal-body"></div>
        </div>
      </div>

      <!-- DETAILS MODAL SHELL (FULL SPECIFICATIONS & GALLERY) -->
      <div id="machinery-details-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 680px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; max-height: 90vh; overflow-y: auto; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 id="details-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800;">Equipment Specifications</h3>
            <button type="button" id="btn-close-details-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;">✕</button>
          </div>
          <div id="details-modal-body"></div>
        </div>
      </div>

      <!-- BUY / ENQUIRE MODAL SHELL -->
      <div id="machinery-enquiry-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 540px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; max-height: 90vh; overflow-y: auto; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 id="enquiry-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #8b5cf6;">Purchase Enquiry</h3>
            <button type="button" id="btn-close-enquiry-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem;">✕</button>
          </div>
          <div id="enquiry-modal-body"></div>
        </div>
      </div>
    `;
  },

  async init(container = document) {
    try {
      this.currentProfile = await AuthService.getCurrentUser().catch(() => null);
    } catch (_) {}

    this.bindFilters(container);
    await this.loadListings(container);

    // Modal close handlers
    container.querySelector("#btn-close-hire-modal")?.addEventListener("click", () => {
      container.querySelector("#machinery-hire-modal-backdrop").style.display = "none";
    });
    container.querySelector("#btn-close-details-modal")?.addEventListener("click", () => {
      container.querySelector("#machinery-details-modal-backdrop").style.display = "none";
    });
    container.querySelector("#btn-close-enquiry-modal")?.addEventListener("click", () => {
      container.querySelector("#machinery-enquiry-modal-backdrop").style.display = "none";
    });

    // Check URL parameters for direct modal open
    const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const hireTargetId = urlParams.get("hire");
    const viewTargetId = urlParams.get("id");
    if (hireTargetId) {
      this.openHireModal(hireTargetId, container);
    } else if (viewTargetId) {
      this.openDetailsModal(viewTargetId, container);
    }
  },

  bindFilters(container) {
    const searchInput = container.querySelector("#mach-search-input");
    const categorySelect = container.querySelector("#mach-category-select");
    const typeSelect = container.querySelector("#mach-type-select");
    const operatorSelect = container.querySelector("#mach-operator-select");
    const filterAvail = container.querySelector("#mach-filter-available");
    const filterVerif = container.querySelector("#mach-filter-verified");
    const filterSpon = container.querySelector("#mach-filter-sponsored");
    const btnSearch = container.querySelector("#mach-btn-search");
    const btnReset = container.querySelector("#mach-btn-reset");

    const apply = () => {
      this.filters.query = searchInput?.value?.trim() || "";
      this.filters.category = categorySelect?.value || "all";
      this.filters.listing_type = typeSelect?.value || "all";
      this.filters.operator_available = operatorSelect?.value || "";
      this.filters.available_only = Boolean(filterAvail?.checked);
      this.filters.verified_only = Boolean(filterVerif?.checked);
      this.filters.sponsored_only = Boolean(filterSpon?.checked);
      this.loadListings(container);
    };

    btnSearch?.addEventListener("click", apply);
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
    categorySelect?.addEventListener("change", apply);
    typeSelect?.addEventListener("change", apply);
    operatorSelect?.addEventListener("change", apply);
    filterAvail?.addEventListener("change", apply);
    filterVerif?.addEventListener("change", apply);
    filterSpon?.addEventListener("change", apply);

    btnReset?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categorySelect) categorySelect.value = "all";
      if (typeSelect) typeSelect.value = "all";
      if (operatorSelect) operatorSelect.value = "";
      if (filterAvail) filterAvail.checked = false;
      if (filterVerif) filterVerif.checked = false;
      if (filterSpon) filterSpon.checked = false;
      this.filters = {
        query: "",
        category: "all",
        listing_type: "all",
        location: "",
        available_only: false,
        operator_available: "",
        verified_only: false,
        sponsored_only: false,
        min_price: "",
        max_price: ""
      };
      this.loadListings(container);
    });
  },

  async loadListings(container) {
    const grid = container.querySelector("#machinery-grid");
    const statusEl = container.querySelector("#machinery-feed-status");
    if (!grid) return;

    if (statusEl) statusEl.textContent = "Loading machinery listings from database...";

    try {
      this.listings = await MachineryService.listMarketplace(this.filters);

      if (statusEl) {
        statusEl.textContent = `Showing ${this.listings.length} equipment listing${this.listings.length === 1 ? "" : "s"} across Zimbabwe`;
      }

      if (this.listings.length === 0) {
        const isOwnerOrAdmin = this.currentProfile?.activeRole === "machinery_owner" || this.currentProfile?.role === "machinery_owner" || this.currentProfile?.role === "admin";
        grid.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; padding: 3rem; text-align: center;">
            <div style="font-size: 3rem; margin-bottom: 0.5rem;">🚜</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No machinery found</h3>
            <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto;">
              No machinery matching your filter criteria is currently listed. Try adjusting your search or category.
            </p>
            ${isOwnerOrAdmin ? `<a href="#machinery_owner" class="btn btn-primary" style="font-weight: 700;">+ List Heavy Machinery</a>` : ""}
          </div>
        `;
        return;
      }

      grid.innerHTML = this.listings.map((item) => this.renderMachineryCard(item)).join("");
      this.bindCardActions(container);
    } catch (err) {
      if (statusEl) statusEl.textContent = "Could not load listings.";
      grid.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; padding: 2rem; color: #ef4444; text-align: center;">
          Failed to load machinery marketplace: ${escapeHtml(err.message)}
        </div>
      `;
    }
  },

  renderMachineryCard(item) {
    const isSponsored = Boolean(item.is_sponsored);
    const hasOperator = Boolean(item.operator_available);
    const photoUrl = item.primary_photo?.file_url || (Array.isArray(item.photos) && item.photos.length > 0 ? (item.photos[0].file_url || item.photos[0]) : NEUTRAL_MACHINERY_PLACEHOLDER);

    const listingType = item.listing_type || "hire"; // 'hire' | 'sale' | 'both'
    const isHire = listingType === "hire" || listingType === "both";
    const isSale = listingType === "sale" || listingType === "both";

    // Rates that exist (Part 11)
    const existingRates = [];
    if (item.hourly_rate) existingRates.push(`$${Number(item.hourly_rate).toFixed(2)}/hr`);
    if (item.daily_rate || item.base_hire_rate) existingRates.push(`$${Number(item.daily_rate || item.base_hire_rate).toFixed(2)}/day`);
    if (item.weekly_rate) existingRates.push(`$${Number(item.weekly_rate).toFixed(2)}/wk`);
    if (item.monthly_rate) existingRates.push(`$${Number(item.monthly_rate).toFixed(2)}/mo`);

    const startingHireRate = existingRates.length > 0 ? existingRates[0] : null;

    return `
      <div class="card machinery-card" data-id="${escapeHtml(item.id)}" style="display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; padding: 0; position: relative; border: ${isSponsored ? "2px solid #10b981" : "1px solid var(--border)"}; box-shadow: ${isSponsored ? "0 4px 14px rgba(16, 185, 129, 0.18)" : "var(--shadow-sm)"};">
        
        <!-- SPONSORED BADGE (Ranked first) -->
        ${isSponsored ? `
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; background: #10b981; color: #ffffff; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.5px; padding: 0.25rem 0.65rem; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            SPONSORED
          </div>
        ` : ""}

        <!-- AVAILABILITY BADGE -->
        <div style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2;">
          <span class="badge ${item.availability_status === "available" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem; font-weight: 700; text-transform: capitalize;">
            ${item.availability_status === "available" ? "Available" : escapeHtml(item.availability_status || "Busy")}
          </span>
        </div>

        <!-- MAIN PHOTO -->
        <div style="width: 100%; height: 185px; background: #0f172a; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='${NEUTRAL_MACHINERY_PLACEHOLDER}'; this.style.objectFit='contain';" />
          <span class="badge" style="position: absolute; bottom: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.7); color: #fff; font-size: 0.7rem; font-weight: 700;">
            ${listingType === "both" ? "FOR HIRE & SALE" : (listingType === "sale" ? "FOR SALE" : "FOR HIRE")}
          </span>
        </div>

        <!-- CONTENT BODY -->
        <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
            <span class="badge badge-info" style="font-size: 0.7rem;">${escapeHtml(item.category)}</span>
            
            ${item.owner_verified ? `
              <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 0.2rem; font-weight: 700;">
                ${icon("shield-check", 13)} Verified Owner
              </span>
            ` : ""}

            ${hasOperator ? `
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.7rem; font-weight: 700;">
                Operator Available
              </span>
            ` : ""}
          </div>

          <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0 0 0.25rem 0; color: var(--text-main);">
            ${escapeHtml(item.name)}
          </h3>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">
            ${escapeHtml(item.brand)} ${escapeHtml(item.model)} ${item.year ? `• ${escapeHtml(item.year)}` : ""} ${item.condition ? `• ${escapeHtml(item.condition)}` : ""}
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.85rem;">
            <span>📍</span> <span>${escapeHtml(item.location || item.province || "Zimbabwe")}</span>
          </div>

          <!-- PRICING TIERS -->
          <div style="background: var(--bg-hover); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid var(--border); font-size: 0.85rem;">
            ${isHire && existingRates.length > 0 ? `
              <div style="margin-bottom: 0.25rem;">
                <span style="color: var(--text-muted);">Hire:</span> <strong style="color: #10b981;">From ${existingRates.join(" • ")}</strong>
              </div>
            ` : ""}

            ${isSale && item.sale_price ? `
              <div style="color: #ec4899; font-weight: 700;">
                Sale Price: $${Number(item.sale_price).toLocaleString()} USD
              </div>
            ` : ""}
          </div>

          <!-- ACTIONS BAR -->
          <div style="display: flex; gap: 0.5rem; margin-top: auto; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-sm btn-view-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 600; min-height: 42px;">
              View Details
            </button>

            ${isHire ? `
              <button type="button" class="btn btn-primary btn-sm btn-hire-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 700; min-height: 42px;">
                Hire
              </button>
            ` : ""}

            ${isSale ? `
              <button type="button" class="btn btn-sm btn-enquire-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 700; min-height: 42px; background: #8b5cf6; color: #fff; border: 0;">
                Buy / Enquire
              </button>
            ` : ""}
          </div>

        </div>

      </div>
    `;
  },

  bindCardActions(container) {
    container.querySelectorAll(".btn-view-machinery").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openDetailsModal(id, container);
      });
    });

    container.querySelectorAll(".btn-hire-machinery").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openHireModal(id, container);
      });
    });

    container.querySelectorAll(".btn-enquire-machinery").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.openEnquiryModal(id, container);
      });
    });
  },

  openDetailsModal(machineryId, container) {
    const item = this.listings.find((m) => m.id === machineryId);
    if (!item) return;

    const modal = container.querySelector("#machinery-details-modal-backdrop");
    const titleEl = container.querySelector("#details-modal-title");
    const bodyEl = container.querySelector("#details-modal-body");
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `${item.name} (${item.brand} ${item.model})`;

    const photoUrl = item.primary_photo?.file_url || (Array.isArray(item.photos) && item.photos.length > 0 ? (item.photos[0].file_url || item.photos[0]) : "/assets/images/logo.png");
    const gallery = Array.isArray(item.gallery_photos) && item.gallery_photos.length > 0 ? item.gallery_photos : (Array.isArray(item.photos) ? item.photos : []);

    bodyEl.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <div id="details-main-img-box" style="height: 240px; border-radius: 8px; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center; margin-bottom: 0.5rem;">
          <img id="details-main-img" src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png';" />
        </div>

        ${gallery.length > 1 ? `
          <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
            ${gallery.map((g) => {
              const u = g.file_url || g.url || g;
              return `
                <img class="details-thumb" src="${escapeHtml(u)}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--border);" onclick="document.querySelector('#details-main-img').src='${escapeHtml(u)}'" />
              `;
            }).join("")}
          </div>
        ` : ""}
      </div>

      <!-- SPECS GRID -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; font-size: 0.85rem; background: var(--bg-hover); padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
        <div><span style="color: var(--text-muted);">Category:</span> <strong>${escapeHtml(item.category)}</strong></div>
        <div><span style="color: var(--text-muted);">Condition:</span> <strong>${escapeHtml(item.condition || "Good")}</strong></div>
        <div><span style="color: var(--text-muted);">Hours:</span> <strong>${escapeHtml(item.operating_hours || 0)} hrs</strong></div>
        <div><span style="color: var(--text-muted);">Fuel:</span> <strong>${escapeHtml(item.fuel_type || "Diesel")}</strong></div>
        <div><span style="color: var(--text-muted);">Power:</span> <strong>${escapeHtml(item.power || "Standard")}</strong></div>
        <div><span style="color: var(--text-muted);">Capacity:</span> <strong>${escapeHtml(item.capacity || "Standard")}</strong></div>
        <div><span style="color: var(--text-muted);">Location:</span> <strong>${escapeHtml(item.location || item.province || "Zimbabwe")}</strong></div>
        <div><span style="color: var(--text-muted);">Transport:</span> <strong>${item.transport_available ? "Available" : "Self-collect"}</strong></div>
      </div>

      <!-- PRICING TABLE -->
      <div style="margin-bottom: 1.25rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 1rem;">
        <h4 style="font-size: 0.9rem; font-weight: 800; margin: 0 0 0.5rem 0;">Pricing &amp; Rates</h4>
        <div style="font-size: 0.85rem; line-height: 1.6;">
          ${item.hourly_rate ? `<div>• Hourly Hire: <strong>$${Number(item.hourly_rate).toFixed(2)}</strong> ${item.operator_hourly_rate ? `(With operator: <strong style="color: #10b981;">$${Number(item.operator_hourly_rate).toFixed(2)}</strong>)` : ""}</div>` : ""}
          ${item.daily_rate || item.base_hire_rate ? `<div>• Daily Hire: <strong>$${Number(item.daily_rate || item.base_hire_rate).toFixed(2)}</strong> ${item.operator_daily_rate || item.operator_inclusive_rate ? `(With operator: <strong style="color: #10b981;">$${Number(item.operator_daily_rate || item.operator_inclusive_rate).toFixed(2)}</strong>)` : ""}</div>` : ""}
          ${item.weekly_rate ? `<div>• Weekly Hire: <strong>$${Number(item.weekly_rate).toFixed(2)}</strong> ${item.operator_weekly_rate ? `(With operator: <strong style="color: #10b981;">$${Number(item.operator_weekly_rate).toFixed(2)}</strong>)` : ""}</div>` : ""}
          ${item.monthly_rate ? `<div>• Monthly Hire: <strong>$${Number(item.monthly_rate).toFixed(2)}</strong> ${item.operator_monthly_rate ? `(With operator: <strong style="color: #10b981;">$${Number(item.operator_monthly_rate).toFixed(2)}</strong>)` : ""}</div>` : ""}
          ${item.sale_price ? `<div style="margin-top: 0.35rem; color: #ec4899; font-weight: 800;">• Purchase Price: $${Number(item.sale_price).toLocaleString()} USD</div>` : ""}
        </div>
      </div>

      ${item.description ? `
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; margin-bottom: 0.35rem; color: var(--text-muted); text-transform: uppercase;">Equipment Description</h4>
          <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main); margin: 0;">${escapeHtml(item.description)}</p>
        </div>
      ` : ""}

      ${item.transport_notes ? `
        <div style="margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--text-muted); background: var(--bg-hover); padding: 0.75rem; border-radius: 6px;">
          🚚 <strong>Transport Notes:</strong> ${escapeHtml(item.transport_notes)}
        </div>
      ` : ""}

      <!-- OWNER VERIFICATION BADGE -->
      <div style="background: var(--bg-hover); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.5rem; border: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(item.owner?.full_name || "Machinery Fleet Owner")}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            ${item.owner_verified ? "🛡️ Verified Heavy Plant Provider" : "Machinery Lister"}
          </div>
        </div>
        ${item.owner_verified ? `
          <span class="badge badge-success" style="font-size: 0.75rem; font-weight: 700;">VERIFIED OWNER</span>
        ` : ""}
      </div>

      <!-- ACTIONS -->
      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-outline" onclick="document.querySelector('#machinery-details-modal-backdrop').style.display='none'">Close</button>
        ${item.listing_type !== "sale" ? `
          <button type="button" class="btn btn-primary" id="btn-details-to-hire" style="font-weight: 700;">Hire Machinery</button>
        ` : ""}
        ${item.listing_type !== "hire" ? `
          <button type="button" class="btn" id="btn-details-to-enquire" style="font-weight: 700; background: #8b5cf6; color: #fff;">Buy / Enquire</button>
        ` : ""}
      </div>
    `;

    bodyEl.querySelector("#btn-details-to-hire")?.addEventListener("click", () => {
      modal.style.display = "none";
      this.openHireModal(machineryId, container);
    });

    bodyEl.querySelector("#btn-details-to-enquire")?.addEventListener("click", () => {
      modal.style.display = "none";
      this.openEnquiryModal(machineryId, container);
    });

    modal.style.display = "flex";
  },

  openHireModal(machineryId, container) {
    const item = this.listings.find((m) => m.id === machineryId);
    if (!item) return;

    this.selectedMachineForHire = item;
    const modal = container.querySelector("#machinery-hire-modal-backdrop");
    const titleEl = container.querySelector("#hire-modal-title");
    const bodyEl = container.querySelector("#hire-modal-body");
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `Hire: ${item.name}`;

    // Available rate periods for this machine
    const supportedPeriods = [];
    if (item.hourly_rate) supportedPeriods.push({ id: "hourly", label: "Hourly", base: Number(item.hourly_rate), op: Number(item.operator_hourly_rate || (item.hourly_rate * 1.3)) });
    if (item.daily_rate || item.base_hire_rate) supportedPeriods.push({ id: "daily", label: "Daily", base: Number(item.daily_rate || item.base_hire_rate), op: Number(item.operator_daily_rate || item.operator_inclusive_rate || ((item.daily_rate || item.base_hire_rate) * 1.3)) });
    if (item.weekly_rate) supportedPeriods.push({ id: "weekly", label: "Weekly", base: Number(item.weekly_rate), op: Number(item.operator_weekly_rate || (item.weekly_rate * 1.25)) });
    if (item.monthly_rate) supportedPeriods.push({ id: "monthly", label: "Monthly", base: Number(item.monthly_rate), op: Number(item.operator_monthly_rate || (item.monthly_rate * 1.2)) });

    if (supportedPeriods.length === 0) {
      supportedPeriods.push({ id: "daily", label: "Daily", base: 100, op: 150 });
    }

    const defaultPeriod = supportedPeriods.find((p) => p.id === "daily") || supportedPeriods[0];
    const hasOperator = Boolean(item.operator_available);

    const callerName = this.currentProfile?.full_name || "";
    const callerPhone = this.currentProfile?.phone || "";

    bodyEl.innerHTML = `
      <form id="machinery-hire-form">
        <!-- EQUIPMENT SUMMARY -->
        <div style="background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 1rem;">${escapeHtml(item.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.brand)} ${escapeHtml(item.model)} • 📍 ${escapeHtml(item.location || item.province)}</div>
          </div>
          <span class="badge badge-info">${escapeHtml(item.category)}</span>
        </div>

        <!-- 1. RATE PERIOD SELECTOR (Part 14) -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem; display: block;">Select Billing Period:</label>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${supportedPeriods.map((p, idx) => `
              <label class="hire-period-pill" style="flex: 1; min-width: 90px; text-align: center; border: 1px solid var(--border); padding: 0.5rem 0.75rem; border-radius: 8px; cursor: pointer; background: ${p.id === defaultPeriod.id ? "rgba(16, 185, 129, 0.1)" : "var(--bg-card)"}; border-color: ${p.id === defaultPeriod.id ? "#10b981" : "var(--border)"}; font-weight: 700; font-size: 0.85rem;">
                <input type="radio" name="hire_period_radio" value="${p.id}" ${p.id === defaultPeriod.id ? "checked" : ""} style="display: none;" />
                <div>${escapeHtml(p.label)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">$${p.base.toFixed(2)}</div>
              </label>
            `).join("")}
          </div>
        </div>

        <!-- 2. OPERATOR SELECTION (Part 13) -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem; display: block;">Operator Option:</label>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <!-- OPTION A: MACHINERY ONLY -->
            <label id="hire-opt-without-card" style="border: 2px solid #2563eb; background: rgba(37,99,235,0.05); border-radius: 8px; padding: 0.85rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 700; font-size: 0.95rem;">Machinery Only</span>
                <input type="radio" name="with_operator_radio" value="false" checked />
              </div>
              <div id="hire-without-op-rate-display" style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">$${defaultPeriod.base.toFixed(2)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
                Hirer operates or provides own qualified operator.
              </div>
            </label>

            <!-- OPTION B: WITH OPERATOR -->
            <label id="hire-opt-with-card" style="border: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; padding: 0.85rem; cursor: ${hasOperator ? "pointer" : "not-allowed"}; opacity: ${hasOperator ? "1" : "0.5"}; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 700; font-size: 0.95rem;">Machinery + Operator</span>
                <input type="radio" name="with_operator_radio" value="true" ${hasOperator ? "" : "disabled"} />
              </div>
              <div id="hire-with-op-rate-display" style="font-size: 1.1rem; font-weight: 800; color: #10b981;">
                ${hasOperator ? `$${defaultPeriod.op.toFixed(2)}` : "Not available"}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
                Includes certified equipment operator.
              </div>
            </label>
          </div>

          <div id="operator-notice-box" style="margin-top: 0.6rem; padding: 0.6rem 0.85rem; border-radius: 6px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.8rem; color: #b45309; line-height: 1.4;">
            ⚠️ Operator not included. You must provide a suitable operator.
          </div>
        </div>

        <!-- 3. QUANTITY / DURATION -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label" id="lbl-hire-duration">Duration Units</label>
            <input type="number" id="hire-duration-units" class="form-input" min="1" value="1" required style="min-height: 44px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" id="hire-start-date" class="form-input" value="${new Date().toISOString().split("T")[0]}" required style="min-height: 44px;" />
          </div>
        </div>

        <!-- 4. TOTAL PREVIEW -->
        <div style="background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem;">
            <span style="color: var(--text-muted);">Rate Applied:</span>
            <span id="hire-calc-rate" style="font-weight: 700;">$${defaultPeriod.base.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 1px dashed var(--border); padding-top: 0.5rem; margin-top: 0.5rem;">
            <span>Estimated Total:</span>
            <span id="hire-calc-total" style="color: #10b981;">$${defaultPeriod.base.toFixed(2)} USD</span>
          </div>
        </div>

        <!-- 5. JOB SITE & CONTACT DETAILS -->
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Job Site Location / Site Address *</label>
          <input type="text" id="hire-job-location" class="form-input" placeholder="e.g. Plot 14, Norton Industrial Area" value="${escapeHtml(item.location)}" required style="min-height: 44px;" />
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Work Description / Notes</label>
          <textarea id="hire-notes" class="form-input" rows="2" placeholder="Briefly describe the task (e.g. trenching for water pipe, site leveling, road scrape)..."></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Your Name *</label>
            <input type="text" id="hire-contact-name" class="form-input" value="${escapeHtml(callerName)}" required style="min-height: 44px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Contact Phone *</label>
            <input type="tel" id="hire-contact-phone" class="form-input" value="${escapeHtml(callerPhone)}" placeholder="+263..." required style="min-height: 44px;" />
          </div>
        </div>

        <div id="hire-submit-error" style="color: #ef4444; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" onclick="document.querySelector('#machinery-hire-modal-backdrop').style.display='none'">Cancel</button>
          <button type="submit" id="btn-submit-hire-request" class="btn btn-primary" style="font-weight: 800; min-height: 44px; padding: 0.65rem 1.5rem;">
            Submit Hire Request
          </button>
        </div>
      </form>
    `;

    // Dynamic price calculation
    const form = bodyEl.querySelector("#machinery-hire-form");
    const periodRadios = form.querySelectorAll("input[name='hire_period_radio']");
    const opRadios = form.querySelectorAll("input[name='with_operator_radio']");
    const durationInput = form.querySelector("#hire-duration-units");
    const calcRateEl = form.querySelector("#hire-calc-rate");
    const calcTotalEl = form.querySelector("#hire-calc-total");
    const noticeBox = form.querySelector("#operator-notice-box");
    const optWithoutCard = form.querySelector("#hire-opt-without-card");
    const optWithCard = form.querySelector("#hire-opt-with-card");
    const withoutDisplay = form.querySelector("#hire-without-op-rate-display");
    const withDisplay = form.querySelector("#hire-with-op-rate-display");
    const errorEl = form.querySelector("#hire-submit-error");

    const updateCalc = () => {
      const selectedPeriodId = form.querySelector("input[name='hire_period_radio']:checked")?.value || "daily";
      const periodObj = supportedPeriods.find((p) => p.id === selectedPeriodId) || defaultPeriod;

      const isWithOp = form.querySelector("input[name='with_operator_radio']:checked")?.value === "true";
      const units = Math.max(1, Number(durationInput.value || 1));

      const rate = isWithOp ? periodObj.op : periodObj.base;
      const total = rate * units;

      withoutDisplay.textContent = `$${periodObj.base.toFixed(2)}`;
      if (hasOperator) withDisplay.textContent = `$${periodObj.op.toFixed(2)}`;

      calcRateEl.textContent = `$${rate.toFixed(2)} (${periodObj.label})`;
      calcTotalEl.textContent = `$${total.toFixed(2)} USD`;

      // Update pills styling
      bodyEl.querySelectorAll(".hire-period-pill").forEach((pill) => {
        const rad = pill.querySelector("input");
        if (rad.checked) {
          pill.style.background = "rgba(16, 185, 129, 0.1)";
          pill.style.borderColor = "#10b981";
        } else {
          pill.style.background = "var(--bg-card)";
          pill.style.borderColor = "var(--border)";
        }
      });

      if (isWithOp) {
        noticeBox.textContent = "✓ Includes certified and qualified equipment operator provided by owner.";
        noticeBox.style.color = "#047857";
        noticeBox.style.background = "rgba(16, 185, 129, 0.1)";
        noticeBox.style.borderColor = "rgba(16, 185, 129, 0.3)";
        if (optWithCard) {
          optWithCard.style.borderColor = "#10b981";
          optWithCard.style.background = "rgba(16, 185, 129, 0.05)";
        }
        if (optWithoutCard) {
          optWithoutCard.style.borderColor = "var(--border)";
          optWithoutCard.style.background = "var(--bg-card)";
        }
      } else {
        noticeBox.textContent = "⚠️ Operator not included. You must provide a suitable operator.";
        noticeBox.style.color = "#b45309";
        noticeBox.style.background = "rgba(245, 158, 11, 0.1)";
        noticeBox.style.borderColor = "rgba(245, 158, 11, 0.3)";
        if (optWithoutCard) {
          optWithoutCard.style.borderColor = "#2563eb";
          optWithoutCard.style.background = "rgba(37, 99, 235, 0.05)";
        }
        if (optWithCard) {
          optWithCard.style.borderColor = "var(--border)";
          optWithCard.style.background = "var(--bg-card)";
        }
      }
    };

    periodRadios.forEach((r) => r.addEventListener("change", updateCalc));
    opRadios.forEach((r) => r.addEventListener("change", updateCalc));
    durationInput?.addEventListener("input", updateCalc);
    updateCalc();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";
      const submitBtn = form.querySelector("#btn-submit-hire-request");
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting Request...";

      try {
        const selectedPeriodId = form.querySelector("input[name='hire_period_radio']:checked")?.value || "daily";
        const isWithOp = form.querySelector("input[name='with_operator_radio']:checked")?.value === "true";
        const units = Math.max(1, Number(durationInput.value || 1));
        const startDate = form.querySelector("#hire-start-date")?.value || new Date().toISOString();

        await MachineryService.submitHireRequest({
          machinery_id: item.id,
          with_operator: isWithOp,
          rate_period: selectedPeriodId,
          duration_units: units,
          start_date: startDate,
          job_location: form.querySelector("#hire-job-location")?.value || item.location,
          notes: form.querySelector("#hire-notes")?.value || "",
          contact_name: form.querySelector("#hire-contact-name")?.value || "",
          contact_phone: form.querySelector("#hire-contact-phone")?.value || ""
        });

        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">🎉</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem; color: #10b981;">Hire Request Submitted!</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.4;">
              Your hire request has been securely dispatched to the machinery owner. They will confirm availability and contact you.
            </p>
            <button type="button" class="btn btn-primary" onclick="document.querySelector('#machinery-hire-modal-backdrop').style.display='none'">
              Done
            </button>
          </div>
        `;
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to submit hire request.";
          errorEl.style.display = "block";
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Hire Request";
      }
    });

    modal.style.display = "flex";
  },

  openEnquiryModal(machineryId, container) {
    const item = this.listings.find((m) => m.id === machineryId);
    if (!item) return;

    const modal = container.querySelector("#machinery-enquiry-modal-backdrop");
    const titleEl = container.querySelector("#enquiry-modal-title");
    const bodyEl = container.querySelector("#enquiry-modal-body");
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `Purchase Enquiry: ${item.name}`;

    const callerName = this.currentProfile?.full_name || "";
    const callerPhone = this.currentProfile?.phone || "";
    const callerEmail = this.currentProfile?.email || "";

    bodyEl.innerHTML = `
      <form id="machinery-enquiry-form">
        <div style="background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid var(--border);">
          <div style="font-weight: 700;">${escapeHtml(item.name)}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
            ${item.sale_price ? `<span style="color: #ec4899; font-weight: 800;">Asking Price: $${Number(item.sale_price).toLocaleString()} USD</span> • ` : ""}
            📍 ${escapeHtml(item.location || item.province)}
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Your Message / Offer Details *</label>
          <textarea id="enq-message" class="form-input" rows="4" placeholder="I am interested in inspecting or purchasing this equipment. Please let me know when it can be viewed..." required></textarea>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Your Full Name *</label>
          <input type="text" id="enq-name" class="form-input" value="${escapeHtml(callerName)}" required style="min-height: 44px;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="tel" id="enq-phone" class="form-input" value="${escapeHtml(callerPhone)}" placeholder="+263..." style="min-height: 44px;" />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address</label>
            <input type="email" id="enq-email" class="form-input" value="${escapeHtml(callerEmail)}" placeholder="name@domain.com" style="min-height: 44px;" />
          </div>
        </div>

        <div id="enq-submit-error" style="color: #ef4444; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" onclick="document.querySelector('#machinery-enquiry-modal-backdrop').style.display='none'">Cancel</button>
          <button type="submit" id="btn-submit-enquiry" class="btn btn-primary" style="font-weight: 800; min-height: 44px; padding: 0.65rem 1.5rem; background: #8b5cf6; border: 0;">
            Send Enquiry to Owner
          </button>
        </div>
      </form>
    `;

    const form = bodyEl.querySelector("#machinery-enquiry-form");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = form.querySelector("#enq-submit-error");
      const submitBtn = form.querySelector("#btn-submit-enquiry");
      if (errorEl) errorEl.style.display = "none";
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending Enquiry...";

      try {
        await MachineryService.submitEnquiry({
          machinery_id: item.id,
          message: form.querySelector("#enq-message")?.value || "",
          contact_name: form.querySelector("#enq-name")?.value || "",
          contact_phone: form.querySelector("#enq-phone")?.value || "",
          contact_email: form.querySelector("#enq-email")?.value || ""
        });

        bodyEl.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">✉️</div>
            <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem; color: #8b5cf6;">Enquiry Sent!</h3>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.4;">
              Your purchase enquiry has been delivered to the equipment owner. They will review your offer and get in touch with you.
            </p>
            <button type="button" class="btn btn-primary" onclick="document.querySelector('#machinery-enquiry-modal-backdrop').style.display='none'">
              Close
            </button>
          </div>
        `;
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to send enquiry.";
          errorEl.style.display = "block";
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Enquiry to Owner";
      }
    });

    modal.style.display = "flex";
  }
};
