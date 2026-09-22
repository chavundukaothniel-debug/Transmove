// ==============================================================================
// TRANSMOVE SUBSCRIPTIONS & MANUAL ECOCASH PAYMENT VIEW
// Multi-tier subscription plans (Flex Pass, Professional, Pro 90, Pro Annual)
// Manual EcoCash payment submission with admin verification.
// Three Consistent Tabs: Plans & Pricing, Make Payment, Payment History & Status.
// Passengers are 100% FREE & strictly excluded from subscriptions.
// ==============================================================================
import { SubscriptionService } from "../services/subscriptions.js";
import { PaymentService } from "../services/payments.js";
import { AuthService } from "../services/auth.js";
import { ReceiptService } from "../services/receipts.js";
import { Modal } from "../components/Modal.js";
import { icon } from "../components/Icon.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

export const SubscriptionsView = {
  currentProfile: null,
  plans: [],
  destinations: [],
  subStatus: null,
  paymentHistory: [],
  activeTab: "plans", // 'plans' | 'payment' | 'history'
  selectedPlanId: null,
  refreshTimer: null,
  refreshInFlight: false,
  submissionInFlight: false,

  async render() {
    return `
      <div id="subscription-page-container" style="max-width: 1100px; margin: 0 auto; padding-top: 1rem; padding-bottom: 3rem;">
        <div class="tm-skeleton-state tm-skeleton-state--plans" aria-label="Loading subscription options and EcoCash channels"><i></i><i></i><i></i></div>
      </div>
    `;
  },

  async init() {
    this.stopLiveRefresh();
    const container = document.getElementById("subscription-page-container");
    if (!container) return;

    this.currentProfile = await AuthService.getCurrentProfile();

    // 1. PASSENGER CHECK: Passengers are 100% FREE
    if (this.currentProfile && (this.currentProfile.role === "customer" || this.currentProfile.role === "passenger")) {
      container.innerHTML = `
        <div class="card" style="max-width: 640px; margin: 2rem auto; text-align: center; padding: 2.5rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
          <div class="feature-icon" style="margin-bottom: 1rem;">${icon("party-popper", 52)}</div>
          <h2 style="font-size: 1.8rem; font-weight: 900; color: var(--text-main); margin-bottom: 0.5rem;">
            Passengers are 100% FREE!
          </h2>
          <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1.75rem;">
            TransMove passenger accounts do not require a subscription. You can request transport, receive driver offers, negotiate fares, and travel freely across Zimbabwe without paying any subscription fees.
          </p>
          <a href="#customer" class="btn btn-primary btn-lg" style="display: inline-flex; align-items: center; gap: 0.5rem;">
            ${icon("car-front", 18)}<span>Go to Passenger Dashboard</span>
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
      if (!this.selectedPlanId && plans.length > 0) {
        const defaultPlan = plans.find((p) => p.recommended || p.slug === "professional") || plans[0];
        this.selectedPlanId = defaultPlan.$id || defaultPlan.id;
      }

      this.renderFullView(container);
      this.startLiveRefresh();
    } catch (err) {
      console.error("Subscription view load error:", err);
      container.innerHTML = `
        <div class="card" style="padding: 2rem; text-align: center; color: var(--text-danger);">
          Failed to load subscription plans: ${escapeHtml(err.message)}
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
      <div style="text-align: center; margin-bottom: 2rem;">
        <span class="badge badge-info" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">
          PROVIDER SUBSCRIPTION TIERS
        </span>
        <h1 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.2rem 0; color: var(--text-main);">
          Plans &amp; EcoCash Payments
        </h1>
        <p style="color: var(--text-muted); font-size: 1rem; max-width: 660px; margin: 0.5rem auto 0 auto;">
          Choose a flexible pass or full monthly access. Pay securely via EcoCash and submit your confirmation reference for admin verification.
        </p>
      </div>

      <!-- Provider Status Banner -->
      <div class="card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 700;">Account Status</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin-top: 0.2rem;">
              ${escapeHtml(planName)}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              ${isSubscribed ? `Active until ${expiresAt}` : "First 5 awarded jobs are free! Subscribe once you exhaust your free quota."}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <!-- Free Jobs Counter -->
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Free Jobs Quota</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: ${freeJobsRemaining > 0 ? "var(--primary)" : "var(--text-danger)"};">
                ${freeJobsUsed} / 5 used · ${freeJobsRemaining} free left
              </div>
            </div>

            <span class="badge ${isSubscribed ? "badge-success" : freeJobsRemaining > 0 ? "badge-info" : "badge-warning"}" style="font-size: 0.85rem; padding: 0.45rem 0.9rem;">
              ${isSubscribed ? "ACTIVE SUBSCRIBER" : freeJobsRemaining > 0 ? "FREE TRIAL ACTIVE" : "SUBSCRIPTION REQUIRED"}
            </span>
          </div>
        </div>
      </div>

      <!-- TAB NAVIGATION -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 2px solid var(--border-light); padding-bottom: 0.5rem; flex-wrap: wrap;">
        <button type="button" class="btn btn-sm sub-nav-tab ${this.activeTab === "plans" ? "btn-primary" : "btn-outline"}" data-sub-tab="plans" style="font-weight: 700;">
          ${icon("layout-grid", 16)}<span>Plans &amp; Pricing</span>
        </button>
        <button type="button" class="btn btn-sm sub-nav-tab ${this.activeTab === "payment" ? "btn-primary" : "btn-outline"}" data-sub-tab="payment" style="font-weight: 700;">
          ${icon("smartphone", 16)}<span>Make Payment</span>
        </button>
        <button type="button" class="btn btn-sm sub-nav-tab ${this.activeTab === "history" ? "btn-primary" : "btn-outline"}" data-sub-tab="history" style="font-weight: 700;">
          ${icon("receipt-text", 16)}<span>Payment History &amp; Status (${this.paymentHistory.length})</span>
        </button>
      </div>

      <!-- TAB 1: PLANS & PRICING -->
      <div id="sub-tab-panel-plans" style="display: ${this.activeTab === "plans" ? "block" : "none"};">
        <!-- Pricing Plans Grid (4 Plans) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2.5rem;">
          ${this.plans.map((plan) => this.renderPlanCard(plan)).join("")}
        </div>

        <!-- EcoCash Destination Channels Banner -->
        <div class="card" style="background: var(--bg-surface); border: 1px solid var(--border-light); padding: 1.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
            <div class="feature-icon">${icon("smartphone", 24)}</div>
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
                  <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${escapeHtml(dest.account_name)}</span>
                  <span class="badge badge-success" style="font-size: 0.7rem;">Active</span>
                </div>
                <div style="font-family: monospace; font-size: 1.1rem; font-weight: 900; color: var(--primary); letter-spacing: 0.05em;">
                  ${escapeHtml(dest.account_number)}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">
                  EcoCash Zimbabwe · Personal Send Money
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- TAB 2: MAKE PAYMENT -->
      <div id="sub-tab-panel-payment" style="display: ${this.activeTab === "payment" ? "block" : "none"};">
        <div class="card" style="max-width: 680px; margin: 0 auto; padding: 2rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
          ${this.renderPaymentForm()}
        </div>
      </div>

      <!-- TAB 3: PAYMENT HISTORY -->
      <div id="sub-tab-panel-history" style="display: ${this.activeTab === "history" ? "block" : "none"};">
        <div class="card">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <div>
              <h3 class="card-title icon-label" style="margin: 0;">${icon("credit-card", 20)}<span>EcoCash Payment History &amp; Vouchers</span></h3>
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
                      <th style="padding: 0.75rem 0.5rem;">Plan</th>
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
                      const statusText = isApp ? "APPROVED" : isRej ? "REJECTED" : "PENDING REVIEW";

                      return `
                        <tr style="border-bottom: 1px solid var(--border-light);">
                          <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">
                            ${p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td style="padding: 0.75rem 0.5rem; font-weight: 700; color: var(--text-main);">
                            ${escapeHtml(p.reference || p.$id || p.id)}
                          </td>
                          <td style="padding: 0.75rem 0.5rem; font-family: monospace; color: var(--primary);">
                            ${escapeHtml(p.transaction_reference || p.provider_reference || "—")}
                          </td>
                          <td style="padding: 0.75rem 0.5rem; font-weight: 800;">
                            $${Number(p.amount || 0).toFixed(2)} USD
                          </td>
                          <td style="padding: 0.75rem 0.5rem; color: var(--text-main);">
                            ${escapeHtml(p.plan_name || p.subscription?.plan || "Subscription")}
                          </td>
                          <td style="padding: 0.75rem 0.5rem; color: var(--text-muted);">
                            ${p.recipient_name ? `${escapeHtml(p.recipient_name)} (${escapeHtml(p.recipient_number)})` : "EcoCash"}
                          </td>
                          <td style="padding: 0.75rem 0.5rem;">
                            <span class="badge ${statusClass}" style="font-size: 0.75rem;">${statusText}</span>
                            ${isRej && p.rejection_reason ? `
                              <div style="font-size: 0.75rem; color: var(--text-danger); margin-top: 0.2rem;">${escapeHtml(p.rejection_reason)}</div>
                            ` : ""}
                          </td>
                          <td style="padding: 0.75rem 0.5rem; text-align: right;">
                            <button class="btn btn-sm btn-outline btn-view-receipt" data-payment-id="${p.$id || p.id}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;">
                              ${icon("receipt-text", 16)}<span>Receipt</span>
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
      </div>
    `;

    // Attach listeners
    this.attachEventListeners(container);
  },

  renderPlanCard(plan) {
    const isRecommended = Boolean(plan.recommended);
    const features = Array.isArray(plan.features) ? plan.features : [];

    return `
      <div class="card plan-card" style="padding: 1.75rem; background: var(--bg-surface); border: ${isRecommended ? "2px solid var(--primary)" : "1px solid var(--border-light)"}; border-radius: var(--radius-lg, 12px); display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: ${isRecommended ? "0 10px 25px -5px rgba(5,150,105,0.15)" : "none"};">
        ${isRecommended ? `
          <div style="position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 0.2rem 0.85rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.05em;">
            MOST POPULAR
          </div>
        ` : ""}

        <div>
          <div style="font-size: 1.25rem; font-weight: 900; color: var(--text-main); margin-bottom: 0.25rem;">
            ${escapeHtml(plan.name)}
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); min-height: 2.4rem; margin: 0 0 1rem 0;">
            ${escapeHtml(plan.description || "")}
          </p>

          <div style="margin-bottom: 1.25rem;">
            <span style="font-size: 2.2rem; font-weight: 900; color: var(--primary);">$${plan.price}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: 600;">/ ${plan.duration_days} days</span>
          </div>

          <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            ${features.map((f) => `
              <li style="display: flex; align-items: flex-start; gap: 0.5rem;">
                <span style="color: #10b981; font-weight: 900;">${icon("check", 16)}</span>
                <span style="color: var(--text-main);">${escapeHtml(f)}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <button class="btn ${isRecommended ? "btn-primary" : "btn-outline"} btn-full btn-select-plan" data-plan-id="${plan.$id || plan.id}" style="font-weight: 700;">
          Subscribe · Pay $${plan.price}
        </button>
      </div>
    `;
  },

  renderPaymentForm(preselectedPlan = null) {
    const selectedPlan = preselectedPlan || this.plans.find((p) => (p.$id || p.id) === this.selectedPlanId) || this.plans[0];
    const planId = selectedPlan ? (selectedPlan.$id || selectedPlan.id) : "";
    const planPrice = selectedPlan ? selectedPlan.price : 15;
    const planDuration = selectedPlan ? selectedPlan.duration_days : 30;

    return `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div class="feature-icon" style="margin-bottom: 0.35rem;">${icon("smartphone", 32)}</div>
        <h2 style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin: 0;">
          Submit EcoCash Payment
        </h2>
        <div id="payment-form-plan-summary" style="font-size: 1.15rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">
          ${escapeHtml(selectedPlan?.name || "Professional")} · $${planPrice} USD (${planDuration} Days)
        </div>
      </div>

      <form id="ecocash-submission-form" style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Step 1: Select Plan -->
        <div>
          <label style="display: block; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--text-main);">
            1. Selected Subscription Plan:
          </label>
          <select id="payment-plan-select" class="form-input" style="width: 100%; padding: 0.65rem; border: 1px solid var(--border-light); border-radius: 6px; font-weight: 700; color: var(--text-main); background: var(--bg-surface);">
            ${this.plans.map((p) => `
              <option value="${p.$id || p.id}" ${(p.$id || p.id) === planId ? "selected" : ""}>
                ${escapeHtml(p.name)} — $${p.price} USD (${p.duration_days} days)
              </option>
            `).join("")}
          </select>
        </div>

        <!-- Step 2: Select EcoCash Destination -->
        <div>
          <label style="display: block; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem; color: var(--text-main);">
            2. Select TransMove EcoCash Account:
          </label>
          <div id="payment-destinations-container" style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${this.destinations.map((dest, idx) => `
              <label class="dest-radio-label" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border: ${idx === 0 ? "2px solid var(--primary)" : "1px solid var(--border-light)"}; border-radius: 8px; cursor: pointer; background: var(--bg-surface); transition: border-color 0.15s ease;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <input type="radio" name="ecocash_destination" value="${dest.$id || dest.id}" ${idx === 0 ? "checked" : ""} />
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${escapeHtml(dest.account_name)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">EcoCash Number: <strong style="color: var(--primary);">${escapeHtml(dest.account_number)}</strong></div>
                  </div>
                </div>
                <span class="badge badge-neutral" style="font-size: 0.7rem;">Verified Account</span>
              </label>
            `).join("")}
          </div>
        </div>

        <!-- USSD Transfer Instructions -->
        <div style="background: var(--bg-subtle, #f8fafc); border: 1px dashed var(--border-light); border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.8rem; line-height: 1.5; color: var(--text-muted);">
          <strong style="color: var(--text-main);">How to send:</strong><br/>
          1. Dial <strong>*151#</strong> on your EcoCash phone.<br/>
          2. Select <strong>Send Money</strong> and enter the chosen EcoCash number above.<br/>
          3. Enter <strong>$<span id="payment-instruction-amount">${planPrice}</span></strong> USD as the exact amount.<br/>
          4. Confirm and keep your EcoCash approval SMS / transaction reference.
        </div>

        <!-- Step 3: Verification Details Form -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Sender Full Name *
            </label>
            <input type="text" id="eco-sender-name" class="form-input" placeholder="e.g. Tendai Moyo" value="${escapeHtml(this.currentProfile?.full_name || "")}" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
              Sender EcoCash Phone *
            </label>
            <input type="tel" id="eco-sender-phone" class="form-input" placeholder="077... / 078..." value="${escapeHtml(this.currentProfile?.phone_number || "")}" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
            EcoCash Reference / SMS Approval Code *
          </label>
          <input type="text" id="eco-transaction-ref" class="form-input" placeholder="e.g. MP260917.1320.A12345" required style="width: 100%; padding: 0.6rem; border: 1px solid var(--border-light); border-radius: 6px; font-family: monospace; text-transform: uppercase;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.25rem; color: var(--text-main);">
            Proof of Payment * (JPG, PNG, or PDF, Max 5MB)
          </label>
          <input type="file" id="eco-proof-file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" required style="width: 100%; font-size: 0.8rem;" />
          <div id="eco-proof-file-name" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.3rem;">No file selected</div>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; padding: 0.75rem; font-size: 0.75rem; color: #92400e;">
          ${icon("triangle-alert", 18)} <strong>Admin Verification Required:</strong> Payments are verified manually by TransMove Administrators before subscription activation. No automatic approvals.
        </div>

        <div id="eco-submit-error" style="color: var(--text-danger); font-size: 0.8rem; display: none;"></div>

        <button type="submit" id="btn-submit-ecocash" class="btn btn-primary btn-full btn-lg" style="margin-top: 0.5rem; font-weight: 800; min-height: 48px;">
          Submit EcoCash Payment for Verification
        </button>
      </form>
    `;
  },

  attachEventListeners(container) {
    // Tab switching
    container.querySelectorAll(".sub-nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.subTab;
        this.switchTab(tab);
      });
    });

    // Select plan button -> Switch to payment tab or open modal
    container.querySelectorAll(".btn-select-plan").forEach((btn) => {
      btn.addEventListener("click", () => {
        const planId = btn.dataset.planId;
        this.selectedPlanId = planId;
        const plan = this.plans.find((p) => (p.$id || p.id) === planId);
        if (plan) {
          this.switchTab("payment");
          const planSelect = document.getElementById("payment-plan-select");
          if (planSelect) {
            planSelect.value = planId;
            planSelect.dispatchEvent(new Event("change"));
          }
        }
      });
    });

    // View receipt button
    container.querySelectorAll(".btn-view-receipt").forEach((btn) => {
      btn.addEventListener("click", () => {
        const paymentId = btn.dataset.paymentId;
        const payment = this.paymentHistory.find((p) => (p.$id || p.id) === paymentId);
        if (payment) ReceiptService.printPaymentReceipt(payment);
      });
    });

    this.bindPaymentForm(container);
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll(".sub-nav-tab").forEach((btn) => {
      const isTarget = btn.dataset.subTab === tab;
      btn.classList.toggle("btn-primary", isTarget);
      btn.classList.toggle("btn-outline", !isTarget);
    });

    const panels = {
      plans: document.getElementById("sub-tab-panel-plans"),
      payment: document.getElementById("sub-tab-panel-payment"),
      history: document.getElementById("sub-tab-panel-history")
    };

    Object.entries(panels).forEach(([key, panel]) => {
      if (panel) panel.style.display = key === tab ? "block" : "none";
    });
  },

  bindPaymentForm(container) {
    const form = container.querySelector("#ecocash-submission-form");
    if (!form) return;

    const planSelect = container.querySelector("#payment-plan-select");
    const summaryDiv = container.querySelector("#payment-form-plan-summary");
    const instructionAmount = container.querySelector("#payment-instruction-amount");
    const proofInput = container.querySelector("#eco-proof-file");
    const proofFileName = container.querySelector("#eco-proof-file-name");
    const submitBtn = container.querySelector("#btn-submit-ecocash");
    const errorDiv = container.querySelector("#eco-submit-error");

    // Destination card click highlighting
    container.querySelectorAll(".dest-radio-label").forEach((label) => {
      label.addEventListener("click", () => {
        container.querySelectorAll(".dest-radio-label").forEach((l) => {
          l.style.border = "1px solid var(--border-light)";
        });
        label.style.border = "2px solid var(--primary)";
        const radio = label.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
      });
    });

    planSelect?.addEventListener("change", () => {
      const planId = planSelect.value;
      this.selectedPlanId = planId;
      const plan = this.plans.find((p) => (p.$id || p.id) === planId);
      if (plan) {
        if (summaryDiv) summaryDiv.textContent = `${plan.name} · $${plan.price} USD (${plan.duration_days} Days)`;
        if (instructionAmount) instructionAmount.textContent = plan.price;
      }
    });

    proofInput?.addEventListener("change", () => {
      const file = proofInput.files?.[0];
      if (proofFileName) {
        if (!file) {
          proofFileName.textContent = "No file selected";
        } else {
          const sizeKb = (file.size / 1024).toFixed(1);
          const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
          proofFileName.textContent = `${file.name} (${file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`})`;
        }
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (this.submissionInFlight) return;
      if (errorDiv) errorDiv.style.display = "none";

      const selectedPlan = this.plans.find((p) => (p.$id || p.id) === (planSelect?.value || this.selectedPlanId)) || this.plans[0];
      const selectedDestRadio = form.querySelector("input[name='ecocash_destination']:checked");
      const destinationId = selectedDestRadio ? selectedDestRadio.value : (this.destinations[0]?.$id || this.destinations[0]?.id);
      const senderName = document.getElementById("eco-sender-name")?.value?.trim() || "";
      const senderPhone = document.getElementById("eco-sender-phone")?.value?.trim() || "";
      const transactionRef = document.getElementById("eco-transaction-ref")?.value?.trim()?.toUpperCase() || "";
      const proofFile = proofInput?.files?.[0] || null;

      if (!destinationId) {
        if (errorDiv) {
          errorDiv.textContent = "An EcoCash destination account is required.";
          errorDiv.style.display = "block";
        }
        return;
      }
      if (!senderName) {
        if (errorDiv) {
          errorDiv.textContent = "Sender full name is required.";
          errorDiv.style.display = "block";
        }
        return;
      }
      if (!senderPhone) {
        if (errorDiv) {
          errorDiv.textContent = "Sender phone number is required.";
          errorDiv.style.display = "block";
        }
        return;
      }
      if (!transactionRef) {
        if (errorDiv) {
          errorDiv.textContent = "EcoCash transaction reference / approval SMS code is required.";
          errorDiv.style.display = "block";
        }
        return;
      }
      if (!proofFile) {
        if (errorDiv) {
          errorDiv.textContent = "Proof of payment screenshot or document is required.";
          errorDiv.style.display = "block";
        }
        return;
      }

      let fileId = null;
      try {
        this.submissionInFlight = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Uploading proof of payment...";
        }

        // Step 1: Upload proof file to Google Drive via trusted backend
        fileId = await SubscriptionService.uploadProof(proofFile);

        if (submitBtn) {
          submitBtn.textContent = "Recording payment submission...";
        }

        // Step 2: Submit payment
        await SubscriptionService.submitSubscriptionPayment({
          planId: selectedPlan.$id || selectedPlan.id,
          destinationId,
          senderName,
          senderPhone,
          transactionRef,
          proofFileId: fileId,
          amountDeclared: Number(selectedPlan.price)
        });

        Modal.open(
          "Payment proof submitted",
          `<div style="padding: 0.5rem 0; color: var(--text-main); line-height: 1.5;">
            <p><strong>Thank you!</strong> Your EcoCash payment has been submitted successfully.</p>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Your payment is currently <strong>awaiting admin review</strong>. You will receive access as soon as an administrator confirms the transaction.</p>
          </div>`
        );

        this.activeTab = "history";
        await this.init();
      } catch (err) {
        console.error("Payment submission failure:", err);
        if (fileId) {
          await PaymentService.deletePaymentProof(fileId).catch(() => {});
        }
        if (errorDiv) {
          errorDiv.textContent = err.message || "Payment submission failed. Please verify your details.";
          errorDiv.style.display = "block";
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit EcoCash Payment for Verification";
        }
      } finally {
        this.submissionInFlight = false;
      }
    });
  },

  openEcocashPaymentModal(plan) {
    this.selectedPlanId = plan.$id || plan.id;
    this.switchTab("payment");
    const planSelect = document.getElementById("payment-plan-select");
    if (planSelect) {
      planSelect.value = this.selectedPlanId;
      planSelect.dispatchEvent(new Event("change"));
    }
  },

  startLiveRefresh() {
    const signature = () => JSON.stringify({
      active: Boolean(this.subStatus?.active),
      plan: this.subStatus?.plan || null,
      expiresAt: this.subStatus?.expires_at || null,
      payments: this.paymentHistory.map((p) => `${p.$id || p.id}:${p.status}:${p.rejection_reason || ""}`)
    });
    let previousSignature = signature();

    this.refreshTimer = window.setInterval(async () => {
      if (this.refreshInFlight || this.submissionInFlight || !document.getElementById("subscription-page-container")) return;
      this.refreshInFlight = true;
      try {
        const [subStatus, paymentHistory] = await Promise.all([
          SubscriptionService.getSubscriptionStatus(),
          SubscriptionService.getPaymentHistory()
        ]);
        this.subStatus = subStatus;
        this.paymentHistory = paymentHistory;
        const nextSignature = signature();
        if (nextSignature !== previousSignature) {
          previousSignature = nextSignature;
          const container = document.getElementById("subscription-page-container");
          if (container) this.renderFullView(container);
        }
      } catch (error) {
        console.warn("Subscription status refresh:", error.message);
      } finally {
        this.refreshInFlight = false;
      }
    }, 15000);
  },

  stopLiveRefresh() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  destroy() {
    this.stopLiveRefresh();
    this.submissionInFlight = false;
  }
};
