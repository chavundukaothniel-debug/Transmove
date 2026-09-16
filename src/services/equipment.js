// ==============================================================================
// TRANSMOVE MACHINERY & EQUIPMENT HIRE SERVICE
// ==============================================================================
import { getSupabase } from "../config/supabase.js";

export const EquipmentService = {
  /**
   * Fetches all approved equipment listings for the public marketplace.
   */
  async getMarketplaceListings(category = null) {
    const supabase = getSupabase();
    if (!supabase) return [];

    let query = supabase
      .from("equipment_listings")
      .select("*, owner:profiles!owner_id(full_name, phone_number, rating_avg, rating_count, profile_photo_url)")
      .eq("verification_status", "approved")
      .neq("availability_status", "maintenance")
      .order("created_at", { ascending: false });

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("Error fetching equipment listings:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Fetches equipment owned by the current logged-in user.
   */
  async getOwnerListings() {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const { data, error } = await supabase
      .from("equipment_listings")
      .select("*")
      .eq("owner_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching owner equipment:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Adds a new machinery/equipment listing.
   */
  async addListing(listingData) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Authentication required");

    const { data, error } = await supabase
      .from("equipment_listings")
      .insert({
        owner_id: session.user.id,
        title: listingData.title,
        category: listingData.category,
        make: listingData.make,
        model: listingData.model,
        year: listingData.year ? parseInt(listingData.year) : null,
        description: listingData.description,
        rate_per_hour: listingData.rate_per_hour ? parseFloat(listingData.rate_per_hour) : null,
        rate_per_day: parseFloat(listingData.rate_per_day),
        rate_currency: listingData.rate_currency || "USD",
        location_name: listingData.location_name,
        latitude: listingData.latitude || null,
        longitude: listingData.longitude || null,
        photos: listingData.photos || [],
        availability_status: "available",
        verification_status: "pending"
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
