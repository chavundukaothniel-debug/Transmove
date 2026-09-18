// ==============================================================================
// TRANSMOVE ROLE-AWARE NAVBAR COMPONENT
// ==============================================================================
import { getSupabaseCredentials } from "../config/supabase.js";
import { Modal } from "./Modal.js";
import { saveSupabaseCredentials } from "../config/supabase.js";
import { ThemeService } from "../services/theme.js";

export function renderNavbar(currentProfile, currentRoute) {
  const isAuth = Boolean(currentProfile);
  const role = currentProfile?.role || "guest";
  const isAdmin = role === "admin";
  const { isConfigured } = getSupabaseCredentials();
  const currentTheme = ThemeService.getTheme();

  return `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="#home" id="brand-logo-stealth" class="brand-logo" title="TransMove Marketplace">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <path d="M9 17h6"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
          Trans<span>Move</span>
        </a>

        <div class="nav-links">
          <a href="#home" class="nav-link ${currentRoute === "home" ? "active" : ""}">Marketplace</a>
          <a href="#equipment" class="nav-link ${currentRoute === "equipment" ? "active" : ""}">Machinery &amp; Freight</a>
          <a href="#business" class="nav-link ${currentRoute === "business" ? "active" : ""}">Business</a>
          <a href="#subscriptions" class="nav-link ${currentRoute === "subscriptions" ? "active" : ""}">Plans</a>
          <a href="#advertise" class="nav-link ${currentRoute === "advertise" ? "active" : ""}">Advertise</a>

          ${isAuth && (role === "customer" || role === "admin") ? `
            <a href="#customer" class="nav-link ${currentRoute === "customer" ? "active" : ""}">Rides &amp; Cargo</a>
          ` : ""}

          ${isAuth && (role === "driver" || role === "admin") ? `
            <a href="#driver" class="nav-link ${currentRoute === "driver" ? "active" : ""}">Driver Portal</a>
          ` : ""}

          <a href="#support" class="nav-link ${currentRoute === "support" ? "active" : ""}">Support</a>
          <a href="#contact" class="nav-link ${currentRoute === "contact" ? "active" : ""}">Contact</a>

          ${isAuth ? `
            <a href="#messages" class="nav-link ${currentRoute === "messages" ? "active" : ""}">Chat</a>
          ` : ""}

          ${isAdmin ? `
            <a href="#admin" class="nav-link ${currentRoute === "admin" ? "active" : ""}" style="color: #ef4444; font-weight: 700;">
              🛡️ Admin
            </a>
          ` : ""}
        </div>

        <div class="nav-actions">
          <button id="btn-theme-toggle" class="btn btn-outline btn-sm" title="Toggle Light/Dark Theme" style="display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.65rem;">
            ${currentTheme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>

          ${!isConfigured ? `
            <button id="btn-quick-setup-supabase" class="btn btn-sm" style="background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; font-weight: 700;">
              ⚙️ Connect DB
            </button>
          ` : ""}

          ${isAuth ? `
            <span class="badge ${role === "driver" ? "badge-success" : role === "admin" ? "badge-danger" : "badge-info"}">
              ${role.toUpperCase()}
            </span>
            <a href="#profile" class="btn btn-outline btn-sm">
              👤 ${currentProfile.full_name?.split(" ")[0] || "Profile"}
            </a>
            <button id="btn-logout" class="btn btn-outline btn-sm">
              Sign Out
            </button>
          ` : `
            <a href="#login" class="btn btn-outline btn-sm">Sign In</a>
            <a href="#register" class="btn btn-primary btn-sm">Get Started</a>
          `}
        </div>
      </div>
    </nav>
  `;
}

export function openSupabaseConfigModal() {
  const { url, anonKey } = getSupabaseCredentials();

  Modal.open(
    "Connect Your Supabase Project",
    `
      <div>
        <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.4;">
          Paste your Supabase Project credentials below from your <strong>Supabase Dashboard &gt; Project Settings &gt; API</strong>:
        </p>

        <div class="form-group">
          <label class="form-label">Project URL</label>
          <input type="text" id="cfg-supa-url" class="form-input" value="${url.includes("your-project") ? "" : url}" placeholder="https://xyzcompany.supabase.co" required />
          <div class="form-hint">Example: <code>https://abcdefghijklm.supabase.co</code></div>
        </div>

        <div class="form-group">
          <label class="form-label">Anon / Public API Key</label>
          <input type="password" id="cfg-supa-key" class="form-input" value="${anonKey.includes("your-anon") ? "" : anonKey}" placeholder="eyJhbGciOiJIUzI1NiIsIn..." required />
          <div class="form-hint">Found under 'Project API keys' (anon, public)</div>
        </div>

        <button id="btn-save-supa-cfg" class="btn btn-primary btn-full" style="margin-top: 0.5rem;">
          Save &amp; Connect Live Database ⚡
        </button>
      </div>
    `
  );

  document.getElementById("btn-save-supa-cfg")?.addEventListener("click", () => {
    const u = document.getElementById("cfg-supa-url")?.value?.trim();
    const k = document.getElementById("cfg-supa-key")?.value?.trim();
    if (u && k && u.startsWith("https://")) {
      saveSupabaseCredentials(u, k);
    } else {
      alert("Please enter a valid Supabase Project URL (starting with https://) and your Anon Public Key.");
    }
  });
}
