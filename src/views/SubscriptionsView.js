// ==============================================================================
// TRANSMOVE SUBSCRIPTIONS & MANUAL ECOCASH PAYMENT VIEW
// Multi-tier subscription plans (Flex Pass, Professional, Pro 90, Pro Annual)
// Manual EcoCash payment submission with admin verification.
// Passengers are 100% FREE & strictly excluded from subscriptions.
// ==============================================================================
import { SubscriptionService } from "../services/subscriptions.js";
import { PaymentService } from "../services/payments.js";
import { AuthService } from "../services/auth.js";
import { ReceiptService } from "../services/receipts.js";
import { Modal } from "../components/Modal.js";

export const SubscriptionsView = {
  currentProfile: null,
  plans: [],
  destinations: [],
  subStatus: null,
  paymentHistory: [],

  async render() {
    return `
      <div id="subscription-page-container" style="max-width: 1100px; margin: 0 auto; padding-top: 1rem; padding-bottom: 3rem;">
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">💳</div>
          Loading subscription options &amp; EcoCash channels...
        </div>
      </div>
    `;
  },

  async init() {
    const container = document.getElementById("subscription-page-container");
    if (!container) return;

    this.currentProfile = await AuthService.getCurrentProfile();

    // 1. PASSENGER CHECK: Passengers are 100% FREE
    if (this.currentProfile && (this.currentProfile.role === "customer" || this.currentProfile.role === "passenger")) {
      container.innerHTML = `
        <div class="card" style="max-width: 640px; margin: 2rem auto; text-align: center; padding: 2.5rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">🎉</div>
          <h2 style="font-size: 1.8rem; font-weight: 900; color: var(--text-main); margin-bottom: 0.5rem;">
            Passengers are 100% FREE!
          </h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem;">
            TransMove passenger accounts do not require a subscription. You can request transport, receive driver offers, negotiate fares, and travel freely across Zimbabwe without paying any subscription fees.
          </p>
          <a href="#customer" class="btn btn-primary btn-lg" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            🚗 Go to Passenger Dashboard
          </a>
        </div>
      `;
      return;
    }

    try {
      const [plans, destinations, subStatus, paymentHistory] = await Promise.all([
        SubscriptionService.getPlans(),
        SubscriptionService.getPaymentDestinations(),
        this.currentProfile ? SubscriptionService.getSubscriptionStatus().catch(() => null) : null,
        this.currentProfile ? SubscriptionService.getPaymentHistory().catch(() => []) : []
      ]);

      this.plans = plans;
      this.destinations = destinations;
      this.subStatus = subStatus;
      this.paymentHistory = paymentHistory;

      this.renderFullView(container);
    } catch (err) {
      console.error("Subscription view load error:", err);
      container.innerHTML = `
        <div class="card" style="padding: 2rem; text-align: center; color: var(--text-danger);">
          Failed to load subscription plans: ${err.message}
        </div>
      `;
    }
  },

  renderFullView(container) {
    const isSubscribed = Boolean(this.subStatus?.active);
    const planName = this.subStatus?.plan || "No Active Plan";
    const expiresAt = this.subStatus?.expires_at ? new Date(this.subStatus.expires_at).toLocaleDateString("en-GB", { dateStyle: "medium" }) : null;
    const freeJobsUsed = this.subStatus?.free_jobs_used ?? 0;
    const freeJobsRemaining = this.subStatus?.free_jobs_remaining ?? 5;

    container.innerHTML = `
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 2.5rem;">
        <span class="badge badge-info" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
          PROVIDER SUBSCRIPTION TIERS
        </span>
        <h1 style="font-size: 2.4rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.2rem 0; color: var(--text-main);">
          Plans &amp; EcoCash Payments
        </h1>
        <p style="color: var(--text-muted); font-size: 1.05rem; max-width: 660px; margin: 0.5rem auto 0 auto;">
          Choose a flexible pass or full monthly access. Pay securely via EcoCash and submit your confirmation reference for admin verification.
        </p>
      </div>

      <!-- Provider Status Banner -->
      <div class="card" style="margin-bottom: 2.5rem; padding: 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 700;">Account Status</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin-top: 0.2rem;">
              ${planName}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              ${isSubscribed ? `Active until ${expiresAt}` : "First 5 awarded jobs are free! Subscribe once you exhaust your free quota."}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <!-- Free Jobs Counter -->
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Free Jobs Quota</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: ${freeJobsRemaining > 0 ? 'var(--primary)' : 'var(--text-danger)'};">
                ${freeJobsUsed} / 5 used · ${freeJobsRemaining} free left
              </div>
            </div>

            <span class="badge ${isSubscribed ? "badge-success" : freeJobsRemaining > 0 ? "badge-info" : "badge-warning"}" style="font-size: 0.85rem; padding: 0.45rem 0.9rem;">
              ${isSubscribed ? "ACTIVE SUBSCRIBER" : freeJobsRemaining > 0 ? "FREE TRIAL ACTIVE" : "SUBSCRIPTION REQUIRED"}
            </span>
          </div>
        </div>
      </div>

      <!-- Pricing Plans Grid (4 Plans) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
        ${this.plans.map((plan) => this.renderPlanCard(plan)).join("")}
      </div>

      <!-- EcoCash Destination Channels Banner -->
      <div class="card" style="margin-bottom: 3rem; background: var(--bg-surface); border: 1px solid var(--border-light); padding: 1.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="font-size: 1.5rem;">📱</div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--text-main);">Approved TransMove EcoCash Accounts</h3>
            <p style="margin: 0.2rem 0 0 0; font-size: 0.85rem; color: var(--text-muted);">
              Payments are verified directly against these official admin numbers:
            </p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${this.destinations.map((dest) => `
            <div style="background: var(--bg-subtle, #f8fafc); border: 1px solid var(--border-light); border-radius: var(--radius-md, 8px); padding: 1rem 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${dest.account_name}</span>
                <span class="badge badge-success" style="font-size: 0.7rem;">Active</span>
              </div>
              <div style="font-family: monospace; font-size: 1.1rem; font-weight: 900; color: var(--primary); letter-spacing: 0.05em;">
                ${dest.account_number}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                EcoCash Zimbabwe · Personal Send Money
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Payment History & Receipts -->
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h3 class="card-title" style="margin: 0;">💳 EcoCash Payment History &amp; Vouchers</h3>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">All manual EcoCash submissions &amp; approval statuses</div>
          </div>
          <span class="badge badge-neutral">Admin Verified</span>
        </div>

        <div id="sub-history-list">
          ${this.paymentHistory.length === 0 ? `
            <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted);">
              No payment records submitted yet. Choose a plan above to subscribe with EcoCash.
            </div>
          ` : `
            <div class="table-responsive">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--border-light); color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase;">
                    <th style="padding: 0.75rem 0.5rem;">Date</th>
                    <th style="padding: 0.75rem 0.5rem;">Reference</th>
                    <th style="padding: 0.75rem 0.5rem;">EcoCash Ref</th>
                    <th style="padding: 0.75rem 0.5rem;">Amount</th>
                    <th style="padding: 0.75rem 0.5rem;">Recipient</th>
                    <th style="padding: 0.75rem 0.5rem;">Status</th>
                    <th style="padding: 0.75rem 0.5rem; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.paymentHistory.map((p) => {
                    const isApp = p.status === "approved" || p.status === "paid";
                    const isRej = p.status === "rejected";
                    const statusClass = isApp ? "badge-success" : isRej ? "badge-danger" : "badge-warning";
                    const statusText = isApp ? "APPROVED" : isRej ? "REJECTED" : "PENDING VERIFICATION";

                    return `
                      <tr style="border-bottom: 1px solid var(--border-light);">
                        <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">
                          ${p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                        </td>
                        <td style="padding: 0.75rem 0.5rem; font-weight: 700; color: var(--text-main);">
                          ${p.reference || p.$id}
                        </td>
                        <td style="padding: 0.75rem 0.5rem; font-family: monospace; color: var(--primary);">
                          ${p.transaction_reference || p.provider_reference || "—"}
                        </td>
                        <td style="padding: 0.75rem 0.5rem; font-weight: 800;">
                          $${Number(p.amount || 0).toFixed(2)} USD
                        </td>
                        <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">
                          ${p.recipient_name ? `${p.recipient_name} (${p.recipient_number})` : "EcoCash"}
                        </td>
                        <td style="padding: 0.75rem 0.5rem;">
                          <span class="badge ${statusClass}" style="font-size: 0.75rem;">${statusText}</span>
                          ${isRej && p.rejection_reason ? `
                            <div style="font-size: 0.75rem; color: var(--text-danger); margin-top: 0.2rem;">${p.rejection_reason}</div>
                          ` : ""}
                        </td>
                        <td style="padding: 0.75rem 0.5rem; text-align: right;">
                          <button class="btn btn-sm btn-outline btn-view-receipt" data-payment-id="${p.$id || p.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                            📄 Receipt
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    // Attach listeners
    this.attachEventListeners(container);
  },

  renderPlanCard(plan) {
    const isRecommended = Boolean(plan.recommended);
    const features = Array.isArray(plan.features) ? plan.features : [];

    return `
      <div class="card plan-card" style="padding: 1.75rem; background: var(--bg-surface); border: ${isRecommended ? '2px solid var(--primary)' : '1px solid var(--border-light)'}; border-radius: var(--radius-lg, 12px); display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: ${isRecommended ? '0 10px 25px -5px rgba(5,150,105,0.15)' : 'none'};">
        ${isRecommended ? `
          <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 0.2rem 0.85rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em;">
            MOST POPULAR
          </div>
        ` : ""}

        <div>
          <div style="font-size: 1.25rem; font-weight: 900; color: var(--text-main); margin-bottom: 0.25rem;">
            ${plan.name}
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); min-height: 2.4rem; margin: 0 0 1rem 0;">
            ${plan.description || ""}
          </p>

          <div style="margin-bottom: 1.25rem;">
            <span style="font-size: 2.2rem; font-weight: 900; color: var(--primary);">$${plan.price}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">/ ${plan.duration_days} days</span>
          </div>

          <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            ${features.map(f => `
              <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
                <span style="color: #10b981; font-weight: 900;">✓</span>
                <span style="color: var(--text-main);">${f}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <button class="btn ${isRecommended ? 'btn-primary' : 'btn-outline'} btn-full btn-select-plan" data-plan-id="${plan.$id || plan.id || plan.slug}" style="font-weight: 700;">
          Subscribe · Pay $${plan.price}
        </button>
      </div>
    `;
  },

  attachEventListeners(container) {
    // Select plan button -> Open EcoCash payment modal
    container.querySelectorAll(".btn-select-plan").forEach(btn => {
      btn.addEventListener("click", () => {
        const planId = btn.dataset.planId;
        const plan = this.plans.find(p => (p.$id || p.id || p.slug) === planId);
        if (plan) this.openEcocashPaymentModal(plan);
      });
    });

    // View receipt button
    container.querySelectorAll(".btn-view-receipt").forEach(btn => {
      btn.addEventListener("click", () => {
        const paymentId = btn.dataset.paymentId;
        const payment = this.paymentHistory.find(p => (p.$id || p.id) === paymentId);
        if (payment) ReceiptService.printPaymentReceipt(payment);
      });
    });
  },

  openEcocashPaymentModal(plan) {
    if (!this.destinations || this.destinations.length === 0) {
      alert("No active payment destinations configured. Please contact support.");
      return;
    }

    const modal = new Modal();
    const modalContent = `
      <div style="padding: 0.5rem;">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">📱</div>
          <h2 style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin: 0;">
            Pay with EcoCash: ${plan.name}
          </h2>
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">
            $${plan.price} USD · ${plan.duration_days} Days Access
          </div>
        </div>

        <!-- Step 1: Select EcoCash Destination -->
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-main);">
            1. Select TransMove EcoCash Account:
          </label>
          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${this.destinations.map((dest, idx) => `
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: 1px solid var(--border-light); border-radius: 8px; cursor: pointer; background: var(--bg-surface);" class="dest-radio-label">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="radio" name="ecocash_destination" value="${dest.$id || dest.id}" ${idx === 0 ? "checked" : ""} />
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${dest.account_name}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">EcoCash Number: <strong style="color: var(--primary);">${dest.account_number}</strong></div>
                  </div>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.7rem;">Verified Account</span>
              </label>
            `).join("")}
          </div>
        </div>

        <!-- USSD Transfer Instructions -->
        <div style="background: var(--bg-subtle, #f8fafc); border: 1px dashed var(--border-light); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; font-size: 0.8rem; line-height: 1.5; color: var(--text-muted);">
          <strong style="color: var(--text-main);">How to send:</strong><br/>
          1. Dial <strong>*151#</strong> on your EcoCash phone.<br/>
          2. Select <strong>Send Money</strong> and enter the chosen EcoCash number above.<br/>
          3. Enter <strong>$${plan.price}</strong> USD as the exact amount.<br/>
          4. Confirm and keep your EcoCash approval SMS / transaction reference.
        </div>

        <!-- Step 2: Verification Details Form -->
        <form id="ecocash-submission-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                Sender Full Name *
              </label>
              <input type="text" id="eco-sender-name" class="form-input" placeholder="e.g. Tendai Moyo" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                Sender EcoCash Phone *
              </label>
              <input type="tel" id="eco-sender-phone" class="form-input" placeholder="077... / 078..." required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                EcoCash Reference / SMS Code *
              </label>
              <input type="text" id="eco-transaction-ref" class="form-input" placeholder="e.g. MP260917.1320.A12345" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px; font-family: monospace; text-transform: uppercase;" />
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
                Amount Sent ($) *
              </label>
              <input type="number" id="eco-amount-declared" class="form-input" value="${plan.price}" step="0.5" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Proof of Payment Screenshot * (SMS or EcoCash App Receipt, Max 5MB)
            </label>
            <input type="file" id="eco-proof-file" accept="image/*,.pdf" required style="width: 100%; font-size: 0.8rem;" />
          </div>

          <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 0.75rem; font-size: 0.75rem; color: #92400e;">
            ⚠️ <strong>Admin Verification Required:</strong> Payments are verified manually by TransMove Administrators before subscription activation. No automatic approvals.
          </div>

          <div id="eco-submit-error" style="color: var(--text-danger); font-size: 0.8rem; display: none;"></div>

          <button type="submit" id="btn-submit-ecocash" class="btn btn-primary btn-full btn-lg" style="margin-top: 0.5rem; font-weight: 800;">
            Submit EcoCash Payment for Verification
          </button>
        </form>
      </div>
    `;

    modal.setContent(modalContent);
    modal.open();

    const form = document.getElementById("ecocash-submission-form");
    const submitBtn = document.getElementById("btn-submit-ecocash");
    const errorDiv = document.getElementById("eco-submit-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorDiv.style.display = "none";

      const selectedDestRadio = form.querySelector("input[name='ecocash_destination']:checked");
      const destinationId = selectedDestRadio ? selectedDestRadio.value : null;
      const senderName = document.getElementById("eco-sender-name").value.trim();
      const senderPhone = document.getElementById("eco-sender-phone").value.trim();
      const transactionRef = document.getElementById("eco-transaction-ref").value.trim().toUpperCase();
      const amountDeclared = parseFloat(document.getElementById("eco-amount-declared").value);
      const proofFileInput = document.getElementById("eco-proof-file");
      const proofFile = proofFileInput.files ? proofFileInput.files[0] : null;

      if (!destinationId) {
        errorDiv.textContent = "Please select an EcoCash destination account.";
        errorDiv.style.display = "block";
        return;
      }
      if (!proofFile) {
        errorDiv.textContent = "Please select a proof of payment screenshot or document.";
        errorDiv.style.display = "block";
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = "Uploading proof of payment...";

        // Step 1: Upload proof file
        const fileId = await SubscriptionService.uploadProof(proofFile);

        submitBtn.textContent = "Recording payment submission...";

        // Step 2: Submit payment
        await SubscriptionService.submitSubscriptionPayment({
          planId: plan.$id || plan.id || plan.slug,
          destinationId,
          senderName,
          senderPhone,
          transactionRef,
          proofFileId: fileId,
          amountDeclared
        });

        modal.close();
        alert("Payment Submitted! Your EcoCash transaction has been submitted for admin verification. You will be notified once it is approved.");

        // Refresh view
        this.init();
      } catch (err) {
        console.error("Payment submission failure:", err);
        errorDiv.textContent = err.message || "Failed to submit payment. Please try again.";
        errorDiv.style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit EcoCash Payment for Verification";
      }
    });
  }
};
