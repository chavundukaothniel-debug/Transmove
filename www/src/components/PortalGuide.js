import { APP_DOWNLOADS } from "../config/downloads.js";

export function renderPortalGuide(route) {
  const guides = {
    machinery_owner: ["Your listing journey", "Upload machinery and documents → Admin review → Approved listing appears in the marketplace → Review hire requests and confirm availability."],
    machinery: ["Find equipment for your next job", "Browse approved machinery, compare rates and operator options, then request your dates. Your booking is confirmed when the owner accepts."],
    machinery_hirer: ["Track your machinery hires", "Browse approved equipment, submit a hire request, and track the owner’s response here."],
    driver: ["Your next steps", "Complete vehicle verification, browse matching jobs, send your price and arrival time, then manage accepted trips."],
    customer: ["Plan your journey", "Enter pickup and destination, compare driver offers, then confirm your preferred driver. Use your active trip to track progress and message your driver."]
  };
  const guide = guides[route];
  const download = (platform, label) => {
    const url = APP_DOWNLOADS[platform];
    if (platform === "ios" && !url) return `<a class="btn btn-outline" href="/install-ios.html">Install on iPhone<span class="download-status">Web app</span></a>`;
    if (!url) return `<button class="btn btn-outline" type="button" disabled aria-label="${label}: coming soon">${label}<span class="download-status">Coming soon</span></button>`;
    try {
      if (platform === "android" && url === "/downloads/transmove-android.apk") return `<a class="btn btn-outline" href="${url}" download="TransMove.apk">${label}</a>`;
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") throw new Error("HTTPS required");
      const safe = parsed.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `<a class="btn btn-outline" href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    } catch { return `<button class="btn btn-outline" type="button" disabled>${label} · Coming soon</button>`; }
  };
  return `<section class="portal-guide" aria-label="Portal guidance and app downloads">
    <div>${guide ? `<h2>${guide[0]}</h2><p>${guide[1]}</p>` : `<h2>TransMove on the go</h2><p>Manage your account from your phone, tablet or computer.</p>`}
    <a href="#machinery" class="portal-marketplace-link">Browse approved machinery</a></div>
    <div class="portal-downloads">${download("android", "Download Android APK")}${download("ios", "Download iOS app")}</div>
  </section>`;
}
