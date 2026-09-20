// ==============================================================================
// TRANSMOVE GLOBAL PROFESSIONAL FOOTER COMPONENT
// ==============================================================================
import { SocialService } from "../services/social.js";
import { icon } from "./Icon.js";

export function renderFooter() {
  return `
    <footer class="transmove-footer" style="background: var(--bg-surface); border-top: 1px solid var(--border-light); padding: 3.5rem 1.5rem 2rem 1.5rem; margin-top: 4rem;">
      <div style="max-width: 1280px; margin: 0 auto;">
        
        <!-- Main Footer Navigation Columns -->
        <div class="footer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2.5rem; margin-bottom: 3rem;">
          
          <!-- Column 1: Brand & Contact Info -->
          <div>
            <div style="font-weight: 900; font-size: 1.35rem; color: var(--text-main); margin-bottom: 0.75rem;">
              Trans<span style="color: var(--primary);">Move</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.25rem;">
              Zimbabwe's Premier Independent Transportation, Freight Logistics, Vehicle Hiring &amp; Heavy Machinery Marketplace.
            </p>

            <div style="font-size: 0.825rem; color: var(--text-muted); line-height: 1.6;">
                <div class="icon-label" style="font-weight: 700; color: var(--text-main); margin-bottom: 0.25rem;">${icon("map-pin", 17)}<span>Head Office:</span></div>
              <div>17056 Teviotdale, Vainona</div>
              <div>Harare, Zimbabwe</div>
              
                <div class="icon-label" style="font-weight: 700; color: var(--text-main); margin-top: 0.75rem; margin-bottom: 0.25rem;">${icon("phone", 17)}<span>Public Contacts:</span></div>
              <div>martintapiwa16@gmail.com • 0780963653</div>
              <div>takudzwagmhuwira@gmail.com • 078 166 4661</div>
            </div>
          </div>

          <!-- Column 2: Company -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Company</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.65rem;">
              <li><a href="#about" class="footer-link">About TransMove</a></li>
              <li><a href="#contact" class="footer-link">Contact Us</a></li>
              <li><a href="#careers" class="footer-link">Careers</a></li>
              <li><a href="#partner" class="footer-link">Partner With Us</a></li>
              <li><a href="#business" class="footer-link">Corporate Accounts</a></li>
            </ul>
          </div>

          <!-- Column 3: Marketplace Services -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Services</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.65rem;">
              <li><a href="#customer" class="footer-link">Ride &amp; Transport</a></li>
              <li><a href="#customer" class="footer-link">Freight &amp; Logistics</a></li>
              <li><a href="#driver" class="footer-link">Vehicle Hiring</a></li>
              <li><a href="#equipment" class="footer-link">Machinery Rental</a></li>
              <li><a href="#business" class="footer-link">Business Transport</a></li>
              <li><a href="#advertise" class="footer-link">Advertising Platform</a></li>
            </ul>
          </div>

          <!-- Column 4: Support & Safety -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Support</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.65rem;">
              <li><a href="#help" class="footer-link">Help Centre</a></li>
              <li><a href="#support" class="footer-link">Support Tickets</a></li>
              <li><a href="#driver" class="footer-link">Driver Verification</a></li>
              <li><a href="#safety" class="footer-link">Safety Centre</a></li>
              <li><a href="#status" class="footer-link">System Status</a></li>
              <li><a href="#contact" class="footer-link">Report a Problem</a></li>
            </ul>
          </div>

          <!-- Column 5: Legal & Policy -->
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">Legal &amp; Policy</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.875rem; display: flex; flex-direction: column; gap: 0.65rem;">
              <li><a href="#legal?page=terms" class="footer-link">Terms of Service</a></li>
              <li><a href="#legal?page=privacy" class="footer-link">Privacy Policy</a></li>
              <li><a href="#legal?page=cancellation" class="footer-link">Cancellation Policy</a></li>
              <li><a href="#legal?page=refund" class="footer-link">Refund Policy</a></li>
              <li><a href="#legal?page=driver-terms" class="footer-link">Driver Terms</a></li>
              <li><a href="#legal?page=customer-terms" class="footer-link">Customer Terms</a></li>
              <li><a href="#legal?page=advertising" class="footer-link">Advertising Terms</a></li>
            </ul>
          </div>

        </div>

        <!-- Footer Action & Social Bar -->
        <div style="border-top: 1px solid var(--border-light); padding-top: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <button id="btn-footer-wa-direct" class="btn btn-outline btn-sm" style="border-color: #22c55e; color: #22c55e; font-weight: 700;">
            ${icon("message-circle", 17)}<span>WhatsApp Support (+263780266401)</span>
            </button>
          </div>

          <div style="font-size: 0.8rem; color: var(--text-muted);">
            &copy; 2026 TransMove Independent Platform. All Rights Reserved.
          </div>
        </div>

      </div>
    </footer>
  `;
}
