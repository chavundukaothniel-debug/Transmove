// ==============================================================================
// TRANSMOVE SOCIAL MEDIA, WHATSAPP & SHARING SERVICE
// Configurable Official Social Media Links, WhatsApp Support & Native Sharing
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const SocialService = {
  /**
   * Fetches official TransMove social media configuration and WhatsApp support number.
   */
  async getSocialConfig() {
    const supabase = getSupabase();
    if (!supabase) return { links: {}, whatsapp: "" };

    try {
      const { data } = await supabase.from("platform_settings").select("*").in("key", ["social_links", "whatsapp_number"]);
      const config = { links: {}, whatsapp: "" };
      (data || []).forEach((row) => {
        if (row.key === "social_links") config.links = row.value || {};
        if (row.key === "whatsapp_number") config.whatsapp = row.value?.number || "";
      });
      return config;
    } catch (err) {
      console.warn("Social config fetch notice:", err.message);
      return { links: {}, whatsapp: "" };
    }
  },

  /**
   * Admin: Saves social links and WhatsApp support contact.
   */
  async saveSocialConfig(links, whatsappNumber) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    await supabase.from("platform_settings").upsert(
      { key: "social_links", value: links, description: "Official TransMove Social Links", updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    await supabase.from("platform_settings").upsert(
      { key: "whatsapp_number", value: { number: whatsappNumber }, description: "Official Support WhatsApp Number", updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    return true;
  },

  /**
   * Opens official WhatsApp support chat.
   */
  async launchWhatsAppSupport(customMessage = "Hello TransMove Support, I need assistance with my account.") {
    const config = await this.getSocialConfig();
    const phone = config.whatsapp ? config.whatsapp.replace(/[^0-9]/g, "") : "263780266401";

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(customMessage)}`;
    window.open(url, "_blank");
  },

  /**
   * Generates social share link for WhatsApp, Facebook, or X.
   */
  shareContent(platform, text, url) {
    const shareUrl = url || window.location.href;
    const shareText = text || "Join TransMove - Zimbabwe's Premier Transportation, Cargo Logistics & Machinery Marketplace!";

    let targetUrl = "";
    if (platform === "whatsapp") {
      targetUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    } else if (platform === "facebook") {
      targetUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    } else if (platform === "x" || platform === "twitter") {
      targetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    }

    if (targetUrl) {
      window.open(targetUrl, "_blank");
    }
  }
};
