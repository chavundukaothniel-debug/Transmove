// ==============================================================================
// TRANSMOVE CENTRALIZED SOCIAL MEDIA CONFIGURATION
// Configured official channels. Empty strings indicate unconfigured accounts.
// RULE: DO NOT display fake active links if unconfigured.
// ==============================================================================

export const SOCIAL_CONFIG = {
  whatsapp: {
    number: "263780266401",
    label: "WhatsApp",
    supportLabel: "Chat with TransMove on WhatsApp"
  },
  facebook: {
    url: "", // Unconfigured official account (do not render fake link)
    label: "Facebook"
  },
  instagram: {
    url: "", // Unconfigured
    label: "Instagram"
  },
  tiktok: {
    url: "", // Unconfigured
    label: "TikTok"
  },
  x: {
    url: "", // Unconfigured
    label: "X (Twitter)"
  },
  linkedin: {
    url: "", // Unconfigured
    label: "LinkedIn"
  }
};

/**
 * Returns only the legitimately configured external social channels.
 */
export function getConfiguredSocialLinks() {
  const result = [];
  for (const [platform, data] of Object.entries(SOCIAL_CONFIG)) {
    if (platform === "whatsapp") continue; // Handled specially for support chat
    if (data.url && typeof data.url === "string" && data.url.trim().length > 0) {
      result.push({
        platform,
        label: data.label,
        url: data.url.trim()
      });
    }
  }
  return result;
}

/**
 * Generates a valid official WhatsApp support URL with prefilled text.
 */
export function getWhatsAppSupportUrl(message = "Hello TransMove Support, I need assistance with my account.") {
  const cleanPhone = (SOCIAL_CONFIG.whatsapp?.number || "263780266401").replace(/[^0-9]/g, "");
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
