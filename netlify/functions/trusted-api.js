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

const PROVIDER_ROLES = new Set([
  "driver", "owner", "vehicle_owner", "logistics", "logistics_provider", "machinery_owner"
]);

const PENDING_VERIFICATION_STATUSES = new Set(["pending", "unverified", "submitted"]);
const APPROVED_VERIFICATION_STATUSES = new Set(["approved", "verified"]);

function normalizedVerificationStatus(status, component = "profile") {
  const value = String(status || "unverified").toLowerCase();
  if (APPROVED_VERIFICATION_STATUSES.has(value)) {
    return component === "document" ? "verified" : "approved";
  }
  if (value === "rejected") return "rejected";
  if (value === "expired") return "expired";
  return value === "pending" ? "pending" : "unverified";
}

function effectiveDocumentStatus(document, now = new Date()) {
  if (document?.expires_at && new Date(document.expires_at) < now) return "expired";
  return normalizedVerificationStatus(document?.verification_status, "document");
}

function isExplicitAutomatedTestIdentity(record) {
  const email = String(record?.email || "").trim().toLowerCase();
  const domain = email.split("@")[1] || "";
  return domain === "transmove.test" || domain === "tm.test" || domain.endsWith(".test") ||
    record?.test_mode === true || record?.is_test === true;
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
    const duplicateQueries = [
      buildEqualQuery("user_id", String(userId)),
      buildEqualQuery("type", String(type)),
      buildEqualQuery("related_id", relatedId ? String(relatedId) : ""),
      buildLimitQuery(10)
    ].map((query) => `queries[]=${query}`).join("&");
    const duplicateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/notifications/documents?${duplicateQueries}`,
      { headers: serverHeaders }
    );
    if (duplicateRes.ok) {
      const existing = await duplicateRes.json();
      const exactDuplicate = (existing.documents || []).find((notification) =>
        notification.title === String(title) && notification.message === String(message)
      );
      if (exactDuplicate) return exactDuplicate;
    }

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
  const publicActions = [
    "get_shared_trip",
    "get_public_provider_profile",
    "list_payment_destinations",
    "list_subscription_plans",
    "list_ad_rate_cards",
    "list_ad_packages",
    "calculate_ad_price"
  ];
  let verifiedUser = null;
  if (jwt) {
    try {
      verifiedUser = await authenticateUser(jwt, creds);
    } catch (err) {
      if (!publicActions.includes(action)) throw err;
    }
  } else if (!publicActions.includes(action)) {
    throw new Error("Unauthorized: Authentication token is missing.");
  }
  const userId = verifiedUser?.$id || null;

  async function logActivity({ userId, activityType, title, description, relatedId }) {
    try {
      const payload = {
        user_id: userId || "system",
        activity_type: activityType || "general",
        title: String(title || "").slice(0, 256),
        description: description ? String(description) : "",
        related_id: relatedId || "",
        created_at: new Date().toISOString()
      };
      await fetch(`${creds.endpoint}/databases/transmove/collections/activity_logs/documents`, {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: payload,
          // Activity logs are exposed only through admin-guarded server actions.
          permissions: []
        })
      });
    } catch (err) {
      console.warn("Notice: Failed to record activity log:", err.message);
    }
  }

  let callerProfileCache;
  async function getCallerProfile() {
    if (!userId) return null;
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

  async function markProviderSubmissionPending(profile = null) {
    const providerProfile = profile || await requireProvider();
    if (APPROVED_VERIFICATION_STATUSES.has(String(providerProfile.verification_status || "").toLowerCase())) {
      return providerProfile;
    }
    if (String(providerProfile.verification_status || "").toLowerCase() === "pending") {
      return providerProfile;
    }
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${providerProfile.$id}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            verification_status: "pending",
            verification_rejection_reason: "",
            updated_at: new Date().toISOString()
          }
        })
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Failed to mark provider verification as pending.");
    }
    callerProfileCache = await response.json();
    return callerProfileCache;
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
    const providerProfile = await requireProvider();

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
      verification_status: "pending", // A newly submitted vehicle always requires admin review
      rejection_reason: "",
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
    await markProviderSubmissionPending(providerProfile);

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
    const verificationRelevantFields = [
      "vehicle_type", "make", "model", "year", "registration_number",
      "passenger_capacity", "load_capacity", "load_capacity_kg", "service_category"
    ];
    if (verificationRelevantFields.some((field) => data[field] !== undefined)) {
      safeData.verification_status = "pending";
      safeData.rejection_reason = "";
    }
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
    const providerProfile = await requireProvider();

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

    const submittedFileId = String(data.file_id).trim();
    const fileRes = await fetch(
      `${creds.endpoint}/storage/buckets/transmove-files/files/${submittedFileId}`,
      { headers: serverHeaders }
    );
    if (!fileRes.ok) throw new Error("Verification file not found.");
    const submittedFile = await fileRes.json();
    const ownerReadPermission = `read("user:${derivedUserId}")`;
    if (!(submittedFile.$permissions || []).includes(ownerReadPermission)) {
      throw new Error("Forbidden: The verification file is not owned by the authenticated provider.");
    }

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
      file_id: submittedFileId,
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

    const newDocument = await createRes.json();
    await markProviderSubmissionPending(providerProfile);
    return newDocument;
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
  // ACTION: delete_vehicle_photo (TRUSTED PHOTO RECORD DELETION)
  // -------------------------------------------------------------
  if (action === "delete_vehicle_photo") {
    const driver_id = verifiedUser.$id;
    const photoId = data.photo_id || data.$id;
    if (!photoId) throw new Error("Missing photo_id parameter.");

    const photoRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents/${photoId}`,
      { headers: serverHeaders }
    );
    if (!photoRes.ok) throw new Error("Photo not found.");
    const photo = await photoRes.json();
    if (photo.driver_id !== driver_id) throw new Error("Forbidden: You do not own this photo.");

    if (photo.file_id) {
      await fetch(
        `${creds.endpoint}/storage/buckets/transmove-files/files/${photo.file_id}`,
        { method: "DELETE", headers: serverHeaders }
      ).catch(() => {});
    }

    const delRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents/${photoId}`,
      { method: "DELETE", headers: serverHeaders }
    );
    if (!delRes.ok) throw new Error("Failed to delete vehicle photo record.");

    return { success: true, deleted: photoId };
  }

  // -------------------------------------------------------------
  // ACTION: admin_verify_document (TRUSTED BACKEND/ADMIN OPERATION)
  // -------------------------------------------------------------
  if (action === "admin_verify_document") {
    const documentId = data.document_id || data.$id || vehicle_id;
    if (!documentId) throw new Error("Missing document_id parameter.");

    await requireAdmin();
    const documentRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents/${documentId}`,
      { headers: serverHeaders }
    );
    if (!documentRes.ok) throw new Error("Verification document not found.");
    const document = await documentRes.json();
    const newStatus = normalizedVerificationStatus(data.verification_status || "verified", "document");
    if (!["verified", "rejected"].includes(newStatus)) {
      throw new Error("Invalid document verification status. Use verified or rejected.");
    }
    const rejectionReason = newStatus === "rejected" ? String(data.rejection_reason || "").trim() : "";
    if (newStatus === "rejected" && !rejectionReason) {
      throw new Error("A rejection reason is required.");
    }
    if (
      normalizedVerificationStatus(document.verification_status, "document") === newStatus &&
      String(document.rejection_reason || "") === rejectionReason
    ) {
      return { ...document, idempotent: true };
    }
    const updatePayload = {
      verification_status: newStatus,
      verified_at: newStatus === "verified" ? new Date().toISOString() : null,
      rejection_reason: rejectionReason,
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

    const updatedDocument = await updateRes.json();
    const documentLabel = String(document.document_type || "verification document").replaceAll("_", " ");
    const approved = newStatus === "verified";
    await createNotification(creds, serverHeaders, {
      userId: document.user_id,
      type: approved ? "document_verification_approved" : "document_verification_rejected",
      title: approved ? "Document approved" : "Document needs attention",
      message: approved
        ? `Your ${documentLabel} was approved.`
        : `Your ${documentLabel} was rejected: ${rejectionReason}`,
      relatedId: documentId
    });
    await logActivity({
      userId,
      activityType: approved ? "document_verification_approved" : "document_verification_rejected",
      title: approved ? "Verification document approved" : "Verification document rejected",
      description: `Admin ${userId} ${approved ? "approved" : "rejected"} document ${documentId} for provider ${document.user_id}${approved ? "" : `: ${rejectionReason}`}. Result: success.`,
      relatedId: documentId
    });
    return updatedDocument;
  }

  // -------------------------------------------------------------
  // ACTION: admin_verify_vehicle (TRUSTED BACKEND/ADMIN OPERATION)
  // -------------------------------------------------------------
  if (action === "admin_verify_vehicle") {
    const targetVehId = vehicle_id || data.vehicle_id;
    if (!targetVehId) throw new Error("Missing vehicle_id parameter.");

    await requireAdmin();
    const vehicleRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${targetVehId}`,
      { headers: serverHeaders }
    );
    if (!vehicleRes.ok) throw new Error("Vehicle not found.");
    const vehicle = await vehicleRes.json();
    const newStatus = normalizedVerificationStatus(data.verification_status || "approved", "vehicle");
    if (!["approved", "rejected"].includes(newStatus)) {
      throw new Error("Invalid vehicle verification status. Use approved or rejected.");
    }
    const rejectionReason = newStatus === "rejected" ? String(data.rejection_reason || "").trim() : "";
    if (newStatus === "rejected" && !rejectionReason) {
      throw new Error("A rejection reason is required.");
    }
    if (
      normalizedVerificationStatus(vehicle.verification_status, "vehicle") === newStatus &&
      String(vehicle.rejection_reason || "") === rejectionReason
    ) {
      return { ...vehicle, idempotent: true };
    }
    const updateRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${targetVehId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            verification_status: newStatus,
            rejection_reason: rejectionReason,
            updated_at: new Date().toISOString()
          }
        })
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || "Failed to update vehicle verification status.");
    }

    const updatedVehicle = await updateRes.json();
    const approved = newStatus === "approved";
    const vehicleLabel = [vehicle.make, vehicle.model, vehicle.registration_number].filter(Boolean).join(" ");
    await createNotification(creds, serverHeaders, {
      userId: vehicle.driver_id,
      type: approved ? "vehicle_verification_approved" : "vehicle_verification_rejected",
      title: approved ? "Vehicle approved" : "Vehicle needs attention",
      message: approved
        ? `Your vehicle ${vehicle.registration_number || vehicleLabel} was approved.`
        : `Your vehicle ${vehicle.registration_number || vehicleLabel} was rejected: ${rejectionReason}`,
      relatedId: targetVehId
    });
    await logActivity({
      userId,
      activityType: approved ? "vehicle_verification_approved" : "vehicle_verification_rejected",
      title: approved ? "Vehicle approved" : "Vehicle rejected",
      description: `Admin ${userId} ${approved ? "approved" : "rejected"} vehicle ${targetVehId} (${vehicleLabel}) for provider ${vehicle.driver_id}${approved ? "" : `: ${rejectionReason}`}. Result: success.`,
      relatedId: targetVehId
    });
    return updatedVehicle;
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
      ["confirmed", "driver_arriving", "arrived", "in_progress", "completed"].includes(b.status)
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
      estimated_arrival_minutes: Math.max(1, parseInt(data.estimated_arrival_mins || data.estimated_arrival_minutes || 15, 10)),
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

      if (reqDoc.status === "bids_received") {
        const normalizeRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
          {
            method: "PATCH",
            headers: serverHeaders,
            body: JSON.stringify({ data: { status: "open_for_bids", updated_at: new Date().toISOString() } })
          }
        );
        if (!normalizeRes.ok) console.warn("Could not normalize legacy bids_received request state.");
      }

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

    // 12. Keep the request open_for_bids while quotations are pending. Bid
    // presence is derived from the bids collection rather than duplicated in
    // the request status.
    if (reqDoc.status === "bids_received") {
      const normalizeRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${targetReqId}`,
        {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({ data: { status: "open_for_bids", updated_at: new Date().toISOString() } })
        }
      );
      if (!normalizeRes.ok) console.warn("Could not normalize legacy bids_received request state.");
    }

    // 13. Notify the passenger about the new bid
    await createNotification(creds, serverHeaders, {
      userId: reqDoc.passenger_id,
      type: "bid_received",
      title: "New quotation received",
      message: `A driver has submitted a quotation of $${parseFloat(bidPayload.amount).toFixed(2)} on your request.`,
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
      ["confirmed", "driver_arriving", "arrived", "in_progress", "completed"].includes(b.status)
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

    // 4. Load competing bids before starting the short-lived transaction.
    const allBidQ = buildEqualQuery("request_id", bidDoc.request_id);
    const allBidsRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bids/documents?queries[]=${allBidQ}`,
      { headers: serverHeaders }
    );
    const allBidsData = await allBidsRes.json();
    const competingBids = (allBidsData.documents || []).filter(
      (b) => b.$id !== bidId && b.status === "pending"
    );

    // 5. Stage the accepted bid, rejected competitors, accepted request and
    // booking in one real Appwrite database transaction. The unique booking
    // request_id index is the final concurrency guard against double accepts.
    const finalPrice = bidDoc.amount || 0;
    const tripPin = String(Math.floor(1000 + Math.random() * 9000));
    const bookingId = `booking_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const nowIso = new Date().toISOString();
    const bookingPayload = {
      request_id: bidDoc.request_id,
      accepted_bid_id: bidId,
      passenger_id: passengerId,
      driver_id: driverId,
      vehicle_id: bidDoc.vehicle_id || "unknown",
      amount: finalPrice,
      trip_pin: tripPin,
      status: "confirmed",
      created_at: nowIso,
      updated_at: nowIso
    };

    const txRes = await fetch(`${creds.endpoint}/databases/transactions`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({})
    });
    if (!txRes.ok) {
      const err = await txRes.json().catch(() => ({}));
      throw new Error(err.message || "Failed to start bid acceptance transaction.");
    }
    const transaction = await txRes.json();
    const transactionId = transaction.$id;

    try {
      const stageDocument = async (url, method, payload) => {
        const response = await fetch(url, {
          method,
          headers: serverHeaders,
          body: JSON.stringify({ ...payload, transactionId })
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || "Failed to stage bid acceptance operation.");
        }
      };

      await stageDocument(
        `${creds.endpoint}/databases/transmove/collections/bids/documents/${bidId}`,
        "PATCH",
        { data: { status: "accepted", updated_at: nowIso } }
      );

      for (const competingBid of competingBids) {
        await stageDocument(
          `${creds.endpoint}/databases/transmove/collections/bids/documents/${competingBid.$id}`,
          "PATCH",
          { data: { status: "rejected", updated_at: nowIso } }
        );
      }

      await stageDocument(
        `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bidDoc.request_id}`,
        "PATCH",
        { data: { status: "accepted", updated_at: nowIso } }
      );

      await stageDocument(
        `${creds.endpoint}/databases/transmove/collections/bookings/documents`,
        "POST",
        {
          documentId: bookingId,
          data: bookingPayload,
          permissions: [
            `read("user:${passengerId}")`,
            `read("user:${driverId}")`
          ]
        }
      );

      const commitRes = await fetch(`${creds.endpoint}/databases/transactions/${transactionId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ commit: true })
      });
      const commitData = await commitRes.json().catch(() => ({}));
      if (!commitRes.ok || commitData.status !== "committed") {
        throw new Error(commitData.message || "Bid acceptance transaction could not be committed.");
      }
    } catch (error) {
      await fetch(`${creds.endpoint}/databases/transactions/${transactionId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ rollback: true })
      }).catch(() => {});
      throw error;
    }

    const bookingRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bookingRes.ok) throw new Error("Booking was committed but could not be reloaded.");
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
      bid: { ...bidDoc, status: "accepted", updated_at: nowIso },
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
        trip_pin: undefined,
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
  // Allowed driver transitions: confirmed→driver_arriving→arrived→in_progress→completed
  // Allowed passenger transitions: confirmed→cancelled (with reason)
  // -------------------------------------------------------------
  if (action === "update_booking_status") {
    const callerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const newStatus = data.status;
    const validStatuses = ["driver_arriving", "arrived", "in_progress", "completed", "cancelled"];
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

    // Business rules: passengers can only cancel before the journey begins.
    if (isPassenger && newStatus !== "cancelled") {
      throw new Error("Passengers may only cancel a booking.");
    }
    if (isPassenger && !["confirmed", "driver_arriving"].includes(bkDoc.status)) {
      throw new Error(`Passengers cannot cancel a booking with status '${bkDoc.status}'.`);
    }

    // Drivers cannot cancel via this action (use a separate cancellation flow)
    if (isDriver && newStatus === "cancelled") {
      throw new Error("Driver cancellation is not permitted via this action.");
    }

    if (bkDoc.status === "completed" || bkDoc.status === "cancelled") {
      throw new Error(`Cannot update a booking that is already '${bkDoc.status}'.`);
    }

    if (isDriver) {
      const allowedDriverTransitions = {
        confirmed: ["driver_arriving"],
        driver_arriving: ["arrived", "in_progress"], // direct PIN start retained for legacy clients
        arrived: ["in_progress"],
        in_progress: ["completed"]
      };
      if (!(allowedDriverTransitions[bkDoc.status] || []).includes(newStatus)) {
        throw new Error(`Invalid booking transition '${bkDoc.status}' → '${newStatus}'.`);
      }
    }

    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === "in_progress") {
      if (bkDoc.trip_pin) {
        const suppliedPin = String(data.pin || data.trip_pin || "").trim();
        if (!suppliedPin || suppliedPin !== String(bkDoc.trip_pin)) {
          throw new Error("Invalid Trip PIN. Please ask the passenger for their 4-digit trip PIN.");
        }
      }
      updateData.started_at = new Date().toISOString();
    }

    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    if (newStatus === "cancelled") {
      const reasonCategory = data.reason || data.cancellation_reason || "other";
      const reasonNotes = data.notes || data.details || "";
      const fullReason = reasonNotes ? `${reasonCategory}: ${reasonNotes}` : reasonCategory;
      updateData.cancellation_reason = fullReason;
      updateData.cancelled_by = callerId;
      updateData.cancelled_at = new Date().toISOString();
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

    // Audit booking status changes
    if (newStatus === "cancelled") {
      await fetch(`${creds.endpoint}/databases/transmove/collections/booking_events/documents`, {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: {
            booking_id: bookingId,
            user_id: callerId,
            event_type: "cancelled",
            old_status: bkDoc.status,
            new_status: "cancelled",
            notes: updateData.cancellation_reason,
            created_at: new Date().toISOString()
          },
          permissions: [`read("users")`]
        })
      }).catch(() => {});

      await logActivity({
        userId: callerId,
        activityType: "booking_cancelled",
        title: "Booking Cancelled",
        description: `Booking #${bookingId.slice(0, 8)} cancelled. Reason: ${updateData.cancellation_reason}`,
        relatedId: bookingId
      });
    }

    // Notify the other party about status change
    const targetUserId = isDriver ? bkDoc.passenger_id : bkDoc.driver_id;
    let notifTitle = "Booking Update";
    let notifMsg = `Booking status changed to '${newStatus}'.`;

    if (newStatus === "driver_arriving") {
      notifTitle = "Your driver is on the way";
      notifMsg = "Your driver is on the way to the pickup location.";
    } else if (newStatus === "arrived") {
      notifTitle = "Your driver has arrived";
      notifMsg = "Your driver has arrived at the pickup location. Share the Trip PIN when you are ready to begin.";
    } else if (newStatus === "in_progress") {
      notifTitle = "Your journey has started";
      notifMsg = "Your journey is now in progress.";
    } else if (newStatus === "completed") {
      notifTitle = "Journey completed";
      notifMsg = "Your journey has been completed. Thank you for travelling with TransMove!";
    } else if (newStatus === "cancelled") {
      notifTitle = "Booking Cancelled";
      notifMsg = `The booking was cancelled by the ${isDriver ? "driver" : "passenger"}.`;
    }

    await createNotification(creds, serverHeaders, {
      userId: targetUserId,
      type: newStatus === "driver_arriving"
        ? "driver_en_route"
        : newStatus === "arrived"
          ? "driver_arrived"
          : newStatus === "in_progress"
            ? "journey_started"
            : newStatus === "completed"
              ? "journey_completed"
              : "booking_status_changed",
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
      ["confirmed", "driver_arriving", "arrived", "in_progress", "completed"].includes(b.status)
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
    const [profileData, documents, bookingData, payments] = await Promise.all([
      list("profiles", [buildLimitQuery(100)]),
      list("verification_documents", [buildEqualQuery("verification_status", "pending"), buildLimitQuery(100)]),
      list("bookings", [buildLimitQuery(100)]),
      list("payments", [buildEqualQuery("status", "paid"), buildLimitQuery(100)])
    ]);
    const profiles = (profileData.documents || []).filter((profile) => !isExplicitAutomatedTestIdentity(profile));
    const realUserIds = new Set(profiles.map((profile) => profile.user_id));
    const bookings = (bookingData.documents || []).filter((booking) =>
      realUserIds.has(booking.passenger_id) && realUserIds.has(booking.driver_id)
    );
    const realBookingIds = new Set(bookings.map((booking) => booking.$id));
    const realPayments = (payments.documents || []).filter((payment) =>
      realUserIds.has(payment.user_id) && (!payment.booking_id || realBookingIds.has(payment.booking_id))
    );
    const pendingDocuments = (documents.documents || []).filter((document) => realUserIds.has(document.user_id));
    const totalRevenue = realPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return {
      totalUsers: profiles.length,
      totalDrivers: profiles.filter((profile) => PROVIDER_ROLES.has(profile.role)).length,
      pendingVerifications: pendingDocuments.length,
      totalBookings: bookings.length,
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
      users: (result.documents || []).filter((profile) => !isExplicitAutomatedTestIdentity(profile)).map((profile) => ({
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
    const requestedFilter = String(data.status_filter || data.filter || "pending").toLowerCase();
    if (!["pending", "verified", "approved", "rejected", "expired", "all"].includes(requestedFilter)) {
      throw new Error("Invalid verification queue filter.");
    }
    const profileRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!profileRes.ok) throw new Error("Unable to load verification queue.");
    const profileData = await profileRes.json();
    const profiles = (profileData.documents || []).filter((profile) =>
      PROVIDER_ROLES.has(profile.role) && !isExplicitAutomatedTestIdentity(profile)
    );
    const queue = await Promise.all(profiles.map(async (profile) => {
      const userQuery = buildEqualQuery("driver_id", profile.user_id);
      const docQuery = buildEqualQuery("user_id", profile.user_id);
      const [vehicleRes, documentRes, photoRes] = await Promise.all([
        fetch(`${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${userQuery}`, { headers: serverHeaders }),
        fetch(`${creds.endpoint}/databases/transmove/collections/verification_documents/documents?queries[]=${docQuery}`, { headers: serverHeaders }),
        fetch(`${creds.endpoint}/databases/transmove/collections/vehicle_photos/documents?queries[]=${userQuery}`, { headers: serverHeaders })
      ]);
      const vehicleData = vehicleRes.ok ? await vehicleRes.json() : { documents: [] };
      const documentData = documentRes.ok ? await documentRes.json() : { documents: [] };
      const photoData = photoRes.ok ? await photoRes.json() : { documents: [] };
      const vehicles = vehicleData.documents || [];
      const documents = documentData.documents || [];
      const photos = photoData.documents || [];
      const timestamps = [profile.created_at, ...vehicles.map((item) => item.created_at), ...documents.map((item) => item.created_at)]
        .filter(Boolean)
        .map((value) => new Date(value).getTime())
        .filter(Number.isFinite);
      const submissionDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : profile.created_at;
      return {
        id: profile.$id,
        user_id: profile.user_id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone || "",
        role: profile.role,
        profile_image_id: profile.profile_image_id || "",
        profile_image_url: profile.profile_image_id
          ? `${creds.endpoint}/storage/buckets/transmove-files/files/${profile.profile_image_id}/view?project=${creds.projectId}`
          : "",
        verification_status: normalizedVerificationStatus(profile.verification_status, "profile"),
        rejection_reason: profile.verification_rejection_reason || "",
        account_status: profile.account_status,
        submitted_at: submissionDate,
        vehicles: vehicles.map((vehicle) => ({
          id: vehicle.$id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          registration_number: vehicle.registration_number,
          service_category: vehicle.service_category,
          verification_status: normalizedVerificationStatus(vehicle.verification_status, "vehicle"),
          rejection_reason: vehicle.rejection_reason || "",
          created_at: vehicle.created_at,
          photos: photos.filter((photo) => photo.vehicle_id === vehicle.$id).map((photo) => ({
            id: photo.$id,
            is_primary: photo.is_primary,
            view_url: `${creds.endpoint}/storage/buckets/transmove-files/files/${photo.file_id}/view?project=${creds.projectId}`
          }))
        })),
        documents: documents.map((document) => ({
          id: document.$id,
          document_type: document.document_type,
          vehicle_id: document.vehicle_id || null,
          verification_status: effectiveDocumentStatus(document),
          stored_verification_status: normalizedVerificationStatus(document.verification_status, "document"),
          rejection_reason: document.rejection_reason || "",
          created_at: document.created_at,
          expires_at: document.expires_at || null,
          has_file: Boolean(document.file_id)
        }))
      };
    }));
    const matchesFilter = (provider) => {
      const profileStatus = provider.verification_status;
      const vehicleStatuses = provider.vehicles.map((vehicle) => vehicle.verification_status);
      const documentStatuses = provider.documents.map((document) => document.verification_status);
      if (requestedFilter === "all") return true;
      if (requestedFilter === "pending") {
        return PENDING_VERIFICATION_STATUSES.has(profileStatus) ||
          vehicleStatuses.some((status) => PENDING_VERIFICATION_STATUSES.has(status)) ||
          documentStatuses.some((status) => PENDING_VERIFICATION_STATUSES.has(status));
      }
      if (["verified", "approved"].includes(requestedFilter)) {
        return APPROVED_VERIFICATION_STATUSES.has(profileStatus) ||
          vehicleStatuses.some((status) => APPROVED_VERIFICATION_STATUSES.has(status)) ||
          documentStatuses.some((status) => APPROVED_VERIFICATION_STATUSES.has(status));
      }
      if (requestedFilter === "rejected") {
        return profileStatus === "rejected" || vehicleStatuses.includes("rejected") || documentStatuses.includes("rejected");
      }
      return documentStatuses.includes("expired");
    };
    const filteredQueue = queue.filter(matchesFilter);
    const summary = {
      pending_providers: queue.filter((provider) => PENDING_VERIFICATION_STATUSES.has(provider.verification_status)).length,
      pending_vehicles: queue.reduce((sum, provider) => sum + provider.vehicles.filter((vehicle) => PENDING_VERIFICATION_STATUSES.has(vehicle.verification_status)).length, 0),
      pending_documents: queue.reduce((sum, provider) => sum + provider.documents.filter((document) => PENDING_VERIFICATION_STATUSES.has(document.verification_status)).length, 0),
      expired_documents: queue.reduce((sum, provider) => sum + provider.documents.filter((document) => document.verification_status === "expired").length, 0),
      verified_providers: queue.filter((provider) => APPROVED_VERIFICATION_STATUSES.has(provider.verification_status)).length,
      rejected_providers: queue.filter((provider) => provider.verification_status === "rejected").length
    };
    return { verifications: filteredQueue, total: filteredQueue.length, summary, filter: requestedFilter };
  }

  if (action === "admin_set_profile_verification") {
    await requireAdmin();
    const profileId = data.profile_id || data.profileId;
    const status = data.verification_status || data.status;
    if (!profileId) throw new Error("Missing profile_id parameter.");
    const normalizedStatus = normalizedVerificationStatus(status, "profile");
    if (!["approved", "rejected"].includes(normalizedStatus)) throw new Error("Invalid profile verification status.");
    const rejectionReason = normalizedStatus === "rejected" ? String(data.reason || data.rejection_reason || "").trim() : "";
    if (normalizedStatus === "rejected" && !rejectionReason) throw new Error("A rejection reason is required.");
    const currentRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${profileId}`,
      { headers: serverHeaders }
    );
    if (!currentRes.ok) throw new Error("Provider profile not found.");
    const currentProfile = await currentRes.json();
    if (!PROVIDER_ROLES.has(currentProfile.role)) throw new Error("Invalid verification target: provider profile required.");
    if (
      normalizedVerificationStatus(currentProfile.verification_status, "profile") === normalizedStatus &&
      String(currentProfile.verification_rejection_reason || "") === rejectionReason
    ) {
      return { ...currentProfile, idempotent: true };
    }
    const response = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents/${profileId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: {
          verification_status: normalizedStatus,
          verification_rejection_reason: rejectionReason,
          updated_at: new Date().toISOString()
        } })
      }
    );
    if (!response.ok) throw new Error("Failed to update profile verification status.");
    const updatedProfile = await response.json();
    const approved = normalizedStatus === "approved";
    await createNotification(creds, serverHeaders, {
      userId: currentProfile.user_id,
      type: approved ? "provider_verification_approved" : "provider_verification_rejected",
      title: approved ? "Driver account approved" : "Driver verification needs attention",
      message: approved
        ? "Your driver account has been approved."
        : `Your driver account was rejected: ${rejectionReason}`,
      relatedId: profileId
    });
    await logActivity({
      userId,
      activityType: approved ? "provider_verification_approved" : "provider_verification_rejected",
      title: approved ? "Provider approved" : "Provider rejected",
      description: `Admin ${userId} ${approved ? "approved" : "rejected"} provider ${currentProfile.user_id}${approved ? "" : `: ${rejectionReason}`}. Result: success.`,
      relatedId: profileId
    });
    return updatedProfile;
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

    // 1. Calculate free jobs used / remaining
    const bookQ = buildEqualQuery("driver_id", callerId);
    const bookRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${bookQ}`,
      { headers: serverHeaders }
    );
    const bookData = bookRes.ok ? await bookRes.json() : { documents: [] };
    const totalAwardedJobs = (bookData.documents || []).filter((b) =>
      ["confirmed", "driver_arriving", "arrived", "in_progress", "completed"].includes(b.status)
    ).length;
    const freeJobsUsed = Math.min(5, totalAwardedJobs);
    const freeJobsRemaining = Math.max(0, 5 - totalAwardedJobs);

    // 2. Fetch user's subscription records
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
        subscription_id: activeSub.$id,
        total_awarded_jobs: totalAwardedJobs,
        free_jobs_used: freeJobsUsed,
        free_jobs_remaining: freeJobsRemaining,
        free_jobs_total: 5,
        free_jobs_quota: 5,
        requires_subscription: false
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
        subscription_id: latestSub.$id,
        total_awarded_jobs: totalAwardedJobs,
        free_jobs_used: freeJobsUsed,
        free_jobs_remaining: freeJobsRemaining,
        free_jobs_total: 5,
        free_jobs_quota: 5,
        requires_subscription: totalAwardedJobs >= 5
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
      subscription_id: null,
      total_awarded_jobs: totalAwardedJobs,
      free_jobs_used: freeJobsUsed,
      free_jobs_remaining: freeJobsRemaining,
      free_jobs_total: 5,
      free_jobs_quota: 5,
      requires_subscription: totalAwardedJobs >= 5
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
      related_id: doc.related_id || null,
      payment_destination_id: doc.payment_destination_id || null,
      recipient_name: doc.recipient_name || "",
      recipient_number: doc.recipient_number || "",
      sender_name: doc.sender_name || "",
      sender_phone: doc.sender_phone || "",
      transaction_reference: doc.transaction_reference || doc.provider_reference || "",
      proof_file_id: doc.proof_file_id || null,
      amount_expected: doc.amount_expected || doc.amount,
      amount_declared: doc.amount_declared || doc.amount,
      reviewed_at: doc.reviewed_at || null,
      reviewed_by: doc.reviewed_by || null,
      rejection_reason: doc.rejection_reason || null,
      created_at: doc.created_at,
      paid_at: doc.paid_at || null
    }));

    return {
      payments,
      total: payments.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: list_payment_destinations (PUBLIC / ALL USERS)
  // -------------------------------------------------------------
  if (action === "list_payment_destinations") {
    const actQ = buildEqualQuery("active", true);
    const ordQ = buildOrderAscQuery("display_order");
    const limQ = buildLimitQuery(20);

    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payment_destinations/documents?queries[]=${actQ}&queries[]=${ordQ}&queries[]=${limQ}`,
      { headers: serverHeaders }
    );
    const result = await res.json();
    const destinations = (result.documents || []).map((d) => ({
      id: d.$id,
      $id: d.$id,
      payment_method: d.payment_method,
      account_name: d.account_name,
      account_number: d.account_number,
      active: Boolean(d.active),
      display_order: d.display_order || 0
    }));
    return { destinations, total: destinations.length };
  }

  // -------------------------------------------------------------
  // ACTION: admin_manage_payment_destination (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_manage_payment_destination") {
    await requireAdmin();
    const op = data.operation || "list";

    if (op === "list") {
      const ordQ = buildOrderAscQuery("display_order");
      const limQ = buildLimitQuery(50);
      const res = await fetch(
        `${creds.endpoint}/databases/transmove/collections/payment_destinations/documents?queries[]=${ordQ}&queries[]=${limQ}`,
        { headers: serverHeaders }
      );
      const result = await res.json();
      return { destinations: result.documents || [], total: result.total || 0 };
    }

    if (op === "create") {
      if (!data.account_name || !data.account_number) {
        throw new Error("Missing required destination fields (account_name, account_number).");
      }
      const now = new Date().toISOString();
      const payload = {
        payment_method: data.payment_method || "ecocash",
        account_name: String(data.account_name).trim(),
        account_number: String(data.account_number).trim(),
        active: data.active !== undefined ? Boolean(data.active) : true,
        display_order: parseInt(data.display_order, 10) || 0,
        created_at: now,
        updated_at: now
      };
      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/payment_destinations/documents`, {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({ documentId: "unique()", data: payload, permissions: [] })
      });
      const created = await res.json();
      await logActivity({
        userId: verifiedUser.$id,
        activityType: "destination_created",
        title: `Payment Destination Created: ${payload.account_name}`,
        description: `Admin created ${payload.payment_method} destination ${payload.account_number}`,
        relatedId: created.$id
      });
      return created;
    }

    if (op === "update") {
      const destId = data.destination_id || data.id;
      if (!destId) throw new Error("Missing destination_id for update.");
      const updateData = { updated_at: new Date().toISOString() };
      if (data.account_name) updateData.account_name = String(data.account_name).trim();
      if (data.account_number) updateData.account_number = String(data.account_number).trim();
      if (data.payment_method) updateData.payment_method = String(data.payment_method).trim();
      if (data.active !== undefined) updateData.active = Boolean(data.active);
      if (data.display_order !== undefined) updateData.display_order = parseInt(data.display_order, 10);

      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/payment_destinations/documents/${destId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updateData })
      });
      return await res.json();
    }

    if (op === "toggle_active") {
      const destId = data.destination_id || data.id;
      if (!destId) throw new Error("Missing destination_id for toggle.");
      const currentRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payment_destinations/documents/${destId}`, { headers: serverHeaders });
      const current = await currentRes.json();
      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/payment_destinations/documents/${destId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { active: !current.active, updated_at: new Date().toISOString() } })
      });
      return await res.json();
    }

    if (op === "delete") {
      const destId = data.destination_id || data.id;
      if (!destId) throw new Error("Missing destination_id for delete.");
      await fetch(`${creds.endpoint}/databases/transmove/collections/payment_destinations/documents/${destId}`, {
        method: "DELETE",
        headers: serverHeaders
      });
      return { success: true, deleted: destId };
    }

    throw new Error(`Unsupported destination operation: ${op}`);
  }

  // -------------------------------------------------------------
  // ACTION: list_subscription_plans (PUBLIC / ALL USERS)
  // -------------------------------------------------------------
  if (action === "list_subscription_plans") {
    let queries = [buildOrderAscQuery("display_order"), buildLimitQuery(50)];
    if (!data.include_all) {
      queries.unshift(buildEqualQuery("active", true));
    }
    const queryString = queries.map(q => `queries[]=${q}`).join("&");
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/subscription_plans/documents?${queryString}`,
      { headers: serverHeaders }
    );
    const result = await res.json();
    const plans = (result.documents || []).map((p) => ({
      id: p.$id,
      $id: p.$id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      currency: p.currency || "USD",
      duration_days: p.duration_days,
      active: Boolean(p.active),
      display_order: p.display_order || 0,
      recommended: Boolean(p.recommended),
      features: p.features ? (typeof p.features === "string" ? (() => { try { return JSON.parse(p.features); } catch (_) { return [p.features]; } })() : p.features) : []
    }));
    return { plans, total: plans.length };
  }

  // -------------------------------------------------------------
  // ACTION: admin_manage_subscription_plan (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_manage_subscription_plan") {
    await requireAdmin();
    const op = data.operation || "list";

    if (op === "create") {
      if (!data.name || !data.slug || data.price === undefined || !data.duration_days) {
        throw new Error("Missing required plan fields (name, slug, price, duration_days).");
      }
      const now = new Date().toISOString();
      const payload = {
        name: String(data.name).trim(),
        slug: String(data.slug).trim().toLowerCase(),
        description: data.description ? String(data.description).trim() : "",
        price: parseFloat(data.price),
        currency: data.currency || "USD",
        duration_days: parseInt(data.duration_days, 10),
        active: data.active !== undefined ? Boolean(data.active) : true,
        display_order: parseInt(data.display_order, 10) || 0,
        recommended: Boolean(data.recommended),
        features: Array.isArray(data.features) ? JSON.stringify(data.features) : (data.features || ""),
        created_at: now,
        updated_at: now
      };
      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents`, {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({ documentId: "unique()", data: payload, permissions: [] })
      });
      const created = await res.json();
      await logActivity({
        userId: verifiedUser.$id,
        activityType: "plan_created",
        title: `Subscription Plan Created: ${payload.name}`,
        description: `Admin created plan ${payload.slug} at $${payload.price} for ${payload.duration_days} days`,
        relatedId: created.$id
      });
      return created;
    }

    if (op === "update") {
      const planId = data.plan_id || data.id;
      if (!planId) throw new Error("Missing plan_id for update.");
      const updateData = { updated_at: new Date().toISOString() };
      if (data.name) updateData.name = String(data.name).trim();
      if (data.description !== undefined) updateData.description = String(data.description).trim();
      if (data.price !== undefined) updateData.price = parseFloat(data.price);
      if (data.duration_days !== undefined) updateData.duration_days = parseInt(data.duration_days, 10);
      if (data.active !== undefined) updateData.active = Boolean(data.active);
      if (data.display_order !== undefined) updateData.display_order = parseInt(data.display_order, 10);
      if (data.recommended !== undefined) updateData.recommended = Boolean(data.recommended);
      if (data.features !== undefined) {
        updateData.features = Array.isArray(data.features) ? JSON.stringify(data.features) : String(data.features);
      }

      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${planId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updateData })
      });
      return await res.json();
    }

    if (op === "toggle_active") {
      const planId = data.plan_id || data.id;
      if (!planId) throw new Error("Missing plan_id for toggle.");
      const currentRes = await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${planId}`, { headers: serverHeaders });
      const current = await currentRes.json();
      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${planId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: { active: !current.active, updated_at: new Date().toISOString() } })
      });
      return await res.json();
    }

    if (op === "delete") {
      const planId = data.plan_id || data.id;
      if (!planId) throw new Error("Missing plan_id for delete.");
      await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${planId}`, {
        method: "DELETE",
        headers: serverHeaders
      });
      return { success: true, deleted: planId };
    }

    throw new Error(`Unsupported plan operation: ${op}`);
  }

  // -------------------------------------------------------------
  // ACTION: submit_ecocash_payment (AUTHENTICATED MANUAL SUBMISSION)
  // -------------------------------------------------------------
  if (action === "submit_ecocash_payment") {
    if (!verifiedUser) throw new Error("Unauthorized: You must be logged in to submit a payment.");
    const callerId = verifiedUser.$id;

    // Reject client attempting to set status
    if (data.status && data.status !== "pending_review") {
      throw new Error("Privilege escalation blocked: Cannot set payment status directly.");
    }

    const {
      payment_type,
      related_id,
      payment_destination_id,
      sender_name,
      sender_phone,
      transaction_reference,
      proof_file_id,
      amount_declared
    } = data;

    if (!payment_type || !["subscription", "advertising", "booking"].includes(payment_type)) {
      throw new Error("Invalid payment_type. Must be 'subscription', 'advertising', or 'booking'.");
    }
    if (!payment_destination_id) throw new Error("payment_destination_id is required.");
    if (!sender_name || !String(sender_name).trim()) throw new Error("sender_name is required.");
    if (!sender_phone || !String(sender_phone).trim()) throw new Error("sender_phone is required.");
    if (!transaction_reference || !String(transaction_reference).trim()) {
      throw new Error("transaction_reference is required.");
    }
    if (!proof_file_id || !String(proof_file_id).trim()) {
      throw new Error("proof_file_id (proof of payment screenshot) is required.");
    }

    // 1. Validate destination & resolve recipient strictly from server database
    const destRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payment_destinations/documents/${payment_destination_id}`,
      { headers: serverHeaders }
    );
    if (!destRes.ok) {
      throw new Error("Invalid payment destination: Destination not found.");
    }
    const destination = await destRes.json();
    if (!destination.active) {
      throw new Error("Invalid payment destination: Selected destination is currently inactive.");
    }

    const recipientName = destination.account_name;
    const recipientNumber = destination.account_number;

    // 2. Server-side expected amount calculation
    let amountExpected = 0.0;
    let targetRelatedId = related_id || "";

    if (payment_type === "subscription") {
      let planDoc = null;
      if (targetRelatedId) {
        const byId = await fetch(
          `${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${targetRelatedId}`,
          { headers: serverHeaders }
        );
        if (byId.ok) {
          planDoc = await byId.json();
        } else {
          const slugQ = buildEqualQuery("slug", targetRelatedId);
          const bySlug = await fetch(
            `${creds.endpoint}/databases/transmove/collections/subscription_plans/documents?queries[]=${slugQ}`,
            { headers: serverHeaders }
          );
          if (bySlug.ok) {
            const slugData = await bySlug.json();
            planDoc = slugData.documents?.[0] || null;
          }
        }
      }

      if (!planDoc || !planDoc.active) {
        throw new Error("Invalid subscription plan: Plan not found or inactive.");
      }
      targetRelatedId = planDoc.$id;
      amountExpected = parseFloat(planDoc.price);
    } else if (payment_type === "advertising") {
      if (!targetRelatedId) throw new Error("related_id (campaign ID) is required for advertising payments.");
      const campRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${targetRelatedId}`,
        { headers: serverHeaders }
      );
      if (!campRes.ok) throw new Error("Ad campaign not found.");
      const campaign = await campRes.json();
      if (campaign.user_id !== callerId) {
        throw new Error("Forbidden: You cannot pay for another user's ad campaign.");
      }
      amountExpected = parseFloat(campaign.amount_expected);
    } else if (payment_type === "booking") {
      if (!targetRelatedId) throw new Error("related_id (booking ID) is required for booking payments.");
      const bookRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/bookings/documents/${targetRelatedId}`,
        { headers: serverHeaders }
      );
      if (!bookRes.ok) throw new Error("Booking not found.");
      const booking = await bookRes.json();
      amountExpected = parseFloat(booking.amount);
    }

    if (amountExpected <= 0) {
      throw new Error("Invalid expected payment amount.");
    }

    const cleanRef = String(transaction_reference).trim().toUpperCase();

    // 3. Duplicate approved reference check
    const refQ = buildEqualQuery("transaction_reference", cleanRef);
    const statQ = buildEqualQuery("status", "approved");
    const checkDup = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${refQ}&queries[]=${statQ}`,
      { headers: serverHeaders }
    );
    if (checkDup.ok) {
      const dupData = await checkDup.json();
      if ((dupData.documents || []).length > 0) {
        throw new Error("Conflict: This EcoCash transaction reference has already been verified for an approved payment.");
      }
    }

    // 4. Create payment record (strictly status: pending_review)
    const now = new Date().toISOString();
    const paymentRef = `ECO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const paymentPayload = {
      user_id: callerId,
      booking_id: payment_type === "booking" ? targetRelatedId : null,
      subscription_id: payment_type === "subscription" ? targetRelatedId : null,
      related_id: targetRelatedId,
      payment_type: payment_type,
      reference: paymentRef,
      provider: "ecocash",
      provider_reference: cleanRef,
      transaction_reference: cleanRef,
      payment_destination_id: destination.$id,
      recipient_name: recipientName,
      recipient_number: recipientNumber,
      sender_name: String(sender_name).trim(),
      sender_phone: String(sender_phone).trim(),
      proof_file_id: String(proof_file_id).trim(),
      amount: amountExpected,
      amount_expected: amountExpected,
      amount_declared: amount_declared !== undefined ? parseFloat(amount_declared) : amountExpected,
      currency: "USD",
      status: "pending_review",
      poll_url: null,
      created_at: now,
      paid_at: null,
      updated_at: now
    };

    const createRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({
        documentId: "unique()",
        data: paymentPayload,
        permissions: []
      })
    });

    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(errBody.message || "Failed to record EcoCash payment submission.");
    }

    const createdPayment = await createRes.json();

    // Link payment to ad campaign if advertising
    if (payment_type === "advertising" && targetRelatedId) {
      await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${targetRelatedId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            payment_id: createdPayment.$id,
            status: "pending_review",
            updated_at: now
          }
        })
      }).catch((e) => console.warn("Notice: Failed to link ad campaign to payment:", e.message));
    }

    // Activity Log
    await logActivity({
      userId: callerId,
      activityType: "ecocash_payment_submitted",
      title: `EcoCash Payment Submitted: ${paymentRef}`,
      description: `Submitted $${amountExpected} via EcoCash ${recipientNumber} (${recipientName}). Ref: ${cleanRef}`,
      relatedId: createdPayment.$id
    });

    return createdPayment;
  }

  // -------------------------------------------------------------
  // ACTION: admin_list_pending_payments (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_list_pending_payments") {
    await requireAdmin();
    const filterStatus = data.status || null;
    let queries = [buildOrderDescQuery("created_at"), buildLimitQuery(data.limit || 50)];
    if (filterStatus) {
      queries.unshift(buildEqualQuery("status", filterStatus));
    }
    const queryString = queries.map(q => `queries[]=${q}`).join("&");
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payments/documents?${queryString}`,
      { headers: serverHeaders }
    );
    const result = await res.json();
    return {
      payments: result.documents || [],
      total: result.total || 0
    };
  }

  // -------------------------------------------------------------
  // ACTION: admin_approve_payment (ADMIN ONLY - NO SELF-APPROVAL)
  // -------------------------------------------------------------
  if (action === "admin_approve_payment") {
    await requireAdmin();
    const paymentId = data.payment_id || data.id;
    if (!paymentId) throw new Error("payment_id is required.");

    const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents/${paymentId}`, {
      headers: serverHeaders
    });
    if (!pRes.ok) throw new Error("Payment record not found.");
    const payment = await pRes.json();

    // Prevent self-approval (Admin cannot approve their own payment)
    if (payment.user_id === verifiedUser.$id) {
      throw new Error("Forbidden: Administrators cannot approve their own payments.");
    }

    if (payment.status === "approved") {
      throw new Error("Conflict: Payment is already approved.");
    }

    // Duplicate approved reference check
    if (payment.transaction_reference) {
      const refQ = buildEqualQuery("transaction_reference", payment.transaction_reference);
      const statQ = buildEqualQuery("status", "approved");
      const checkDup = await fetch(
        `${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${refQ}&queries[]=${statQ}`,
        { headers: serverHeaders }
      );
      if (checkDup.ok) {
        const dupDocs = (await checkDup.json()).documents || [];
        const otherApproved = dupDocs.filter(d => d.$id !== payment.$id);
        if (otherApproved.length > 0) {
          throw new Error("Conflict: A payment with this transaction reference has already been approved.");
        }
      }
    }

    const now = new Date().toISOString();

    const patchRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents/${payment.$id}`, {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({
        data: {
          status: "approved",
          paid_at: now,
          reviewed_at: now,
          reviewed_by: verifiedUser.$id,
          updated_at: now
        }
      })
    });
    if (!patchRes.ok) throw new Error("Failed to update payment status.");

    if (payment.payment_type === "subscription") {
      let planDurationDays = 30;
      let planName = "TransMove Professional";
      if (payment.related_id) {
        const planRes = await fetch(`${creds.endpoint}/databases/transmove/collections/subscription_plans/documents/${payment.related_id}`, { headers: serverHeaders });
        if (planRes.ok) {
          const plan = await planRes.json();
          planDurationDays = plan.duration_days || 30;
          planName = plan.name || planName;
        }
      }

      const subUserQ = buildEqualQuery("user_id", payment.user_id);
      const subRes = await fetch(`${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${subUserQ}`, { headers: serverHeaders });
      const subDocs = subRes.ok ? ((await subRes.json()).documents || []) : [];
      const activeSub = subDocs.find(s => s.status === "active" && s.expires_at && new Date(s.expires_at) > new Date());

      let newExpiresAt;
      if (activeSub) {
        newExpiresAt = new Date(new Date(activeSub.expires_at).getTime() + planDurationDays * 86400000).toISOString();
        await fetch(`${creds.endpoint}/databases/transmove/collections/subscriptions/documents/${activeSub.$id}`, {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({
            data: {
              plan: planName,
              amount: payment.amount,
              currency: payment.currency || "USD",
              status: "active",
              expires_at: newExpiresAt,
              updated_at: now
            }
          })
        });
      } else {
        newExpiresAt = new Date(Date.now() + planDurationDays * 86400000).toISOString();
        await fetch(`${creds.endpoint}/databases/transmove/collections/subscriptions/documents`, {
          method: "POST",
          headers: serverHeaders,
          body: JSON.stringify({
            documentId: "unique()",
            data: {
              user_id: payment.user_id,
              plan: planName,
              amount: payment.amount,
              currency: payment.currency || "USD",
              status: "active",
              started_at: now,
              expires_at: newExpiresAt,
              created_at: now,
              updated_at: now
            },
            permissions: []
          })
        });
      }

      await createNotification(creds, serverHeaders, {
        userId: payment.user_id,
        type: "subscription_activated",
        title: "Subscription Activated",
        message: `Your EcoCash payment for ${planName} has been verified! Active until ${new Date(newExpiresAt).toLocaleDateString()}.`,
        relatedId: payment.$id
      });
    } else if (payment.payment_type === "advertising") {
      if (payment.related_id) {
        await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${payment.related_id}`, {
          method: "PATCH",
          headers: serverHeaders,
          body: JSON.stringify({
            data: {
              status: "approved",
              updated_at: now
            }
          })
        });
        await createNotification(creds, serverHeaders, {
          userId: payment.user_id,
          type: "ad_payment_approved",
          title: "Ad Campaign Payment Approved",
          message: `Your payment of $${payment.amount} for ad campaign has been approved. Your campaign is now live!`,
          relatedId: payment.related_id
        });
      }
    }

    await logActivity({
      userId: verifiedUser.$id,
      activityType: "payment_approved",
      title: `Payment Approved: ${payment.reference}`,
      description: `Admin approved payment of $${payment.amount} for user ${payment.user_id} (${payment.payment_type}). Ref: ${payment.transaction_reference}`,
      relatedId: payment.$id
    });

    return { success: true, payment_id: payment.$id, status: "approved" };
  }

  // -------------------------------------------------------------
  // ACTION: admin_reject_payment (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_reject_payment") {
    await requireAdmin();
    const paymentId = data.payment_id || data.id;
    const reason = String(data.rejection_reason || data.reason || "").trim();
    if (!paymentId) throw new Error("payment_id is required.");
    if (!reason) throw new Error("rejection_reason is required when rejecting a payment.");

    const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents/${paymentId}`, {
      headers: serverHeaders
    });
    if (!pRes.ok) throw new Error("Payment record not found.");
    const payment = await pRes.json();

    if (payment.user_id === verifiedUser.$id) {
      throw new Error("Forbidden: Administrators cannot reject their own payments.");
    }

    const now = new Date().toISOString();
    await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents/${payment.$id}`, {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({
        data: {
          status: "rejected",
          rejection_reason: reason,
          reviewed_at: now,
          reviewed_by: verifiedUser.$id,
          updated_at: now
        }
      })
    });

    if (payment.payment_type === "advertising" && payment.related_id) {
      await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${payment.related_id}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            status: "rejected",
            admin_rejection_reason: reason,
            updated_at: now
          }
        })
      });
    }

    await createNotification(creds, serverHeaders, {
      userId: payment.user_id,
      type: "payment_rejected",
      title: "EcoCash Payment Rejected",
      message: `Your payment (${payment.reference}) was not approved. Reason: ${reason}`,
      relatedId: payment.$id
    });

    await logActivity({
      userId: verifiedUser.$id,
      activityType: "payment_rejected",
      title: `Payment Rejected: ${payment.reference}`,
      description: `Admin rejected payment of $${payment.amount} for user ${payment.user_id}. Reason: ${reason}`,
      relatedId: payment.$id
    });

    return { success: true, payment_id: payment.$id, status: "rejected" };
  }

  // -------------------------------------------------------------
  // ACTION: list_ad_rate_cards (PUBLIC / ALL USERS)
  // -------------------------------------------------------------
  if (action === "list_ad_rate_cards") {
    let queries = [buildOrderAscQuery("display_order"), buildLimitQuery(50)];
    if (!data.include_all) queries.unshift(buildEqualQuery("active", true));
    const queryString = queries.map(q => `queries[]=${q}`).join("&");
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_rate_cards/documents?${queryString}`, { headers: serverHeaders });
    const result = await res.json();
    return { rate_cards: result.documents || [], total: result.total || 0 };
  }

  // -------------------------------------------------------------
  // ACTION: list_ad_packages (PUBLIC / ALL USERS)
  // -------------------------------------------------------------
  if (action === "list_ad_packages") {
    let queries = [buildOrderAscQuery("display_order"), buildLimitQuery(50)];
    if (!data.include_all) queries.unshift(buildEqualQuery("active", true));
    const queryString = queries.map(q => `queries[]=${q}`).join("&");
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_packages/documents?${queryString}`, { headers: serverHeaders });
    const result = await res.json();
    return { packages: result.documents || [], total: result.total || 0 };
  }

  // -------------------------------------------------------------
  // ACTION: calculate_ad_price (PUBLIC CALCULATOR / SERVER TRUTH)
  // -------------------------------------------------------------
  if (action === "calculate_ad_price") {
    if (data.package_slug) {
      const slugQ = buildEqualQuery("slug", String(data.package_slug).trim().toLowerCase());
      const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_packages/documents?queries[]=${slugQ}`, { headers: serverHeaders });
      const pDocs = (await pRes.json()).documents || [];
      if (pDocs.length === 0) throw new Error("Invalid ad package slug.");
      const pkg = pDocs[0];
      return {
        is_package: true,
        package_name: pkg.name,
        package_slug: pkg.slug,
        placement: pkg.placement,
        duration_days: pkg.duration_days,
        total_price: parseFloat(pkg.price),
        currency: pkg.currency || "USD",
        discount_label: pkg.discount_label || ""
      };
    }

    const placement = String(data.placement || "").trim();
    const durationDays = parseInt(data.duration_days, 10);
    const isTargeted = Boolean(data.is_targeted);
    const isFeatured = Boolean(data.is_featured);

    if (!placement) throw new Error("placement is required for ad price calculation.");
    if (!durationDays || durationDays < 1) throw new Error("duration_days must be at least 1.");

    const placeQ = buildEqualQuery("placement", placement);
    const rRes = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_rate_cards/documents?queries[]=${placeQ}`, { headers: serverHeaders });
    const rDocs = (await rRes.json()).documents || [];
    if (rDocs.length === 0) throw new Error(`Invalid placement: '${placement}' rate card not found.`);
    const card = rDocs[0];

    const minDays = card.minimum_days || 1;
    const maxDays = card.maximum_days || 365;
    if (durationDays < minDays) {
      throw new Error(`Duration for '${card.placement_label}' must be at least ${minDays} days.`);
    }
    if (durationDays > maxDays) {
      throw new Error(`Duration for '${card.placement_label}' cannot exceed ${maxDays} days.`);
    }

    const baseRate = parseFloat(card.base_rate);
    const baseCost = baseRate * durationDays;
    const targetingMultiplier = isTargeted ? parseFloat(card.targeting_multiplier || 1.0) : 1.0;
    const featuredMultiplier = isFeatured ? parseFloat(card.featured_multiplier || 1.0) : 1.0;
    const totalPrice = Math.round(baseCost * targetingMultiplier * featuredMultiplier * 100) / 100;

    return {
      is_package: false,
      placement: card.placement,
      placement_label: card.placement_label,
      base_rate: baseRate,
      duration_days: durationDays,
      base_cost: baseCost,
      is_targeted: isTargeted,
      targeting_multiplier: targetingMultiplier,
      is_featured: isFeatured,
      featured_multiplier: featuredMultiplier,
      total_price: totalPrice,
      currency: card.currency || "USD"
    };
  }

  // -------------------------------------------------------------
  // ACTION: submit_ad_campaign (AUTHENTICATED ADVERTISER)
  // -------------------------------------------------------------
  if (action === "submit_ad_campaign") {
    if (!verifiedUser) throw new Error("Unauthorized: Login required to submit an ad campaign.");
    const callerId = verifiedUser.$id;

    const {
      business_name,
      title,
      description,
      image_file_id,
      destination_url,
      placement,
      targeting,
      start_date,
      duration_days,
      package_slug,
      is_targeted,
      is_featured
    } = data;

    if (!business_name || !String(business_name).trim()) throw new Error("business_name is required.");
    if (!title || !String(title).trim()) throw new Error("title is required.");
    if (!placement || !String(placement).trim()) throw new Error("placement is required.");

    let calculatedAmount = 0.0;
    let actualDuration = parseInt(duration_days, 10) || 7;

    if (package_slug) {
      const slugQ = buildEqualQuery("slug", String(package_slug).trim().toLowerCase());
      const pRes = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_packages/documents?queries[]=${slugQ}`, { headers: serverHeaders });
      const pDocs = (await pRes.json()).documents || [];
      if (pDocs.length === 0) throw new Error("Invalid ad package slug.");
      calculatedAmount = parseFloat(pDocs[0].price);
      actualDuration = pDocs[0].duration_days;
    } else {
      const placeQ = buildEqualQuery("placement", String(placement).trim());
      const rRes = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_rate_cards/documents?queries[]=${placeQ}`, { headers: serverHeaders });
      const rDocs = (await rRes.json()).documents || [];
      if (rDocs.length === 0) throw new Error(`Invalid placement: '${placement}' rate card not found.`);
      const card = rDocs[0];
      const base = parseFloat(card.base_rate) * actualDuration;
      const tMult = is_targeted ? parseFloat(card.targeting_multiplier || 1.0) : 1.0;
      const fMult = is_featured ? parseFloat(card.featured_multiplier || 1.0) : 1.0;
      calculatedAmount = Math.round(base * tMult * fMult * 100) / 100;
    }

    const now = new Date().toISOString();
    const campaignPayload = {
      user_id: callerId,
      business_name: String(business_name).trim(),
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      image_file_id: image_file_id ? String(image_file_id).trim() : null,
      destination_url: destination_url ? String(destination_url).trim() : "",
      placement: String(placement).trim(),
      targeting: targeting ? String(targeting).trim() : "",
      start_date: start_date ? new Date(start_date).toISOString() : now,
      duration_days: actualDuration,
      amount_expected: calculatedAmount,
      currency: "USD",
      payment_id: null,
      status: "pending_payment",
      admin_rejection_reason: null,
      created_at: now,
      updated_at: now
    };

    const cRes = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents`, {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({ documentId: "unique()", data: campaignPayload, permissions: [] })
    });
    if (!cRes.ok) {
      const errBody = await cRes.json().catch(() => ({}));
      throw new Error(errBody.message || "Failed to create ad campaign.");
    }
    const createdCampaign = await cRes.json();

    await logActivity({
      userId: callerId,
      activityType: "ad_campaign_created",
      title: `Ad Campaign Created: ${campaignPayload.title}`,
      description: `Created campaign for ${campaignPayload.business_name} at $${calculatedAmount} (${actualDuration} days)`,
      relatedId: createdCampaign.$id
    });

    return createdCampaign;
  }

  // -------------------------------------------------------------
  // ACTION: admin_list_ad_campaigns (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_list_ad_campaigns") {
    await requireAdmin();
    let queries = [buildOrderDescQuery("created_at"), buildLimitQuery(data.limit || 50)];
    if (data.status) queries.unshift(buildEqualQuery("status", data.status));
    const queryString = queries.map(q => `queries[]=${q}`).join("&");
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents?${queryString}`, { headers: serverHeaders });
    const result = await res.json();
    return { campaigns: result.documents || [], total: result.total || 0 };
  }

  // -------------------------------------------------------------
  // ACTION: admin_approve_ad_content (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_approve_ad_content") {
    await requireAdmin();
    const campaignId = data.campaign_id || data.id;
    if (!campaignId) throw new Error("campaign_id is required.");

    const now = new Date().toISOString();
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${campaignId}`, {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({
        data: {
          status: "active",
          admin_rejection_reason: null,
          updated_at: now
        }
      })
    });
    if (!res.ok) throw new Error("Failed to approve ad campaign.");
    const updated = await res.json();

    await createNotification(creds, serverHeaders, {
      userId: updated.user_id,
      type: "ad_campaign_approved",
      title: "Ad Campaign Live",
      message: `Your campaign "${updated.title}" has been approved and is now active across TransMove.`,
      relatedId: updated.$id
    });

    return { success: true, campaign_id: campaignId, status: "active" };
  }

  // -------------------------------------------------------------
  // ACTION: admin_reject_ad_content (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_reject_ad_content") {
    await requireAdmin();
    const campaignId = data.campaign_id || data.id;
    const reason = String(data.rejection_reason || data.reason || "").trim();
    if (!campaignId) throw new Error("campaign_id is required.");
    if (!reason) throw new Error("rejection_reason is required.");

    const now = new Date().toISOString();
    const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_campaigns/documents/${campaignId}`, {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({
        data: {
          status: "rejected",
          admin_rejection_reason: reason,
          updated_at: now
        }
      })
    });
    if (!res.ok) throw new Error("Failed to reject ad campaign.");
    const updated = await res.json();

    await createNotification(creds, serverHeaders, {
      userId: updated.user_id,
      type: "ad_campaign_rejected",
      title: "Ad Campaign Rejected",
      message: `Your ad campaign "${updated.title}" was rejected. Reason: ${reason}`,
      relatedId: updated.$id
    });

    return { success: true, campaign_id: campaignId, status: "rejected" };
  }

  // -------------------------------------------------------------
  // ACTION: admin_manage_ad_rate_card (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_manage_ad_rate_card") {
    await requireAdmin();
    const op = data.operation || "list";

    if (op === "update") {
      const cardId = data.rate_card_id || data.id;
      if (!cardId) throw new Error("Missing rate_card_id for update.");
      const updateData = { updated_at: new Date().toISOString() };
      if (data.base_rate !== undefined) updateData.base_rate = parseFloat(data.base_rate);
      if (data.minimum_days !== undefined) updateData.minimum_days = parseInt(data.minimum_days, 10);
      if (data.maximum_days !== undefined) updateData.maximum_days = parseInt(data.maximum_days, 10);
      if (data.targeting_multiplier !== undefined) updateData.targeting_multiplier = parseFloat(data.targeting_multiplier);
      if (data.featured_multiplier !== undefined) updateData.featured_multiplier = parseFloat(data.featured_multiplier);
      if (data.active !== undefined) updateData.active = Boolean(data.active);
      if (data.description !== undefined) updateData.description = String(data.description).trim();

      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_rate_cards/documents/${cardId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updateData })
      });
      return await res.json();
    }
    throw new Error(`Unsupported rate card operation: ${op}`);
  }

  // -------------------------------------------------------------
  // ACTION: admin_manage_ad_package (ADMIN ONLY)
  // -------------------------------------------------------------
  if (action === "admin_manage_ad_package") {
    await requireAdmin();
    const op = data.operation || "list";

    if (op === "update") {
      const pkgId = data.package_id || data.id;
      if (!pkgId) throw new Error("Missing package_id for update.");
      const updateData = { updated_at: new Date().toISOString() };
      if (data.price !== undefined) updateData.price = parseFloat(data.price);
      if (data.duration_days !== undefined) updateData.duration_days = parseInt(data.duration_days, 10);
      if (data.discount_label !== undefined) updateData.discount_label = String(data.discount_label);
      if (data.active !== undefined) updateData.active = Boolean(data.active);
      if (data.description !== undefined) updateData.description = String(data.description).trim();

      const res = await fetch(`${creds.endpoint}/databases/transmove/collections/ad_packages/documents/${pkgId}`, {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updateData })
      });
      return await res.json();
    }
    throw new Error(`Unsupported package operation: ${op}`);
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

  // -------------------------------------------------------------
  // ACTION: count_compatible_online_providers (REAL ONLINE PROVIDERS COUNT)
  // -------------------------------------------------------------
  if (action === "count_compatible_online_providers") {
    const rawType = String(data.service_type || data.request_type || "ride").toLowerCase().trim();
    const sType = (rawType === "passenger") ? "ride" : (rawType === "goods") ? "logistics" : (rawType === "vehicle_hire") ? "hire" : rawType;

    // 1. Fetch recent driver presence
    const orderQ = buildOrderDescQuery("last_seen_at");
    const limitQ = buildLimitQuery(100);
    const pRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/driver_presence/documents?queries[]=${orderQ}&queries[]=${limitQ}`,
      { headers: serverHeaders }
    );
    if (!pRes.ok) return { compatible_online_count: 0 };
    const pData = await pRes.json();
    const presenceList = pData.documents || [];

    const now = Date.now();
    const onlineDriverIds = presenceList
      .filter((p) => (now - new Date(p.last_seen_at).getTime()) <= 180000)
      .map((p) => p.driver_id)
      .filter(Boolean);

    if (onlineDriverIds.length === 0) {
      return { compatible_online_count: 0, service_type: sType };
    }

    // 2. Fetch active vehicles for these drivers
    const statusQ = buildEqualQuery("status", "active");
    const vRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${statusQ}&queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    if (!vRes.ok) return { compatible_online_count: 0, service_type: sType };
    const vData = await vRes.json();
    const vehicles = vData.documents || [];

    const compatibleDriverIds = new Set();
    vehicles.forEach((veh) => {
      if (onlineDriverIds.includes(veh.driver_id)) {
        if (isVehicleCompatibleWithRequest(veh.service_category, sType)) {
          compatibleDriverIds.add(veh.driver_id);
        }
      }
    });

    return {
      compatible_online_count: compatibleDriverIds.size,
      service_type: sType
    };
  }

  // -------------------------------------------------------------
  // ACTION: create_review (COMPLETED BOOKING RATINGS & REVIEWS)
  // -------------------------------------------------------------
  if (action === "create_review") {
    const reviewerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const rating = parseInt(data.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      throw new Error("Invalid rating. Must be an integer between 1 and 5.");
    }
    const comment = data.comment ? String(data.comment).trim().slice(0, 1000) : "";

    // 1. Fetch booking
    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bkRes.ok) throw new Error("Booking not found.");
    const bkDoc = await bkRes.json();

    // 2. Verify booking is completed
    if (bkDoc.status !== "completed") {
      throw new Error("Reviews are only permitted for completed bookings.");
    }

    // 3. Verify reviewer is a participant
    const isPassenger = bkDoc.passenger_id === reviewerId;
    const isDriver = bkDoc.driver_id === reviewerId;
    if (!isPassenger && !isDriver) {
      throw new Error("Forbidden: You are not a participant in this booking.");
    }

    // 4. Resolve reviewee
    const revieweeId = isPassenger ? bkDoc.driver_id : bkDoc.passenger_id;

    // 5. Prevent duplicate review
    const bIdQ = buildEqualQuery("booking_id", bookingId);
    const rIdQ = buildEqualQuery("reviewer_id", reviewerId);
    const dupRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/reviews/documents?queries[]=${bIdQ}&queries[]=${rIdQ}`,
      { headers: serverHeaders }
    );
    const dupData = await dupRes.json();
    if ((dupData.documents || []).length > 0) {
      throw new Error("Conflict: You have already submitted a review for this booking.");
    }

    // 6. Create review document
    const now = new Date().toISOString();
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/reviews/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: {
            booking_id: bookingId,
            reviewer_id: reviewerId,
            reviewee_id: revieweeId,
            rating: rating,
            comment: comment,
            created_at: now,
            updated_at: now
          },
          permissions: [`read("users")`]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to save review.");
    }

    const review = await createRes.json();

    await logActivity({
      userId: reviewerId,
      activityType: "review_submitted",
      title: "Review Submitted",
      description: `Submitted a ${rating}-star review for booking #${bookingId.slice(0, 8)}`,
      relatedId: bookingId
    });

    return {
      success: true,
      review: {
        ...review,
        id: review.$id
      }
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_booking_reviews
  // -------------------------------------------------------------
  if (action === "get_booking_reviews") {
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");
    const bQ = buildEqualQuery("booking_id", bookingId);
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/reviews/documents?queries[]=${bQ}`,
      { headers: serverHeaders }
    );
    const resData = await res.json();
    return { reviews: (resData.documents || []).map(d => ({ ...d, id: d.$id })) };
  }

  // -------------------------------------------------------------
  // ACTION: get_driver_reviews
  // -------------------------------------------------------------
  if (action === "get_driver_reviews") {
    const targetDriverId = data.driver_id || data.driverId;
    if (!targetDriverId) throw new Error("Missing required parameter: driver_id");
    const dQ = buildEqualQuery("reviewee_id", targetDriverId);
    const oQ = buildOrderDescQuery("created_at");
    const lQ = buildLimitQuery(50);
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/reviews/documents?queries[]=${dQ}&queries[]=${oQ}&queries[]=${lQ}`,
      { headers: serverHeaders }
    );
    const resData = await res.json();
    const reviews = resData.documents || [];
    const count = reviews.length;
    const avg = count > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / count) : 5.0;
    return {
      driver_id: targetDriverId,
      rating: parseFloat(avg.toFixed(1)),
      review_count: count,
      reviews: reviews.map(r => ({
        id: r.$id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at
      }))
    };
  }

  // -------------------------------------------------------------
  // ACTION: add_favourite
  // -------------------------------------------------------------
  if (action === "add_favourite") {
    const passengerId = verifiedUser.$id;
    const driverId = data.driver_id || data.driverId;
    if (!driverId) throw new Error("Missing required parameter: driver_id");

    const pQ = buildEqualQuery("passenger_id", passengerId);
    const dQ = buildEqualQuery("driver_id", driverId);
    const existRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/favourites/documents?queries[]=${pQ}&queries[]=${dQ}`,
      { headers: serverHeaders }
    );
    const existData = await existRes.json();
    if ((existData.documents || []).length > 0) {
      return { success: true, favourite: existData.documents[0] };
    }

    const now = new Date().toISOString();
    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/favourites/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: {
            passenger_id: passengerId,
            driver_id: driverId,
            created_at: now
          },
          permissions: [`read("user:${passengerId}")`]
        })
      }
    );
    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to save favourite.");
    }
    const doc = await createRes.json();
    return { success: true, favourite: { ...doc, id: doc.$id } };
  }

  // -------------------------------------------------------------
  // ACTION: remove_favourite
  // -------------------------------------------------------------
  if (action === "remove_favourite") {
    const passengerId = verifiedUser.$id;
    const driverId = data.driver_id || data.driverId;
    const favId = data.favourite_id || data.id;

    let targetDocId = favId;
    if (!targetDocId && driverId) {
      const pQ = buildEqualQuery("passenger_id", passengerId);
      const dQ = buildEqualQuery("driver_id", driverId);
      const res = await fetch(
        `${creds.endpoint}/databases/transmove/collections/favourites/documents?queries[]=${pQ}&queries[]=${dQ}`,
        { headers: serverHeaders }
      );
      const d = await res.json();
      if ((d.documents || []).length > 0) {
        targetDocId = d.documents[0].$id;
      }
    }

    if (!targetDocId) {
      return { success: true, message: "Favourite already removed." };
    }

    const checkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/favourites/documents/${targetDocId}`,
      { headers: serverHeaders }
    );
    if (checkRes.ok) {
      const doc = await checkRes.json();
      if (doc.passenger_id !== passengerId) {
        throw new Error("Forbidden: You cannot delete another user's favourite.");
      }
      await fetch(
        `${creds.endpoint}/databases/transmove/collections/favourites/documents/${targetDocId}`,
        { method: "DELETE", headers: serverHeaders }
      );
    }
    return { success: true };
  }

  // -------------------------------------------------------------
  // ACTION: list_favourites
  // -------------------------------------------------------------
  if (action === "list_favourites") {
    const passengerId = verifiedUser.$id;
    const pQ = buildEqualQuery("passenger_id", passengerId);
    const oQ = buildOrderDescQuery("created_at");
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/favourites/documents?queries[]=${pQ}&queries[]=${oQ}`,
      { headers: serverHeaders }
    );
    const d = await res.json();
    const favDocs = d.documents || [];

    const enriched = await Promise.all(favDocs.map(async (f) => {
      let driver = null;
      try {
        const dProfQ = buildEqualQuery("user_id", f.driver_id);
        const pRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${dProfQ}`,
          { headers: serverHeaders }
        );
        const pData = await pRes.json();
        const dp = pData.documents?.[0];
        if (dp) {
          driver = {
            id: dp.user_id,
            full_name: dp.full_name,
            city: dp.city,
            profile_image_id: dp.profile_image_id,
            verification_status: dp.verification_status,
            bio: dp.bio
          };
        }
      } catch (_) {}
      return {
        ...f,
        id: f.$id,
        driver
      };
    }));

    return { favourites: enriched, total: enriched.length };
  }

  // -------------------------------------------------------------
  // ACTION: create_saved_address
  // -------------------------------------------------------------
  if (action === "create_saved_address") {
    const passengerId = verifiedUser.$id;
    const label = data.label ? String(data.label).trim() : "Custom";
    const title = data.title ? String(data.title).trim() : label;
    const address = String(data.address || "").trim();
    if (!address) throw new Error("Address is required.");

    const now = new Date().toISOString();
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: {
            user_id: passengerId,
            label,
            title,
            address,
            lat: data.lat !== undefined ? parseFloat(data.lat) : null,
            lng: data.lng !== undefined ? parseFloat(data.lng) : null,
            notes: data.notes ? String(data.notes).trim() : "",
            created_at: now,
            updated_at: now
          },
          permissions: [`read("user:${passengerId}")`]
        })
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to create saved address.");
    }
    const doc = await res.json();
    return { success: true, address: { ...doc, id: doc.$id } };
  }

  // -------------------------------------------------------------
  // ACTION: list_saved_addresses
  // -------------------------------------------------------------
  if (action === "list_saved_addresses") {
    const passengerId = verifiedUser.$id;
    const uQ = buildEqualQuery("user_id", passengerId);
    const oQ = buildOrderDescQuery("created_at");
    const res = await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents?queries[]=${uQ}&queries[]=${oQ}`,
      { headers: serverHeaders }
    );
    const d = await res.json();
    return { addresses: (d.documents || []).map(doc => ({ ...doc, id: doc.$id })), total: (d.documents || []).length };
  }

  // -------------------------------------------------------------
  // ACTION: update_saved_address
  // -------------------------------------------------------------
  if (action === "update_saved_address") {
    const passengerId = verifiedUser.$id;
    const addressId = data.id || data.address_id;
    if (!addressId) throw new Error("Missing required parameter: id");

    const checkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents/${addressId}`,
      { headers: serverHeaders }
    );
    if (!checkRes.ok) throw new Error("Saved address not found.");
    const doc = await checkRes.json();
    if (doc.user_id !== passengerId) throw new Error("Forbidden: You cannot modify another user's address.");

    const updates = { updated_at: new Date().toISOString() };
    if (data.label) updates.label = String(data.label).trim();
    if (data.title) updates.title = String(data.title).trim();
    if (data.address) updates.address = String(data.address).trim();
    if (data.notes !== undefined) updates.notes = String(data.notes).trim();

    const patchRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents/${addressId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({ data: updates })
      }
    );
    const updated = await patchRes.json();
    return { success: true, address: { ...updated, id: updated.$id } };
  }

  // -------------------------------------------------------------
  // ACTION: delete_saved_address
  // -------------------------------------------------------------
  if (action === "delete_saved_address") {
    const passengerId = verifiedUser.$id;
    const addressId = data.id || data.address_id;
    if (!addressId) throw new Error("Missing required parameter: id");

    const checkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents/${addressId}`,
      { headers: serverHeaders }
    );
    if (!checkRes.ok) throw new Error("Saved address not found.");
    const doc = await checkRes.json();
    if (doc.user_id !== passengerId) throw new Error("Forbidden: You cannot delete another user's address.");

    await fetch(
      `${creds.endpoint}/databases/transmove/collections/saved_addresses/documents/${addressId}`,
      { method: "DELETE", headers: serverHeaders }
    );
    return { success: true };
  }

  // -------------------------------------------------------------
  // ACTION: create_dispute
  // -------------------------------------------------------------
  if (action === "create_dispute") {
    const callerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const reason = String(data.reason || "").trim();
    if (!reason) throw new Error("Dispute reason is required.");
    const details = data.details ? String(data.details).trim() : "";

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bkRes.ok) throw new Error("Booking not found.");
    const bkDoc = await bkRes.json();

    const isPassenger = bkDoc.passenger_id === callerId;
    const isDriver = bkDoc.driver_id === callerId;
    if (!isPassenger && !isDriver) {
      throw new Error("Forbidden: You can only file a dispute for a booking you participated in.");
    }

    const reportedId = isPassenger ? bkDoc.driver_id : bkDoc.passenger_id;
    const now = new Date().toISOString();

    const createRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/disputes/documents`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({
          documentId: "unique()",
          data: {
            booking_id: bookingId,
            reporter_id: callerId,
            reported_id: reportedId,
            reason,
            details,
            evidence_url: data.evidence_url ? String(data.evidence_url).trim() : "",
            status: "open",
            created_at: now,
            updated_at: now
          },
          permissions: [`read("user:${callerId}")`, `read("user:${reportedId}")`]
        })
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.message || "Failed to create dispute.");
    }

    const dispute = await createRes.json();

    await logActivity({
      userId: callerId,
      activityType: "dispute_filed",
      title: "Dispute Filed",
      description: `Dispute filed on booking #${bookingId.slice(0, 8)}. Reason: ${reason}`,
      relatedId: dispute.$id
    });

    return { success: true, dispute: { ...dispute, id: dispute.$id } };
  }

  // -------------------------------------------------------------
  // ACTION: list_disputes
  // -------------------------------------------------------------
  if (action === "list_disputes") {
    const callerId = verifiedUser.$id;
    const callerProf = await getCallerProfile();
    const isAdmin = callerProf?.role === "admin";

    let url = `${creds.endpoint}/databases/transmove/collections/disputes/documents?queries[]=${buildOrderDescQuery("created_at")}`;
    if (!isAdmin) {
      const rQ = buildEqualQuery("reporter_id", callerId);
      url += `&queries[]=${rQ}`;
    }

    const res = await fetch(url, { headers: serverHeaders });
    const d = await res.json();
    const disputes = d.documents || [];

    return {
      disputes: disputes.map(disp => ({ ...disp, id: disp.$id })),
      total: disputes.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: resolve_dispute
  // -------------------------------------------------------------
  if (action === "resolve_dispute") {
    await requireAdmin();
    const disputeId = data.dispute_id || data.id;
    if (!disputeId) throw new Error("Missing required parameter: dispute_id");

    const resolution = String(data.resolution || "").trim();
    if (!resolution) throw new Error("Resolution note is required.");

    const now = new Date().toISOString();
    const patchRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/disputes/documents/${disputeId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            status: "resolved",
            resolution,
            resolved_by: verifiedUser.$id,
            resolved_at: now,
            updated_at: now
          }
        })
      }
    );
    if (!patchRes.ok) {
      const err = await patchRes.json();
      throw new Error(err.message || "Failed to resolve dispute.");
    }
    const updated = await patchRes.json();

    await logActivity({
      userId: verifiedUser.$id,
      activityType: "dispute_resolved",
      title: "Dispute Resolved",
      description: `Dispute #${disputeId.slice(0, 8)} resolved by admin: ${resolution}`,
      relatedId: disputeId
    });

    return { success: true, dispute: { ...updated, id: updated.$id } };
  }

  // -------------------------------------------------------------
  // ACTION: generate_trip_share_link
  // -------------------------------------------------------------
  if (action === "generate_trip_share_link") {
    const passengerId = verifiedUser.$id;
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bkRes.ok) throw new Error("Booking not found.");
    const bkDoc = await bkRes.json();

    if (bkDoc.passenger_id !== passengerId) {
      throw new Error("Forbidden: Only the passenger may generate a share link for this trip.");
    }

    const shareToken = `trk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const shareExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      {
        method: "PATCH",
        headers: serverHeaders,
        body: JSON.stringify({
          data: {
            share_token: shareToken,
            share_expires_at: shareExpiresAt
          }
        })
      }
    );

    return {
      success: true,
      share_token: shareToken,
      share_expires_at: shareExpiresAt,
      share_url: `/#shared-trip?token=${shareToken}`
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_shared_trip (PUBLIC TELEMETRY PROJECTION)
  // -------------------------------------------------------------
  if (action === "get_shared_trip") {
    const token = String(data.token || data.share_token || "").trim();
    if (!token) throw new Error("Missing trip share token.");

    const tQ = buildEqualQuery("share_token", token);
    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${tQ}`,
      { headers: serverHeaders }
    );
    const bkData = await bkRes.json();
    const bkDoc = bkData.documents?.[0];
    if (!bkDoc) throw new Error("Invalid or expired trip share link.");

    if (bkDoc.share_expires_at && new Date(bkDoc.share_expires_at).getTime() < Date.now()) {
      throw new Error("This trip share link has expired.");
    }

    let requestInfo = null;
    let driverInfo = null;
    let vehicleInfo = null;

    try {
      const rRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bkDoc.request_id}`,
        { headers: serverHeaders }
      );
      if (rRes.ok) {
        const rDoc = await rRes.json();
        requestInfo = {
          pickup_location: rDoc.pickup_location,
          destination: rDoc.destination,
          service_type: rDoc.service_type
        };
      }
    } catch (_) {}

    try {
      const dProfQ = buildEqualQuery("user_id", bkDoc.driver_id);
      const dProfRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${dProfQ}`,
        { headers: serverHeaders }
      );
      const dProfData = await dProfRes.json();
      const dp = dProfData.documents?.[0];
      if (dp) {
        driverInfo = {
          full_name: dp.full_name,
          profile_image_id: dp.profile_image_id,
          city: dp.city,
          verification_status: dp.verification_status
        };
      }
    } catch (_) {}

    try {
      if (bkDoc.vehicle_id) {
        const vRes = await fetch(
          `${creds.endpoint}/databases/transmove/collections/vehicles/documents/${bkDoc.vehicle_id}`,
          { headers: serverHeaders }
        );
        if (vRes.ok) {
          const vd = await vRes.json();
          vehicleInfo = {
            make: vd.make,
            model: vd.model,
            colour: vd.colour,
            registration_number: vd.registration_number
          };
        }
      }
    } catch (_) {}

    return {
      status: bkDoc.status,
      started_at: bkDoc.started_at,
      completed_at: bkDoc.completed_at,
      updated_at: bkDoc.updated_at,
      pickup: requestInfo?.pickup_location || "Pickup",
      destination: requestInfo?.destination || "Destination",
      service_type: requestInfo?.service_type || "ride",
      driver: driverInfo,
      vehicle: vehicleInfo
    };
  }

  // -------------------------------------------------------------
  // ACTION: get_public_provider_profile (PUBLIC PROVIDER PROFILE)
  // -------------------------------------------------------------
  if (action === "get_public_provider_profile") {
    const targetDriverId = String(data.driver_id || data.user_id || "").trim();
    if (!targetDriverId) throw new Error("Missing driver_id.");

    const profQ = buildEqualQuery("user_id", targetDriverId);
    const profRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${profQ}`,
      { headers: serverHeaders }
    );
    const profData = await profRes.json();
    const profile = profData.documents?.[0];
    if (!profile || profile.account_status === "suspended" || profile.account_status === "deactivated") {
      throw new Error("Provider profile not found.");
    }

    const dVehQ = buildEqualQuery("driver_id", targetDriverId);
    const sVehQ = buildEqualQuery("status", "active");
    const vehRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${dVehQ}&queries[]=${sVehQ}`,
      { headers: serverHeaders }
    );
    const vehData = await vehRes.json();
    const vehicles = (vehData.documents || []).map(v => ({
      make: v.make,
      model: v.model,
      year: v.year,
      colour: v.colour,
      service_category: v.service_category,
      is_primary: v.is_primary
    }));

    const rQ = buildEqualQuery("reviewee_id", targetDriverId);
    const revRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/reviews/documents?queries[]=${rQ}`,
      { headers: serverHeaders }
    );
    const revData = await revRes.json();
    const reviews = revData.documents || [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0 ? parseFloat((reviews.reduce((a, b) => a + (b.rating || 0), 0) / reviewCount).toFixed(1)) : 5.0;

    const bkQ = buildEqualQuery("driver_id", targetDriverId);
    const bksQ = buildEqualQuery("status", "completed");
    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${bkQ}&queries[]=${bksQ}`,
      { headers: serverHeaders }
    );
    const bkData = await bkRes.json();
    const completedJobs = (bkData.documents || []).length;

    const categories = [...new Set(vehicles.map(v => v.service_category).filter(Boolean))];

    return {
      id: targetDriverId,
      full_name: profile.full_name,
      profile_image_id: profile.profile_image_id,
      role: profile.role,
      verified: profile.verification_status === "approved",
      verification_status: profile.verification_status,
      service_categories: categories,
      vehicles,
      rating: avgRating,
      review_count: reviewCount,
      completed_jobs: completedJobs,
      service_area: profile.service_areas || profile.city || "Zimbabwe",
      bio: profile.bio || ""
    };
  }

  // -------------------------------------------------------------
  // ACTION: check_document_expiries
  // -------------------------------------------------------------
  if (action === "check_document_expiries") {
    await requireAdmin();
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const docRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const docData = await docRes.json();
    const allDocs = docData.documents || [];

    const expired = [];
    const expiringSoon = [];

    for (const doc of allDocs) {
      if (!doc.expires_at) continue;
      const expDate = new Date(doc.expires_at);
      if (expDate < now) {
        expired.push(doc);
      } else if (expDate <= in30Days) {
        expiringSoon.push(doc);
        if (!doc.expiry_notified) {
          await createNotification(creds, serverHeaders, {
            userId: doc.user_id,
            type: "document_expiring",
            title: "Document Expiring Soon",
            message: `Your ${doc.document_type || "verification document"} will expire on ${expDate.toLocaleDateString()}. Please renew to maintain active status.`,
            relatedId: doc.$id
          });
          await fetch(
            `${creds.endpoint}/databases/transmove/collections/verification_documents/documents/${doc.$id}`,
            {
              method: "PATCH",
              headers: serverHeaders,
              body: JSON.stringify({ data: { expiry_notified: true } })
            }
          ).catch(() => {});
        }
      }
    }

    return {
      total_audited: allDocs.length,
      expiring_soon: expiringSoon.length,
      expired: expired.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: admin_list_verification_documents
  // -------------------------------------------------------------
  if (action === "admin_list_verification_documents") {
    await requireAdmin();
    const [docRes, profileRes, vehicleRes] = await Promise.all([
      fetch(
        `${creds.endpoint}/databases/transmove/collections/verification_documents/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(100)}`,
        { headers: serverHeaders }
      ),
      fetch(`${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${buildLimitQuery(100)}`, { headers: serverHeaders }),
      fetch(`${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${buildLimitQuery(100)}`, { headers: serverHeaders })
    ]);
    if (!docRes.ok || !profileRes.ok || !vehicleRes.ok) throw new Error("Unable to load verification documents.");
    const docData = await docRes.json();
    const profileData = await profileRes.json();
    const vehicleData = await vehicleRes.json();
    const profilesByUser = new Map((profileData.documents || []).map((profile) => [profile.user_id, profile]));
    const vehiclesById = new Map((vehicleData.documents || []).map((vehicle) => [vehicle.$id, vehicle]));
    const allDocs = (docData.documents || []).filter((document) => {
      const owner = profilesByUser.get(document.user_id);
      return owner && !isExplicitAutomatedTestIdentity(owner);
    });

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const pending = [];
    const approved = [];
    const rejected = [];
    const expiring = [];
    const expired = [];

    allDocs.forEach(d => {
      if (d.expires_at) {
        const expDate = new Date(d.expires_at);
        if (expDate < now) expired.push(d);
        else if (expDate <= in30Days) expiring.push(d);
      }
      const status = effectiveDocumentStatus(d, now);
      if (status === "verified") approved.push(d);
      else if (status === "rejected") rejected.push(d);
      else if (status !== "expired") pending.push(d);
    });

    return {
      documents: allDocs.map(d => {
        const owner = profilesByUser.get(d.user_id);
        const vehicle = d.vehicle_id ? vehiclesById.get(d.vehicle_id) : null;
        return {
          id: d.$id,
          user_id: d.user_id,
          owner: owner ? {
            user_id: owner.user_id,
            full_name: owner.full_name,
            email: owner.email,
            phone: owner.phone || "",
            role: owner.role
          } : null,
          vehicle: vehicle ? {
            id: vehicle.$id,
            make: vehicle.make,
            model: vehicle.model,
            registration_number: vehicle.registration_number
          } : null,
          document_type: d.document_type,
          verification_status: effectiveDocumentStatus(d, now),
          stored_verification_status: normalizedVerificationStatus(d.verification_status, "document"),
          rejection_reason: d.rejection_reason || "",
          created_at: d.created_at,
          expires_at: d.expires_at || null,
          verified_at: d.verified_at || null,
          has_file: Boolean(d.file_id)
        };
      }),
      pending: pending.map((document) => document.$id),
      approved: approved.map((document) => document.$id),
      rejected: rejected.map((document) => document.$id),
      expiring: expiring.map((document) => document.$id),
      expired: expired.map((document) => document.$id),
      summary: {
        pending: pending.length,
        approved: approved.length,
        rejected: rejected.length,
        expiring_soon: expiring.length,
        expired: expired.length,
        total: allDocs.length
      }
    };
  }

  // -------------------------------------------------------------
  // ACTION: admin_create_verification_file_token
  // Creates a five-minute bearer URL only after server-side admin validation.
  // The underlying file remains private and its permissions are unchanged.
  // -------------------------------------------------------------
  if (action === "admin_create_verification_file_token") {
    await requireAdmin();
    const documentId = data.document_id || data.id;
    if (!documentId) throw new Error("Missing document_id parameter.");
    const docRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents/${documentId}`,
      { headers: serverHeaders }
    );
    if (!docRes.ok) throw new Error("Verification document not found.");
    const document = await docRes.json();
    if (!document.file_id) throw new Error("Verification document file not found.");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const tokenRes = await fetch(
      `${creds.endpoint}/tokens/buckets/transmove-files/files/${document.file_id}`,
      {
        method: "POST",
        headers: serverHeaders,
        body: JSON.stringify({ expire: expiresAt })
      }
    );
    if (!tokenRes.ok) {
      const error = await tokenRes.json().catch(() => ({}));
      throw new Error(error.message || "Unable to authorize private document viewing.");
    }
    const token = await tokenRes.json();
    await logActivity({
      userId,
      activityType: "verification_document_view_authorized",
      title: "Private verification document opened",
      description: `Admin ${userId} received time-limited access to verification document ${documentId}. Result: success.`,
      relatedId: documentId
    });
    return {
      view_url: `${creds.endpoint}/storage/buckets/transmove-files/files/${document.file_id}/view?project=${creds.projectId}&token=${encodeURIComponent(token.secret)}`,
      expires_at: expiresAt
    };
  }

  // -------------------------------------------------------------
  // ACTION: admin_get_analytics (REAL APPWRITE METRICS ONLY)
  // -------------------------------------------------------------
  if (action === "admin_get_analytics") {
    await requireAdmin();

    const profRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const profs = ((await profRes.json()).documents || []).filter((profile) => !isExplicitAutomatedTestIdentity(profile));
    const realUserIds = new Set(profs.map((profile) => profile.user_id));
    const passengers = profs.filter(p => ["passenger", "customer"].includes(p.role)).length;
    const providers = profs.filter(p => ["driver", "owner", "cargo_owner", "logistics", "logistics_provider", "vehicle_owner", "machinery_owner"].includes(p.role)).length;

    const now = Date.now();
    const presRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/driver_presence/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const presences = ((await presRes.json()).documents || []).filter((presence) => realUserIds.has(presence.driver_id));
    const activeOnlineProviders = presences.filter(p => (now - new Date(p.last_seen_at).getTime()) <= 180000).length;

    const reqRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/service_requests/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const reqs = ((await reqRes.json()).documents || []).filter((request) => realUserIds.has(request.passenger_id));

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const bks = ((await bkRes.json()).documents || []).filter((booking) =>
      realUserIds.has(booking.passenger_id) && (!booking.driver_id || realUserIds.has(booking.driver_id))
    );
    const completedBks = bks.filter(b => b.status === "completed").length;
    const cancelledBks = bks.filter(b => b.status === "cancelled").length;

    const subRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const subs = ((await subRes.json()).documents || []).filter((subscription) => realUserIds.has(subscription.user_id));
    const activeSubs = subs.filter(s => s.status === "active").length;

    const docRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/verification_documents/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const docs = ((await docRes.json()).documents || []).filter((document) => realUserIds.has(document.user_id));
    const pendingDocs = docs.filter(d => (!d.verification_status || d.verification_status === "pending" || d.verification_status === "unverified")).length;
    const expiredDocs = docs.filter((document) => effectiveDocumentStatus(document) === "expired").length;
    const vehicleRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/vehicles/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const vehicles = ((await vehicleRes.json()).documents || []).filter((vehicle) => realUserIds.has(vehicle.driver_id));
    const pendingVehicles = vehicles.filter((vehicle) => PENDING_VERIFICATION_STATUSES.has(normalizedVerificationStatus(vehicle.verification_status, "vehicle"))).length;
    const pendingProviders = profs.filter((profile) =>
      PROVIDER_ROLES.has(profile.role) && PENDING_VERIFICATION_STATUSES.has(normalizedVerificationStatus(profile.verification_status, "profile"))
    ).length;

    const payRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const pays = ((await payRes.json()).documents || []).filter((payment) => realUserIds.has(payment.user_id));
    const totalPaid = pays
      .filter(p => p.status === "paid" || p.status === "completed")
      .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    const dispRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/disputes/documents?queries[]=${buildLimitQuery(100)}`,
      { headers: serverHeaders }
    );
    const disps = (await dispRes.json()).documents || [];
    const openDisputes = disps.filter(d => d.status === "open").length;

    return {
      registered_passengers: passengers,
      registered_providers: providers,
      active_providers: activeOnlineProviders,
      requests_posted: reqs.length,
      bookings_awarded: bks.length,
      completed_bookings: completedBks,
      cancelled_bookings: cancelledBks,
      active_subscriptions: activeSubs,
      verification_queue: pendingProviders + pendingVehicles + pendingDocs,
      pending_providers: pendingProviders,
      pending_vehicles: pendingVehicles,
      pending_documents: pendingDocs,
      expired_documents: expiredDocs,
      payment_totals: parseFloat(totalPaid.toFixed(2)),
      open_disputes: openDisputes,
      total_profiles: profs.length
    };
  }

  // -------------------------------------------------------------
  // ACTION: admin_get_activity_logs
  // -------------------------------------------------------------
  if (action === "admin_get_activity_logs") {
    await requireAdmin();
    const lRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/activity_logs/documents?queries[]=${buildOrderDescQuery("created_at")}&queries[]=${buildLimitQuery(50)}`,
      { headers: serverHeaders }
    );
    const d = await lRes.json();
    return { logs: (d.documents || []).map(log => ({ ...log, id: log.$id })) };
  }

  // -------------------------------------------------------------
  // ACTION: get_booking_receipt (VIEW / DOWNLOAD REAL RECEIPT)
  // -------------------------------------------------------------
  if (action === "get_booking_receipt") {
    const bookingId = data.booking_id || data.bookingId;
    if (!bookingId) throw new Error("Missing required parameter: booking_id");

    const bkRes = await fetch(
      `${creds.endpoint}/databases/transmove/collections/bookings/documents/${bookingId}`,
      { headers: serverHeaders }
    );
    if (!bkRes.ok) throw new Error("Booking not found.");
    const bkDoc = await bkRes.json();

    const callerProf = await getCallerProfile();
    const isAdmin = callerProf?.role === "admin";
    const isPassenger = bkDoc.passenger_id === verifiedUser.$id;
    const isDriver = bkDoc.driver_id === verifiedUser.$id;

    if (!isAdmin && !isPassenger && !isDriver) {
      throw new Error("Forbidden: You cannot view receipt for this booking.");
    }

    let request = null;
    try {
      const rRes = await fetch(
        `${creds.endpoint}/databases/transmove/collections/service_requests/documents/${bkDoc.request_id}`,
        { headers: serverHeaders }
      );
      if (rRes.ok) request = await rRes.json();
    } catch (_) {}

    let driver = null;
    let passenger = null;
    try {
      const dpQ = buildEqualQuery("user_id", bkDoc.driver_id);
      const dpRes = await fetch(`${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${dpQ}`, { headers: serverHeaders });
      driver = (await dpRes.json()).documents?.[0] || null;

      const ppQ = buildEqualQuery("user_id", bkDoc.passenger_id);
      const ppRes = await fetch(`${creds.endpoint}/databases/transmove/collections/profiles/documents?queries[]=${ppQ}`, { headers: serverHeaders });
      passenger = (await ppRes.json()).documents?.[0] || null;
    } catch (_) {}

    let vehicle = null;
    try {
      if (bkDoc.vehicle_id) {
        const vRes = await fetch(`${creds.endpoint}/databases/transmove/collections/vehicles/documents/${bkDoc.vehicle_id}`, { headers: serverHeaders });
        if (vRes.ok) vehicle = await vRes.json();
      }
    } catch (_) {}

    let paymentRecord = null;
    try {
      const bPayQ = buildEqualQuery("booking_id", bookingId);
      const payRes = await fetch(`${creds.endpoint}/databases/transmove/collections/payments/documents?queries[]=${bPayQ}`, { headers: serverHeaders });
      const payData = await payRes.json();
      paymentRecord = payData.documents?.[0] || null;
    } catch (_) {}

    const isPaid = paymentRecord?.status === "paid" || paymentRecord?.status === "completed";
    const paymentStatus = isPaid ? "PAID" : "UNPAID / DIRECT SETTLEMENT";

    return {
      receipt_id: `RCP-${bkDoc.$id.slice(0, 8).toUpperCase()}`,
      booking_id: bkDoc.$id,
      date: bkDoc.completed_at || bkDoc.created_at,
      service_type: request?.service_type || "transport",
      pickup: request?.pickup_location || "Pickup",
      destination: request?.destination || "Destination",
      passenger_name: passenger?.full_name || "Valued Passenger",
      driver_name: driver?.full_name || "Verified Provider",
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})` : "Verified Vehicle",
      amount: parseFloat(bkDoc.amount || 0).toFixed(2),
      currency: "USD",
      booking_status: bkDoc.status,
      payment_status: paymentStatus,
      paid: isPaid,
      created_at: bkDoc.created_at
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
      err.message.includes("Cannot withdraw") ||
      err.message.includes("already") ||
      err.message.includes("PIN") ||
      err.message.includes("expired") ||
      err.message.includes("modify another") ||
      err.message.includes("delete another");

    const isForbidden =
      err.message.includes("Forbidden") ||
      err.message.includes("participant") ||
      err.message.includes("not own") ||
      err.message.includes("Receiver must be") ||
      err.message.includes("modify another") ||
      err.message.includes("delete another");

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
