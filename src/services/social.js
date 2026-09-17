// ==============================================================================
// TRANSMOVE SOCIAL MEDIA, WHATSAPP & SHARING SERVICE
// ==============================================================================
import { SOCIAL_CONFIG, getConfiguredSocialLinks, getWhatsAppSupportUrl } from "../config/social.js";
import { getTrustedApiEndpoint, getAppwriteAccount } from "../config/appwrite.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  let jwt = "";
  try {
    const account = getAppwriteAccount();
    if (account) {
      const jwtRes = await account.createJWT();
      jwt = jwtRes.jwt || "";
    }
  } catch (_) {}

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}`, "X-Appwrite-JWT": jwt } : {})
    },
    body: JSON.stringify({ action, data })
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Trusted API request failed.");
  return json;
}

export const SocialService = {
  /**
   * Returns configured social links.
   */
  getSocialLinks() {
    return getConfiguredSocialLinks();
  },

  /**
   * Opens official WhatsApp support chat safely.
   */
  launchWhatsAppSupport(customMessage = "Hello TransMove Support, I need assistance with my account.") {
    const url = getWhatsAppSupportUrl(customMessage);
    window.open(url, "_blank", "noopener,noreferrer");
  },

  /**
   * Share TransMove platform via Web Share API or clipboard copy fallback.
   */
  async shareTransMove(options = {}) {
    const title = options.title || "TransMove — Fair Transportation & Cargo Logistics";
    const text = options.text || "Book reliable rides, hire vehicles, and freight cargo across Zimbabwe with TransMove!";
    const url = options.url || window.location.origin;

    if (navigator.share && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return { shared: true, method: "native" };
      } catch (err) {
        if (err.name === "AbortError") return { shared: false, cancelled: true };
      }
    }

    // Fallback: Copy link
    const copied = await this.copyToClipboard(url);
    return { shared: copied, method: "clipboard", url };
  },

  /**
   * Generates a platform-specific social share URL.
   */
  getShareUrl(platform, { text = "", url = "" } = {}) {
    const shareUrl = url || window.location.origin;
    const shareText = text || "Join TransMove — Zimbabwe's Premier Transportation Marketplace!";

    if (platform === "whatsapp") {
      return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    }
    if (platform === "facebook") {
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    }
    if (platform === "x" || platform === "twitter") {
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    }
    return shareUrl;
  },

  /**
   * Copies text to clipboard with legacy fallback.
   */
  async copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch (_) {
      return false;
    }
  },

  /**
   * Fetches safe public provider profile (strictly stripped of sensitive data).
   */
  async getPublicProviderProfile(driverId) {
    return callTrustedApi("get_public_provider_profile", { driver_id: driverId });
  },

  /**
   * Shares a safe public provider profile.
   */
  async shareProvider(driverId, driverName = "Verified Provider") {
    const title = `${driverName} on TransMove`;
    const text = `Check out ${driverName}'s verified transport profile on TransMove!`;
    const url = `${window.location.origin}/#provider?id=${driverId}`;
    return this.shareTransMove({ title, text, url });
  }
};
