// ==============================================================================
// TRANSMOVE SECURE ADMIN PORTAL VIEW
// Server-verified driver/owner approvals, real Appwrite analytics, audit logs & dispute desk
// ==============================================================================
import { AdminService } from "../services/admin.js";
import { AuthService } from "../services/auth.js";
import { DisputeService } from "../services/disputes.js";
import { PaymentService } from "../services/payments.js";
import { Modal } from "../components/Modal.js";
import { getAppwriteAccount } from "../config/appwrite.js";
import { renderEmptyState } from "../components/EmptyState.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const AdminView = {
  renderLogin() {
    return `
      <div style="max-width: 440px; margin: 3rem auto; padding: 0 1rem;">
        <div class="card" style="padding: 2.25rem 2rem; border-top: 4px solid var(--danger); box-shadow: var(--shadow-lg);">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🛡️</div>
            <h2 style="font-size: 1.6rem; font-weight: 900; color: var(--text-main); margin-bottom: 0.25rem;">TransMove Admin Portal</h2>
            <p style="color: var(--text-muted); font-size: 0.875rem;">Restricted Operations Command Center</p>
          </div>

          <form id="admin-login-form">
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-weight: 700;">Administrator Email / ID</label>
              <input type="email" id="admin-login-email" class="form-input" placeholder="transmove@admin" value="transmove@admin" required />
            </div>

            <div class="form-group" style="margin-bottom: 1.75rem;">
              <label class="form-label" style="font-weight: 700;">Password</label>
              <input type="password" id="admin-login-password" class="form-input" placeholder="••••••••••••" required />
            </div>

            <button type="submit" id="btn-submit-admin-login" class="btn btn-primary btn-full btn-lg" style="background: var(--danger); border-color: var(--danger); color: #ffffff;">
              Authenticate Administrator 🛡️
            </button>
          </form>

          <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-muted); border-top: 1px solid var(--border-light); padding-top: 1rem;">
            Strictly for authorized TransMove operations personnel.
          </div>
        </div>
      </div>
    `;
  },

  initLogin() {
    document.getElementById("admin-login-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-admin-login");
      const email = document.getElementById("admin-login-email").value.trim();
      const password = document.getElementById("admin-login-password").value;

      submitBtn.disabled = true;
      submitBtn.innerText = "Authenticating Admin Session...";

      try {
        await AuthService.login({ email, password });
        const profile = await AuthService.getCurrentProfile();
        if (profile?.role !== "admin") {
          await AuthService.logout();
          throw new Error("Access Denied: Account does not possess verified administrator privileges.");
        }
        window.location.hash = "#admin";
      } catch (err) {
        alert("Admin Authentication Failed: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Authenticate Administrator 🛡️";
      }
    });
  },

  async render() {
    return `
      <div class="admin-portal">
        <div class="card-header" style="margin-bottom: 1.5rem;">
          <div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #ef4444;">🛡️ TransMove Stealth Administrative Dashboard</h2>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time database analytics, driver document approvals, live trip monitoring, dispute resolution &amp; audit trails</p>
          </div>
          <span class="badge badge-danger">ADMINISTRATOR</span>
        </div>

        <!-- Admin Sub-tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
          <button class="btn btn-outline btn-sm adm-tab-btn active" data-tab="analytics">📊 Analytics &amp; KPIs</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="approvals">📋 Driver Approvals</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="users">👥 Users</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="machinery">🚜 Machinery</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="trips">🚗 Live Trip Monitor</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="financials">💳 EcoCash Payments</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="plans">📦 Subscription Plans</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="destinations">📱 EcoCash Channels</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="ads">📢 Advertising</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="settings">⚙️ Social &amp; Contact</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="disputes">⚠️ Support &amp; Disputes</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="audit">🛡️ Audit Log</button>
        </div>

        <!-- TAB 1: ANALYTICS -->
        <div id="adm-tab-analytics">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Registered Passengers</div>
              <div id="stat-passengers" style="font-size: 1.8rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Registered Providers</div>
              <div id="stat-providers" style="font-size: 1.8rem; font-weight: 800; color: #2563eb; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Active Providers (Online)</div>
              <div id="stat-active-providers" style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Requests Posted</div>
              <div id="stat-requests" style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Bookings Awarded</div>
              <div id="stat-bookings" style="font-size: 1.8rem; font-weight: 800; color: #0284c7; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Completed Bookings</div>
              <div id="stat-completed" style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Cancelled Bookings</div>
              <div id="stat-cancelled" style="font-size: 1.8rem; font-weight: 800; color: #ef4444; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Active Subscriptions</div>
              <div id="stat-subscriptions" style="font-size: 1.8rem; font-weight: 800; color: #9333ea; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Verification Queue</div>
              <div id="stat-pending" style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Pending Providers</div>
              <div id="stat-pending-providers" style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Pending Vehicles</div>
              <div id="stat-pending-vehicles" style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Pending Documents</div>
              <div id="stat-pending-documents" style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Expired Documents</div>
              <div id="stat-expired-documents" style="font-size: 1.8rem; font-weight: 800; color: #dc2626; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Open Disputes</div>
              <div id="stat-disputes" style="font-size: 1.8rem; font-weight: 800; color: #f97316; margin-top: 0.25rem;">—</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Payment Totals (Real Data)</div>
              <div id="stat-revenue" style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">$0.00</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">Total Profiles</div>
              <div id="stat-users" style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">—</div>
            </div>
          </div>
        </div>

        <!-- TAB 2: DRIVER APPROVALS -->
        <div id="adm-tab-approvals" style="display: none;">
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 class="card-title">📋 Driver &amp; Owner Document Verification Queue</h3>
                <span id="admin-verification-filter-label" class="badge badge-warning">Pending Review</span>
              </div>
              <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                <label for="admin-verification-filter" style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">Show</label>
                <select id="admin-verification-filter" class="form-select" style="padding:0.4rem 0.65rem; border:1px solid var(--border-light); border-radius:6px;">
                  <option value="pending" selected>Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                  <option value="all">All</option>
                </select>
                <button type="button" class="btn btn-outline btn-sm" id="btn-audit-expiries">
                  🔍 Audit Expiries &amp; Notify Providers
                </button>
              </div>
            </div>
            <div id="admin-verifications-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading verification requests...</div>
            </div>
          </div>
        </div>

        <!-- TAB: USER MANAGEMENT -->
        <div id="adm-tab-users" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">👥 Registered User Directory</h3>
              <span class="badge badge-info">All Profiles</span>
            </div>
            <div id="admin-users-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading registered users...</div>
            </div>
          </div>
        </div>

        <!-- TAB: MACHINERY VERIFICATION -->
        <div id="adm-tab-machinery" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🚜 Machinery Verification</h3>
              <span class="badge badge-neutral">Backend Pending</span>
            </div>
            ${renderEmptyState({
              title: "Machinery verification not available yet",
              description: "The platform backend does not yet include a machinery/equipment collection or a trusted verification action, so there are no machinery listings to review. This desk will activate once machinery data exists.",
              icon: "tractor"
            })}
          </div>
        </div>

        <!-- TAB 3: LIVE TRIP MONITOR -->
        <div id="adm-tab-trips" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🚗 Live Rides &amp; Cargo Freight Monitor</h3>
              <span class="badge badge-info">Active Operations</span>
            </div>
            <div id="admin-trips-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading live trips...</div>
            </div>
          </div>
        </div>

        <!-- TAB 4: FINANCIALS (ECOCASH PAYMENT QUEUE) -->
        <div id="adm-tab-financials" style="display: none;">
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 class="card-title">💳 EcoCash Payment Verification Queue</h3>
                <span class="badge badge-warning">Admin Verification Desk</span>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label for="admin-payments-filter" style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">Status:</label>
                <select id="admin-payments-filter" class="form-select" style="padding: 0.4rem 0.65rem; border: 1px solid var(--border-light); border-radius: 6px;">
                  <option value="pending_review" selected>Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="">All Payments</option>
                </select>
                <button id="btn-refresh-payments" class="btn btn-outline btn-sm">🔄 Refresh</button>
              </div>
            </div>
            <div id="admin-transactions-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading payment queue...</div>
            </div>
          </div>
        </div>

        <!-- TAB: SUBSCRIPTION PLANS -->
        <div id="adm-tab-plans" style="display: none;">
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 class="card-title">📦 Provider Subscription Plans</h3>
                <span class="badge badge-info">Multi-Tier Pricing</span>
              </div>
              <button id="btn-admin-add-plan" class="btn btn-primary btn-sm">+ Add New Plan</button>
            </div>
            <div id="admin-plans-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading subscription plans...</div>
            </div>
          </div>
        </div>

        <!-- TAB: ECOCASH DESTINATION CHANNELS -->
        <div id="adm-tab-destinations" style="display: none;">
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 class="card-title">📱 EcoCash Payment Destination Accounts</h3>
                <span class="badge badge-success">Admin Accounts</span>
              </div>
              <button id="btn-admin-add-destination" class="btn btn-primary btn-sm">+ Add Destination</button>
            </div>
            <div id="admin-destinations-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading destinations...</div>
            </div>
          </div>
        </div>

        <!-- TAB 5: ADS MANAGEMENT -->
        <div id="adm-tab-ads" style="display: none;">
          <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 class="card-title">📢 Advertising Campaign Moderation</h3>
                <span class="badge badge-info">Commercial Ads</span>
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label for="admin-ads-filter" style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">Filter:</label>
                <select id="admin-ads-filter" class="form-select" style="padding: 0.4rem 0.65rem; border: 1px solid var(--border-light); border-radius: 6px;">
                  <option value="" selected>All Campaigns</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="active">Active</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <button id="btn-refresh-admin-ads" class="btn btn-outline btn-sm">🔄 Refresh</button>
              </div>
            </div>
            <div id="admin-ads-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading campaigns...</div>
            </div>
          </div>
        </div>

        <!-- TAB 6: SOCIAL & CONTACT SETTINGS -->
        <div id="adm-tab-settings" style="display: none;">
          <div class="card" style="margin-bottom: 1.5rem;">
            <div class="card-header">
              <h3 class="card-title">🛡️ System Integration Status</h3>
              <span class="badge badge-neutral">Live Client Checks</span>
            </div>
            <div class="grid-4" style="margin-top: 1rem;">
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">ECOCASH PAYMENTS</div>
                <div style="font-weight: 800; color: #10b981; margin-top: 0.25rem;">🟢 Active Manual Flow</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Admin verification enabled</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">APPWRITE ENGINE</div>
                <div id="sys-status-appwrite" style="font-weight: 800; color: #64748b; margin-top: 0.25rem;">⚪ Checking…</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Cloud database &amp; auth</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">EMAIL SERVICE</div>
                <div style="font-weight: 800; color: #64748b; margin-top: 0.25rem;">⚪ Not Verified</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Cannot be checked from the client</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">MAP CONFIGURATION</div>
                <div id="sys-status-map" style="font-weight: 800; color: #64748b; margin-top: 0.25rem;">⚪ Checking…</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Nominatim &amp; Leaflet engine</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">⚙️ Official Social Media &amp; Support WhatsApp Setup</h3>
              <span class="badge badge-neutral">Platform Config</span>
            </div>
            <form id="admin-social-form" style="padding: 1rem 0;">
              <div class="grid-2" style="margin-bottom: 1rem;">
                <div class="form-group">
                  <label class="form-label">Facebook Page URL</label>
                  <input type="url" id="adm-fb-url" class="form-input" placeholder="https://facebook.com/transmove" />
                </div>
                <div class="form-group">
                  <label class="form-label">Instagram Profile URL</label>
                  <input type="url" id="adm-ig-url" class="form-input" placeholder="https://instagram.com/transmove" />
                </div>
                <div class="form-group">
                  <label class="form-label">TikTok Profile URL</label>
                  <input type="url" id="adm-tt-url" class="form-input" placeholder="https://tiktok.com/@transmove" />
                </div>
                <div class="form-group">
                  <label class="form-label">X (Twitter) Handle / URL</label>
                  <input type="url" id="adm-x-url" class="form-input" placeholder="https://x.com/transmove" />
                </div>
                <div class="form-group">
                  <label class="form-label">YouTube Channel URL</label>
                  <input type="url" id="adm-yt-url" class="form-input" placeholder="https://youtube.com/@transmove" />
                </div>
                <div class="form-group">
                  <label class="form-label">Official Support WhatsApp Number</label>
                  <input type="text" id="adm-wa-num" class="form-input" placeholder="+263780266401" />
                </div>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                Platform settings storage has not been migrated to the Appwrite backend yet — saving is currently unavailable.
              </div>
              <button type="submit" class="btn btn-primary" id="btn-save-social" disabled title="Settings storage is not available yet on the Appwrite backend.">Save Official Platform Links</button>
            </form>
          </div>
        </div>

        <!-- TAB 7: SUPPORT & DISPUTES -->
        <div id="adm-tab-disputes" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">⚠️ Support Ticket &amp; Dispute Resolution Desk</h3>
              <span class="badge badge-danger">Customer Issues</span>
            </div>
            <div id="admin-disputes-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading support tickets...</div>
            </div>
          </div>
        </div>

        <!-- TAB 8: AUDIT LOG -->
        <div id="adm-tab-audit" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">🛡️ System Privilege &amp; Activity Audit Log</h3>
              <span class="badge badge-info">Immutable Security Records</span>
            </div>
            <div id="admin-audit-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading audit logs...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    const isAdmin = await AdminService.verifyAdminAccess();
    if (!isAdmin) {
      alert("Access Denied: You do not have server-verified administrative permissions.");
      window.location.hash = "#home";
      return;
    }

    // Tab switching
    document.querySelectorAll(".adm-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.getAttribute("data-tab");
        document.querySelectorAll(".adm-tab-btn").forEach((b) => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        ["analytics", "approvals", "users", "machinery", "trips", "financials", "plans", "destinations", "ads", "settings", "disputes", "audit"].forEach((t) => {
          const el = document.getElementById(`adm-tab-${t}`);
          if (el) el.style.display = t === tab ? "block" : "none";
        });

        if (tab === "analytics") this.loadStats();
        if (tab === "approvals") this.loadVerifications();
        if (tab === "users") this.loadUsers();
        if (tab === "trips") this.loadLiveTrips();
        if (tab === "financials") this.loadTransactions();
        if (tab === "plans") this.loadPlans();
        if (tab === "destinations") this.loadDestinations();
        if (tab === "ads") this.loadAds();
        if (tab === "settings") { this.loadSystemStatus(); this.loadSocialSettings(); }
        if (tab === "disputes") this.loadDisputes();
        if (tab === "audit") this.loadAuditLogs();
      });
    });

    const requestedTab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");
    const sidebarTabMap = {
      operations: "analytics",
      users: "users",
      verification: "approvals",
      vehicles: "approvals",
      machinery: "machinery",
      trips: "trips",
      payments: "financials",
      financials: "financials",
      plans: "plans",
      destinations: "destinations",
      ads: "ads",
      settings: "settings",
      disputes: "disputes",
      audit: "audit"
    };
    const initialTab = sidebarTabMap[requestedTab];
    if (initialTab) {
      document.querySelector(`.adm-tab-btn[data-tab="${initialTab}"]`)?.click();
    }

    // Payment queue controls
    document.getElementById("btn-refresh-payments")?.addEventListener("click", () => this.loadTransactions());
    document.getElementById("admin-payments-filter")?.addEventListener("change", () => this.loadTransactions());

    // Subscription plan management controls
    document.getElementById("btn-admin-add-plan")?.addEventListener("click", () => this.openAddPlanModal());

    // Payment destination controls
    document.getElementById("btn-admin-add-destination")?.addEventListener("click", () => this.openAddDestinationModal());

    // Ad moderation controls
    document.getElementById("btn-refresh-admin-ads")?.addEventListener("click", () => this.loadAds());
    document.getElementById("admin-ads-filter")?.addEventListener("change", () => this.loadAds());

    // Audit expiries button
    document.getElementById("btn-audit-expiries")?.addEventListener("click", async () => {
      try {
        const res = await AdminService.checkDocumentExpiries();
        alert(`Document Expiry Audit Complete: ${res.checked || 0} documents checked, ${res.expired || 0} expired, ${res.expiring_soon || 0} expiring soon.`);
        this.loadVerifications();
      } catch (err) {
        alert("Failed to audit document expiries: " + err.message);
      }
    });

    document.getElementById("admin-verification-filter")?.addEventListener("change", (event) => {
      const label = document.getElementById("admin-verification-filter-label");
      if (label) label.innerText = `${event.target.options[event.target.selectedIndex].text} Review`;
      this.loadVerifications();
    });

    // Social form submit
    const socialForm = document.getElementById("admin-social-form");
    if (socialForm) {
      socialForm.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Social & WhatsApp settings cannot be saved yet: platform settings storage has not been migrated to the Appwrite backend.");
      });
    }

    this.loadStats();
    this.loadVerifications();
    this.loadTransactions();
    this.loadLiveTrips();
    this.loadDisputes();
    this.loadSystemStatus();
  },

  async loadUsers() {
    const container = document.getElementById("admin-users-container");
    if (!container) return;

    try {
      const users = await AdminService.getAllUsers();

      if (!users || users.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No registered users",
          description: "User profiles will appear here as accounts are created.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Name</th>
                <th style="padding: 0.75rem;">Email</th>
                <th style="padding: 0.75rem;">Phone</th>
                <th style="padding: 0.75rem;">Role</th>
                <th style="padding: 0.75rem;">Verification</th>
                <th style="padding: 0.75rem;">Account</th>
                <th style="padding: 0.75rem;">Joined</th>
              </tr>
            </thead>
            <tbody>
              ${users.map((u) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-weight: 700;">${escapeHtml(u.full_name) || "—"}</td>
                  <td style="padding: 0.75rem;">${escapeHtml(u.email) || "—"}</td>
                  <td style="padding: 0.75rem;">${escapeHtml(u.phone) || "—"}</td>
                  <td style="padding: 0.75rem;">
                    <span class="badge badge-neutral">${escapeHtml((u.role || "user").toUpperCase())}</span>
                  </td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${["approved", "verified"].includes(u.verification_status) ? "badge-success" : "badge-warning"}">${escapeHtml(u.verification_status || "unverified")}</span>
                  </td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${u.account_status === "active" ? "badge-success" : "badge-danger"}">${escapeHtml(u.account_status || "unknown")}</span>
                  </td>
                  <td style="padding: 0.75rem; color: var(--text-muted);">${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.warn("Could not load user directory:", err);
      container.innerHTML = renderEmptyState({
        title: "User directory unavailable",
        description: "Registered users could not be loaded right now. Please try again.",
        icon: "inbox"
      });
    }
  },

  async loadSystemStatus() {
    const setStatus = (id, text, color) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerText = text;
        el.style.color = color;
      }
    };

    try {
      await getAppwriteAccount().get();
      setStatus("sys-status-appwrite", "🟢 Connected", "#10b981");
    } catch (err) {
      if (err && typeof err.code === "number") {
        setStatus("sys-status-appwrite", "🟢 Reachable", "#10b981");
      } else {
        console.warn("Appwrite reachability check:", err);
        setStatus("sys-status-appwrite", "🔴 Unreachable", "#ef4444");
      }
    }

    const mapsLoaded = typeof window.L !== "undefined";
    setStatus("sys-status-map", mapsLoaded ? "🟢 Active" : "🔴 Not Loaded", mapsLoaded ? "#10b981" : "#ef4444");
  },

  async loadLiveTrips() {
    const container = document.getElementById("admin-trips-container");
    if (!container) return;

    try {
      const bookings = await AdminService.getAllBookings();
      if (!bookings || bookings.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No active trips",
          description: "All live customer bookings will appear here.",
          icon: "car"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Booking ID</th>
                <th style="padding: 0.75rem;">Customer</th>
                <th style="padding: 0.75rem;">Driver</th>
                <th style="padding: 0.75rem;">Amount</th>
                <th style="padding: 0.75rem;">Created</th>
                <th style="padding: 0.75rem;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map((b) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-family: monospace;">#${escapeHtml(String(b.id || "").slice(0, 8))}</td>
                  <td style="padding: 0.75rem;">${escapeHtml(b.customer?.full_name) || "—"}</td>
                  <td style="padding: 0.75rem;">${escapeHtml(b.driver?.full_name) || "—"}</td>
                  <td style="padding: 0.75rem; font-weight: 700;">$${Number(b.amount ?? b.final_price ?? 0).toFixed(2)}</td>
                  <td style="padding: 0.75rem; font-weight: 700; color: #38bdf8;">${b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}</td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${b.status === "completed" ? "badge-success" : "badge-warning"}">${escapeHtml(b.status || "unknown")}</span>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = renderEmptyState({ title: "No live trips", description: "Trip monitor ready.", icon: "car" });
    }
  },

  async loadDisputes() {
    const container = document.getElementById("admin-disputes-container");
    if (!container) return;

    try {
      const disputes = await DisputeService.listDisputes();

      if (!disputes || disputes.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No dispute tickets",
          description: "Customer support issues and booking disputes will appear here for administrative resolution.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Dispute ID</th>
                <th style="padding: 0.75rem;">Booking</th>
                <th style="padding: 0.75rem;">Reason</th>
                <th style="padding: 0.75rem;">Details</th>
                <th style="padding: 0.75rem;">Status</th>
                <th style="padding: 0.75rem;">Resolution</th>
                <th style="padding: 0.75rem;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${disputes.map((d) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-family: monospace; font-weight: 700;">#${escapeHtml(String(d.$id || d.id).slice(0, 8))}</td>
                  <td style="padding: 0.75rem; font-family: monospace;">#${escapeHtml(String(d.booking_id || "").slice(0, 8))}</td>
                  <td style="padding: 0.75rem; font-weight: 700; text-transform: capitalize;">${escapeHtml((d.reason || "").replace(/_/g, " "))}</td>
                  <td style="padding: 0.75rem; max-width: 250px; font-size: 0.82rem; color: var(--text-muted);">${escapeHtml(d.details || "—")}</td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${d.status === "resolved" ? "badge-success" : "badge-danger"}">${escapeHtml(d.status || "open")}</span>
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.82rem;">${escapeHtml(d.resolution || "Pending")}</td>
                  <td style="padding: 0.75rem;">
                    ${d.status !== "resolved" ? `
                      <button type="button" class="btn btn-primary btn-sm btn-resolve-dispute" data-dispute-id="${d.$id || d.id}">
                        ✓ Resolve
                      </button>
                    ` : `<span style="color: #10b981; font-weight: 700;">Resolved</span>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll(".btn-resolve-dispute").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const disputeId = e.currentTarget.getAttribute("data-dispute-id");
          const resolution = prompt("Enter administrative resolution notes for this dispute:");
          if (!resolution) return;

          btn.disabled = true;
          try {
            await DisputeService.resolveDispute({ disputeId, resolution: resolution.trim() });
            alert("Dispute successfully resolved and audit entry recorded!");
            this.loadDisputes();
            this.loadStats();
          } catch (err) {
            alert("Failed to resolve dispute: " + err.message);
            btn.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Disputes unavailable",
        description: "Could not load dispute tickets: " + err.message,
        icon: "inbox"
      });
    }
  },

  async loadAuditLogs() {
    const container = document.getElementById("admin-audit-container");
    if (!container) return;

    try {
      const logs = await AdminService.getActivityLogs();

      if (!logs || logs.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No audit logs recorded yet",
          description: "Privileged actions such as document verifications, status changes, and dispute resolutions will appear here.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Action</th>
                <th style="padding: 0.75rem;">Actor / User</th>
                <th style="padding: 0.75rem;">Details</th>
                <th style="padding: 0.75rem;">IP Address</th>
                <th style="padding: 0.75rem;">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map((log) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-weight: 700; color: #0284c7;">
                    ${escapeHtml(log.action)}
                  </td>
                  <td style="padding: 0.75rem; font-family: monospace; font-size: 0.82rem;">
                    ${escapeHtml(log.user_id || "System")}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.82rem; color: var(--text-muted); max-width: 320px;">
                    ${escapeHtml(log.details || "—")}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.82rem;">
                    ${escapeHtml(log.ip_address || "—")}
                  </td>
                  <td style="padding: 0.75rem; color: var(--text-muted); font-size: 0.82rem;">
                    ${log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Audit logs unavailable",
        description: "Could not fetch activity logs: " + err.message,
        icon: "inbox"
      });
    }
  },

  async loadStats() {
    try {
      const analytics = await AdminService.getAnalytics();
      const setStat = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val !== undefined && val !== null ? val : "0";
      };

      setStat("stat-passengers", analytics.registeredPassengers);
      setStat("stat-providers", analytics.registeredProviders);
      setStat("stat-active-providers", analytics.activeProviders);
      setStat("stat-requests", analytics.requestsPosted);
      setStat("stat-bookings", analytics.bookingsAwarded);
      setStat("stat-completed", analytics.completedBookings);
      setStat("stat-cancelled", analytics.cancelledBookings);
      setStat("stat-subscriptions", analytics.activeSubscriptions);
      setStat("stat-pending", analytics.verificationQueue);
      setStat("stat-pending-providers", analytics.pendingProviders);
      setStat("stat-pending-vehicles", analytics.pendingVehicles);
      setStat("stat-pending-documents", analytics.pendingDocuments);
      setStat("stat-expired-documents", analytics.expiredDocuments);
      setStat("stat-disputes", analytics.openDisputes);
      setStat("stat-revenue", `$${Number(analytics.paymentsTotal || 0).toFixed(2)}`);
      setStat("stat-users", (analytics.registeredPassengers || 0) + (analytics.registeredProviders || 0));
    } catch (err) {
      console.warn("Could not fetch real analytics:", err);
    }
  },

  async loadVerifications() {
    const container = document.getElementById("admin-verifications-container");
    if (!container) return;

    try {
      const filter = document.getElementById("admin-verification-filter")?.value || "pending";
      const [queueResult, docAudit] = await Promise.all([
        AdminService.getVerifications(filter),
        AdminService.getVerificationDocuments().catch(() => null)
      ]);
      const providers = queueResult.verifications || [];
      const summary = queueResult.summary || {};
      const expiringCount = docAudit?.summary?.expiring_soon ?? docAudit?.expiring?.length ?? 0;
      const statusClass = (status) => ["approved", "verified"].includes(status)
        ? "badge-success"
        : status === "rejected" || status === "expired"
          ? "badge-danger"
          : "badge-warning";
      const statusText = (status) => status === "verified" ? "APPROVED" : String(status || "unverified").toUpperCase();
      const formatDate = (value) => value
        ? new Date(value).toLocaleDateString("en-GB", { dateStyle: "medium" })
        : "Not recorded";

      const summaryHtml = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(145px,1fr)); gap:0.75rem; padding:1rem; border-bottom:1px solid var(--border-light);">
          <div><strong>${summary.pending_providers || 0}</strong><div style="font-size:0.75rem;color:var(--text-muted);">Pending Providers</div></div>
          <div><strong>${summary.pending_vehicles || 0}</strong><div style="font-size:0.75rem;color:var(--text-muted);">Pending Vehicles</div></div>
          <div><strong>${summary.pending_documents || 0}</strong><div style="font-size:0.75rem;color:var(--text-muted);">Pending Documents</div></div>
          <div><strong style="color:#dc2626;">${summary.expired_documents || 0}</strong><div style="font-size:0.75rem;color:var(--text-muted);">Expired Documents</div></div>
        </div>`;

      if (providers.length === 0) {
        container.innerHTML = summaryHtml + renderEmptyState({
          title: `No ${filter} verification records`,
          description: "Choose another filter to review previously processed provider, vehicle, and document submissions.",
          icon: "inbox"
        });
        return;
      }

      const expiryNoticeHtml = (summary.expired_documents || expiringCount) ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:1rem;margin:1rem;">
          <strong style="color:#92400e;">Document Expiry Status</strong>
          <div style="font-size:0.85rem;color:#b45309;margin-top:0.2rem;">${summary.expired_documents || 0} expired · ${expiringCount} expiring within 30 days</div>
        </div>` : "";

      container.innerHTML = `${summaryHtml}${expiryNoticeHtml}
        <div style="display:grid; gap:1rem; padding:1rem;">
          ${providers.map((provider) => {
            const ready = ["approved", "verified"].includes(provider.verification_status) &&
              provider.vehicles.some((vehicle) => ["approved", "verified"].includes(vehicle.verification_status)) &&
              provider.documents.some((document) => ["approved", "verified"].includes(document.verification_status));
            return `
              <section style="border:1px solid var(--border-light);padding:1.25rem;border-radius:var(--radius-lg);background:var(--bg-surface);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
                  <div style="display:flex;gap:0.75rem;align-items:center;">
                    ${provider.profile_image_url ? `<img src="${escapeHtml(provider.profile_image_url)}" alt="${escapeHtml(provider.full_name)}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid var(--border-light);">` : ""}
                    <div>
                      <div style="font-weight:800;font-size:1.1rem;">${escapeHtml(provider.full_name)}</div>
                      <div style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(provider.email)} · ${escapeHtml(provider.phone || "No phone")}</div>
                      <div style="font-size:0.75rem;color:var(--text-muted);">Submitted ${escapeHtml(formatDate(provider.submitted_at))} · ${escapeHtml((provider.role || "provider").replaceAll("_", " "))}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
                    <span class="badge ${statusClass(provider.verification_status)}">Profile: ${escapeHtml(statusText(provider.verification_status))}</span>
                    <span class="badge ${ready ? "badge-success" : "badge-warning"}">${ready ? "READY" : "COMPONENTS OUTSTANDING"}</span>
                  </div>
                </div>
                ${provider.rejection_reason ? `<div style="padding:0.65rem;background:#fef2f2;color:#991b1b;border-radius:6px;margin-bottom:0.75rem;font-size:0.82rem;">Profile rejection reason: ${escapeHtml(provider.rejection_reason)}</div>` : ""}
                <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-bottom:1rem;">
                  <button class="btn btn-danger btn-sm" data-verification-action="reject" data-kind="profile" data-id="${escapeHtml(provider.id)}">Reject Profile</button>
                  <button class="btn btn-primary btn-sm" data-verification-action="approve" data-kind="profile" data-id="${escapeHtml(provider.id)}">Approve Profile</button>
                </div>

                <div style="font-weight:800;margin-bottom:0.5rem;">Vehicles (${provider.vehicles.length})</div>
                <div style="display:grid;gap:0.5rem;margin-bottom:1rem;">
                  ${provider.vehicles.length ? provider.vehicles.map((vehicle) => `
                    <div style="border:1px solid var(--border-light);border-radius:6px;padding:0.75rem;display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>${escapeHtml(vehicle.make)} ${escapeHtml(vehicle.model)} ${vehicle.year ? `(${escapeHtml(vehicle.year)})` : ""}</strong>
                        <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(vehicle.registration_number)} · ${escapeHtml((vehicle.service_category || "unspecified").replaceAll("_", " "))}</div>
                        ${vehicle.rejection_reason ? `<div style="font-size:0.78rem;color:#b91c1c;">${escapeHtml(vehicle.rejection_reason)}</div>` : ""}
                        ${vehicle.photos?.length ? `<div style="display:flex;gap:0.35rem;margin-top:0.45rem;">${vehicle.photos.map((photo) => `<a href="${escapeHtml(photo.view_url)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(photo.view_url)}" alt="Vehicle photo" style="width:54px;height:40px;object-fit:cover;border-radius:4px;"></a>`).join("")}</div>` : ""}
                      </div>
                      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span class="badge ${statusClass(vehicle.verification_status)}">${escapeHtml(statusText(vehicle.verification_status))}</span>
                        <button class="btn btn-danger btn-sm" data-verification-action="reject" data-kind="vehicle" data-id="${escapeHtml(vehicle.id)}">Reject</button>
                        <button class="btn btn-primary btn-sm" data-verification-action="approve" data-kind="vehicle" data-id="${escapeHtml(vehicle.id)}">Approve</button>
                      </div>
                    </div>`).join("") : `<div style="color:var(--text-muted);font-size:0.82rem;">No vehicles submitted.</div>`}
                </div>

                <div style="font-weight:800;margin-bottom:0.5rem;">Documents (${provider.documents.length})</div>
                <div style="display:grid;gap:0.5rem;">
                  ${provider.documents.length ? provider.documents.map((document) => `
                    <div style="border:1px solid var(--border-light);border-radius:6px;padding:0.75rem;display:flex;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;">
                      <div>
                        <strong>${escapeHtml((document.document_type || "document").replaceAll("_", " "))}</strong>
                        <div style="font-size:0.8rem;color:var(--text-muted);">Uploaded ${escapeHtml(formatDate(document.created_at))}${document.expires_at ? ` · Expires ${escapeHtml(formatDate(document.expires_at))}` : ""}${document.vehicle_id ? ` · Vehicle linked` : ""}</div>
                        ${document.rejection_reason ? `<div style="font-size:0.78rem;color:#b91c1c;">${escapeHtml(document.rejection_reason)}</div>` : ""}
                      </div>
                      <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                        <span class="badge ${statusClass(document.verification_status)}">${escapeHtml(statusText(document.verification_status))}</span>
                        <button class="btn btn-outline btn-sm" data-open-document="${escapeHtml(document.id)}" ${document.has_file ? "" : "disabled"}>Open / View</button>
                        <button class="btn btn-danger btn-sm" data-verification-action="reject" data-kind="document" data-id="${escapeHtml(document.id)}">Reject</button>
                        <button class="btn btn-primary btn-sm" data-verification-action="approve" data-kind="document" data-id="${escapeHtml(document.id)}">Approve</button>
                      </div>
                    </div>`).join("") : `<div style="color:var(--text-muted);font-size:0.82rem;">No documents submitted.</div>`}
                </div>
              </section>`;
          }).join("")}
        </div>`;

      container.querySelectorAll("[data-verification-action]").forEach((button) => {
        button.addEventListener("click", async (event) => {
          const target = event.currentTarget;
          const action = target.dataset.verificationAction;
          const kind = target.dataset.kind;
          const id = target.dataset.id;
          const reason = action === "reject" ? prompt(`Enter rejection reason for this ${kind}:`) : null;
          if (action === "reject" && !reason?.trim()) return;
          if (action === "approve" && !confirm(`Approve this ${kind}?`)) return;
          target.disabled = true;
          try {
            if (kind === "profile") await AdminService.updateVerificationStatus(id, action === "approve" ? "approved" : "rejected", reason);
            if (kind === "vehicle") await AdminService.verifyVehicle(id, action === "approve" ? "approved" : "rejected", reason);
            if (kind === "document") await AdminService.verifyDocument(id, action === "approve" ? "verified" : "rejected", reason);
            await Promise.all([this.loadVerifications(), this.loadStats(), this.loadAuditLogs().catch(() => {})]);
          } catch (error) {
            alert(`Verification action failed: ${error.message}`);
            target.disabled = false;
          }
        });
      });

      container.querySelectorAll("[data-open-document]").forEach((button) => {
        button.addEventListener("click", async (event) => {
          const target = event.currentTarget;
          target.disabled = true;
          try {
            const access = await AdminService.openVerificationDocument(target.dataset.openDocument);
            const opened = window.open(access.view_url, "_blank", "noopener,noreferrer");
            if (!opened) window.location.assign(access.view_url);
          } catch (error) {
            alert(`Could not open private document: ${error.message}`);
          } finally {
            target.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Verification queue unavailable",
        description: `Could not load verification records: ${err.message}`,
        icon: "inbox"
      });
    }
  },

  async loadTransactions() {
    const container = document.getElementById("admin-transactions-container");
    if (!container) return;

    try {
      const filter = document.getElementById("admin-payments-filter")?.value || "";
      const txns = await AdminService.getPendingPayments(filter);

      if (!txns || txns.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No payment submissions found",
          description: filter ? `No payment records matching '${filter}'.` : "All EcoCash payment submissions awaiting admin verification will appear here.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Reference &amp; Date</th>
                <th style="padding: 0.75rem;">Type &amp; Purpose</th>
                <th style="padding: 0.75rem;">EcoCash Destination</th>
                <th style="padding: 0.75rem;">Sender Details</th>
                <th style="padding: 0.75rem;">Amount</th>
                <th style="padding: 0.75rem;">Proof</th>
                <th style="padding: 0.75rem;">Status</th>
                <th style="padding: 0.75rem; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map((t) => {
                const isPending = t.status === "pending_review";
                const isApproved = t.status === "approved";
                const isRejected = t.status === "rejected";
                const badgeClass = isApproved ? "badge-success" : isRejected ? "badge-danger" : "badge-warning";
                const hasProof = Boolean(t.proof_file_id);
                const paymentId = t.$id || t.id;

                return `
                  <tr style="border-bottom: 1px solid var(--border-light); vertical-align: top;">
                    <td style="padding: 0.75rem;">
                      <div style="font-family: monospace; font-weight: 700; color: var(--text-main);">${escapeHtml(t.reference || t.transaction_reference || "—")}</div>
                      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                        ${t.created_at ? new Date(t.created_at).toLocaleString() : "—"}
                      </div>
                      ${t.transaction_reference ? `<div style="font-size: 0.75rem; color: #0284c7; font-family: monospace; margin-top: 0.15rem;">TxRef: ${escapeHtml(t.transaction_reference)}</div>` : ""}
                    </td>
                    <td style="padding: 0.75rem;">
                      <span class="badge badge-neutral" style="text-transform: uppercase; font-size: 0.72rem;">${escapeHtml(t.payment_type || "payment")}</span>
                      <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
                        ${escapeHtml(t.plan_name || t.related_id || t.subscription_id || t.booking_id || "—")}
                      </div>
                      ${t.plan_duration_days ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.plan_duration_days)} days</div>` : ""}
                    </td>
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 600;">${escapeHtml(t.recipient_name || "EcoCash Admin")}</div>
                      <div style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.recipient_number || "—")}</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(t.provider_name || "Unknown provider")}</div>
                      ${t.provider_email ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.provider_email)}</div>` : ""}
                      <div style="font-weight: 600;">${escapeHtml(t.sender_name || "—")}</div>
                      <div style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t.sender_phone || "—")}</div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">User: ${escapeHtml(t.user_id ? t.user_id.slice(0, 10) + "..." : "—")}</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 800; color: #10b981; font-size: 1rem;">
                        $${Number(t.amount_declared ?? t.amount_expected ?? t.amount ?? 0).toFixed(2)}
                      </div>
                      ${t.amount_expected && t.amount_declared && t.amount_declared !== t.amount_expected ? `
                        <div style="font-size: 0.75rem; color: #ef4444; font-weight: 600;">
                          Expected: $${Number(t.amount_expected).toFixed(2)}
                        </div>
                      ` : ""}
                    </td>
                    <td style="padding: 0.75rem;">
                      ${hasProof ? `
                        <button type="button" class="btn btn-outline btn-sm btn-view-payment-proof" data-payment-id="${paymentId}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                          🔍 View Proof
                        </button>
                      ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">No file</span>`}
                    </td>
                    <td style="padding: 0.75rem;">
                      <span class="badge ${badgeClass}">${escapeHtml((t.status || "pending_review").replace(/_/g, " ").toUpperCase())}</span>
                      ${isRejected && t.rejection_reason ? `
                        <div style="font-size: 0.75rem; color: #ef4444; margin-top: 0.25rem; max-width: 150px;">${escapeHtml(t.rejection_reason)}</div>
                      ` : ""}
                      ${isApproved && t.reviewed_at ? `
                        <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">Approved ${new Date(t.reviewed_at).toLocaleDateString()}</div>
                      ` : ""}
                    </td>
                    <td style="padding: 0.75rem; text-align: right;">
                      ${isPending ? `
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                          <button type="button" class="btn btn-primary btn-sm btn-approve-payment" data-payment-id="${paymentId}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                            ✓ Approve
                          </button>
                          <button type="button" class="btn btn-danger btn-sm btn-reject-payment" data-payment-id="${paymentId}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                            ✗ Reject
                          </button>
                        </div>
                      ` : `<span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Processed</span>`}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      // Wire up approval / rejection handlers
      container.querySelectorAll(".btn-view-payment-proof").forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          const target = event.currentTarget;
          const paymentId = target.getAttribute("data-payment-id");
          const previewWindow = window.open("", "_blank");
          target.disabled = true;
          try {
            const result = await AdminService.openPaymentProof(paymentId);
            if (previewWindow) {
              previewWindow.location = result.view_url;
            } else {
              window.open(result.view_url, "_blank", "noopener,noreferrer");
            }
          } catch (error) {
            previewWindow?.close();
            alert("Could not open payment proof: " + error.message);
          } finally {
            target.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-approve-payment").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const paymentId = e.currentTarget.getAttribute("data-payment-id");
          if (!confirm("Are you sure you want to approve this EcoCash payment? This will activate the associated subscription or approve the ad campaign.")) return;

          e.currentTarget.disabled = true;
          e.currentTarget.innerText = "Approving...";
          try {
            await AdminService.approvePayment(paymentId);
            alert("Payment verified and approved successfully! Associated service has been activated.");
            this.loadTransactions();
            this.loadStats();
          } catch (err) {
            alert("Failed to approve payment: " + err.message);
            e.currentTarget.disabled = false;
            e.currentTarget.innerText = "✓ Approve";
          }
        });
      });

      container.querySelectorAll(".btn-reject-payment").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const paymentId = e.currentTarget.getAttribute("data-payment-id");
          const reason = prompt("Enter a mandatory reason for rejecting this EcoCash payment submission:");
          if (!reason || !reason.trim()) {
            alert("Rejection cancelled: A rejection reason is required.");
            return;
          }

          e.currentTarget.disabled = true;
          e.currentTarget.innerText = "Rejecting...";
          try {
            await AdminService.rejectPayment(paymentId, reason.trim());
            alert("Payment marked as rejected.");
            this.loadTransactions();
            this.loadStats();
          } catch (err) {
            alert("Failed to reject payment: " + err.message);
            e.currentTarget.disabled = false;
            e.currentTarget.innerText = "✗ Reject";
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Payment queue unavailable",
        description: "Could not load payments: " + err.message,
        icon: "inbox"
      });
    }
  },

  async loadPlans() {
    const container = document.getElementById("admin-plans-container");
    if (!container) return;

    try {
      const plans = await AdminService.getSubscriptionPlans(true);

      if (!plans || plans.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No subscription plans configured",
          description: "Create subscription plans with multi-tier pricing ($5/7d, $15/30d, etc.) for transport providers.",
          icon: "box"
        });
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; padding: 1rem 0;">
          ${plans.map((p) => {
            const planId = p.$id || p.id;
            const features = Array.isArray(p.features) ? p.features : [];

            return `
              <div class="card" style="padding: 1.25rem; border-top: 4px solid ${p.active ? "var(--primary)" : "#94a3b8"}; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                      <h4 style="font-weight: 800; font-size: 1.1rem; margin-bottom: 0.2rem;">${escapeHtml(p.name)}</h4>
                      <div style="font-family: monospace; font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(p.slug || p.id || "")}</div>
                    </div>
                    <span class="badge ${p.active ? "badge-success" : "badge-neutral"}">${p.active ? "ACTIVE" : "INACTIVE"}</span>
                  </div>

                  <div style="margin: 0.75rem 0;">
                    <span style="font-size: 1.8rem; font-weight: 900; color: var(--text-main);">$${escapeHtml(p.price)}</span>
                    <span style="color: var(--text-muted); font-size: 0.85rem;"> / ${escapeHtml(p.duration_days)} days</span>
                  </div>

                  <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">${escapeHtml(p.description || "No description provided.")}</p>

                  <div style="font-size: 0.8rem; background: var(--bg-subtle); padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;">
                    <strong>Free Jobs Allowance:</strong> First 5 jobs free for all providers
                  </div>

                  ${features.length > 0 ? `
                    <ul style="padding-left: 1.25rem; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
                      ${features.map(f => `<li>${escapeHtml(f)}</li>`).join("")}
                    </ul>
                  ` : ""}
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border-light); padding-top: 0.75rem; margin-top: 0.5rem;">
                  <button type="button" class="btn btn-outline btn-sm btn-edit-plan" data-plan='${escapeHtml(JSON.stringify(p))}'>
                    ✏️ Edit
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-toggle-plan" data-plan-id="${planId}">
                    ${p.active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm btn-delete-plan" data-plan-id="${planId}">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-edit-plan").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          try {
            const plan = JSON.parse(e.currentTarget.getAttribute("data-plan"));
            this.openAddPlanModal(plan);
          } catch (err) {
            console.error("Failed to parse plan data:", err);
          }
        });
      });

      container.querySelectorAll(".btn-toggle-plan").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const planId = e.currentTarget.getAttribute("data-plan-id");
          e.currentTarget.disabled = true;
          try {
            await AdminService.togglePlanActive(planId);
            this.loadPlans();
          } catch (err) {
            alert("Failed to toggle plan status: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-delete-plan").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const planId = e.currentTarget.getAttribute("data-plan-id");
          if (!confirm("Are you sure you want to delete this subscription plan?")) return;
          e.currentTarget.disabled = true;
          try {
            await AdminService.deleteSubscriptionPlan(planId);
            this.loadPlans();
          } catch (err) {
            alert("Failed to delete plan: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Plans unavailable",
        description: "Could not load subscription plans: " + err.message,
        icon: "box"
      });
    }
  },

  openAddPlanModal(plan = null) {
    const isEdit = Boolean(plan && (plan.$id || plan.id));
    const content = `
      <form id="form-manage-plan" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Plan Slug / ID</label>
          <input type="text" id="modal-plan-slug" class="form-input" placeholder="e.g. flex-pass, pro-annual" value="${escapeHtml(plan?.slug || plan?.id || "")}" ${isEdit ? "readonly" : "required"} />
          <small style="color: var(--text-muted);">Unique identifier (e.g. flex-pass, professional, pro-90, pro-annual)</small>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Plan Title / Name</label>
          <input type="text" id="modal-plan-name" class="form-input" placeholder="e.g. TransMove Flex Pass" value="${escapeHtml(plan?.name || "")}" required />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Price (USD)</label>
            <input type="number" step="0.01" min="0" id="modal-plan-price" class="form-input" placeholder="15.00" value="${escapeHtml(plan?.price ?? "")}" required />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Duration (Days)</label>
            <input type="number" min="1" id="modal-plan-duration" class="form-input" placeholder="30" value="${escapeHtml(plan?.duration_days ?? 30)}" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Description</label>
          <textarea id="modal-plan-desc" class="form-input" rows="2" placeholder="Summary of this plan...">${escapeHtml(plan?.description || "")}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Features (comma-separated)</label>
          <input type="text" id="modal-plan-features" class="form-input" placeholder="Full bidding access, Direct passenger calling, Priority dispatch" value="${escapeHtml(Array.isArray(plan?.features) ? plan.features.join(", ") : "")}" />
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Sort Order</label>
            <input type="number" id="modal-plan-sort" class="form-input" value="${escapeHtml(plan?.sort_order ?? 0)}" />
          </div>
          <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1.5rem;">
            <input type="checkbox" id="modal-plan-active" ${plan ? (plan.active ? "checked" : "") : "checked"} />
            <label for="modal-plan-active" style="font-weight: 600; cursor: pointer;">Active (Available to providers)</label>
          </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-plan-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-plan-submit">${isEdit ? "Save Changes" : "Create Plan"}</button>
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? "✏️ Edit Subscription Plan" : "📦 Create Subscription Plan",
      content
    });

    document.getElementById("btn-cancel-plan-modal")?.addEventListener("click", () => Modal.close());

    document.getElementById("form-manage-plan")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-save-plan-submit");
      submitBtn.disabled = true;
      submitBtn.innerText = "Saving...";

      const slug = document.getElementById("modal-plan-slug").value.trim();
      const name = document.getElementById("modal-plan-name").value.trim();
      const price = parseFloat(document.getElementById("modal-plan-price").value);
      const duration_days = parseInt(document.getElementById("modal-plan-duration").value, 10);
      const description = document.getElementById("modal-plan-desc").value.trim();
      const featuresRaw = document.getElementById("modal-plan-features").value;
      const features = featuresRaw ? featuresRaw.split(",").map(f => f.trim()).filter(Boolean) : [];
      const sort_order = parseInt(document.getElementById("modal-plan-sort").value, 10) || 0;
      const active = document.getElementById("modal-plan-active").checked;

      try {
        await AdminService.saveSubscriptionPlan({
          plan_id: plan?.$id || plan?.id,
          slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name,
          price,
          duration_days,
          description,
          features,
          sort_order,
          active
        });
        Modal.close();
        this.loadPlans();
      } catch (err) {
        alert("Failed to save subscription plan: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = isEdit ? "Save Changes" : "Create Plan";
      }
    });
  },

  async loadDestinations() {
    const container = document.getElementById("admin-destinations-container");
    if (!container) return;

    try {
      const dests = await AdminService.getPaymentDestinations();

      if (!dests || dests.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No EcoCash destination accounts",
          description: "Add approved admin EcoCash destination accounts (e.g. Othniel: 0787692127, Simba: 0786447601) for users to send payments to.",
          icon: "smartphone"
        });
        return;
      }

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; padding: 1rem 0;">
          ${dests.map((d) => {
            const destId = d.$id || d.id;
            return `
              <div class="card" style="padding: 1.25rem; border-top: 4px solid ${d.active ? "#10b981" : "#94a3b8"}; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <span class="badge ${d.active ? "badge-success" : "badge-neutral"}">${d.active ? "ACTIVE" : "INACTIVE"}</span>
                    <span style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">${escapeHtml(d.account_type || "personal")}</span>
                  </div>

                  <h4 style="font-weight: 800; font-size: 1.15rem; margin-bottom: 0.25rem;">${escapeHtml(d.account_name)}</h4>
                  <div style="font-size: 1.2rem; font-weight: 800; font-family: monospace; color: #0284c7; margin-bottom: 0.5rem;">
                    📱 ${escapeHtml(d.account_number)}
                  </div>

                  <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                    ${escapeHtml(d.description || "Official EcoCash destination for TransMove manual payments.")}
                  </p>

                  <div style="font-size: 0.78rem; color: var(--text-muted);">
                    Currency: <strong>${escapeHtml(d.currency || "USD")}</strong> · ID: <code>${escapeHtml(d.slug || destId)}</code>
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px solid var(--border-light); padding-top: 0.75rem; margin-top: 1rem;">
                  <button type="button" class="btn btn-outline btn-sm btn-edit-dest" data-dest='${escapeHtml(JSON.stringify(d))}'>
                    ✏️ Edit
                  </button>
                  <button type="button" class="btn btn-outline btn-sm btn-toggle-dest" data-dest-id="${destId}">
                    ${d.active ? "Deactivate" : "Activate"}
                  </button>
                  <button type="button" class="btn btn-danger btn-sm btn-delete-dest" data-dest-id="${destId}">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-edit-dest").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          try {
            const dest = JSON.parse(e.currentTarget.getAttribute("data-dest"));
            this.openAddDestinationModal(dest);
          } catch (err) {
            console.error("Failed to parse destination:", err);
          }
        });
      });

      container.querySelectorAll(".btn-toggle-dest").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const destId = e.currentTarget.getAttribute("data-dest-id");
          e.currentTarget.disabled = true;
          try {
            await AdminService.togglePaymentDestinationActive(destId);
            this.loadDestinations();
          } catch (err) {
            alert("Failed to toggle destination: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-delete-dest").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const destId = e.currentTarget.getAttribute("data-dest-id");
          if (!confirm("Are you sure you want to delete this payment destination?")) return;
          e.currentTarget.disabled = true;
          try {
            await AdminService.deletePaymentDestination(destId);
            this.loadDestinations();
          } catch (err) {
            alert("Failed to delete destination: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Destinations unavailable",
        description: "Could not load EcoCash destinations: " + err.message,
        icon: "smartphone"
      });
    }
  },

  openAddDestinationModal(dest = null) {
    const isEdit = Boolean(dest && (dest.$id || dest.id));
    const content = `
      <form id="form-manage-destination" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Account Name</label>
          <input type="text" id="modal-dest-name" class="form-input" placeholder="e.g. Othniel Nyasha Chavunduka" value="${escapeHtml(dest?.account_name || "")}" required />
          <small style="color: var(--text-muted);">Exact registered EcoCash account name displayed to user</small>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">EcoCash Number</label>
            <input type="text" id="modal-dest-number" class="form-input" placeholder="e.g. 0787692127" value="${escapeHtml(dest?.account_number || "")}" required />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Account Type</label>
            <select id="modal-dest-type" class="form-select">
              <option value="personal" ${dest?.account_type === "personal" ? "selected" : ""}>Personal (Send Money)</option>
              <option value="merchant" ${dest?.account_type === "merchant" ? "selected" : ""}>Merchant (Pay Merchant)</option>
              <option value="biller" ${dest?.account_type === "biller" ? "selected" : ""}>Biller (Pay Bill)</option>
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Currency</label>
            <input type="text" id="modal-dest-currency" class="form-input" value="${escapeHtml(dest?.currency || "USD")}" />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">Destination Slug / Identifier</label>
            <input type="text" id="modal-dest-slug" class="form-input" placeholder="e.g. ecocash_othniel" value="${escapeHtml(dest?.slug || "")}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">Payment Instructions / Description</label>
          <textarea id="modal-dest-desc" class="form-input" rows="2" placeholder="Dial *151# -> Send Money -> Enter number...">${escapeHtml(dest?.description || "")}</textarea>
        </div>
        <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="checkbox" id="modal-dest-active" ${dest ? (dest.active ? "checked" : "") : "checked"} />
          <label for="modal-dest-active" style="font-weight: 600; cursor: pointer;">Active (Visible in payment options)</label>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
          <button type="button" class="btn btn-outline" id="btn-cancel-dest-modal">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-dest-submit">${isEdit ? "Save Changes" : "Create Destination"}</button>
        </div>
      </form>
    `;

    Modal.open({
      title: isEdit ? "✏️ Edit EcoCash Destination" : "📱 Add EcoCash Destination",
      content
    });

    document.getElementById("btn-cancel-dest-modal")?.addEventListener("click", () => Modal.close());

    document.getElementById("form-manage-destination")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-save-dest-submit");
      submitBtn.disabled = true;
      submitBtn.innerText = "Saving...";

      const account_name = document.getElementById("modal-dest-name").value.trim();
      const account_number = document.getElementById("modal-dest-number").value.trim();
      const account_type = document.getElementById("modal-dest-type").value;
      const currency = document.getElementById("modal-dest-currency").value.trim() || "USD";
      const slug = document.getElementById("modal-dest-slug").value.trim() || account_name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const description = document.getElementById("modal-dest-desc").value.trim();
      const active = document.getElementById("modal-dest-active").checked;

      try {
        await AdminService.savePaymentDestination({
          destination_id: dest?.$id || dest?.id,
          account_name,
          account_number,
          account_type,
          currency,
          slug,
          description,
          active
        });
        Modal.close();
        this.loadDestinations();
      } catch (err) {
        alert("Failed to save destination: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = isEdit ? "Save Changes" : "Create Destination";
      }
    });
  },

  async loadAds() {
    const container = document.getElementById("admin-ads-container");
    if (!container) return;

    try {
      const filter = document.getElementById("admin-ads-filter")?.value || null;
      const campaigns = await AdminService.getAdCampaigns(filter);

      if (!campaigns || campaigns.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No advertising campaigns found",
          description: filter ? `No campaigns matching filter '${filter}'.` : "Commercial ads submitted by advertisers will appear here for content moderation and approval.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Campaign &amp; Dates</th>
                <th style="padding: 0.75rem;">Advertiser</th>
                <th style="padding: 0.75rem;">Placement &amp; Package</th>
                <th style="padding: 0.75rem;">Budget</th>
                <th style="padding: 0.75rem;">Creative</th>
                <th style="padding: 0.75rem;">Status</th>
                <th style="padding: 0.75rem; text-align: right;">Moderation</th>
              </tr>
            </thead>
            <tbody>
              ${campaigns.map((c) => {
                const campId = c.$id || c.id;
                const isPending = ["pending_review", "submitted"].includes(c.status);
                const statusBadge = c.status === "active" ? "badge-success" : c.status === "approved" ? "badge-info" : c.status === "rejected" ? "badge-danger" : "badge-warning";
                const imageUrl = c.creative_file_id ? PaymentService.getProofViewUrl(c.creative_file_id) : (c.image_url || null);

                return `
                  <tr style="border-bottom: 1px solid var(--border-light); vertical-align: top;">
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(c.title || c.headline || "Untitled Campaign")}</div>
                      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
                        ${c.start_date ? new Date(c.start_date).toLocaleDateString() : "TBD"} – ${c.end_date ? new Date(c.end_date).toLocaleDateString() : "TBD"}
                      </div>
                      <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(campId)}</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 600;">${escapeHtml(c.company_name || c.contact_name || "—")}</div>
                      <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(c.contact_phone || c.contact_email || "—")}</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      <span class="badge badge-neutral" style="text-transform: capitalize;">${escapeHtml((c.placement || "general").replace(/_/g, " "))}</span>
                      <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">${escapeHtml(c.package_name || "Custom")}</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      <div style="font-weight: 800; color: #10b981; font-size: 1rem;">
                        $${Number(c.amount_expected || c.total_price || 0).toFixed(2)}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(c.duration_days || "—")} days</div>
                    </td>
                    <td style="padding: 0.75rem;">
                      ${imageUrl ? `
                        <a href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener noreferrer">
                          <img src="${escapeHtml(imageUrl)}" alt="Ad Creative" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-light);" />
                        </a>
                      ` : `<span style="font-size: 0.75rem; color: var(--text-muted);">Text only</span>`}
                      ${c.target_url ? `<div style="font-size: 0.75rem; margin-top: 0.2rem;"><a href="${escapeHtml(c.target_url)}" target="_blank" rel="noopener noreferrer" style="color: #0284c7;">Link ↗</a></div>` : ""}
                    </td>
                    <td style="padding: 0.75rem;">
                      <span class="badge ${statusBadge}">${escapeHtml(String(c.status || "pending_review").replace(/_/g, " ").toUpperCase())}</span>
                      ${c.rejection_reason ? `<div style="font-size: 0.75rem; color: #ef4444; margin-top: 0.2rem; max-width: 150px;">${escapeHtml(c.rejection_reason)}</div>` : ""}
                    </td>
                    <td style="padding: 0.75rem; text-align: right;">
                      ${isPending ? `
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                          <button type="button" class="btn btn-primary btn-sm btn-approve-ad" data-ad-id="${campId}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                            ✓ Approve
                          </button>
                          <button type="button" class="btn btn-danger btn-sm btn-reject-ad" data-ad-id="${campId}" style="padding: 0.35rem 0.6rem; font-size: 0.8rem;">
                            ✗ Reject
                          </button>
                        </div>
                      ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">Moderated</span>`}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;

      container.querySelectorAll(".btn-approve-ad").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const campId = e.currentTarget.getAttribute("data-ad-id");
          if (!confirm("Approve this ad creative content for publication?")) return;
          e.currentTarget.disabled = true;
          try {
            await AdminService.approveAdContent(campId);
            alert("Ad campaign content approved successfully!");
            this.loadAds();
          } catch (err) {
            alert("Failed to approve ad: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });

      container.querySelectorAll(".btn-reject-ad").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const campId = e.currentTarget.getAttribute("data-ad-id");
          const reason = prompt("Enter reason for rejecting this advertising campaign:");
          if (!reason || !reason.trim()) return;
          e.currentTarget.disabled = true;
          try {
            await AdminService.rejectAdContent(campId, reason.trim());
            alert("Ad campaign content marked as rejected.");
            this.loadAds();
          } catch (err) {
            alert("Failed to reject ad: " + err.message);
            e.currentTarget.disabled = false;
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Ad moderation unavailable",
        description: "Could not load advertising campaigns: " + err.message,
        icon: "inbox"
      });
    }
  },

  loadSocialSettings() {
    const saveBtn = document.getElementById("btn-save-social");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.title = "Platform settings storage has not been migrated to the Appwrite backend yet.";
    }
  }
};
