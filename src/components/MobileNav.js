// ==============================================================================
// TRANSMOVE UNIFIED LOCKED DESIGN SYSTEM — MOBILE BOTTOM NAVIGATION
// Responsive reorganizing navigation bar for mobile devices (<768px)
// ==============================================================================

export function renderMobileNav(currentProfile, currentRoute) {
  const role = currentProfile?.role || "guest";

  const mainRoleRoute = {
    customer: "customer",
    driver: "driver",
    cargo_owner: "cargo_owner",
    logistics_provider: "logistics",
    vehicle_owner: "vehicle_owner",
    machinery_owner: "machinery_owner",
    machinery_hirer: "machinery_hirer",
    business: "business",
    advertiser: "advertise",
    admin: "admin"
  }[role] || "home";

  return `
    <nav class="mobile-bottom-nav">
      <a href="#${mainRoleRoute}" class="mobile-nav-link ${currentRoute === mainRoleRoute ? "active" : ""}">
        <span class="mobile-nav-icon">📊</span>
        <span class="mobile-nav-label">Dashboard</span>
      </a>

      <a href="#equipment" class="mobile-nav-link ${currentRoute === "equipment" ? "active" : ""}">
        <span class="mobile-nav-icon">🚜</span>
        <span class="mobile-nav-label">Machinery</span>
      </a>

      <a href="#messages" class="mobile-nav-link ${currentRoute === "messages" ? "active" : ""}">
        <span class="mobile-nav-icon">💬</span>
        <span class="mobile-nav-label">Messages</span>
      </a>

      <a href="#profile" class="mobile-nav-link ${currentRoute === "profile" ? "active" : ""}">
        <span class="mobile-nav-icon">👤</span>
        <span class="mobile-nav-label">Account</span>
      </a>
    </nav>
  `;
}
