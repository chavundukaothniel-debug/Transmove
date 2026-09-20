// ==============================================================================
// TRANSMOVE HOME VIEW
// Modern Light & Dark Adaptive Landing Page & Marketplace Gateway
// Aligned with TransMove locked visual design system
// ==============================================================================
import { LocationService } from "../services/location.js";
import { EquipmentService } from "../services/equipment.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { icon } from "../components/Icon.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

export const HomeView = {
  async render() {
    return `
      <div class="home-container" style="max-width: 1200px; margin: 0 auto; padding-bottom: 2rem;">
        <!-- Hero Section -->
        <section class="hero-section" style="padding: 2.5rem 0 2rem 0; text-align: center;">
          <h1 class="hero-title" style="font-size: 2.75rem; font-weight: 900; letter-spacing: -0.03em; line-height: 1.2; color: var(--text-main); margin-bottom: 1rem;">
            Fair Rides, Freight &amp; Machinery.<br>
            <span style="color: var(--transmove-red);">You Agree on the Price.</span>
          </h1>
          <p class="hero-subtitle" style="font-size: 1.15rem; color: var(--text-muted); max-width: 680px; margin: 0 auto 2rem auto; line-height: 1.6;">
            TransMove puts you in control. Post your ride or cargo request, get real offers from verified drivers, negotiate in real-time, and hire heavy equipment directly.
          </p>

          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="#customer" class="btn btn-primary btn-lg home-passenger-cta" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700; padding: 0.85rem 1.75rem; border-radius: var(--radius-md);">
              ${icon("car-front", 20)}<span>Request a Ride or Cargo</span>
            </a>
            <a href="#register" class="btn btn-outline btn-lg" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700; padding: 0.85rem 1.75rem; border-radius: var(--radius-md);">
              ${icon("user-round-plus", 20)}<span>Register as Driver / Owner</span>
            </a>
          </div>
        </section>

        <!-- Instant Route & Fare Estimator -->
        <div class="card" style="max-width: 860px; margin: 0 auto 3rem auto; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); padding: 1.75rem;">
          <div class="card-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
          <h3 class="card-title icon-label" style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0;">${icon("route", 20)}<span>Quick Fare &amp; Route Estimator</span></h3>
            <span class="badge badge-info" style="font-weight: 600;">TransMove Bidding</span>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">Pickup Location</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="quick-pickup" class="form-input" placeholder="Enter pickup address or landmark" />
                <button id="btn-quick-gps" class="btn btn-outline btn-sm" title="Use current GPS location" style="white-space: nowrap;">
              ${icon("locate-fixed", 17)}<span>GPS</span>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">Destination</label>
              <input type="text" id="quick-dest" class="form-input" placeholder="Enter drop-off destination" />
            </div>
          </div>

          <div class="grid-3" style="margin-top: 0.75rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">Service Type</label>
              <select id="quick-type" class="form-select">
                <option value="ride">Passenger Ride (Sedan / Hatchback)</option>
                <option value="logistics">Cargo / Logistics Freight</option>
                <option value="hire">Driver &amp; Vehicle Hire</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" style="font-weight: 600; color: var(--text-main); font-size: 0.9rem;">Your Suggested Price ($)</label>
              <input type="number" id="quick-price" class="form-input" placeholder="e.g. 15.00" min="1" step="0.5" />
            </div>

            <div style="display: flex; align-items: flex-end; margin-bottom: 1.25rem;">
              <button id="btn-quick-post-request" type="button" class="btn btn-primary btn-full" style="height: 44px; font-weight: 800;">
                Post Request Now
              </button>
            </div>
          </div>
        </div>

        <!-- Three Pillars Section -->
        <div class="grid-3" style="margin-bottom: 3.5rem;">
          <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; transition: transform 0.15s ease;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              ${icon("car-front", 24)}
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">Passenger Rides</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.55;">
              Suggest your own price for daily commutes, intercity travels, or group trips. Drivers offer their rates and you pick the best one.
            </p>
          </div>

          <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; transition: transform 0.15s ease;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--secondary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              ${icon("truck", 24)}
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">Cargo &amp; Freight Logistics</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.55;">
              Move agricultural produce, goods, furniture, and industrial loads with verified bakkies, 3-tonne trucks, and heavy haulage.
            </p>
          </div>

          <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; transition: transform 0.15s ease;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--accent-amber-light); color: var(--accent-amber); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              ${icon("tractor", 24)}
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem;">Heavy Machinery Hire</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem; line-height: 1.55;">
              Hire excavators, tractors, tipper trucks, and cranes directly from verified owners with transparent daily or hourly rates.
            </p>
          </div>
        </div>

        <!-- Featured Machinery Feed -->
        <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem;">
          <div class="card-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
          <h3 class="card-title icon-label" style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0;">${icon("tractor", 21)}<span>Machinery &amp; Equipment Marketplace</span></h3>
            <a href="#equipment" class="btn btn-outline btn-sm">View All Equipment</a>
          </div>

          <div id="home-equipment-container">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              Loading verified equipment listings...
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(currentRoute, currentProfile) {
    // Check logged in user profile for role shortcut banner
    import("../services/auth.js").then(async ({ AuthService }) => {
      const profile = currentProfile || window.__transmove_app?.currentProfile || await AuthService.getCurrentProfile().catch(() => null);
      if (profile) {
        const heroSec = document.querySelector(".hero-section");
        if (heroSec && !document.getElementById("home-welcome-banner")) {
          const roleMap = {
            driver: { label: "Driver", target: "#driver", icon: "car-front", action: "Open Driver Cockpit" },
            customer: { label: "Passenger", target: "#customer", icon: "car-taxi-front", action: "Open Passenger Dashboard" },
            passenger: { label: "Passenger", target: "#customer", icon: "car-taxi-front", action: "Open Passenger Dashboard" },
            cargo_owner: { label: "Cargo Owner", target: "#cargo-owner", icon: "package", action: "Open Cargo Dashboard" },
            logistics: { label: "Logistics Provider", target: "#logistics", icon: "truck", action: "Open Logistics Dashboard" },
            logistics_provider: { label: "Logistics Provider", target: "#logistics", icon: "truck", action: "Open Logistics Dashboard" },
            vehicle_owner: { label: "Vehicle Owner", target: "#vehicle-owner", icon: "car-front", action: "Open Vehicle Dashboard" },
            machinery_owner: { label: "Machinery Owner", target: "#machinery-owner", icon: "tractor", action: "Open Machinery Dashboard" },
            machinery_hirer: { label: "Machinery Hirer", target: "#machinery-hirer", icon: "search", action: "Open Hirer Dashboard" },
            business: { label: "Business", target: "#business", icon: "building-2", action: "Open Business Dashboard" },
            advertiser: { label: "Advertiser", target: "#advertise", icon: "megaphone", action: "Open Ad Dashboard" },
            admin: { label: "Administrator", target: "#admin", icon: "shield-check", action: "Open Admin Dashboard" }
          };

          const roleInfo = roleMap[profile.role] || {
            label: profile.role || "User",
            target: "#profile",
            icon: "user-round",
            action: "Open Dashboard"
          };

          const banner = document.createElement("div");
          banner.id = "home-welcome-banner";
          banner.className = "card";
          banner.style.cssText = "max-width: 640px; margin: 0 auto 1.5rem auto; padding: 1rem 1.25rem; background: var(--bg-surface); border: 1.5px solid var(--primary); display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);";
          banner.innerHTML = `
            <div>
              <div class="icon-label" style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${icon("hand", 18)}<span>Welcome back, ${escapeHtml(profile.full_name?.split(" ")[0] || "User")}!</span></div>
              <div style="font-size: 0.825rem; color: var(--text-muted); margin-top: 0.15rem;">You are currently logged in as <strong>${escapeHtml(roleInfo.label)}</strong>.</div>
            </div>
            <a href="${roleInfo.target}" class="btn btn-primary btn-sm" style="font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.4rem;">
              ${icon(roleInfo.icon, 17)}<span>${roleInfo.action}</span>
            </a>
          `;
          heroSec.insertBefore(banner, heroSec.firstChild);
        }
      }
    });


    // Quick GPS location detection (handles allowed / denied permissions gracefully)
    document.getElementById("btn-quick-gps")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-quick-gps");
      const input = document.getElementById("quick-pickup");
      btn.innerText = "Locating...";
      btn.disabled = true;

      try {
        const coords = await LocationService.getCurrentPosition();
        const address = await LocationService.reverseGeocode(coords.lat, coords.lng);
        if (input) input.value = address;
        btn.innerHTML = `${icon("check", 17)}<span>Found</span>`;
      } catch (err) {
        console.warn("GPS location notice:", err.message);
        btn.innerHTML = `${icon("locate-fixed", 17)}<span>GPS</span>`;
        if (input && !input.value) {
          input.placeholder = "Enter pickup address manually";
          input.focus();
        }
      } finally {
        btn.disabled = false;
      }
    });

    // Handle Quick Estimator Post Request
    // Saves inputs into sessionStorage and redirects guest to #login (or logged-in user to #customer?tab=search)
    document.getElementById("btn-quick-post-request")?.addEventListener("click", async () => {
      const pickup = document.getElementById("quick-pickup")?.value.trim();
      const dest = document.getElementById("quick-dest")?.value.trim();
      const type = document.getElementById("quick-type")?.value || "ride";
      const price = document.getElementById("quick-price")?.value;

      if (pickup || dest) {
        sessionStorage.setItem("transmove_pending_request", JSON.stringify({
          pickup: pickup || "",
          dest: dest || "",
          type: type || "ride",
          price: price || "",
          date: null,
          passenger_count: null
        }));
      }

      const profile = window.__transmove_app?.currentProfile;
      if (profile) {
        window.location.hash = "#customer?tab=search";
      } else {
        window.location.hash = "#login";
      }
    });

    // Load real equipment listings
    const container = document.getElementById("home-equipment-container");
    if (container) {
      try {
        const listings = await EquipmentService.getMarketplaceListings();
        if (!listings || listings.length === 0) {
          container.innerHTML = renderEmptyState({
            title: "No verified machinery listings available yet",
            description: "Be the first equipment owner to list your tractors, excavators, or tippers on TransMove.",
            actionText: "Browse Equipment",
            actionLink: "#equipment",
            icon: "tractor"
          });
        } else {
          container.innerHTML = `
            <div class="grid-3">
              ${listings.slice(0, 3).map((item) => `
                <div class="card" style="padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-md);">
                  <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.25rem; color: var(--text-main);">${escapeHtml(item.title)}</div>
                  <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">${escapeHtml(item.make)} ${escapeHtml(item.model)} • ${escapeHtml(item.location_name)}</div>
                  <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary); margin-bottom: 1rem;">
                    $${escapeHtml(item.rate_per_day)} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ day</span>
                  </div>
                  <a href="#equipment" class="btn btn-outline btn-sm btn-full">View Details</a>
                </div>
              `).join("")}
            </div>
          `;
        }
      } catch (err) {
        console.warn("Equipment feed load notice:", err.message);
        container.innerHTML = renderEmptyState({
          title: "Machinery listings are not available right now",
          description: "We could not load equipment listings at the moment. Please check back soon.",
          icon: "tractor"
        });
      }
    }
  }
};
