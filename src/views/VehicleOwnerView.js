// ==============================================================================
// TRANSMOVE VEHICLE OWNER VIEW
// Dedicated dashboard for users renting out vehicles, cars, and commercial fleets
// ==============================================================================
import { VehicleService } from "../services/vehicles.js";
import { renderEmptyState } from "../components/EmptyState.js";
import { AdPlacement } from "../components/AdPlacement.js";

export const VehicleOwnerView = {
  async render() {
    return `
      <div class="vehicle-owner-dashboard container" style="padding-top: 1.5rem; padding-bottom: 3rem;">
        <!-- Header Shell -->
        <div class="dashboard-header card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-hover) 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                <span class="badge badge-info" style="font-size: 0.75rem;">VEHICLE OWNER</span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">Vehicle Rentals &amp; Fleet Management</span>
              </div>
              <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0;">Manage your vehicle rentals</h1>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">List sedans, SUVs, mini-buses, or commercial trucks for rental or transport operations.</p>
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">TOTAL VEHICLES</div>
            <div id="kpi-veh-count" style="font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Registered fleet</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">ACTIVE RENTALS</div>
            <div id="kpi-veh-active" style="font-size: 1.6rem; font-weight: 800; color: #10b981; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Currently hired out</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">BOOKING REQUESTS</div>
            <div id="kpi-veh-requests" style="font-size: 1.6rem; font-weight: 800; color: #f59e0b; margin-top: 0.25rem;">0</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Pending approval</div>
          </div>
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">MONTHLY REVENUE</div>
            <div id="kpi-veh-revenue" style="font-size: 1.6rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">$0.00</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Rental income</div>
          </div>
        </div>

        ${AdPlacement.renderContainer("VEHICLE_OWNER_DASHBOARD")}

        <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <!-- Add Vehicle Form -->
          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">🚗 Register New Rental Vehicle</h3>
            <form id="add-vehicle-form">
              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Make</label>
                  <input type="text" id="veh-make" class="form-input" placeholder="e.g. Toyota" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Model</label>
                  <input type="text" id="veh-model" class="form-input" placeholder="e.g. Hilux / Vitz" required />
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Registration Number</label>
                  <input type="text" id="veh-reg" class="form-input" placeholder="e.g. ABF 1234" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Vehicle Type</label>
                  <select id="veh-type" class="form-select" required>
                    <option value="sedan">Sedan (Economy)</option>
                    <option value="suv">SUV / 4x4</option>
                    <option value="minibus">Commuter Minibus (14 Seater)</option>
                    <option value="pickup">Double Cab Pickup</option>
                    <option value="truck">Commercial Truck</option>
                  </select>
                </div>
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Year of Manufacture</label>
                  <input type="number" id="veh-year" class="form-input" placeholder="2020" min="2000" max="2027" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Daily Rental Rate ($ USD)</label>
                  <input type="number" id="veh-rate" class="form-input" placeholder="e.g. 45" min="5" required />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Operating City / Location</label>
                <input type="text" id="veh-location" class="form-input" placeholder="e.g. Harare CBD / Airport" required />
              </div>

              <button type="submit" id="btn-save-vehicle" class="btn btn-primary btn-full">
                Register &amp; Submit Vehicle for Verification 🚗
              </button>
            </form>
          </div>

          <!-- Listed Vehicles List -->
          <div class="card">
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 1.25rem;">🚘 Registered Vehicles Fleet</h3>
            <div id="vehicle-owner-list">
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
                Loading vehicle fleet...
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init() {
    this.bindEvents();
    await this.loadVehicles();
    AdPlacement.init("VEHICLE_OWNER_DASHBOARD");
  },

  bindEvents() {
    document.getElementById("add-vehicle-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const saveBtn = document.getElementById("btn-save-vehicle");
      saveBtn.disabled = true;
      saveBtn.innerText = "Registering Vehicle...";

      try {
        await VehicleService.addVehicle({
          make: document.getElementById("veh-make").value.trim(),
          model: document.getElementById("veh-model").value.trim(),
          registration_number: document.getElementById("veh-reg").value.trim().toUpperCase(),
          vehicle_type: document.getElementById("veh-type").value,
          year: parseInt(document.getElementById("veh-year").value, 10),
          color: "Silver",
          operating_area: document.getElementById("veh-location").value.trim()
        });

        alert("Vehicle registered successfully and submitted for administrative verification!");
        document.getElementById("add-vehicle-form").reset();
        await this.loadVehicles();
      } catch (err) {
        alert("Error registering vehicle: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Register & Submit Vehicle for Verification 🚗";
      }
    });
  },

  async loadVehicles() {
    const container = document.getElementById("vehicle-owner-list");
    if (!container) return;

    try {
      const vehicles = await VehicleService.getDriverVehicles();
      document.getElementById("kpi-veh-count").innerText = vehicles ? vehicles.length : 0;

      if (!vehicles || vehicles.length === 0) {
        container.innerHTML = renderEmptyState({
          title: "No vehicles registered yet",
          description: "Add your first sedan, pickup, or truck to begin receiving rental and transport booking requests.",
          icon: "car"
        });
        return;
      }

      container.innerHTML = vehicles.map(v => `
        <div style="border: 1px solid var(--border-light); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; font-size: 1rem;">${v.make} ${v.model} (${v.year})</div>
            <span class="badge ${v.verification_status === "approved" ? "badge-success" : "badge-warning"}">
              ${v.verification_status.toUpperCase()}
            </span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin: 0.25rem 0;">
            Reg: <strong>${v.registration_number}</strong> • Location: ${v.operating_area || "Harare"}
          </div>
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = renderEmptyState({
        title: "Vehicle System Ready",
        description: "Register a vehicle to sync records with Supabase.",
        icon: "car"
      });
    }
  }
};
