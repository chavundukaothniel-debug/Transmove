import { getSupabase } from "../config/supabase.js";
import { DevicePermissionService } from "./device-permissions.js";

const ensureLocationPermission = async () => {
  let status = await DevicePermissionService.checkLocation();
  if (status === "prompt") status = await DevicePermissionService.requestLocation();
  if (status !== "granted") {
    throw new Error("Location access is not allowed. Enable it in app settings or enter the address manually.");
  }
};

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
  async getCurrentPosition() {
    await ensureLocationPermission();
    if (DevicePermissionService.isAndroid()) {
      const position = await DevicePermissionService.getNativeGeolocation().getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      return {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
    }

    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
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
  async watchPosition(onSuccess, onError) {
    await ensureLocationPermission();
    if (DevicePermissionService.isAndroid()) {
      return DevicePermissionService.getNativeGeolocation().watchPosition(
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 },
        (position, error) => {
          if (error) {
            onError?.(error);
            return;
          }
          if (position) onSuccess({ lat: position.coords.latitude, lng: position.coords.longitude, heading: position.coords.heading });
        }
      );
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return navigator.geolocation.watchPosition(
      (pos) => onSuccess({ lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading }),
      onError,
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  },

  async clearWatch(watchId) {
    if (watchId === null || watchId === undefined) return;
    if (DevicePermissionService.isAndroid()) {
      await DevicePermissionService.getNativeGeolocation().clearWatch({ id: String(watchId) });
      return;
    }
    navigator.geolocation?.clearWatch(watchId);
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

  // In-memory caches for the current browser session
  _searchCache: new Map(),
  _reverseCache: new Map(),
  _routeCache: new Map(),

  /**
   * Synchronous check for cached geocoding results.
   */
  searchAddressFromCache(query) {
    if (!query) return null;
    const normalized = query.trim().toLowerCase();
    const res = this._searchCache.get(normalized);
    return (res && res.length > 0) ? res : null;
  },

  /**
   * Reverse geocodes coordinates to a human-readable street address using OpenStreetMap Nominatim.
   * Cached in-memory to prevent repeated network requests.
   * Tolerates 429 and network errors gracefully.
   */
  async reverseGeocode(lat, lng) {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return "";
    const key = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
    if (this._reverseCache.has(key)) {
      return this._reverseCache.get(key);
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "TransMove/1.0 (Ride Logistics Platform)" } }
      );
      if (!response.ok) {
        const fallback = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
        this._reverseCache.set(key, fallback);
        return fallback;
      }
      const data = await response.json();
      const address = data.display_name || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
      this._reverseCache.set(key, address);
      return address;
    } catch (err) {
      console.warn("Reverse geocoding notice:", err.message);
      const fallback = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
      return fallback;
    }
  },

  /**
   * Searches for addresses matching a query string, prioritizing Zimbabwe.
   * Cached in-memory to prevent duplicate calls and respect Nominatim rate limits.
   * Gracefully returns cached or empty results on 429 without throwing.
   */
  async searchAddress(query) {
    if (!query || query.trim().length < 2) return [];
    const normalized = query.trim().toLowerCase();
    if (this._searchCache.has(normalized)) {
      return this._searchCache.get(normalized);
    }

    try {
      const zimQuery = normalized.includes("zimbabwe") ? query : `${query}, Zimbabwe`;
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(zimQuery)}&limit=6&addressdetails=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "TransMove/1.0 (Ride Logistics Platform)" } }
      );
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const results = (data || []).map((item) => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));

      if (results.length > 0) {
        this._searchCache.set(normalized, results);
        // Pre-seed reverse cache for resolved coordinates
        results.forEach((r) => {
          if (!isNaN(r.lat) && !isNaN(r.lng)) {
            this._reverseCache.set(`${Number(r.lat).toFixed(5)},${Number(r.lng).toFixed(5)}`, r.address);
          }
        });
      }
      return results;
    } catch (err) {
      console.warn("Address search notice:", err.message);
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

  /**
   * Resolves driving route between two points with in-memory caching.
   * Reuses cached route if coordinates match.
   * Gracefully falls back to Haversine straight-line distance if OSRM is slow or 429.
   */
  async calculateRoute(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null ||
        isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
      return null;
    }

    const key = `${Number(lat1).toFixed(4)},${Number(lon1).toFixed(4)}->${Number(lat2).toFixed(4)},${Number(lon2).toFixed(4)}`;
    if (this._routeCache.has(key)) {
      return this._routeCache.get(key);
    }

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = parseFloat((route.distance / 1000).toFixed(2));
          const durMins = Math.ceil(route.duration / 60);
          const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
          const result = {
            distanceKm: distKm,
            durationMins: durMins,
            coordinates: coords,
            source: "osrm"
          };
          this._routeCache.set(key, result);
          return result;
        }
      }
    } catch (err) {
      console.warn("OSRM routing notice:", err.message);
    }

    // Resilient fallback: Haversine distance
    const dist = this.calculateDistance(lat1, lon1, lat2, lon2);
    const dur = this.estimateDuration(dist);
    const result = {
      distanceKm: dist,
      durationMins: dur,
      coordinates: [[lat1, lon1], [lat2, lon2]],
      source: "haversine"
    };
    this._routeCache.set(key, result);
    return result;
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
