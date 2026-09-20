// ==============================================================================
// TRANSMOVE ADVERTISING MARKETPLACE & CALCULATOR VIEW (#advertise)
// Live Advertising Rate Cards, Dynamic Cost Calculator, Preset Ad Packages,
// Campaign Creation, and Manual EcoCash Payment Submission with Proof Upload.
// ==============================================================================
import { AdvertisingService } from "../services/advertising.js";
import { PaymentService } from "../services/payments.js";
import { AuthService } from "../services/auth.js";
import { Modal } from "../components/Modal.js";
import { icon } from "../components/Icon.js";

const escapeHtml = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const AdvertiseView = {
  currentProfile: null,
  rateCards: [],
  packages: [],
  destinations: [],
  selectedPackage: null,

  async render() {
    return `
      <div id="advertise-container" style="max-width: 1100px; margin: 0 auto; padding-top: 1rem; padding-bottom: 3rem;">
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <div class="feature-icon" style="margin-bottom: 0.5rem;">${icon("megaphone", 30)}</div>
          Loading advertising rates &amp; cost calculator...
        </div>
      </div>
    `;
  },

  async init() {
    const container = document.getElementById("advertise-container");
    if (!container) return;

    this.currentProfile = await AuthService.getCurrentProfile();

    try {
      const [rateCards, packages, destinations] = await Promise.all([
        AdvertisingService.getRateCards(),
        AdvertisingService.getPackages(),
        PaymentService.getPaymentDestinations()
      ]);

      this.rateCards = rateCards;
      this.packages = packages;
      this.destinations = destinations;

      this.renderFullView(container);
    } catch (err) {
      console.error("Failed to load advertising data:", err);
      container.innerHTML = `
        <div class="card" style="padding: 2rem; text-align: center; color: var(--text-danger);">
          Failed to load advertising services: ${err.message}
        </div>
      `;
    }
  },

  renderFullView(container) {
    container.innerHTML = `
      <!-- Hero Header -->
      <div class="card" style="background: linear-gradient(135deg, var(--bg-surface), var(--bg-subtle, #f8fafc)); padding: 2.25rem; border: 1px solid var(--border-light); margin-bottom: 2.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem;">
          <div style="max-width: 680px;">
            <span class="badge badge-info" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              TRANSMOVE PROMOTIONS &amp; ADS
            </span>
            <h1 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.25rem 0 0.5rem 0; color: var(--text-main);">
              Grow Your Business Across Zimbabwe
            </h1>
            <p style="color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin: 0;">
              Connect your fleet, logistics services, heavy machinery, or roadside support with thousands of active riders, drivers, and cargo shippers daily.
            </p>
          </div>
          <button id="btn-open-create-campaign" class="btn btn-primary btn-lg" style="font-weight: 800; display: flex; align-items: center; gap: 0.5rem;">
          ${icon("megaphone", 18)}<span>Launch Ad Campaign</span>
          </button>
        </div>
      </div>

      <!-- Preset Advertising Packages (Quick Launch) -->
      <div style="margin-bottom: 3rem;">
        <div style="margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--text-main); margin: 0;">
          ${icon("badge-percent", 20)}<span>Curated Advertising Packages</span>
          </h2>
          <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0.25rem 0 0 0;">
            Turnkey promotion bundles with built-in discount savings:
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem;">
          ${this.packages.map((pkg) => `
            <div class="card" style="padding: 1.75rem; background: var(--bg-surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg, 12px); display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-weight: 800; font-size: 1.15rem; color: var(--text-main);">${pkg.name}</span>
                  ${pkg.discount_label ? `<span class="badge badge-success" style="font-size: 0.75rem;">${pkg.discount_label}</span>` : ""}
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem; min-height: 2.5rem;">
                  ${pkg.description || ""}
                </p>
                <div style="margin-bottom: 1.25rem;">
                  <span style="font-size: 2.2rem; font-weight: 900; color: var(--primary);">$${pkg.price}</span>
                  <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">/ ${pkg.duration_days} days</span>
                </div>
              </div>
              <button class="btn btn-outline btn-full btn-select-pkg" data-pkg-slug="${pkg.slug}" style="font-weight: 700;">
                Choose ${pkg.name}
              </button>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Live Advertising Cost Calculator -->
      <div class="card" style="margin-bottom: 3rem; padding: 2rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
        <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1rem;">
          <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin: 0;">
        ${icon("calculator", 20)}<span>Advertising Cost Calculator</span>
          </h2>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.25rem 0 0 0;">
            Calculate your campaign budget based on placement rates, duration, and audience targeting.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 2rem; flex-wrap: wrap;" id="calculator-grid">
          <!-- Inputs -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">
                Ad Placement Slot *
              </label>
              <select id="calc-placement" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: 6px;">
                ${this.rateCards.map((c) => `
                  <option value="${c.placement}" data-base="${c.base_rate}" data-min="${c.minimum_days}" data-max="${c.maximum_days}" data-tmult="${c.targeting_multiplier}" data-fmult="${c.featured_multiplier}">
                    ${c.placement_label} ($${c.base_rate}/day, min ${c.minimum_days}d)
                  </option>
                `).join("")}
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">
                Campaign Duration (Days) *
              </label>
              <input type="number" id="calc-days" class="form-input" value="7" min="1" max="365" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: 6px;" />
              <div id="calc-duration-hint" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;"></div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.65rem;">
              <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                <input type="checkbox" id="calc-targeted" />
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
                  Targeted Route &amp; City Filter (+<span id="label-tmult">20</span>%)
                </span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer;">
                <input type="checkbox" id="calc-featured" />
                <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">
                  Featured Spotlight Glow &amp; Top Badge (+<span id="label-fmult">40</span>%)
                </span>
              </label>
            </div>
          </div>

          <!-- Live Breakdown Box -->
          <div style="background: var(--bg-subtle, #f8fafc); border: 1px solid var(--border-light); border-radius: 8px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.75rem;">
                Estimated Campaign Cost
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Base Rate:</span>
                <span id="calc-out-baserate" style="font-weight: 600; color: var(--text-main);">$10.00 / day</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Duration:</span>
                <span id="calc-out-duration" style="font-weight: 600; color: var(--text-main);">7 days</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Base Subtotal:</span>
                <span id="calc-out-basecost" style="font-weight: 600; color: var(--text-main);">$70.00</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">Targeting Multiplier:</span>
                <span id="calc-out-tmult" style="font-weight: 600; color: var(--text-main);">1.0x</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.75rem;">
                <span style="color: var(--text-muted);">Featured Multiplier:</span>
                <span id="calc-out-fmult" style="font-weight: 600; color: var(--text-main);">1.0x</span>
              </div>

              <div style="border-top: 1px dashed var(--border-light); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: baseline;">
                <span style="font-weight: 700; color: var(--text-main); font-size: 1rem;">Total USD:</span>
                <span id="calc-out-total" style="font-size: 1.8rem; font-weight: 900; color: var(--primary);">$70.00</span>
              </div>
            </div>

            <button id="btn-apply-calc-to-campaign" class="btn btn-primary btn-full" style="margin-top: 1.25rem; font-weight: 800;">
              Use This Budget to Launch Campaign
            </button>
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners(container);
    this.updateCalculator();
  },

  attachEventListeners(container) {
    // Calculator change listeners
    const placementSelect = document.getElementById("calc-placement");
    const daysInput = document.getElementById("calc-days");
    const targetedCheckbox = document.getElementById("calc-targeted");
    const featuredCheckbox = document.getElementById("calc-featured");

    placementSelect?.addEventListener("change", () => this.updateCalculator());
    daysInput?.addEventListener("input", () => this.updateCalculator());
    targetedCheckbox?.addEventListener("change", () => this.updateCalculator());
    featuredCheckbox?.addEventListener("change", () => this.updateCalculator());

    // Apply calculator to campaign button
    document.getElementById("btn-apply-calc-to-campaign")?.addEventListener("click", () => {
      this.selectedPackage = null;
      this.openCampaignModal();
    });

    // Preset package select buttons
    container.querySelectorAll(".btn-select-pkg").forEach(btn => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.pkgSlug;
        this.selectedPackage = this.packages.find(p => p.slug === slug);
        this.openCampaignModal();
      });
    });

    // Launch Campaign top button
    document.getElementById("btn-open-create-campaign")?.addEventListener("click", () => {
      this.selectedPackage = null;
      this.openCampaignModal();
    });
  },

  updateCalculator() {
    const placementSelect = document.getElementById("calc-placement");
    const daysInput = document.getElementById("calc-days");
    const targetedCheckbox = document.getElementById("calc-targeted");
    const featuredCheckbox = document.getElementById("calc-featured");
    if (!placementSelect || !daysInput) return;

    const selectedOption = placementSelect.selectedOptions[0];
    if (!selectedOption) return;

    const baseRate = parseFloat(selectedOption.dataset.base || 10);
    const minDays = parseInt(selectedOption.dataset.min || 1, 10);
    const maxDays = parseInt(selectedOption.dataset.max || 365, 10);
    const tMult = parseFloat(selectedOption.dataset.tmult || 1.2);
    const fMult = parseFloat(selectedOption.dataset.fmult || 1.4);

    let days = parseInt(daysInput.value, 10) || minDays;
    if (days < minDays) days = minDays;
    if (days > maxDays) days = maxDays;
    daysInput.min = minDays;
    daysInput.max = maxDays;

    const hint = document.getElementById("calc-duration-hint");
    if (hint) hint.textContent = `Allowed range: ${minDays} to ${maxDays} days for this placement.`;

    const labelT = document.getElementById("label-tmult");
    const labelF = document.getElementById("label-fmult");
    if (labelT) labelT.textContent = Math.round((tMult - 1) * 100);
    if (labelF) labelF.textContent = Math.round((fMult - 1) * 100);

    const isTargeted = targetedCheckbox ? targetedCheckbox.checked : false;
    const isFeatured = featuredCheckbox ? featuredCheckbox.checked : false;

    const effectiveTMult = isTargeted ? tMult : 1.0;
    const effectiveFMult = isFeatured ? fMult : 1.0;

    const baseCost = baseRate * days;
    const total = Math.round(baseCost * effectiveTMult * effectiveFMult * 100) / 100;

    const outBaseRate = document.getElementById("calc-out-baserate");
    const outDuration = document.getElementById("calc-out-duration");
    const outBaseCost = document.getElementById("calc-out-basecost");
    const outTMult = document.getElementById("calc-out-tmult");
    const outFMult = document.getElementById("calc-out-fmult");
    const outTotal = document.getElementById("calc-out-total");

    if (outBaseRate) outBaseRate.textContent = `$${baseRate.toFixed(2)} / day`;
    if (outDuration) outDuration.textContent = `${days} days`;
    if (outBaseCost) outBaseCost.textContent = `$${baseCost.toFixed(2)}`;
    if (outTMult) outTMult.textContent = `${effectiveTMult.toFixed(2)}x`;
    if (outFMult) outFMult.textContent = `${effectiveFMult.toFixed(2)}x`;
    if (outTotal) outTotal.textContent = `$${total.toFixed(2)}`;
  },

  openCampaignModal() {
    if (!this.currentProfile) {
      alert("Please sign in to launch an advertising campaign.");
      window.location.hash = "#login";
      return;
    }

    const pkg = this.selectedPackage;
    const placementSelect = document.getElementById("calc-placement");
    const defaultPlacement = pkg ? pkg.placement : (placementSelect ? placementSelect.value : "homepage_banner");
    const defaultDays = pkg ? pkg.duration_days : (document.getElementById("calc-days")?.value || 7);
    const estimatedPrice = pkg ? pkg.price : (parseFloat(document.getElementById("calc-out-total")?.textContent?.replace("$", "")) || 70);

    const modal = new Modal();
    const modalContent = `
      <div style="padding: 0.5rem; max-height: 80vh; overflow-y: auto;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
            <div class="feature-icon" style="margin-bottom: 0.25rem;">${icon("megaphone", 32)}</div>
          <h2 style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin: 0;">
            Launch Campaign: ${pkg ? pkg.name : "Custom Placement"}
          </h2>
          <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">
            Budget: $${estimatedPrice} USD (${defaultDays} Days)
          </div>
        </div>

        <form id="form-create-ad-campaign" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Campaign Details -->
          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Business / Company Name *
            </label>
            <input type="text" id="camp-business" class="form-input" placeholder="e.g. ZimLogistics Heavy Transport" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Campaign Title / Catchphrase *
            </label>
            <input type="text" id="camp-title" class="form-input" placeholder="e.g. Reliable Harare to Bulawayo Freight" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Ad Description / Special Offer
            </label>
            <textarea id="camp-desc" class="form-textarea" rows="2" placeholder="Brief promotion copy visible to users" style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;"></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                Destination URL / WhatsApp Link
              </label>
              <input type="url" id="camp-url" class="form-input" placeholder="https://..." style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                Banner Image Creative * (Max 5MB)
              </label>
              <input type="file" id="camp-img-file" accept="image/*" required style="width: 100%; font-size: 0.8rem;" />
            </div>
          </div>

          <!-- EcoCash Payment Selection -->
          <div style="border-top: 1px solid var(--border-light); padding-top: 1rem; margin-top: 0.5rem;">
            <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main);">
              Select EcoCash Account to Pay $${estimatedPrice} USD:
            </label>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
              ${this.destinations.map((d, i) => `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem 0.85rem; border: 1px solid var(--border-light); border-radius: 6px; cursor: pointer;">
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <input type="radio" name="camp_ecocash_dest" value="${d.$id || d.id}" ${i === 0 ? "checked" : ""} />
                    <span style="font-weight: 700; font-size: 0.85rem;">${d.account_name} (${d.account_number})</span>
                  </div>
                  <span class="badge badge-neutral" style="font-size: 0.65rem;">EcoCash</span>
                </label>
              `).join("")}
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                  Sender Name *
                </label>
                <input type="text" id="camp-sender-name" class="form-input" placeholder="EcoCash account name" required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border-light); border-radius: 6px;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                  Sender Phone *
                </label>
                <input type="tel" id="camp-sender-phone" class="form-input" placeholder="077... / 078..." required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border-light); border-radius: 6px;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.6rem;">
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                  EcoCash Transaction Ref *
                </label>
                <input type="text" id="camp-tx-ref" class="form-input" placeholder="e.g. MP260917.1320.A..." required style="width: 100%; padding: 0.55rem; border: 1px solid var(--border-light); border-radius: 6px; font-family: monospace; text-transform: uppercase;" />
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                  Proof of Transfer * (Screenshot)
                </label>
                <input type="file" id="camp-proof-file" accept="image/*,.pdf" required style="width: 100%; font-size: 0.75rem;" />
              </div>
            </div>
          </div>

          <div id="camp-submit-error" style="color: var(--text-danger); font-size: 0.8rem; display: none;"></div>

          <button type="submit" id="btn-submit-camp" class="btn btn-primary btn-full btn-lg" style="margin-top: 0.5rem; font-weight: 800;">
            Submit Campaign &amp; EcoCash Payment
          </button>
        </form>
      </div>
    `;

    modal.setContent(modalContent);
    modal.open();

    const form = document.getElementById("form-create-ad-campaign");
    const submitBtn = document.getElementById("btn-submit-camp");
    const errorDiv = document.getElementById("camp-submit-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorDiv.style.display = "none";

      const businessName = document.getElementById("camp-business").value.trim();
      const title = document.getElementById("camp-title").value.trim();
      const description = document.getElementById("camp-desc").value.trim();
      const destinationUrl = document.getElementById("camp-url").value.trim();
      const imgFileInput = document.getElementById("camp-img-file");
      const imgFile = imgFileInput.files ? imgFileInput.files[0] : null;

      const selectedDestRadio = form.querySelector("input[name='camp_ecocash_dest']:checked");
      const destinationId = selectedDestRadio ? selectedDestRadio.value : null;
      const senderName = document.getElementById("camp-sender-name").value.trim();
      const senderPhone = document.getElementById("camp-sender-phone").value.trim();
      const transactionRef = document.getElementById("camp-tx-ref").value.trim().toUpperCase();
      const proofFileInput = document.getElementById("camp-proof-file");
      const proofFile = proofFileInput.files ? proofFileInput.files[0] : null;

      if (!imgFile) {
        errorDiv.textContent = "Please upload an ad creative image.";
        errorDiv.style.display = "block";
        return;
      }
      if (!destinationId || !proofFile) {
        errorDiv.textContent = "Please select an EcoCash account and provide payment proof.";
        errorDiv.style.display = "block";
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading ad creative & proof...";

        // Step 1: Upload ad image and proof screenshot
        const [adImageFileId, proofFileId] = await Promise.all([
          AdvertisingService.uploadAdImage(imgFile),
          PaymentService.uploadPaymentProof(proofFile)
        ]);

        submitBtn.textContent = "Creating campaign...";

        // Step 2: Create campaign
        const campaignData = {
          business_name: businessName,
          title,
          description,
          destination_url: destinationUrl,
          image_file_id: adImageFileId,
          placement: defaultPlacement,
          duration_days: defaultDays,
          package_slug: pkg ? pkg.slug : undefined,
          is_targeted: document.getElementById("calc-targeted")?.checked || false,
          is_featured: document.getElementById("calc-featured")?.checked || false
        };
        const campaign = await AdvertisingService.submitCampaign(campaignData);

        submitBtn.textContent = "Submitting payment for verification...";

        // Step 3: Submit EcoCash payment linked to campaign
        await AdvertisingService.submitCampaignPayment({
          campaignId: campaign.$id,
          destinationId,
          senderName,
          senderPhone,
          transactionRef,
          proofFileId,
          amountDeclared: estimatedPrice
        });

        modal.close();
        alert("Campaign Submitted! Your advertising campaign and EcoCash payment have been submitted for admin review. Once verified, your ad will go live.");

        this.init();
      } catch (err) {
        console.error("Campaign submission error:", err);
        errorDiv.textContent = err.message || "Failed to submit campaign.";
        errorDiv.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Campaign & EcoCash Payment";
      }
    });
  }
};
