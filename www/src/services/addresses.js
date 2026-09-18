// ==============================================================================
// TRANSMOVE SAVED ADDRESSES SERVICE
// ==============================================================================
import { getTrustedApiEndpoint, getAppwriteAccount } from "../config/appwrite.js";

async function callTrustedApi(action, data = {}) {
  const endpoint = getTrustedApiEndpoint();
  const account = getAppwriteAccount();
  const jwtRes = await account.createJWT();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtRes.jwt}`,
      "X-Appwrite-JWT": jwtRes.jwt
    },
    body: JSON.stringify({ action, data })
  });

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || "Address operation failed.");
    err.status = res.status;
    throw err;
  }
  return json;
}

export const AddressService = {
  /**
   * Saves a new address (Home, Work, School, Custom).
   */
  async createSavedAddress({ label = "Custom", title, address, lat, lng, notes }) {
    if (!address) throw new Error("Address is required.");
    return callTrustedApi("create_saved_address", {
      label,
      title: title || label,
      address,
      lat,
      lng,
      notes
    });
  },

  /**
   * Lists all saved addresses for the authenticated passenger.
   */
  async getSavedAddresses() {
    const res = await callTrustedApi("list_saved_addresses", {});
    return res.addresses || [];
  },

  /**
   * Updates an existing saved address.
   */
  async updateSavedAddress(id, data) {
    if (!id) throw new Error("Address ID is required.");
    return callTrustedApi("update_saved_address", { id, ...data });
  },

  /**
   * Deletes a saved address.
   */
  async deleteSavedAddress(id) {
    if (!id) throw new Error("Address ID is required.");
    return callTrustedApi("delete_saved_address", { id });
  }
};
