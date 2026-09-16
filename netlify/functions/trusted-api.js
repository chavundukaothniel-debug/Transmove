// ==============================================================================
// TRANSMOVE TRUSTED BACKEND API (NETLIFY SERVERLESS FUNCTION / SERVER-SIDE)
// Enforces cryptographic server-side validation on privileged fields & creation.
// Appwrite API key is kept STRICTLY server-side.
// Performs atomic primary vehicle switching via Appwrite Database Transactions.
// ==============================================================================
import fs from "fs";
import path from "path";

// Load configuration securely on server
function getCredentials() {
  let endpoint = process.env.APPWRITE_ENDPOINT;
  let projectId = process.env.APPWRITE_PROJECT_ID;
  let apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    // Attempt reading from .env.appwrite.setup if in local environment
    const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join("=").trim();
          if (key === "APPWRITE_ENDPOINT" && !endpoint) endpoint = val;
          if (key === "APPWRITE_PROJECT_ID" && !projectId) projectId = val;
          if (key === "APPWRITE_API_KEY" && !apiKey) apiKey = val;
        }
      });
    }
  }

  return {
    endpoint: endpoint || "https://fra.cloud.appwrite.io/v1",
    projectId: projectId || "6aaa6531003d5747b640",
    apiKey
  };
}

/**
 * Builds standard Appwrite REST query parameter
 */
function buildEqualQuery(attribute, value) {
  return encodeURIComponent(
    JSON.stringify({
      method: "equal",
      attribute: attribute,
      values: Array.isArray(value) ? value : [value]
    })
  );
}

function buildOrderDescQuery(attribute) {
  return encodeURIComponent(
    JSON.stringify({
      method: "orderDesc",
      attribute: attribute,
      values: []
    })
  );
}

function buildOrderAscQuery(attribute) {
  return encodeURIComponent(
    JSON.stringify({
      method: "orderAsc",
      attribute: attribute,
      values: []
    })
  );
}

function buildLimitQuery(limit) {
  return encodeURIComponent(
    JSON.stringify({
      method: "limit",
      values: [limit]
    })
  );
}

// ==============================================================================
// CENTRALIZED SERVICE TYPE <-> VEHICLE SERVICE CATEGORY MAPPING
// Bridges service_requests.service_type and vehicles.service_category
// ==============================================================================
export const SERVICE_TYPE_TO_VEHICLE_CATEGORIES = {
  ride: ["passenger_transport", "bus_passenger", "general_transport"],
  passenger: ["passenger_transport", "bus_passenger", "general_transport"],
  passenger_transport: ["passenger_transport", "bus_passenger", "general_transport"],
  logistics: ["light_goods", "heavy_goods", "courier_express", "general_transport"],
  goods: ["light_goods", "heavy_goods", "courier_express", "general_transport"],
  light_goods: ["light_goods", "general_transport", "courier_express"],
  heavy_goods: ["heavy_goods", "general_transport"],
  hire: ["passenger_transport", "bus_passenger", "light_goods", "heavy_goods", "machinery_hire", "general_transport"],
  vehicle_hire: ["passenger_transport", "bus_passenger", "light_goods", "heavy_goods", "machinery_hire", "general_transport"],
  bus: ["bus_passenger", "passenger_transport", "general_transport"],
  bus_passenger: ["bus_passenger", "passenger_transport", "general_transport"],
  machinery: ["machinery_hire", "general_transport"],
  machinery_hire: ["machinery_hire", "general_transport"],
  courier: ["courier_express", "light_goods", "passenger_transport", "general_transport"],
  courier_express: ["courier_express", "light_goods", "passenger_transport", "general_transport"]
};

/**
 * Checks if a vehicle category is compatible with a request service type.
 */
export function isVehicleCompatibleWithRequest(vehicleCategory, requestServiceType) {
  if (!vehicleCategory || !requestServiceType) return false;
  const vCat = String(vehicleCategory).toLowerCase().trim();
  const reqType = String(requestServiceType).toLowerCase().trim();
  const allowed = SERVICE_TYPE_TO_VEHICLE_CATEGORIES[reqType] || ["general_transport"];
  return allowed.includes(vCat) || vCat === "general_transport";
}

/**
 * Validates the user's JWT cryptographically against Appwrite Auth.
 * Returns the verified user object, or throws an error.
 */
async function authenticateUser(jwt, { endpoint, projectId }) {
  if (!jwt) {
    throw new Error("Missing Authorization token.");
  }

  const res = await fetch(`${endpoint}/account`, {
    headers: {
      "X-Appwrite-Project": projectId,
      "X-Appwrite-JWT": jwt
    }
  });

  if (!res.ok) {
    throw new Error("Unauthorized: Invalid or expired authentication token.");
  }

  return await res.json();
}

/**
 * Creates a notification document with strict recipient-only read permissions.
 * Never trust client-supplied user_id.
 */
