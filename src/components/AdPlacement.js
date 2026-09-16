// ==============================================================================
// TRANSMOVE ADPLACEMENT COMPONENT
// Renders real approved advertisements for targeted dashboard placements
// ==============================================================================
import { AdvertisingService } from "../services/advertising.js";

export const AdPlacement = {
  /**
   * Renders the HTML structure for an ad placement section.
   * @param {string} placementKey - Placement identifier (e.g., "DRIVER_DASHBOARD", "VEHICLE_OWNER_DASHBOARD")
   */
  renderContainer(placementKey) {
    return `
      <div id="ad-placement-${placementKey}" class="card" style="margin-top: 1.5rem; border: 1px solid var(--border-light); background: var(--bg-surface);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
          <span style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 0.2rem 0.5rem; background: var(--bg-subtle); color: var(--text-muted); border-radius: 4px; border: 1px solid var(--border-light);">
            SPONSORED
          </span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Verified Advertiser</span>
        </div>
        <div id="ad-content-${placementKey}" style="display: flex; gap: 1rem; align-items: center;">
          <div style="font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 0;">Checking active promotions...</div>
        </div>
      </div>
    `;
  },

  /**
   * Initializes real ad fetching, DOM rendering, impression logging, and click handling.
   * @param {string} placementKey
   */
  async init(placementKey) {
    const container = document.getElementById(`ad-placement-${placementKey}`);
    const content = document.getElementById(`ad-content-${placementKey}`);
    if (!content) return;

    try {
      const ads = await AdvertisingService.getActiveAdsByPlacement(placementKey);
      
      if (!ads || ads.length === 0) {
        if (container) {
          container.innerHTML = `
            <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 0.75rem;">
              No sponsored offers available.
            </div>
          `;
        }
        return;
      }

      // Select random ad from approved active list
      const ad = ads[Math.floor(Math.random() * ads.length)];

      content.innerHTML = `
        ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--border-light);" />` : ''}
        <div style="flex: 1;">
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">${ad.company_name || 'Partner'}</div>
          <div style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0.2rem 0;">${ad.title}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${ad.description}</div>
        </div>
        <button id="btn-ad-click-${ad.id}" class="btn btn-outline btn-sm" style="white-space: nowrap;">
          View Offer ↗
        </button>
      `;

      // Log real impression
      AdvertisingService.recordImpression(ad.id);

      // Handle click
      document.getElementById(`btn-ad-click-${ad.id}`)?.addEventListener("click", async () => {
        const destUrl = await AdvertisingService.recordClick(ad.id);
        if (destUrl) {
          window.open(destUrl, "_blank", "noopener,noreferrer");
        } else if (ad.destination_url) {
          window.open(ad.destination_url, "_blank", "noopener,noreferrer");
        }
      });
    } catch (err) {
      if (container) {
        container.style.display = "none";
      }
    }
  }
};
