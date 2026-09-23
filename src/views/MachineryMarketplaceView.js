// ==============================================================================
// TRANSMOVE MACHINERY MARKETPLACE VIEW
// Authoritative Supabase-backed heavy equipment marketplace for passengers,
// drivers, businesses, and contractors.
// Features: Search, filter, sponsored top-ranking, with/without operator pricing,
// and server-authoritative hire request lifecycle.
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

export const MachineryMarketplaceView = {
  listings: [],
  filters: {
    query: "",
    category: "all",
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
    return `
      <div class="machinery-marketplace-container container" style="padding-top: 1.5rem; padding-bottom: 4rem;">
        
        <!-- HEADER HERO -->
        <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: #10b981; margin-bottom: 0.75rem;">
                ${icon("tractor", 16)} HEAVY PLANT &amp; MACHINERY MARKETPLACE
              </div>
              <h1 style="font-size: 2rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #ffffff;">Rent Heavy Machinery &amp; Equipment</h1>
              <p style="color: #94a3b8; font-size: 1rem; margin: 0; max-width: 650px;">
                Verified excavators, bulldozers, tippers, tractors, and cranes available across Zimbabwe. Hire with or without certified operators.
              </p>
            </div>
            <div>
              <a href="#machinery_owner" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                ${icon("circle-plus", 18)} <span>List Your Machinery</span>
              </a>
            </div>
          </div>
        </div>

        <!-- SEARCH & FILTER BAR -->
        <div class="card" style="margin-bottom: 1.5rem; padding: 1.25rem; border-radius: 12px;">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
            <!-- Keyword search -->
            <div style="flex: 2; min-width: 240px; position: relative;">
              <input type="text" id="mach-search-input" class="form-input" placeholder="Search by name, brand, model, or city (e.g. CAT 320, Excavator, Gweru)..." style="width: 100%; padding-left: 2.25rem;" />
              <span style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none;">
                ${icon("search", 18)}
              </span>
            </div>

            <!-- Category selector -->
            <div style="flex: 1; min-width: 180px;">
              <select id="mach-category-select" class="form-select" style="width: 100%;">
                <option value="all">All Categories</option>
                ${MACHINERY_CATEGORIES.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("")}
              </select>
            </div>

            <!-- Operator Filter -->
            <div style="flex: 1; min-width: 180px;">
              <select id="mach-operator-select" class="form-select" style="width: 100%;">
                <option value="">Any Operator Option</option>
                <option value="true">Operator Available</option>
                <option value="false">Machinery Only</option>
              </select>
            </div>

            <!-- Search Button -->
            <button id="mach-btn-search" class="btn btn-primary" style="padding: 0.6rem 1.25rem; font-weight: 700;">
              Filter
            </button>
          </div>

          <!-- Quick Toggle Badges -->
          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
            <span style="font-weight: 600; font-size: 0.8rem; text-transform: uppercase;">Quick Filters:</span>
            
            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-available" />
              <span>Available Now</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-verified" />
              <span>Verified Owners</span>
            </label>

            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; padding: 0.25rem 0.65rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-hover);">
              <input type="checkbox" id="mach-filter-sponsored" />
              <span style="color: #10b981; font-weight: 600;">Sponsored Only</span>
            </label>

            <button type="button" id="mach-btn-reset" class="btn btn-outline btn-sm" style="margin-left: auto; font-size: 0.75rem; padding: 0.2rem 0.5rem;">
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

      <!-- HIRE MODAL SHELL -->
      <div id="machinery-hire-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 600px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; max-height: 90vh; overflow-y: auto; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 id="hire-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800;">Hire Machinery</h3>
            <button type="button" id="btn-close-hire-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem; font-size: 1rem;">✕</button>
          </div>
          <div id="hire-modal-body">
            <!-- Injected dynamically -->
          </div>
        </div>
      </div>

      <!-- DETAILS MODAL SHELL -->
      <div id="machinery-details-modal-backdrop" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999; overflow-y: auto; padding: 1.5rem; align-items: center; justify-content: center;">
        <div class="card" style="width: 100%; max-width: 650px; background: var(--bg-card); border-radius: 14px; padding: 1.75rem; max-height: 90vh; overflow-y: auto; margin: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.75rem;">
            <h3 id="details-modal-title" style="margin: 0; font-size: 1.25rem; font-weight: 800;">Equipment Specifications</h3>
            <button type="button" id="btn-close-details-modal" class="btn btn-outline btn-sm" style="padding: 0.25rem 0.5rem; font-size: 1rem;">✕</button>
          </div>
          <div id="details-modal-body">
            <!-- Injected dynamically -->
          </div>
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

    // Check if URL has hire target
    const urlParams = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const hireTargetId = urlParams.get("hire");
    if (hireTargetId) {
      this.openHireModal(hireTargetId, container);
    }
  },

  bindFilters(container) {
    const searchInput = container.querySelector("#mach-search-input");
    const categorySelect = container.querySelector("#mach-category-select");
    const operatorSelect = container.querySelector("#mach-operator-select");
    const filterAvail = container.querySelector("#mach-filter-available");
    const filterVerif = container.querySelector("#mach-filter-verified");
    const filterSpon = container.querySelector("#mach-filter-sponsored");
    const btnSearch = container.querySelector("#mach-btn-search");
    const btnReset = container.querySelector("#mach-btn-reset");

    const apply = () => {
      this.filters.query = searchInput?.value?.trim() || "";
      this.filters.category = categorySelect?.value || "all";
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
    operatorSelect?.addEventListener("change", apply);
    filterAvail?.addEventListener("change", apply);
    filterVerif?.addEventListener("change", apply);
    filterSpon?.addEventListener("change", apply);

    btnReset?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (categorySelect) categorySelect.value = "all";
      if (operatorSelect) operatorSelect.value = "";
      if (filterAvail) filterAvail.checked = false;
      if (filterVerif) filterVerif.checked = false;
      if (filterSpon) filterSpon.checked = false;
      this.filters = {
        query: "",
        category: "all",
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

    // Close modal bindings
    container.querySelector("#btn-close-hire-modal")?.addEventListener("click", () => {
      const modal = container.querySelector("#machinery-hire-modal-backdrop");
      if (modal) modal.style.display = "none";
    });
    container.querySelector("#btn-close-details-modal")?.addEventListener("click", () => {
      const modal = container.querySelector("#machinery-details-modal-backdrop");
      if (modal) modal.style.display = "none";
    });
  },

  async loadListings(container) {
    const grid = container.querySelector("#machinery-grid");
    const statusEl = container.querySelector("#machinery-feed-status");
    if (!grid) return;

    if (statusEl) statusEl.textContent = "Loading machinery listings...";

    try {
      this.listings = await MachineryService.listMarketplace(this.filters);

      if (statusEl) {
        statusEl.textContent = `Showing ${this.listings.length} equipment listing${this.listings.length === 1 ? "" : "s"}`;
      }

      if (this.listings.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--text-muted);">${icon("tractor", 48)}</div>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No machinery found</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.25rem auto;">
              No equipment matching your filters is currently listed. Try adjusting your search or category filters.
            </p>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.listings.map((item) => this.renderMachineryCard(item)).join("");
      this.bindCardActions(container);
    } catch (err) {
      console.error("Failed to load machinery:", err);
      if (statusEl) statusEl.textContent = `Error loading machinery: ${err.message}`;
    }
  },

  renderMachineryCard(item) {
    const isSponsored = Boolean(item.is_sponsored);
    const hasOperator = Boolean(item.operator_available);
    const photoUrl = Array.isArray(item.photos) && item.photos.length > 0
      ? (item.photos[0].file_url || item.photos[0].url || item.photos[0])
      : "/assets/images/logo.png";

    const baseRate = Number(item.base_hire_rate || 0).toFixed(2);
    const operatorInclusiveRate = item.operator_inclusive_rate
      ? Number(item.operator_inclusive_rate).toFixed(2)
      : null;

    const ratePeriod = item.rate_period === "per_hour" ? "hour" : item.rate_period === "per_week" ? "wk" : "day";

    return `
      <div class="card machinery-card" data-id="${escapeHtml(item.id)}" style="display: flex; flex-direction: column; overflow: hidden; border-radius: 12px; padding: 0; position: relative; border: ${isSponsored ? "2px solid #10b981" : "1px solid var(--border)"}; box-shadow: ${isSponsored ? "0 4px 14px rgba(16, 185, 129, 0.15)" : "var(--shadow-sm)"};">
        
        <!-- SPONSORED BADGE -->
        ${isSponsored ? `
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; z-index: 2; background: #10b981; color: #ffffff; font-weight: 800; font-size: 0.7rem; letter-spacing: 0.5px; padding: 0.25rem 0.65rem; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            SPONSORED
          </div>
        ` : ""}

        <!-- AVAILABILITY BADGE -->
        <div style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 2;">
          <span class="badge ${item.availability_status === "available" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem; font-weight: 700;">
            ${item.availability_status === "available" ? "Available Now" : escapeHtml(item.availability_status || "Busy")}
          </span>
        </div>

        <!-- PHOTO -->
        <div style="width: 100%; height: 180px; background: #0f172a; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png'; this.style.objectFit='contain'; this.style.padding='2rem';" />
        </div>

        <!-- CONTENT BODY -->
        <div style="padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
            <span class="badge badge-info" style="font-size: 0.7rem;">${escapeHtml(item.category)}</span>
            ${item.owner_verified ? `
              <span class="badge" style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; font-size: 0.7rem; display: inline-flex; align-items: center; gap: 0.2rem;">
                ${icon("shield-check", 13)} Verified Owner
              </span>
            ` : ""}
          </div>

          <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0 0 0.25rem 0; color: var(--text-main);">
            ${escapeHtml(item.name)}
          </h3>

          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            ${escapeHtml(item.brand)} ${escapeHtml(item.model)} ${item.year ? `• ${escapeHtml(item.year)}` : ""}
          </div>

          <div style="font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin-bottom: 1rem;">
            <span>📍</span> <span>${escapeHtml(item.location || item.province || "Zimbabwe")}</span>
          </div>

          <!-- PRICING TIERS -->
          <div style="background: var(--bg-hover); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Machinery only:</span>
              <span style="font-size: 1rem; font-weight: 800; color: var(--text-main);">$${baseRate} <small style="font-weight: 400; font-size: 0.75rem;">/${ratePeriod}</small></span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border); padding-top: 0.35rem;">
              <span style="font-size: 0.8rem; color: var(--text-muted);">With certified operator:</span>
              ${hasOperator && operatorInclusiveRate ? `
                <span style="font-size: 1rem; font-weight: 800; color: #10b981;">$${operatorInclusiveRate} <small style="font-weight: 400; font-size: 0.75rem;">/${ratePeriod}</small></span>
              ` : `
                <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">Not available</span>
              `}
            </div>
          </div>

          <!-- ACTIONS -->
          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            <button type="button" class="btn btn-outline btn-sm btn-view-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 600;">
              View Details
            </button>
            <button type="button" class="btn btn-primary btn-sm btn-hire-machinery" data-id="${escapeHtml(item.id)}" style="flex: 1; font-weight: 700;">
              Hire Now
            </button>
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
  },

  openDetailsModal(machineryId, container) {
    const item = this.listings.find((m) => m.id === machineryId);
    if (!item) return;

    const modal = container.querySelector("#machinery-details-modal-backdrop");
    const titleEl = container.querySelector("#details-modal-title");
    const bodyEl = container.querySelector("#details-modal-body");
    if (!modal || !bodyEl) return;

    if (titleEl) titleEl.textContent = `${item.name} (${item.brand} ${item.model})`;

    const photoUrl = Array.isArray(item.photos) && item.photos.length > 0
      ? (item.photos[0].file_url || item.photos[0].url || item.photos[0])
      : "/assets/images/logo.png";

    bodyEl.innerHTML = `
      <div style="margin-bottom: 1.25rem; height: 220px; border-radius: 8px; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center;">
        <img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(item.name)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/assets/images/logo.png'; this.style.objectFit='contain';" />
      </div>

      <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem;">
        <div><strong>Category:</strong> ${escapeHtml(item.category)}</div>
        <div><strong>Condition:</strong> ${escapeHtml(item.condition || "Good")}</div>
        <div><strong>Operating Hours:</strong> ${escapeHtml(item.operating_hours || 0)} hrs</div>
        <div><strong>Fuel Type:</strong> ${escapeHtml(item.fuel_type || "Diesel")}</div>
        <div><strong>Base Location:</strong> ${escapeHtml(item.location || "Zimbabwe")}</div>
        <div><strong>Transport Available:</strong> ${item.transport_available ? "Yes (by owner)" : "Hirer arranges"}</div>
      </div>

      ${item.description ? `
        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; margin-bottom: 0.35rem; color: var(--text-muted); text-transform: uppercase;">Equipment Description</h4>
          <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main); margin: 0;">${escapeHtml(item.description)}</p>
        </div>
      ` : ""}

      <div style="background: var(--bg-hover); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; border: 1px solid var(--border);">
        <h4 style="font-size: 0.85rem; margin: 0 0 0.5rem 0; color: var(--text-muted); text-transform: uppercase;">Owner Information</h4>
        <div style="font-weight: 700; font-size: 1rem;">${escapeHtml(item.owner?.full_name || "Verified Machinery Fleet Owner")}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          ${item.owner_verified ? "🛡️ Verified TransMove Heavy Plant Provider" : "TransMove Equipment Lister"}
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button type="button" class="btn btn-outline" onclick="document.querySelector('#machinery-details-modal-backdrop').style.display='none'">Close</button>
        <button type="button" class="btn btn-primary" id="btn-proceed-to-hire-from-details" style="font-weight: 700;">Proceed to Hire</button>
      </div>
    `;

    bodyEl.querySelector("#btn-proceed-to-hire-from-details")?.addEventListener("click", () => {
      modal.style.display = "none";
      this.openHireModal(machineryId, container);
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

    const baseRate = Number(item.base_hire_rate || 0);
    const hasOperator = Boolean(item.operator_available);
    const opInclusiveRate = item.operator_inclusive_rate ? Number(item.operator_inclusive_rate) : (baseRate * 1.3);

    const defaultStartDate = new Date().toISOString().split("T")[0];
    const defaultEndDate = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    const callerName = this.currentProfile?.full_name || "";
    const callerPhone = this.currentProfile?.phone || "";

    bodyEl.innerHTML = `
      <form id="machinery-hire-form">
        <!-- EQUIPMENT SUMMARY -->
        <div style="background: var(--bg-hover); padding: 0.85rem; border-radius: 8px; margin-bottom: 1.25rem; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; font-size: 1rem;">${escapeHtml(item.name)}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.brand)} ${escapeHtml(item.model)} • 📍 ${escapeHtml(item.location)}</div>
          </div>
          <span class="badge badge-info">${escapeHtml(item.category)}</span>
        </div>

        <!-- OPERATOR SELECTION (STRICT BUSINESS RULE) -->
        <div style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.5rem; display: block;">Operator Option:</label>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <!-- OPTION A: WITHOUT OPERATOR -->
            <label id="hire-opt-without-card" style="border: 2px solid #2563eb; background: rgba(37,99,235,0.05); border-radius: 8px; padding: 0.85rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 700; font-size: 0.95rem;">Machinery Only</span>
                <input type="radio" name="with_operator_radio" value="false" checked />
              </div>
              <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-main);">$${baseRate.toFixed(2)} <small style="font-size: 0.75rem; font-weight: 400;">/day</small></div>
              <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
                Operator not included. Hirer must provide a suitable operator.
              </div>
            </label>

            <!-- OPTION B: WITH OPERATOR -->
            <label id="hire-opt-with-card" style="border: 1px solid var(--border); background: var(--bg-card); border-radius: 8px; padding: 0.85rem; cursor: ${hasOperator ? "pointer" : "not-allowed"}; opacity: ${hasOperator ? "1" : "0.5"}; display: flex; flex-direction: column; gap: 0.35rem;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-weight: 700; font-size: 0.95rem;">With Operator</span>
                <input type="radio" name="with_operator_radio" value="true" ${hasOperator ? "" : "disabled"} />
              </div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #10b981;">
                ${hasOperator ? `$${opInclusiveRate.toFixed(2)} <small style="font-size: 0.75rem; font-weight: 400;">/day</small>` : "Not offered"}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">
                Includes certified and qualified equipment operator provided by owner.
              </div>
            </label>
          </div>

          <div id="operator-notice-box" style="margin-top: 0.6rem; padding: 0.6rem 0.85rem; border-radius: 6px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.8rem; color: #b45309;">
            Operator not included. Hirer must provide a suitable operator.
          </div>
        </div>

        <!-- HIRE DATES -->
        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" id="hire-start-date" class="form-input" value="${defaultStartDate}" required />
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" id="hire-end-date" class="form-input" value="${defaultEndDate}" required />
          </div>
        </div>

        <!-- DURATION & ESTIMATE PREVIEW -->
        <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem;">
            <span style="color: var(--text-muted);">Duration:</span>
            <span id="hire-calc-duration" style="font-weight: 700;">1 day</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.35rem;">
            <span style="color: var(--text-muted);">Daily Rate Applied:</span>
            <span id="hire-calc-rate" style="font-weight: 700;">$${baseRate.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 1px dashed var(--border); padding-top: 0.5rem; margin-top: 0.5rem;">
            <span>Estimated Total:</span>
            <span id="hire-calc-total" style="color: #10b981;">$${baseRate.toFixed(2)} USD</span>
          </div>
        </div>

        <!-- JOB DETAILS -->
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Job Site Location / Address</label>
          <input type="text" id="hire-job-location" class="form-input" placeholder="e.g. Plot 14, Norton Industrial Area" value="${escapeHtml(item.location)}" required />
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">Job Notes / Work Description</label>
          <textarea id="hire-notes" class="form-input" rows="2" placeholder="Briefly describe the task (e.g. trenching for water line, land clearing, road scraping)..."></textarea>
        </div>

        <!-- CONTACT DETAILS -->
        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Your Name</label>
            <input type="text" id="hire-contact-name" class="form-input" value="${escapeHtml(callerName)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Contact Phone</label>
            <input type="tel" id="hire-contact-phone" class="form-input" value="${escapeHtml(callerPhone)}" placeholder="+263..." required />
          </div>
        </div>

        <div id="hire-submit-error" style="color: #ef4444; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn btn-outline" onclick="document.querySelector('#machinery-hire-modal-backdrop').style.display='none'">Cancel</button>
          <button type="submit" id="btn-submit-hire-request" class="btn btn-primary" style="font-weight: 700; padding: 0.65rem 1.5rem;">
            Submit Hire Request
          </button>
        </div>
      </form>
    `;

    // Dynamic price calculation & operator radio binding
    const form = bodyEl.querySelector("#machinery-hire-form");
    const radios = form.querySelectorAll("input[name='with_operator_radio']");
    const startDateInput = form.querySelector("#hire-start-date");
    const endDateInput = form.querySelector("#hire-end-date");
    const calcDurationEl = form.querySelector("#hire-calc-duration");
    const calcRateEl = form.querySelector("#hire-calc-rate");
    const calcTotalEl = form.querySelector("#hire-calc-total");
    const noticeBox = form.querySelector("#operator-notice-box");
    const optWithoutCard = form.querySelector("#hire-opt-without-card");
    const optWithCard = form.querySelector("#hire-opt-with-card");
    const errorEl = form.querySelector("#hire-submit-error");

    const updateCalculations = () => {
      const isWithOp = form.querySelector("input[name='with_operator_radio']:checked")?.value === "true";
      const start = new Date(startDateInput.value || defaultStartDate);
      const end = new Date(endDateInput.value || defaultEndDate);
      
      const diffMs = Math.max(86400000, end.getTime() - start.getTime());
      const days = Math.max(1, Math.ceil(diffMs / 86400000));

      const rate = isWithOp ? opInclusiveRate : baseRate;
      const total = rate * days;

      calcDurationEl.textContent = `${days} day${days === 1 ? "" : "s"}`;
      calcRateEl.textContent = `$${rate.toFixed(2)}`;
      calcTotalEl.textContent = `$${total.toFixed(2)} USD`;

      if (isWithOp) {
        noticeBox.textContent = "Includes certified and qualified equipment operator provided by owner.";
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
        noticeBox.textContent = "Operator not included. Hirer must provide a suitable operator.";
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

    radios.forEach((r) => r.addEventListener("change", updateCalculations));
    startDateInput?.addEventListener("change", updateCalculations);
    endDateInput?.addEventListener("change", updateCalculations);
    updateCalculations();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (errorEl) errorEl.style.display = "none";
      const submitBtn = form.querySelector("#btn-submit-hire-request");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }

      try {
        const isWithOp = form.querySelector("input[name='with_operator_radio']:checked")?.value === "true";
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        const diffMs = Math.max(86400000, end.getTime() - start.getTime());
        const days = Math.max(1, Math.ceil(diffMs / 86400000));

        await MachineryService.submitHireRequest({
          machinery_id: item.id,
          with_operator: isWithOp,
          duration_units: days,
          start_date: startDateInput.value,
          end_date: endDateInput.value,
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
              Your hire request has been sent to the machinery owner. They will review and confirm your booking shortly.
            </p>
            <button type="button" class="btn btn-primary" onclick="document.querySelector('#machinery-hire-modal-backdrop').style.display='none'">
              Done
            </button>
          </div>
        `;
      } catch (err) {
        console.error("Hire request submission error:", err);
        if (errorEl) {
          errorEl.textContent = err.message || "Failed to submit hire request. Please try again.";
          errorEl.style.display = "block";
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Hire Request";
        }
      }
    });

    modal.style.display = "flex";
  }
};
