// ==============================================================================
// TRANSMOVE BUSINESS & CORPORATE TRANSPORT DASHBOARD VIEW
// ==============================================================================
import { CorporateService } from "../services/corporate.js";
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

export const BusinessView = {
  async render() {
    return `
      <div class="business-dashboard" style="max-width: 1180px; margin: 0 auto; padding: 1.5rem 0;">
        <div class="card" style="margin-bottom: 2rem; padding: 1.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">BUSINESS DASHBOARD</div>
              <h1 style="font-size: 1.8rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.15rem 0;">Manage your company's transportation</h1>
              <p style="color: var(--text-muted); font-size: 0.95rem; margin: 0;">Manage corporate accounts, employee spending limits, freight logistics, and statements.</p>
            </div>
            <div>
              <button id="btn-create-corp-account" class="btn btn-primary">
            ${icon("building-2", 18)}<span>Register Business Account</span>
              </button>
            </div>
          </div>
        </div>

        <div class="grid-3" id="business-section-overview" style="margin-bottom: 2.5rem;">
          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Corporate Account Status</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);" id="corp-status-val">—</div>
          </div>

          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Monthly Transport Spend</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);" id="corp-spend-val">—</div>
          </div>

          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Allocated Monthly Limit</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);" id="corp-limit-val">—</div>
          </div>
        </div>

        <div class="grid-2" style="gap: 2rem;">
          
          <!-- Left Column: Business Transport Services -->
          <div class="card" id="business-section-services">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">Business Transport Solutions</h3>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
            <h4 class="icon-label" style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">${icon("briefcase-business", 19)}<span>Employee Commutes &amp; Executive Rides</span></h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Consolidate company travel with verified sedan and SUV transport options on transparent fare bidding.
                </p>
                <a href="#customer" class="btn btn-outline btn-sm">Request Corporate Ride</a>
              </div>

              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
            <h4 class="icon-label" style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">${icon("package", 19)}<span>Commercial Cargo &amp; Bulk Logistics</span></h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Move goods, agricultural produce, machinery, and inventory across Zimbabwe with 3-tonne and 10-tonne trucks.
                </p>
                <a href="#customer" class="btn btn-outline btn-sm">Request Freight Logistics</a>
              </div>

              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
            <h4 class="icon-label" style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">${icon("tractor", 19)}<span>Site Machinery &amp; Equipment Fleet</span></h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Direct hire for tractors, excavators, tipper trucks, and cranes directly from verified equipment owners.
                </p>
                <a href="#equipment" class="btn btn-outline btn-sm">Browse Equipment Marketplace</a>
              </div>
            </div>
          </div>

          <!-- Right Column: Employee Management & Invoices -->
          <div class="card" id="business-section-employees">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">Corporate Employees &amp; Invoices</h3>
            <div id="corp-employees-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading corporate profile...</div>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  async init() {
    const tab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");
    const sectionMap = {
      transport: "business-section-services",
      deliveries: "business-section-services",
      employees: "business-section-employees",
      invoices: "business-section-employees",
      financials: "business-section-overview"
    };
    const section = document.getElementById(sectionMap[tab] || "business-section-overview");
    section?.scrollIntoView({ block: "start" });

    document.getElementById("btn-create-corp-account")?.addEventListener("click", async () => {
      const profile = await AuthService.getCurrentProfile();
      if (!profile) {
        alert("Please sign in to register a business account.");
        window.location.hash = "#login";
        return;
      }

      const name = prompt("Enter your Company / Organization Name:");
      if (!name || !name.trim()) return;
      const email = prompt("Enter Billing Contact Email:");
      if (!email || !email.trim()) return;

      try {
        await CorporateService.createCorporateAccount(profile.id, name.trim(), email.trim());
        alert("Business accounts are not live on TransMove yet, so this registration was not saved.");
      } catch (err) {
        console.warn("Corporate account creation failed:", err);
        alert("Business account registration is not available yet. Nothing was saved.");
      }
      this.loadCorporateData();
    });

    this.loadCorporateData();
  },

  async loadCorporateData() {
    const container = document.getElementById("corp-employees-container");
    if (!container) return;

    try {
      const profile = await AuthService.getCurrentProfile();
      if (!profile) {
        container.innerHTML = renderEmptyState({
          title: "Sign in to view your business account",
          description: "Corporate travel management requires a signed-in TransMove account.",
          actionText: "Sign In",
          actionLink: "#login",
          icon: "inbox"
        });
        return;
      }

      const account = await CorporateService.getCorporateAccount(profile.id);
      if (!account) {
        container.innerHTML = renderEmptyState({
          title: "No corporate account linked",
          description: "Business account management is not live on TransMove yet, so no corporate profile could be loaded.",
          icon: "inbox"
        });
        return;
      }

      document.getElementById("corp-status-val").innerText = account.company_name || "—";
      document.getElementById("corp-spend-val").innerText = account.current_month_spend != null ? `$${Number(account.current_month_spend).toFixed(2)}` : "—";
      document.getElementById("corp-limit-val").innerText = account.monthly_spending_limit != null ? `$${Number(account.monthly_spending_limit).toFixed(2)}` : "—";

      const employees = account.employees || [];
      if (employees.length === 0) {
        container.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
            No employees added to corporate account yet.
          </div>
        `;
      } else {
        container.innerHTML = employees.map((emp) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem; border-bottom: 1px solid var(--border-light);">
            <div>
              <div style="font-weight: 700;">${escapeHtml(emp.full_name || "Employee")}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(emp.email)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 800; color: var(--primary);">${emp.current_spend != null ? `$${escapeHtml(emp.current_spend)}` : "—"} / ${emp.spending_limit != null ? `$${escapeHtml(emp.spending_limit)}` : "—"}</div>
            </div>
          </div>
        `).join("");
      }
    } catch (err) {
      console.warn("Corporate profile load failed:", err);
      container.innerHTML = renderEmptyState({
        title: "Business accounts not available yet",
        description: "Corporate account management is not live on TransMove yet. Please check back later.",
        icon: "inbox"
      });
    }
  }
};
