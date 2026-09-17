// ==============================================================================
// TRANSMOVE USER & DRIVER PROFILE VIEW
// Dynamic Profile Picture Upload (5MB limit, live preview, Appwrite Storage),
// Real Appwrite Profile Data, Account Creation Date & Verification Status
// ==============================================================================
import { AuthService } from "../services/auth.js";
import { VehicleService } from "../services/vehicles.js";
import { BookingService } from "../services/bids.js";
import { getAppwriteStorage, APPWRITE_CONFIG } from "../config/appwrite.js";

const escapeHtmlValue = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

export const ProfileView = {
  profile: null,
  completedJobsCount: 0,
  isPassengerView: false,

  renderPassengerProfile() {
    return `
      <div class="passenger-shell-page passenger-profile-page">
        <div class="passenger-page-heading">
          <div><h2>My Profile</h2><p>Manage your account information.</p></div>
        </div>
        <section class="card passenger-profile-card">
          <div class="passenger-profile-photo-column">
            <div id="prof-avatar-container" class="passenger-profile-avatar">
              <span id="prof-avatar-placeholder">P</span>
              <img id="prof-avatar-img" src="" alt="Profile photo" style="display:none;">
            </div>
            <label for="input-profile-photo-upload" class="btn btn-outline btn-sm passenger-photo-button">Change Photo</label>
            <input type="file" id="input-profile-photo-upload" accept="image/jpeg,image/jpg,image/png,image/webp" hidden>
            <strong id="prof-name-display">Passenger</strong>
            <small id="prof-email-display"></small>
          </div>

          <div class="passenger-profile-form-column">
            <div id="photo-preview-notice" class="profile-photo-preview" style="display:none;">
              <img id="photo-preview-img" src="" alt="Selected profile photo">
              <span><strong>New photo selected</strong><small id="photo-preview-filename"></small></span>
              <button type="button" id="btn-cancel-photo-upload" class="btn btn-outline btn-sm">Cancel</button>
              <button type="button" id="btn-save-photo-upload" class="btn btn-primary btn-sm">Upload &amp; Save</button>
            </div>
            <form id="edit-profile-form" class="passenger-profile-form">
              <label class="passenger-field"><span>Full Name</span><input type="text" id="prof-fullname" class="form-input" required></label>
              <label class="passenger-field"><span>Email</span><input type="email" id="prof-email-input" class="form-input" readonly></label>
              <label class="passenger-field"><span>Phone Number</span><input type="tel" id="prof-phone" class="form-input" placeholder="+263 77 123 4567"></label>
              <label class="passenger-field"><span>City / Location</span><input type="text" id="prof-area" class="form-input" placeholder="Harare"></label>
              <label class="passenger-field passenger-profile-bio"><span>Bio (Optional)</span><textarea id="prof-bio" class="form-textarea" rows="3" placeholder="Tell us a little about yourself."></textarea></label>
              <button type="submit" id="btn-save-profile" class="btn btn-primary passenger-submit-button">Save Changes</button>
            </form>
          </div>
        </section>
      </div>`;
  },

  async render(currentProfile = null) {
    this.isPassengerView = ["customer", "passenger"].includes(currentProfile?.role);
    if (this.isPassengerView) return this.renderPassengerProfile();
    return `
      <div style="max-width: 960px; margin: 0 auto; padding: 0.5rem 0;">
        <div class="card" style="background: #ffffff; padding: 2rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          
          <!-- PROFILE HEADER CARD -->
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 2rem; background: #f8fafc; padding: 1.5rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap;">
              
              <!-- Profile Picture / Avatar & Upload Trigger -->
              <div style="position: relative;">
                <div id="prof-avatar-container" style="width: 84px; height: 84px; border-radius: 50%; background: #2563eb; color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 800; overflow: hidden; border: 3px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <span id="prof-avatar-placeholder">👤</span>
                  <img id="prof-avatar-img" src="" alt="Profile Photo" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
                </div>
                
                <label for="input-profile-photo-upload" style="position: absolute; bottom: 0; right: 0; background: #059669; color: #ffffff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.85rem; border: 2px solid #ffffff;" title="Upload Profile Picture (Max 5MB)">
                  📷
                </label>
                <input type="file" id="input-profile-photo-upload" accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;" />
              </div>

              <div>
                <h2 id="prof-name-display" style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 0 0 0.25rem 0;">User Profile</h2>
                <div id="prof-email-display" style="color: #64748b; font-size: 0.9rem; font-weight: 500;">email@example.com</div>
                
                <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <span id="prof-role-badge" class="badge badge-info" style="background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">DRIVER</span>
                  <span id="prof-status-badge" class="badge badge-success" style="background: #dcfce7; color: #15803d; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">VERIFIED</span>
                  <span id="prof-rating-badge" style="font-size: 0.85rem; font-weight: 700; color: #d97706;">No ratings yet</span>
                </div>
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 1.25rem; border-radius: 8px; border: 1px solid #e2e8f0; min-width: 180px;">
              <div style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Completed Jobs</div>
              <div id="prof-completed-jobs-count" style="font-size: 1.5rem; font-weight: 900; color: #059669; margin: 0.1rem 0;">0</div>
              <div style="font-size: 0.75rem; color: #94a3b8;" id="prof-created-date">Member since 2026</div>
            </div>
          </div>

          <!-- Profile Photo Preview Modal / Notice -->
          <div id="photo-preview-notice" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <img id="photo-preview-img" src="" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />
              <div>
                <div style="font-weight: 700; font-size: 0.9rem; color: #065f46;">New Profile Photo Selected</div>
                <div style="font-size: 0.8rem; color: #047857;" id="photo-preview-filename">image.jpg (1.2 MB)</div>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" id="btn-cancel-photo-upload" class="btn btn-outline btn-sm" style="border: 1px solid #cbd5e1;">Cancel</button>
              <button type="button" id="btn-save-photo-upload" class="btn btn-primary btn-sm" style="background: #059669; color: #ffffff; border: none;">Upload &amp; Save 📷</button>
            </div>
          </div>

          <!-- PROFILE SECTIONS -->
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm prof-tab-btn active" data-tab="details">Personal Profile</button>
            <button class="btn btn-outline btn-sm prof-tab-btn" data-tab="verification">Verification &amp; Documents</button>
            <button class="btn btn-outline btn-sm prof-tab-btn" data-tab="vehicles">My Vehicles &amp; Equipment</button>
          </div>

          <!-- TAB 1: PERSONAL DETAILS FORM -->
          <div id="prof-tab-details">
            <form id="edit-profile-form">
              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Full Name</label>
                  <input type="text" id="prof-fullname" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Phone Number</label>
                  <input type="tel" id="prof-phone" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="+263 77 ..." />
                </div>
              </div>

              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Email Address (Read-only)</label>
                  <input type="email" id="prof-email-input" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #e2e8f0; background: #f8fafc; color: #64748b; border-radius: 6px;" readonly />
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">City / Operating Location</label>
                  <input type="text" id="prof-area" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" placeholder="e.g. Harare, Bulawayo, Mutare" />
                </div>
              </div>

              <div style="margin-bottom: 1.25rem;">
                <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Short Driver Bio (Optional)</label>
                <textarea id="prof-bio" class="form-textarea" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" rows="3" placeholder="Tell customers about your driving experience, vehicle capacity or delivery services..."></textarea>
              </div>

              <div style="display: flex; gap: 1rem;">
                <button type="submit" id="btn-save-profile" class="btn btn-primary" style="background: #2563eb; color: #ffffff; border: none; padding: 0.65rem 1.5rem; border-radius: 6px; font-weight: 700; flex: 1;">
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>

          <!-- TAB 2: VERIFICATION & PRIVATE DOCUMENTS -->
          <div id="prof-tab-verification" style="display: none;">
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
              <h4 style="font-weight: 700; margin: 0 0 0.25rem 0;">🔒 Private Driver Documents &amp; Verification</h4>
              <p style="font-size: 0.85rem; margin: 0;">Upload confidential documents (Driver's License, Vehicle Registration, Insurance Policy). Documents are kept strictly private in Appwrite Storage with access restricted to your account and TransMove verification.</p>
            </div>

            <div id="verification-readiness-summary" style="margin-bottom:1rem;">Loading verification status...</div>
            <div id="driver-documents-list" style="display:grid;gap:0.5rem;margin-bottom:1.25rem;"></div>

            <form id="driver-docs-upload-form">
              <div class="grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Document Type</label>
                  <select id="doc-type-select" class="form-select" style="width: 100%; padding: 0.65rem; border: 1px solid #cbd5e1; border-radius: 6px;" required>
                    <option value="driver_license">Driver's License</option>
                    <option value="vehicle_registration">Vehicle Registration Document</option>
                    <option value="insurance_policy">Vehicle Insurance Policy</option>
                    <option value="roadworthiness_certificate">Roadworthiness / Inspection Document</option>
                    <option value="national_id">National ID Card</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Select Document File (PDF / JPG / PNG)</label>
                  <input type="file" id="input-doc-file" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 6px;" required />
                </div>
              </div>

              <button type="submit" id="btn-upload-doc-action" class="btn btn-primary btn-full" style="background: #059669; color: #ffffff; border: none; padding: 0.75rem; border-radius: 6px; font-weight: 700; width: 100%;">
                Upload Private Verification Document 📄
              </button>
            </form>
          </div>

          <!-- TAB 3: VEHICLES -->
          <div id="prof-tab-vehicles" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0;">Registered Vehicles</h3>
              <a href="#driver" style="font-size: 0.85rem; font-weight: 700; color: #2563eb; text-decoration: none;">Manage in Driver Dashboard →</a>
            </div>
            <div id="prof-vehicles-list">Loading vehicles...</div>
          </div>

        </div>
      </div>
    `;
  },

  async init() {
    this.profile = await AuthService.getCurrentProfile();
    if (!this.profile) {
      window.location.hash = "#login";
      return;
    }

    // Calculate completed jobs
    try {
      const bookings = await BookingService.getUserBookings();
      this.completedJobsCount = (bookings || []).filter(b => b.status === "completed").length;
    } catch (e) {
      this.completedJobsCount = 0;
    }

    // Hydrate fields
    const nameEl = document.getElementById("prof-name-display");
    const emailEl = document.getElementById("prof-email-display");
    const emailInput = document.getElementById("prof-email-input");
    const roleBadge = document.getElementById("prof-role-badge");
    const statusBadge = document.getElementById("prof-status-badge");
    const completedJobsEl = document.getElementById("prof-completed-jobs-count");
    const createdDateEl = document.getElementById("prof-created-date");

    if (nameEl) nameEl.innerText = this.profile.full_name || (this.isPassengerView ? "Passenger" : "TransMove Driver");
    if (emailEl) emailEl.innerText = this.profile.email;
    if (emailInput) emailInput.value = this.profile.email;
    if (roleBadge) roleBadge.innerText = (this.profile.role || "driver").toUpperCase();
    
    if (statusBadge) {
      const st = this.profile.verification_status || "pending";
      statusBadge.innerText = st === "approved" ? "VERIFIED" : st.toUpperCase();
      statusBadge.style.background = st === "approved" ? "#dcfce7" : st === "rejected" ? "#fee2e2" : "#fffbeb";
      statusBadge.style.color = st === "approved" ? "#15803d" : st === "rejected" ? "#b91c1c" : "#b45309";
    }

    if (completedJobsEl) completedJobsEl.innerText = this.completedJobsCount;

    if (createdDateEl && this.profile.created_at) {
      const d = new Date(this.profile.created_at);
      createdDateEl.innerText = `Member since ${d.toLocaleDateString([], { month: "short", year: "numeric" })}`;
    }

    // Avatar image or initials
    const avatarPlaceholder = document.getElementById("prof-avatar-placeholder");
    const avatarImg = document.getElementById("prof-avatar-img");
    let avatarUrl = "";
    if (this.profile.profile_image_id) {
      try {
        avatarUrl = getAppwriteStorage().getFileView(APPWRITE_CONFIG.bucketId, this.profile.profile_image_id);
      } catch (urlErr) {
        console.warn("Profile photo URL notice:", urlErr.message);
      }
    }
    if (avatarUrl) {
      if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
      if (avatarImg) {
        avatarImg.src = avatarUrl;
        avatarImg.style.display = "block";
      }
    } else if (avatarPlaceholder) {
      avatarPlaceholder.innerText = this.profile.full_name ? this.profile.full_name.charAt(0).toUpperCase() : "👤";
    }

    // Populate inputs
    document.getElementById("prof-fullname").value = this.profile.full_name || "";
    document.getElementById("prof-phone").value = this.profile.phone_number || "";
    document.getElementById("prof-area").value = this.profile.service_area || "";
    document.getElementById("prof-bio").value = this.profile.bio || "";

    // Tab switching
    document.querySelectorAll(".prof-tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.currentTarget.getAttribute("data-tab");
        document.querySelectorAll(".prof-tab-btn").forEach(b => b.classList.remove("active"));
        e.currentTarget.classList.add("active");

        ["details", "verification", "vehicles"].forEach(t => {
          const el = document.getElementById(`prof-tab-${t}`);
          if (el) el.style.display = t === tab ? "block" : "none";
        });

        if (tab === "vehicles") this.loadProfileVehicles();
        if (tab === "verification") this.loadVerificationState();
      });
    });

    // Profile photo upload selection listener (Validation & Preview)
    let selectedPhotoFile = null;
    const photoInput = document.getElementById("input-profile-photo-upload");
    const previewNotice = document.getElementById("photo-preview-notice");
    const previewImg = document.getElementById("photo-preview-img");
    const previewFilename = document.getElementById("photo-preview-filename");

    photoInput?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        VehicleService.validateFile(file, { allowedTypes: ["image/jpeg", "image/png", "image/webp"], maxSizeMB: 5 });
        selectedPhotoFile = file;

        // Live preview
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (previewImg) previewImg.src = ev.target.result;
          if (previewFilename) previewFilename.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
          if (previewNotice) previewNotice.style.display = "flex";
        };
        reader.readAsDataURL(file);
      } catch (err) {
        alert(err.message);
        photoInput.value = "";
      }
    });

    document.getElementById("btn-cancel-photo-upload")?.addEventListener("click", () => {
      selectedPhotoFile = null;
      if (photoInput) photoInput.value = "";
      if (previewNotice) previewNotice.style.display = "none";
    });

    document.getElementById("btn-save-photo-upload")?.addEventListener("click", async () => {
      if (!selectedPhotoFile) return;
      const saveBtn = document.getElementById("btn-save-photo-upload");
      saveBtn.disabled = true;
      saveBtn.innerText = "Uploading...";

      try {
        const photoUrl = await VehicleService.uploadProfilePicture(selectedPhotoFile);
        alert("Profile picture uploaded successfully!");
        if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
        if (avatarImg) {
          avatarImg.src = photoUrl;
          avatarImg.style.display = "block";
        }
        if (previewNotice) previewNotice.style.display = "none";
      } catch (err) {
        alert("Error uploading profile photo: " + err.message);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "Upload & Save 📷";
      }
    });

    // Save profile form
    document.getElementById("edit-profile-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-save-profile");
      btn.disabled = true;
      btn.innerText = "Saving...";

      try {
        await AuthService.updateProfile({
          full_name: document.getElementById("prof-fullname").value.trim(),
          phone_number: document.getElementById("prof-phone").value.trim(),
          service_area: document.getElementById("prof-area").value.trim(),
          bio: document.getElementById("prof-bio").value.trim()
        });
        alert("Profile updated successfully!");
        window.location.reload();
      } catch (err) {
        alert("Error updating profile: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "Save Profile Changes";
      }
    });

    // Document upload form
    document.getElementById("driver-docs-upload-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const docType = document.getElementById("doc-type-select").value;
      const fileInput = document.getElementById("input-doc-file");
      const file = fileInput.files[0];
      if (!file) return;

      const btn = document.getElementById("btn-upload-doc-action");
      btn.disabled = true;
      btn.innerText = "Uploading Private Document...";

      try {
        await VehicleService.uploadVerificationDocument(file, docType);
        alert("Document uploaded securely to private storage and submitted for verification!");
        fileInput.value = "";
        await this.loadVerificationState();
      } catch (err) {
        alert("Error uploading document: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "Upload Private Verification Document 📄";
      }
    });

    if (!this.isPassengerView) await this.loadVerificationState();
  },

  async loadVerificationState() {
    const summaryContainer = document.getElementById("verification-readiness-summary");
    const documentsContainer = document.getElementById("driver-documents-list");
    if (!summaryContainer || !documentsContainer) return;

    const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
    const statusMeta = (status) => {
      const value = String(status || "unverified").toLowerCase();
      if (["approved", "verified"].includes(value)) return { label: "Approved", bg: "#dcfce7", color: "#15803d" };
      if (value === "rejected") return { label: "Rejected / Needs attention", bg: "#fee2e2", color: "#b91c1c" };
      if (value === "expired") return { label: "Expired", bg: "#fee2e2", color: "#b91c1c" };
      return { label: value === "pending" ? "Pending" : "Not submitted", bg: "#fef3c7", color: "#92400e" };
    };
    const badge = (label, status) => {
      const meta = statusMeta(status);
      return `<div style="border:1px solid #e2e8f0;border-radius:7px;padding:0.75rem;background:#fff;"><div style="font-size:0.75rem;color:#64748b;font-weight:700;text-transform:uppercase;">${escapeHtml(label)}</div><div style="display:inline-block;margin-top:0.3rem;padding:0.2rem 0.5rem;border-radius:4px;background:${meta.bg};color:${meta.color};font-size:0.78rem;font-weight:800;">${escapeHtml(meta.label)}</div></div>`;
    };

    try {
      const [profile, vehicles, documents] = await Promise.all([
        AuthService.getCurrentProfile(),
        VehicleService.getDriverVehicles(),
        VehicleService.getDriverDocuments()
      ]);
      this.profile = profile || this.profile;
      const now = Date.now();
      const effectiveDocuments = documents.map((document) => ({
        ...document,
        effective_status: document.expires_at && new Date(document.expires_at).getTime() < now
          ? "expired"
          : document.verification_status
      }));
      const vehicleStatus = vehicles.length === 0
        ? "unverified"
        : vehicles.some((vehicle) => vehicle.verification_status === "rejected")
          ? "rejected"
          : vehicles.some((vehicle) => ["pending", "unverified"].includes(vehicle.verification_status))
            ? "pending"
            : "approved";
      const documentStatus = effectiveDocuments.length === 0
        ? "unverified"
        : effectiveDocuments.some((document) => document.effective_status === "expired")
          ? "expired"
          : effectiveDocuments.some((document) => document.effective_status === "rejected")
            ? "rejected"
            : effectiveDocuments.some((document) => ["pending", "unverified"].includes(document.effective_status))
              ? "pending"
              : "verified";
      const isReady = profile?.verification_status === "approved" &&
        vehicles.some((vehicle) => vehicle.verification_status === "approved") &&
        effectiveDocuments.some((document) => document.effective_status === "verified");

      summaryContainer.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;">
          ${badge("Profile", profile?.verification_status)}
          ${badge("Vehicles", vehicleStatus)}
          ${badge("Documents", documentStatus)}
        </div>
        <div style="margin-top:0.75rem;padding:0.75rem;border-radius:7px;background:${isReady ? "#ecfdf5" : "#f8fafc"};color:${isReady ? "#047857" : "#475569"};font-size:0.85rem;font-weight:700;">
          ${isReady ? "Provider readiness: Verified components are ready." : "Provider readiness: Complete and obtain approval for every required component."}
        </div>
        ${profile?.verification_rejection_reason ? `<div style="margin-top:0.75rem;padding:0.75rem;border-radius:7px;background:#fef2f2;color:#991b1b;font-size:0.85rem;">Profile rejection reason: ${escapeHtml(profile.verification_rejection_reason)}</div>` : ""}`;

      documentsContainer.innerHTML = effectiveDocuments.length ? effectiveDocuments.map((document) => {
        const meta = statusMeta(document.effective_status);
        return `<div style="border:1px solid #e2e8f0;border-radius:7px;padding:0.75rem;display:flex;justify-content:space-between;align-items:center;gap:0.75rem;flex-wrap:wrap;">
          <div><strong>${escapeHtml((document.document_type || "document").replaceAll("_", " "))}</strong><div style="font-size:0.78rem;color:#64748b;">Uploaded ${new Date(document.created_at).toLocaleDateString("en-GB")}${document.expires_at ? ` · Expires ${new Date(document.expires_at).toLocaleDateString("en-GB")}` : ""}</div>${document.rejection_reason ? `<div style="font-size:0.78rem;color:#b91c1c;">${escapeHtml(document.rejection_reason)}</div>` : ""}</div>
          <div style="display:flex;align-items:center;gap:0.5rem;"><span style="padding:0.2rem 0.5rem;border-radius:4px;background:${meta.bg};color:${meta.color};font-size:0.75rem;font-weight:800;">${escapeHtml(meta.label)}</span><a href="${escapeHtml(document.view_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">View</a></div>
        </div>`;
      }).join("") : `<div style="padding:0.75rem;border:1px dashed #cbd5e1;border-radius:7px;color:#64748b;font-size:0.85rem;">No verification documents uploaded yet.</div>`;
    } catch (error) {
      summaryContainer.innerHTML = `<div style="color:#b91c1c;">Could not load verification status: ${escapeHtml(error.message)}</div>`;
      documentsContainer.innerHTML = "";
    }
  },

  async loadProfileVehicles() {
    const container = document.getElementById("prof-vehicles-list");
    if (!container) return;

    try {
      const vehicles = await VehicleService.getDriverVehicles();
      if (!vehicles || vehicles.length === 0) {
        container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: #64748b;">No registered vehicles yet. Add a vehicle on the Driver Dashboard.</div>`;
        return;
      }

      container.innerHTML = vehicles.map(v => `
        <div style="border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-weight: 700; font-size: 1rem; color: #0f172a;">${v.make} ${v.model} (${v.year})</div>
            <div style="font-size: 0.85rem; color: #64748b;">Plate: <strong>${v.registration_number}</strong> • Category: ${v.service_category || v.vehicle_type}</div>
          </div>
          <span class="badge ${v.verification_status === "approved" ? "badge-success" : v.verification_status === "rejected" ? "badge-danger" : "badge-warning"}" style="padding: 0.25rem 0.65rem; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">
            ${v.verification_status.toUpperCase()}
          </span>
          ${v.rejection_reason ? `<div style="font-size:0.78rem;color:#b91c1c;margin-top:0.35rem;">${escapeHtmlValue(v.rejection_reason)}</div>` : ""}
        </div>
      `).join("");
    } catch (err) {
      container.innerHTML = `<div style="padding: 1rem; color: #ef4444;">Error loading vehicles.</div>`;
    }
  }
};
