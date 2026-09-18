// ==============================================================================
// TRANSMOVE UNIFIED LOCKED DESIGN SYSTEM — LEFT SIDEBAR COMPONENT
// Approved Professional Dark Navy/Blue Treatment (#0f172a)
// Dynamic Role Navigation & Collapse Toggle
// ==============================================================================

const sidebarIcon = (name) => {
  const paths = {
    dashboard: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20M7 15h2"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.4 1-1.4 2.3M12 17h.01"/>',
    logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/>'
  };

  return `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
};

export function renderSidebar(currentProfile, currentRoute, isCollapsed = false) {
  // Determine active viewing role from currentRoute
  const routeToRoleMap = {
    customer: "customer",
    passenger: "customer",
    driver: "driver",
    cargo_owner: "cargo_owner",
    logistics: "logistics_provider",
    vehicle_owner: "vehicle_owner",
    machinery_owner: "machinery_owner",
    machinery_hirer: "machinery_hirer",
    business: "business",
    advertise: "advertiser",
    admin: "admin"
  };

  const activeRole = routeToRoleMap[currentRoute] || currentProfile?.role || "guest";
  
  // Define role navigation mappings aligned strictly with TransMove exact spec
  const roleNavItems = {
    customer: [
      { route: "customer", label: "Dashboard", icon: sidebarIcon("dashboard") },
      { route: "customer?tab=search", label: "Find Transport", icon: sidebarIcon("search") },
      { route: "customer?tab=bookings", label: "My Bookings", icon: sidebarIcon("calendar") },
      { route: "customer?tab=favourites", label: "Favourites", icon: sidebarIcon("heart") },
      { route: "messages", label: "Messages", icon: sidebarIcon("message") },
      { route: "customer?tab=payments", label: "Payments", icon: sidebarIcon("card") },
      { route: "profile", label: "Profile", icon: sidebarIcon("user") },
      { route: "support", label: "Help", icon: sidebarIcon("help") }
    ],
    driver: [
      { route: "driver", label: "Dashboard", icon: "📊" },
      { route: "driver?tab=available", label: "Available Jobs", icon: "📡" },
      { route: "driver?tab=offers", label: "My Jobs", icon: "📦" },
      { route: "driver?tab=vehicles", label: "Vehicles", icon: "🚘" },
      { route: "driver?tab=earnings", label: "Earnings", icon: "💰" },
      { route: "subscriptions", label: "Subscription", icon: "💳" },
      { route: "profile", label: "Profile", icon: "👤" },
      { route: "support", label: "Help", icon: "❓" }
    ],
    cargo_owner: [
      { route: "cargo_owner", label: "Dashboard", icon: "📊" },
      { route: "cargo_owner?tab=create", label: "Create Cargo Request", icon: "📦" },
      { route: "cargo_owner?tab=requests", label: "My Cargo Requests", icon: "📋" },
      { route: "cargo_owner?tab=offers", label: "Offers", icon: "🏷️" },
      { route: "cargo_owner?tab=deliveries", label: "Active Deliveries", icon: "🚚" },
      { route: "cargo_owner?tab=history", label: "Delivery History", icon: "📜" },
      { route: "cargo_owner?tab=payments", label: "Payments", icon: "💳" },
      { route: "cargo_owner?tab=invoices", label: "Invoices", icon: "📄" },
      { route: "messages", label: "Messages", icon: "💬" },
      { route: "cargo_owner?tab=ratings", label: "Ratings", icon: "⭐" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    logistics_provider: [
      { route: "logistics", label: "Dashboard", icon: "📊" },
      { route: "logistics?tab=cargo", label: "Available Cargo", icon: "📦" },
      { route: "logistics?tab=deliveries", label: "Active Deliveries", icon: "🚛" },
      { route: "logistics?tab=fleet", label: "Fleet", icon: "👥" },
      { route: "logistics?tab=drivers", label: "Drivers", icon: "🧑‍✈️" },
      { route: "logistics?tab=earnings", label: "Earnings", icon: "💰" },
      { route: "logistics?tab=wallet", label: "Wallet", icon: "👛" },
      { route: "logistics?tab=documents", label: "Documents", icon: "📁" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    vehicle_owner: [
      { route: "vehicle_owner", label: "Dashboard", icon: "📊" },
      { route: "vehicle_owner?tab=vehicles", label: "My Vehicles", icon: "🚗" },
      { route: "vehicle_owner?tab=add", label: "Add Vehicle", icon: "➕" },
      { route: "vehicle_owner?tab=requests", label: "Booking Requests", icon: "📑" },
      { route: "vehicle_owner?tab=rentals", label: "Active Rentals", icon: "🔑" },
      { route: "vehicle_owner?tab=earnings", label: "Earnings", icon: "💰" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    machinery_owner: [
      { route: "machinery_owner", label: "Dashboard", icon: "📊" },
      { route: "machinery_owner?tab=machinery", label: "My Machinery", icon: "🚜" },
      { route: "machinery_owner?tab=add", label: "Add Machinery", icon: "➕" },
      { route: "machinery_owner?tab=requests", label: "Rental Requests", icon: "📋" },
      { route: "machinery_owner?tab=rentals", label: "Active Rentals", icon: "⚙️" },
      { route: "machinery_owner?tab=earnings", label: "Earnings", icon: "💰" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    machinery_hirer: [
      { route: "machinery_hirer", label: "Dashboard", icon: "📊" },
      { route: "machinery_hirer?tab=find", label: "Find Machinery", icon: "🔍" },
      { route: "machinery_hirer?tab=requests", label: "My Requests", icon: "📋" },
      { route: "machinery_hirer?tab=rentals", label: "Active Rentals", icon: "🚜" },
      { route: "machinery_hirer?tab=history", label: "History", icon: "📜" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    business: [
      { route: "business", label: "Dashboard", icon: "📊" },
      { route: "business?tab=transport", label: "Request Transport", icon: "🚗" },
      { route: "business?tab=deliveries", label: "Cargo Deliveries", icon: "🚚" },
      { route: "business?tab=employees", label: "Employees", icon: "👥" },
      { route: "business?tab=fleet", label: "Fleet", icon: "🚛" },
      { route: "business?tab=invoices", label: "Invoices", icon: "📄" },
      { route: "business?tab=financials", label: "Financials", icon: "💰" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    advertiser: [
      { route: "advertise", label: "Dashboard", icon: "📊" },
      { route: "advertise?tab=create", label: "Create Campaign", icon: "➕" },
      { route: "advertise?tab=campaigns", label: "My Campaigns", icon: "📢" },
      { route: "advertise?tab=performance", label: "Performance", icon: "📈" },
      { route: "advertise?tab=billing", label: "Billing", icon: "💳" },
      { route: "support", label: "Support", icon: "🎧" },
      { route: "profile", label: "Settings", icon: "⚙️" }
    ],
    admin: [
      { route: "admin", label: "Dashboard", icon: "📊" },
      { route: "admin?tab=operations", label: "Live Operations", icon: "⚡" },
      { route: "admin?tab=users", label: "User Management", icon: "👥" },
      { route: "admin?tab=verification", label: "Verification Queue", icon: "🛡️" },
      { route: "admin?tab=vehicles", label: "Vehicle Verification", icon: "🚘" },
      { route: "admin?tab=machinery", label: "Machinery Verification", icon: "🚜" },
      { route: "admin?tab=trips", label: "Trip Monitor", icon: "🗺️" },
      { route: "admin?tab=payments", label: "Payments", icon: "💳" },
      { route: "subscriptions", label: "Subscriptions", icon: "⭐" },
      { route: "admin?tab=ads", label: "Ads", icon: "📢" },
      { route: "support", label: "Support Tickets", icon: "🎧" },
      { route: "admin?tab=disputes", label: "Disputes", icon: "⚖️" },
      { route: "admin?tab=settings", label: "System Settings", icon: "⚙️" }
    ]
  };

  const guestNavItems = [
    { route: "home", label: "Marketplace", icon: "🌐" },
    { route: "equipment", label: "Machinery & Freight", icon: "🚜" },
    { route: "business", label: "Business", icon: "🏢" },
    { route: "subscriptions", label: "Pricing & Plans", icon: "💳" },
    { route: "advertise", label: "Advertise", icon: "📢" },
    { route: "support", label: "Support & Help", icon: "🎧" },
    { route: "login", label: "Sign In", icon: "🔑" },
    { route: "register", label: "Create Account", icon: "📝" }
  ];

  const navItems = (currentProfile && roleNavItems[activeRole]) ? roleNavItems[activeRole] : guestNavItems;

  return `
    <aside class="app-sidebar ${activeRole === "customer" ? "app-sidebar--passenger" : ""} ${isCollapsed ? "collapsed" : ""}" id="app-sidebar">
      <div class="sidebar-header" style="flex-direction: column; align-items: flex-start; justify-content: center; height: auto; padding: 1.25rem 1.25rem 1rem 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <a href="#home" class="sidebar-brand" title="TransMove Platform" style="display: flex; align-items: center; gap: 0.6rem; font-size: 1.35rem; font-weight: 900; color: #ffffff; text-decoration: none;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${activeRole === "customer" ? "#1684ff" : "#059669"}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
            <span class="brand-text" style="letter-spacing: -0.02em;">Trans<span style="color: ${activeRole === "customer" ? "#1684ff" : "#059669"};">Move</span></span>
          </a>

          <button type="button" id="btn-toggle-sidebar" class="btn-sidebar-toggle" title="Collapse / Expand Sidebar">
            ${isCollapsed ? "❯" : "❮"}
          </button>
        </div>
        <div class="brand-text" style="font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem; font-weight: 500;">
          People. Goods. Opportunities.
        </div>
      </div>

      <div class="sidebar-role-tag">
        <span class="role-dot"></span>
        <span class="role-name">${(currentProfile ? activeRole : "guest").toUpperCase().replace("_", " ")}</span>
      </div>

      <nav class="sidebar-nav">
        ${navItems.map((item) => {
          const currentHash = (window.location.hash || "").replace(/^#/, "");
          let isActive = false;
          if (item.route.includes("?")) {
            isActive = currentHash === item.route;
          } else {
            isActive = (currentHash === item.route) || (!currentHash.includes("?") && currentRoute === item.route);
          }
          return `
            <a href="#${item.route}" class="sidebar-link ${isActive ? "active" : ""}">
              <span class="link-icon">${item.icon}</span>
              <span class="link-text">${item.label}</span>
            </a>
          `;
        }).join("")}

        ${currentProfile ? `
          <a href="#logout" id="btn-sidebar-logout" class="sidebar-link" style="margin-top: auto; color: #94a3b8; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.75rem; margin-top: 1rem;">
            <span class="link-icon">${activeRole === "customer" ? sidebarIcon("logout") : "🚪"}</span>
            <span class="link-text">Logout</span>
          </a>
        ` : ""}
      </nav>

      <div class="sidebar-footer">
        <a href="${currentProfile ? "#profile" : "#login"}" class="sidebar-user-card" title="${currentProfile ? "Manage Account" : "Click to Sign In"}">
          <div class="user-avatar">
            ${currentProfile?.full_name ? currentProfile.full_name.charAt(0).toUpperCase() : "👤"}
          </div>
          <div class="user-info">
            <div class="user-name">${currentProfile?.full_name || "Guest Account"}</div>
            <div class="user-email">${currentProfile?.email || "Click to Sign In"}</div>
          </div>
        </a>
        <div class="brand-text" style="padding: 0.75rem 0.5rem 0.25rem 0.5rem; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 1.1rem;">🇿🇼</span>
          <div>
            <div style="font-weight: 700; color: #e2e8f0; font-size: 0.725rem;">Proudly Zimbabwean</div>
            <div style="font-size: 0.65rem; color: #64748b;">Driving a Better Tomorrow</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

