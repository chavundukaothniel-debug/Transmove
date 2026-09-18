const navIcon = (name) => {
  const paths = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    request: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/>',
    trips: '<path d="M5 17h14l-1.4-5.5A2 2 0 0 0 15.7 10H8.3a2 2 0 0 0-1.9 1.5L5 17Z"/><path d="M7 10l1.5-4h7L17 10M4 17v2M20 17v2"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
    message: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v9Z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
    profile: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    earnings: '<circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.6-1.8-.9-3-.9-1.7 0-3 .8-3 2s1 1.8 3 2.2 3 1.1 3 2.4-1.3 2.2-3 2.2c-1.2 0-2.4-.4-3.2-1.1M12 5.5v13"/>',
    explore: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.home}</svg>`;
};

const activeRoute = (href, currentRoute, currentHash) => {
  const target = href.replace(/^#/, "");
  if (target.includes("?")) return currentHash === target;
  return currentRoute === target && !currentHash.includes("?");
};

export function renderMobileNav(currentProfile, currentRoute) {
  const role = currentProfile?.role || "guest";
  const currentHash = (window.location.hash || "#home").replace(/^#/, "");
  const passenger = ["customer", "passenger"].includes(role);

  const items = passenger ? [
    { href: "#customer", label: "Home", icon: "home" },
    { href: "#customer?tab=quotes", label: "Requests", icon: "request" },
    { href: "#customer?tab=bookings", label: "Trips", icon: "trips" },
    { href: "#messages", label: "Messages", icon: "message" },
    { href: "#profile", label: "Profile", icon: "profile" }
  ] : role === "driver" ? [
    { href: "#driver", label: "Home", icon: "home" },
    { href: "#driver?tab=available", label: "Requests", icon: "request" },
    { href: "#driver?tab=offers", label: "Jobs", icon: "trips" },
    { href: "#driver?tab=earnings", label: "Earnings", icon: "earnings" },
    { href: "#profile", label: "Profile", icon: "profile" }
  ] : currentProfile ? [
    { href: `#${currentRoute || "home"}`, label: "Home", icon: "home" },
    { href: "#equipment", label: "Explore", icon: "explore" },
    { href: "#messages", label: "Messages", icon: "message" },
    { href: "#subscriptions", label: "Plans", icon: "card" },
    { href: "#profile", label: "Profile", icon: "profile" }
  ] : [
    { href: "#home", label: "Home", icon: "home" },
    { href: "#equipment", label: "Explore", icon: "explore" },
    { href: "#subscriptions", label: "Plans", icon: "card" },
    { href: "#support", label: "Help", icon: "message" },
    { href: "#login", label: "Sign in", icon: "profile" }
  ];

  return `
    <nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">
      ${items.map((item) => `
        <a href="${item.href}" class="mobile-nav-link ${activeRoute(item.href, currentRoute, currentHash) ? "active" : ""}">
          <span class="mobile-nav-icon">${navIcon(item.icon)}</span>
          <span class="mobile-nav-label">${item.label}</span>
        </a>
      `).join("")}
    </nav>
  `;
}
