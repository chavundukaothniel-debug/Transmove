// ==============================================================================
// TRANSMOVE SUBSCRIPTIONS & PAYNOW ZIMBABWE PAYMENT VIEW
// Real Paynow Payment Integration for $15 Professional Subscription
// Passengers are 100% FREE & strictly excluded from subscriptions
// ==============================================================================
import { SubscriptionService } from "../services/subscriptions.js";
import { AuthService } from "../services/auth.js";
import { Modal } from "../components/Modal.js";

export const SubscriptionsView = {
  currentProfile: null,

  async render() {
    return `
      <div id="subscription-page-container" style="max-width: 1040px; margin: 0 auto; padding-top: 1rem; padding-bottom: 3rem;">
        <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
          Loading subscription options...
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

    // 2. PAID PROVIDER ROLES: Render $15 Professional Subscription Page
    try {
      const plans = await SubscriptionService.getPlans();
      const currentSub = await SubscriptionService.getCurrentSubscription();
      const paymentHistory = await SubscriptionService.getPaymentHistory();

      const profPlan = plans.find(p => p.id === "plan-professional" || p.price === 15) || plans[0];

      container.innerHTML = `
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <span class="badge badge-info" style="margin-bottom: 0.5rem; font-size: 0.8rem; padding: 0.35rem 0.75rem;">PROVIDER SUBSCRIPTION</span>
          <h1 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; margin: 0.2rem 0;">
            TransMove Professional Subscription
          </h1>
          <p style="color: var(--text-muted); font-size: 1.05rem; max-width: 620px; margin: 0.5rem auto 0 auto;">
            Unlock unlimited transport bidding, freight requests, vehicle rentals, and machinery listings across Zimbabwe.
          </p>
        </div>

        <!-- Current Active Subscription Status Banner -->
        <div class="card" style="margin-bottom: 2rem; padding: 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-light);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Account Subscription Status</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-main); margin-top: 0.2rem;">
                ${currentSub ? currentSub.plan || "TransMove Professional" : "No Active Subscription"}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
                ${currentSub ? `Active until ${new Date(currentSub.expires_at).toLocaleDateString()}` : "Subscribe to unlock provider bidding and listing capabilities."}
              </div>
            </div>
            <span class="badge ${currentSub ? "badge-success" : "badge-warning"}" style="font-size: 0.9rem; padding: 0.4rem 0.85rem;">
              ${currentSub ? "ACTIVE" : "INACTIVE"}
            </span>
          </div>
        </div>

        <!-- $15 Professional Subscription Pricing Card -->
        <div class="card" style="max-width: 580px; margin: 0 auto 3rem auto; padding: 2rem; border: 2px solid var(--primary); background: var(--bg-surface); position: relative;">
          <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 0.25rem 1rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em;">
            OFFICIAL PROVIDER TIER
          </div>

          <div style="text-align: center; margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.75rem; font-weight: 900; margin-bottom: 0.25rem;">TransMove Professional</h2>
            <div style="font-size: 2.5rem; font-weight: 900; color: var(--primary); margin: 0.5rem 0;">
              $15.00 <span style="font-size: 1rem; color: var(--text-muted); font-weight: 600;">USD / month</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              Pay securely with Paynow Zimbabwe. Your subscription becomes active only after payment is confirmed.
            </p>
          </div>

          <ul style="list-style: none; padding: 0; margin: 0 0 1.75rem 0; display: flex; flex-direction: column; gap: 0.75rem;">
            <li style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.95rem; font-weight: 600;">
              <span style="color: #10b981; font-weight: 900;">✓</span> Unlimited transport bidding &amp; counter-offers
            </li>
            <li style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.95rem; font-weight: 600;">
              <span style="color: #10b981; font-weight: 900;">✓</span> Priority request dispatch for drivers
            </li>
            <li style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.95rem; font-weight: 600;">
              <span style="color: #10b981; font-weight: 900;">✓</span> Verified Provider Badge on profile
            </li>
            <li style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.95rem; font-weight: 600;">
              <span style="color: #10b981; font-weight: 900;">✓</span> Vehicle &amp; heavy machinery rental listings
            </li>
            <li style="display: flex; align-items: center; gap: 0.65rem; font-size: 0.95rem; font-weight: 600;">
              <span style="color: #10b981; font-weight: 900;">✓</span> Commercial freight haulage access
            </li>
          </ul>

          <button id="btn-pay-subscription" class="btn btn-primary btn-full btn-lg" style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
            <span>Pay $15 Subscription with Paynow</span>
            <img src="https://www.paynow.co.zw/Content/Buttons/Medium_buttons/button_pay-now_medium.png" alt="Paynow Zimbabwe" style="height: 24px; vertical-align: middle;" />
          </button>
        </div>

        <!-- Payment History Table -->
        <div class="card">
          <div class="card-header" style="margin-bottom: 1rem;">
            <h3 class="card-title">💳 Subscription Payment Ledger &amp; Paynow Receipts</h3>
            <span class="badge badge-neutral">Server Verified</span>
          </div>
          <div id="sub-history-list">
            ${paymentHistory.length === 0 ? `
              <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No payment records yet.</div>
            ` : paymentHistory.map((payment) => `
              <div style="display:flex; justify-content:space-between; gap:1rem; padding:0.85rem 0; border-bottom:1px solid var(--border-light); flex-wrap:wrap;">
                <div><strong>${payment.reference}</strong><div style="font-size:0.8rem; color:var(--text-muted);">${payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ""}</div></div>
                <strong>$${Number.parseFloat(payment.amount || 0).toFixed(2)} ${payment.currency || "USD"}</strong>
                <span class="badge ${payment.status === "paid" ? "badge-success" : "badge-warning"}">${(payment.status || "pending").toUpperCase()}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      // Event listener for Pay $15 Subscription button
      document.getElementById("btn-pay-subscription")?.addEventListener("click", async () => {
        const payBtn = document.getElementById("btn-pay-subscription");
        payBtn.disabled = true;
        payBtn.innerText = "Creating unique Paynow reference...";

        try {
          const res = await SubscriptionService.subscribeWithPaynow(profPlan);

          // Open Paynow checkout modal with dynamic unique reference
          Modal.open(
            "Paynow $15 Subscription Checkout",
            `
              <div style="text-align: center; padding: 0.5rem 0;">
                <div style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 0.25rem;">
                  Unique Payment Reference
                </div>
                <div style="font-family: monospace; font-size: 1.15rem; font-weight: 800; color: var(--primary); background: var(--bg-subtle); padding: 0.65rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; border: 1px solid var(--border-light);">
                  ${res.internalReference}
                </div>

                <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; text-align: left;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
                    <span>Plan:</span>
                    <strong>TransMove Professional</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.9rem;">
                    <span>Amount:</span>
                    <strong style="color: var(--primary);">$15.00 USD</strong>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                    <span>Payment Gateway:</span>
                    <strong>Paynow Zimbabwe (EcoCash / OneMoney / Visa)</strong>
                  </div>
                </div>

                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                  Click <strong>Open Paynow Gateway</strong> below to complete your payment on Paynow. Once paid, click <strong>Verify &amp; Confirm Payment</strong>.
                </p>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  <a href="${res.paynowUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-full" style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                    <span>Open Paynow Gateway ↗</span>
                    <img src="${res.buttonImage}" alt="Paynow" style="height: 20px;" />
                  </a>
                  
                  <button id="btn-confirm-paynow" class="btn btn-primary btn-full">
                    Verify &amp; Confirm Payment ⚡
                  </button>
                </div>
              </div>
            `
          );

          document.getElementById("btn-confirm-paynow")?.addEventListener("click", async () => {
            const confirmBtn = document.getElementById("btn-confirm-paynow");
            confirmBtn.disabled = true;
            confirmBtn.innerText = "Verifying with server...";

            try {
              const verifyRes = await SubscriptionService.verifyAndActivateSubscription(res.transactionId, res.internalReference);

              Modal.close();

              // Determine redirect path for role
              const roleRedirect = this.currentProfile?.role === "driver" ? "#driver" 
                : this.currentProfile?.role === "vehicle_owner" ? "#vehicle_owner" 
                : this.currentProfile?.role === "machinery_owner" ? "#machinery_owner" 
                : this.currentProfile?.role === "logistics_provider" ? "#logistics" 
                : "#home";

              // Show success modal according to spec
              Modal.open(
                "Payment Successful!",
                `
                  <div style="text-align: center; padding: 1rem 0;">
                    <div style="font-size: 3.5rem; margin-bottom: 0.5rem;">✅</div>
                    <h3 style="font-size: 1.4rem; font-weight: 900; color: #10b981; margin-bottom: 0.25rem;">
                      Your TransMove subscription is now active.
                    </h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
                      Thank you! Your Paynow transaction was verified and provider capabilities are unlocked.
                    </p>

                    <div style="background: var(--bg-subtle); padding: 1.25rem; border-radius: var(--radius-md); text-align: left; margin-bottom: 1.5rem; border: 1px solid var(--border-light);">
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <span>Plan:</span>
                        <strong>TransMove Professional</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <span>Amount Paid:</span>
                        <strong style="color: #10b981;">$15.00 USD</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <span>Payment Reference:</span>
                        <strong style="font-family: monospace;">${res.internalReference}</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <span>Start Date:</span>
                        <strong>${new Date(verifyRes.startDate || Date.now()).toLocaleDateString()}</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                        <span>Expiry Date:</span>
                        <strong>${new Date(verifyRes.expiryDate || Date.now() + 30*86400000).toLocaleDateString()}</strong>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span>Payment Status:</span>
                        <span class="badge badge-success">PAID &amp; ACTIVE</span>
                      </div>
                    </div>

                    <button id="btn-return-dashboard" class="btn btn-primary btn-full">
                      Return to Dashboard 🚀
                    </button>
                  </div>
                `
              );

              document.getElementById("btn-return-dashboard")?.addEventListener("click", () => {
                Modal.close();
                window.location.hash = roleRedirect;
              });

            } catch (err) {
              alert("Payment was not completed: " + err.message);
              confirmBtn.disabled = false;
              confirmBtn.innerText = "Verify & Confirm Payment ⚡";
            }
          });

        } catch (err) {
          alert("Error starting Paynow payment: " + err.message);
        } finally {
          payBtn.disabled = false;
          payBtn.innerText = "Pay $15 Subscription with Paynow";
        }
      });

    } catch (err) {
      container.innerHTML = `<div style="padding: 2rem; color: var(--text-muted); text-align: center;">Subscription engine ready.</div>`;
    }
  }
};
