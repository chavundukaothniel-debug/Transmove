// ==============================================================================
// TRANSMOVE SECURE ADMIN PORTAL VIEW
// Server-verified driver/owner approvals, user audits & payment transactions
// ==============================================================================
import { AdminService } from "../services/admin.js";
import { AdvertisingService } from "../services/advertising.js";
import { SocialService } from "../services/social.js";
import { AuthService } from "../services/auth.js";
import { renderEmptyState } from "../components/EmptyState.js";

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
            <p style="color: var(--text-muted); font-size: 0.9rem;">Real-time database analytics, driver document approvals, live trip monitoring, ads moderation &amp; settings</p>
          </div>
          <span class="badge badge-danger">ADMINISTRATOR</span>
        </div>

        <!-- Admin Sub-tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
          <button class="btn btn-outline btn-sm adm-tab-btn active" data-tab="analytics">📊 Analytics &amp; KPIs</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="approvals">📋 Driver Approvals</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="trips">🚗 Live Trip Monitor</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="financials">💳 Financials &amp; Paynow</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="ads">📢 Advertising</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="settings">⚙️ Social &amp; Contact</button>
          <button class="btn btn-outline btn-sm adm-tab-btn" data-tab="disputes">⚠️ Support &amp; Disputes</button>
        </div>

        <!-- TAB 1: ANALYTICS -->
        <div id="adm-tab-analytics">
          <div class="grid-4" style="margin-bottom: 2rem;">
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Total Registered Users</div>
              <div id="stat-users" style="font-size: 1.8rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">...</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Registered Drivers</div>
              <div id="stat-drivers" style="font-size: 1.8rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">...</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Pending Verifications</div>
              <div id="stat-pending" style="font-size: 1.8rem; font-weight: 800; color: var(--accent-amber); margin-top: 0.25rem;">...</div>
            </div>
            <div class="card" style="padding: 1.25rem;">
              <div style="font-size: 0.85rem; color: var(--text-muted);">Platform Revenue ($)</div>
              <div id="stat-revenue" style="font-size: 1.8rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">$0.00</div>
            </div>
          </div>
        </div>

        <!-- TAB 2: DRIVER APPROVALS -->
        <div id="adm-tab-approvals" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📋 Driver &amp; Owner Document Verification Queue</h3>
              <span class="badge badge-warning">Pending Review</span>
            </div>
            <div id="admin-verifications-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading verification requests...</div>
            </div>
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

        <!-- TAB 4: FINANCIALS -->
        <div id="adm-tab-financials" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">💳 Paynow Transactions &amp; Wallet Ledger</h3>
              <span class="badge badge-neutral">Paynow Logs</span>
            </div>
            <div id="admin-transactions-container">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading transactions...</div>
            </div>
          </div>
        </div>

        <!-- TAB 5: ADS MANAGEMENT -->
        <div id="adm-tab-ads" style="display: none;">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">📢 Advertising Campaign Moderation</h3>
              <span class="badge badge-info">Commercial Ads</span>
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
              <span class="badge badge-success">Server Verified</span>
            </div>
            <div class="grid-4" style="margin-top: 1rem;">
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">PAYNOW INTEGRATION</div>
                <div style="font-weight: 800; color: #10b981; margin-top: 0.25rem;">🟢 Connected</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Live payment gateway</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">SUPABASE ENGINE</div>
                <div style="font-weight: 800; color: #10b981; margin-top: 0.25rem;">🟢 Connected</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">PostgreSQL &amp; RLS active</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">EMAIL SERVICE</div>
                <div style="font-weight: 800; color: #10b981; margin-top: 0.25rem;">🟢 Connected</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">Auth notification system</div>
              </div>
              <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
                <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">MAP CONFIGURATION</div>
                <div style="font-weight: 800; color: #10b981; margin-top: 0.25rem;">🟢 Active</div>
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
              <button type="submit" class="btn btn-primary" id="btn-save-social">Save Official Platform Links</button>
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

        ["analytics", "approvals", "trips", "financials", "ads", "settings", "disputes"].forEach((t) => {
          const el = document.getElementById(`adm-tab-${t}`);
          if (el) el.style.display = t === tab ? "block" : "none";
        });

        if (tab === "analytics") this.loadStats();
        if (tab === "approvals") this.loadVerifications();
        if (tab === "trips") this.loadLiveTrips();
        if (tab === "financials") this.loadTransactions();
        if (tab === "ads") this.loadAds();
        if (tab === "settings") this.loadSocialSettings();
        if (tab === "disputes") this.loadDisputes();
      });
    });

    const requestedTab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");
    const sidebarTabMap = {
      operations: "analytics",
      verification: "approvals",
      vehicles: "approvals",
      trips: "trips",
      payments: "financials",
      ads: "ads",
      settings: "settings",
      disputes: "disputes"
    };
    const initialTab = sidebarTabMap[requestedTab];
    if (initialTab) {
      document.querySelector(`.adm-tab-btn[data-tab="${initialTab}"]`)?.click();
    }

    // Social form submit
    const socialForm = document.getElementById("admin-social-form");
    if (socialForm) {
      socialForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const links = {
          facebook: document.getElementById("adm-fb-url").value.trim(),
          instagram: document.getElementById("adm-ig-url").value.trim(),
          tiktok: document.getElementById("adm-tt-url").value.trim(),
          x: document.getElementById("adm-x-url").value.trim(),
          youtube: document.getElementById("adm-yt-url").value.trim()
        };
        const wa = document.getElementById("adm-wa-num").value.trim();
        try {
          await SocialService.saveSocialConfig(links, wa);
          alert("Official Social Links & WhatsApp Support settings saved successfully!");
        } catch (err) {
          alert("Error saving settings: " + err.message);
        }
      });
    }

    this.loadStats();
    this.loadVerifications();
    this.loadTransactions();
    this.loadLiveTrips();
    this.loadDisputes();
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
                <th style="padding: 0.75rem;">PIN</th>
                <th style="padding: 0.75rem;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.map((b) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-family: monospace;">#${b.id.slice(0, 8)}</td>
                  <td style="padding: 0.75rem;">${b.customer?.full_name || "Customer"}</td>
                  <td style="padding: 0.75rem;">${b.driver?.full_name || "Driver"}</td>
                  <td style="padding: 0.75rem; font-weight: 700;">$${b.final_price}</td>
                  <td style="padding: 0.75rem; font-weight: 700; color: #38bdf8;">${b.trip_pin || "----"}</td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${b.status === "completed" ? "badge-success" : "badge-warning"}">${b.status}</span>
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
      const { DisputesService } = await import("../services/disputes.js");
      const disputes = await DisputesService.getAllDisputes();

      if (!disputes || disputes.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No open dispute tickets",
          description: "Customer issues and support complaints will appear here.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div class="grid-2">
          ${disputes.map((d) => `
            <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-lg); background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <div style="font-weight: 800; font-size: 1.05rem;">${d.subject}</div>
                <span class="badge ${d.status === "resolved" ? "badge-success" : "badge-danger"}">${d.status.toUpperCase()}</span>
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
                User: <strong>${d.profiles?.full_name || "User"}</strong> (${d.category})
              </div>
              <div style="font-size: 0.9rem; background: var(--bg-subtle); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                ${d.description}
              </div>
              ${d.status !== "resolved" ? `
                <button class="btn btn-primary btn-sm btn-resolve-dispute" data-id="${d.id}" style="width: 100%;">
                  Resolve Ticket &amp; Process Refund
                </button>
              ` : `<div style="font-size: 0.8rem; color: #10b981; font-weight: 700;">✓ Resolved (${d.resolution_notes})</div>`}
            </div>
          `).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-resolve-dispute").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          const notes = prompt("Enter resolution notes for the user:");
          if (!notes) return;
          const refund = prompt("Enter refund amount to credit to user wallet ($):", "0");
          try {
            await DisputesService.resolveDispute(id, notes, "resolved", parseFloat(refund || 0));
            alert("Dispute resolved successfully!");
            this.loadDisputes();
          } catch (err) {
            alert("Error resolving dispute: " + err.message);
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({ title: "Disputes Desk Ready", description: "No disputes to review.", icon: "inbox" });
    }
  },

  async loadStats() {
    try {
      const stats = await AdminService.getPlatformStats();
      document.getElementById("stat-users").innerText = stats.totalUsers;
      document.getElementById("stat-drivers").innerText = stats.totalDrivers;
      document.getElementById("stat-pending").innerText = stats.pendingVerifications;
      document.getElementById("stat-revenue").innerText = `$${stats.totalRevenue}`;
    } catch (err) {
      console.warn("Could not fetch stats:", err);
    }
  },

  async loadVerifications() {
    const container = document.getElementById("admin-verifications-container");
    if (!container) return;

    try {
      const pending = await AdminService.getPendingVerifications();

      if (!pending || pending.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "Verification queue is empty",
          description: "All registered drivers and equipment owners have been reviewed.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div class="grid-2">
          ${pending.map((user) => `
            <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-lg); background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <div style="font-weight: 800; font-size: 1.1rem;">${user.full_name}</div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">${user.email} • ${user.phone || user.phone_number || "No Phone"}</div>
                </div>
                <span class="badge badge-warning">${user.role.toUpperCase()}</span>
              </div>

              <div style="margin-bottom: 1rem; font-size: 0.85rem; background: var(--bg-subtle); padding: 0.75rem; border-radius: var(--radius-md);">
                <strong>Vehicles Added:</strong> ${user.vehicles?.length || 0}
                ${user.vehicles?.map((v) => `<div style="margin-top: 0.25rem;">• ${v.make} ${v.model} (${v.registration_number})</div>`).join("") || ""}
              </div>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button class="btn btn-danger btn-sm btn-reject-driver" data-user-id="${user.id}">
                  Reject
                </button>
                <button class="btn btn-primary btn-sm btn-approve-driver" data-user-id="${user.id}">
                  ✓ Approve Driver
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-approve-driver").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const uid = e.currentTarget.getAttribute("data-user-id");
          if (confirm("Approve this driver to go online and receive live passenger & freight requests?")) {
            await AdminService.updateVerificationStatus(uid, "approved");
            alert("Driver approved successfully!");
            this.loadVerifications();
            this.loadStats();
          }
        });
      });

      container.querySelectorAll(".btn-reject-driver").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const uid = e.currentTarget.getAttribute("data-user-id");
          const reason = prompt("Enter rejection reason for the driver:");
          if (reason) {
            await AdminService.updateVerificationStatus(uid, "rejected", reason);
            alert("Driver rejected.");
            this.loadVerifications();
            this.loadStats();
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Database Ready",
        description: "Driver verification records will appear here as drivers register.",
        icon: "inbox"
      });
    }
  },

  async loadTransactions() {
    const container = document.getElementById("admin-transactions-container");
    if (!container) return;

    try {
      const txns = await AdminService.getPaymentTransactions();

      if (!txns || txns.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No transactions recorded yet",
          description: "All Paynow payment transactions and subscription settlements will be logged here.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border-light); text-align: left;">
                <th style="padding: 0.75rem;">Reference</th>
                <th style="padding: 0.75rem;">User</th>
                <th style="padding: 0.75rem;">Amount</th>
                <th style="padding: 0.75rem;">Provider</th>
                <th style="padding: 0.75rem;">Status</th>
                <th style="padding: 0.75rem;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map((t) => `
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 0.75rem; font-family: monospace;">${t.internal_reference}</td>
                  <td style="padding: 0.75rem;">${t.user?.full_name || t.user?.email || "User"}</td>
                  <td style="padding: 0.75rem; font-weight: 700;">$${t.amount} ${t.currency}</td>
                  <td style="padding: 0.75rem;">${t.payment_provider}</td>
                  <td style="padding: 0.75rem;">
                    <span class="badge ${t.payment_status === "paid" ? "badge-success" : "badge-warning"}">
                      ${t.payment_status}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; color: var(--text-muted);">${new Date(t.created_at).toLocaleDateString()}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "No transactions",
        description: "Payment records will appear here.",
        icon: "inbox"
      });
    }
  },

  async loadAds() {
    const container = document.getElementById("admin-ads-container");
    if (!container) return;

    try {
      const campaigns = await AdvertisingService.getAllCampaignsForAdmin();

      if (!campaigns || campaigns.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No ad campaigns submitted yet",
          description: "Commercial ad campaigns created by businesses will appear here for review & approval.",
          icon: "inbox"
        });
        return;
      }

      container.innerHTML = `
        <div class="grid-2">
          ${campaigns.map((ad) => `
            <div style="border: 1px solid var(--border-light); padding: 1.25rem; border-radius: var(--radius-lg); background: var(--bg-surface);">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <div>
                  <div style="font-weight: 800; font-size: 1.1rem;">${ad.company_name || ad.title}</div>
                  <div style="font-size: 0.85rem; color: var(--text-muted);">${ad.advertiser?.email || "Advertiser"} • ${ad.placement}</div>
                </div>
                <span class="badge ${ad.status === "approved" ? "badge-success" : ad.status === "pending_review" ? "badge-warning" : "badge-neutral"}">
                  ${ad.status.toUpperCase()}
                </span>
              </div>

              <div style="font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--text-main);">
                <strong>Title:</strong> ${ad.title}<br/>
                <span style="font-size: 0.85rem; color: var(--text-muted);">${ad.description || ""}</span>
              </div>

              <div style="display: flex; gap: 1.5rem; font-size: 0.85rem; background: var(--bg-subtle); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                <div><strong>Budget:</strong> $${ad.budget || 0}</div>
                <div><strong>Impressions:</strong> ${ad.impressions || 0}</div>
                <div><strong>Clicks:</strong> ${ad.clicks || 0}</div>
              </div>

              <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                ${ad.status === "pending_review" || ad.status === "paused" || ad.status === "rejected" ? `
                  <button class="btn btn-primary btn-sm btn-approve-ad" data-id="${ad.id}">Approve &amp; Activate</button>
                ` : ""}
                ${ad.status === "approved" ? `
                  <button class="btn btn-outline btn-sm btn-pause-ad" data-id="${ad.id}">Pause</button>
                ` : ""}
                ${ad.status !== "rejected" ? `
                  <button class="btn btn-danger btn-sm btn-reject-ad" data-id="${ad.id}">Reject</button>
                ` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      `;

      container.querySelectorAll(".btn-approve-ad").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          try {
            await AdvertisingService.updateCampaignStatus(id, "approved");
            alert("Campaign approved and set to ACTIVE!");
            this.loadAds();
          } catch (err) {
            alert("Error approving campaign: " + err.message);
          }
        });
      });

      container.querySelectorAll(".btn-pause-ad").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          try {
            await AdvertisingService.updateCampaignStatus(id, "paused");
            alert("Campaign paused.");
            this.loadAds();
          } catch (err) {
            alert("Error pausing campaign: " + err.message);
          }
        });
      });

      container.querySelectorAll(".btn-reject-ad").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.getAttribute("data-id");
          const reason = prompt("Enter rejection reason for advertiser:");
          if (!reason) return;
          try {
            await AdvertisingService.updateCampaignStatus(id, "rejected", reason);
            alert("Campaign rejected.");
            this.loadAds();
          } catch (err) {
            alert("Error rejecting campaign: " + err.message);
          }
        });
      });
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Advertising Platform Ready",
        description: "Ad campaigns will appear here for review.",
        icon: "inbox"
      });
    }
  },

  async loadSocialSettings() {
    try {
      const config = await SocialService.getSocialConfig();
      if (config.links.facebook) document.getElementById("adm-fb-url").value = config.links.facebook;
      if (config.links.instagram) document.getElementById("adm-ig-url").value = config.links.instagram;
      if (config.links.tiktok) document.getElementById("adm-tt-url").value = config.links.tiktok;
      if (config.links.x) document.getElementById("adm-x-url").value = config.links.x;
      if (config.links.youtube) document.getElementById("adm-yt-url").value = config.links.youtube;
      if (config.whatsapp) document.getElementById("adm-wa-num").value = config.whatsapp;
    } catch (err) {
      console.warn("Could not fetch social settings:", err.message);
    }
  }
};
