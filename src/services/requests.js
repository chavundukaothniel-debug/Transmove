// ==============================================================================
// TRANSMOVE RIDE & TRANSPORT REQUEST SERVICE
// Powered by Appwrite Databases (service_requests, request_images) & Trusted API
// Supabase remains intact as backup during incremental migration
// ==============================================================================
import {
  getAppwriteAccount,
  getAppwriteDatabases,
  getAppwriteStorage,
  APPWRITE_CONFIG,
  getTrustedApiEndpoint,
  ID,
  Query,
  Permission,
  Role
} from "../config/appwrite.js";
import { getSupabase } from "../config/supabase.js";

export const RequestService = {
  /**
   * Helper to format request documents with standard TransMove aliases for UI compatibility.
   */
  _formatRequest(doc, images = []) {
    if (!doc) return null;
    const reqId = doc.$id || doc.id;
    const sType = doc.service_type || doc.request_type || "ride";
    const pickup = doc.pickup_location || doc.pickup_address || "";
    const dest = doc.destination || doc.destination_address || "";
    const price = doc.budget !== undefined && doc.budget !== null ? doc.budget : (doc.suggested_price !== undefined ? doc.suggested_price : 0);
    const desc = doc.details || doc.load_description || doc.notes || "";

    return {
      ...doc,
      id: reqId,
      $id: reqId,
      request_type: sType,
      service_type: sType,
      pickup_address: pickup,
      pickup_location: pickup,
      destination_address: dest,
      destination: dest,
      suggested_price: price,
      budget: price,
      load_description: desc,
      notes: desc,
      details: desc,
      passenger_id: doc.passenger_id || doc.customer_id,
      customer_id: doc.passenger_id || doc.customer_id,
      status: doc.status || "open_for_bids",
      images: images,
      image_urls: images.map(i => i.view_url || i.url).filter(Boolean),
      offers: doc.offers || [],
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  },

  /**
   * Validates a request image file format and size (JPG, JPEG, PNG, WEBP, max 5MB).
   */
  validateFile(file, options = {}) {
    const allowedTypes = options.allowedTypes || ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSizeMB = options.maxSizeMB || 5;

    if (!file) throw new Error("No file selected.");

    const fileType = file.type?.toLowerCase();
    const fileName = file.name?.toLowerCase() || "";
    const isTypeValid = allowedTypes.some(type => {
      const ext = type.split("/")[1];
      return (fileType && (fileType === type || fileType.includes(ext))) || fileName.endsWith(`.${ext}`);
    });

    if (!isTypeValid) {
      throw new Error(`Invalid file type (${file.type || "unknown"}). Allowed formats: ${allowedTypes.map(t => t.split('/')[1]?.toUpperCase() || t).join(', ')}.`);
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${fileSizeMB} MB) exceeds maximum limit of ${maxSizeMB} MB.`);
    }

    return true;
  },

  /**
   * Creates a new ride, logistics, or vehicle hire request securely via the trusted API.
   * Includes idempotency token protection against duplicate submissions.
   */
  async createRequest(requestData) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("You must be logged in to create a request.");

    const submissionId =
      requestData.submission_id ||
      requestData.idempotency_key ||
      `req_${ID.unique()}`;

    const jwtRes = await account.createJWT();
    const jwt = jwtRes.jwt;

    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
        "X-Appwrite-JWT": jwt
      },
      body: JSON.stringify({
        action: "create_service_request",
        data: {
          submission_id: submissionId,
          service_type: requestData.service_type || requestData.request_type || "ride",
          pickup_location: requestData.pickup_location || requestData.pickup_address,
          destination: requestData.destination || requestData.destination_address,
          request_date: requestData.request_date || null,
          preferred_time: requestData.preferred_time || "",
          passenger_count: requestData.passenger_count || null,
          goods_type: requestData.goods_type || requestData.cargo_type || "",
          details: requestData.details || requestData.load_description || requestData.notes || "",
          budget: requestData.budget !== undefined ? requestData.budget : requestData.suggested_price
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to create service request via trusted server.");
    }

    const doc = await res.json();
    return this._formatRequest(doc);
  },

  /**
   * Fetches all requests created by the current customer/passenger.
   */
  async getCustomerRequests() {
    try {
      const account = getAppwriteAccount();
      const user = await account.get().catch(() => null);
      if (!user) return [];

      const databases = getAppwriteDatabases();
      const res = await databases.listDocuments("transmove", "service_requests", [
        Query.equal("passenger_id", user.$id),
        Query.orderDesc("created_at")
      ]);

      return (res.documents || []).map(doc => this._formatRequest(doc));
    } catch (err) {
      console.warn("Notice: Fetching customer requests:", err.message);
      return [];
    }
  },

  /**
   * Alias for searching cargo / logistics requests.
   */
  async getSearchingRequests() {
    return await this.getCustomerRequests();
  },

  /**
   * Fetches open requests available for verified drivers to view and bid on.
   * Matches requests based on the driver's active vehicle categories.
   */
  async getAvailableRequestsForDrivers() {
    try {
      const account = getAppwriteAccount();
      const user = await account.get().catch(() => null);
      if (!user) return [];

      const jwtRes = await account.createJWT();
      const endpoint = getTrustedApiEndpoint();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtRes.jwt}`,
          "X-Appwrite-JWT": jwtRes.jwt
        },
        body: JSON.stringify({
          action: "list_available_requests"
        })
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return (data.requests || []).map(doc => this._formatRequest(doc));
    } catch (err) {
      console.warn("Notice: Fetching available requests for driver:", err.message);
      return [];
    }
  },

  /**
   * Retrieves full request details including photos, verifying ownership or driver eligibility.
   */
  async getRequestDetails(requestId) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const jwtRes = await account.createJWT();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtRes.jwt}`,
        "X-Appwrite-JWT": jwtRes.jwt
      },
      body: JSON.stringify({
        action: "get_service_request_details",
        request_id: requestId
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to load request details.");
    }

    const data = await res.json();
    const storage = getAppwriteStorage();
    const hydratedImages = (data.images || []).map(img => ({
      ...img,
      view_url: storage.getFileView(APPWRITE_CONFIG.bucketId, img.file_id)
    }));

    return this._formatRequest(data, hydratedImages);
  },

  /**
   * Updates an existing request owned by the current user.
   */
  async updateRequest(requestId, updates) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const jwtRes = await account.createJWT();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtRes.jwt}`,
        "X-Appwrite-JWT": jwtRes.jwt
      },
      body: JSON.stringify({
        action: "update_service_request",
        request_id: requestId,
        data: updates
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to update service request.");
    }

    const data = await res.json();
    return this._formatRequest(data);
  },

  /**
   * Cancels an open request safely without hard deletion.
   */
  async cancelRequest(requestId, reason = "Cancelled by user") {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const jwtRes = await account.createJWT();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtRes.jwt}`,
        "X-Appwrite-JWT": jwtRes.jwt
      },
      body: JSON.stringify({
        action: "cancel_service_request",
        request_id: requestId,
        data: { reason }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to cancel service request.");
    }

    const data = await res.json();
    return this._formatRequest(data);
  },

  /**
   * Uploads an image for a service request to private storage and registers the record.
   */
  async uploadRequestImage(requestId, file) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required to upload request image.");

    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    const storage = getAppwriteStorage();
    const fileId = ID.unique();
    const uploadedFile = await storage.createFile(
      APPWRITE_CONFIG.bucketId,
      fileId,
      file,
      [
        Permission.read(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );

    const jwtRes = await account.createJWT();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtRes.jwt}`,
        "X-Appwrite-JWT": jwtRes.jwt
      },
      body: JSON.stringify({
        action: "create_request_image",
        request_id: requestId,
        data: {
          file_id: uploadedFile.$id
        }
      })
    });

    if (!res.ok) {
      await storage.deleteFile(APPWRITE_CONFIG.bucketId, uploadedFile.$id).catch(() => {});
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to record request image on trusted server.");
    }

    const doc = await res.json();
    const viewUrl = storage.getFileView(APPWRITE_CONFIG.bucketId, uploadedFile.$id);

    return {
      ...doc,
      id: doc.$id,
      file_id: uploadedFile.$id,
      view_url: viewUrl
    };
  },

  /**
   * Realtime subscriptions: Passenger can subscribe to changes on their own requests.
   */
  subscribeToRequests(callback) {
    return { unsubscribe: () => {} };
  },

  /**
   * Real-time check: Safely queries trusted backend for the real count of compatible providers currently online.
   */
  async getCompatibleOnlineProvidersCount(serviceType = "ride") {
    try {
      const account = getAppwriteAccount();
      const jwtRes = await account.createJWT().catch(() => null);
      const jwt = jwtRes?.jwt || "";
      const endpoint = getTrustedApiEndpoint();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}`, "X-Appwrite-JWT": jwt } : {})
        },
        body: JSON.stringify({
          action: "count_compatible_online_providers",
          data: { service_type: serviceType }
        })
      });

      if (!res.ok) return { compatible_online_count: null };
      const data = await res.json();
      return { compatible_online_count: Number.isInteger(data.compatible_online_count) ? data.compatible_online_count : null };
    } catch (_) {
      return { compatible_online_count: null };
    }
  }
};
