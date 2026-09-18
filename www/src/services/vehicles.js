// ==============================================================================
// TRANSMOVE VEHICLE & DOCUMENT MANAGEMENT SERVICE
// Powered by Appwrite Web SDK (Databases: vehicles, vehicle_photos, verification_documents)
// & Appwrite Shared Storage Bucket (transmove-files)
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
import { AuthService } from "./auth.js";

export const VehicleService = {
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
   * Uploads profile picture into Appwrite Storage (transmove-files)
   * and updates profile_image_id in transmove.profiles.
   * Gives public read permissions for marketplace visibility, user-restricted update/delete.
   */
  async uploadProfilePicture(file) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required to upload profile photo.");

    // Validate 5MB image limit (no PDF)
    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    const storage = getAppwriteStorage();
    const databases = getAppwriteDatabases();

    // 1. Fetch current profile to identify any prior photo for clean replacement
    const profRes = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", user.$id),
      Query.limit(1)
    ]);
    const currentProfile = profRes.documents[0] || null;
    const oldFileId = currentProfile?.profile_image_id;

    // 2. Upload new image with public read, owner update/delete
    const fileId = ID.unique();
    const uploadedFile = await storage.createFile(
      APPWRITE_CONFIG.bucketId,
      fileId,
      file,
      [
        Permission.read(Role.any()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );

    // 3. Update profile row with new profile_image_id via trusted updateProfile
    if (currentProfile) {
      await AuthService.updateProfile({
        profile_image_id: uploadedFile.$id
      });
    }

    // 4. Safely delete old profile photo to avoid orphaned files
    if (oldFileId && oldFileId !== uploadedFile.$id) {
      try {
        await storage.deleteFile(APPWRITE_CONFIG.bucketId, oldFileId);
      } catch (delErr) {
        console.warn("Notice: Old profile image cleanup:", delErr.message);
      }
    }

    // 5. Generate view URL
    const photoUrl = storage.getFileView(APPWRITE_CONFIG.bucketId, uploadedFile.$id);

    // 6. Notify active auth listeners
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
    return {
      ...doc,
      id: doc.$id,
      color: doc.colour || doc.color || "White",
      load_capacity_kg: doc.load_capacity || 0,
      photos: photoUrls,
      photo_documents: photoDocs
    };
  },

  /**
   * Registers a new vehicle with Appwrite Databases (vehicles).
   * driver_id is bound strictly to the authenticated user ID.
   * Table row permissions: read/update/delete for authenticated driver only.
   */
  async addVehicle(vehicleData) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required to register a vehicle.");

    // Validate required fields
    if (!vehicleData.make || !vehicleData.make.trim()) throw new Error("Vehicle make is required.");
    if (!vehicleData.model || !vehicleData.model.trim()) throw new Error("Vehicle model is required.");
    if (!vehicleData.registration_number || !vehicleData.registration_number.trim()) {
      throw new Error("Vehicle registration number (plate) is required.");
    }

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
        action: "create_vehicle",
        data: {
          vehicle_type: vehicleData.vehicle_type || "sedan",
          make: vehicleData.make,
          model: vehicleData.model,
          year: vehicleData.year ? parseInt(vehicleData.year, 10) : new Date().getFullYear(),
          colour: vehicleData.colour || vehicleData.color || "White",
          registration_number: vehicleData.registration_number,
          passenger_capacity: vehicleData.passenger_capacity,
          load_capacity: vehicleData.load_capacity || vehicleData.load_capacity_kg,
          service_category: vehicleData.service_category,
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
   * Hydrates each vehicle with photo URLs from Appwrite Storage.
   */
  async getDriverVehicles() {
    const account = getAppwriteAccount();
    let user;
    try {
      user = await account.get();
    } catch (_) {
      return [];
    }
    if (!user) return [];

    const databases = getAppwriteDatabases();
    const storage = getAppwriteStorage();

    try {
      const res = await databases.listDocuments("transmove", "vehicles", [
        Query.equal("driver_id", user.$id),
        Query.orderDesc("created_at")
      ]);

      const formattedVehicles = await Promise.all(
        res.documents.map(async (veh) => {
          let photoUrls = [];
          let photoDocs = [];
          try {
            const photoRes = await databases.listDocuments("transmove", "vehicle_photos", [
              Query.equal("vehicle_id", veh.$id)
            ]);
            photoDocs = photoRes.documents || [];
            photoUrls = photoDocs.map(p => storage.getFileView(APPWRITE_CONFIG.bucketId, p.file_id));
          } catch (pErr) {
            // Photos table hydration fallback
          }
          return this._formatVehicle(veh, photoUrls, photoDocs);
        })
      );

      return formattedVehicles;
    } catch (err) {
      console.warn("Error fetching driver vehicles:", err.message);
      return [];
    }
  },

  /**
   * Fetches a single vehicle by document ID.
   */
  async getVehicle(vehicleId) {
    const databases = getAppwriteDatabases();
    const storage = getAppwriteStorage();

    const doc = await databases.getDocument("transmove", "vehicles", vehicleId);
    let photoUrls = [];
    let photoDocs = [];
    try {
      const photoRes = await databases.listDocuments("transmove", "vehicle_photos", [
        Query.equal("vehicle_id", doc.$id)
      ]);
      photoDocs = photoRes.documents || [];
      photoUrls = photoDocs.map(p => storage.getFileView(APPWRITE_CONFIG.bucketId, p.file_id));
    } catch (_) {}

    return this._formatVehicle(doc, photoUrls, photoDocs);
  },

  /**
   * Updates an existing vehicle with verified driver ownership.
   */
  async updateVehicle(vehicleId, updates) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    // Handle primary vehicle switch atomically if requested
    if (updates.is_primary === true) {
      await this.setPrimaryVehicle(vehicleId);
      const clone = { ...updates };
      delete clone.is_primary;
      if (Object.keys(clone).length === 0) {
        return await this.getVehicle(vehicleId);
      }
      updates = clone;
    }

    // Authenticate cryptographically via Appwrite JWT
    const jwtRes = await account.createJWT();
    const jwt = jwtRes.jwt;

    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({
        action: "update_vehicle",
        vehicle_id: vehicleId,
        data: updates
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to update vehicle via trusted server.");
    }

    return await this.getVehicle(vehicleId);
  },

  /**
   * Sets a specific vehicle as the primary vehicle atomically via real Appwrite Database Transaction.
   */
  async setPrimaryVehicle(vehicleId) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const jwtRes = await account.createJWT();
    const jwt = jwtRes.jwt;

    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify({
        action: "set_primary_vehicle",
        vehicle_id: vehicleId
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to set primary vehicle atomically.");
    }

    return await this.getVehicle(vehicleId);
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
   * Deletes a vehicle and cleans up associated vehicle photos.
   */
  async deleteVehicle(vehicleId) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const databases = getAppwriteDatabases();
    const storage = getAppwriteStorage();

    // Verify ownership
    const existing = await databases.getDocument("transmove", "vehicles", vehicleId);
    if (existing.driver_id !== user.$id) {
      throw new Error("Unauthorized: You do not own this vehicle.");
    }

    // Clean up photos
    try {
      const photos = await databases.listDocuments("transmove", "vehicle_photos", [
        Query.equal("vehicle_id", vehicleId)
      ]);
      for (const p of photos.documents) {
        try {
          await storage.deleteFile(APPWRITE_CONFIG.bucketId, p.file_id);
          await databases.deleteDocument("transmove", "vehicle_photos", p.$id);
        } catch (_) {}
      }
    } catch (_) {}

    // Delete vehicle document
    await databases.deleteDocument("transmove", "vehicles", vehicleId);
    return true;
  },

  /**
   * Uploads a vehicle photo to transmove-files and registers a row in vehicle_photos.
   * Max 5 photos per vehicle. Image formats only (no PDF).
   */
  async uploadVehiclePhoto(vehicleId, file, isPrimary = false) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

    const databases = getAppwriteDatabases();
    const storage = getAppwriteStorage();

    // 1. Verify ownership
    const vehicle = await databases.getDocument("transmove", "vehicles", vehicleId);
    if (vehicle.driver_id !== user.$id) {
      throw new Error("Unauthorized: You do not own this vehicle.");
    }

    // 2. Enforce maximum 5 photos
    const existingPhotos = await databases.listDocuments("transmove", "vehicle_photos", [
      Query.equal("vehicle_id", vehicleId)
    ]);
    if (existingPhotos.total >= 5) {
      throw new Error("Maximum limit of 5 photos per vehicle reached.");
    }

    // 3. Validate image format (no PDF)
    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      maxSizeMB: 5
    });

    // 4. Upload photo to transmove-files with public read, owner update/delete
    const fileId = ID.unique();
    const uploadedFile = await storage.createFile(
      APPWRITE_CONFIG.bucketId,
      fileId,
      file,
      [
        Permission.read(Role.any()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );

    // 5. Call trusted API to create vehicle_photos row
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
        action: "create_vehicle_photo",
        vehicle_id: vehicleId,
        data: {
          file_id: uploadedFile.$id,
          is_primary: isPrimary
        }
      })
    });

    if (!res.ok) {
      // Clean up uploaded file if database record fails
      await storage.deleteFile(APPWRITE_CONFIG.bucketId, uploadedFile.$id).catch(() => {});
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to record vehicle photo on trusted server.");
    }

    const photoDoc = await res.json();
    const viewUrl = storage.getFileView(APPWRITE_CONFIG.bucketId, uploadedFile.$id);

    return {
      photoId: photoDoc.$id,
      fileId: uploadedFile.$id,
      viewUrl,
      isPrimary: photoDoc.is_primary
    };
  },

  /**
   * Sets a specific photo index as cover photo for a vehicle.
   */
  async setVehicleCoverPhoto(vehicleId, photoIndexOrDocId) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) return;

    const databases = getAppwriteDatabases();
    const photosRes = await databases.listDocuments("transmove", "vehicle_photos", [
      Query.equal("vehicle_id", vehicleId)
    ]);

    let targetDocId = null;
    if (typeof photoIndexOrDocId === "number") {
      targetDocId = photosRes.documents[photoIndexOrDocId]?.$id;
    } else {
      targetDocId = photoIndexOrDocId;
    }

    if (!targetDocId) return;

    for (const p of photosRes.documents) {
      await databases.updateDocument("transmove", "vehicle_photos", p.$id, {
        is_primary: p.$id === targetDocId
      });
    }

    return true;
  },

  /**
   * Deletes a vehicle photo via trusted API.
   */
  async deleteVehiclePhoto(photoId) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required.");

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
        action: "delete_vehicle_photo",
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
   * Uploads a confidential verification document to PRIVATE Appwrite Storage (transmove-files)
   * and creates a record in verification_documents.
   * File permissions are strictly restricted to Role.user(userId). NEVER Role.any() or Role.users().
   */
  async uploadVerificationDocument(file, documentType, vehicleId = null) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Authentication required for document upload.");

    // Normalize document type
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

    // Validate file (JPG, JPEG, PNG, WEBP, PDF, max 5MB)
    this.validateFile(file, {
      allowedTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
      maxSizeMB: 5
    });

    const storage = getAppwriteStorage();
    const databases = getAppwriteDatabases();

    // 1. Upload file with STRICT user-only permissions (read & delete only, no update)
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

    // 2. Call trusted API to create verification_documents row
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
        action: "create_verification_document",
        vehicle_id: vehicleId || null,
        data: {
          document_type: normalizedType,
          file_id: uploadedFile.$id,
          vehicle_id: vehicleId || null
        }
      })
    });

    if (!res.ok) {
      // Clean up uploaded file if database record fails
      await storage.deleteFile(APPWRITE_CONFIG.bucketId, uploadedFile.$id).catch(() => {});
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to record verification document on trusted server.");
    }

    const docRecord = await res.json();

    return {
      document_type: normalizedType,
      file_id: uploadedFile.$id,
      id: docRecord.$id,
      uploaded_at: docRecord.created_at,
      verification_status: docRecord.verification_status
    };
  },

  /**
   * Fetches all verification documents belonging to the current authenticated user.
   */
  async getDriverDocuments() {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) return [];

    const databases = getAppwriteDatabases();
    const storage = getAppwriteStorage();

    const res = await databases.listDocuments("transmove", "verification_documents", [
      Query.equal("user_id", user.$id),
      Query.orderDesc("created_at")
    ]);

    return res.documents.map(doc => ({
      ...doc,
      id: doc.$id,
      view_url: storage.getFileView(APPWRITE_CONFIG.bucketId, doc.file_id)
    }));
  },

  /**
   * Evaluates driver profile completeness.
   * Reports missing requirements: photo, phone, active vehicle, verification documents.
   */
  async getDriverProfileCompleteness(driverId = null) {
    const account = getAppwriteAccount();
    let user;
    try {
      user = await account.get();
    } catch (_) {
      return { isComplete: false, missingRequirements: ["Authentication required"], details: {} };
    }
    if (!user) {
      return { isComplete: false, missingRequirements: ["Authentication required"], details: {} };
    }

    const targetUserId = driverId || user.$id;
    const databases = getAppwriteDatabases();

    // 1. Check profile
    const profRes = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", targetUserId),
      Query.limit(1)
    ]);
    const profile = profRes.documents[0] || null;

    // 2. Check vehicles
    const vehRes = await databases.listDocuments("transmove", "vehicles", [
      Query.equal("driver_id", targetUserId),
      Query.equal("status", "active")
    ]);

    // 3. Check verification documents
    const docRes = await databases.listDocuments("transmove", "verification_documents", [
      Query.equal("user_id", targetUserId)
    ]);

    const hasProfile = Boolean(profile);
    const hasPhoto = Boolean(profile?.profile_image_id);
    const hasPhone = Boolean(profile?.phone && profile.phone.trim().length > 5);
    const hasVehicle = vehRes.total > 0;
    const hasDocuments = docRes.total > 0;

    const missingRequirements = [];
    if (!hasPhoto) missingRequirements.push("Profile Photo");
    if (!hasPhone) missingRequirements.push("Contact Phone Number");
    if (!hasVehicle) missingRequirements.push("At least one registered active Vehicle");
    if (!hasDocuments) missingRequirements.push("Verification Documentation (Driver License or National ID)");

    const isComplete = missingRequirements.length === 0;

    return {
      isComplete,
      missingRequirements,
      details: {
        hasProfile,
        hasPhoto,
        hasPhone,
        hasVehicle,
        hasDocuments,
        vehicleCount: vehRes.total,
        documentCount: docRes.total
      }
    };
  }
};
