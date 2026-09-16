// ==============================================================================
// TRANSMOVE REAL ADVERTISING PLATFORM SERVICE
// Campaign creation, ad placement rendering, impression & click event tracking
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const AdvertisingService = {
  /**
   * Creates a new advertising campaign.
   */
  async createCampaign(campaignData) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) throw new Error("Authentication required to create campaign.");

    const { data, error } = await supabase
      .from("advertisements")
      .insert([
        {
          advertiser_user_id: session.user.id,
          company_name: campaignData.company_name,
          title: campaignData.title,
          description: campaignData.description,
          image_url: campaignData.image_url,
          destination_url: campaignData.destination_url,
          placement: campaignData.placement || "marketplace_banner",
          budget: parseFloat(campaignData.budget || 0),
          status: "pending_review",
          start_at: campaignData.start_at || new Date().toISOString(),
          end_at: campaignData.end_at || null
        }
      ])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Fetches approved active advertisements for a specific placement slot.
   */
  async getActiveAdsByPlacement(placement = "marketplace_banner") {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("advertisements")
      .select("*")
      .eq("placement", placement)
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  },

  /**
   * Records a real impression event for an ad.
   */
  async recordImpression(adId) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("ad_events").insert([
        { advertisement_id: adId, user_id: session?.user?.id || null, event_type: "impression" }
      ]);
      // Increment impressions counter on advertisement row
      await supabase.rpc("increment_ad_impressions", { p_ad_id: adId }).catch(() => {
        // Fallback update if RPC not present
        supabase.from("advertisements").update({ updated_at: new Date().toISOString() }).eq("id", adId);
      });
    } catch (err) {
      console.warn("Impression log notice:", err.message);
    }
  },

  /**
   * Records a real click event for an ad and returns the destination URL.
   */
  async recordClick(adId) {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from("ad_events").insert([
        { advertisement_id: adId, user_id: session?.user?.id || null, event_type: "click" }
      ]);
    } catch (err) {
      console.warn("Click log notice:", err.message);
    }

    const { data: ad } = await supabase.from("advertisements").select("destination_url").eq("id", adId).single();
    return ad?.destination_url || null;
  },

  /**
   * Fetches all campaigns for an advertiser.
   */
  async getAdvertiserCampaigns(userId) {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("advertisements")
      .select("*")
      .eq("advertiser_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  },

  /**
   * Admin: Fetches all ad campaigns for review and moderation.
   */
  async getAllCampaignsForAdmin() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("advertisements")
      .select("*, advertiser:advertiser_user_id(full_name, email)")
      .order("created_at", { ascending: false });

    if (error) return [];
    return data || [];
  },

  /**
   * Admin: Approves, rejects, or pauses a campaign.
   */
  async updateCampaignStatus(adId, status, rejectionReason = null) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");

    const { data, error } = await supabase
      .from("advertisements")
      .update({
        status,
        rejection_reason: rejectionReason,
        updated_at: new Date().toISOString()
      })
      .eq("id", adId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
};
