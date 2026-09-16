// ==============================================================================
// TRANSMOVE DRIVER DASHBOARD VIEW — PIXEL-ALIGNED TO PANEL 1 REFERENCE
// Real Supabase Data: Profile Photo, Primary Vehicle, 5-Free-Jobs Enforcement,
// Clean Light UI (#F5F7FA), Compact Empty States, Real Activity, & Vehicles Tab
// ==============================================================================
import { getSupabase } from "../config/supabase.js";
import { AuthService } from "../services/auth.js";
import { PresenceService } from "../services/presence.js";
import { OfferService } from "../services/offers.js";
import { VehicleService } from "../services/vehicles.js";
import { RequestService } from "../services/requests.js";
import { BidService } from "../services/bids.js";
import { WalletService } from "../services/wallet.js";

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
  isProfileComplete: false,
  selectedJobForBid: null,
  realtimeChannel: null,
  currentTab: "dashboard", // 'dashboard' | 'available' | 'offers' | 'vehicles' | 'earnings'
  uploadedVehiclePhotoUrls: [],

  async render() {
    const rawHash = (window.location.hash || "").replace(/^#/, "");
    const tabMatch = rawHash.match(/tab=([a-z-]+)/);
    this.currentTab = tabMatch ? tabMatch[1] : "dashboard";

    return `
      <div class="driver-dashboard-container" style="max-width: 1440px; margin: 0 auto; padding: 0.25rem 0;">
        
        <!-- TOP HEADER AREA -->
        <div class="driver-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div>
            <h1 style="font-size: 1.45rem; font-weight: 800; color: #0f172a; margin: 0 0 0.2rem 0;">
              Welcome back, <span id="driver-display-name">Simba Musasu</span>
            </h1>
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 500;">
              Drive Smart. Move Zimbabwe.
            </div>

            <!-- Profile Completion Warning Banner (Only visible if profile incomplete) -->
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
                <span id="hdr-avatar-initials">S</span>
                <img id="hdr-avatar-img" src="" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              </div>
              <div style="text-align: left;">
                <div style="font-size: 0.9rem; font-weight: 700; color: #0f172a;" id="hdr-driver-name">Simba Musasu</div>
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 500;">Driver</div>
                <!-- Primary vehicle display -->
                <div id="hdr-primary-vehicle" style="display: none; font-size: 0.7rem; color: #2563eb; font-weight: 600;">
                  Toyota Aqua • ABC 1234
                </div>
              </div>
              <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 0.25rem;">▼</span>
            </a>
          </div>
        </div>

        <!-- 4 SUMMARY CARDS GRID -->
        <div class="summary-cards-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          
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

        <!-- MAIN 2-COLUMN SECTION: AVAILABLE JOBS (LEFT) & RECENT ACTIVITY (RIGHT) -->
        <div id="driver-main-dashboard-section" style="${this.currentTab === "dashboard" ? "display: grid;" : "display: none;"} grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: start; margin-bottom: 2rem;">
          
          <!-- LEFT LARGE CARD: AVAILABLE JOBS -->
          <div class="card" style="background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
              <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Available Jobs</h2>
              <a href="#driver?tab=available" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-decoration: none;">View All</a>
            </div>

            <!-- Realtime Available Jobs Feed -->
            <div id="available-jobs-container">
              <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.875rem;">
                Loading available jobs...
              </div>
            </div>
          </div>

          <!-- RIGHT CARD: RECENT ACTIVITY -->
          <div class="card" style="background: #ffffff; padding: 1.25rem 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9;">
              <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Recent Activity</h2>
              <a href="#driver?tab=activity" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-decoration: none;">View All</a>
            </div>

            <!-- Activity List Container -->
            <div id="recent-activity-container">
              <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.875rem;">
                Loading recent activity...
              </div>
            </div>
          </div>

        </div>

        <!-- VEHICLES PAGE (Rendered when route is #driver?tab=vehicles) -->
        <div id="driver-vehicles-tab-section" style="${this.currentTab === "vehicles" ? "display: block;" : "display: none;"} margin-bottom: 2rem;">
          <div class="card" style="background: #ffffff; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid #e2e8f0;">
              <div>
                <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">My Vehicles</h2>
                <div style="font-size: 0.85rem; color: #64748b; margin-top: 0.2rem;">Manage your transport vehicles, equipment listings, photos, and capacity.</div>
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

        <!-- MODAL 2: SUBSCRIPTION REQUIRED MODAL (PANEL 3 MATCH) -->
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

      </div>
    `;
  },

  async init() {
    try {
      this.driverProfile = await AuthService.getCurrentProfile();
      if (this.driverProfile) {
        // Start automatic presence heartbeat
        PresenceService.startHeartbeat(this.driverProfile.id);

        const displayName = this.driverProfile.full_name || "Simba Musasu";
        const nameEl = document.getElementById("driver-display-name");
        const hdrNameEl = document.getElementById("hdr-driver-name");
        const initialsEl = document.getElementById("hdr-avatar-initials");
        const imgEl = document.getElementById("hdr-avatar-img");

        if (nameEl) nameEl.innerText = displayName;
        if (hdrNameEl) hdrNameEl.innerText = displayName;
        
        // Show real Supabase profile photo if uploaded, otherwise initials
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

      // Subscribe to Supabase Realtime for newly posted jobs
      this.subscribeToRealtimeJobs();

      // Vehicle management toggle
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

      // Bind Modal listeners
      document.getElementById("btn-close-bid-modal")?.addEventListener("click", () => this.closeBidModal());
      document.getElementById("btn-cancel-bid")?.addEventListener("click", () => this.closeBidModal());
      document.getElementById("btn-close-sub-modal")?.addEventListener("click", () => this.closeSubModal());
      document.getElementById("btn-close-incomplete-modal")?.addEventListener("click", () => {
        document.getElementById("profile-incomplete-modal").style.display = "none";
      });

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
      const [entitlement, earnings] = await Promise.all([
        BidService.checkEntitlement(),
        WalletService.getDriverEarnings(this.driverProfile?.user_id || this.driverProfile?.id)
      ]);
      this.isSubscribed = Boolean(entitlement.has_active_subscription);
      this.freeJobsUsed = Number(entitlement.awarded_jobs || 0);
      this.monthEarnings = Number(earnings.month || 0);

      // Update Summary Cards UI
      this.updateSummaryCardsUI();
    } catch (err) {
      console.warn("Error loading driver data:", err.message);
    }
  },

  async loadDriverVehicles() {
    try {
      this.driverVehicles = await VehicleService.getDriverVehicles();
      
      // Determine primary vehicle
      if (this.driverVehicles.length > 0) {
        this.primaryVehicle = this.driverVehicles[0];
        const primaryEl = document.getElementById("hdr-primary-vehicle");
        if (primaryEl) {
          primaryEl.innerText = `${this.primaryVehicle.make} ${this.primaryVehicle.model} • ${this.primaryVehicle.registration_number}`;
          primaryEl.style.display = "block";
        }
      }

      // Check profile completeness (name, phone, profile picture, and at least 1 vehicle)
      const hasPhoto = Boolean(this.driverProfile?.profile_photo_url);
      const hasVeh = this.driverVehicles.length > 0;
      this.isProfileComplete = hasPhoto && hasVeh;

      const warningBanner = document.getElementById("driver-profile-warning-banner");
      if (warningBanner) {
        warningBanner.style.display = this.isProfileComplete ? "none" : "inline-flex";
      }

      // Render vehicles page list if on vehicles tab
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

    container.innerHTML = this.driverVehicles.map((veh, idx) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${veh.make} ${veh.model} (${veh.year})</div>
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">Plate: <strong>${veh.registration_number}</strong> • ${veh.color}</div>
          </div>
          <span class="badge ${veh.verification_status === "approved" ? "badge-success" : "badge-warning"}" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 4px; background: #dcfce7; color: #15803d;">
            ${veh.verification_status.toUpperCase()}
          </span>
        </div>

        <div style="font-size: 0.8rem; color: #475569; margin-bottom: 0.75rem;">
          Category: <strong>${(veh.service_category || veh.vehicle_type).replace("_", " ").toUpperCase()}</strong>
        </div>

        ${idx === 0 ? `
          <div style="display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; margin-bottom: 0.75rem;">
            ★ Primary Vehicle
          </div>
        ` : ""}

        <div style="display: flex; gap: 0.5rem; border-top: 1px solid #f1f5f9; padding-top: 0.75rem;">
          <a href="#driver?tab=vehicles" class="btn btn-outline btn-sm" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 4px; text-decoration: none;">Edit</a>
          <a href="#driver?tab=vehicles" class="btn btn-outline btn-sm" style="border: 1px solid #cbd5e1; color: #475569; padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 4px; text-decoration: none;">Manage Photos</a>
        </div>
      </div>
    `).join("");
  },

  updateSummaryCardsUI() {
    // Card 1: Jobs Completed
    const completedValEl = document.getElementById("card-jobs-completed-val");
    const progressBarEl = document.getElementById("card-jobs-progress-bar");
    if (completedValEl) {
      completedValEl.innerText = `${Math.min(this.freeJobsUsed, 5)} / 5`;
    }
    if (progressBarEl) {
      const pct = Math.min(100, Math.round((this.freeJobsUsed / 5) * 100));
      progressBarEl.style.width = `${pct}%`;
    }

    // Card 2: Total Earnings
    const earningsValEl = document.getElementById("card-total-earnings-val");
    if (earningsValEl) {
      earningsValEl.innerText = `$${this.monthEarnings.toFixed(2)}`;
    }

    // Card 3: Account Status
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

    // Card 4: Online Status
    const isOnline = PresenceService.isOnline(this.driverProfile?.updated_at || new Date().toISOString());
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
      const data = await RequestService.getAvailableRequestsForDrivers();
      this.availableJobs = data || [];

      if (this.availableJobs.length === 0) {
        // Compact clean empty state matching reference requirement 10
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
                ${job.load_description || job.pickup_address || "Move household items"}
              </div>
              <div style="font-size: 0.85rem; color: #475569; font-weight: 500;">
                ${job.pickup_address || "Harare"} → ${job.destination_address || "Chitungwiza"}
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">
                ${timeAgo(job.created_at)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="font-size: 1.2rem; font-weight: 800; color: #0f172a;">
              $${parseFloat(job.suggested_price || 0).toFixed(0)}
            </div>
            <button class="btn btn-primary btn-view-bid" data-job-id="${job.id}" style="background: #2563eb; color: #ffffff; border: none; font-weight: 700; font-size: 0.85rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer;">
              View &amp; Bid
            </button>
          </div>
        </div>
      `).join("");

      // Bind View & Bid buttons
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

    try {
      const supabase = getSupabase();
      if (!supabase || !this.driverProfile) return;

      const { data: offers } = await supabase
        .from("offers")
        .select("*, request:ride_requests(load_description, pickup_address)")
        .eq("driver_id", this.driverProfile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("*, request:ride_requests(load_description, pickup_address)")
        .eq("driver_id", this.driverProfile.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const activities = [];

      (offers || []).forEach(o => {
        const title = o.request?.load_description || "Transport Request";
        if (o.status === "accepted") {
          activities.push({
            type: "accepted",
            title: "Bid accepted",
            desc: title,
            time: o.updated_at || o.created_at,
            icon: "🔒",
            color: "#3b82f6"
          });
        } else {
          activities.push({
            type: "bid",
            title: "Bid placed",
            desc: title,
            time: o.created_at,
            icon: "✓",
            color: "#10b981"
          });
        }
      });

      (bookings || []).forEach(b => {
        const title = b.request?.load_description || "Transport Job";
        if (b.status === "completed") {
          activities.push({
            type: "completed",
            title: "Job completed",
            desc: title,
            time: b.completed_time || b.updated_at || b.created_at,
            icon: "✓",
            color: "#10b981"
          });
        }
      });

      // Sort by relative time descending
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      const recent = activities.slice(0, 5);

      if (recent.length === 0) {
        // Match requirement 11: clean compact empty state
        container.innerHTML = `<div style="padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.875rem;">No recent activity yet.</div>`;
        return;
      }

      container.innerHTML = recent.map(act => `
        <div style="display: flex; align-items: center; gap: 0.85rem; padding: 0.75rem 0; border-bottom: 1px solid #f1f5f9;">
          <div style="width: 26px; height: 26px; border-radius: 50%; background: ${act.color === "#10b981" ? "#ecfdf5" : "#eff6ff"}; color: ${act.color}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; flex-shrink: 0;">
            ${act.icon}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 700; font-size: 0.85rem; color: #0f172a;">${act.title}</span>
              <span style="font-size: 0.75rem; color: #94a3b8;">${timeAgo(act.time)}</span>
            </div>
            <div style="font-size: 0.8rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.1rem;">
              ${act.desc}
            </div>
          </div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div style="padding: 2rem 1rem; text-align: center; color: #94a3b8; font-size: 0.875rem;">No recent activity yet.</div>`;
    }
  },

  subscribeToRealtimeJobs() {
    const supabase = getSupabase();
    if (!supabase) return;

    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = supabase
      .channel("public:ride_requests_driver")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ride_requests" },
        () => {
          this.loadAvailableJobs();
        }
      )
      .subscribe();
  },

  openBidModal(jobId) {
    // Check eligibility: profile complete (name, photo, registered vehicle)
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

    document.getElementById("bid-modal-job-title").innerText = job.load_description || "Transport Request";
    document.getElementById("bid-modal-route").innerText = `${job.pickup_address || "Pickup"} → ${job.destination_address || "Destination"}`;
    document.getElementById("bid-modal-budget").innerText = `$${parseFloat(job.suggested_price || 0).toFixed(2)}`;
    document.getElementById("bid-modal-desc").innerText = job.notes || job.load_description || "Passenger or freight transportation requested.";
    document.getElementById("bid-modal-customer-info").innerText = `Posted by ${job.customer?.full_name || "Customer"} • ${timeAgo(job.created_at)}`;
    
    document.getElementById("input-bid-price").value = job.suggested_price || 10;
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

    const submitBtn = document.getElementById("btn-submit-bid-action");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";
    }

    try {
      await OfferService.submitOffer({
        requestId: this.selectedJobForBid.id,
        vehicleId: this.primaryVehicle?.id || null,
        proposedPrice: price,
        estimatedArrivalMins: eta,
        message
      });

      alert("🎉 Bid submitted successfully!");
      this.closeBidModal();
      await this.loadDriverData();
      await this.loadRecentActivity();
    } catch (err) {
      if (err.message === "SUBSCRIPTION_REQUIRED" || err.message?.includes("SUBSCRIPTION_REQUIRED")) {
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
