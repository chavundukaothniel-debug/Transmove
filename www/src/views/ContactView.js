// ==============================================================================
// TRANSMOVE OFFICIAL CONTACT PAGE VIEW
// ==============================================================================
import { SocialService } from "../services/social.js";
import { icon } from "../components/Icon.js";

export const ContactView = {
  async render() {
    return `
      <div class="contact-page" style="max-width: 1080px; margin: 0 auto; padding: 1.5rem 0;">
        <div style="text-align: center; margin-bottom: 2.5rem;">
          <h1 style="font-size: 2.4rem; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 0.5rem;">Contact TransMove</h1>
          <p style="color: var(--text-muted); font-size: 1.05rem; max-width: 600px; margin: 0 auto;">
            Have questions about our transportation marketplace, freight logistics, machinery rentals, or business accounts? We're here to assist you.
          </p>
        </div>

        <div class="grid-2" style="gap: 2rem; margin-bottom: 3rem;">
          
          <!-- Left Column: Business Contacts & Head Office -->
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            
            <!-- Head Office Card -->
            <div class="card" style="padding: 1.75rem;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem;">
              ${icon("building-2", 31)}
              </div>
              <h3 style="font-size: 1.2rem; font-weight: 800; margin-bottom: 0.5rem;">Head Office</h3>
              <div style="color: var(--text-main); font-size: 0.95rem; line-height: 1.6; font-weight: 500;">
                17056 Teviotdale,<br />
                Vainona,<br />
                Harare, Zimbabwe
              </div>
            </div>

            <!-- General Enquiries Contact Card -->
            <div class="card" style="padding: 1.75rem;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--secondary-light); color: var(--secondary); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem;">
              ${icon("user-round", 27)}
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.35rem;">General Enquiries</h3>
              <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Primary Business Contact</div>

              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                <a href="mailto:martintapiwa16@gmail.com" class="btn btn-outline btn-sm" style="justify-content: flex-start;">
              ${icon("mail", 16)}<span>martintapiwa16@gmail.com</span>
                </a>
                <a href="tel:0780963653" class="btn btn-outline btn-sm" style="justify-content: flex-start;">
              ${icon("phone", 16)}<span>0780963653</span>
                </a>
              </div>
            </div>

            <!-- Additional Contact Card -->
            <div class="card" style="padding: 1.75rem;">
              <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--accent-amber-light); color: var(--accent-amber); display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem;">
              ${icon("handshake", 27)}
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.35rem;">Additional Contact</h3>
              <div style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">Operations &amp; Support</div>

              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                <a href="mailto:takudzwagmhuwira@gmail.com" class="btn btn-outline btn-sm" style="justify-content: flex-start;">
              ${icon("mail", 16)}<span>takudzwagmhuwira@gmail.com</span>
                </a>
                <a href="tel:0781664661" class="btn btn-outline btn-sm" style="justify-content: flex-start;">
              ${icon("phone", 16)}<span>078 166 4661</span>
                </a>
              </div>
            </div>

            <!-- Direct WhatsApp Support Button Card -->
            <div class="card" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3);">
            <div class="icon-label" style="font-weight: 800; font-size: 1.1rem; color: #15803d; margin-bottom: 0.35rem;">${icon("message-circle", 19)}<span>Live WhatsApp Support</span></div>
              <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Connect directly with TransMove support (+263780266401)</div>
              <button id="btn-contact-whatsapp" class="btn btn-primary btn-full" style="background: #22c55e; border: none;">
                Chat on WhatsApp (+263780266401)
              </button>
            </div>

          </div>

          <!-- Right Column: Contact Form -->
          <div class="card" style="padding: 2rem;">
            <h3 class="card-title" style="margin-bottom: 0.35rem; font-size: 1.35rem;">Send Us a Message</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">
              The message form is temporarily unavailable — nothing entered here is sent. For a guaranteed response, use WhatsApp (+263 78 026 6401), email, or phone on this page.
            </p>

            <form id="contact-form">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="cnt-name" class="form-input" placeholder="Your full name" required />
              </div>

              <div class="grid-2">
                <div class="form-group">
                  <label class="form-label">Email Address</label>
                  <input type="email" id="cnt-email" class="form-input" placeholder="name@example.com" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number (Optional)</label>
                  <input type="tel" id="cnt-phone" class="form-input" placeholder="e.g. 0780963653" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Subject</label>
                <select id="cnt-subject" class="form-select" required>
                  <option value="General Enquiry">General Enquiry</option>
                  <option value="Transportation & Rides">Transportation &amp; Rides</option>
                  <option value="Freight & Logistics">Freight &amp; Logistics</option>
                  <option value="Machinery Rental">Machinery Rental</option>
                  <option value="Business Accounts">Business Accounts</option>
                  <option value="Advertising">Advertising Platform</option>
                  <option value="Technical Support">Technical Support</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Your Message</label>
                <textarea id="cnt-message" class="form-textarea" rows="5" placeholder="Write your enquiry or feedback here..." required></textarea>
              </div>

              <button type="submit" id="btn-cnt-submit" class="btn btn-primary btn-lg btn-full" disabled title="The contact form is temporarily unavailable — please use WhatsApp (+263 78 026 6401) or email">
            ${icon("send", 18)}<span>Submit Message</span>
              </button>
            </form>

            <div id="contact-status-banner" style="display: none; margin-top: 1.25rem; padding: 1rem; border-radius: var(--radius-md); font-size: 0.9rem; text-align: center;"></div>
          </div>

        </div>
      </div>
    `;
  },

  async init() {
    // WhatsApp Support click
    document.getElementById("btn-contact-whatsapp")?.addEventListener("click", () => {
      SocialService.launchWhatsAppSupport("Hello TransMove Support, I would like to make an enquiry.");
    });

    const banner = document.getElementById("contact-status-banner");
    const honestNotice = "<strong>The contact form is temporarily unavailable.</strong> Nothing entered here is sent. For a real response, <a href=\"https://wa.me/263780266401\" target=\"_blank\" rel=\"noopener\">chat on WhatsApp (+263 78 026 6401)</a> or email <a href=\"mailto:martintapiwa16@gmail.com\">martintapiwa16@gmail.com</a>.";
    if (banner) {
      banner.style.display = "block";
      banner.style.background = "var(--bg-subtle)";
      banner.style.color = "var(--text-muted)";
      banner.style.border = "1px solid var(--border-light)";
      banner.innerHTML = honestNotice;
    }

    // No message backend exists — never claim delivery
    document.getElementById("contact-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!banner) return;
      banner.style.display = "block";
      banner.style.background = "var(--danger-light)";
      banner.style.color = "#ef4444";
      banner.style.border = "1px solid #ef4444";
        banner.innerHTML = `${icon("circle-x", 18)} <strong>Message not delivered.</strong> ${honestNotice}`;
    });
  }
};
