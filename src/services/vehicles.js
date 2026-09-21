// ==============================================================================
// TRANSMOVE VEHICLE & DOCUMENT MANAGEMENT SERVICE
// Powered by Supabase Auth & Google Drive Storage via Render Trusted Backend.
// Appwrite remains only as legacy/archive read bridge.
// ==============================================================================
import { getTrustedApiEndpoint } from "../config/appwrite.js";
import { getAuthJwt, getSupabase } from "../config/supabase.js";
import { AuthService } from "./auth.js";
import { resolveAvatarUrl } from "../utils/avatar.js";

export const VehicleService = {
  /**
   * Helper to convert browser File object to Base64 data string.
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64String = typeof result === "string" ? result.split(",")[1] : "";
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Validates a file's format and size before uploading.
   * Default: JPG, JPEG, PNG, WEBP, max 5MB.
   */
  validateFile(file, options = {}) {
    const allowedTypes = options.allowedTypes || ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const maxSizeMB = options.maxSizeMB || 5;

    if (!file) throw new Error("No file selected.");

    const fileType = file.type?.toLowerCase();
    const fileName = file.name?.toLowerCase() || "";
    const isTypeValid = allowedTypes.some((type) => {
      const ext = type.split("/")[1];
      return (fileType && (fileType === type || fileType.includes(ext))) || fileName.endsWith(`.${ext}`);
    });

    if (!isTypeValid) {
      throw new Error(
        `Invalid file type (${file.type || "unknown"}). Allowed formats: ${allowedTypes.map((t) => t.split("/")[1]?.toUpperCase() || t).join(", ")}.`
      );
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${fileSizeMB} MB) exceeds maximum limit of ${maxSizeMB} MB.`);
    }

    return true;
  },

  /**
   * Uploads profile picture into Google Drive (TransMove/Profiles)
   * and updates profile_photo_url & profile_image_id in Supabase profiles.
   */
  async uploadProfilePicture(file) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required to upload profile photo.");

    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    const base64 = await this.fileToBase64(file);
    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "upload_profile_picture",
        jwt,
        data: {
          file_base64: base64,
          original_filename: file.name,
          mime_type: file.type || "image/jpeg",
          file_size: file.size
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to upload profile photo via trusted server.");
    }

    const result = await res.json();
    const photoUrl = resolveAvatarUrl({
      profile_image_id: result.file_id,
      profile_photo_url: result.photo_url,
      updated_at: result.profile?.updated_at || Date.now()
    });

    AuthService.notifyAuthStateChange("USER_UPDATED", { user });
    return photoUrl;
  },

  /**
   * Maps vehicle types to service categories.
   */
  getServiceCategory(vehicleType) {
    const type = (vehicleType || "").toLowerCase();
    if (type.includes("taxi") || type.includes("sedan") || type.includes("car") || type.includes("suv")) {
      return "passenger_transport";
    }
    if (type.includes("van") || type.includes("pickup") || type.includes("bakkie")) {
      return "light_goods";
    }
    if (type.includes("truck") || type.includes("haulage")) {
      return "heavy_goods";
    }
    if (type.includes("bus") || type.includes("minibus") || type.includes("coaster")) {
      return "bus_passenger";
    }
    if (type.includes("machinery") || type.includes("earthmover") || type.includes("tractor")) {
      return "machinery_hire";
    }
    if (type.includes("motorcycle") || type.includes("bike")) {
      return "courier_express";
    }
    return "general_transport";
  },

  /**
   * Formats a vehicle document with standard aliases for UI compatibility.
   */
  _formatVehicle(doc, photoUrls = [], photoDocs = []) {
    if (!doc) return null;
    const vId = doc.id || doc.$id;
    return {
      ...doc,
      id: vId,
      $id: vId,
      color: doc.colour || doc.color || "White",
      colour: doc.colour || doc.color || "White",
      load_capacity_kg: doc.load_capacity || 0,
      photos: photoUrls.length > 0 ? photoUrls : (doc.photos || []),
      photo_documents: photoDocs.length > 0 ? photoDocs : (doc.photo_documents || [])
    };
  },

  /**
   * Registers a new vehicle with trusted backend.
   */
  async addVehicle(vehicleData) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required to register a vehicle.");

    if (!vehicleData.make || !vehicleData.make.trim()) throw new Error("Vehicle make is required.");
    if (!vehicleData.model || !vehicleData.model.trim()) throw new Error("Vehicle model is required.");
    if (!vehicleData.registration_number || !vehicleData.registration_number.trim()) {
      throw new Error("Vehicle registration number (plate) is required.");
    }

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "create_vehicle",
        jwt,
        data: {
          vehicle_type: vehicleData.vehicle_type || "sedan",
          make: vehicleData.make,
          model: vehicleData.model,
          year: vehicleData.year ? parseInt(vehicleData.year, 10) : new Date().getFullYear(),
          colour: vehicleData.colour || vehicleData.color || "White",
          registration_number: vehicleData.registration_number,
          passenger_capacity: vehicleData.passenger_capacity ? parseInt(vehicleData.passenger_capacity, 10) : 4,
          load_capacity: vehicleData.load_capacity || vehicleData.load_capacity_kg || 0,
          service_category: vehicleData.service_category || this.getServiceCategory(vehicleData.vehicle_type),
          description: vehicleData.description || "",
          status: vehicleData.status || "active",
          is_primary: vehicleData.is_primary === true
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to create vehicle via trusted server.");
    }

    const newVehicle = await res.json();
    return this._formatVehicle(newVehicle, [], []);
  },

  /**
   * Fetches all vehicles belonging to the current authenticated driver.
   */
  async getDriverVehicles() {
    const user = await AuthService.getCurrentUser();
    if (!user) return [];

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        body: JSON.stringify({
          action: "list_driver_vehicles",
          jwt
        })
      });

      if (!res.ok) return [];
      const data = await res.json();
      const vehicles = data.vehicles || [];
      return vehicles.map((v) => this._formatVehicle(v, v.photos || [], v.photo_documents || []));
    } catch (err) {
      console.warn("Error fetching driver vehicles:", err.message);
      return [];
    }
  },

  /**
   * Fetches a single vehicle by ID.
   */
  async getVehicle(vehicleId) {
    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        body: JSON.stringify({
          action: "get_vehicle",
          vehicle_id: vehicleId,
          jwt
        })
      });
      if (res.ok) {
        const data = await res.json();
        return this._formatVehicle(data, data.photos || [], data.photo_documents || []);
      }
    } catch (_) {}
    const vehicles = await this.getDriverVehicles();
    return vehicles.find((v) => v.id === vehicleId || v.$id === vehicleId) || null;
  },

  /**
   * Updates an existing vehicle with verified driver ownership.
   */
  async updateVehicle(vehicleId, updates) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    if (updates.is_primary === true) {
      await this.setPrimaryVehicle(vehicleId);
      const clone = { ...updates };
      delete clone.is_primary;
      if (Object.keys(clone).length === 0) {
        return await this.getVehicle(vehicleId);
      }
      updates = clone;
    }

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "update_vehicle",
        vehicle_id: vehicleId,
        jwt,
        data: updates
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to update vehicle via trusted server.");
    }

    const updated = await res.json();
    return this._formatVehicle(updated, [], []);
  },

  /**
   * Sets a specific vehicle as the primary vehicle.
   */
  async setPrimaryVehicle(vehicleId) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "set_primary_vehicle",
        vehicle_id: vehicleId,
        jwt
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to set primary vehicle.");
    }

    return await res.json();
  },

  /**
   * Toggles vehicle active / inactive status.
   */
  async toggleVehicleStatus(vehicleId, isActive) {
    return await this.updateVehicle(vehicleId, {
      status: isActive ? "active" : "inactive"
    });
  },

  /**
   * Deletes a vehicle and cleans up associated photos.
   */
  async deleteVehicle(vehicleId) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "delete_vehicle",
        vehicle_id: vehicleId,
        jwt
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to delete vehicle.");
    }

    return true;
  },

  /**
   * Uploads a vehicle photo to Google Drive (TransMove/Vehicles) and registers in vehicle_photos.
   */
  async uploadVehiclePhoto(vehicleId, file, isPrimary = false) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    const base64 = await this.fileToBase64(file);
    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "create_vehicle_photo",
        vehicle_id: vehicleId,
        jwt,
        data: {
          file_base64: base64,
          original_filename: file.name,
          mime_type: file.type || "image/jpeg",
          file_size: file.size,
          is_primary: isPrimary
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to record vehicle photo on trusted server.");
    }

    const photoDoc = await res.json();
    const viewUrl = photoDoc.file_url || `/api/files/preview/${photoDoc.drive_file_id}`;

    return {
      photoId: photoDoc.id || photoDoc.$id,
      fileId: photoDoc.drive_file_id || photoDoc.file_id,
      viewUrl,
      isPrimary: photoDoc.is_primary
    };
  },

  /**
   * Deletes a vehicle photo via trusted API.
   */
  async deleteVehiclePhoto(photoId) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required.");

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "delete_vehicle_photo",
        jwt,
        data: { photo_id: photoId }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to delete vehicle photo.");
    }

    return await res.json();
  },

  /**
   * Uploads a confidential verification document to Google Drive (TransMove/Verification/Drivers)
   * and creates a record in verification_documents.
   */
  async uploadVerificationDocument(file, documentType, vehicleId = null) {
    const user = await AuthService.getCurrentUser();
    if (!user) throw new Error("Authentication required for document upload.");

    const typeMap = {
      driver_license: "driver_licence",
      driver_licence: "driver_licence",
      vehicle_registration: "vehicle_registration",
      insurance_policy: "insurance",
      insurance: "insurance",
      roadworthiness_certificate: "other",
      national_id: "national_id"
    };
    const normalizedType = typeMap[documentType] || "other";

    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
      maxSizeMB: 5
    });

    const base64 = await this.fileToBase64(file);
    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "create_verification_document",
        vehicle_id: vehicleId || null,
        jwt,
        data: {
          document_type: normalizedType,
          vehicle_id: vehicleId || null,
          file_base64: base64,
          original_filename: file.name,
          mime_type: file.type || "application/pdf",
          file_size: file.size
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to record verification document on trusted server.");
    }

    const docRecord = await res.json();

    return {
      document_type: normalizedType,
      file_id: docRecord.drive_file_id || docRecord.file_id,
      id: docRecord.id || docRecord.$id,
      uploaded_at: docRecord.uploaded_at || docRecord.created_at,
      verification_status: docRecord.verification_status,
      view_url: docRecord.view_url || `/api/files/preview/${docRecord.drive_file_id || docRecord.file_id}`
    };
  },

  /**
   * Fetches all verification documents belonging to the current authenticated user.
   */
  async getDriverDocuments() {
    const user = await AuthService.getCurrentUser();
    if (!user) return [];

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        body: JSON.stringify({
          action: "list_driver_documents",
          jwt
        })
      });

      if (!res.ok) return [];
      const data = await res.json();
      return (data.documents || []).map((doc) => ({
        ...doc,
        id: doc.id || doc.$id,
        view_url: doc.view_url || `/api/files/preview/${doc.drive_file_id || doc.file_id}`
      }));
    } catch (err) {
      console.warn("Error fetching driver documents:", err.message);
      return [];
    }
  },

  /**
   * Evaluates driver profile completeness.
   */
  async getDriverProfileCompleteness(driverId = null) {
    const user = await AuthService.getCurrentUser();
    if (!user) {
      return { isComplete: false, missingRequirements: ["Authentication required"], details: {} };
    }

    const profile = await AuthService.getCurrentProfile();
    const vehicles = await this.getDriverVehicles();
    const docs = await this.getDriverDocuments();

    const missingRequirements = [];
    if (!profile?.profile_photo_url && !profile?.profile_image_id) {
      missingRequirements.push("Profile Photo");
    }
    if (!profile?.phone && !profile?.phone_number) {
      missingRequirements.push("Contact Phone Number");
    }
    if (vehicles.length === 0) {
      missingRequirements.push("At least one registered active Vehicle");
    }
    if (!docs.some((d) => d.document_type === "driver_licence" || d.document_type === "driver_license" || d.document_type === "national_id")) {
      missingRequirements.push("Verification Documentation (Driver Licence or National ID)");
    }

    const isComplete = missingRequirements.length === 0;

    return {
      isComplete,
      missingRequirements,
      details: {
        hasProfile: Boolean(profile),
        hasPhoto: Boolean(profile?.profile_photo_url || profile?.profile_image_id),
        hasPhone: Boolean(profile?.phone || profile?.phone_number),
        hasVehicle: vehicles.length > 0,
        hasDocuments: docs.length > 0,
        vehicleCount: vehicles.length,
        documentCount: docs.length
      }
    };
  }
};
