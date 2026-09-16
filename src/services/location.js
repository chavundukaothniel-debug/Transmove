import { getSupabase } from "../config/supabase.js";

export const LocationService = {
  // Zimbabwe center defaults (Harare)
  DEFAULT_CENTER: { lat: -17.8252, lng: 31.0335, name: "Harare, Zimbabwe" },

  ZIMBABWE_MAJOR_CITIES: [
    { name: "Harare CBD", lat: -17.8292, lng: 31.0522 },
    { name: "Bulawayo Central", lat: -20.1569, lng: 28.5833 },
    { name: "Chitungwiza", lat: -18.0127, lng: 31.0763 },
    { name: "Mutare", lat: -18.9707, lng: 32.6708 },
    { name: "Gweru", lat: -19.4500, lng: 29.8167 },
    { name: "Victoria Falls", lat: -17.9244, lng: 25.8567 },
    { name: "Kwekwe", lat: -18.9281, lng: 29.8149 },
    { name: "Masvingo", lat: -20.0744, lng: 30.8281 }
  ],

  /**
   * Requests real browser geolocation.
   * Gracefully handles denied permissions or location timeouts.
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let msg = "Unable to retrieve your location.";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = "Location access denied. Please enable location permission in your browser.";
              break;
            case error.POSITION_UNAVAILABLE:
              msg = "Location information is currently unavailable.";
              break;
            case error.TIMEOUT:
              msg = "The request to get user location timed out.";
              break;
          }
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  /**
   * Starts real-time browser location tracking.
   */
  watchPosition(onSuccess, onError) {
    if (!navigator.geolocation) return null;
    return navigator.geolocation.watchPosition(
      (pos) => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading }),
      onError,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  },

  /**
   * Broadcasts live location over Supabase Realtime channel.
   */
  broadcastLiveLocation(channelName, userId, role, coords) {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase.channel(channelName);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "location_update",
          payload: { userId, role, lat: coords.lat, lng: coords.lng, timestamp: new Date().toISOString() }
        });
      }
    });
  },

  /**
   * Reverse geocodes coordinates to a human-readable street address using OpenStreetMap Nominatim.
   */
  async reverseGeocode(lat, lng) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!response.ok) throw new Error("Geocoding service unavailable");
      const data = await response.json();
      return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch (err) {
      console.warn("Reverse geocoding error:", err);
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  },

  /**
   * Searches for addresses matching a query string, prioritizing Zimbabwe.
   */
  async searchAddress(query) {
    if (!query || query.trim().length < 2) return [];
    try {
      const zimQuery = query.toLowerCase().includes("zimbabwe") ? query : `${query}, Zimbabwe`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zimQuery)}&limit=6&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data.map((item) => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    } catch (err) {
      console.warn("Address search error:", err);
      return [];
    }
  },

  /**
   * Calculates Haversine great-circle distance between two coordinates in Kilometers.
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return parseFloat(d.toFixed(2));
  },

  /**
   * Estimates duration in minutes given distance in km and service type.
   */
  estimateDuration(distanceKm, serviceType = "ride") {
    if (!distanceKm || isNaN(distanceKm)) return null;
    const speedKmH = serviceType === "logistics" ? 30 : 35;
    const hours = distanceKm / speedKmH;
    const minutes = Math.ceil(hours * 60) + 5;
    return minutes;
  },

  // Saved Locations CRUD
  async getSavedLocations(userId) {
    const supabase = getSupabase();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("saved_locations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("Saved locations fetch error:", error.message);
      return [];
    }
    return data || [];
  },

  async addSavedLocation(userId, label, address, lat, lng) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");
    const { data, error } = await supabase
      .from("saved_locations")
      .insert([{ user_id: userId, label, address, latitude: lat, longitude: lng }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteSavedLocation(id) {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase client uninitialized.");
    const { error } = await supabase.from("saved_locations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return true;
  }
};

