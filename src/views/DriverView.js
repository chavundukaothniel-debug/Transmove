// ==============================================================================
// TRANSMOVE DRIVER DASHBOARD VIEW — FUNCTIONALLY REPAIRED
// Real Appwrite Data: Profile Photo, Primary Vehicle, 5-Free-Jobs Enforcement,
// Clean Light UI (#F5F7FA), Compact Empty States, Real Activity, Vehicles Tab,
// My Bids & Jobs Tab, Earnings Tab, Active Trip Status Progression, & Photo Management.
// ==============================================================================
import { AuthService } from "../services/auth.js";
import { PresenceService } from "../services/presence.js";
import { VehicleService } from "../services/vehicles.js";
import { RequestService } from "../services/requests.js";
import { BidService, BookingService } from "../services/bids.js";
import { WalletService } from "../services/wallet.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

function timeAgo(dateString) {
  if (!dateString) return "Just now";
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export const DriverView = {
  driverProfile: null,
  isSubscribed: false,
  freeJobsUsed: 0,
  monthEarnings: 0,
  availableJobs: [],
  driverVehicles: [],
  primaryVehicle: null,
  driverBookings: [],
  driverBids: [],
  activeBooking: null,
  isProfileComplete: false,
  selectedJobForBid: null,
  selectedVehicleForPhotos: null,
  realtimeChannel: null,
  realtimeSubscription: null,
  syncRefreshTimer: null,
  syncBusy: false,
  journeyStateSignature: "",
  currentTab: "dashboard", // 'dashboard' | 'available' | 'offers' | 'vehicles' | 'earnings'

  async render() {
    const rawHash = (window.location.hash || "").replace(/^#/, "");
    const tabMatch = rawHash.match(/tab=([a-z-]+)/);
    const requestedTab = tabMatch ? tabMatch[1] : "dashboard";
    const validTabs = ["dashboard", "available", "offers", "vehicles", "earnings"];
    this.currentTab = validTabs.includes(requestedTab) ? requestedTab : "dashboard";

    return `
      <div class="driver-dashboard-container" style="max-width: 1440px; margin: 0 auto; padding: 0.25rem 0;">
        
        <!-- TOP HEADER AREA -->
        <div class="driver-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div>
            <h1 style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin: 0 0 0.2rem 0;">
              Welcome back, <span id="driver-display-name">Driver</span>
            </h1>
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">
              Drive Smart. Move Zimbabwe.
            </div>

            <!-- Profile Completion Warning Banner -->
            <div id="driver-profile-warning-banner" style="display: none; margin-top: 0.75rem; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 0.5rem 0.85rem; font-size: 0.8rem; color: #92400e; align-items: center; gap: 0.75rem;">
              <span>⚠️ Complete your profile and register a vehicle to start accepting jobs.</span>
              <a href="#profile" class="btn btn-sm" style="background: #2563eb; color: #ffffff; padding: 0.25rem 0.65rem; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 0.75rem;">
                Complete Profile
              </a>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
            <!-- Automatic Online/Offline Badge -->
            <div id="hdr-online-pill" style="display: inline-flex; align-items: center; gap: 0.4rem; background: #ecfdf5; color: #059669; padding: 0.35rem 0.85rem; border-radius: 9999px; font-weight: 700; font-size: 0.85rem; border: 1px solid #a7f3d0;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
              Online
            </div>

            <!-- Driver Avatar & Info Dropdown -->
            <a href="#profile" style="display: flex; align-items: center; gap: 0.75rem; text-decoration: none;" title="Edit Driver Profile">
              <div id="hdr-driver-avatar" style="width: 42px; height: 42px; border-radius: 50%; background: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; overflow: hidden; border: 1px solid #e2e8f0;">
                <span id="hdr-avatar-initials">D</span>
                <img id="hdr-avatar-img" src="" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              </div>
              <div style="text-align: left;">
                <div style="font-size: 0.9rem; font-weight: 700; color: #0f172a;" id="hdr-driver-name">Driver</div>
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 500;">Driver</div>
                <div id="hdr-primary-vehicle" style="display: none; font-size: 0.7rem; color: #2563eb; font-weight: 600;"></div>
              </div>
              <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 0.25rem;">▼</span>
            </a>
          </div>
        </div>

        <!-- 4 SUMMARY CARDS GRID -->
        <div class="summary-cards-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem;">
          
          <!-- CARD 1: JOBS COMPLETED -->
          <div class="card summary-card" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.35rem;">Jobs Completed</div>
              <div style="font-size: 1.7rem; font-weight: 800; color: #0f172a; margin-bottom: 0.35rem;" id="card-jobs-completed-val">0 / 5</div>
              <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem;">Free limit used</div>
            </div>
            <div style="height: 6px; width: 100%; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
              <div id="card-jobs-progress-bar" style="height: 100%; width: 0%; background: #2563eb; transition: width 0.4s ease;"></div>
            </div>
          </div>

          <!-- CARD 2: TOTAL EARNINGS -->
          <div class="card summary-card" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.35rem;">Total Earnings</div>
              <div style="font-size: 1.7rem; font-weight: 800; color: #0f172a; margin-bottom: 0.35rem;" id="card-total-earnings-val">$0.00</div>
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">This month</div>
          </div>

          <!-- CARD 3: ACCOUNT STATUS -->
          <div class="card summary-card" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
                <span>Account Status</span>
                <span style="font-size: 0.8rem; color: #94a3b8; cursor: pointer;" title="Free Driver limit is 5 lifetime accepted jobs unless subscribed.">ⓘ</span>
              </div>
              <div style="font-size: 1.7rem; font-weight: 800; color: #0f172a; margin-bottom: 0.35rem;" id="card-account-status-val">Free Driver</div>
            </div>
            <div style="font-size: 0.8rem; color: #64748b;" id="card-account-status-sub">5 jobs remaining</div>
          </div>

          <!-- CARD 4: ONLINE STATUS -->
          <div class="card summary-card" style="background: #ffffff; padding: 1.1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.85rem; font-weight: 600; color: #64748b; margin-bottom: 0.35rem;">Online Status</div>
              <div style="font-size: 1.7rem; font-weight: 800; color: #10b981; margin-bottom: 0.35rem;" id="card-online-status-val">● Online</div>
            </div>
            <div style="font-size: 0.8rem; color: #64748b;">Auto-detected</div>
          </div>

        </div>

        <!-- DRIVER DASHBOARD SUB-NAV / TABS -->
        <div class="driver-tab-bar" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; flex-wrap: wrap;">
          <a href="#driver" class="btn btn-sm" style="padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; text-decoration: none; ${this.currentTab === "dashboard" ? "background: #2563eb; color: #ffffff;" : "background: #ffffff; border: 1px solid #cbd5e1; color: #475569;"}">Overview</a>
          <a href="#driver?tab=available" class="btn btn-sm" style="padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; text-decoration: none; ${this.currentTab === "available" ? "background: #2563eb; color: #ffffff;" : "background: #ffffff; border: 1px solid #cbd5e1; color: #475569;"}">Available Jobs</a>
          <a href="#driver?tab=offers" class="btn btn-sm" style="padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; text-decoration: none; ${this.currentTab === "offers" ? "background: #2563eb; color: #ffffff;" : "background: #ffffff; border: 1px solid #cbd5e1; color: #475569;"}">My Bids &amp; Jobs</a>
          <a href="#driver?tab=vehicles" class="btn btn-sm" style="padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; text-decoration: none; ${this.currentTab === "vehicles" ? "background: #2563eb; color: #ffffff;" : "background: #ffffff; border: 1px solid #cbd5e1; color: #475569;"}">Vehicles</a>
          <a href="#driver?tab=earnings" class="btn btn-sm" style="padding: 0.4rem 1rem; border-radius: 6px; font-weight: 700; text-decoration: none; ${this.currentTab === "earnings" ? "background: #2563eb; color: #ffffff;" : "background: #ffffff; border: 1px solid #cbd5e1; color: #475569;"}">Earnings</a>
        </div>

        <!-- ACTIVE TRIP PROGRESSION BANNER (Visible across all tabs when active booking exists) -->
        <div id="driver-active-trip-container" style="margin-bottom: 1.25rem;"></div>

        <!-- SECTION 1: DASHBOARD & AVAILABLE JOBS -->
        <div id="driver-main-dashboard-section" style="${(this.currentTab === "dashboard" || this.currentTab === "available") ? "display: grid;" : "display: none;"} grid-template-columns: ${(this.currentTab === "available") ? "1fr" : "2fr 1fr"}; gap: 1.25rem; align-items: start; margin-bottom: 2rem;">
          
          <!-- AVAILABLE JOBS CARD -->
          <div class="card" style="background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
              <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Available Jobs</h2>
              <a href="#driver?tab=available" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-decoration: none;">Refresh Jobs</a>
            </div>

            <!-- Realtime Available Jobs Feed -->
            <div id="available-jobs-container">
              <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.875rem;">
                Loading available jobs...
              </div>
            </div>
          </div>

          <!-- RIGHT CARD: RECENT ACTIVITY (Hidden when tab is available) -->
          <div class="card" style="background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); ${(this.currentTab === "available") ? "display: none;" : ""}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
              <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Recent Activity</h2>
              <a href="#driver?tab=offers" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-decoration: none;">View All</a>
            </div>

            <div id="recent-activity-container">
              <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.875rem;">
                Loading recent activity...
              </div>
            </div>
          </div>

        </div>

        <!-- SECTION 2: MY BIDS & OFFERS SECTION (#driver?tab=offers) -->
        <div id="driver-offers-tab-section" style="${this.currentTab === "offers" ? "display: block;" : "display: none;"} margin-bottom: 2rem;">
          <div class="card" style="background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">My Quotations &amp; Jobs</h2>
              <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Track all bids you have submitted, active awarded jobs, and completed trips.</div>
            </div>
            <div id="driver-offers-content">
              <div style="padding: 2rem; text-align: center; color: #64748b;">Loading quotations and bookings...</div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: VEHICLES SECTION (#driver?tab=vehicles) -->
        <div id="driver-vehicles-tab-section" style="${this.currentTab === "vehicles" ? "display: block;" : "display: none;"} margin-bottom: 2rem;">
          <div class="card" style="background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">My Vehicles</h2>
                <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Manage your transport vehicles, photos, verification documents, and primary setting.</div>
              </div>
              <button id="btn-show-add-vehicle-form" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
                + Add Vehicle
              </button>
            </div>

            <!-- Registered Vehicles List -->
            <div id="vehicles-full-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
              <div style="padding: 2rem; text-align: center; color: #64748b;">Loading vehicles...</div>
            </div>
          </div>

          <!-- Add Vehicle Form Card (Collapsible) -->
          <div id="add-vehicle-modal-card" class="card" style="display: none; background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Register New Vehicle</h3>
              <button type="button" id="btn-hide-add-vehicle-form" style="border: none; background: transparent; font-size: 1.25rem; cursor: pointer; color: #64748b;">✕</button>
            </div>

            <form id="driver-new-vehicle-form">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Vehicle Type *</label>
                  <select id="nv-type" class="form-select" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required>
                    <option value="sedan">Taxi / Car / Sedan</option>
                    <option value="suv">SUV / Crossover</option>
                    <option value="van">Delivery Van</option>
                    <option value="pickup">Pickup / Bakkie</option>
                    <option value="truck">Truck (3-10 Tonne)</option>
                    <option value="bus">Bus / Minibus</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="machinery">Heavy Machinery</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Service Category *</label>
                  <select id="nv-category" class="form-select" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required>
                    <option value="passenger_transport">Passenger Transport (Rides)</option>
                    <option value="light_goods">Light Goods / Delivery</option>
                    <option value="heavy_goods">Heavy Freight / Haulage</option>
                    <option value="bus_passenger">Bus / Minibus Transport</option>
                    <option value="machinery_hire">Machinery Hire</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Make *</label>
                  <input type="text" id="nv-make" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. Toyota" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Model *</label>
                  <input type="text" id="nv-model" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. Aqua / Hilux" required />
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Year</label>
                  <input type="number" id="nv-year" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="2020" min="1995" max="2027" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Number Plate *</label>
                  <input type="text" id="nv-plate" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="ABC 1234" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Colour</label>
                  <input type="text" id="nv-color" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="White" required />
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="submit" id="btn-save-new-vehicle" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-weight: 700;">
                  Save Vehicle 🚘
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- SECTION 4: EARNINGS SECTION (#driver?tab=earnings) -->
        <div id="driver-earnings-tab-section" style="${this.currentTab === "earnings" ? "display: block;" : "display: none;"} margin-bottom: 2rem;">
          <div class="card" style="background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
              <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">Earnings &amp; Wallet</h2>
              <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Verified transaction ledger and payouts overview.</div>
            </div>
            <div id="driver-earnings-content">
              <div style="padding: 2rem; text-align: center; color: #64748b;">Loading earnings data...</div>
            </div>
          </div>
        </div>

        <!-- MODAL 1: VIEW & BID MODAL -->
        <div id="view-bid-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 540px; width: 100%; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 90vh; overflow-y: auto;">
            <button type="button" id="btn-close-bid-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; border: none; background: transparent; font-size: 1.25rem; color: #64748b; cursor: pointer;">✕</button>

            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;" id="bid-modal-job-title">Job Details</h3>
            <div style="font-size: 0.875rem; color: #64748b; margin-bottom: 1.25rem;" id="bid-modal-route">Pickup → Destination</div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
              <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 0.35rem;">Customer Budget</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #059669; margin-bottom: 0.75rem;" id="bid-modal-budget">$0.00</div>
              
              <div style="font-size: 0.875rem; color: #334155;" id="bid-modal-desc">Job description details...</div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;" id="bid-modal-customer-info">Posted by Customer</div>
            </div>

            <!-- Bid Form -->
            <form id="bid-modal-form">
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Your Bid Price ($ USD)</label>
                <input type="number" id="input-bid-price" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 700; font-size: 1rem;" required step="0.5" />
              </div>

              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Estimated Arrival Time (Minutes)</label>
                <input type="number" id="input-bid-eta" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" value="15" min="2" max="120" required />
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Optional Note to Customer</label>
                <input type="text" id="input-bid-message" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. Ready immediately with Toyota Aqua" />
              </div>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" id="btn-cancel-bid" class="btn btn-outline" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600;">Cancel</button>
                <button type="submit" id="btn-submit-bid-action" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-weight: 700;">Submit Bid ⚡</button>
              </div>
            </form>
          </div>
        </div>

        <!-- MODAL 2: SUBSCRIPTION REQUIRED MODAL -->
        <div id="sub-required-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 480px; width: 100%; padding: 2rem; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: #fef2f2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 900; margin: 0 auto 1.25rem auto; border: 2px solid #fecaca;">
              !
            </div>
            
            <h3 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Free Job Limit Reached</h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.5; margin: 0 0 1.25rem 0;">
              You have completed/accepted your 5 free jobs.<br/>
              To continue accepting or bidding on new jobs, please subscribe to a monthly plan.
            </p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: left; margin-bottom: 1.5rem;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem;">Benefits:</div>
              <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.85rem; color: #334155; line-height: 1.6;">
                <li>✓ Unlimited job bids</li>
                <li>✓ Higher visibility to customers</li>
                <li>✓ Priority access to new jobs</li>
                <li>✓ Build your reputation</li>
                <li>✓ Grow your earnings</li>
              </ul>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <a href="#subscriptions" id="btn-sub-plans" class="btn btn-primary btn-full" style="background: #2563eb; color: #ffffff; font-weight: 700; padding: 0.75rem; border-radius: 6px; text-decoration: none; text-align: center;">
                View Subscription Plans
              </a>
              <button type="button" id="btn-close-sub-modal" class="btn btn-outline btn-full" style="border: 1px solid #cbd5e1; color: #475569; font-weight: 600; padding: 0.65rem; border-radius: 6px;">
                Maybe Later
              </button>
            </div>
          </div>
        </div>

        <!-- MODAL 3: PROFILE INCOMPLETE MODAL -->
        <div id="profile-incomplete-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 440px; width: 100%; padding: 2rem; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: #fffbeb; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 900; margin: 0 auto 1.25rem auto; border: 2px solid #fde68a;">
              ⚠️
            </div>
            
            <h3 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Complete Your Driver Profile</h3>
            <p style="font-size: 0.875rem; color: #475569; line-height: 1.5; margin: 0 0 1.25rem 0;">
              Before accepting or bidding on customer jobs, please upload your profile picture and register at least one active vehicle.
            </p>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <a href="#profile" class="btn btn-primary btn-full" style="background: #2563eb; color: #ffffff; font-weight: 700; padding: 0.75rem; border-radius: 6px; text-decoration: none; text-align: center;">
                Complete Profile
              </a>
              <button type="button" id="btn-close-incomplete-modal" class="btn btn-outline btn-full" style="border: 1px solid #cbd5e1; color: #475569; font-weight: 600; padding: 0.65rem; border-radius: 6px;">
                Maybe Later
              </button>
            </div>
          </div>
        </div>

        <!-- MODAL 4: EDIT VEHICLE MODAL -->
        <div id="edit-vehicle-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 540px; width: 100%; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 90vh; overflow-y: auto;">
            <button type="button" id="btn-close-edit-veh-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; border: none; background: transparent; font-size: 1.25rem; color: #64748b; cursor: pointer;">✕</button>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 1rem 0;">Edit Vehicle</h3>
            <form id="edit-vehicle-form">
              <input type="hidden" id="ev-id" />
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Make *</label>
                  <input type="text" id="ev-make" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Model *</label>
                  <input type="text" id="ev-model" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Year</label>
                  <input type="number" id="ev-year" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" min="1995" max="2027" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Number Plate *</label>
                  <input type="text" id="ev-plate" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Colour</label>
                  <input type="text" id="ev-color" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
              </div>
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" id="btn-cancel-edit-veh" class="btn btn-outline" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600;">Cancel</button>
                <button type="submit" id="btn-save-edit-veh" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-weight: 700;">Save Changes</button>
              </div>
            </form>
          </div>
        </div>

        <!-- MODAL 5: MANAGE VEHICLE PHOTOS MODAL -->
        <div id="manage-photos-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 580px; width: 100%; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 90vh; overflow-y: auto;">
            <button type="button" id="btn-close-photos-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; border: none; background: transparent; font-size: 1.25rem; color: #64748b; cursor: pointer;">✕</button>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Vehicle Photos</h3>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">Upload up to 5 photos. Customers see these photos when evaluating your quotations.</div>

            <div id="veh-photos-gallery" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; min-height: 80px;">
              <div style="grid-column: 1 / -1; padding: 1rem; text-align: center; color: #94a3b8;">No photos uploaded yet.</div>
            </div>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem;">
              <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Add New Photo (JPG/PNG, Max 5MB)</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="file" id="veh-photo-file-input" accept="image/jpeg,image/png,image/webp" style="flex: 1; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem;" />
                <button type="button" id="btn-do-upload-photo" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.45rem 1rem; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">Upload</button>
              </div>
            </div>
          </div>
        </div>

        <!-- MODAL 6: UPLOAD VERIFICATION DOCUMENT MODAL -->
        <div id="upload-doc-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); z-index: 9999; justify-content: center; align-items: center; padding: 1rem;">
          <div style="background: #ffffff; border-radius: 12px; max-width: 480px; width: 100%; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); position: relative; max-height: 90vh; overflow-y: auto;">
            <button type="button" id="btn-close-doc-modal" style="position: absolute; top: 1.25rem; right: 1.25rem; border: none; background: transparent; font-size: 1.25rem; color: #64748b; cursor: pointer;">✕</button>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">Upload Verification Document</h3>
            <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">Documents are reviewed confidentially by TransMove Admin.</div>
            <form id="upload-doc-form">
              <input type="hidden" id="ud-vehicle-id" />
              <div style="margin-bottom: 1rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Document Type *</label>
                <select id="ud-type" class="form-select" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required>
                  <option value="driver_licence">Driver's Licence</option>
                  <option value="vehicle_registration">Vehicle Registration (Logbook)</option>
                  <option value="insurance">Insurance Policy</option>
                  <option value="national_id">National ID Card / Passport</option>
                  <option value="other">Other / Certificate of Fitness</option>
                </select>
              </div>
              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">File (JPG, PNG, PDF, max 5MB) *</label>
                <input type="file" id="ud-file" accept="image/jpeg,image/png,image/webp,application/pdf" style="width: 100%; padding: 0.4rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.85rem;" required />
              </div>
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" id="btn-cancel-doc-upload" class="btn btn-outline" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600;">Cancel</button>
                <button type="submit" id="btn-submit-doc-upload" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-weight: 700;">Upload Document</button>
              </div>
            </form>
          </div>
        </div>

      </div>
    `;
  },

  async init() {
    try {
      this.driverProfile = await AuthService.getCurrentProfile();
      if (this.driverProfile) {
        // Start automatic presence heartbeat
        await PresenceService.startHeartbeat(this.driverProfile.id);

        const displayName = this.driverProfile.full_name || "Driver";
        const nameEl = document.getElementById("driver-display-name");
        const hdrNameEl = document.getElementById("hdr-driver-name");
        const initialsEl = document.getElementById("hdr-avatar-initials");
        const imgEl = document.getElementById("hdr-avatar-img");

        if (nameEl) nameEl.innerText = displayName;
        if (hdrNameEl) hdrNameEl.innerText = displayName;
        
        if (this.driverProfile.profile_photo_url) {
          if (initialsEl) initialsEl.style.display = "none";
          if (imgEl) {
            imgEl.src = this.driverProfile.profile_photo_url;
            imgEl.style.display = "block";
          }
        } else if (initialsEl) {
          initialsEl.innerText = displayName.charAt(0).toUpperCase();
        }
      }

      // Fetch driver status, bookings, vehicles & limits
      await this.loadDriverData();
      await this.loadDriverVehicles();
      await this.loadAvailableJobs();
      await this.loadRecentActivity();

      if (this.currentTab === "offers") {
        await this.renderOffersTab();
      } else if (this.currentTab === "earnings") {
        await this.renderEarningsTab();
      }

      // Start periodic job refresh
      this.subscribeToRealtimeJobs();

      // Wire Vehicle Form Toggle
      document.getElementById("btn-show-add-vehicle-form")?.addEventListener("click", () => {
        const card = document.getElementById("add-vehicle-modal-card");
        if (card) card.style.display = "block";
      });
      document.getElementById("btn-hide-add-vehicle-form")?.addEventListener("click", () => {
        const card = document.getElementById("add-vehicle-modal-card");
        if (card) card.style.display = "none";
      });

      // New Vehicle submit
      document.getElementById("driver-new-vehicle-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("btn-save-new-vehicle");
        btn.disabled = true;
        btn.innerText = "Saving Vehicle...";

        try {
          await VehicleService.addVehicle({
            vehicle_type: document.getElementById("nv-type").value,
            service_category: document.getElementById("nv-category").value,
            make: document.getElementById("nv-make").value,
            model: document.getElementById("nv-model").value,
            year: document.getElementById("nv-year").value,
            registration_number: document.getElementById("nv-plate").value,
            color: document.getElementById("nv-color").value
          });

          alert("🚘 Vehicle registered successfully!");
          document.getElementById("driver-new-vehicle-form").reset();
          document.getElementById("add-vehicle-modal-card").style.display = "none";
          await this.loadDriverVehicles();
        } catch (err) {
          alert("Error registering vehicle: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerText = "Save Vehicle 🚘";
        }
      });

      // Edit Vehicle submit
      document.getElementById("edit-vehicle-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const vehId = document.getElementById("ev-id").value;
        const btn = document.getElementById("btn-save-edit-veh");
        btn.disabled = true;
        btn.innerText = "Saving...";

        try {
          await VehicleService.updateVehicle(vehId, {
            make: document.getElementById("ev-make").value,
            model: document.getElementById("ev-model").value,
            year: parseInt(document.getElementById("ev-year").value, 10),
            registration_number: document.getElementById("ev-plate").value,
            colour: document.getElementById("ev-color").value
          });

          alert("Vehicle updated successfully!");
          document.getElementById("edit-vehicle-modal").style.display = "none";
          await this.loadDriverVehicles();
        } catch (err) {
          alert("Could not update vehicle: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerText = "Save Changes";
        }
      });

      // Document Upload submit
      document.getElementById("upload-doc-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const file = document.getElementById("ud-file")?.files?.[0];
        const docType = document.getElementById("ud-type").value;
        const vehId = document.getElementById("ud-vehicle-id").value || null;
        const btn = document.getElementById("btn-submit-doc-upload");

        if (!file) {
          alert("Please select a document file.");
          return;
        }

        btn.disabled = true;
        btn.innerText = "Uploading...";

        try {
          await VehicleService.uploadVerificationDocument(file, docType, vehId);
          alert("Document uploaded successfully! It is now pending admin verification.");
          document.getElementById("upload-doc-modal").style.display = "none";
          document.getElementById("upload-doc-form").reset();
          await this.loadDriverVehicles();
        } catch (err) {
          alert("Could not upload document: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerText = "Upload Document";
        }
      });

      // Photo Upload submit
      document.getElementById("btn-do-upload-photo")?.addEventListener("click", async () => {
        const file = document.getElementById("veh-photo-file-input")?.files?.[0];
        if (!file) {
          alert("Please select an image file to upload.");
          return;
        }
        if (!this.selectedVehicleForPhotos) return;

        const btn = document.getElementById("btn-do-upload-photo");
        btn.disabled = true;
        btn.innerText = "Uploading...";

        try {
          await VehicleService.uploadVehiclePhoto(this.selectedVehicleForPhotos.id, file);
          alert("Vehicle photo uploaded successfully!");
          document.getElementById("veh-photo-file-input").value = "";
          await this.loadDriverVehicles();
          // Re-open photos modal with fresh data
          const updated = this.driverVehicles.find(v => v.id === this.selectedVehicleForPhotos.id);
          this.openPhotosModal(updated || this.selectedVehicleForPhotos);
        } catch (err) {
          alert("Could not upload photo: " + err.message);
        } finally {
          btn.disabled = false;
          btn.innerText = "Upload";
        }
      });

      // Modal Close Listeners
      document.getElementById("btn-close-bid-modal")?.addEventListener("click", () => this.closeBidModal());
      document.getElementById("btn-cancel-bid")?.addEventListener("click", () => this.closeBidModal());
      document.getElementById("btn-close-sub-modal")?.addEventListener("click", () => this.closeSubModal());
      document.getElementById("btn-close-incomplete-modal")?.addEventListener("click", () => {
        document.getElementById("profile-incomplete-modal").style.display = "none";
      });
      document.getElementById("btn-close-edit-veh-modal")?.addEventListener("click", () => {
        document.getElementById("edit-vehicle-modal").style.display = "none";
      });
      document.getElementById("btn-cancel-edit-veh")?.addEventListener("click", () => {
        document.getElementById("edit-vehicle-modal").style.display = "none";
      });
      document.getElementById("btn-close-photos-modal")?.addEventListener("click", () => {
        document.getElementById("manage-photos-modal").style.display = "none";
      });
      document.getElementById("btn-close-doc-modal")?.addEventListener("click", () => {
        document.getElementById("upload-doc-modal").style.display = "none";
      });
      document.getElementById("btn-cancel-doc-upload")?.addEventListener("click", () => {
        document.getElementById("upload-doc-modal").style.display = "none";
      });

      // Bid Submit
      document.getElementById("bid-modal-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleBidSubmit();
      });
    } catch (err) {
      console.warn("DriverView init notice:", err.message);
    }
  },

  async loadDriverData() {
    try {
      const [entitlement, earnings, bookings, bids] = await Promise.all([
        BidService.checkEntitlement(),
        WalletService.getDriverEarnings(this.driverProfile?.user_id || this.driverProfile?.id),
        BookingService.getDriverBookings().catch(() => []),
        BidService.getDriverBids().catch(() => [])
      ]);
      this.isSubscribed = Boolean(entitlement.has_active_subscription);
      this.freeJobsUsed = Number(entitlement.awarded_jobs || 0);
      this.monthEarnings = Number(earnings.month || 0);
      this.driverBookings = bookings || [];
      this.driverBids = bids || [];
      this.activeBooking = (this.driverBookings || []).find(b => ["confirmed", "driver_arriving", "arrived", "in_progress"].includes(b.status)) || null;

      await this.updateSummaryCardsUI();
      this.renderActiveTripCard();
    } catch (err) {
      console.warn("Error loading driver data:", err.message);
    }
  },

  renderActiveTripCard() {
    const container = document.getElementById("driver-active-trip-container");
    if (!container) return;

    if (!this.activeBooking) {
      container.innerHTML = "";
      return;
    }

    const booking = this.activeBooking;
    const statusLabels = {
      confirmed: "BOOKING ACCEPTED",
      driver_arriving: "DRIVER EN ROUTE TO PICKUP",
      arrived: "ARRIVED · WAITING FOR TRIP PIN",
      in_progress: "TRIP IN PROGRESS"
    };
    const displayStatus = statusLabels[booking.status] || booking.status.toUpperCase();
    const pickup = escapeHtml(booking.request?.pickup_location || "Pickup Location");
    const dest = escapeHtml(booking.request?.destination || "Destination");
    const passengerName = escapeHtml(booking.passenger?.full_name || "Passenger");
    const amount = Number.parseFloat(booking.amount || 0).toFixed(2);

    let nextActionBtn = "";
    if (booking.status === "confirmed") {
      nextActionBtn = `
        <button type="button" class="btn btn-primary btn-sm btn-advance-status" data-booking-id="${booking.id}" data-next-status="driver_arriving" style="background: #2563eb; color: #ffffff; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; border: none;">
          I am on my way 🚗
        </button>
      `;
    } else if (booking.status === "driver_arriving") {
      nextActionBtn = `
        <button type="button" class="btn btn-primary btn-sm btn-advance-status" data-booking-id="${booking.id}" data-next-status="arrived" style="background: #2563eb; color: #ffffff; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; border: none;">
          I have arrived 📍
        </button>
      `;
    } else if (booking.status === "arrived") {
      nextActionBtn = `
        <button type="button" class="btn btn-primary btn-sm btn-advance-status" data-booking-id="${booking.id}" data-next-status="in_progress" style="background: #2563eb; color: #ffffff; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; border: none;">
          Start Trip 🏁
        </button>
      `;
    } else if (booking.status === "in_progress") {
      nextActionBtn = `
        <button type="button" class="btn btn-primary btn-sm btn-advance-status" data-booking-id="${booking.id}" data-next-status="completed" style="background: #059669; color: #ffffff; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; border: none;">
          Complete Trip ✓
        </button>
      `;
    }

    container.innerHTML = `
      <div class="card" style="background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 2px solid #2563eb; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.3rem;">🚗</span>
            <h3 style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0;">Active Assigned Trip</h3>
          </div>
          <span style="font-size: 0.75rem; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 9999px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe;">
            ${displayStatus}
          </span>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 1rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem;">
              ${pickup} → ${dest}
            </div>
            <div style="font-size: 0.85rem; color: #64748b;">
              Passenger: <strong>${passengerName}</strong> · Fare: <strong>$${amount}</strong>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <a href="#messages?booking=${booking.id}" class="btn btn-outline btn-sm" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.45rem 0.85rem; border-radius: 6px; font-weight: 600; text-decoration: none;">
              💬 Message Passenger
            </a>
            ${nextActionBtn}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll(".btn-advance-status").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const bId = e.currentTarget.getAttribute("data-booking-id");
        const nextStatus = e.currentTarget.getAttribute("data-next-status");
        if (!bId || !nextStatus) return;

        const actionBtn = e.currentTarget;
        const originalLabel = actionBtn.innerText;

        let options = {};
        if (nextStatus === "in_progress") {
          const pin = prompt("Please enter the 4-digit Trip PIN provided by the passenger to start the trip:");
          if (!pin) return;
          if (pin.trim().length !== 4) {
            alert("Trip PIN must be exactly 4 digits.");
            return;
          }
          options.pin = pin.trim();
        }

        actionBtn.disabled = true;
        actionBtn.innerText = "Updating...";

        try {
          await BookingService.updateBookingStatus(bId, nextStatus, options);
          alert(`Trip status successfully updated to: ${nextStatus.replace("_", " ").toUpperCase()}`);
          await this.loadDriverData();
          await this.loadRecentActivity();
          if (this.currentTab === "offers") await this.renderOffersTab();
        } catch (err) {
          alert("Could not update trip status: " + err.message);
          actionBtn.disabled = false;
          actionBtn.innerText = originalLabel;
        }
      });
    });
  },

  async loadDriverVehicles() {
    try {
      this.driverVehicles = await VehicleService.getDriverVehicles();
      
      if (this.driverVehicles.length > 0) {
        this.primaryVehicle = this.driverVehicles.find((v) => v.is_primary) || this.driverVehicles[0];
        const primaryEl = document.getElementById("hdr-primary-vehicle");
        if (primaryEl) {
          primaryEl.innerText = `${this.primaryVehicle.make} ${this.primaryVehicle.model} • ${this.primaryVehicle.registration_number}`;
          primaryEl.style.display = "block";
        }
      }

      const hasPhoto = Boolean(this.driverProfile?.profile_photo_url);
      const hasVeh = this.driverVehicles.length > 0;
      this.isProfileComplete = hasPhoto && hasVeh;

      const warningBanner = document.getElementById("driver-profile-warning-banner");
      if (warningBanner) {
        warningBanner.style.display = this.isProfileComplete ? "none" : "inline-flex";
      }

      this.renderVehiclesList();
    } catch (e) {
      console.warn("Error loading driver vehicles:", e.message);
    }
  },

  renderVehiclesList() {
    const container = document.getElementById("vehicles-full-list");
    if (!container) return;

    if (this.driverVehicles.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🚘</div>
          <div style="font-weight: 700; font-size: 1rem; color: #0f172a; margin-bottom: 0.25rem;">No vehicles added yet.</div>
          <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1rem;">Add your first vehicle to start receiving and accepting suitable jobs.</div>
          <button type="button" class="btn btn-primary" onclick="document.getElementById('add-vehicle-modal-card').style.display='block'" style="background: #2563eb; color: #ffffff; border: none; padding: 0.5rem 1.25rem; border-radius: 6px; font-weight: 700;">
            + Add Vehicle
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.driverVehicles.map((veh) => {
      const isPrimary = veh.is_primary || veh.id === this.primaryVehicle?.id;
      const photoCount = veh.photos?.length || 0;

      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${escapeHtml(veh.make)} ${escapeHtml(veh.model)} (${escapeHtml(veh.year)})</div>
                <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Plate: <strong>${escapeHtml(veh.registration_number)}</strong>${veh.color ? ` • ${escapeHtml(veh.color)}` : ""}</div>
              </div>
              <span class="badge" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 4px; ${veh.verification_status === "approved" ? "background: #dcfce7; color: #15803d;" : veh.verification_status === "rejected" ? "background:#fee2e2;color:#b91c1c;" : "background: #fef3c7; color: #92400e;"}">
                ${escapeHtml((veh.verification_status || "unverified").toUpperCase())}
              </span>
            </div>

            <div style="font-size: 0.8rem; color: #475569; margin-bottom: 0.75rem;">
              Category: <strong>${escapeHtml((veh.service_category || veh.vehicle_type || "unspecified").replace("_", " ").toUpperCase())}</strong>
            </div>
            ${veh.rejection_reason ? `<div style="font-size:0.8rem;color:#b91c1c;background:#fef2f2;padding:0.5rem;border-radius:5px;margin-bottom:0.75rem;">Needs attention: ${escapeHtml(veh.rejection_reason)}</div>` : ""}

            ${isPrimary ? `
              <div style="display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; margin-bottom: 0.75rem;">
                ★ Primary Vehicle
              </div>
            ` : ""}
          </div>

          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; border-top: 1px solid #f1f5f9; padding-top: 0.75rem; margin-top: 0.75rem;">
            ${!isPrimary ? `
              <button type="button" class="btn btn-outline btn-sm btn-set-primary-veh" data-veh-id="${veh.id}" style="border: 1px solid #2563eb; color: #2563eb; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 4px; font-weight: 700;">
                ★ Set Primary
              </button>
            ` : ""}
            <button type="button" class="btn btn-outline btn-sm btn-edit-veh" data-veh-id="${veh.id}" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 4px;">
              Edit
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-photos-veh" data-veh-id="${veh.id}" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 4px;">
              Photos (${photoCount})
            </button>
            <button type="button" class="btn btn-outline btn-sm btn-doc-veh" data-veh-id="${veh.id}" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 4px;">
              📄 Upload Doc
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Wire action buttons
    container.querySelectorAll(".btn-set-primary-veh").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const vId = e.currentTarget.getAttribute("data-veh-id");
        btn.disabled = true;
        try {
          await VehicleService.setPrimaryVehicle(vId);
          alert("Primary vehicle updated successfully!");
          await this.loadDriverVehicles();
        } catch (err) {
          alert("Could not set primary vehicle: " + err.message);
          btn.disabled = false;
        }
      });
    });

    container.querySelectorAll(".btn-edit-veh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const vId = e.currentTarget.getAttribute("data-veh-id");
        const veh = this.driverVehicles.find(v => v.id === vId);
        if (!veh) return;

        document.getElementById("ev-id").value = veh.id;
        document.getElementById("ev-make").value = veh.make || "";
        document.getElementById("ev-model").value = veh.model || "";
        document.getElementById("ev-year").value = veh.year || 2020;
        document.getElementById("ev-plate").value = veh.registration_number || "";
        document.getElementById("ev-color").value = veh.color || "White";

        document.getElementById("edit-vehicle-modal").style.display = "flex";
      });
    });

    container.querySelectorAll(".btn-photos-veh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const vId = e.currentTarget.getAttribute("data-veh-id");
        const veh = this.driverVehicles.find(v => v.id === vId);
        if (!veh) return;
        this.openPhotosModal(veh);
      });
    });

    container.querySelectorAll(".btn-doc-veh").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const vId = e.currentTarget.getAttribute("data-veh-id");
        document.getElementById("ud-vehicle-id").value = vId || "";
        document.getElementById("upload-doc-modal").style.display = "flex";
      });
    });
  },

  openPhotosModal(veh) {
    this.selectedVehicleForPhotos = veh;
    const modal = document.getElementById("manage-photos-modal");
    const gallery = document.getElementById("veh-photos-gallery");
    if (!modal || !gallery) return;

    const photos = veh.photo_documents || [];
    const photoUrls = veh.photos || [];

    if (photos.length === 0 && photoUrls.length === 0) {
      gallery.innerHTML = `<div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 6px;">No photos uploaded yet for this vehicle.</div>`;
    } else {
      gallery.innerHTML = photos.map((p, idx) => {
        const url = photoUrls[idx] || "";
        return `
          <div style="position: relative; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; height: 100px; background: #f1f5f9;">
            ${url ? `<img src="${url}" alt="Photo" style="width: 100%; height: 100%; object-fit: cover;" />` : `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">📷</div>`}
            <button type="button" class="btn-del-photo" data-photo-id="${p.$id || p.id}" style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: #ffffff; border: none; border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; cursor: pointer;">
              ✕
            </button>
          </div>
        `;
      }).join("");

      gallery.querySelectorAll(".btn-del-photo").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const photoId = e.currentTarget.getAttribute("data-photo-id");
          if (!confirm("Delete this vehicle photo?")) return;
          try {
            await VehicleService.deleteVehiclePhoto(photoId);
            await this.loadDriverVehicles();
            const updated = this.driverVehicles.find(v => v.id === veh.id);
            this.openPhotosModal(updated || veh);
          } catch (err) {
            alert("Could not delete photo: " + err.message);
          }
        });
      });
    }

    modal.style.display = "flex";
  },

  async renderOffersTab() {
    const container = document.getElementById("driver-offers-content");
    if (!container) return;

    try {
      const [bids, bookings] = await Promise.all([
        BidService.getDriverBids().catch(() => []),
        BookingService.getDriverBookings().catch(() => [])
      ]);

      const activeList = (bookings || []).filter(b => ["confirmed", "driver_arriving", "arrived", "in_progress"].includes(b.status));
      const completedList = (bookings || []).filter(b => b.status === "completed");
      const pendingBids = (bids || []).filter(b => b.status === "pending");
      const otherBids = (bids || []).filter(b => b.status !== "pending");

      container.innerHTML = `
        <!-- ACTIVE BOOKINGS / AWARDED JOBS -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem;">
            Active Awarded Jobs (${activeList.length})
          </h3>
          ${activeList.length === 0 ? `
            <div style="padding: 1.5rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 6px;">No active trips right now. When a customer accepts your quotation, it will appear here.</div>
          ` : activeList.map(b => {
            const pickup = escapeHtml(b.request?.pickup_location || "Pickup");
            const dest = escapeHtml(b.request?.destination || "Destination");
            const passenger = escapeHtml(b.passenger?.full_name || "Passenger");
            return `
              <div style="border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="font-weight: 800; color: #1e3a8a; font-size: 0.95rem;">${pickup} → ${dest}</div>
                  <div style="font-size: 0.85rem; color: #1e40af; margin-top: 0.2rem;">Passenger: <strong>${passenger}</strong> · Fare: <strong>$${Number.parseFloat(b.amount || 0).toFixed(2)}</strong></div>
                </div>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <span class="badge badge-primary" style="background: #2563eb; color: #ffffff; padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">${b.status.replace("_", " ").toUpperCase()}</span>
                  <a href="#messages?booking=${b.id}" class="btn btn-outline btn-sm" style="border: 1px solid #93c5fd; color: #1e40af; padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 4px; text-decoration: none;">💬 Message</a>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- PENDING QUOTATIONS / BIDS -->
        <div style="margin-bottom: 2rem;">
          <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem;">
            Pending Quotations (${pendingBids.length})
          </h3>
          ${pendingBids.length === 0 ? `
            <div style="padding: 1.5rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 6px;">No pending quotations. Browse <a href="#driver?tab=available" style="color: #2563eb; font-weight: 700;">Available Jobs</a> to submit quotes.</div>
          ` : pendingBids.map(bid => {
            const req = bid.request || {};
            const pickup = escapeHtml(req.pickup_location || "Pickup");
            const dest = escapeHtml(req.destination || "Destination");
            return `
              <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${pickup} → ${dest}</div>
                  <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Your Bid: <strong>$${Number.parseFloat(bid.amount || 0).toFixed(2)}</strong> · ETA: ~${bid.estimated_arrival_minutes || 15} mins · Submitted ${timeAgo(bid.created_at)}</div>
                  ${bid.message ? `<div style="font-size: 0.8rem; color: #64748b; font-style: italic; margin-top: 0.2rem;">“${escapeHtml(bid.message)}”</div>` : ""}
                </div>
                <div>
                  <span class="badge" style="background: #fef3c7; color: #92400e; padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">PENDING REVIEW</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- COMPLETED WORK HISTORY -->
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem;">
            Completed Work (${completedList.length})
          </h3>
          ${completedList.length === 0 ? `
            <div style="padding: 1.5rem; text-align: center; color: #64748b; background: #f8fafc; border-radius: 6px;">No completed jobs recorded yet.</div>
          ` : completedList.map(b => {
            const pickup = escapeHtml(b.request?.pickup_location || "Pickup");
            const dest = escapeHtml(b.request?.destination || "Destination");
            return `
              <div style="border: 1px solid #e2e8f0; background: #ffffff; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem;">${pickup} → ${dest}</div>
                  <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Earned: <strong>$${Number.parseFloat(b.amount || 0).toFixed(2)}</strong> · Completed ${timeAgo(b.completed_at || b.updated_at)}</div>
                </div>
                <span class="badge" style="background: #dcfce7; color: #15803d; padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">COMPLETED ✓</span>
              </div>
            `;
          }).join("")}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;">Could not load offers data: ${escapeHtml(err.message)}</div>`;
    }
  },

  async renderEarningsTab() {
    const container = document.getElementById("driver-earnings-content");
    if (!container) return;

    try {
      const driverId = this.driverProfile?.user_id || this.driverProfile?.id;
      const [earnings, transactions] = await Promise.all([
        WalletService.getDriverEarnings(driverId),
        WalletService.getTransactionHistory(driverId).catch(() => [])
      ]);

      const month = Number.parseFloat(earnings.month || 0).toFixed(2);
      const total = Number.parseFloat(earnings.total || 0).toFixed(2);
      const jobsCount = Number.parseInt(earnings.jobs_completed || 0, 10);

      container.innerHTML = `
        <!-- KPI METRICS -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">This Month</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #059669; margin-top: 0.25rem;">$${month}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Total All-Time</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #0f172a; margin-top: 0.25rem;">$${total}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Completed Trips</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #2563eb; margin-top: 0.25rem;">${jobsCount}</div>
          </div>
        </div>

        <!-- WALLET LEDGER TRANSACTIONS -->
        <div>
          <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem;">Verified Wallet Ledger</h3>
          ${transactions.length === 0 ? `
            <div style="padding: 2rem; text-align: center; color: #94a3b8; background: #f8fafc; border-radius: 6px;">No recorded transactions in wallet ledger yet.</div>
          ` : transactions.map(tx => `
            <div style="border: 1px solid #f1f5f9; padding: 0.85rem 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">${escapeHtml(tx.description || tx.category || "Transaction")}</div>
                <div style="font-size: 0.75rem; color: #94a3b8;">${tx.created_at ? new Date(tx.created_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : "Date pending"}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 1rem; color: ${tx.transaction_type === "credit" ? "#059669" : "#dc2626"};">
                  ${tx.transaction_type === "credit" ? "+" : "−"}$${Math.abs(Number.parseFloat(tx.amount || 0)).toFixed(2)}
                </div>
                <span class="badge" style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: 4px; ${tx.transaction_type === "credit" ? "background: #dcfce7; color: #15803d;" : "background: #f1f5f9; color: #475569;"}">
                  ${(tx.transaction_type || "recorded").toUpperCase()}
                </span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="padding: 2rem; text-align: center; color: #ef4444;">Could not load earnings: ${escapeHtml(err.message)}</div>`;
    }
  },

  async updateSummaryCardsUI() {
    const completedValEl = document.getElementById("card-jobs-completed-val");
    const progressBarEl = document.getElementById("card-jobs-progress-bar");
    if (completedValEl) {
      completedValEl.innerText = `${Math.min(this.freeJobsUsed, 5)} / 5`;
    }
    if (progressBarEl) {
      const pct = Math.min(100, Math.round((this.freeJobsUsed / 5) * 100));
      progressBarEl.style.width = `${pct}%`;
    }

    const earningsValEl = document.getElementById("card-total-earnings-val");
    if (earningsValEl) {
      earningsValEl.innerText = `$${this.monthEarnings.toFixed(2)}`;
    }

    const statusValEl = document.getElementById("card-account-status-val");
    const statusSubEl = document.getElementById("card-account-status-sub");

    if (this.isSubscribed) {
      if (statusValEl) statusValEl.innerText = "Professional";
      if (statusSubEl) statusSubEl.innerText = "Active subscription";
    } else {
      if (statusValEl) statusValEl.innerText = "Free Driver";
      const remaining = Math.max(0, 5 - this.freeJobsUsed);
      if (statusSubEl) statusSubEl.innerText = `${remaining} job${remaining === 1 ? "" : "s"} remaining`;
    }

    const presence = await PresenceService.getDriverPresence(this.driverProfile?.user_id || this.driverProfile?.id);
    const isOnline = Boolean(presence?.online);
    const onlineValEl = document.getElementById("card-online-status-val");
    const hdrOnlinePill = document.getElementById("hdr-online-pill");

    if (onlineValEl) {
      onlineValEl.innerText = isOnline ? "● Online" : "● Offline";
      onlineValEl.style.color = isOnline ? "#10b981" : "#64748b";
    }
    if (hdrOnlinePill) {
      if (isOnline) {
        hdrOnlinePill.style.background = "#ecfdf5";
        hdrOnlinePill.style.color = "#059669";
        hdrOnlinePill.style.borderColor = "#a7f3d0";
        hdrOnlinePill.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span> Online`;
      } else {
        hdrOnlinePill.style.background = "#f1f5f9";
        hdrOnlinePill.style.color = "#64748b";
        hdrOnlinePill.style.borderColor = "#cbd5e1";
        hdrOnlinePill.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span> Offline`;
      }
    }
  },

  async loadAvailableJobs() {
    const container = document.getElementById("available-jobs-container");
    if (!container) return;

    try {
      const [data, bids] = await Promise.all([
        RequestService.getAvailableRequestsForDrivers(),
        BidService.getDriverBids().catch(() => [])
      ]);
      const alreadyQuotedRequestIds = new Set(
        (bids || [])
          .filter((bid) => ["pending", "accepted"].includes(bid.status))
          .map((bid) => bid.request_id)
      );
      this.availableJobs = (data || []).filter((job) =>
        !alreadyQuotedRequestIds.has(job.id || job.$id)
      );

      if (this.availableJobs.length === 0) {
        container.innerHTML = `
          <div style="padding: 2rem 1rem; text-align: center; color: #64748b;">
            <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem;">No open jobs available right now.</div>
            <div style="font-size: 0.85rem; color: #64748b;">New customer requests will appear here automatically.</div>
          </div>
        `;
        return;
      }

      container.innerHTML = this.availableJobs.map((job) => `
        <div class="job-row" style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid #f1f5f9; gap: 1rem; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1; min-width: 220px;">
            <div style="width: 44px; height: 44px; border-radius: 6px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 1.35rem; flex-shrink: 0;">
              📦
            </div>
            <div>
              <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.15rem;">
                ${escapeHtml(job.load_description || job.details || job.service_type || job.request_type || "Transport request")}
              </div>
              <div style="font-size: 0.85rem; color: #475569; font-weight: 500;">
                ${escapeHtml(job.pickup_address || job.pickup_location || "Pickup")} → ${escapeHtml(job.destination_address || job.destination || "Destination")}
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">
                ${timeAgo(job.created_at)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a;">
              ${job.suggested_price || job.budget ? `$${parseFloat(job.suggested_price || job.budget).toFixed(0)}` : `<span style="font-size: 0.8rem; font-weight: 700; color: #94a3b8;">No budget</span>`}
            </div>
            <button class="btn btn-primary btn-view-bid" data-job-id="${job.id}" style="background: #2563eb; color: #ffffff; border: none; font-weight: 700; font-size: 0.85rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer;">
              View &amp; Bid
            </button>
          </div>
        </div>
      `).join("");

      container.querySelectorAll(".btn-view-bid").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const jobId = e.currentTarget.getAttribute("data-job-id");
          this.openBidModal(jobId);
        });
      });
    } catch (err) {
      container.innerHTML = `
        <div style="padding: 2rem 1rem; text-align: center; color: #64748b;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #0f172a; margin-bottom: 0.25rem;">No open jobs available right now.</div>
          <div style="font-size: 0.85rem; color: #64748b;">New customer requests will appear here automatically.</div>
        </div>
      `;
    }
  },

  async loadRecentActivity() {
    const container = document.getElementById("recent-activity-container");
    if (!container) return;

    const emptyState = `<div style="padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.875rem;">No recent activity yet.</div>`;

    try {
      if (!this.driverProfile) return;

      const [bids, bookings] = await Promise.all([
        BidService.getDriverBids().catch(() => []),
        BookingService.getDriverBookings().catch(() => [])
      ]);

      const describe = (request) =>
        request?.details || request?.goods_type || request?.pickup_location || "Transport Request";

      const activities = [];

      (bids || []).forEach((bid) => {
        const desc = describe(bid.request);
        if (bid.status === "accepted") {
          activities.push({
            type: "accepted",
            title: "Bid accepted",
            desc,
            time: bid.updated_at || bid.created_at,
            icon: "🔒",
            color: "#3b82f6"
          });
        } else if (bid.status === "pending") {
          activities.push({
            type: "bid",
            title: `Bid placed · $${Number.parseFloat(bid.amount || 0).toFixed(2)}`,
            desc,
            time: bid.created_at,
            icon: "✓",
            color: "#10b981"
          });
        }
      });

      (bookings || []).forEach((booking) => {
        if (booking.status === "completed") {
          activities.push({
            type: "completed",
            title: "Job completed",
            desc: describe(booking.request),
            time: booking.completed_at || booking.updated_at || booking.created_at,
            icon: "✓",
            color: "#10b981"
          });
        }
      });

      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      const recent = activities.slice(0, 5);

      if (recent.length === 0) {
        container.innerHTML = emptyState;
        return;
      }

      container.innerHTML = recent.map(act => `
        <div style="display: flex; align-items: center; gap: 0.85rem; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
          <div style="width: 26px; height: 26px; border-radius: 50%; background: ${act.color === "#10b981" ? "#ecfdf5" : "#eff6ff"}; color: ${act.color}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">
            ${act.icon}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 0.85rem; color: #0f172a;">${escapeHtml(act.title)}</span>
              <span style="font-size: 0.75rem; color: #94a3b8;">${timeAgo(act.time)}</span>
            </div>
            <div style="font-size: 0.8rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem;">
              ${escapeHtml(act.desc)}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = emptyState;
    }
  },

  subscribeToRealtimeJobs() {
    this.stopRealtimeJobs();
    this.realtimeSubscription = BidService.subscribeToJourneyUpdates(() => {
      if (this.syncRefreshTimer) clearTimeout(this.syncRefreshTimer);
      this.syncRefreshTimer = setTimeout(() => {
        this.syncRefreshTimer = null;
        this.syncDriverJourneyState().catch(() => {});
      }, 120);
    });
    this.realtimeChannel = setInterval(() => {
      this.syncDriverJourneyState().catch(() => {});
    }, 6000);
  },

  async syncDriverJourneyState() {
    if (this.syncBusy || !document.querySelector(".driver-dashboard-container")) return;
    this.syncBusy = true;
    try {
      const [availableJobs, bids, bookings] = await Promise.all([
        RequestService.getAvailableRequestsForDrivers(),
        BidService.getDriverBids(),
        BookingService.getDriverBookings()
      ]);
      const signature = JSON.stringify({
        jobs: (availableJobs || []).map((job) => [job.id || job.$id, job.status, job.updated_at]),
        bids: (bids || []).map((bid) => [bid.id || bid.$id, bid.status, bid.updated_at]),
        bookings: (bookings || []).map((booking) => [booking.id || booking.$id, booking.status, booking.updated_at])
      });
      if (signature === this.journeyStateSignature) return;
      this.journeyStateSignature = signature;

      this.availableJobs = availableJobs || [];
      this.driverBids = bids || [];
      this.driverBookings = bookings || [];
      this.activeBooking = this.driverBookings.find((booking) =>
        ["confirmed", "driver_arriving", "arrived", "in_progress"].includes(booking.status)
      ) || null;

      await this.loadDriverData();
      await this.loadAvailableJobs();
      await this.loadRecentActivity();
      if (this.currentTab === "offers") await this.renderOffersTab();
    } finally {
      this.syncBusy = false;
    }
  },

  stopRealtimeJobs() {
    if (this.realtimeChannel) {
      clearInterval(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    if (this.syncRefreshTimer) clearTimeout(this.syncRefreshTimer);
    this.syncRefreshTimer = null;
    this.realtimeSubscription?.unsubscribe?.();
    this.realtimeSubscription = null;
    this.syncBusy = false;
  },

  destroy() {
    this.stopRealtimeJobs();
    PresenceService.stopHeartbeat();
  },

  openBidModal(jobId) {
    if (!this.isProfileComplete) {
      const modal = document.getElementById("profile-incomplete-modal");
      if (modal) modal.style.display = "flex";
      return;
    }

    const job = this.availableJobs.find(j => j.id === jobId);
    if (!job) return;

    this.selectedJobForBid = job;

    const modal = document.getElementById("view-bid-modal");
    if (!modal) return;

    document.getElementById("bid-modal-job-title").innerText = job.load_description || job.details || job.service_type || "Transport request";
    document.getElementById("bid-modal-route").innerText = `${job.pickup_address || job.pickup_location || "Pickup"} → ${job.destination_address || job.destination || "Destination"}`;
    document.getElementById("bid-modal-budget").innerText = job.suggested_price || job.budget
      ? `$${parseFloat(job.suggested_price || job.budget).toFixed(2)}`
      : "No budget set";
    document.getElementById("bid-modal-desc").innerText = job.notes || job.details || job.load_description || "No further details were provided for this request.";
    document.getElementById("bid-modal-customer-info").innerText = `Posted ${timeAgo(job.created_at)}`;

    document.getElementById("input-bid-price").value = job.suggested_price || job.budget || "";
    document.getElementById("input-bid-eta").value = 15;
    document.getElementById("input-bid-message").value = "";

    modal.style.display = "flex";
  },

  closeBidModal() {
    const modal = document.getElementById("view-bid-modal");
    if (modal) modal.style.display = "none";
    this.selectedJobForBid = null;
  },

  openSubModal() {
    const modal = document.getElementById("sub-required-modal");
    if (modal) modal.style.display = "flex";
  },

  closeSubModal() {
    const modal = document.getElementById("sub-required-modal");
    if (modal) modal.style.display = "none";
  },

  async handleBidSubmit() {
    if (!this.selectedJobForBid) return;

    const price = parseFloat(document.getElementById("input-bid-price").value);
    const eta = parseInt(document.getElementById("input-bid-eta").value);
    const message = document.getElementById("input-bid-message").value;

    if (!price || price <= 0) {
      alert("Please enter a valid bid amount.");
      return;
    }

    const submitBtn = document.getElementById("btn-submit-bid-action");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";
    }

    try {
      await BidService.submitBid({
        requestId: this.selectedJobForBid.id || this.selectedJobForBid.$id,
        vehicleId: this.primaryVehicle?.id || this.primaryVehicle?.$id || null,
        proposedPrice: price,
        estimatedArrivalMins: Number.isNaN(eta) ? undefined : eta,
        message
      });

      alert("Bid submitted successfully! The passenger will review your quotation.");
      this.closeBidModal();
      await this.loadDriverData();
      await this.loadRecentActivity();
      await this.loadAvailableJobs();
    } catch (err) {
      if (err.subscriptionRequired || err.message?.includes("SUBSCRIPTION_REQUIRED")) {
        this.closeBidModal();
        this.openSubModal();
      } else {
        alert("Error submitting bid: " + err.message);
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = "Submit Bid ⚡";
      }
    }
  }
};
