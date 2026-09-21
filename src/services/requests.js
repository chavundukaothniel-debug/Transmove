// ==============================================================================
// TRANSMOVE RIDE & TRANSPORT REQUEST SERVICE
// Powered by Supabase Backend & Google Drive Storage via Trusted API
// Zero client-side Appwrite writes.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt } from "../config/supabase.js";
import { AuthService } from "./auth.js";

async function trustedCall(action, data = {}, extra = {}) {
  const jwt = await getAuthJwt();
  if (!jwt) throw new Error("Authentication required.");

  const endpoint = getTrustedApiEndpoint();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`
    },
    body: JSON.stringify({
      action,
      data,
      jwt,
      ...extra
    })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `Trusted API error (HTTP ${res.status})`);
    err.status = res.status;
    throw err;
  }
  return json;
}

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
      pickup_latitude: doc.pickup_latitude !== undefined && doc.pickup_latitude !== null ? doc.pickup_latitude : (doc.pickup_lat ?? null),
      pickup_longitude: doc.pickup_longitude !== undefined && doc.pickup_longitude !== null ? doc.pickup_longitude : (doc.pickup_lng ?? null),
      destination_address: dest,
      destination: dest,
      destination_latitude: doc.destination_latitude !== undefined && doc.destination_latitude !== null ? doc.destination_latitude : (doc.destination_lat ?? null),
      destination_longitude: doc.destination_longitude !== undefined && doc.destination_longitude !== null ? doc.destination_longitude : (doc.destination_lng ?? null),
      suggested_price: price,
      budget: price,
      load_description: desc,
      notes: desc,
      details: desc,
      passenger_id: doc.passenger_id || doc.customer_id,
      customer_id: doc.passenger_id || doc.customer_id,
      status: doc.status || "open_for_bids",
      images: images,
      image_urls: images.map(i => i.view_url || i.url || i.file_url).filter(Boolean),
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
   * Includes idempotency token protection against duplicate submissions and controlled 429 retry.
   */
  async createRequest(requestData) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("You must be logged in to create a request.");

    const submissionId =
      requestData.submission_id ||
      requestData.idempotency_key ||
      `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const delays = [1000, 2000, 4000];
    const maxAttempts = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const doc = await trustedCall("create_service_request", {
          submission_id: submissionId,
          service_type: requestData.service_type || requestData.request_type || "ride",
          pickup_location: requestData.pickup_location || requestData.pickup_address,
          pickup_latitude: requestData.pickup_latitude ?? requestData.pickup_lat ?? null,
          pickup_longitude: requestData.pickup_longitude ?? requestData.pickup_lng ?? null,
          destination: requestData.destination || requestData.destination_address,
          destination_latitude: requestData.destination_latitude ?? requestData.destination_lat ?? null,
          destination_longitude: requestData.destination_longitude ?? requestData.destination_lng ?? null,
          request_date: requestData.request_date || null,
          preferred_time: requestData.preferred_time || "",
          passenger_count: requestData.passenger_count || null,
          goods_type: requestData.goods_type || requestData.cargo_type || "",
          details: requestData.details || requestData.load_description || requestData.notes || "",
          budget: requestData.budget !== undefined ? requestData.budget : requestData.suggested_price
        });

        return this._formatRequest(doc);
      } catch (err) {
        lastError = err;
        const isRateLimit = err?.code === 429 ||
          err?.message?.toLowerCase().includes("rate limit") ||
          err?.status === 429;

        if (isRateLimit && attempt < maxAttempts) {
          const waitMs = delays[attempt - 1] || 4000;
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error("Failed to create service request after multiple attempts.");
  },

  /**
   * Fetches all requests created by the current customer/passenger.
   */
  async getCustomerRequests() {
    try {
      const user = await AuthService.getCurrentUser();
      if (!user) return [];

      try {
        const data = await trustedCall("list_passenger_requests", {});
        const reqs = data.requests || data.documents || [];
        if (Array.isArray(reqs)) {
          return reqs.map(doc => this._formatRequest(doc));
        }
      } catch (_) {}

      return [];
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
      const user = await AuthService.getCurrentUser();
      if (!user) return [];

      const data = await trustedCall("list_available_requests", {});
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
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const data = await trustedCall("get_service_request_details", {}, { request_id: requestId });
    const hydratedImages = (data.images || []).map(img => ({
      ...img,
      view_url: img.view_url || img.file_url || `/api/files/preview/${img.drive_file_id || img.file_id}`
    }));

    return this._formatRequest(data, hydratedImages);
  },

  /**
   * Updates an existing request owned by the current user.
   */
  async updateRequest(requestId, updates) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const data = await trustedCall("update_service_request", updates, { request_id: requestId });
    return this._formatRequest(data);
  },

  /**
   * Cancels an open request safely without hard deletion.
   */
  async cancelRequest(requestId, reason = "Cancelled by user") {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const data = await trustedCall("cancel_service_request", { reason }, { request_id: requestId });
    return this._formatRequest(data);
  },

  /**
   * Uploads an image for a service request to Google Drive storage and registers the record.
   */
  async uploadRequestImage(requestId, file) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required to upload request image.");

    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64String = result.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const doc = await trustedCall("create_request_image", {
      file_base64: base64,
      original_filename: file.name || "request_item.jpg",
      mime_type: file.type || "image/jpeg"
    }, { request_id: requestId });

    const fileId = doc.drive_file_id || doc.file_id || doc.id;
    const viewUrl = doc.file_url || `/api/files/preview/${fileId}`;

    return {
      ...doc,
      id: doc.id || doc.$id,
      file_id: fileId,
      view_url: viewUrl
    };
  },

  /**
   * Realtime subscriptions fallback polling.
   */
  subscribeToRequests(callback) {
    return { unsubscribe: () => {} };
  },

  /**
   * Real-time check: Safely queries trusted backend for the real count of compatible providers currently online.
   */
  async getCompatibleOnlineProvidersCount(serviceType = "ride") {
    try {
      const jwt = await getAuthJwt();
      const endpoint = getTrustedApiEndpoint();

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        body: JSON.stringify({
          action: "count_compatible_online_providers",
          data: { service_type: serviceType },
          jwt
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
