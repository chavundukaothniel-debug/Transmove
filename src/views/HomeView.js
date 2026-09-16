// ==============================================================================
// TRANSMOVE HOME VIEW
// Modern Light-Theme Landing Page & Marketplace Gateway
// ==============================================================================
import { LocationService } from "../services/location.js";
import { EquipmentService } from "../services/equipment.js";
import { renderEmptyState } from "../components/EmptyState.js";

export const HomeView = {
  async render() {
    return `
      <div class="home-container">
        <!-- Hero Section -->
        <section class="hero-section">
          <h1 class="hero-title">
            Fair Rides, Freight &amp; Machinery.<br>
            <span>You Agree on the Price.</span>
          </h1>
          <p class="hero-subtitle">
            TransMove puts you in control. Post your ride or cargo request, get real offers from verified drivers, negotiate in real-time, and hire heavy equipment directly.
          </p>

          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="#customer" class="btn btn-primary btn-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              Request a Ride or Cargo
            </a>
            <a href="#register" class="btn btn-outline btn-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
              Register as Driver / Owner
            </a>
          </div>
        </section>

        <!-- Instant Route & Fare Estimator -->
        <div class="card" style="max-width: 860px; margin: 0 auto 3rem auto;">
          <div class="card-header">
            <h3 class="card-title">⚡ Quick Fare &amp; Route Estimator</h3>
            <span class="badge badge-info">TransMove Bidding</span>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Pickup Location</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="quick-pickup" class="form-input" placeholder="Enter pickup address or landmark" />
                <button id="btn-quick-gps" class="btn btn-outline btn-sm" title="Use current GPS location">
                  📍 GPS
                </button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Destination</label>
              <input type="text" id="quick-dest" class="form-input" placeholder="Enter drop-off destination" />
            </div>
          </div>

          <div class="grid-3" style="margin-top: 0.5rem;">
            <div class="form-group">
              <label class="form-label">Service Type</label>
              <select id="quick-type" class="form-select">
                <option value="ride">Passenger Ride (Sedan / Hatchback)</option>
                <option value="logistics">Cargo / Logistics Freight</option>
                <option value="hire">Driver &amp; Vehicle Hire</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Your Suggested Price ($)</label>
              <input type="number" id="quick-price" class="form-input" placeholder="e.g. 15.00" min="1" step="0.5" />
            </div>

            <div style="display: flex; align-items: flex-end; margin-bottom: 1.25rem;">
              <button id="btn-quick-post-request" type="button" class="btn btn-primary btn-full">
                Post Request Now
              </button>
            </div>
          </div>
        </div>

        <!-- Three Pillars Section -->
        <div class="grid-3" style="margin-bottom: 3.5rem;">
          <div class="card">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">Passenger Rides</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem;">
              Suggest your own price for daily commutes, intercity travels, or group trips. Drivers offer their rates and you pick the best one.
            </p>
          </div>

          <div class="card">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--secondary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">Cargo &amp; Freight Logistics</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem;">
              Move agricultural produce, goods, furniture, and industrial loads with verified bakkies, 3-tonne trucks, and heavy haulage.
            </p>
          </div>

          <div class="card">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--accent-amber-light); color: var(--accent-amber); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="17.5" cy="17.5" r="4.5"/><circle cx="4.5" cy="19.5" r="2.5"/><path d="M8 19v-4.5a2 2 0 0 1 2-2h4l2-4h4v6.5"/></svg>
            </div>
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">Heavy Machinery Hire</h3>
            <p style="color: var(--text-muted); font-size: 0.925rem;">
              Hire excavators, tractors, tipper trucks, and cranes directly from verified owners with transparent daily or hourly rates.
            </p>
          </div>
        </div>

        <!-- Featured Machinery Feed (Real Supabase records only) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🚜 Machinery &amp; Equipment Marketplace</h3>
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

  async init() {
    // Check logged in user profile for role shortcut banner
    import("../services/auth.js").then(async ({ AuthService }) => {
      const profile = await AuthService.getCurrentProfile();
      if (profile && profile.role === "driver") {
        const heroSec = document.querySelector(".hero-section");
        if (heroSec) {
          const banner = document.createElement("div");
          banner.className = "card";
          banner.style.cssText = "max-width: 600px; margin: 0 auto 1.5rem auto; padding: 1rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--primary); display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-lg);";
          banner.innerHTML = `
            <div>
              <div style="font-weight: 800; color: var(--text-main);">👋 Welcome back, ${profile.full_name?.split(" ")[0] || "Driver"}!</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">You are currently logged in as a <strong>DRIVER</strong>.</div>
            </div>
            <a href="#driver" class="btn btn-primary btn-sm" style="font-weight: 800;">
              🚗 Open Driver Cockpit
            </a>
          `;
          heroSec.insertBefore(banner, heroSec.firstChild);
        }
      }
    });

    // Quick GPS location detection
    document.getElementById("btn-quick-gps")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-quick-gps");
      const input = document.getElementById("quick-pickup");
      btn.innerText = "Locating...";
      btn.disabled = true;

      try {
        const coords = await LocationService.getCurrentPosition();
        const address = await LocationService.reverseGeocode(coords.lat, coords.lng);
        input.value = address;
        btn.innerText = "✓ Found";
      } catch (err) {
        alert(err.message);
        btn.innerText = "📍 GPS";
      } finally {
        btn.disabled = false;
      }
    });

    // Handle Quick Estimator Post Request
    document.getElementById("btn-quick-post-request")?.addEventListener("click", () => {
      const pickup = document.getElementById("quick-pickup")?.value.trim();
      const dest = document.getElementById("quick-dest")?.value.trim();
      const type = document.getElementById("quick-type")?.value || "ride";
      const price = document.getElementById("quick-price")?.value;

      if (pickup || dest) {
        sessionStorage.setItem("transmove_pending_request", JSON.stringify({
          pickup,
          dest,
          type,
          price
        }));
      }
      window.location.hash = "#customer";
    });

    // Load real equipment
    const container = document.getElementById("home-equipment-container");
    if (container) {
      try {
        const listings = await EquipmentService.getMarketplaceListings();
        if (!listings || listings.length === 0) {
          container.innerHTML = renderEmptyState({
            title: "No verified machinery listings available yet",
            description: "Be the first equipment owner to list your tractors, excavators, or tippers on TransMove.",
            actionText: "List Your Equipment",
            actionLink: "#owner",
            icon: "tractor"
          });
        } else {
          container.innerHTML = `
            <div class="grid-3">
              ${listings.slice(0, 3).map((item) => `
                <div class="card" style="padding: 1.25rem;">
                  <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.25rem;">${item.title}</div>
                  <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">${item.make} ${item.model} • ${item.location_name}</div>
                  <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary); margin-bottom: 1rem;">
                    $${item.rate_per_day} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">/ day</span>
                  </div>
                  <a href="#equipment" class="btn btn-outline btn-sm btn-full">View Details</a>
                </div>
              `).join("")}
            </div>
          `;
        }
      } catch (err) {
        container.innerHTML = renderEmptyState({
          title: "Database Ready",
          description: "Connect your Supabase project in settings to start streaming live equipment listings.",
          icon: "tractor"
        });
      }
    }
  }
};
