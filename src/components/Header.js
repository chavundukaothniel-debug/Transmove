// ==============================================================================
// TRANSMOVE CLEAN APPLICATION TOP BAR COMPONENT
// Simplified & clutter-free to match the production reference design
// Includes Global Dark Mode Toggle & Role-Sensitive Guest/Auth Controls
// ==============================================================================
import { NotificationService } from "../services/notifications.js";
import { ThemeService } from "../services/theme.js";
import { Modal } from "./Modal.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ROLE_LABELS = {
  customer: "Passenger",
  passenger: "Passenger",
  driver: "Driver",
  cargo_owner: "Cargo Owner",
  logistics: "Logistics Provider",
  logistics_provider: "Logistics Provider",
  vehicle_owner: "Vehicle Owner",
  machinery_owner: "Machinery Owner",
  machinery_hirer: "Machinery Hirer",
  owner: "Owner",
  business: "Business",
  business_admin: "Business",
  advertiser: "Advertiser",
  admin: "Administrator"
};

// Only the passenger dashboard has a dedicated notifications tab; other roles land on their dashboard.
const NOTIFICATION_TARGETS = {
  driver: "#driver",
  cargo_owner: "#cargo-owner",
  logistics: "#logistics",
  logistics_provider: "#logistics",
  vehicle_owner: "#vehicle-owner",
  machinery_owner: "#machinery-owner",
  machinery_hirer: "#machinery-hirer",
  owner: "#owner",
  business: "#business",
  business_admin: "#business",
  advertiser: "#advertise",
  admin: "#admin"
};

let unreadPollTimer = null;

export function initHeaderNotifications(currentProfile) {
  if (unreadPollTimer) {
    clearInterval(unreadPollTimer);
    unreadPollTimer = null;
  }

  // Guests do NOT poll or show private notifications
  if (!currentProfile) {
    const dot = document.querySelector("#btn-header-notifications .icon-badge-dot");
    if (dot) dot.style.display = "none";
    return;
  }

  const refreshUnreadDot = async () => {
    const dot = document.querySelector("#btn-header-notifications .icon-badge-dot");
    if (!dot) return;
    try {
      const userId = currentProfile.user_id || currentProfile.$id || currentProfile.id;
      const notifications = await NotificationService.getNotifications(userId);
      const unreadCount = (notifications || []).filter((n) => !n.is_read).length;
      dot.style.display = unreadCount > 0 ? "block" : "none";
    } catch (err) {
      console.warn("Unread notification check:", err.message);
      dot.style.display = "none";
    }
  };

  refreshUnreadDot();
  unreadPollTimer = setInterval(refreshUnreadDot, 45000);

  const notifBtn = document.getElementById("btn-header-notifications");
  const isPassenger = ["customer", "passenger"].includes(currentProfile?.role);
  if (notifBtn && !isPassenger) {
    notifBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      const userId = currentProfile.user_id || currentProfile.$id || currentProfile.id;
      try {
        const list = await NotificationService.getNotifications(userId);
        const content = !list || list.length === 0
          ? `<div style="padding: 2rem; text-align: center; color: var(--text-muted);">No new notifications.</div>`
          : `
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 380px; overflow-y: auto;">
              ${list.map((n) => `
                <div style="padding: 0.75rem 1rem; border-radius: 6px; border: 1px solid var(--border-light); background: ${n.is_read ? "var(--bg-surface)" : "var(--bg-subtle)"};">
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(n.title)}</div>
                  <div style="font-size: 0.825rem; color: var(--text-muted); margin-top: 0.2rem;">${escapeHtml(n.body)}</div>
                  <div style="font-size: 0.7rem; color: var(--text-subtle); margin-top: 0.25rem;">${n.created_at ? new Date(n.created_at).toLocaleString() : ""}</div>
                </div>
              `).join("")}
            </div>
          `;
        Modal.open("🔔 Notifications", content);
        await Promise.all((list || []).filter(n => !n.is_read).map(n => NotificationService.markAsRead(n.id)));
        refreshUnreadDot();
      } catch (err) {
        Modal.open("🔔 Notifications", `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">Could not load notifications: ${escapeHtml(err.message)}</div>`);
      }
    });
  }
}

export const headerIcon = (name, size = 22) => {
  const paths = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9Z"/>',
    chevron: '<path d="m9 10 3 3 3-3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ""}</svg>`;
};

