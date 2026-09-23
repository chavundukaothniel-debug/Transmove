// ==============================================================================
// TRANSMOVE ROLE-AWARE NAVBAR COMPONENT
// ==============================================================================
import { getSupabaseCredentials } from "../config/supabase.js";
import { Modal } from "./Modal.js";
import { saveSupabaseCredentials } from "../config/supabase.js";
import { ThemeService } from "../services/theme.js";
import { icon } from "./Icon.js";

export function renderNavbar(currentProfile, currentRoute) {
  const isAuth = Boolean(currentProfile);
  const role = currentProfile?.role || "guest";
  const isAdmin = role === "admin";
  const { isConfigured } = getSupabaseCredentials();
  const currentTheme = ThemeService.getTheme();

  return `
    <nav class="navbar">
      <div class="navbar-inner">
        <a href="#home" id="brand-logo-stealth" class="brand-logo" title="TransMove Marketplace" style="display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none;">
          <img src="/assets/images/logo.png" alt="TransMove Logo" style="height: 32px; width: 32px; object-fit: contain; border-radius: 6px;" />
          <span>Trans<span style="color: #10b981;">Move</span></span>
        </a>

        <div class="nav-links">
          <a href="#home" class="nav-link ${currentRoute === "home" ? "active" : ""}">Marketplace</a>
          <a href="#machinery" class="nav-link ${(currentRoute === "machinery" || currentRoute === "equipment") ? "active" : ""}">Machinery</a>
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
              ${icon("shield-check", 17)}<span>Admin</span>
            </a>
          ` : ""}
        </div>

        <div class="nav-actions">
          <button id="btn-theme-toggle" class="btn btn-outline btn-sm" title="Toggle Light/Dark Theme" style="display: flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.65rem;">
          ${currentTheme === "dark" ? `${icon("sun", 17)}<span>Light</span>` : `${icon("moon", 17)}<span>Dark</span>`}
          </button>

          ${!isConfigured ? `
            <button id="btn-quick-setup-supabase" class="btn btn-sm" style="background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; font-weight: 700;">
          ${icon("database", 17)}<span>Connect DB</span>
            </button>
          ` : ""}

          ${isAuth ? `
            <span class="badge ${role === "driver" ? "badge-success" : role === "admin" ? "badge-danger" : "badge-info"}">
              ${role.toUpperCase()}
            </span>
            <a href="#profile" class="btn btn-outline btn-sm">
              ${icon("user-round", 17)}<span>${currentProfile.full_name?.split(" ")[0] || "Profile"}</span>
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
          ${icon("plug-zap", 18)}<span>Save &amp; Connect Live Database</span>
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
