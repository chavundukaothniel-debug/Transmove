import { icon } from "./Icon.js";

const navIcon = (name) => icon({
  request: "clipboard-list",
  trips: "car-front",
  message: "message-circle",
  profile: "user-round",
  earnings: "circle-dollar-sign",
  explore: "compass",
  machinery: "tractor",
  card: "credit-card",
  more: "menu"
}[name] || "house", 22);

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
    { href: "#machinery", label: "Machinery", icon: "machinery" },
    { href: "#customer?tab=bookings", label: "Trips", icon: "trips" },
    { href: "#messages", label: "Messages", icon: "message" },
    { action: "more", label: "More", icon: "more" }
  ] : role === "driver" ? [
    { href: "#driver", label: "Home", icon: "home" },
    { href: "#machinery", label: "Machinery", icon: "machinery" },
    { href: "#driver?tab=offers", label: "Jobs", icon: "trips" },
    { href: "#messages", label: "Messages", icon: "message" },
    { action: "more", label: "More", icon: "more" }
  ] : currentProfile ? [
    { href: `#${currentRoute || "home"}`, label: "Home", icon: "home" },
    { href: "#machinery", label: "Machinery", icon: "machinery" },
    { href: "#messages", label: "Messages", icon: "message" },
    { href: "#subscriptions", label: "Plans", icon: "card" },
    { action: "more", label: "More", icon: "more" }
  ] : [
    { href: "#home", label: "Home", icon: "home" },
    { href: "#machinery", label: "Machinery", icon: "machinery" },
    { href: "#subscriptions", label: "Plans", icon: "card" },
    { href: "#support", label: "Help", icon: "message" },
    { href: "#login", label: "Sign in", icon: "profile" }
  ];

  return `
    <nav class="mobile-bottom-nav" aria-label="Primary mobile navigation">
      ${items.map((item) => item.action === "more" ? `
        <button type="button" id="btn-mobile-more" class="mobile-nav-link mobile-nav-more" aria-label="Open all navigation" aria-controls="app-sidebar" aria-expanded="false">
          <span class="mobile-nav-icon">${navIcon(item.icon)}</span>
          <span class="mobile-nav-label">${item.label}</span>
        </button>
      ` : `
        <a href="${item.href}" class="mobile-nav-link ${activeRoute(item.href, currentRoute, currentHash) ? "active" : ""}">
          <span class="mobile-nav-icon">${navIcon(item.icon)}</span>
          <span class="mobile-nav-label">${item.label}</span>
        </a>
      `).join("")}
    </nav>
  `;
}
