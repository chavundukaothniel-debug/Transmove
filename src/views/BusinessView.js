// ==============================================================================
// TRANSMOVE BUSINESS & CORPORATE TRANSPORT DASHBOARD VIEW
// ==============================================================================
import { CorporateService } from "../services/corporate.js";
import { renderEmptyState } from "../components/EmptyState.js";

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
                🏢 Register Business Account
              </button>
            </div>
          </div>
        </div>

        <div class="grid-3" style="margin-bottom: 2.5rem;">
          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Corporate Account Status</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);" id="corp-status-val">Verified Business</div>
          </div>

          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Monthly Transport Spend</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-main);" id="corp-spend-val">$0.00</div>
          </div>

          <div class="card" style="padding: 1.5rem;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Allocated Monthly Limit</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);" id="corp-limit-val">$1,000.00</div>
          </div>
        </div>

        <div class="grid-2" style="gap: 2rem;">
          
          <!-- Left Column: Business Transport Services -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">Business Transport Solutions</h3>
            
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">💼 Employee Commutes &amp; Executive Rides</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Consolidate company travel with verified sedan and SUV transport options on transparent fare bidding.
                </p>
                <a href="#customer" class="btn btn-outline btn-sm">Request Corporate Ride</a>
              </div>

              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">📦 Commercial Cargo &amp; Bulk Logistics</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Move goods, agricultural produce, machinery, and inventory across Zimbabwe with 3-tonne and 10-tonne trucks.
                </p>
                <a href="#customer" class="btn btn-outline btn-sm">Request Freight Logistics</a>
              </div>

              <div style="padding: 1.25rem; background: var(--bg-subtle); border-radius: var(--radius-md);">
                <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.35rem;">🚜 Site Machinery &amp; Equipment Fleet</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 0.75rem;">
                  Direct hire for tractors, excavators, tipper trucks, and cranes directly from verified equipment owners.
                </p>
                <a href="#equipment" class="btn btn-outline btn-sm">Browse Equipment Marketplace</a>
              </div>
            </div>
          </div>

          <!-- Right Column: Employee Management & Invoices -->
          <div class="card">
            <h3 class="card-title" style="margin-bottom: 1.25rem;">Corporate Employees &amp; Invoices</h3>
            <div id="corp-employees-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading corporate profile from Supabase...</div>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  async init() {
    document.getElementById("btn-create-corp-account")?.addEventListener("click", () => {
      const name = prompt("Enter your Company / Organization Name:");
      const email = prompt("Enter Billing Contact Email:");
      if (name && email) {
        CorporateService.createAccount(name, email)
          .then(() => {
            alert("Corporate Account created successfully!");
            this.loadCorporateData();
          })
          .catch((err) => alert("Could not create account: " + err.message));
      }
    });

    this.loadCorporateData();
  },

  async loadCorporateData() {
    const container = document.getElementById("corp-employees-container");
    if (!container) return;

    try {
      const account = await CorporateService.getAccount();
      if (!account) {
        container.innerHTML = renderEmptyState({
          title: "No Corporate Account Linked",
          description: "Register your company or organization to manage employee travel allowances and download monthly invoices.",
          actionText: "🏢 Register Account",
          actionLink: "#business",
          icon: "inbox"
        });
        return;
      }

      document.getElementById("corp-status-val").innerText = account.company_name;
      document.getElementById("corp-spend-val").innerText = `$${(account.current_month_spend || 0).toFixed(2)}`;
      document.getElementById("corp-limit-val").innerText = `$${(account.monthly_spending_limit || 1000).toFixed(2)}`;

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
              <div style="font-weight: 700;">${emp.full_name || "Employee"}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${emp.email}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 800; color: var(--primary);">$${emp.current_spend} / $${emp.spending_limit}</div>
            </div>
          </div>
        `).join("");
      }
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Corporate Portal",
        description: "Connect your company account to start managing corporate transport.",
        icon: "inbox"
      });
    }
  }
};
