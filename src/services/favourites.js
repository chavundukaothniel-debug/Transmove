// ==============================================================================
// TRANSMOVE FAVOURITES SERVICE
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const jwt = await getAuthJwt();
  if (!jwt) throw new Error("Authentication required.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`
    },
    body: JSON.stringify({ action, data, jwt })
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Favourites operation failed.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export const FavouritesService = {
  /**
   * Saves a driver to authenticated passenger's favourites.
   */
  async addFavourite(driverId) {
    if (!driverId) throw new Error("driverId is required.");
    return callTrustedApi("add_favourite", { driver_id: driverId });
  },

  /**
   * Removes a driver from favourites.
   */
  async removeFavourite(driverId) {
    if (!driverId) throw new Error("driverId is required.");
    return callTrustedApi("remove_favourite", { driver_id: driverId });
  },

  /**
   * Lists all saved drivers for the authenticated passenger.
   */
  async getFavourites() {
    const res = await callTrustedApi("list_favourites", {});
    return res.favourites || [];
  },

  /**
   * Checks if a driver is saved.
   */
  async isFavourite(driverId) {
    try {
      const favs = await this.getFavourites();
      return favs.some(f => (f.$id || f.id || f.user_id) === driverId);
    } catch (_) {
      return false;
    }
  }
};