async function createNotification(creds, serverHeaders, { userId, type, title, message, relatedId }) {
  if (!userId || !type || !title || !message) return null;
  try {
    const payload = {
      user_id: String(userId),
      type: String(type),
      title: String(title),
      message: String(message),
      related_id: relatedId ? String(relatedId) : "",
      read: false,
      created_at: new Date().toISOString()
    };
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/notifications/documents`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({
        documentId: "unique()",
        data: payload,
        permissions: [
          `read("user:${userId}")`
        ]
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("createNotification error:", err.message);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.warn("createNotification exception:", e.message);
    return null;
  }
}

/**
 * Handles trusted backend operations.
 */
export async function executeTrustedOperation({ action, data = {}, vehicle_id, request_id, jwt }) {
  const creds = getCredentials();
  if (!creds.apiKey) {
    throw new Error("Server configuration error: Missing Appwrite API key.");
  }

  const serverHeaders = {
    "X-Appwrite-Project": creds.projectId,
    "X-Appwrite-Key": creds.apiKey,
    "Content-Type": "application/json"
  };

  // 1. Authenticate user from JWT (never trust client-supplied user_id)
  const verifiedUser = await authenticateUser(jwt, creds);
  const userId = verifiedUser.$id;

  let callerProfileCache;
  async function getCallerProfile() {
    if (callerProfileCache !== undefined) return callerProfileCache;
    const query = buildEqualQuery("user_id", userId);
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${query}`,
      { headers: serverHeaders }
    );
    if (!response.ok) throw new Error("Unable to verify caller profile.");
    const result = await response.json();
    callerProfileCache = result.documents?.[0] || null;
    return callerProfileCache;
  }

  async function requireAdmin() {
    const profile = await getCallerProfile();
    if (!profile || profile.role !== "admin" || profile.account_status !== "active") {
      throw new Error("Forbidden: Active administrator privileges required.");
    }
    return profile;
  }

  async function requireProvider() {
    const profile = await getCallerProfile();
    const providerRoles = [
      "driver", "owner", "cargo_owner", "logistics", "logistics_provider",
      "vehicle_owner", "machinery_owner", "business", "business_admin", "advertiser"
    ];
    if (!profile || !providerRoles.includes(profile.role) || profile.account_status !== "active") {
      throw new Error("Forbidden: Active provider account required.");
    }
    return profile;
  }

  // -------------------------------------------------------------
  // ACTION: create_profile (TRUSTED SERVER-SIDE CREATION)
  // -------------------------------------------------------------
  if (action === "create_profile") {
    // 1. User ID and Email derived strictly from authenticated user session
    const derivedUserId = verifiedUser.$id;
    const derivedEmail = verifiedUser.email || "";

    // 2. Reject privileged fields if supplied by browser
    const privilegedFields = [
      "user_id",
      "email",
      "account_status",
      "verification_status",
      "created_at",
      "updated_at"
    ];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot supply '${field}' during profile creation.`);
      }
    }

    // 3. Reject admin role and validate against supported public roles
    if (data.role === "admin") {
      throw new Error("Privilege escalation blocked: Cannot create profile with admin role.");
    }

    const validRoles = [
      "customer",
      "passenger",
      "driver",
      "owner",
      "cargo_owner",
      "logistics",
      "vehicle_owner",
      "machinery_owner",
      "machinery_hirer",
      "business",
      "advertiser"
    ];

    let assignedRole = "customer";
    if (data.role) {
      if (!validRoles.includes(data.role)) {
        throw new Error(`Invalid role '${data.role}'. Permitted roles: ${validRoles.join(", ")}`);
      }
      assignedRole = data.role;
    }

    // 4. Check if profile already exists for this user_id to prevent duplicates
    const queryParam = buildEqualQuery("user_id", derivedUserId);
    const existingRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${queryParam}`,
      { headers: serverHeaders }
    );
    const existingData = await existingRes.json();
    if (existingData.documents && existingData.documents.length > 0) {
      return existingData.documents[0]; // Return existing profile without creating duplicate
    }

    // 5. Construct secure profile payload
    const safePayload = {
      user_id: derivedUserId,
      email: derivedEmail,
      full_name: data.full_name ? String(data.full_name).trim() : (data.fullName ? String(data.fullName).trim() : (verifiedUser.name || "TransMove User")),
      phone: data.phone ? String(data.phone).trim() : (data.phoneNumber ? String(data.phoneNumber).trim() : (data.phone_number ? String(data.phone_number).trim() : "")),
      city: data.city ? String(data.city).trim() : (data.service_area ? String(data.service_area).trim() : ""),
      bio: data.bio ? String(data.bio).trim() : "",
      role: assignedRole,
      profile_image_id: data.profile_image_id ? String(data.profile_image_id).trim() : "",
      account_status: "active", // Always active on creation
      verification_status: "unverified", // Always unverified on creation
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 6. Create document with server credentials.
    // Permissions: READ ONLY for the owning user. (NO direct update, NO direct delete).
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: safePayload,
          permissions: [
            `read("user:${derivedUserId}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create profile record.");
    }

    return await createRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: update_profile
  // -------------------------------------------------------------
  if (action === "update_profile") {
    // 1. Check for privileged fields - REJECT privilege escalation attempts
    const privilegedFields = ["role", "account_status", "verification_status", "user_id", "email", "created_at"];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Modifying field '${field}' is strictly forbidden.`);
      }
    }

    // 2. Whitelist allowed fields only
    const safeData = {};
    if (data.full_name !== undefined) safeData.full_name = String(data.full_name).trim();
    if (data.phone !== undefined) safeData.phone = String(data.phone).trim();
    if (data.phone_number !== undefined) safeData.phone = String(data.phone_number).trim();
    if (data.city !== undefined) safeData.city = String(data.city).trim();
    if (data.service_area !== undefined) safeData.city = String(data.service_area).trim();
    if (data.bio !== undefined) safeData.bio = String(data.bio).trim();
    if (data.profile_image_id !== undefined) safeData.profile_image_id = String(data.profile_image_id).trim();
    safeData.updated_at = new Date().toISOString();

    // 3. Find profile document for authenticated user_id
    const queryParam = buildEqualQuery("user_id", userId);
    const listRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${queryParam}`,
      { headers: serverHeaders }
    );
    const listData = await listRes.json();
    if (!listData.documents || listData.documents.length === 0) {
      throw new Error("Profile document not found.");
    }
    const profileDoc = listData.documents[0];

    // 4. Update profile document via trusted server credentials
    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${profileDoc.$id}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: safeData })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update profile.");
    }

    return await updateRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: create_vehicle (TRUSTED SERVER-SIDE CREATION)
  // -------------------------------------------------------------
  if (action === "create_vehicle") {
    const driver_id = verifiedUser.$id;

    // 1. Reject privileged fields if supplied by browser
    const privilegedFields = ["driver_id", "verification_status", "created_at", "updated_at"];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot supply vehicle '${field}' during creation.`);
      }
    }

    // 2. Validate required fields
    if (!data.make || !String(data.make).trim()) throw new Error("Vehicle make is required.");
    if (!data.model || !String(data.model).trim()) throw new Error("Vehicle model is required.");
    if (!data.registration_number || !String(data.registration_number).trim()) {
      throw new Error("Vehicle registration number (plate) is required.");
    }

    // Helper: Map service categories
    function getServiceCategory(vehicleType) {
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
    }

    const vehicleType = data.vehicle_type ? String(data.vehicle_type).trim() : "sedan";
    const category = data.service_category ? String(data.service_category).trim() : getServiceCategory(vehicleType);

    // 3. Query existing vehicles to handle primary vehicle logic atomically
    const queryParam = buildEqualQuery("driver_id", driver_id);
    const existingVehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${queryParam}`,
      { headers: serverHeaders }
    );
    const existingVehData = await existingVehRes.json();
    const existingVehicles = existingVehData.documents || [];
    const isFirstVehicle = existingVehicles.length === 0;
    const requestedPrimary = data.is_primary === true;
    const shouldBePrimary = isFirstVehicle || requestedPrimary;

    const vehiclePayload = {
      driver_id: driver_id,
      vehicle_type: vehicleType,
      make: String(data.make).trim(),
      model: String(data.model).trim(),
      year: data.year ? parseInt(data.year, 10) : new Date().getFullYear(),
      colour: String(data.colour || data.color || "White").trim(),
      registration_number: String(data.registration_number).toUpperCase().trim(),
      passenger_capacity: data.passenger_capacity ? parseInt(data.passenger_capacity, 10) : 4,
      load_capacity: data.load_capacity ? parseFloat(data.load_capacity) : (data.load_capacity_kg ? parseFloat(data.load_capacity_kg) : 0),
      service_category: category,
      description: data.description ? String(data.description).trim() : "",
      status: "active",
      verification_status: "unverified", // Server forces unverified status
      is_primary: shouldBePrimary,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 4. Create vehicle document (read and delete permissions for driver)
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: vehiclePayload,
          permissions: [
            `read("user:${driver_id}")`,
            `delete("user:${driver_id}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create vehicle record.");
    }

    const newVehicle = await createRes.json();

    // 5. If this new vehicle is primary and prior vehicles exist, atomically unset prior primaries
    if (shouldBePrimary && existingVehicles.length > 0) {
      const otherPrimaries = existingVehicles.filter(v => v.$id !== newVehicle.$id && v.is_primary);
      if (otherPrimaries.length > 0) {
        try {
          const txRes = await fetch(`${creds.endpoint}/databases/transactions`, {
            method: "POST",
            headers: serverHeaders,
            body: JSON.stringify({})
          });
          if (txRes.ok) {
            const tx = await txRes.json();
            const operations = otherPrimaries.map(oldVeh => ({
              action: "update",
              databaseId: "transmove",
              collectionId: "vehicles",
              documentId: oldVeh.$id,
              data: { is_primary: false, updated_at: new Date().toISOString() }
            }));
            await fetch(`${creds.endpoint}/databases/transactions/${tx.$id}/operations`, {
              method: "POST",
              headers: serverHeaders,
              body: JSON.stringify({ operations })
            });
            await fetch(`${creds.endpoint}/databases/transactions/${tx.$id}`, {
              method: "PATCH",
              headers: serverHeaders,
              body: JSON.stringify({ commit: true })
            });
          }
        } catch (txErr) {
          console.warn("Notice: Primary vehicle transaction on create:", txErr.message);
        }
      }
    }

    return newVehicle;
  }

  // -------------------------------------------------------------
  // ACTION: update_vehicle
  // -------------------------------------------------------------
  if (action === "update_vehicle") {
    if (!vehicle_id) throw new Error("Missing vehicle_id parameter.");

    // 1. Check for privileged vehicle fields - REJECT privilege escalation attempts
    const privilegedVehicleFields = ["driver_id", "verification_status", "created_at"];
    for (const field of privilegedVehicleFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Modifying vehicle field '${field}' is strictly forbidden.`);
      }
    }

    // 2. Fetch vehicle to verify ownership
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${vehicle_id}`,
      { headers: serverHeaders }
    );
    if (!vehRes.ok) {
      throw new Error("Vehicle not found.");
    }
    const vehicle = await vehRes.json();
    if (vehicle.driver_id !== userId) {
      throw new Error("Forbidden: You do not own this vehicle.");
    }

    // 3. Whitelist allowed vehicle fields
    const safeData = {};
    if (data.vehicle_type !== undefined) safeData.vehicle_type = String(data.vehicle_type).trim();
    if (data.make !== undefined) safeData.make = String(data.make).trim();
    if (data.model !== undefined) safeData.model = String(data.model).trim();
    if (data.year !== undefined) safeData.year = parseInt(data.year, 10);
    if (data.colour !== undefined || data.color !== undefined) {
      safeData.colour = String(data.colour || data.color).trim();
    }
    if (data.registration_number !== undefined) {
      safeData.registration_number = String(data.registration_number).toUpperCase().trim();
    }
    if (data.passenger_capacity !== undefined) {
      safeData.passenger_capacity = parseInt(data.passenger_capacity, 10);
    }
    if (data.load_capacity !== undefined || data.load_capacity_kg !== undefined) {
      safeData.load_capacity = parseFloat(data.load_capacity || data.load_capacity_kg);
    }
    if (data.service_category !== undefined) safeData.service_category = String(data.service_category).trim();
    if (data.description !== undefined) safeData.description = String(data.description).trim();
    if (data.status !== undefined) safeData.status = String(data.status).trim();
    safeData.updated_at = new Date().toISOString();

    // 4. Update vehicle using trusted server credentials
    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${vehicle_id}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: safeData })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update vehicle.");
    }

    return await updateRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: set_primary_vehicle (TRUE ATOMIC TRANSACTION)
  // -------------------------------------------------------------
  if (action === "set_primary_vehicle") {
    if (!vehicle_id) throw new Error("Missing vehicle_id parameter.");

    // 1. Fetch target vehicle to verify ownership
    const targetRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${vehicle_id}`,
      { headers: serverHeaders }
    );
    if (!targetRes.ok) {
      throw new Error("Vehicle not found.");
    }
    const targetVeh = await targetRes.json();
    if (targetVeh.driver_id !== userId) {
      throw new Error("Forbidden: You do not own this vehicle.");
    }

    // 2. Query all vehicles owned by this driver
    const queryParam = buildEqualQuery("driver_id", userId);
    const allVehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${queryParam}`,
      { headers: serverHeaders }
    );
    const allVehData = await allVehRes.json();
    const otherPrimaries = (allVehData.documents || []).filter(
      (v) => v.$id !== vehicle_id && v.is_primary
    );

    // 3. Initiate real Appwrite Database Transaction
    const txRes = await fetch(`${creds.endpoint}/databases/transactions`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({})
    });
    if (!txRes.ok) {
      const err = await txRes.json();
      throw new Error(err.message || "Failed to create database transaction.");
    }
    const tx = await txRes.json();

    // 4. Stage atomic operations: unset other primaries, set target primary
    const operations = [];
    for (const oldVeh of otherPrimaries) {
      operations.push({
        action: "update",
        databaseId: "transmove",
        collectionId: "vehicles",
        documentId: oldVeh.$id,
        data: {
          is_primary: false,
          updated_at: new Date().toISOString()
        }
      });
    }

    operations.push({
      action: "update",
      databaseId: "transmove",
      collectionId: "vehicles",
      documentId: vehicle_id,
      data: {
        is_primary: true,
        updated_at: new Date().toISOString()
      }
    });

    const stageRes = await fetch(
      `${creds.endpoint}/databases/transactions/${tx.$id}/operations`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({ operations })
      }
    );

    if (!stageRes.ok) {
      // Rollback transaction on staging failure
      await fetch(`${creds.endpoint}/databases/transactions/${tx.$id}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ rollback: true })
      }).catch(() => {});
      const err = await stageRes.json();
      throw new Error(err.message || "Failed to stage atomic operations.");
    }

    // 5. Commit Transaction atomically
    const commitRes = await fetch(
      `${creds.endpoint}/databases/transactions/${tx.$id}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ commit: true })
      }
    );

    const commitData = await commitRes.json();
    if (!commitRes.ok || commitData.status !== "committed") {
      throw new Error("Failed to commit primary vehicle transaction.");
    }

    return {
      success: true,
      vehicle_id,
      is_primary: true,
      transaction_id: tx.$id,
      status: "committed"
    };
  }

  // -------------------------------------------------------------
  // ACTION: create_verification_document (TRUSTED CREATION)
  // -------------------------------------------------------------
  if (action === "create_verification_document") {
    const derivedUserId = verifiedUser.$id;

    // 1. Reject privileged fields if supplied by browser
    const privilegedFields = [
      "user_id",
      "verification_status",
      "verified_at",
      "rejection_reason",
      "created_at",
      "updated_at"
    ];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot supply '${field}' during document registration.`);
      }
    }

    if (!data.file_id) throw new Error("Missing required parameter: file_id");

    const validTypes = [
      "driver_licence",
      "driver_license",
      "vehicle_registration",
      "insurance",
      "insurance_policy",
      "national_id",
      "roadworthiness_certificate",
      "other"
    ];
    const docType = String(data.document_type || "other").toLowerCase();
    if (!validTypes.includes(docType)) {
      throw new Error(`Invalid document_type '${data.document_type}'. Supported types: ${validTypes.join(", ")}`);
    }

    const normalizedMap = {
      driver_license: "driver_licence",
      driver_licence: "driver_licence",
      vehicle_registration: "vehicle_registration",
      insurance_policy: "insurance",
      insurance: "insurance",
      roadworthiness_certificate: "other",
      national_id: "national_id"
    };
    const normalizedType = normalizedMap[docType] || "other";

    // 2. If vehicle_id provided, verify authenticated user owns this vehicle
    const vehicleId = data.vehicle_id || vehicle_id || null;
    if (vehicleId) {
      const vehRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${vehicleId}`,
        { headers: serverHeaders }
      );
      if (!vehRes.ok) {
        throw new Error("Vehicle not found.");
      }
      const vehicle = await vehRes.json();
      if (vehicle.driver_id !== derivedUserId) {
        throw new Error("Forbidden: You do not own this vehicle.");
      }
    }

    const docPayload = {
      user_id: derivedUserId,
      vehicle_id: vehicleId,
      document_type: normalizedType,
      file_id: String(data.file_id).trim(),
      verification_status: "pending",
      rejection_reason: null,
      verified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: docPayload,
          permissions: [
            `read("user:${derivedUserId}")`,
            `delete("user:${derivedUserId}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create verification document record.");
    }

    return await createRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: create_vehicle_photo (TRUSTED PHOTO RECORD CREATION)
  // -------------------------------------------------------------
  if (action === "create_vehicle_photo") {
    const driver_id = verifiedUser.$id;

    // Reject driver_id tampering if supplied
    if (data.driver_id !== undefined && data.driver_id !== driver_id) {
      throw new Error("Forbidden: Cannot specify a different driver_id.");
    }

    const targetVehId = data.vehicle_id || vehicle_id;
    if (!targetVehId) throw new Error("Missing required parameter: vehicle_id");
    if (!data.file_id) throw new Error("Missing required parameter: file_id");

    // Verify vehicle ownership
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${targetVehId}`,
      { headers: serverHeaders }
    );
    if (!vehRes.ok) {
      throw new Error("Vehicle not found.");
    }
    const vehicle = await vehRes.json();
    if (vehicle.driver_id !== driver_id) {
      throw new Error("Forbidden: You do not own this vehicle.");
    }

    // Check maximum 5 photos limit
    const queryParam = buildEqualQuery("vehicle_id", targetVehId);
    const existingPhotosRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents?queries[]=${queryParam}`,
      { headers: serverHeaders }
    );
    const existingPhotosData = await existingPhotosRes.json();
    const existingPhotos = existingPhotosData.documents || [];
    if (existingPhotos.length >= 5) {
      throw new Error("Maximum limit of 5 photos per vehicle reached.");
    }

    const isPrimary = data.is_primary === true || existingPhotos.length === 0;

    // If primary, unset previous primaries
    if (isPrimary && existingPhotos.length > 0) {
      for (const p of existingPhotos) {
        if (p.is_primary) {
          await fetch(
            `${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents/${p.$id}`,
            {
              method: "PATCH",
              headers: serverHeaders,
              body: JSON.stringify({ data: { is_primary: false } })
            }
          ).catch(() => {});
        }
      }
    }

    const photoPayload = {
      vehicle_id: targetVehId,
      driver_id: driver_id,
      file_id: String(data.file_id).trim(),
      is_primary: isPrimary,
      created_at: new Date().toISOString()
    };

    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: photoPayload,
          permissions: [
            `read("any")`,
            `update("user:${driver_id}")`,
            `delete("user:${driver_id}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create vehicle photo record.");
    }

    return await createRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: admin_verify_document (TRUSTED BACKEND/ADMIN OPERATION)
  // -------------------------------------------------------------
  if (action === "admin_verify_document") {
    const documentId = data.document_id || data.$id || vehicle_id;
    if (!documentId) throw new Error("Missing document_id parameter.");

    await requireAdmin();

    const newStatus = data.verification_status || "verified";
    const updatePayload = {
      verification_status: newStatus,
      verified_at: newStatus === "verified" ? new Date().toISOString() : null,
      rejection_reason: data.rejection_reason || null,
      updated_at: new Date().toISOString()
    };

    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents/${documentId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updatePayload })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update verification document.");
    }

    return await updateRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: admin_verify_vehicle (TRUSTED BACKEND/ADMIN OPERATION)
  // -------------------------------------------------------------
  if (action === "admin_verify_vehicle") {
    const targetVehId = vehicle_id || data.vehicle_id;
    if (!targetVehId) throw new Error("Missing vehicle_id parameter.");

    await requireAdmin();

    const newStatus = data.verification_status || "verified";
    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${targetVehId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            verification_status: newStatus,
            updated_at: new Date().toISOString()
          }
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update vehicle verification status.");
    }

    return await updateRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: create_service_request (TRUSTED REQUEST CREATION)
  // -------------------------------------------------------------
  if (action === "create_service_request") {
    const passengerId = verifiedUser.$id;

    // 1. Reject privileged fields
    const privilegedFields = ["passenger_id", "created_at", "updated_at", "status"];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot supply privileged field '${field}' during request creation.`);
      }
    }

    // 2. Validate caller account status from profile
    const profQuery = buildEqualQuery("user_id", passengerId);
    const profRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${profQuery}`,
      { headers: serverHeaders }
    );
    if (profRes.ok) {
      const profData = await profRes.json();
      const callerProf = profData.documents?.[0];
      if (callerProf && (callerProf.account_status === "suspended" || callerProf.account_status === "deactivated")) {
        throw new Error("Unauthorized: Account is suspended or inactive.");
      }
    }

    // 3. Validate service_type against supported TransMove types
    const rawServiceType = String(data.service_type || data.request_type || "ride").toLowerCase().trim();
    const validServiceTypes = [
      "ride", "passenger", "logistics", "goods", "hire", "vehicle_hire",
      "heavy_goods", "bus_passenger", "machinery_hire", "courier_express"
    ];
    if (!validServiceTypes.includes(rawServiceType)) {
      throw new Error(`Invalid service_type '${rawServiceType}'. Permitted types: ride, logistics, hire, etc.`);
    }

    const canonicalTypeMap = {
      passenger: "ride",
      goods: "logistics",
      vehicle_hire: "hire"
    };
    const serviceType = canonicalTypeMap[rawServiceType] || rawServiceType;

    // 4. Validate required route fields
    const pickup = String(data.pickup_location || data.pickup_address || "").trim();
    const destination = String(data.destination || data.destination_address || "").trim();
    if (!pickup) throw new Error("Pickup location is required.");
    if (!destination) throw new Error("Destination is required.");

    // 5. Whitelist and sanitize request fields
    const details = String(data.details || data.load_description || data.notes || "").trim();
    const goodsType = String(data.goods_type || data.cargo_type || "").trim();
    const passengerCount = data.passenger_count ? parseInt(data.passenger_count, 10) : null;
    const budget = data.budget !== undefined ? parseFloat(data.budget) : (data.suggested_price !== undefined ? parseFloat(data.suggested_price) : null);
    const requestDate = data.request_date || null;
    const preferredTime = data.preferred_time ? String(data.preferred_time).trim() : "";

    // 6. Idempotent submission protection
    const rawSubmissionId = data.submission_id || data.idempotency_key;
    let targetDocId = "unique()";
    if (rawSubmissionId) {
      const safeDocId = String(rawSubmissionId).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 36);
      if (safeDocId) {
        const checkRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${safeDocId}`,
          { headers: serverHeaders }
        );
        if (checkRes.ok) {
          const existingDoc = await checkRes.json();
          if (existingDoc.passenger_id === passengerId) {
            return existingDoc; // Idempotent success: return existing request record
          } else {
            throw new Error("Conflict: Submission ID already used by another entity.");
          }
        }
        targetDocId = safeDocId;
      }
    }

    // 7. Assemble safe server payload
    const requestPayload = {
      passenger_id: passengerId,
      service_type: serviceType,
      pickup_location: pickup,
      destination: destination,
      request_date: requestDate,
      preferred_time: preferredTime,
      passenger_count: passengerCount,
      goods_type: goodsType,
      details: details,
      budget: budget,
      status: "open_for_bids",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 8. Create document with owner read permission (NO client direct update/delete)
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: targetDocId,
          data: requestPayload,
          permissions: [
            `read("user:${passengerId}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      if (createRes.status === 409 && targetDocId !== "unique()") {
        const getRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetDocId}`,
          { headers: serverHeaders }
        );
        if (getRes.ok) {
          const doc = await getRes.json();
          if (doc.passenger_id === passengerId) return doc;
        }
      }
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create service request.");
    }

    return await createRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: create_request_image (TRUSTED REQUEST IMAGE CREATION)
  // -------------------------------------------------------------
  if (action === "create_request_image") {
    const passengerId = verifiedUser.$id;

    // Reject privileged fields
    if (data.passenger_id !== undefined && data.passenger_id !== passengerId) {
      throw new Error("Forbidden: Cannot specify a different passenger_id.");
    }
    if (data.created_at !== undefined) {
      throw new Error("Privilege escalation blocked: Cannot supply created_at.");
    }

    const targetReqId = data.request_id || data.requestId || request_id;
    const fileId = data.file_id || data.fileId;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");
    if (!fileId) throw new Error("Missing required parameter: file_id");

    // Verify caller owns the service request
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) {
      throw new Error("Service request not found.");
    }
    const targetReq = await reqRes.json();
    if (targetReq.passenger_id !== passengerId) {
      throw new Error("Forbidden: You do not own this service request.");
    }

    const imgPayload = {
      request_id: targetReqId,
      passenger_id: passengerId,
      file_id: String(fileId).trim(),
      created_at: new Date().toISOString()
    };

    const imgRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/request_images/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: imgPayload,
          permissions: [
            `read("user:${passengerId}")`,
            `delete("user:${passengerId}")`
          ]
        })
      }
    );

    if (!imgRes.ok) {
      const err = await imgRes.json();
      throw new Error(err.message || "Failed to create request image record.");
    }

    return await imgRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: update_service_request (TRUSTED REQUEST UPDATE)
  // -------------------------------------------------------------
  if (action === "update_service_request") {
    const passengerId = verifiedUser.$id;
    const targetReqId = data.request_id || data.requestId || request_id || data.$id;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");

    // Reject privileged fields
    const privilegedFields = ["passenger_id", "created_at", "status"];
    for (const field of privilegedFields) {
      if (data[field] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot modify '${field}' on service request.`);
      }
    }

    // Verify ownership and editable state
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Service request not found.");
    const existingReq = await reqRes.json();
    if (existingReq.passenger_id !== passengerId) {
      throw new Error("Forbidden: You do not own this service request.");
    }
    if (["cancelled", "completed", "accepted"].includes(existingReq.status)) {
      throw new Error(`Cannot modify request in '${existingReq.status}' status.`);
    }

    const safeData = {};
    if (data.pickup_location !== undefined || data.pickup_address !== undefined) {
      safeData.pickup_location = String(data.pickup_location || data.pickup_address).trim();
    }
    if (data.destination !== undefined || data.destination_address !== undefined) {
      safeData.destination = String(data.destination || data.destination_address).trim();
    }
    if (data.service_type !== undefined || data.request_type !== undefined) {
      safeData.service_type = String(data.service_type || data.request_type).trim();
    }
    if (data.details !== undefined || data.load_description !== undefined || data.notes !== undefined) {
      safeData.details = String(data.details || data.load_description || data.notes).trim();
    }
    if (data.goods_type !== undefined || data.cargo_type !== undefined) {
      safeData.goods_type = String(data.goods_type || data.cargo_type).trim();
    }
    if (data.passenger_count !== undefined) safeData.passenger_count = parseInt(data.passenger_count, 10);
    if (data.budget !== undefined || data.suggested_price !== undefined) {
      safeData.budget = parseFloat(data.budget !== undefined ? data.budget : data.suggested_price);
    }
    if (data.request_date !== undefined) safeData.request_date = data.request_date;
    if (data.preferred_time !== undefined) safeData.preferred_time = String(data.preferred_time).trim();
    safeData.updated_at = new Date().toISOString();

    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: safeData })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update service request.");
    }

    return await updateRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: cancel_service_request (TRUSTED REQUEST CANCELLATION)
  // -------------------------------------------------------------
  if (action === "cancel_service_request") {
    const passengerId = verifiedUser.$id;
    const targetReqId = data.request_id || data.requestId || request_id || data.$id;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");

    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Service request not found.");
    const existingReq = await reqRes.json();
    if (existingReq.passenger_id !== passengerId) {
      throw new Error("Forbidden: You do not own this service request.");
    }

    const cancelRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            status: "cancelled",
            updated_at: new Date().toISOString()
          }
        })
      }
    );

    if (!cancelRes.ok) {
      const err = await cancelRes.json();
      throw new Error(err.message || "Failed to cancel service request.");
    }

    return await cancelRes.json();
  }

  // -------------------------------------------------------------
  // ACTION: list_available_requests (DRIVER MATCHING SERVICE)
  // -------------------------------------------------------------
  if (action === "list_available_requests") {
    const driverId = verifiedUser.$id;

    // 1. Fetch driver's vehicles
    const vehQuery = buildEqualQuery("driver_id", driverId);
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${vehQuery}`,
      { headers: serverHeaders }
    );
    const vehData = await vehRes.json();
    const driverVehicles = vehData.documents || [];
    const activeVehicles = driverVehicles.filter((v) => v.status === "active");

    // If driver has no active vehicles, they cannot see available jobs
    if (activeVehicles.length === 0) {
      return { requests: [], total: 0, reason: "No active vehicles registered." };
    }

    const activeCategories = [...new Set(activeVehicles.map((v) => v.service_category).filter(Boolean))];

    // 2. Query open service requests
    const statusQuery = buildEqualQuery("status", "open_for_bids");
    const orderQuery = buildOrderDescQuery("created_at");
    const limitQuery = buildLimitQuery(50);
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents?queries[]=${statusQuery}&queries[]=${orderQuery}&queries[]=${limitQuery}`,
      { headers: serverHeaders }
    );
    const reqData = await reqRes.json();
    const openRequests = reqData.documents || [];

    // 3. Match against active vehicle categories with deduplication
    const matchingRequests = [];
    const seenIds = new Set();

    for (const req of openRequests) {
      if (seenIds.has(req.$id)) continue;

      const isCompatible = activeCategories.some((cat) => isVehicleCompatibleWithRequest(cat, req.service_type));
      if (isCompatible) {
        seenIds.add(req.$id);
        // Marketplace-safe projection (NO private passenger email or phone)
        matchingRequests.push({
          $id: req.$id,
          id: req.$id,
          service_type: req.service_type,
          pickup_location: req.pickup_location,
          destination: req.destination,
          request_date: req.request_date,
          preferred_time: req.preferred_time,
          passenger_count: req.passenger_count,
          goods_type: req.goods_type,
          details: req.details,
          budget: req.budget,
          suggested_price: req.budget,
          status: req.status,
          created_at: req.created_at,
          updated_at: req.updated_at
        });
      }
    }

    return {
      requests: matchingRequests,
      total: matchingRequests.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_service_request_details (REQUEST DETAIL INTERFACE)
  // -------------------------------------------------------------
  if (action === "get_service_request_details") {
    const callerId = verifiedUser.$id;
    const targetReqId = data.request_id || request_id || data.$id;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");

    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Service request not found.");
    const reqDoc = await reqRes.json();

    // Associated images
    const imgQuery = buildEqualQuery("request_id", targetReqId);
    const imgRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/request_images/documents?queries[]=${imgQuery}`,
      { headers: serverHeaders }
    );
    const imgData = await imgRes.json();
    const images = (imgData.documents || []).map((img) => ({
      $id: img.$id,
      id: img.$id,
      file_id: img.file_id,
      created_at: img.created_at
    }));

    // If caller is the request owner (passenger)
    if (reqDoc.passenger_id === callerId) {
      return {
        ...reqDoc,
        id: reqDoc.$id,
        suggested_price: reqDoc.budget,
        images
      };
    }

    // If caller is a driver: verify eligibility (must have active vehicle compatible with service_type)
    const vehQuery = buildEqualQuery("driver_id", callerId);
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${vehQuery}`,
      { headers: serverHeaders }
    );
    const vehData = await vehRes.json();
    const activeVehicles = (vehData.documents || []).filter((v) => v.status === "active");
    const activeCategories = activeVehicles.map((v) => v.service_category);

    const isEligible = activeCategories.some((cat) => isVehicleCompatibleWithRequest(cat, reqDoc.service_type));
    if (!isEligible) {
      throw new Error("Forbidden: You are not eligible to view this request.");
    }

    // Return marketplace-safe detail
    return {
      $id: reqDoc.$id,
      id: reqDoc.$id,
      service_type: reqDoc.service_type,
      pickup_location: reqDoc.pickup_location,
      destination: reqDoc.destination,
      request_date: reqDoc.request_date,
      preferred_time: reqDoc.preferred_time,
      passenger_count: reqDoc.passenger_count,
      goods_type: reqDoc.goods_type,
      details: reqDoc.details,
      budget: reqDoc.budget,
      suggested_price: reqDoc.budget,
      status: reqDoc.status,
      created_at: reqDoc.created_at,
      images
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_passenger_requests (PASSENGER HISTORY INTERFACE)
  // -------------------------------------------------------------
  if (action === "list_passenger_requests") {
    const passengerId = verifiedUser.$id;
    const pQuery = buildEqualQuery("passenger_id", passengerId);
    const oQuery = buildOrderDescQuery("created_at");
    const lQuery = buildLimitQuery(50);

    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents?queries[]=${pQuery}&queries[]=${oQuery}&queries[]=${lQuery}`,
      { headers: serverHeaders }
    );
    const reqData = await reqRes.json();
    const requests = (reqData.documents || []).map((r) => ({
      ...r,
      id: r.$id,
      request_type: r.service_type,
      pickup_address: r.pickup_location,
      destination_address: r.destination,
      suggested_price: r.budget
    }));

    return { requests, total: requests.length };
  }

  // -------------------------------------------------------------
  // ACTION: create_bid (DRIVER SUBMITS BID ON OPEN REQUEST)
  // Business rule: 5 free awarded jobs enforced server-side.
  // Bidding itself is free; only accepted/completed bookings count.
  // -------------------------------------------------------------
  if (action === "create_bid") {
    const driverId = verifiedUser.$id;

    // 1. Reject privileged fields
    const bidPrivFields = ["driver_id", "status", "created_at", "updated_at"];
    for (const f of bidPrivFields) {
      if (data[f] !== undefined) {
        throw new Error(`Privilege escalation blocked: Cannot supply '${f}' during bid creation.`);
      }
    }

    // 2. Resolve request_id
    const targetReqId = data.request_id || data.requestId || request_id;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");
    if (!data.proposed_price && data.proposed_price !== 0) throw new Error("Missing required parameter: proposed_price");

    // 3. Fetch and validate the service request (must be open_for_bids)
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Service request not found.");
    const reqDoc = await reqRes.json();
    if (!["open_for_bids", "bids_received"].includes(reqDoc.status)) {
      throw new Error(`Cannot bid on request with status '${reqDoc.status}'.`);
    }

    // 4. Driver cannot bid on their own requests
    if (reqDoc.passenger_id === driverId) {
      throw new Error("Forbidden: You cannot bid on your own request.");
    }

    // 5. Verify driver has at least one active vehicle compatible with the request type
    const vehQuery = buildEqualQuery("driver_id", driverId);
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${vehQuery}`,
      { headers: serverHeaders }
    );
    const vehData = await vehRes.json();
    const activeVehicles = (vehData.documents || []).filter((v) => v.status === "active");
    if (activeVehicles.length === 0) {
      throw new Error("Forbidden: You must have an active registered vehicle to bid on jobs.");
    }

    // 6. SERVER-SIDE 5 FREE JOB ENFORCEMENT
    // Count all bookings (confirmed / in_progress / completed) for this driver
    const bookQ1 = buildEqualQuery("driver_id", driverId);
    const bookingsRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${bookQ1}`,
      { headers: serverHeaders }
    );
    const bookingsData = await bookingsRes.json();
    const totalAwardedJobs = (bookingsData.documents || []).filter((b) =>
      ["confirmed", "driver_arriving", "in_progress", "completed"].includes(b.status)
    ).length;

    if (totalAwardedJobs >= 5) {
      // 7. Check active subscription (subscriptions table uses user_id, not driver_id)
      const subQ = buildEqualQuery("user_id", driverId);
      const subRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${subQ}`,
        { headers: serverHeaders }
      );
      const subData = await subRes.json();
      const now = new Date();
      const hasActiveSub = (subData.documents || []).some(
        (s) => s.status === "active" && new Date(s.expires_at) > now
      );

      if (!hasActiveSub) {
        throw new Error("SUBSCRIPTION_REQUIRED: You have used all 5 free jobs. Subscribe to bid on more jobs.");
      }
    }

    // 8. Check for an existing bid by this driver on this request (upsert semantics)
    const existQ1 = buildEqualQuery("request_id", targetReqId);
    const existQ2 = buildEqualQuery("driver_id", driverId);
    const existRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents?queries[]=${existQ1}&queries[]=${existQ2}`,
      { headers: serverHeaders }
    );
    const existData = await existRes.json();
    const existingBid = (existData.documents || [])[0];

    // 9. Resolve vehicle to use for this bid
    //    If driver supplies a vehicle_id, it MUST belong to them (ownership check).
    //    If not supplied, auto-select the most compatible active vehicle.
    let bidVehicleId = null;
    if (data.vehicle_id) {
      // Verify supplied vehicle_id belongs to the authenticated driver
      const ownedVehicle = activeVehicles.find((v) => v.$id === data.vehicle_id);
      if (!ownedVehicle) {
        throw new Error(
          `Forbidden: vehicle_id '${data.vehicle_id}' does not belong to the authenticated driver or is not active.`
        );
      }
      bidVehicleId = data.vehicle_id;
    } else {
      // Auto-select: prefer compatible vehicle, fall back to any active vehicle
      bidVehicleId = activeVehicles.find(
        (v) => isVehicleCompatibleWithRequest(v.service_category, reqDoc.service_type)
      )?.$id || activeVehicles[0]?.$id || null;
    }

    const bidPayload = {
      request_id: targetReqId,
      driver_id: driverId,
      vehicle_id: bidVehicleId || null,
      amount: parseFloat(data.proposed_price || data.amount || 0),
      message: data.message ? String(data.message).trim() : null,
      status: "pending",
      updated_at: new Date().toISOString()
    };

    // 10. If driver already bid on this request, update existing bid
    if (existingBid) {
      if (["rejected", "withdrawn"].includes(existingBid.status)) {
        throw new Error("Your previous bid on this request was rejected or withdrawn.");
      }
      const updateRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/bids/documents/${existingBid.$id}`,
        {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({ data: { ...bidPayload, updated_at: new Date().toISOString() } })
        }
      );
      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.message || "Failed to update existing bid.");
      }
      const updatedBid = await updateRes.json();

      // Ensure request status reflects bids received
      await fetch(
        `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
        {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({ data: { status: "bids_received", updated_at: new Date().toISOString() } })
        }
      ).catch(() => {});

      return { ...updatedBid, id: updatedBid.$id, updated: true };
    }

    // 11. Create new bid document (no client write/update/delete)
    bidPayload.created_at = new Date().toISOString();
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: bidPayload,
          permissions: [
            `read("user:${driverId}")`,
            `read("user:${reqDoc.passenger_id}")`
          ]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create bid.");
    }

    const newBid = await createRes.json();

    // 12. Update service request status to bids_received
    await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { status: "bids_received", updated_at: new Date().toISOString() } })
      }
    ).catch(() => {});

    // 13. Notify the passenger about the new bid
    await createNotification(creds, serverHeaders, {
      userId: reqDoc.passenger_id,
      type: "bid_received",
      title: "New Offer Received",
      message: `A driver has submitted an offer of $${parseFloat(bidPayload.amount).toFixed(2)} on your request.`,
      relatedId: targetReqId
    });

    return { ...newBid, id: newBid.$id, updated: false };
  }

  // -------------------------------------------------------------
  // ACTION: list_bids_for_request (PASSENGER VIEWS BIDS)
  // Only the owning passenger can view bids on their request.
  // -------------------------------------------------------------
  if (action === "list_bids_for_request") {
    const passengerId = verifiedUser.$id;
    const targetReqId = data.request_id || data.requestId || request_id;
    if (!targetReqId) throw new Error("Missing required parameter: request_id");

    // Verify caller owns this request
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Service request not found.");
    const reqDoc = await reqRes.json();
    if (reqDoc.passenger_id !== passengerId) {
      throw new Error("Forbidden: You do not own this service request.");
    }

    // Fetch all bids for this request
    const bidQ = buildEqualQuery("request_id", targetReqId);
    const orderQ = buildOrderDescQuery("created_at");
    const bidsRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents?queries[]=${bidQ}&queries[]=${orderQ}`,
      { headers: serverHeaders }
    );
    const bidsData = await bidsRes.json();
    const bids = bidsData.documents || [];

    // Enrich each bid with driver profile (safe fields only) and vehicle info
    const enriched = await Promise.all(bids.map(async (bid) => {
      let driverProfile = null;
      let vehicle = null;

      try {
        const dProfileQ = buildEqualQuery("user_id", bid.driver_id);
        const dProfRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${dProfileQ}`,
          { headers: serverHeaders }
        );
        const dProfData = await dProfRes.json();
        const dp = dProfData.documents?.[0];
        if (dp) {
          driverProfile = {
            full_name: dp.full_name,
            city: dp.city,
            bio: dp.bio,
            profile_image_id: dp.profile_image_id,
            verification_status: dp.verification_status
          };
        }
      } catch (e) { /* profile fetch failure is non-fatal */ }

      try {
        if (bid.vehicle_id) {
          const vRes = await fetch(
            `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${bid.vehicle_id}`,
            { headers: serverHeaders }
          );
          if (vRes.ok) {
            const vDoc = await vRes.json();
            vehicle = {
              make: vDoc.make,
              model: vDoc.model,
              year: vDoc.year,
              colour: vDoc.colour,
              vehicle_type: vDoc.vehicle_type,
              registration_number: vDoc.registration_number,
              passenger_capacity: vDoc.passenger_capacity,
              service_category: vDoc.service_category
            };
          }
        }
      } catch (e) { /* vehicle fetch failure is non-fatal */ }

      return {
        ...bid,
        id: bid.$id,
        driver: driverProfile,
        vehicle
      };
    }));

    return { bids: enriched, total: enriched.length, request: reqDoc };
  }

  // -------------------------------------------------------------
  // ACTION: list_driver_bids (DRIVER VIEWS THEIR OWN BIDS)
  // -------------------------------------------------------------
  if (action === "list_driver_bids") {
    const driverId = verifiedUser.$id;
    const driverBidQ = buildEqualQuery("driver_id", driverId);
    const orderQ = buildOrderDescQuery("created_at");
    const limitQ = buildLimitQuery(50);

    const bidsRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents?queries[]=${driverBidQ}&queries[]=${orderQ}&queries[]=${limitQ}`,
      { headers: serverHeaders }
    );
    const bidsData = await bidsRes.json();
    const bids = bidsData.documents || [];

    // Enrich with request details (marketplace-safe fields only)
    const enriched = await Promise.all(bids.map(async (bid) => {
      let requestInfo = null;
      try {
        const rRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bid.request_id}`,
          { headers: serverHeaders }
        );
        if (rRes.ok) {
          const rDoc = await rRes.json();
          requestInfo = {
            $id: rDoc.$id,
            id: rDoc.$id,
            service_type: rDoc.service_type,
            pickup_location: rDoc.pickup_location,
            destination: rDoc.destination,
            request_date: rDoc.request_date,
            preferred_time: rDoc.preferred_time,
            status: rDoc.status,
            budget: rDoc.budget
          };
        }
      } catch (e) { /* non-fatal */ }

      return { ...bid, id: bid.$id, request: requestInfo };
    }));

    return { bids: enriched, total: enriched.length };
  }

  // -------------------------------------------------------------
  // ACTION: accept_bid (PASSENGER ATOMICALLY ACCEPTS A BID)
  // 1. Re-check driver entitlement (server-side, mandatory)
  // 2. Mark chosen bid as "accepted"
  // 3. Reject all other bids for this request
  // 4. Update request status to "accepted"
  // 5. Create booking record
  // All steps use the trusted API key — no client bypass possible.
  // -------------------------------------------------------------
  if (action === "accept_bid") {
    const passengerId = verifiedUser.$id;
    const bidId = data.bid_id || data.bidId;
    if (!bidId) throw new Error("Missing required parameter: bid_id");

    // 1. Fetch the bid
    const bidRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents/${bidId}`,
      { headers: serverHeaders }
    );
    if (!bidRes.ok) throw new Error("Bid not found.");
    const bidDoc = await bidRes.json();

    if (bidDoc.status !== "pending") {
      throw new Error(`Cannot accept a bid with status '${bidDoc.status}'.`);
    }

    // 2. Fetch and validate the service request
    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bidDoc.request_id}`,
      { headers: serverHeaders }
    );
    if (!reqRes.ok) throw new Error("Associated service request not found.");
    const reqDoc = await reqRes.json();

    // Verify caller owns the request
    if (reqDoc.passenger_id !== passengerId) {
      throw new Error("Forbidden: You do not own this service request.");
    }

    // Request must be in a biddable/open state
    if (!["open_for_bids", "bids_received"].includes(reqDoc.status)) {
      throw new Error(`Cannot accept a bid on a request with status '${reqDoc.status}'.`);
    }

    // 3. MANDATORY SERVER-SIDE ENTITLEMENT RE-CHECK FOR THE DRIVER
    const driverId = bidDoc.driver_id;
    const drBookQ = buildEqualQuery("driver_id", driverId);
    const drBookRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${drBookQ}`,
      { headers: serverHeaders }
    );
    const drBookData = await drBookRes.json();
    const driverAwardedJobs = (drBookData.documents || []).filter((b) =>
      ["confirmed", "driver_arriving", "in_progress", "completed"].includes(b.status)
    ).length;

    if (driverAwardedJobs >= 5) {
      // subscriptions table uses user_id not driver_id
      const drSubQ = buildEqualQuery("user_id", driverId);
      const drSubRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${drSubQ}`,
        { headers: serverHeaders }
      );
      const drSubData = await drSubRes.json();
      const now = new Date();
      const driverHasSub = (drSubData.documents || []).some(
        (s) => s.status === "active" && new Date(s.expires_at) > now
      );
      if (!driverHasSub) {
        throw new Error("DRIVER_SUBSCRIPTION_REQUIRED: The selected driver has exceeded their free job allowance and does not have an active subscription.");
      }
    }

    // 4. Accept this bid
    const acceptBidRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents/${bidId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { status: "accepted", updated_at: new Date().toISOString() } })
      }
    );
    if (!acceptBidRes.ok) {
      const err = await acceptBidRes.json();
      throw new Error(err.message || "Failed to accept bid.");
    }

    // 5. Reject all competing bids for this request
    const allBidQ = buildEqualQuery("request_id", bidDoc.request_id);
    const allBidsRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents?queries[]=${allBidQ}`,
      { headers: serverHeaders }
    );
    const allBidsData = await allBidsRes.json();
    const competingBids = (allBidsData.documents || []).filter(
      (b) => b.$id !== bidId && b.status === "pending"
    );

    for (const cb of competingBids) {
      await fetch(
        `${creds.endpoint}/databases/transmove/collections/bids/documents/${cb.$id}`,
        {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({ data: { status: "rejected", updated_at: new Date().toISOString() } })
        }
      ).catch(() => {}); // Non-fatal: best-effort rejection of competing bids
    }

    // 6. Update service request to "accepted"
    await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bidDoc.request_id}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            status: "accepted",
            accepted_bid_id: bidId,
            updated_at: new Date().toISOString()
          }
        })
      }
    ).catch(() => {});

    // 7. Create booking record (bookings table uses 'amount', 'accepted_bid_id', 'vehicle_id' required)
    const finalPrice = bidDoc.amount || 0;
    const bookingPayload = {
      request_id: bidDoc.request_id,
      accepted_bid_id: bidId,
      passenger_id: passengerId,
      driver_id: driverId,
      vehicle_id: bidDoc.vehicle_id || "unknown",
      amount: finalPrice,
      status: "confirmed",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const bookingRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: bookingPayload,
          permissions: [
            `read("user:${passengerId}")`,
            `read("user:${driverId}")`
          ]
        })
      }
    );

    if (!bookingRes.ok) {
      const err = await bookingRes.json();
      throw new Error(err.message || "Failed to create booking record.");
    }

    const booking = await bookingRes.json();

    // 8. Notifications for bid acceptance and competing rejections
    await createNotification(creds, serverHeaders, {
      userId: driverId,
      type: "bid_accepted",
      title: "Quotation Accepted!",
      message: `Your quotation on trip from ${reqDoc.pickup_location || "pickup"} to ${reqDoc.destination || "destination"} was accepted. Booking confirmed.`,
      relatedId: booking.$id
    });

    await createNotification(creds, serverHeaders, {
      userId: passengerId,
      type: "booking_confirmed",
      title: "Booking Confirmed",
      message: `Your booking is confirmed with the driver. You can coordinate trip details in Messages.`,
      relatedId: booking.$id
    });

    for (const cb of competingBids) {
      createNotification(creds, serverHeaders, {
        userId: cb.driver_id,
        type: "bid_rejected",
        title: "Quotation Update",
        message: `The passenger selected another offer for the request from ${reqDoc.pickup_location || "pickup"} to ${reqDoc.destination || "destination"}.`,
        relatedId: bidDoc.request_id
      }).catch(() => {});
    }

    return {
      success: true,
      booking: { ...booking, id: booking.$id },
      bookingId: booking.$id,
      bid: bidDoc,
      competing_bids_rejected: competingBids.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_passenger_bookings (PASSENGER BOOKING HISTORY)
  // -------------------------------------------------------------
  if (action === "get_passenger_bookings") {
    const passengerId = verifiedUser.$id;
    const pBkQ = buildEqualQuery("passenger_id", passengerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${pBkQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const bkData = await bkRes.json();
    const bookings = bkData.documents || [];

    // Enrich bookings with request summary and driver name
    const enriched = await Promise.all(bookings.map(async (bk) => {
      let requestInfo = null;
      let driverInfo = null;
      let vehicleInfo = null;

      try {
        const rRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bk.request_id}`,
          { headers: serverHeaders }
        );
        if (rRes.ok) {
          const rDoc = await rRes.json();
          requestInfo = {
            id: rDoc.$id,
            service_type: rDoc.service_type,
            pickup_location: rDoc.pickup_location,
            destination: rDoc.destination,
            request_date: rDoc.request_date
          };
        }
      } catch (e) {}

      try {
        if (bk.driver_id) {
          const dProfQ = buildEqualQuery("user_id", bk.driver_id);
          const dProfRes = await fetch(
            `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${dProfQ}`,
            { headers: serverHeaders }
          );
          const dProfData = await dProfRes.json();
          const dp = dProfData.documents?.[0];
          if (dp) {
            driverInfo = {
              full_name: dp.full_name,
              phone: dp.phone,
              city: dp.city,
              profile_image_id: dp.profile_image_id
            };
          }
        }
      } catch (e) {}

      try {
        if (bk.vehicle_id) {
          const vRes = await fetch(
            `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${bk.vehicle_id}`,
            { headers: serverHeaders }
          );
          if (vRes.ok) {
            const vDoc = await vRes.json();
            vehicleInfo = {
              make: vDoc.make,
              model: vDoc.model,
              year: vDoc.year,
              colour: vDoc.colour,
              registration_number: vDoc.registration_number
            };
          }
        }
      } catch (e) {}

      return {
        ...bk,
        id: bk.$id,
        customer_id: bk.passenger_id,
        request: requestInfo,
        driver: driverInfo,
        vehicle: vehicleInfo
      };
    }));

    return { bookings: enriched, total: enriched.length };
  }

  // -------------------------------------------------------------
  // ACTION: get_driver_bookings (DRIVER BOOKING HISTORY / ACTIVE JOBS)
  // -------------------------------------------------------------
  if (action === "get_driver_bookings") {
    const driverId = verifiedUser.$id;
    const dBkQ = buildEqualQuery("driver_id", driverId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${dBkQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const bkData = await bkRes.json();
    const bookings = bkData.documents || [];

    const enriched = await Promise.all(bookings.map(async (bk) => {
      let requestInfo = null;
      let passengerInfo = null;
      let vehicleInfo = null;

      try {
        const rRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bk.request_id}`,
          { headers: serverHeaders }
        );
        if (rRes.ok) {
          const rDoc = await rRes.json();
          requestInfo = {
            id: rDoc.$id,
            service_type: rDoc.service_type,
            pickup_location: rDoc.pickup_location,
            destination: rDoc.destination,
            request_date: rDoc.request_date,
            preferred_time: rDoc.preferred_time,
            passenger_count: rDoc.passenger_count,
            goods_type: rDoc.goods_type,
            details: rDoc.details
          };
        }
      } catch (e) {}

      try {
        if (bk.passenger_id) {
          const pProfQ = buildEqualQuery("user_id", bk.passenger_id);
          const pProfRes = await fetch(
            `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${pProfQ}`,
            { headers: serverHeaders }
          );
          const pProfData = await pProfRes.json();
          const pp = pProfData.documents?.[0];
          if (pp) {
            // Minimal safe fields only for drivers
            passengerInfo = { full_name: pp.full_name, city: pp.city };
          }
        }
      } catch (e) {}

      try {
        if (bk.vehicle_id) {
          const vRes = await fetch(
            `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${bk.vehicle_id}`,
            { headers: serverHeaders }
          );
          if (vRes.ok) {
            const vDoc = await vRes.json();
            vehicleInfo = {
              make: vDoc.make,
              model: vDoc.model,
              year: vDoc.year,
              colour: vDoc.colour,
              registration_number: vDoc.registration_number
            };
          }
        }
      } catch (e) {}

      return {
        ...bk,
        id: bk.$id,
        customer_id: bk.passenger_id,
        request: requestInfo,
        passenger: passengerInfo,
        vehicle: vehicleInfo
      };
    }));

    return { bookings: enriched, total: enriched.length };
  }

  // -------------------------------------------------------------
  // ACTION: update_booking_status (DRIVER/PASSENGER STATUS UPDATE)
  // Allowed driver transitions: confirmed→driver_arriving→in_progress→completed
  // Allowed passenger transitions: confirmed→cancelled (with reason)
  // -------------------------------------------------------------
  if (action === "update_booking_status") {
    const callerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const newStatus = data.status;
    const validStatuses = ["driver_arriving", "in_progress", "completed", "cancelled"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Allowed: ${validStatuses.join(", ")}`);
    }

    // Fetch booking
    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bkRes.ok) throw new Error("Booking not found.");
    const bkDoc = await bkRes.json();

    const isDriver = bkDoc.driver_id === callerId;
    const isPassenger = bkDoc.passenger_id === callerId;

    if (!isDriver && !isPassenger) {
      throw new Error("Forbidden: You are not a party to this booking.");
    }

    // Business rules: passengers can only cancel confirmed bookings
    if (isPassenger && newStatus !== "cancelled") {
      throw new Error("Passengers may only cancel a booking.");
    }

    // Drivers cannot cancel via this action (use a separate cancellation flow)
    if (isDriver && newStatus === "cancelled") {
      throw new Error("Driver cancellation is not permitted via this action.");
    }

    if (bkDoc.status === "completed" || bkDoc.status === "cancelled") {
      throw new Error(`Cannot update a booking that is already '${bkDoc.status}'.`);
    }

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === "in_progress") updateData.started_at = new Date().toISOString();
    if (newStatus === "completed") updateData.completed_at = new Date().toISOString();
    if (newStatus === "cancelled") {
      updateData.cancellation_reason = data.reason ? String(data.reason).trim() : "Cancelled by user";
      updateData.cancelled_by = callerId;
    }

    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updateData })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update booking status.");
    }

    const updatedBk = await updateRes.json();

    // Notify the other party about status change
    const targetUserId = isDriver ? bkDoc.passenger_id : bkDoc.driver_id;
    let notifTitle = "Booking Update";
    let notifMsg = `Booking status changed to '${newStatus}'.`;

    if (newStatus === "driver_arriving") {
      notifTitle = "Driver Arriving";
      notifMsg = "Your driver is arriving at the pickup location.";
    } else if (newStatus === "in_progress") {
      notifTitle = "Trip Started";
      notifMsg = "Your trip is now in progress.";
    } else if (newStatus === "completed") {
      notifTitle = "Trip Completed";
      notifMsg = "Your trip has ended. Thank you for travelling with TransMove!";
    } else if (newStatus === "cancelled") {
      notifTitle = "Booking Cancelled";
      notifMsg = `The booking was cancelled by the ${isDriver ? "driver" : "passenger"}.`;
    }

    await createNotification(creds, serverHeaders, {
      userId: targetUserId,
      type: "booking_status_changed",
      title: notifTitle,
      message: notifMsg,
      relatedId: bookingId
    });

    return { ...updatedBk, id: updatedBk.$id };
  }

  // -------------------------------------------------------------
  // ACTION: withdraw_bid (DRIVER WITHDRAWS THEIR OWN BID)
  // -------------------------------------------------------------
  if (action === "withdraw_bid") {
    const driverId = verifiedUser.$id;
    const bidId = data.bid_id || data.bidId;
    if (!bidId) throw new Error("Missing required parameter: bid_id");

    const bidRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents/${bidId}`,
      { headers: serverHeaders }
    );
    if (!bidRes.ok) throw new Error("Bid not found.");
    const bidDoc = await bidRes.json();

    if (bidDoc.driver_id !== driverId) {
      throw new Error("Forbidden: You do not own this bid.");
    }
    if (!["pending"].includes(bidDoc.status)) {
      throw new Error(`Cannot withdraw a bid with status '${bidDoc.status}'.`);
    }

    const wRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents/${bidId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { status: "withdrawn", updated_at: new Date().toISOString() } })
      }
    );
    if (!wRes.ok) {
      const err = await wRes.json();
      throw new Error(err.message || "Failed to withdraw bid.");
    }

    return { success: true, bid_id: bidId, status: "withdrawn" };
  }

  // -------------------------------------------------------------
  // ACTION: check_driver_entitlement (DRIVER JOB COUNT CHECK)
  // Lets the UI show subscription prompts proactively.
  // -------------------------------------------------------------
  if (action === "check_driver_entitlement") {
    const driverId = verifiedUser.$id;

    const bookQ = buildEqualQuery("driver_id", driverId);
    const bookRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${bookQ}`,
      { headers: serverHeaders }
    );
    const bookData = await bookRes.json();
    const awardedJobs = (bookData.documents || []).filter((b) =>
      ["confirmed", "driver_arriving", "in_progress", "completed"].includes(b.status)
    ).length;

    const freeJobsRemaining = Math.max(0, 5 - awardedJobs);
    let hasActiveSub = false;

    // subscriptions table uses user_id not driver_id; expiry field is expires_at
    const subQ = buildEqualQuery("user_id", driverId);
    const subRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${subQ}`,
      { headers: serverHeaders }
    );
    const subData = await subRes.json();
    const now = new Date();
    hasActiveSub = (subData.documents || []).some(
      (s) => s.status === "active" && new Date(s.expires_at) > now
    );

    return {
      driver_id: driverId,
      awarded_jobs: awardedJobs,
      free_jobs_used: Math.min(awardedJobs, 5),
      free_jobs_remaining: freeJobsRemaining,
      free_limit: 5,
      has_active_subscription: hasActiveSub,
      can_bid: hasActiveSub || awardedJobs < 5
    };
  }

  // -------------------------------------------------------------
  // ACTION: send_message (MESSAGING BETWEEN PARTICIPANTS)
  // -------------------------------------------------------------
  if (action === "send_message") {
    const senderId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    const rawMsg = data.message || data.content;

    if (!bookingId) throw new Error("Missing required parameter: booking_id");
    if (!rawMsg || !String(rawMsg).trim()) throw new Error("Message content cannot be empty.");

    const trimmedMsg = String(rawMsg).trim();
    if (trimmedMsg.length > 5000) throw new Error("Message exceeds maximum allowed length of 5000 characters.");

    // Fetch booking
    const bkRes = await fetch(`${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`, {
      headers: serverHeaders
    });
    if (!bkRes.ok) throw new Error("Booking not found.");
    const booking = await bkRes.json();

    const isPassenger = booking.passenger_id === senderId;
    const isDriver = booking.driver_id === senderId;

    if (!isPassenger && !isDriver) {
      throw new Error("Forbidden: You are not a participant in this booking.");
    }

    if (booking.passenger_id === booking.driver_id) {
      throw new Error("Cannot message yourself.");
    }

    const receiverId = isPassenger ? booking.driver_id : booking.passenger_id;

    // Reject client-supplied spoofing
    if (data.sender_id && data.sender_id !== senderId) {
      throw new Error("Privilege escalation blocked: Cannot spoof sender_id.");
    }
    if (data.receiver_id && data.receiver_id !== receiverId) {
      throw new Error("Forbidden: Receiver must be the other booking participant.");
    }

    const conversationId = `booking_${booking.$id}`;
    const now = new Date().toISOString();

    const msgPayload = {
      conversation_id: conversationId,
      booking_id: booking.$id,
      sender_id: senderId,
      receiver_id: receiverId,
      message: trimmedMsg,
      read: false,
      created_at: now
    };

    const createRes = await fetch(`${creds.endpoint}/databases/transmove/collections/messages/documents`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({
        documentId: "unique()",
        data: msgPayload,
        permissions: [
          `read("user:${booking.passenger_id}")`,
          `read("user:${booking.driver_id}")`
        ]
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create message record.");
    }

    const newMsg = await createRes.json();

    // Fetch sender profile name for notification
    let senderName = verifiedUser.name || "Trip partner";
    try {
      const pQ = buildEqualQuery("user_id", senderId);
      const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${pQ}`, {
        headers: serverHeaders
      });
      const pData = await pRes.json();
      if (pData.documents?.[0]?.full_name) senderName = pData.documents[0].full_name;
    } catch (_) {}

    // Send notification to receiver
    await createNotification(creds, serverHeaders, {
      userId: receiverId,
      type: "new_message",
      title: `New message from ${senderName}`,
      message: trimmedMsg.length > 80 ? trimmedMsg.slice(0, 77) + "..." : trimmedMsg,
      relatedId: booking.$id
    });

    return {
      ...newMsg,
      id: newMsg.$id,
      content: newMsg.message,
      booking_id: booking.$id
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_booking_messages (CONVERSATION RETRIEVAL)
  // -------------------------------------------------------------
  if (action === "list_booking_messages") {
    const callerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    // Fetch booking to verify caller is participant
    const bkRes = await fetch(`${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`, {
      headers: serverHeaders
    });
    if (!bkRes.ok) throw new Error("Booking not found.");
    const booking = await bkRes.json();

    if (booking.passenger_id !== callerId && booking.driver_id !== callerId) {
      throw new Error("Forbidden: You are not a participant in this booking.");
    }

    // Query messages by conversation_id or booking_id
    const convId = `booking_${booking.$id}`;
    const cQ = buildEqualQuery("conversation_id", convId);
    const lQ = buildLimitQuery(100);

    const mRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/messages/documents?queries[]=${cQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const mData = await mRes.json();
    let rawDocs = mData.documents || [];

    // Fallback: if no documents with booking_ prefix, try booking_id
    if (rawDocs.length === 0) {
      const bQ = buildEqualQuery("booking_id", booking.$id);
      const mRes2 = await fetch(
        `${creds.endpoint}/databases/transmove/collections/messages/documents?queries[]=${bQ}&queries[]=${lQ}`,
        { headers: serverHeaders }
      );
      const mData2 = await mRes2.json();
      if (mData2.documents?.length) rawDocs = mData2.documents;
    }

    // Sort ascending by created_at in memory
    rawDocs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Gather sender profile names/photos safely
    const senderIds = [...new Set(rawDocs.map(m => m.sender_id))];
    const profileMap = new Map();
    for (const sId of senderIds) {
      try {
        const pQ = buildEqualQuery("user_id", sId);
        const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${pQ}`, {
          headers: serverHeaders
        });
        const pData = await pRes.json();
        if (pData.documents?.[0]) {
          const p = pData.documents[0];
          profileMap.set(sId, {
            full_name: p.full_name || "User",
            profile_photo_url: p.profile_image_id ? `${creds.endpoint}/storage/buckets/transmove-files/files/${p.profile_image_id}/view?project=${creds.projectId}` : ""
          });
        }
      } catch (_) {}
    }

    const messages = rawDocs.map(m => ({
      ...m,
      id: m.$id,
      content: m.message,
      sender: profileMap.get(m.sender_id) || { full_name: "User" }
    }));

    return {
      messages,
      total: messages.length,
      booking_id: booking.$id
    };
  }

  // -------------------------------------------------------------
  // ACTION: mark_messages_read
  // -------------------------------------------------------------
  if (action === "mark_messages_read") {
    const callerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    const messageId = data.message_id || data.messageId;

    let updatedCount = 0;

    if (messageId) {
      const mRes = await fetch(`${creds.endpoint}/databases/transmove/collections/messages/documents/${messageId}`, {
        headers: serverHeaders
      });
      if (mRes.ok) {
        const mDoc = await mRes.json();
        if (mDoc.receiver_id === callerId && !mDoc.read) {
          await fetch(`${creds.endpoint}/databases/transmove/collections/messages/documents/${messageId}`, {
            method: "PATCH",
            headers: serverHeaders,
            body: JSON.stringify({ data: { read: true } })
          });
          updatedCount = 1;
        }
      }
    } else if (bookingId) {
      const convId = `booking_${bookingId}`;
      const cQ = buildEqualQuery("conversation_id", convId);
      const rQ = buildEqualQuery("receiver_id", callerId);
      const unreadQ = buildEqualQuery("read", false);
      const lQ = buildLimitQuery(100);

      const mRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/messages/documents?queries[]=${cQ}&queries[]=${rQ}&queries[]=${unreadQ}&queries[]=${lQ}`,
        { headers: serverHeaders }
      );
      const mData = await mRes.json();
      const docs = mData.documents || [];

      for (const d of docs) {
        await fetch(`${creds.endpoint}/databases/transmove/collections/messages/documents/${d.$id}`, {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({ data: { read: true } })
        }).catch(() => {});
        updatedCount++;
      }
    }

    return { success: true, updated_count: updatedCount };
  }

  // -------------------------------------------------------------
  // ACTION: get_unread_message_count
  // -------------------------------------------------------------
  if (action === "get_unread_message_count") {
    const callerId = verifiedUser.$id;
    const rQ = buildEqualQuery("receiver_id", callerId);
    const unreadQ = buildEqualQuery("read", false);
    const lQ = buildLimitQuery(100);

    const mRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/messages/documents?queries[]=${rQ}&queries[]=${unreadQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const mData = await mRes.json();
    return {
      unread_count: (mData.documents || []).length
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_notifications (USER'S OWN NOTIFICATIONS)
  // -------------------------------------------------------------
  if (action === "list_notifications") {
    const callerId = verifiedUser.$id;
    const uQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);

    const nRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/notifications/documents?queries[]=${uQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const nData = await nRes.json();
    const notifications = (nData.documents || []).map(n => ({
      ...n,
      id: n.$id,
      body: n.message,
      is_read: n.read
    }));

    const unreadCount = notifications.filter(n => !n.read).length;

    return {
      notifications,
      total: notifications.length,
      unread_count: unreadCount
    };
  }

  // -------------------------------------------------------------
  // ACTION: mark_notification_read
  // -------------------------------------------------------------
  if (action === "mark_notification_read") {
    const callerId = verifiedUser.$id;
    const notificationId = data.notification_id || data.notificationId;
    if (!notificationId) throw new Error("Missing required parameter: notification_id");

    const nRes = await fetch(`${creds.endpoint}/databases/transmove/collections/notifications/documents/${notificationId}`, {
      headers: serverHeaders
    });
    if (!nRes.ok) throw new Error("Notification not found.");
    const nDoc = await nRes.json();

    if (nDoc.user_id !== callerId) {
      throw new Error("Forbidden: You do not own this notification.");
    }

    const patchRes = await fetch(`${creds.endpoint}/databases/transmove/collections/notifications/documents/${notificationId}`, {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({ data: { read: true } })
    });
    const updated = await patchRes.json();
    return { success: true, notification: { ...updated, id: updated.$id, is_read: true } };
  }

  // -------------------------------------------------------------
  // ACTION: mark_all_notifications_read
  // -------------------------------------------------------------
  if (action === "mark_all_notifications_read") {
    const callerId = verifiedUser.$id;
    const uQ = buildEqualQuery("user_id", callerId);
    const unreadQ = buildEqualQuery("read", false);
    const lQ = buildLimitQuery(100);

    const nRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/notifications/documents?queries[]=${uQ}&queries[]=${unreadQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const nData = await nRes.json();
    const docs = nData.documents || [];

    for (const d of docs) {
      await fetch(`${creds.endpoint}/databases/transmove/collections/notifications/documents/${d.$id}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { read: true } })
      }).catch(() => {});
    }

    return { success: true, updated_count: docs.length };
  }

  // -------------------------------------------------------------
  // ACTION: driver_heartbeat (AUTOMATIC DRIVER PRESENCE)
  // -------------------------------------------------------------
  if (action === "driver_heartbeat") {
    const callerId = verifiedUser.$id;

    if (data.driver_id && data.driver_id !== callerId) {
      throw new Error("Privilege escalation blocked: Cannot submit heartbeat for another driver.");
    }

    const driverId = callerId;
    const now = new Date().toISOString();

    const dQ = buildEqualQuery("driver_id", driverId);
    const pRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/driver_presence/documents?queries[]=${dQ}`,
      { headers: serverHeaders }
    );
    const pData = await pRes.json();
    const existing = pData.documents?.[0];

    if (existing) {
      const updateRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/driver_presence/documents/${existing.$id}`,
        {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({
            data: {
              last_seen_at: now,
              updated_at: now
            }
          })
        }
      );
      const updated = await updateRes.json();
      return {
        success: true,
        driver_id: driverId,
        last_seen_at: now,
        online: true,
        presence_id: updated.$id
      };
    } else {
      const createRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/driver_presence/documents`,
        {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({
            documentId: "unique()",
            data: {
              driver_id: driverId,
              last_seen_at: now,
              created_at: now,
              updated_at: now
            },
            permissions: [
              `read("users")`
            ]
          })
        }
      );
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create driver presence record.");
      }
      const created = await createRes.json();
      return {
        success: true,
        driver_id: driverId,
        last_seen_at: now,
        online: true,
        presence_id: created.$id
      };
    }
  }

  // -------------------------------------------------------------
  // ACTION: get_driver_presence (SAFE MARKETPLACE STATUS)
  // -------------------------------------------------------------
  if (action === "get_driver_presence") {
    const targetDriverId = data.driver_id || data.driverId;
    if (!targetDriverId) throw new Error("Missing required parameter: driver_id");

    const dQ = buildEqualQuery("driver_id", targetDriverId);
    const pRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/driver_presence/documents?queries[]=${dQ}`,
      { headers: serverHeaders }
    );
    const pData = await pRes.json();
    const doc = pData.documents?.[0];

    if (!doc) {
      return {
        driver_id: targetDriverId,
        online: false,
        last_seen_at: null
      };
    }

    const lastSeen = new Date(doc.last_seen_at).getTime();
    const diffMs = Date.now() - lastSeen;
    const isOnline = diffMs <= 180000; // 3 minutes

    return {
      driver_id: targetDriverId,
      online: isOnline,
      last_seen_at: doc.last_seen_at
    };
  }

  // -------------------------------------------------------------
  // ADMIN READS & PROFILE MODERATION (APPWRITE, SERVER-VERIFIED)
  // -------------------------------------------------------------
  if (action === "admin_get_platform_stats") {
    await requireAdmin();
    const list = async (collectionId, queries = []) => {
      const queryString = queries.map((query) => `queries[]=${query}`).join("&");
      const response = await fetch(
        `${creds.endpoint}/databases/transmove/collections/${collectionId}/documents${queryString ? `?${queryString}` : ""}`,
        { headers: serverHeaders }
      );
      if (!response.ok) throw new Error(`Unable to load ${collectionId} statistics.`);
      return response.json();
    };
    const [users, drivers, documents, bookings, payments] = await Promise.all([
      list("profiles", [buildLimitQuery(1)]),
      list("profiles", [buildEqualQuery("role", "driver"), buildLimitQuery(1)]),
      list("verification_documents", [buildEqualQuery("verification_status", "pending"), buildLimitQuery(1)]),
      list("bookings", [buildLimitQuery(1)]),
      list("payments", [buildEqualQuery("status", "paid"), buildLimitQuery(100)])
    ]);
    const totalRevenue = (payments.documents || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      totalUsers: users.total || 0,
      totalDrivers: drivers.total || 0,
      pendingVerifications: documents.total || 0,
      totalBookings: bookings.total || 0,
      totalRevenue: Number(totalRevenue.toFixed(2))
    };
  }

  if (action === "admin_list_users") {
    await requireAdmin();
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!response.ok) throw new Error("Unable to load user directory.");
    const result = await response.json();
    return {
      users: (result.documents || []).map((profile) => ({
        id: profile.$id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        role: profile.role,
        verification_status: profile.verification_status,
        account_status: profile.account_status,
        created_at: profile.created_at
      }))
    };
  }

  if (action === "admin_list_verifications") {
    await requireAdmin();
    const pendingQ = buildEqualQuery("verification_status", ["pending", "unverified"]);
    const profileRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${pendingQ}&queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!profileRes.ok) throw new Error("Unable to load verification queue.");
    const profileData = await profileRes.json();
    const allowedRoles = new Set(["driver", "owner", "vehicle_owner", "logistics", "logistics_provider", "machinery_owner"]);
    const profiles = (profileData.documents || []).filter((profile) => allowedRoles.has(profile.role));
    const queue = await Promise.all(profiles.map(async (profile) => {
      const userQuery = buildEqualQuery("driver_id", profile.user_id);
      const docQuery = buildEqualQuery("user_id", profile.user_id);
      const [vehicleRes, documentRes] = await Promise.all([
        fetch(`${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${userQuery}`, { headers: serverHeaders }),
        fetch(`${creds.endpoint}/databases/transmove/collections/verification_documents/documents?queries[]=${docQuery}`, { headers: serverHeaders })
      ]);
      const vehicleData = vehicleRes.ok ? await vehicleRes.json() : { documents: [] };
      const documentData = documentRes.ok ? await documentRes.json() : { documents: [] };
      return {
        id: profile.$id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        role: profile.role,
        verification_status: profile.verification_status,
        vehicles: (vehicleData.documents || []).map((vehicle) => ({
          id: vehicle.$id,
          make: vehicle.make,
          model: vehicle.model,
          registration_number: vehicle.registration_number,
          verification_status: vehicle.verification_status
        })),
        documents: (documentData.documents || []).map((document) => ({
          id: document.$id,
          document_type: document.document_type,
          verification_status: document.verification_status
        }))
      };
    }));
    return { verifications: queue, total: queue.length };
  }

  if (action === "admin_set_profile_verification") {
    await requireAdmin();
    const profileId = data.profile_id || data.profileId;
    const status = data.verification_status || data.status;
    if (!profileId) throw new Error("Missing profile_id parameter.");
    if (!["approved", "rejected", "suspended", "unverified"].includes(status)) {
      throw new Error("Invalid profile verification status.");
    }
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${profileId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { verification_status: status, updated_at: new Date().toISOString() } })
      }
    );
    if (!response.ok) throw new Error("Failed to update profile verification status.");
    return response.json();
  }

  if (action === "admin_set_account_status") {
    await requireAdmin();
    const profileId = data.profile_id || data.profileId;
    const status = data.account_status || data.status;
    if (!profileId) throw new Error("Missing profile_id parameter.");
    if (!["active", "suspended", "deactivated"].includes(status)) throw new Error("Invalid account status.");
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${profileId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { account_status: status, updated_at: new Date().toISOString() } })
      }
    );
    if (!response.ok) throw new Error("Failed to update account status.");
    return response.json();
  }

  if (action === "admin_list_bookings") {
    await requireAdmin();
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!response.ok) throw new Error("Unable to load bookings.");
    const result = await response.json();
    return { bookings: (result.documents || []).map((booking) => ({ ...booking, id: booking.$id, final_price: booking.amount })) };
  }

  if (action === "admin_list_payments") {
    await requireAdmin();
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!response.ok) throw new Error("Unable to load payments.");
    const result = await response.json();
    return { payments: (result.documents || []).map((payment) => ({
      id: payment.$id,
      internal_reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      payment_provider: payment.provider,
      payment_status: payment.status,
      payment_type: payment.payment_type,
      user_id: payment.user_id,
      created_at: payment.created_at,
      paid_at: payment.paid_at || null
    })) };
  }

  // -------------------------------------------------------------
  // ACTION: get_subscription_status (AUTHENTICATED PROVIDER ONLY)
  // -------------------------------------------------------------
  if (action === "get_subscription_status") {
    await requireProvider();
    const callerId = verifiedUser.$id;
    const targetUserId = data.user_id || data.userId || callerId;

    if (targetUserId !== callerId) {
      throw new Error("Forbidden: You cannot view another user's subscription.");
    }

    const subQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(5);

    const subRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${subQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const subData = await subRes.json();
    const subs = subData.documents || [];

    const now = new Date();
    const activeSub = subs.find(
      (s) => s.status === "active" && s.expires_at && new Date(s.expires_at) > now
    );

    if (activeSub) {
      return {
        active: true,
        status: "active",
        plan: activeSub.plan || "TransMove Professional",
        amount: activeSub.amount || 15.0,
        currency: activeSub.currency || "USD",
        started_at: activeSub.started_at || activeSub.created_at,
        expires_at: activeSub.expires_at,
        created_at: activeSub.created_at,
        subscription_id: activeSub.$id
      };
    }

    const latestSub = subs[0];
    if (latestSub) {
      return {
        active: false,
        status: latestSub.status === "active" ? "expired" : latestSub.status,
        plan: latestSub.plan || "TransMove Professional",
        amount: latestSub.amount || 15.0,
        currency: latestSub.currency || "USD",
        started_at: latestSub.started_at || latestSub.created_at,
        expires_at: latestSub.expires_at,
        created_at: latestSub.created_at,
        subscription_id: latestSub.$id
      };
    }

    return {
      active: false,
      status: "inactive",
      plan: null,
      amount: 15.0,
      currency: "USD",
      started_at: null,
      expires_at: null,
      subscription_id: null
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_user_payments (AUTHENTICATED USER PAYMENT HISTORY)
  // -------------------------------------------------------------
  if (action === "list_user_payments") {
    const callerId = verifiedUser.$id;
    const targetUserId = data.user_id || data.userId || callerId;

    if (targetUserId !== callerId) {
      throw new Error("Forbidden: You cannot view another user's payment records.");
    }

    const uQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);

    const pRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${uQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const pData = await pRes.json();
    const rawDocs = pData.documents || [];

    const payments = rawDocs.map((doc) => ({
      id: doc.$id,
      $id: doc.$id,
      reference: doc.reference,
      provider: doc.provider,
      provider_reference: doc.provider_reference || "",
      amount: doc.amount,
      currency: doc.currency || "USD",
      status: doc.status,
      payment_type: doc.payment_type,
      booking_id: doc.booking_id || null,
      subscription_id: doc.subscription_id || null,
      created_at: doc.created_at,
      paid_at: doc.paid_at || null
    }));

    return {
      payments,
      total: payments.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_wallet_balance (DERIVED FROM LATEST LEDGER BALANCE_AFTER)
  // -------------------------------------------------------------
  if (action === "get_wallet_balance") {
    const callerId = verifiedUser.$id;
    const targetUserId = data.user_id || data.userId || callerId;

    if (targetUserId !== callerId) {
      throw new Error("Forbidden: You cannot view another user's wallet balance.");
    }

    const uQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(1);

    const lRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/wallet_ledger/documents?queries[]=${uQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const lData = await lRes.json();
    const latest = lData.documents?.[0];

    const balance = latest ? parseFloat(latest.balance_after || 0.0) : 0.0;

    return {
      user_id: callerId,
      balance: parseFloat(balance.toFixed(2)),
      currency: "USD"
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_wallet_transactions (USER'S OWN WALLET LEDGER)
  // -------------------------------------------------------------
  if (action === "list_wallet_transactions") {
    const callerId = verifiedUser.$id;
    const targetUserId = data.user_id || data.userId || callerId;

    if (targetUserId !== callerId) {
      throw new Error("Forbidden: You cannot view another user's wallet transactions.");
    }

    const uQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);

    const lRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/wallet_ledger/documents?queries[]=${uQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const lData = await lRes.json();
    const rawDocs = lData.documents || [];

    const transactions = rawDocs.map((doc) => ({
      id: doc.$id,
      $id: doc.$id,
      amount: doc.amount,
      transaction_type: doc.transaction_type,
      category: doc.category,
      description: doc.description,
      reference_id: doc.reference_id || null,
      balance_after: doc.balance_after,
      created_at: doc.created_at
    }));

    return {
      transactions,
      total: transactions.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_driver_earnings (COMPUTED FROM COMPLETED BOOKINGS & LEDGER)
  // -------------------------------------------------------------
  if (action === "get_driver_earnings") {
    const callerProfile = await requireProvider();
    if (callerProfile.role !== "driver") {
      throw new Error("Forbidden: Driver account required to view driver earnings.");
    }
    const callerId = verifiedUser.$id;
    const targetDriverId = data.driver_id || data.driverId || callerId;

    if (targetDriverId !== callerId) {
      throw new Error("Forbidden: You cannot view another driver's earnings.");
    }

    // 1. Fetch completed bookings for this driver
    const dQ = buildEqualQuery("driver_id", callerId);
    const sQ = buildEqualQuery("status", "completed");
    const lQ = buildLimitQuery(100);

    const bRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${dQ}&queries[]=${sQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const bData = await bRes.json();
    const completedBookings = bData.documents || [];

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay());
    firstDayOfWeek.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todaySum = 0;
    let weekSum = 0;
    let monthSum = 0;

    completedBookings.forEach((b) => {
      const price = parseFloat(b.amount || 0);
      const bDate = new Date(b.completed_at || b.created_at);
      const bDateStr = (b.completed_at || b.created_at || "").split("T")[0];

      if (bDateStr === todayStr) todaySum += price;
      if (bDate >= firstDayOfWeek) weekSum += price;
      if (bDate >= firstDayOfMonth) monthSum += price;
    });

    // 2. Fetch available balance from wallet_ledger
    const uQ = buildEqualQuery("user_id", callerId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ1 = buildLimitQuery(1);
    const wRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/wallet_ledger/documents?queries[]=${uQ}&queries[]=${oQ}&queries[]=${lQ1}`,
      { headers: serverHeaders }
    );
    const wData = await wRes.json();
    const latestLedger = wData.documents?.[0];
    const availableBalance = latestLedger ? parseFloat(latestLedger.balance_after || 0.0) : 0.0;

    return {
      driver_id: callerId,
      today: parseFloat(todaySum.toFixed(2)),
      week: parseFloat(weekSum.toFixed(2)),
      month: parseFloat(monthSum.toFixed(2)),
      available: parseFloat(availableBalance.toFixed(2)),
      pending: 0.0,
      totalTrips: completedBookings.length
    };
  }

  throw new Error(`Unknown action: ${action}`);
}

/**
 * Standard Netlify Serverless Function Handler
 */
export async function handler(event, context) {
  // CORS Headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Appwrite-Project, X-Appwrite-JWT",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." })
    };
  }

  try {
    const authHeader =
      event.headers.authorization ||
      event.headers.Authorization ||
      event.headers["x-appwrite-jwt"] ||
      event.headers["X-Appwrite-JWT"] ||
      "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

    let body = {};
    if (event.body) {
      try {
        body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Invalid JSON payload." })
        };
      }
    }

    const { action, data, vehicle_id, request_id } = body;
    const result = await executeTrustedOperation({ action, data, vehicle_id, request_id, jwt });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (err) {
    const isClientError =
      err.message.includes("Privilege escalation blocked") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("Forbidden") ||
      err.message.includes("participant") ||
      err.message.includes("not own") ||
      err.message.includes("Receiver must be") ||
      err.message.includes("Cannot message") ||
      err.message.includes("Message content") ||
      err.message.includes("Message exceeds") ||
      err.message.includes("not found") ||
      err.message.includes("Missing") ||
      err.message.includes("Invalid") ||
      err.message.includes("Conflict") ||
      err.message.includes("is required") ||
      err.message.includes("SUBSCRIPTION_REQUIRED") ||
      err.message.includes("DRIVER_SUBSCRIPTION_REQUIRED") ||
      err.message.includes("Cannot bid") ||
      err.message.includes("Cannot accept") ||
      err.message.includes("Cannot update") ||
      err.message.includes("Cannot withdraw");

    const isForbidden =
      err.message.includes("Forbidden") ||
      err.message.includes("participant") ||
      err.message.includes("not own") ||
      err.message.includes("Receiver must be");

    return {
      statusCode: isClientError
        ? err.message.includes("Unauthorized") ? 401
          : isForbidden ? 403
          : err.message.includes("not found") ? 404
          : err.message.includes("Conflict") ? 409
          : err.message.includes("SUBSCRIPTION_REQUIRED") || err.message.includes("DRIVER_SUBSCRIPTION_REQUIRED") ? 402
          : 400
        : 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
