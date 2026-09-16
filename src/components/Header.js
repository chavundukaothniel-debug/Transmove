// ==============================================================================
// TRANSMOVE CLEAN APPLICATION TOP BAR COMPONENT
// Simplified & clutter-free to match the production reference design
// ==============================================================================

const headerIcon = (name, size = 22) => {
  const paths = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9Z"/>',
    chevron: '<path d="m9 10 3 3 3-3"/>'
  };

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

export function renderHeader(currentProfile, currentRoute) {
  const isAuth = Boolean(currentProfile);
  const isPassengerDashboard = ["customer", "passenger"].includes(currentProfile?.role) || currentRoute === "customer";
  const passengerTab = new URLSearchParams((window.location.hash.split("?")[1] || "")).get("tab");

  const routeTitles = {
    driver: "Dashboard",
    customer: "Passenger Dashboard",
    cargo_owner: "Cargo Owner Dashboard",
    logistics: "Logistics Dashboard",
    vehicle_owner: "Vehicle Owner Dashboard",
    admin: "Admin Dashboard",
    profile: "Profile & Settings",
    subscriptions: "Subscription Plans",
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
  const initial = currentProfile?.full_name ? currentProfile.full_name.charAt(0).toUpperCase() : "D";

  return `
    <header class="app-header ${isPassengerDashboard ? "app-header--passenger" : ""}" style="height: 60px; background: #ffffff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 1.5rem; position: sticky; top: 0; z-index: 40;">
      <div class="header-left" style="display: flex; align-items: center; gap: 1rem;">
        <button id="btn-mobile-sidebar-trigger" class="btn-mobile-menu" aria-label="Toggle navigation menu" style="background: transparent; border: none; cursor: pointer;">
          ${headerIcon("menu", 25)}
        </button>
        <h1 class="header-page-title" style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0;">${pageTitle}</h1>
      </div>

      <div class="header-right" style="display: flex; align-items: center; gap: 1rem;">
        <!-- Notifications -->
        <${isPassengerDashboard ? 'a href="#customer?tab=notifications"' : 'button'} id="btn-header-notifications" class="header-icon-btn" title="Notifications" aria-label="Notifications" style="background: transparent; border: none; cursor: pointer; position: relative; padding: 0.35rem; text-decoration: none;">
          ${isPassengerDashboard ? headerIcon("bell", 24) : "🔔"}
          <span class="icon-badge-dot" style="position: absolute; top: 2px; right: 2px; width: 7px; height: 7px; border-radius: 50%; background: #ef4444;"></span>
        </${isPassengerDashboard ? "a" : "button"}>

        <!-- Messages link -->
        <a href="#messages" class="header-icon-btn header-messages-link" title="Messages" style="background: transparent; border: none; font-size: 1.15rem; cursor: pointer; text-decoration: none; padding: 0.35rem;">
          ${isPassengerDashboard ? headerIcon("message", 22) : "💬"}
        </a>

        <!-- Profile Avatar & User Pill -->
        ${isAuth ? `
          <a href="#profile" style="display: flex; align-items: center; gap: 0.65rem; text-decoration: none; padding: 0.25rem 0.5rem; border-radius: 8px; transition: background 0.15s ease;" title="Account Profile">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; overflow: hidden; flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              ${avatarPhotoUrl ? `<img src="${avatarPhotoUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span>${initial}</span>`}
            </div>
            <div style="display: flex; flex-direction: column; text-align: left;">
              <span style="font-size: 0.875rem; font-weight: 800; color: #0f172a; line-height: 1.2;">${currentProfile?.full_name || "Passenger"}</span>
              <span style="font-size: 0.725rem; color: #64748b; font-weight: 500;">Passenger</span>
            </div>
            <span class="header-profile-chevron" style="color: #64748b; margin-left: 0.15rem;">${headerIcon("chevron", 16)}</span>
          </a>
        ` : `
          <a href="#login" class="btn btn-outline btn-sm" style="font-size: 0.85rem;">Sign In</a>
        `}
      </div>
    </header>
  `;
}
