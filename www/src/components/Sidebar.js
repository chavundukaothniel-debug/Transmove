// ==============================================================================
// TRANSMOVE UNIFIED LOCKED DESIGN SYSTEM — LEFT SIDEBAR COMPONENT
// Approved Professional Dark Navy/Blue Treatment (#0f172a)
// Dynamic Role Navigation & Collapse Toggle
// ==============================================================================

import { icon } from "./Icon.js";
import { resolveAvatarUrl, avatarInitials } from "../utils/avatar.js";

const sidebarIcon = (name, size = 21) => icon(name, size);

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
      { route: "customer", label: "Dashboard", icon: "layout-dashboard" },
      { route: "customer?tab=search", label: "Find Transport", icon: "search" },
      { route: "customer?tab=bookings", label: "My Bookings", icon: "calendar-days" },
      { route: "customer?tab=favourites", label: "Favourites", icon: "heart" },
      { route: "messages", label: "Messages", icon: "message-circle" },
      { route: "customer?tab=payments", label: "Payments", icon: "credit-card" },
      { route: "profile", label: "Profile", icon: "user-round" },
      { route: "support", label: "Help", icon: "circle-help" }
    ],
    driver: [
      { route: "driver", label: "Dashboard", icon: "layout-dashboard" },
      { route: "driver?tab=available", label: "Available Jobs", icon: "radio-tower" },
      { route: "driver?tab=offers", label: "My Jobs", icon: "briefcase-business" },
      { route: "driver?tab=vehicles", label: "Vehicles", icon: "car-front" },
      { route: "driver?tab=earnings", label: "Earnings", icon: "wallet-cards" },
      { route: "subscriptions", label: "Subscription", icon: "credit-card" },
      { route: "profile", label: "Profile", icon: "user-round" },
      { route: "support", label: "Help", icon: "circle-help" }
    ],
    cargo_owner: [
      { route: "cargo_owner", label: "Dashboard", icon: "layout-dashboard" },
      { route: "cargo_owner?tab=create", label: "Create Cargo Request", icon: "package-plus" },
      { route: "cargo_owner?tab=requests", label: "My Cargo Requests", icon: "clipboard-list" },
      { route: "cargo_owner?tab=offers", label: "Offers", icon: "tags" },
      { route: "cargo_owner?tab=deliveries", label: "Active Deliveries", icon: "truck" },
      { route: "cargo_owner?tab=history", label: "Delivery History", icon: "history" },
      { route: "cargo_owner?tab=payments", label: "Payments", icon: "credit-card" },
      { route: "cargo_owner?tab=invoices", label: "Invoices", icon: "file-text" },
      { route: "messages", label: "Messages", icon: "message-circle" },
      { route: "cargo_owner?tab=ratings", label: "Ratings", icon: "star" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    logistics_provider: [
      { route: "logistics", label: "Dashboard", icon: "layout-dashboard" },
      { route: "logistics?tab=cargo", label: "Available Cargo", icon: "package-search" },
      { route: "logistics?tab=deliveries", label: "Active Deliveries", icon: "truck" },
      { route: "logistics?tab=fleet", label: "Fleet", icon: "car-front" },
      { route: "logistics?tab=drivers", label: "Drivers", icon: "users-round" },
      { route: "logistics?tab=earnings", label: "Earnings", icon: "wallet-cards" },
      { route: "logistics?tab=wallet", label: "Wallet", icon: "wallet" },
      { route: "logistics?tab=documents", label: "Documents", icon: "folder-open" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    vehicle_owner: [
      { route: "vehicle_owner", label: "Dashboard", icon: "layout-dashboard" },
      { route: "vehicle_owner?tab=vehicles", label: "My Vehicles", icon: "car-front" },
      { route: "vehicle_owner?tab=add", label: "Add Vehicle", icon: "circle-plus" },
      { route: "vehicle_owner?tab=requests", label: "Booking Requests", icon: "notebook-tabs" },
      { route: "vehicle_owner?tab=rentals", label: "Active Rentals", icon: "key-round" },
      { route: "vehicle_owner?tab=earnings", label: "Earnings", icon: "wallet-cards" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    machinery_owner: [
      { route: "machinery_owner", label: "Dashboard", icon: "layout-dashboard" },
      { route: "machinery_owner?tab=machinery", label: "My Machinery", icon: "tractor" },
      { route: "machinery_owner?tab=add", label: "Add Machinery", icon: "circle-plus" },
      { route: "machinery_owner?tab=requests", label: "Rental Requests", icon: "clipboard-list" },
      { route: "machinery_owner?tab=rentals", label: "Active Rentals", icon: "cog" },
      { route: "machinery_owner?tab=earnings", label: "Earnings", icon: "wallet-cards" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    machinery_hirer: [
      { route: "machinery_hirer", label: "Dashboard", icon: "layout-dashboard" },
      { route: "machinery_hirer?tab=find", label: "Find Machinery", icon: "search" },
      { route: "machinery_hirer?tab=requests", label: "My Requests", icon: "clipboard-list" },
      { route: "machinery_hirer?tab=rentals", label: "Active Rentals", icon: "tractor" },
      { route: "machinery_hirer?tab=history", label: "History", icon: "history" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    business: [
      { route: "business", label: "Dashboard", icon: "layout-dashboard" },
      { route: "business?tab=transport", label: "Request Transport", icon: "car-front" },
      { route: "business?tab=deliveries", label: "Cargo Deliveries", icon: "truck" },
      { route: "business?tab=employees", label: "Employees", icon: "users-round" },
      { route: "business?tab=fleet", label: "Fleet", icon: "container" },
      { route: "business?tab=invoices", label: "Invoices", icon: "file-text" },
      { route: "business?tab=financials", label: "Financials", icon: "chart-no-axes-combined" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    advertiser: [
      { route: "advertise", label: "Dashboard", icon: "layout-dashboard" },
      { route: "advertise?tab=create", label: "Create Campaign", icon: "circle-plus" },
      { route: "advertise?tab=campaigns", label: "My Campaigns", icon: "megaphone" },
      { route: "advertise?tab=performance", label: "Performance", icon: "chart-no-axes-combined" },
      { route: "advertise?tab=billing", label: "Billing", icon: "credit-card" },
      { route: "support", label: "Support", icon: "headphones" },
      { route: "profile", label: "Settings", icon: "settings" }
    ],
    admin: [
      { route: "admin", label: "Dashboard", icon: "layout-dashboard" },
      { route: "admin?tab=operations", label: "Live Operations", icon: "zap" },
      { route: "admin?tab=users", label: "User Management", icon: "users-round" },
      { route: "admin?tab=verification", label: "Verification Queue", icon: "shield-check" },
      { route: "admin?tab=vehicles", label: "Vehicle Verification", icon: "car-front" },
      { route: "admin?tab=machinery", label: "Machinery Verification", icon: "tractor" },
      { route: "admin?tab=trips", label: "Trip Monitor", icon: "map" },
      { route: "admin?tab=payments", label: "Payments", icon: "credit-card" },
      { route: "subscriptions", label: "Subscriptions", icon: "star" },
      { route: "admin?tab=ads", label: "Ads", icon: "megaphone" },
      { route: "support", label: "Support Tickets", icon: "headphones" },
      { route: "admin?tab=disputes", label: "Disputes", icon: "scale" },
      { route: "admin?tab=settings", label: "System Settings", icon: "settings" }
    ]
  };

  const guestNavItems = [
    { route: "home", label: "Marketplace", icon: "globe-2" },
    { route: "equipment", label: "Machinery & Freight", icon: "tractor" },
    { route: "business", label: "Business", icon: "building-2" },
    { route: "subscriptions", label: "Pricing & Plans", icon: "credit-card" },
    { route: "advertise", label: "Advertise", icon: "megaphone" },
    { route: "support", label: "Support & Help", icon: "headphones" },
    { route: "login", label: "Sign In", icon: "key-round" },
    { route: "register", label: "Create Account", icon: "clipboard-pen-line" }
  ];

  const navItems = (currentProfile && roleNavItems[activeRole]) ? roleNavItems[activeRole] : guestNavItems;
  const avatarUrl = resolveAvatarUrl(currentProfile);
  const initials = avatarInitials(currentProfile?.full_name || "Guest Account");

  return `
    <aside class="app-sidebar ${activeRole === "customer" ? "app-sidebar--passenger" : ""} ${isCollapsed ? "collapsed" : ""}" id="app-sidebar">
      <div class="sidebar-header" style="flex-direction: column; align-items: flex-start; justify-content: center; height: auto; padding: 1.25rem 1.25rem 1rem 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <a href="#home" class="sidebar-brand" title="TransMove Platform" style="display: flex; align-items: center; gap: 0.6rem; font-size: 1.35rem; font-weight: 900; color: #ffffff; text-decoration: none;">
            <span style="color: #EF3340; display: inline-flex;">${icon("car-front", 32)}</span>
            <span class="brand-text" style="letter-spacing: -0.02em;">Trans<span style="color: #EF3340;">Move</span></span>
          </a>

          <button type="button" id="btn-toggle-sidebar" class="btn-sidebar-toggle" title="Collapse or expand sidebar" aria-label="${isCollapsed ? "Expand" : "Collapse"} sidebar">
            ${sidebarIcon(isCollapsed ? "chevron-right" : "chevron-left", 18)}
          </button>
          <button type="button" id="btn-close-mobile-sidebar" class="btn-close-mobile-sidebar" title="Close navigation" aria-label="Close navigation menu">
            ${sidebarIcon("x", 22)}
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
              <span class="link-icon">${sidebarIcon(item.icon)}</span>
              <span class="link-text">${item.label}</span>
            </a>
          `;
        }).join("")}

        ${currentProfile ? `
          <a href="#logout" id="btn-sidebar-logout" class="sidebar-link" style="margin-top: auto; color: #94a3b8; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.75rem; margin-top: 1rem;">
            <span class="link-icon">${sidebarIcon("log-out")}</span>
            <span class="link-text">Logout</span>
          </a>
        ` : ""}
      </nav>

      <div class="sidebar-footer">
        <a href="${currentProfile ? "#profile" : "#login"}" class="sidebar-user-card" title="${currentProfile ? "Manage Account" : "Click to Sign In"}">
          <div class="user-avatar">
            ${avatarUrl ? `<img src="${avatarUrl}" alt="" onerror="this.remove();this.parentElement.textContent='${initials}'">` : initials}
          </div>
          <div class="user-info">
            <div class="user-name">${currentProfile?.full_name || "Guest Account"}</div>
            <div class="user-email">${currentProfile?.email || "Click to Sign In"}</div>
          </div>
        </a>
        <div class="brand-text" style="padding: 0.75rem 0.5rem 0.25rem 0.5rem; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid rgba(255, 255, 255, 0.08); margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span class="sidebar-country-icon">${sidebarIcon("map-pin", 18)}</span>
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
