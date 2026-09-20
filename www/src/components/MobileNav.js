import { icon } from "./Icon.js";

const navIcon = (name) => icon({
  request: "clipboard-list",
  trips: "car-front",
  message: "message-circle",
  profile: "user-round",
  earnings: "circle-dollar-sign",
  explore: "compass",
  card: "credit-card"
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