export function renderHeader(currentProfile, currentRoute) {
  const isAuth = Boolean(currentProfile);
  const isPassengerDashboard = ["customer", "passenger"].includes(currentProfile?.role) || currentRoute === "customer";
  const passengerTab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");
  const currentTheme = ThemeService.getCurrentTheme();

  const routeTitles = {
    home: "Marketplace",
    equipment: "Machinery & Equipment Marketplace",
    business: "Business & Enterprise Logistics",
    subscriptions: "Subscription Plans",
    advertise: "Advertise on TransMove",
    support: "Help & Support",
    help: "Help & Support",
    safety: "Help & Support",
    status: "Help & Support",
    driver: "Dashboard",
    customer: "Passenger Dashboard",
    cargo_owner: "Cargo Owner Dashboard",
    logistics: "Logistics Dashboard",
    vehicle_owner: "Vehicle Owner Dashboard",
    machinery_owner: "Machinery Owner Dashboard",
    machinery_hirer: "Machinery Hirer Dashboard",
    admin: "Admin Dashboard",
    profile: "Profile & Settings",
    messages: "Messages"
  };

  const passengerTitles = {
    search: "Post a New Request",
    quotes: "Request Details",
    bookings: "My Bookings",
    "booking-details": "Booking Details",
    payments: "Payments",
    favourites: "Saved Drivers",
    notifications: "Notifications"
  };

  const passengerRouteTitles = {
    customer: "Passenger Dashboard",
    messages: "Messages",
    profile: "My Profile",
    support: "Help & Support",
    help: "Help & Support",
    safety: "Help & Support",
    status: "Help & Support"
  };

  const pageTitle = currentRoute === "customer" && passengerTab
    ? (passengerTitles[passengerTab] || routeTitles[currentRoute])
    : (isPassengerDashboard ? (passengerRouteTitles[currentRoute] || routeTitles[currentRoute] || "Dashboard") : (routeTitles[currentRoute] || "Dashboard"));

  const avatarPhotoUrl = currentProfile?.profile_photo_url || null;
  const initial = currentProfile?.full_name ? escapeHtml(currentProfile.full_name.charAt(0).toUpperCase()) : "U";
  const roleLabel = ROLE_LABELS[currentProfile?.role]
    || (currentProfile?.role ? escapeHtml(currentProfile.role.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase())) : "Passenger");
  const notificationTarget = isPassengerDashboard
    ? "#customer?tab=notifications"
    : (currentProfile ? (NOTIFICATION_TARGETS[currentProfile.role] || "#home") : "#login");

  return `
    <header class="app-header ${isPassengerDashboard ? "app-header--passenger" : ""}" style="height: 60px; background: var(--bg-surface); border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; position: sticky; top: 0; z-index: 40; transition: background 0.15s ease, border-color 0.15s ease;">
      <div class="header-left" style="display: flex; align-items: center; gap: 1rem;">
        <button id="btn-mobile-sidebar-trigger" class="btn-mobile-menu" aria-label="Toggle navigation menu" style="background: transparent; border: none; cursor: pointer; color: var(--text-main);">
          ${headerIcon("menu", 25)}
        </button>
        <h1 class="header-page-title" style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0;">${pageTitle}</h1>
      </div>

      <div class="header-right" style="display: flex; align-items: center; gap: 0.75rem;">
        <!-- Global Dark Mode Toggle (Available for Guest & Authenticated) -->
        <button id="btn-theme-toggle" class="header-icon-btn btn-theme-toggle" title="${currentTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}" aria-label="Toggle dark mode" style="background: transparent; border: none; cursor: pointer; padding: 0.4rem; display: flex; align-items: center; justify-content: center; color: var(--text-main); border-radius: 6px; transition: background 0.15s ease;">
          ${currentTheme === "dark" ? headerIcon("sun", 20) : headerIcon("moon", 20)}
        </button>

        ${isAuth ? `
          <!-- Notifications (Private - Authenticated only) -->
          <a href="${notificationTarget}" id="btn-header-notifications" class="header-icon-btn" title="Notifications" aria-label="Notifications" style="background: transparent; border: none; cursor: pointer; position: relative; padding: 0.35rem; text-decoration: none; color: var(--text-main);">
            ${isPassengerDashboard ? headerIcon("bell", 24) : "🔔"}
            <span class="icon-badge-dot" style="position: absolute; top: 2px; right: 2px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444; display: none;"></span>
          </a>

          <!-- Messages Link (Private - Authenticated only) -->
          <a href="#messages" class="header-icon-btn header-messages-link" title="Messages" style="background: transparent; border: none; font-size: 1.15rem; cursor: pointer; text-decoration: none; padding: 0.35rem; color: var(--text-main);">
            ${isPassengerDashboard ? headerIcon("message", 22) : "💬"}
          </a>

          <!-- Profile Avatar & User Pill -->
          <a href="#profile" style="display: flex; align-items: center; gap: 0.65rem; text-decoration: none; padding: 0.25rem 0.5rem; border-radius: 8px; transition: background 0.15s ease;" title="Account Profile">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; overflow: hidden; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              ${avatarPhotoUrl ? `<img src="${avatarPhotoUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span>${initial}</span>`}
            </div>
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span style="font-size: 0.875rem; font-weight: 800; color: var(--text-main); line-height: 1.2;">${escapeHtml(currentProfile?.full_name) || "User"}</span>
              <span style="font-size: 0.725rem; color: var(--text-muted); font-weight: 500;">${roleLabel}</span>
            </div>
            <span class="header-profile-chevron" style="color: var(--text-muted); margin-left: 0.15rem;">${headerIcon("chevron", 16)}</span>
          </a>
        ` : `
          <!-- Guest Navigation Actions -->
          <a href="#login" class="btn btn-outline btn-sm" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">Sign In</a>
          <a href="#register" class="btn btn-primary btn-sm" style="font-size: 0.85rem; padding: 0.4rem 0.85rem;">Register</a>
        `}
      </div>
    </header>
  `;
}
