import { icon } from "../components/Icon.js";
import { DevicePermissionService } from "../services/device-permissions.js";

const permissionRow = (iconName, title, description) => `
  <div style="display:grid;grid-template-columns:44px 1fr;gap:0.85rem;align-items:start;padding:1rem;border:1px solid var(--border-light,#e2e8f0);border-radius:14px;background:var(--bg-card,#fff);">
    <span style="width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--primary-light,#eff6ff);color:var(--primary,#2563eb);">${icon(iconName, 22)}</span>
    <span><strong style="display:block;color:var(--text-main,#0f172a);margin-bottom:0.2rem;">${title}</strong><small style="display:block;color:var(--text-muted,#64748b);line-height:1.5;">${description}</small></span>
  </div>`;

export const OnboardingView = {
  render() {
    return `
      <main id="permissions-onboarding" style="min-height:calc(100vh - 2rem);display:grid;place-items:center;padding:1rem;background:var(--bg-app,#f8fafc);">
        <section style="width:min(100%,560px);padding:clamp(1.25rem,4vw,2rem);border:1px solid var(--border-light,#e2e8f0);border-radius:22px;background:var(--bg-card,#fff);box-shadow:0 20px 45px rgba(15,23,42,0.12);">
          <div id="permissions-onboarding-content">
            <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
              <span style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--primary,#2563eb);color:#fff;">${icon("bus-front", 25)}</span>
              <span><strong style="display:block;font-size:1.15rem;color:var(--text-main,#0f172a);">TransMove</strong><small style="color:var(--text-muted,#64748b);">Your privacy stays in your control</small></span>
            </div>
            <h1 style="font-size:clamp(1.6rem,5vw,2.15rem);line-height:1.12;color:var(--text-main,#0f172a);margin:0 0 0.65rem;">Set up app permissions</h1>
            <p style="color:var(--text-muted,#64748b);line-height:1.6;margin:0 0 1.25rem;">TransMove asks only when a feature needs access. You can continue without granting permissions and enter locations manually.</p>
            <div style="display:grid;gap:0.75rem;">
              ${permissionRow("map-pin", "Location", "Find your pickup point and help drivers use live trip location when you choose.")}
              ${permissionRow("bell", "Notifications", "Receive booking, driver and trip updates when notifications are available.")}
              ${permissionRow("camera", "Camera and photos", "Attach profile, vehicle and verification images only when you select them.")}
            </div>
            <div style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem;color:var(--text-muted,#64748b);font-size:0.82rem;">${icon("shield-check", 17)}<span>You can change these permissions later from Profile.</span></div>
            <div style="display:grid;gap:0.65rem;margin-top:1.35rem;">
              <button type="button" id="btn-onboarding-continue" class="btn btn-primary" style="width:100%;min-height:46px;font-weight:800;">Continue</button>
              <button type="button" id="btn-onboarding-skip" class="btn btn-outline" style="width:100%;min-height:44px;">Not now</button>
            </div>
          </div>
        </section>
      </main>`;
  },

  init() {
    const complete = () => {
      DevicePermissionService.markOnboardingSeen();
      window.dispatchEvent(new CustomEvent("transmove:permissions-onboarding-complete"));
    };

    document.getElementById("btn-onboarding-skip")?.addEventListener("click", complete);
    document.getElementById("btn-onboarding-continue")?.addEventListener("click", () => {
      const content = document.getElementById("permissions-onboarding-content");
      if (!content) return;
      content.innerHTML = `
        <div style="width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:var(--primary-light,#eff6ff);color:var(--primary,#2563eb);margin-bottom:1rem;">${icon("map-pin", 28)}</div>
        <h1 style="font-size:1.7rem;color:var(--text-main,#0f172a);margin:0 0 0.65rem;">Enable location access?</h1>
        <p style="color:var(--text-muted,#64748b);line-height:1.6;margin:0;">Location helps set accurate pickup points and supports live trip safety. TransMove does not request background location, and you can still type an address manually.</p>
        <div id="onboarding-location-error" role="status" style="display:none;margin-top:1rem;padding:0.75rem;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:0.88rem;"></div>
        <div style="display:grid;gap:0.65rem;margin-top:1.35rem;">
          <button type="button" id="btn-onboarding-enable-location" class="btn btn-primary" style="width:100%;min-height:46px;font-weight:800;">Enable location</button>
          <button type="button" id="btn-onboarding-location-skip" class="btn btn-outline" style="width:100%;min-height:44px;">Not now</button>
        </div>`;

      document.getElementById("btn-onboarding-location-skip")?.addEventListener("click", complete);
      document.getElementById("btn-onboarding-enable-location")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = "Requesting access...";
        try {
          await DevicePermissionService.requestLocation();
          await DevicePermissionService.requestNotification();
          complete();
        } catch (error) {
          const errorBox = document.getElementById("onboarding-location-error");
          if (errorBox) {
            errorBox.textContent = error.message || "Permission could not be requested. You can continue without it.";
            errorBox.style.display = "block";
          }
          button.disabled = false;
          button.textContent = "Try again";
        }
      });
    });
  }
};
