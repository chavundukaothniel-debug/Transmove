// ==============================================================================
// TRANSMOVE LEGAL CENTRE & POLICIES VIEW
// ==============================================================================
import { icon } from "../components/Icon.js";

export const LegalView = {
  activeDoc: "terms", // 'terms' | 'privacy' | 'cancellation' | 'refund' | 'driver-terms' | 'customer-terms' | 'advertising' | 'machinery'

  async render() {
    return `
      <div class="legal-centre" style="max-width: 1180px; margin: 0 auto; padding: 1.5rem 0;">
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <h1 style="font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 0.5rem;">TransMove Legal &amp; Policy Centre</h1>
          <p style="color: var(--text-muted); font-size: 1rem; max-width: 650px; margin: 0 auto;">
            Review our official terms of service, privacy policy, driver &amp; customer terms, cancellation rules, and marketplace policies.
          </p>
        </div>

        <div class="grid-2" style="grid-template-columns: 280px 1fr; gap: 2rem; align-items: start;">
          
          <!-- Left Sub-Nav Column -->
          <div class="card" style="padding: 1rem;">
            <div style="font-size: 0.8rem; text-transform: uppercase; tracking: 0.05em; color: var(--text-muted); font-weight: 800; padding: 0.5rem 0.75rem;">
              Legal Documents
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "terms" ? "active" : ""}" data-doc="terms" style="justify-content: flex-start; text-align: left;">
            ${icon("scroll-text", 17)}<span>Terms of Service</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "privacy" ? "active" : ""}" data-doc="privacy" style="justify-content: flex-start; text-align: left;">
            ${icon("lock-keyhole", 17)}<span>Privacy Policy</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "cancellation" ? "active" : ""}" data-doc="cancellation" style="justify-content: flex-start; text-align: left;">
            ${icon("circle-x", 17)}<span>Cancellation Policy</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "refund" ? "active" : ""}" data-doc="refund" style="justify-content: flex-start; text-align: left;">
            ${icon("badge-dollar-sign", 17)}<span>Refund Policy</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "driver-terms" ? "active" : ""}" data-doc="driver-terms" style="justify-content: flex-start; text-align: left;">
            ${icon("car-front", 17)}<span>Driver Terms</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "customer-terms" ? "active" : ""}" data-doc="customer-terms" style="justify-content: flex-start; text-align: left;">
            ${icon("user-round", 17)}<span>Customer Terms</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "advertising" ? "active" : ""}" data-doc="advertising" style="justify-content: flex-start; text-align: left;">
            ${icon("megaphone", 17)}<span>Advertising Terms</span>
              </button>
              <button class="btn btn-outline btn-sm legal-nav-btn ${this.activeDoc === "machinery" ? "active" : ""}" data-doc="machinery" style="justify-content: flex-start; text-align: left;">
            ${icon("tractor", 17)}<span>Machinery Rental Terms</span>
              </button>
            </div>
          </div>

          <!-- Right Document Content Area -->
          <div class="card" style="padding: 2.25rem; line-height: 1.7; font-size: 0.95rem;">
            <div id="legal-doc-content">
              ${this.getDocContent(this.activeDoc)}
            </div>
          </div>

        </div>
      </div>
    `;
  },

  async init() {
    // Parse URL parameter page if present (e.g., #legal?page=privacy)
    const validDocs = ["terms", "privacy", "cancellation", "refund", "driver-terms", "customer-terms", "advertising", "machinery"];
    const hash = window.location.hash;
    if (hash.includes("page=")) {
      const page = hash.split("page=")[1]?.split("&")[0];
      if (page && validDocs.includes(page)) this.activeDoc = page;
    }

    document.querySelectorAll(".legal-nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.showDoc(e.currentTarget.getAttribute("data-doc"));
      });
    });

    // render() ran before the hash param was parsed — sync content & nav now
    this.showDoc(this.activeDoc);
  },

  showDoc(doc) {
    this.activeDoc = doc;
    document.querySelectorAll(".legal-nav-btn").forEach((b) => b.classList.toggle("active", b.getAttribute("data-doc") === doc));
    const contentEl = document.getElementById("legal-doc-content");
    if (contentEl) contentEl.innerHTML = this.getDocContent(doc);
  },

  getDocContent(doc) {
    switch (doc) {
      case "privacy":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Privacy Policy</h2>
          <p><strong>Effective Date:</strong> January 1, 2026 | <strong>TransMove Zimbabwe</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>TransMove ("we", "our", "us") values your privacy. This policy outlines how we collect, process, and protect your personal data when using our transportation, freight logistics, and machinery marketplace platform.</p>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem;">1. Data We Collect</h3>
          <p>We collect information required to facilitate platform services, including your name, email, phone number, location coordinates, vehicle details, national identity documents (for drivers), and transaction ledgers.</p>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem;">2. How Data Is Used</h3>
          <p>Your data is used solely for matching customers with transport providers, verifying driver credentials, processing EcoCash payment verification records, generating security PINs, and providing customer support.</p>
        `;
      case "cancellation":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Cancellation Policy</h2>
          <p><strong>TransMove Marketplace Cancellation Guidelines</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem;">1. Customer Cancellations</h3>
          <p>Customers may cancel an open ride or cargo request without fee before an offer is accepted. Once a driver offer is accepted and the driver is en-route, cancellations may incur a nominal fee to compensate driver travel time.</p>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem;">2. Driver Cancellations</h3>
          <p>Drivers who cancel accepted trips without valid cause are subject to account status review and potential suspension from the marketplace.</p>
        `;
      case "refund":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Refund Policy</h2>
          <p><strong>Payment &amp; Subscription Refund Terms</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>Subscriptions and provider payments verified via EcoCash are subject to review by TransMove administration. Refunds are granted for unfulfilled services, confirmed billing errors, or verified safety disputes.</p>
        `;
      case "driver-terms":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Driver Terms &amp; Verification Rules</h2>
          <p><strong>TransMove Driver Agreement</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>All drivers operating on TransMove must hold a valid driver's licence, maintain active vehicle registration and insurance, pass admin identity verification, and adhere to zero-tolerance safety policies.</p>
        `;
      case "customer-terms":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Customer Terms of Service</h2>
          <p><strong>Customer Guidelines</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>Customers agree to provide accurate pickup and destination information, treat drivers with respect, verify driver PINs before starting trips, and pay agreed fare rates.</p>
        `;
      case "advertising":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Advertising Terms &amp; Conditions</h2>
          <p><strong>TransMove Business Ad Platform Guidelines</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>Advertisements placed on TransMove must represent legitimate businesses, comply with advertising standards in Zimbabwe, and undergo administrative review prior to campaign activation.</p>
        `;
      case "machinery":
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Machinery &amp; Heavy Equipment Rental Terms</h2>
          <p><strong>Equipment Rental Marketplace Rules</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>Equipment owners are responsible for ensuring tractors, excavators, and tippers are mechanically sound and operated by certified personnel. Hirers must inspect machinery prior to operation.</p>
        `;
      default:
        return `
          <h2 style="font-size: 1.6rem; font-weight: 800; margin-bottom: 1rem;">Terms of Service</h2>
          <p><strong>TransMove Independent Platform Terms</strong></p>
          <hr style="border: none; border-top: 1px solid var(--border-light); margin: 1.25rem 0;" />
          <p>Welcome to TransMove. By accessing our website, mobile interface, or services, you agree to be bound by these Terms of Service. TransMove operates an independent transportation, freight logistics, and heavy machinery marketplace across Zimbabwe.</p>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem;">1. Platform Identity &amp; Governance</h3>
          <p>TransMove is an independent entity headquartered at 17056 Teviotdale, Vainona, Harare, Zimbabwe. All transactions, driver bids, machinery listings, and EcoCash payment activations are governed by our platform policies.</p>
        `;
    }
  }
};
