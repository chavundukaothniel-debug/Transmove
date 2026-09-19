// ==============================================================================
// TRANSMOVE AUTH VIEW
// Sign In (Panel 1 Split Layout), Role-Based Registration, Password Recovery & Email Verification
// Connected to Appwrite Web SDK Authentication
// ==============================================================================
import { AuthService } from "../services/auth.js";

export const AuthView = {
  render(type = "login") {
    if (type === "register") {
      return this.renderRegisterForm();
    }
    if (type === "forgot-password") {
      return this.renderForgotPasswordForm();
    }
    if (type === "reset-password") {
      return this.renderResetPasswordForm();
    }
    if (type === "verify-email") {
      return this.renderVerifyEmail();
    }

    return `
      <div class="login-split-container">
        <!-- LEFT PANEL: Dark Navy Branded Promotional Panel -->
        <div class="login-left-panel">
          <div class="login-left-brand">
            <div class="login-brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              <span>Trans<span style="color: #60a5fa;">Move</span></span>
            </div>
            <div class="login-brand-tagline">People. Goods. Opportunities.</div>
          </div>

          <div class="login-left-content">
            <h1 class="login-left-heading">Reliable Transport<br>For A Stronger Zimbabwe</h1>
            <p class="login-left-desc">
              Move people and goods with trusted transport providers across Zimbabwe.
            </p>

            <div class="login-benefits-list">
              <div class="login-benefit-item">
                <div class="login-benefit-icon">👥</div>
                <span>Move People</span>
              </div>
              <div class="login-benefit-item">
                <div class="login-benefit-icon">📦</div>
                <span>Move Goods</span>
              </div>
              <div class="login-benefit-item">
                <div class="login-benefit-icon">⚒</div>
                <span>Create Opportunities</span>
              </div>
            </div>
          </div>

          <div class="login-left-footer">
            <span>🇿🇼</span> Proudly Zimbabwean<br>Driving a Better Tomorrow
          </div>
        </div>

        <!-- RIGHT PANEL: Light Login Area -->
        <div class="login-right-panel">
          <div class="login-card-inner">
            <!-- Mobile header logo (shown on small screens only) -->
            <div class="login-mobile-brand">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              <span>Trans<span style="color: #2563eb;">Move</span></span>
            </div>

            <div class="login-header-group">
              <h2 class="login-title">Welcome Back</h2>
              <p class="login-subtitle">Sign in to your TransMove account</p>
            </div>

            <div id="auth-error-banner" style="display: none; background: var(--danger-light); border: 1px solid #fecdd3; color: var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>
            <div id="auth-success-banner" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>

            <form id="auth-form" novalidate>
              <div class="form-group">
                <label for="auth-email" class="form-label">Email</label>
                <input type="email" id="auth-email" class="form-input" placeholder="Enter your email" required autocomplete="email" />
              </div>

              <div class="form-group">
                <label for="auth-password" class="form-label">Password</label>
                <div class="input-password-wrapper">
                  <input type="password" id="auth-password" class="form-input" placeholder="Enter your password" required autocomplete="current-password" />
                  <button type="button" id="btn-toggle-password" class="btn-password-toggle" title="Show password" aria-label="Toggle password visibility">
                    <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 1.5rem; font-size: 0.875rem;">
                <a href="#forgot-password" style="color: #2563eb; font-weight: 600; text-decoration: none;">Forgot password?</a>
              </div>

              <button type="submit" id="auth-submit-btn" class="btn btn-primary-blue btn-lg btn-full">
                Sign In
              </button>
            </form>

            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); text-align: center; font-size: 0.9rem; color: var(--text-muted);">
              Don't have an account? <a href="#register" style="color: #2563eb; font-weight: 700; text-decoration: none;">Sign Up</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderRegisterForm() {
    return `
      <div style="max-width: 480px; margin: 2rem auto;">
        <div class="card" style="padding: 2.25rem;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-full); background: var(--primary-light); color: var(--primary); margin-bottom: 1rem;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
            <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--text-main);">
              Create your TransMove Account
            </h2>
            <p style="color: var(--text-muted); font-size: 0.925rem; margin-top: 0.35rem;">
              Join the genuine transport &amp; machinery marketplace
            </p>
          </div>

          <div id="auth-error-banner" style="display: none; background: var(--danger-light); border: 1px solid #fecdd3; color: var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>
          <div id="auth-success-banner" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>

          <form id="auth-form">
            <div class="form-group">
              <label for="auth-role" class="form-label">I want to register as</label>
              <select id="auth-role" class="form-select" required>
                <option value="customer">Customer (Ride &amp; Freight Requester)</option>
                <option value="driver">Driver (Transport Provider)</option>
                <option value="owner">Heavy Machinery &amp; Fleet Owner</option>
              </select>
              <div class="form-hint">Drivers and owners submit verification documents before bidding.</div>
            </div>

            <div class="form-group">
              <label for="auth-name" class="form-label">Full Name</label>
              <input type="text" id="auth-name" class="form-input" placeholder="e.g. John Moyo" required />
            </div>

            <div class="form-group">
              <label for="auth-phone" class="form-label">Phone Number</label>
              <input type="tel" id="auth-phone" class="form-input" placeholder="e.g. +263 77 123 4567" required />
            </div>

            <div class="form-group">
              <label for="auth-email" class="form-label">Email Address</label>
              <input type="email" id="auth-email" class="form-input" placeholder="name@domain.com" autocomplete="off" required />
            </div>

            <div class="form-group">
              <label for="auth-password" class="form-label">Password</label>
              <div class="input-password-wrapper">
                <input type="password" id="auth-password" class="form-input" placeholder="••••••••" autocomplete="new-password" required minlength="8" />
                <button type="button" id="btn-toggle-password" class="btn-password-toggle" title="Show password" aria-label="Toggle password visibility">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </div>
            </div>

            <button type="submit" id="auth-submit-btn" class="btn btn-primary btn-lg btn-full" style="margin-top: 1rem;">
              Create Account
            </button>
          </form>

          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); text-align: center; font-size: 0.9rem; color: var(--text-muted);">
            Already have an account? <a href="#login" style="color: var(--primary); font-weight: 700;">Sign In</a>
          </div>
        </div>
      </div>
    `;
  },

  renderForgotPasswordForm() {
    return `
      <div class="login-split-container">
        <div class="login-left-panel">
          <div class="login-left-brand">
            <div class="login-brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              <span>Trans<span style="color: #60a5fa;">Move</span></span>
            </div>
            <div class="login-brand-tagline">People. Goods. Opportunities.</div>
          </div>
          <div class="login-left-content">
            <h1 class="login-left-heading">Account Recovery</h1>
            <p class="login-left-desc">Securely recover access to your TransMove account using your registered email address.</p>
          </div>
          <div class="login-left-footer">
            <span>🇿🇼</span> Proudly Zimbabwean<br>Driving a Better Tomorrow
          </div>
        </div>

        <div class="login-right-panel">
          <div class="login-card-inner">
            <div class="login-header-group">
              <h2 class="login-title">Forgot Password</h2>
              <p class="login-subtitle">Enter your email and we'll send a password reset link</p>
            </div>

            <div id="auth-error-banner" style="display: none; background: var(--danger-light); border: 1px solid #fecdd3; color: var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>
            <div id="auth-success-banner" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>

            <form id="auth-forgot-form">
              <div class="form-group">
                <label for="auth-forgot-email" class="form-label">Registered Email</label>
                <input type="email" id="auth-forgot-email" class="form-input" placeholder="Enter your registered email" required autocomplete="email" />
              </div>

              <button type="submit" id="auth-forgot-submit-btn" class="btn btn-primary-blue btn-lg btn-full" style="margin-top: 1rem;">
                Send Password Reset Link
              </button>
            </form>

            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); text-align: center; font-size: 0.9rem; color: var(--text-muted);">
              Remember your password? <a href="#login" style="color: #2563eb; font-weight: 700; text-decoration: none;">Sign In</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderResetPasswordForm() {
    return `
      <div class="login-split-container">
        <div class="login-left-panel">
          <div class="login-left-brand">
            <div class="login-brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              <span>Trans<span style="color: #60a5fa;">Move</span></span>
            </div>
            <div class="login-brand-tagline">People. Goods. Opportunities.</div>
          </div>
          <div class="login-left-content">
            <h1 class="login-left-heading">Set New Password</h1>
            <p class="login-left-desc">Choose a strong, confidential password to protect your account and bookings.</p>
          </div>
          <div class="login-left-footer">
            <span>🇿🇼</span> Proudly Zimbabwean<br>Driving a Better Tomorrow
          </div>
        </div>

        <div class="login-right-panel">
          <div class="login-card-inner">
            <div class="login-header-group">
              <h2 class="login-title">Reset Password</h2>
              <p class="login-subtitle">Enter your new account password below</p>
            </div>

            <div id="auth-error-banner" style="display: none; background: var(--danger-light); border: 1px solid #fecdd3; color: var(--danger); padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>
            <div id="auth-success-banner" style="display: none; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.875rem; margin-bottom: 1.25rem; font-weight: 500;"></div>

            <form id="auth-reset-form">
              <div class="form-group">
                <label for="auth-new-password" class="form-label">New Password</label>
                <input type="password" id="auth-new-password" class="form-input" placeholder="Enter at least 8 characters" required minlength="8" />
              </div>

              <div class="form-group">
                <label for="auth-confirm-password" class="form-label">Confirm New Password</label>
                <input type="password" id="auth-confirm-password" class="form-input" placeholder="Repeat your new password" required minlength="8" />
              </div>

              <button type="submit" id="auth-reset-submit-btn" class="btn btn-primary-blue btn-lg btn-full" style="margin-top: 1rem;">
                Save New Password
              </button>
            </form>

            <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-light); text-align: center; font-size: 0.9rem; color: var(--text-muted);">
              Back to <a href="#login" style="color: #2563eb; font-weight: 700; text-decoration: none;">Sign In</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderVerifyEmail() {
    return `
      <div class="login-split-container">
        <div class="login-left-panel">
          <div class="login-left-brand">
            <div class="login-brand-logo">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              <span>Trans<span style="color: #60a5fa;">Move</span></span>
            </div>
            <div class="login-brand-tagline">People. Goods. Opportunities.</div>
          </div>
          <div class="login-left-content">
            <h1 class="login-left-heading">Email Verification</h1>
            <p class="login-left-desc">Verifying your email address to secure your TransMove account.</p>
          </div>
          <div class="login-left-footer">
            <span>🇿🇼</span> Proudly Zimbabwean<br>Driving a Better Tomorrow
          </div>
        </div>

        <div class="login-right-panel">
          <div class="login-card-inner">
            <div class="login-header-group">
              <h2 class="login-title">Email Verification</h2>
              <p class="login-subtitle">Confirming your account email</p>
            </div>

            <div id="verify-status-box" style="padding: 1.5rem; background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); text-align: center;">
              <p id="verify-status-text" style="color: var(--text-muted); font-size: 0.95rem; margin: 0 0 1rem 0;">Verifying your account email...</p>
              <div id="verify-action-area" style="display: none;">
                <a href="#login" class="btn btn-primary-blue btn-full" style="text-decoration: none; display: inline-block;">Continue to Sign In</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(type = "login") {
    // Password visibility toggle handler
    const passwordInput = document.getElementById("auth-password") || document.getElementById("auth-new-password");
    const toggleBtn = document.getElementById("btn-toggle-password");
    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener("click", () => {
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");
        toggleBtn.setAttribute("title", isPassword ? "Hide password" : "Show password");
      });
    }

    // Handle Forgot Password flow
    if (type === "forgot-password") {
      const forgotForm = document.getElementById("auth-forgot-form");
      forgotForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("auth-error-banner");
        const succEl = document.getElementById("auth-success-banner");
        const btn = document.getElementById("auth-forgot-submit-btn");
        if (errEl) errEl.style.display = "none";
        if (succEl) succEl.style.display = "none";

        const email = document.getElementById("auth-forgot-email")?.value.trim();
        if (!email) {
          if (errEl) { errEl.innerText = "Please enter your email."; errEl.style.display = "block"; }
          return;
        }

        try {
          btn.disabled = true;
          btn.innerText = "Sending Reset Link...";
          await AuthService.resetPassword(email);
          if (succEl) {
            succEl.innerText = "Password reset email sent! Check your inbox for the recovery link.";
            succEl.style.display = "block";
          }
          btn.innerText = "Sent!";
        } catch (err) {
          btn.disabled = false;
          btn.innerText = "Send Password Reset Link";
          if (errEl) {
            errEl.innerText = err.message || "Could not send password reset email. Please check the address.";
            errEl.style.display = "block";
          }
        }
      });
      return;
    }

    // Handle Reset Password flow
    if (type === "reset-password") {
      const resetForm = document.getElementById("auth-reset-form");
      resetForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("auth-error-banner");
        const succEl = document.getElementById("auth-success-banner");
        const btn = document.getElementById("auth-reset-submit-btn");
        if (errEl) errEl.style.display = "none";
        if (succEl) succEl.style.display = "none";

        const newPass = document.getElementById("auth-new-password")?.value || "";
        const confirmPass = document.getElementById("auth-confirm-password")?.value || "";

        if (newPass.length < 8) {
          if (errEl) { errEl.innerText = "Password must be at least 8 characters long."; errEl.style.display = "block"; }
          return;
        }

        if (newPass !== confirmPass) {
          if (errEl) { errEl.innerText = "Passwords do not match."; errEl.style.display = "block"; }
          return;
        }

        // Extract userId and secret from query or hash
        const rawHashParams = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
        const urlParams = new URLSearchParams(window.location.search || rawHashParams);
        const userId = urlParams.get("userId");
        const secret = urlParams.get("secret");

        if (!userId || !secret) {
          if (errEl) {
            errEl.innerText = "Invalid or expired recovery link. Please request a new one.";
            errEl.style.display = "block";
          }
          return;
        }

        try {
          btn.disabled = true;
          btn.innerText = "Updating Password...";
          await AuthService.completePasswordReset(userId, secret, newPass);
          if (succEl) {
            succEl.innerText = "Password successfully reset! You can now sign in with your new password.";
            succEl.style.display = "block";
          }
          setTimeout(() => {
            window.location.hash = "#login";
          }, 2000);
        } catch (err) {
          btn.disabled = false;
          btn.innerText = "Save New Password";
          if (errEl) {
            errEl.innerText = err.message || "Failed to reset password. The link may have expired.";
            errEl.style.display = "block";
          }
        }
      });
      return;
    }

    // Handle Email Verification flow
    if (type === "verify-email") {
      const statusText = document.getElementById("verify-status-text");
      const actionArea = document.getElementById("verify-action-area");

      const rawHashParams = window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "";
      const urlParams = new URLSearchParams(window.location.search || rawHashParams);
      const userId = urlParams.get("userId");
      const secret = urlParams.get("secret");

      if (!userId || !secret) {
        if (statusText) statusText.innerText = "No verification token found in URL. If you received a link, please make sure you clicked the full address.";
        if (actionArea) actionArea.style.display = "block";
        return;
      }

      try {
        await AuthService.verifyEmail(userId, secret);
        if (statusText) {
          statusText.innerHTML = `<span style="color: #059669; font-weight: 700;">✅ Email successfully verified!</span><br><br>Your TransMove account email is now confirmed.`;
        }
        if (actionArea) actionArea.style.display = "block";
      } catch (err) {
        if (statusText) {
          statusText.innerHTML = `<span style="color: #e11d48; font-weight: 700;">Verification Error</span><br><br>${err.message || "The verification link may have expired or is invalid."}`;
        }
        if (actionArea) actionArea.style.display = "block";
      }
      return;
    }

    // Handle Login and Register Form Submissions
    const isRegister = type === "register";
    const form = document.getElementById("auth-form");

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorBanner = document.getElementById("auth-error-banner");
      const successBanner = document.getElementById("auth-success-banner");
      if (errorBanner) errorBanner.style.display = "none";
      if (successBanner) successBanner.style.display = "none";

      const submitBtn = document.getElementById("auth-submit-btn");
      const email = document.getElementById("auth-email")?.value.trim() || "";
      const password = document.getElementById("auth-password")?.value || "";

      // Client-side email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        if (errorBanner) {
          errorBanner.innerText = "Please enter a valid email address.";
          errorBanner.style.display = "block";
        }
        return;
      }

      if (!password) {
        if (errorBanner) {
          errorBanner.innerText = "Please enter your password.";
          errorBanner.style.display = "block";
        }
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerText = isRegister ? "Creating Account..." : "Signing in...";

        if (isRegister) {
          const fullName = document.getElementById("auth-name")?.value.trim() || "";
          const phoneNumber = document.getElementById("auth-phone")?.value.trim() || "";
          const role = document.getElementById("auth-role")?.value || "customer";

          const regRes = await AuthService.register({
            email,
            password,
            fullName,
            phoneNumber,
            role
          });

          const profile = regRes.profile || await AuthService.getCurrentProfile();
          const primaryRole = AuthService.getPrimaryRole(profile) || (role === "driver" ? "driver" : "passenger");
          AuthService.setActiveRole(profile, primaryRole);

          if (sessionStorage.getItem("transmove_pending_request")) {
            window.location.hash = "#customer?tab=search";
          } else {
            const roleRouteMap = {
              customer: "passenger",
              passenger: "passenger",
              driver: "driver",
              cargo_owner: "cargo-owner",
              logistics: "logistics",
              vehicle_owner: "vehicle-owner",
              machinery_owner: "machinery-owner",
              machinery_hirer: "machinery-hirer",
              admin: "admin"
            };
            window.location.hash = `#${roleRouteMap[primaryRole] || "passenger"}`;
          }
        } else {
          const loginRes = await AuthService.login({ email, password });
          const profile = loginRes.profile || await AuthService.getCurrentProfile();

          if (!profile) {
            throw new Error("Your account profile could not be loaded. Please contact support.");
          }

          if (profile.account_status === "suspended" || profile.account_status === "deactivated") {
            await AuthService.logout();
            throw new Error("Your account has been suspended. Please contact support.");
          }

          const primaryRole = AuthService.getPrimaryRole(profile);
          AuthService.setActiveRole(profile, primaryRole);

          if (sessionStorage.getItem("transmove_pending_request")) {
            window.location.hash = "#customer?tab=search";
          } else {
            const roleRouteMap = {
              customer: "passenger",
              passenger: "passenger",
              driver: "driver",
              cargo_owner: "cargo-owner",
              logistics: "logistics",
              vehicle_owner: "vehicle-owner",
              machinery_owner: "machinery-owner",
              machinery_hirer: "machinery-hirer",
              admin: "admin"
            };
            window.location.hash = `#${roleRouteMap[primaryRole] || "passenger"}`;
          }
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerText = isRegister ? "Create Account" : "Sign In";

        let userMsg = err.message || "An unexpected authentication error occurred.";
        if (
          userMsg.includes("Invalid credentials") ||
          userMsg.includes("user_invalid_credentials") ||
          userMsg.includes("Invalid login credentials")
        ) {
          userMsg = "Incorrect email or password.";
        } else if (userMsg.includes("already exists")) {
          userMsg = "An account with this email already exists. Please Sign In.";
        } else if (userMsg.includes("Failed to fetch")) {
          userMsg = "Unable to connect to service. Please check your network connection.";
        }

        if (errorBanner) {
          errorBanner.innerText = userMsg;
          errorBanner.style.display = "block";
        } else {
          alert(userMsg);
        }
      }
    });
  }
};
