// ==============================================================================
// TRANSMOVE SUPABASE TRUSTED BACKEND ENGINE
// Runs securely on Render (and local Node server).
// Handles all privileged operations, Supabase PostgreSQL relational transactions,
// Google Drive file storage, and security-sensitive business rules.
//
// SUPABASE_SERVICE_ROLE_KEY is kept strictly server-side.
// ==============================================================================

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { googleDriveStorage, DRIVE_FOLDERS } from "./google-drive-storage.js";

// Service category matching table
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

export function isVehicleCompatibleWithRequest(vehicleCategory, requestServiceType) {
  if (!vehicleCategory || !requestServiceType) return false;
  const vCat = String(vehicleCategory).toLowerCase().trim();
  const reqType = String(requestServiceType).toLowerCase().trim();
  const allowed = SERVICE_TYPE_TO_VEHICLE_CATEGORIES[reqType] || ["general_transport"];
  return allowed.includes(vCat) || vCat === "general_transport";
}

const isUuid = (value) => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const positiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// Initial seed data for payment destinations & subscription plans
export const DEFAULT_PAYMENT_DESTINATIONS = [
  {
    id: "dest_ecocash_merchant_01",
    provider: "ecocash",
    account_name: "TransMove Logistics PVT LTD (Merchant)",
    account_number: "*151*2*2*123456#",
    instructions: "Dial *151*2*2*123456*AMOUNT# -> Enter PIN -> Save SMS reference code & upload screenshot.",
    active: true,
    display_order: 1
  },
  {
    id: "dest_ecocash_biller_02",
    provider: "ecocash",
    account_name: "TransMove Operations (Biller Code 78901)",
    account_number: "78901",
    instructions: "Dial *151*2*1# -> Enter Biller Code 78901 -> Enter Account (Your Phone) -> Enter Amount.",
    active: true,
    display_order: 2
  },
  {
    id: "dest_innbucks_03",
    provider: "innbucks",
    account_name: "TransMove Collections",
    account_number: "+263771234567",
    instructions: "Send to InnBucks agent/app to +263771234567. Include your TransMove registered phone as reference.",
    active: true,
    display_order: 3
  }
];

export const DEFAULT_SUBSCRIPTION_PLANS = [
  {
    id: "plan_flex_pass",
    name: "Flex Pass",
    slug: "flex-pass",
    description: "7 days bidding access for casual operators",
    price: 5.0,
    currency: "USD",
    duration_days: 7,
    active: true,
    recommended: false,
    display_order: 1,
    features: ["Full bidding access for 7 days", "Standard search placement", "Direct chat with customers"]
  },
  {
    id: "plan_professional",
    name: "TransMove Professional",
    slug: "professional",
    description: "30 days unlimited bidding and priority matching",
    price: 15.0,
    currency: "USD",
    duration_days: 30,
    active: true,
    recommended: true,
    display_order: 2,
    features: ["Unlimited bidding for 30 days", "Priority matching & 10s notifications", "Direct phone & chat", "Verified provider badge"]
  },
  {
    id: "plan_pro_90",
    name: "Pro 90",
    slug: "pro-90",
    description: "Quarterly savings for active fleet operators",
    price: 40.0,
    currency: "USD",
    duration_days: 90,
    active: true,
    recommended: false,
    display_order: 3,
    features: ["Full bidding for 90 days (save $5)", "Featured directory placement", "Priority dispute resolution"]
  },
  {
    id: "plan_pro_annual",
    name: "Pro Annual",
    slug: "pro-annual",
    description: "Best annual value with dedicated support",
    price: 140.0,
    currency: "USD",
    duration_days: 365,
    active: true,
    recommended: false,
    display_order: 4,
    features: ["Full bidding for 365 days (save $40)", "Gold Verified Provider badge", "Dedicated support line"]
  }
];

class SupabaseBackendEngine {
  constructor() {
    this.supabaseAdmin = null;
    this.isLive = false;
    this.localDbFile = path.resolve(process.cwd(), "storage", "supabase_local_db.json");
    this.db = {
      profiles: [],
      vehicles: [],
      vehicle_photos: [],
      verification_documents: [],
      driver_presence: [],
      service_requests: [],
      request_images: [],
      bids: [],
      bid_negotiations: [],
      bookings: [],
      booking_events: [],
      messages: [],
      notifications: [],
      reviews: [],
      favourites: [],
      subscription_plans: [...DEFAULT_SUBSCRIPTION_PLANS],
      subscriptions: [],
      payment_destinations: [...DEFAULT_PAYMENT_DESTINATIONS],
      payments: [],
      advertising_campaigns: [],
      activity_logs: [],
      saved_addresses: []
    };
    this._init();
  }

  _init() {
    this._loadLocalDb();
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (url && serviceKey && url.startsWith("https://") && !url.includes("your-project")) {
      try {
        this.supabaseAdmin = createClient(url, serviceKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        this.isLive = true;
        console.log("[SupabaseBackend] Initialized Supabase client for:", url);
      } catch (err) {
        console.warn("[SupabaseBackend] Falling back to local relational store:", err.message);
        this.isLive = false;
      }
    } else {
      console.log("[SupabaseBackend] Operating in verified local relational store mode.");
      this.isLive = false;
    }
  }

  _loadLocalDb() {
    try {
      if (fs.existsSync(this.localDbFile)) {
        const raw = fs.readFileSync(this.localDbFile, "utf8");
        const parsed = JSON.parse(raw);
        this.db = { ...this.db, ...parsed };
      }
    } catch (_) {}
  }

  _persistLocalDb() {
    try {
      const dir = path.dirname(this.localDbFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.localDbFile, JSON.stringify(this.db, null, 2), "utf8");
    } catch (_) {}
  }

  async _hydrateBooking(booking) {
    if (!booking) return null;
    const b = { ...booking };
    b.amount = Number(b.amount !== undefined && b.amount !== null ? b.amount : (b.final_price || 0));

    // Hydrate driver
    if (!b.driver || !b.driver.full_name) {
      if (b.driver_id && this.isLive && this.supabaseAdmin) {
        try {
          const { data: prof } = await this.supabaseAdmin
            .from("profiles")
            .select("id, full_name, phone, profile_image_id, profile_photo_url, rating_avg, rating_count, verification_status")
            .eq("id", b.driver_id)
            .single();
          if (prof) b.driver = prof;
        } catch (_) {}
      }
      if (!b.driver || !b.driver.full_name) {
        const localProf = (this.db.profiles || []).find((p) => (p.id === b.driver_id || p.user_id === b.driver_id));
        if (localProf) {
          b.driver = localProf;
        } else {
          b.driver = { id: b.driver_id, full_name: "Assigned Driver" };
        }
      }
    }

    // Hydrate vehicle
    if (!b.vehicle || !b.vehicle.make) {
      const vId = b.vehicle_id;
      if (vId && this.isLive && this.supabaseAdmin) {
        try {
          const { data: veh } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, make, model, year, colour, registration_number, verification_status")
            .eq("id", vId)
            .single();
          if (veh) b.vehicle = veh;
        } catch (_) {}
      }
      if (!b.vehicle && b.driver_id && this.isLive && this.supabaseAdmin) {
        try {
          const { data: primaryVeh } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, make, model, year, colour, registration_number, verification_status")
            .eq("driver_id", b.driver_id)
            .eq("is_primary", true)
            .limit(1);
          if (primaryVeh && primaryVeh.length > 0) b.vehicle = primaryVeh[0];
        } catch (_) {}
      }
      if (!b.vehicle || !b.vehicle.make) {
        const localVeh = (this.db.vehicles || []).find((v) => v.id === b.vehicle_id || (v.driver_id === b.driver_id && v.is_primary));
        if (localVeh) {
          b.vehicle = localVeh;
        }
      }
    }

    // Hydrate request
    if (!b.request || !b.request.pickup_location) {
      if (b.request_id && this.isLive && this.supabaseAdmin) {
        try {
          const { data: req } = await this.supabaseAdmin
            .from("service_requests")
            .select("*")
            .eq("id", b.request_id)
            .single();
          if (req) b.request = req;
        } catch (_) {}
      }
      if (!b.request) {
        const localReq = (this.db.service_requests || []).find((r) => r.id === b.request_id);
        if (localReq) b.request = localReq;
      }
    }

    // Hydrate passenger
    if (!b.passenger && b.passenger_id) {
      if (this.isLive && this.supabaseAdmin) {
        try {
          const { data: pass } = await this.supabaseAdmin
            .from("profiles")
            .select("id, full_name, phone, profile_image_id, profile_photo_url")
            .eq("id", b.passenger_id)
            .single();
          if (pass) b.passenger = pass;
        } catch (_) {}
      }
      if (!b.passenger) {
        const localPass = (this.db.profiles || []).find((p) => p.id === b.passenger_id || p.user_id === b.passenger_id);
        if (localPass) b.passenger = localPass;
      }
    }

    return b;
  }

  async _hydrateBid(bid) {
    if (!bid) return null;
    const b = { ...bid };
    b.id = b.id || b.$id;
    b.$id = b.id;
    const useSupabase = Boolean(this.isLive && this.supabaseAdmin && isUuid(b.request_id));

    let latestNeg = null;
    if (useSupabase) {
      const { data: negs, error: negError } = await this.supabaseAdmin
        .from("bid_negotiations")
        .select("*")
        .eq("bid_id", b.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (negError) throw new Error(`Failed to hydrate bid negotiation: ${negError.message}`);
      latestNeg = negs?.[0] || null;
    } else {
      latestNeg = (this.db.bid_negotiations || [])
        .filter((n) => n.bid_id === b.id)
        .sort((a, b2) => new Date(b2.created_at) - new Date(a.created_at))[0] || null;
    }

    if (latestNeg) {
      b.counter_amount = positiveNumber(latestNeg.counter_amount);
      b.negotiation_status = latestNeg.status === "accepted"
        ? "accepted"
        : (latestNeg.sender_role === "driver" ? "countered_by_driver" : "countered_by_passenger");
    }

    b.original_amount = positiveNumber(b.amount) || positiveNumber(b.proposed_price);
    b.amount = positiveNumber(b.counter_amount) || b.original_amount;
    b.current_amount = b.amount;
    const eta = Number.parseInt(b.estimated_arrival_minutes ?? b.estimated_arrival_mins ?? b.arrival_minutes ?? b.eta, 10);
    b.arrival_minutes = Number.isFinite(eta) && eta > 0 ? eta : 15;
    b.estimated_arrival_minutes = b.arrival_minutes;
    b.estimated_arrival_mins = b.arrival_minutes;

    if (useSupabase) {
      const { data: profile, error: profileError } = await this.supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, profile_image_id, profile_photo_url, rating_avg, rating_count, verification_status")
        .eq("id", b.driver_id)
        .maybeSingle();
      if (profileError) throw new Error(`Failed to hydrate driver profile: ${profileError.message}`);
      b.driver = profile ? {
        ...profile,
        rating: Number(profile.rating_avg || 0),
        review_count: Number(profile.rating_count || 0),
        is_verified: profile.verification_status === "approved"
      } : null;

      let vehicle = null;
      if (b.vehicle_id) {
        const { data, error } = await this.supabaseAdmin
          .from("vehicles")
          .select("id, driver_id, make, model, year, colour, registration_number, vehicle_type, service_category, verification_status, is_primary")
          .eq("id", b.vehicle_id)
          .eq("driver_id", b.driver_id)
          .maybeSingle();
        if (error) throw new Error(`Failed to hydrate bid vehicle: ${error.message}`);
        vehicle = data;
      }
      if (!vehicle) {
        const { data, error } = await this.supabaseAdmin
          .from("vehicles")
          .select("id, driver_id, make, model, year, colour, registration_number, vehicle_type, service_category, verification_status, is_primary")
          .eq("driver_id", b.driver_id)
          .in("verification_status", ["approved", "verified"])
          .order("is_primary", { ascending: false })
          .limit(1);
        if (error) throw new Error(`Failed to resolve bid vehicle: ${error.message}`);
        vehicle = data?.[0] || null;
      }
      if (vehicle) {
        const { data: photos, error: photoError } = await this.supabaseAdmin
          .from("vehicle_photos")
          .select("id, vehicle_id, storage_provider, drive_file_id, original_filename, file_url, is_primary, created_at")
          .eq("vehicle_id", vehicle.id)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true });
        if (photoError) throw new Error(`Failed to hydrate bid vehicle photos: ${photoError.message}`);
        vehicle.photos = photos || [];
        vehicle.primary_photo = vehicle.photos.find((photo) => photo.is_primary) || vehicle.photos[0] || null;
        vehicle.photo_url = vehicle.primary_photo?.file_url || null;
      }
      b.vehicle = vehicle;
    } else {
      const localProfile = (this.db.profiles || []).find((p) => p.id === b.driver_id || p.user_id === b.driver_id);
      b.driver = localProfile ? {
        ...localProfile,
        rating: Number(localProfile.rating_avg || localProfile.rating || 0),
        review_count: Number(localProfile.rating_count || localProfile.review_count || 0),
        is_verified: localProfile.verification_status === "approved" || localProfile.is_verified === true
      } : (b.driver || null);
      const localVehicles = (this.db.vehicles || []).filter((v) => v.driver_id === b.driver_id);
      b.vehicle = localVehicles.find((v) => v.id === b.vehicle_id) ||
        localVehicles.find((v) => v.is_primary) || localVehicles[0] || b.vehicle || null;
      if (b.vehicle) {
        const photos = (this.db.vehicle_photos || []).filter((photo) => photo.vehicle_id === b.vehicle.id);
        b.vehicle.photos = photos;
        b.vehicle.primary_photo = photos.find((photo) => photo.is_primary) || photos[0] || null;
        b.vehicle.photo_url = b.vehicle.primary_photo?.file_url || null;
      }
    }

    if (b.vehicle) b.vehicle.plate_number = b.vehicle.registration_number || b.vehicle.plate_number || "";
    return b;
  }

  async _loadBidRecord(bidId) {
    if (!bidId) return null;
    if (this.isLive && this.supabaseAdmin && isUuid(bidId)) {
      const { data, error } = await this.supabaseAdmin.from("bids").select("*").eq("id", bidId).maybeSingle();
      if (error) throw new Error(`Failed to load bid from Supabase: ${error.message}`);
      if (data) return { record: data, authoritative: true };
    }
    const local = (this.db.bids || []).find((b) => b.id === bidId || b.$id === bidId);
    if (local && (!this.isLive || !isUuid(local.request_id))) return { record: local, authoritative: false };
    return null;
  }

  async _loadRequestRecord(requestId) {
    if (!requestId) return null;
    if (this.isLive && this.supabaseAdmin && isUuid(requestId)) {
      const { data, error } = await this.supabaseAdmin.from("service_requests").select("*").eq("id", requestId).maybeSingle();
      if (error) throw new Error(`Failed to load service request from Supabase: ${error.message}`);
      return data ? { record: data, authoritative: true } : null;
    }
    const local = (this.db.service_requests || []).find((r) => r.id === requestId || r.$id === requestId);
    return local ? { record: local, authoritative: false } : null;
  }

  async authenticateUser(jwt) {
    if (!jwt) throw new Error("Missing Authorization token.");

    // Check live Supabase Auth
    if (this.isLive && this.supabaseAdmin) {
      try {
        const { data: { user }, error } = await this.supabaseAdmin.auth.getUser(jwt);
        if (!error && user) {
          return { id: user.id, email: user.email, name: user.user_metadata?.full_name || "", auth_source: "supabase" };
        }
      } catch (_) {}
    }

    // Parse standard JWT payload if running locally/testing
    try {
      const parts = jwt.split(".");
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        const uid = payload.sub || payload.user_id || payload.id;
        const email = payload.email || "";
        if (uid) return { id: uid, email, name: payload.user_metadata?.full_name || "" };
      }
    } catch (_) {}

    // Check if jwt is a direct test mock ID
    if (jwt.startsWith("test_") || jwt.startsWith("usr_") || jwt.startsWith("driver_") || jwt.startsWith("passenger_") || jwt.startsWith("admin_")) {
      const stripped = jwt.replace(/^(driver_|passenger_|admin_|test_|usr_)/, "");
      const finalId = stripped || jwt;
      return { id: finalId, email: `${jwt}@transmove.test`, name: "Test User" };
    }

    throw new Error("Unauthorized: Invalid or expired authentication token.");
  }

  async getCallerProfile(userId) {
    if (!userId) return null;

    if (this.isLive && this.supabaseAdmin) {
      try {
        const { data, error } = await this.supabaseAdmin
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (!error && data) {
          const existingIdx = this.db.profiles.findIndex((p) => p.id === userId || p.user_id === userId);
          if (existingIdx !== -1) {
            this.db.profiles[existingIdx] = data;
          } else {
            this.db.profiles.push(data);
          }
          this._persistLocalDb();
          return data;
        }
      } catch (_) {}
    }

    const localProf = this.db.profiles.find((p) => p.id === userId || p.user_id === userId);
    return localProf || null;
  }

  // ---------------------------------------------------------------------------
  // MAIN DISPATCHER
  // ---------------------------------------------------------------------------
  async execute({ action, data = {}, vehicle_id, request_id, jwt }) {
    const publicActions = [
      "list_payment_destinations",
      "list_subscription_plans",
      "get_driver_reviews",
      "get_public_provider_profile"
    ];

    let verifiedUser = null;
    if (jwt) {
      try {
        verifiedUser = await this.authenticateUser(jwt);
      } catch (err) {
        if (!publicActions.includes(action)) throw err;
      }
    } else if (!publicActions.includes(action)) {
      throw new Error("Unauthorized: Authentication token is missing.");
    }

    const userId = verifiedUser?.id || null;
    const authoritativeCaller = Boolean(
      verifiedUser?.auth_source === "supabase" && this.isLive && this.supabaseAdmin && isUuid(userId)
    );

    // Helper: log activity
    const logActivity = async (activityType, title, description = "", relatedId = "") => {
      const logRow = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId || "system",
        activity_type: activityType,
        title,
        description,
        related_id: relatedId,
        created_at: new Date().toISOString()
      };
      this.db.activity_logs.unshift(logRow);
      this._persistLocalDb();
    };

    // Helper: get caller profile
    const getCallerProfile = async () => this.getCallerProfile(userId);

    const requireAdmin = async () => {
      const profile = await getCallerProfile();
      if (!profile || profile.role !== "admin" || profile.account_status !== "active") {
        throw new Error("Forbidden: Active administrator privileges required.");
      }
      return profile;
    };

    // =========================================================================
    // 1. PROFILES
    // =========================================================================
    if (action === "get_profile") {
      const profile = await getCallerProfile();
      if (!profile) throw new Error("Profile not found.");
      return profile;
    }

    if (action === "create_profile") {
      const derivedUserId = verifiedUser.id;
      const derivedEmail = verifiedUser.email || "";

      const privilegedFields = ["user_id", "email", "account_status", "verification_status", "created_at", "updated_at"];
      for (const field of privilegedFields) {
        if (data[field] !== undefined) {
          throw new Error(`Privilege escalation blocked: Cannot supply '${field}' during profile creation.`);
        }
      }
      if (data.role === "admin") {
        throw new Error("Privilege escalation blocked: Cannot create profile with admin role.");
      }

      const existing = this.db.profiles.find((p) => p.id === derivedUserId || p.user_id === derivedUserId);
      if (existing) return existing;

      const newProfile = {
        id: derivedUserId,
        user_id: derivedUserId,
        email: derivedEmail,
        full_name: data.full_name ? String(data.full_name).trim() : (data.fullName ? String(data.fullName).trim() : (verifiedUser.name || "TransMove User")),
        phone: data.phone ? String(data.phone).trim() : (data.phoneNumber ? String(data.phoneNumber).trim() : ""),
        phone_number: data.phone ? String(data.phone).trim() : (data.phoneNumber ? String(data.phoneNumber).trim() : ""),
        city: data.city ? String(data.city).trim() : (data.service_area ? String(data.service_area).trim() : ""),
        service_area: data.city ? String(data.city).trim() : (data.service_area ? String(data.service_area).trim() : ""),
        bio: data.bio ? String(data.bio).trim() : "",
        role: data.role || "customer",
        profile_image_id: data.profile_image_id || "",
        profile_photo_url: data.profile_photo_url || "",
        account_status: "active",
        verification_status: "unverified",
        verification_rejection_reason: "",
        rating_avg: 0.0,
        rating_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      this.db.profiles.push(newProfile);
      this._persistLocalDb();
      await logActivity("profile_created", "Profile created", `Role: ${newProfile.role}`, newProfile.id);
      return newProfile;
    }

    if (action === "update_profile") {
      const privilegedFields = ["role", "account_status", "verification_status", "user_id", "email", "created_at"];
      for (const field of privilegedFields) {
        if (data[field] !== undefined) {
          throw new Error(`Privilege escalation blocked: Modifying field '${field}' is strictly forbidden.`);
        }
      }

      const idx = this.db.profiles.findIndex((p) => p.id === userId || p.user_id === userId);
      if (idx === -1) throw new Error("Profile not found.");

      const current = this.db.profiles[idx];
      if (data.full_name !== undefined) current.full_name = String(data.full_name).trim();
      if (data.phone !== undefined) {
        current.phone = String(data.phone).trim();
        current.phone_number = current.phone;
      }
      if (data.city !== undefined) {
        current.city = String(data.city).trim();
        current.service_area = current.city;
      }
      if (data.bio !== undefined) current.bio = String(data.bio).trim();
      if (data.profile_image_id !== undefined) current.profile_image_id = String(data.profile_image_id).trim();
      if (data.profile_photo_url !== undefined) current.profile_photo_url = String(data.profile_photo_url).trim();
      current.updated_at = new Date().toISOString();

      this._persistLocalDb();
      return current;
    }

    // =========================================================================
    // 2. VEHICLES
    // =========================================================================
    if (action === "create_vehicle") {
      // 1. Reject client from setting privileged fields
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

      const now = new Date().toISOString();
      let isPrimary = data.is_primary === true;

      if (this.isLive && this.supabaseAdmin) {
        const { data: driverVehs, error: countErr } = await this.supabaseAdmin
          .from("vehicles")
          .select("id, is_primary")
          .eq("driver_id", userId);

        if (countErr) {
          throw new Error(`Failed to check existing vehicles in Supabase: ${countErr.message}`);
        }

        const existingCount = (driverVehs || []).length;
        if (existingCount === 0) {
          isPrimary = true;
        } else if (isPrimary) {
          const { error: unsetErr } = await this.supabaseAdmin
            .from("vehicles")
            .update({ is_primary: false, updated_at: now })
            .eq("driver_id", userId);
          if (unsetErr) {
            throw new Error(`Failed to unset primary vehicle in Supabase: ${unsetErr.message}`);
          }
        }
      } else {
        const existingVehicles = this.db.vehicles.filter((v) => v.driver_id === userId);
        if (existingVehicles.length === 0) {
          isPrimary = true;
        } else if (isPrimary) {
          existingVehicles.forEach((v) => { v.is_primary = false; });
        }
      }

      const newVehicleData = {
        driver_id: userId,
        vehicle_type: data.vehicle_type || "sedan",
        make: String(data.make).trim(),
        model: String(data.model).trim(),
        year: data.year ? parseInt(data.year, 10) : new Date().getFullYear(),
        colour: data.colour || data.color || "White",
        registration_number: String(data.registration_number).toUpperCase().trim(),
        passenger_capacity: data.passenger_capacity ? parseInt(data.passenger_capacity, 10) : 4,
        load_capacity: data.load_capacity ? parseFloat(data.load_capacity) : 0,
        service_category: data.service_category || "passenger_transport",
        description: data.description || "",
        status: data.status || "active",
        verification_status: "pending",
        rejection_reason: null,
        is_primary: isPrimary,
        created_at: now,
        updated_at: now
      };

      let createdVehicle = null;

      if (this.isLive && this.supabaseAdmin) {
        const { data: inserted, error: insertErr } = await this.supabaseAdmin
          .from("vehicles")
          .insert([newVehicleData])
          .select()
          .single();

        if (insertErr || !inserted) {
          throw new Error(`Failed to create vehicle in Supabase: ${insertErr?.message || "Unknown error"}`);
        }
        createdVehicle = inserted;
      } else {
        createdVehicle = { id: randomUUID(), ...newVehicleData };
      }

      // Sync local mirror
      if (isPrimary && this.db.vehicles) {
        this.db.vehicles.filter((v) => v.driver_id === userId).forEach((v) => { v.is_primary = false; });
      }
      this.db.vehicles.push(createdVehicle);
      this._persistLocalDb();

      await logActivity("vehicle_created", "Vehicle submitted for review", `${createdVehicle.make} ${createdVehicle.model}`, createdVehicle.id);
      return createdVehicle;
    }

    if (action === "get_vehicle") {
      const targetId = vehicle_id || data.vehicle_id || data.id;
      if (!targetId) throw new Error("Missing vehicle_id parameter.");

      let veh = null;
      let photos = [];

      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVeh, error: vehErr } = await this.supabaseAdmin
          .from("vehicles")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();

        if (vehErr) throw new Error(`Failed to fetch vehicle from Supabase: ${vehErr.message}`);
        veh = cloudVeh;

        if (veh) {
          const { data: cloudPhotos } = await this.supabaseAdmin
            .from("vehicle_photos")
            .select("*")
            .eq("vehicle_id", targetId);
          photos = cloudPhotos || [];
        }
      } else {
        veh = this.db.vehicles.find((v) => v.id === targetId);
        photos = (this.db.vehicle_photos || []).filter((p) => p.vehicle_id === targetId);
      }

      if (!veh) throw new Error("Vehicle not found.");

      const caller = await getCallerProfile();
      if (veh.driver_id !== userId && caller?.role !== "admin") {
        throw new Error("Forbidden: You do not have permission to view this vehicle.");
      }

      const photoUrls = photos.map((p) => p.file_url || `/api/files/preview/${p.drive_file_id || p.file_id}`);
      return {
        ...veh,
        photos: photoUrls,
        photo_documents: photos
      };
    }

    if (action === "update_vehicle") {
      const targetId = vehicle_id || data.vehicle_id || data.id;
      if (!targetId) throw new Error("Missing vehicle_id parameter.");

      let existing = null;
      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVeh, error } = await this.supabaseAdmin
          .from("vehicles")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();
        if (error) throw new Error(`Failed to find vehicle in Supabase: ${error.message}`);
        existing = cloudVeh;
      } else {
        existing = this.db.vehicles.find((v) => v.id === targetId);
      }

      if (!existing) throw new Error("Vehicle not found.");
      if (existing.driver_id !== userId) throw new Error("Forbidden: You do not own this vehicle.");

      const privilegedFields = ["driver_id", "verification_status", "created_at"];
      for (const field of privilegedFields) {
        if (data[field] !== undefined) {
          throw new Error(`Privilege escalation blocked: Cannot modify vehicle '${field}'.`);
        }
      }

      const now = new Date().toISOString();
      const updates = { updated_at: now };
      if (data.make !== undefined) updates.make = String(data.make).trim();
      if (data.model !== undefined) updates.model = String(data.model).trim();
      if (data.year !== undefined) updates.year = parseInt(data.year, 10);
      if (data.colour !== undefined || data.color !== undefined) updates.colour = String(data.colour || data.color).trim();
      if (data.registration_number !== undefined) updates.registration_number = String(data.registration_number).toUpperCase().trim();
      if (data.passenger_capacity !== undefined) updates.passenger_capacity = parseInt(data.passenger_capacity, 10);
      if (data.load_capacity !== undefined) updates.load_capacity = parseFloat(data.load_capacity);
      if (data.service_category !== undefined) updates.service_category = String(data.service_category).trim();
      if (data.description !== undefined) updates.description = String(data.description).trim();
      if (data.status !== undefined) updates.status = String(data.status).trim();
      updates.verification_status = "pending";

      let updated = null;
      if (this.isLive && this.supabaseAdmin) {
        const { data: updatedCloud, error: updateErr } = await this.supabaseAdmin
          .from("vehicles")
          .update(updates)
          .eq("id", targetId)
          .select()
          .single();

        if (updateErr || !updatedCloud) {
          throw new Error(`Failed to update vehicle in Supabase: ${updateErr?.message || "Unknown error"}`);
        }
        updated = updatedCloud;
      } else {
        Object.assign(existing, updates);
        updated = existing;
      }

      const localIdx = this.db.vehicles.findIndex((v) => v.id === targetId);
      if (localIdx !== -1) {
        this.db.vehicles[localIdx] = { ...this.db.vehicles[localIdx], ...updates };
      }
      this._persistLocalDb();

      return updated;
    }

    if (action === "set_primary_vehicle") {
      const targetId = vehicle_id || data.vehicle_id || data.id;
      if (!targetId) throw new Error("Missing vehicle_id parameter.");

      let existing = null;
      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVeh, error } = await this.supabaseAdmin
          .from("vehicles")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();
        if (error) throw new Error(`Failed to find vehicle in Supabase: ${error.message}`);
        existing = cloudVeh;
      } else {
        existing = this.db.vehicles.find((v) => v.id === targetId);
      }

      if (!existing) throw new Error("Vehicle not found.");
      if (existing.driver_id !== userId) throw new Error("Forbidden: You do not own this vehicle.");

      const now = new Date().toISOString();

      if (this.isLive && this.supabaseAdmin) {
        const { error: unsetErr } = await this.supabaseAdmin
          .from("vehicles")
          .update({ is_primary: false, updated_at: now })
          .eq("driver_id", userId);
        if (unsetErr) throw new Error(`Failed to unset primary vehicles in Supabase: ${unsetErr.message}`);

        const { error: setErr } = await this.supabaseAdmin
          .from("vehicles")
          .update({ is_primary: true, updated_at: now })
          .eq("id", targetId);
        if (setErr) throw new Error(`Failed to set primary vehicle in Supabase: ${setErr.message}`);
      }

      this.db.vehicles.filter((v) => v.driver_id === userId).forEach((v) => {
        v.is_primary = v.id === targetId;
      });
      this._persistLocalDb();

      return { success: true, primary_vehicle_id: targetId };
    }

    if (action === "delete_vehicle") {
      const targetId = vehicle_id || data.vehicle_id || data.id;
      if (!targetId) throw new Error("Missing vehicle_id parameter.");

      let existing = null;
      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVeh, error } = await this.supabaseAdmin
          .from("vehicles")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();
        if (error) throw new Error(`Failed to find vehicle in Supabase: ${error.message}`);
        existing = cloudVeh;
      } else {
        existing = this.db.vehicles.find((v) => v.id === targetId);
      }

      if (!existing) throw new Error("Vehicle not found.");
      if (existing.driver_id !== userId) throw new Error("Forbidden: You do not own this vehicle.");

      if (this.isLive && this.supabaseAdmin) {
        try {
          await this.supabaseAdmin.from("vehicle_photos").delete().eq("vehicle_id", targetId);
        } catch (_) {}

        const { error: delErr } = await this.supabaseAdmin
          .from("vehicles")
          .delete()
          .eq("id", targetId);
        if (delErr) throw new Error(`Failed to delete vehicle from Supabase: ${delErr.message}`);
      }

      const vehIndex = this.db.vehicles.findIndex((v) => v.id === targetId);
      if (vehIndex !== -1) {
        this.db.vehicles.splice(vehIndex, 1);
      }
      this.db.vehicle_photos = (this.db.vehicle_photos || []).filter((p) => p.vehicle_id !== targetId);
      this._persistLocalDb();

      return { success: true };
    }

    if (action === "create_vehicle_photo") {
      const targetVehId = vehicle_id || data.vehicle_id;
      if (!targetVehId) throw new Error("Missing vehicle_id parameter.");

      let veh = null;
      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVeh } = await this.supabaseAdmin
          .from("vehicles")
          .select("id, driver_id")
          .eq("id", targetVehId)
          .maybeSingle();
        veh = cloudVeh;
      } else {
        veh = this.db.vehicles.find((v) => v.id === targetVehId);
      }

      if (veh && veh.driver_id !== userId) throw new Error("Forbidden: You do not own this vehicle.");

      let driveFileId = data.drive_file_id || data.file_id || "";
      let filename = data.original_filename || data.filename || "vehicle_photo.jpg";
      let mimeType = data.mime_type || "image/jpeg";
      let fileSize = data.file_size || 0;

      if (data.file_base64) {
        const fileBuffer = Buffer.from(data.file_base64, "base64");
        const uploadResult = await googleDriveStorage.uploadFile({
          buffer: fileBuffer,
          originalFilename: filename,
          mimeType,
          folderPath: DRIVE_FOLDERS.VEHICLES,
          metadata: { userId, vehicleId: targetVehId }
        });
        driveFileId = uploadResult.id;
        fileSize = uploadResult.size;
        mimeType = uploadResult.mimeType;
      }

      if (!driveFileId) throw new Error("Missing uploaded photo file ID.");

      const isPrimary = Boolean(data.is_primary);
      const photoRecord = {
        id: randomUUID(),
        vehicle_id: targetVehId,
        driver_id: userId,
        storage_provider: "google_drive",
        drive_file_id: driveFileId,
        original_filename: filename,
        file_url: `/api/files/preview/${driveFileId}`,
        is_primary: isPrimary,
        created_at: new Date().toISOString()
      };

      if (!this.db.vehicle_photos) this.db.vehicle_photos = [];
      this.db.vehicle_photos.push(photoRecord);

      if (this.isLive && this.supabaseAdmin) {
        const { error: photoErr } = await this.supabaseAdmin.from("vehicle_photos").insert([photoRecord]);
        if (photoErr) {
          throw new Error(`Failed to save vehicle photo to Supabase: ${photoErr.message}`);
        }
      }

      this._persistLocalDb();
      await logActivity("vehicle_photo_uploaded", "Added vehicle photo", filename, photoRecord.id);
      return photoRecord;
    }

    if (action === "delete_vehicle_photo") {
      const photoId = data.photo_id || data.id;
      if (!photoId) throw new Error("Missing photo_id parameter.");

      const idx = (this.db.vehicle_photos || []).findIndex((p) => p.id === photoId);
      if (idx !== -1) {
        this.db.vehicle_photos.splice(idx, 1);
      }

      if (this.isLive && this.supabaseAdmin) {
        const { error: delErr } = await this.supabaseAdmin.from("vehicle_photos").delete().eq("id", photoId);
        if (delErr) {
          throw new Error(`Failed to delete vehicle photo from Supabase: ${delErr.message}`);
        }
      }

      this._persistLocalDb();
      return { success: true };
    }

    if (action === "list_driver_vehicles") {
      let vehicles = [];
      let photos = [];

      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudVehs, error: vehErr } = await this.supabaseAdmin
          .from("vehicles")
          .select("*")
          .eq("driver_id", userId)
          .order("created_at", { ascending: false });

        if (vehErr) {
          throw new Error(`Failed to query driver vehicles from Supabase: ${vehErr.message}`);
        }
        vehicles = cloudVehs || [];

        if (vehicles.length > 0) {
          const vehIds = vehicles.map((v) => v.id);
          const { data: cloudPhotos } = await this.supabaseAdmin
            .from("vehicle_photos")
            .select("*")
            .in("vehicle_id", vehIds);
          photos = cloudPhotos || [];
        }
      } else {
        vehicles = this.db.vehicles.filter((v) => v.driver_id === userId);
        photos = this.db.vehicle_photos || [];
      }

      const result = vehicles.map((veh) => {
        const vehPhotos = photos.filter((p) => p.vehicle_id === veh.id);
        const photoUrls = vehPhotos.map((p) => p.file_url || `/api/files/preview/${p.drive_file_id || p.file_id}`);
        return {
          ...veh,
          photos: photoUrls,
          photo_documents: vehPhotos
        };
      });
      return { vehicles: result };
    }

    if (action === "upload_profile_picture") {
      let fileBuffer;
      let filename = data.original_filename || data.filename || "profile_avatar.jpg";
      let mimeType = data.mime_type || "image/jpeg";

      if (data.file_base64) {
        fileBuffer = Buffer.from(data.file_base64, "base64");
      } else if (data.buffer) {
        fileBuffer = Buffer.from(data.buffer);
      } else {
        throw new Error("No photo file data provided.");
      }

      const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
      if (!allowedPhotoTypes.has(String(mimeType).toLowerCase())) {
        throw new Error("Profile photo must be a JPG, PNG, or WebP image.");
      }
      if (!fileBuffer.length || fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error("Profile photo must be between 1 byte and 5MB.");
      }

      const upload = await googleDriveStorage.uploadFile({
        buffer: fileBuffer,
        originalFilename: filename,
        mimeType,
        folderPath: DRIVE_FOLDERS.PROFILES || "TransMove/Profiles",
        metadata: { userId, type: "profile_photo" }
      });

      const photoUrl = `/api/files/preview/${upload.id}`;

      const updatedAt = new Date().toISOString();
      let prof = this.db.profiles.find((p) => p.id === userId || p.user_id === userId) || null;

      if (this.isLive && this.supabaseAdmin && isUuid(userId)) {
        const { data: updatedProfile, error: profileError } = await this.supabaseAdmin
          .from("profiles")
          .update({
            profile_photo_url: photoUrl,
            profile_image_id: upload.id,
            updated_at: updatedAt
          })
          .eq("id", userId)
          .select()
          .single();
        if (profileError) {
          await googleDriveStorage.deleteFile(upload.id).catch(() => {});
          throw new Error(`Failed to save profile photo metadata: ${profileError.message}`);
        }
        prof = updatedProfile;
      } else if (!prof) {
        await googleDriveStorage.deleteFile(upload.id).catch(() => {});
        throw new Error("Profile not found.");
      }

      if (prof) {
        prof.profile_photo_url = photoUrl;
        prof.profile_image_id = upload.id;
        prof.updated_at = updatedAt;
        const localIndex = this.db.profiles.findIndex((p) => p.id === userId || p.user_id === userId);
        if (localIndex >= 0) this.db.profiles[localIndex] = { ...this.db.profiles[localIndex], ...prof };
        else this.db.profiles.push({ ...prof });
      }

      this._persistLocalDb();
      await logActivity("profile_photo_updated", "Updated profile picture", filename, upload.id);

      return {
        file_id: upload.id,
        photo_url: photoUrl,
        mime_type: upload.mimeType || mimeType,
        updated_at: updatedAt,
        storage_provider: "google_drive",
        profile: prof
      };
    }

    // =========================================================================
    // 3. VERIFICATION DOCUMENTS (Google Drive storage for physical bytes)
    // =========================================================================
    if (action === "create_verification_document") {
      if (!userId) throw new Error("Authentication required for document upload.");

      // B. Confirm profile belongs to user and role is eligible provider/driver
      const callerProf = await getCallerProfile();
      const eligibleRoles = ["driver", "owner", "vehicle_owner", "machinery_owner", "logistics", "cargo_owner", "provider", "admin"];
      if (!callerProf || !eligibleRoles.includes(callerProf.role)) {
        throw new Error(`Forbidden: User role '${callerProf?.role || "unknown"}' is not eligible for driver/provider verification.`);
      }

      const docType = data.document_type || "driver_licence";
      let driveFileId = data.drive_file_id || data.file_id || "";
      let originalFilename = data.original_filename || data.filename || `${docType}.pdf`;
      let mimeType = data.mime_type || "application/pdf";
      let fileSize = data.file_size || 1024;

      // C. If binary buffer or Base64 file is attached, upload directly to Google Drive
      if (data.file_base64) {
        const fileBuffer = Buffer.from(data.file_base64, "base64");
        const uploadResult = await googleDriveStorage.uploadFile({
          buffer: fileBuffer,
          originalFilename,
          mimeType,
          folderPath: DRIVE_FOLDERS.VERIFICATION_DRIVERS,
          metadata: { userId, documentType: docType }
        });
        driveFileId = uploadResult.id;
        fileSize = uploadResult.size;
        mimeType = uploadResult.mimeType;
      }

      if (!driveFileId) {
        throw new Error("Missing verification document file.");
      }

      // D. Insert corresponding row into public.verification_documents with exact schema
      const docRecord = {
        id: randomUUID(),
        user_id: userId,
        vehicle_id: data.vehicle_id || null,
        document_type: docType,
        storage_provider: "google_drive",
        drive_file_id: driveFileId,
        original_filename: originalFilename,
        mime_type: mimeType,
        file_size: fileSize,
        verification_status: "pending",
        rejection_reason: "",
        expires_at: data.expires_at || null,
        legacy_appwrite_id: null,
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (this.isLive && this.supabaseAdmin) {
        const { error: insertError } = await this.supabaseAdmin
          .from("verification_documents")
          .insert([docRecord]);

        if (insertError) {
          console.error("[supabase-backend] verification_documents insert failed:", insertError);
          // 4. Failure handling: remove uploaded Drive file when metadata persistence fails
          if (driveFileId) {
            try { await googleDriveStorage.deleteFile(driveFileId); } catch (_) {}
          }
          throw new Error(`Failed to record verification document in Supabase: ${insertError.message || insertError.code}`);
        }

        // E. Update public.profiles.verification_status = 'pending'
        const { error: profUpdateError } = await this.supabaseAdmin
          .from("profiles")
          .update({
            verification_status: "pending",
            updated_at: new Date().toISOString()
          })
          .eq("id", userId);

        if (profUpdateError) {
          console.error("[supabase-backend] profile status update failed:", profUpdateError);
          throw new Error(`Verification document saved, but profile status update failed: ${profUpdateError.message || profUpdateError.code}`);
        }
      }

      // Mirror to local relational store
      this.db.verification_documents.push(docRecord);
      const prof = this.db.profiles.find((p) => p.id === userId || p.user_id === userId);
      if (prof && prof.verification_status !== "approved") {
        prof.verification_status = "pending";
        prof.updated_at = new Date().toISOString();
      }
      this._persistLocalDb();

      await logActivity("verification_submitted", `Uploaded ${docType}`, originalFilename, docRecord.id);

      return {
        ...docRecord,
        view_url: `/api/files/preview/${driveFileId}`
      };
    }

    if (action === "list_driver_documents") {
      let docs = [];
      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudDocs, error } = await this.supabaseAdmin
          .from("verification_documents")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (error) {
          throw new Error(`Failed to list driver documents from Supabase: ${error.message}`);
        }
        docs = cloudDocs || [];
      } else {
        docs = this.db.verification_documents.filter((d) => d.user_id === userId);
      }

      return {
        documents: docs.map((d) => ({
          ...d,
          file_id: d.drive_file_id || d.file_id,
          view_url: `/api/files/preview/${d.drive_file_id || d.file_id}`
        }))
      };
    }

    if (action === "admin_verify_document") {
      await requireAdmin();
      const docId = data.document_id || data.id;
      const rawStatus = String(data.verification_status || data.status || "").toLowerCase().trim();
      const status = (rawStatus === "verified" || rawStatus === "approved") ? "approved" : "rejected";
      const rejectionReason = status === "rejected" ? (data.rejection_reason || data.reason || "Rejected by administrator") : "";
      const now = new Date().toISOString();

      let targetDoc = null;
      let targetUserId = null;

      if (this.isLive && this.supabaseAdmin) {
        // Query target document from Supabase
        const { data: cloudDoc, error: fetchErr } = await this.supabaseAdmin
          .from("verification_documents")
          .select("*")
          .eq("id", docId)
          .maybeSingle();

        if (fetchErr || !cloudDoc) {
          throw new Error("Verification document not found in Supabase.");
        }
        targetDoc = cloudDoc;
        targetUserId = cloudDoc.user_id;

        // Update verification document in Supabase
        const { error: docUpdateErr } = await this.supabaseAdmin
          .from("verification_documents")
          .update({
            verification_status: status,
            rejection_reason: rejectionReason,
            updated_at: now
          })
          .eq("id", docId);

        if (docUpdateErr) {
          throw new Error(`Failed to update verification document in Supabase: ${docUpdateErr.message}`);
        }

        // Update profile in Supabase
        if (status === "approved") {
          const { error: profErr } = await this.supabaseAdmin
            .from("profiles")
            .update({
              verification_status: "approved",
              verification_rejection_reason: null,
              updated_at: now
            })
            .eq("id", targetUserId);
          if (profErr) {
            throw new Error(`Failed to update profile verification status in Supabase: ${profErr.message}`);
          }
        } else {
          const { error: profErr } = await this.supabaseAdmin
            .from("profiles")
            .update({
              verification_status: "rejected",
              verification_rejection_reason: rejectionReason,
              updated_at: now
            })
            .eq("id", targetUserId);
          if (profErr) {
            throw new Error(`Failed to update profile verification status in Supabase: ${profErr.message}`);
          }
        }
      } else {
        targetDoc = this.db.verification_documents.find((d) => d.id === docId);
        if (!targetDoc) throw new Error("Document not found.");
        targetUserId = targetDoc.user_id;
      }

      // Sync local mirror
      if (targetDoc) {
        targetDoc.verification_status = status;
        targetDoc.rejection_reason = rejectionReason;
        targetDoc.updated_at = now;
      }
      const localProf = this.db.profiles.find((p) => p.id === targetUserId || p.user_id === targetUserId);
      if (localProf) {
        localProf.verification_status = status;
        if (status === "rejected") localProf.verification_rejection_reason = rejectionReason;
        localProf.updated_at = now;
      }
      this._persistLocalDb();

      await logActivity(
        status === "approved" ? "verification_approved" : "verification_rejected",
        `Admin ${status} verification document`,
        `Doc ID: ${docId}`,
        targetUserId
      );

      return {
        ...targetDoc,
        view_url: `/api/files/preview/${targetDoc.drive_file_id || targetDoc.file_id}`
      };
    }

    if (action === "admin_verify_vehicle") {
      await requireAdmin();
      const targetVehId = vehicle_id || data.vehicle_id || data.id;
      if (!targetVehId) throw new Error("Missing vehicle_id parameter.");

      const rawStatus = String(data.verification_status || data.status || "").toLowerCase().trim();
      const status = (rawStatus === "approved" || rawStatus === "verified") ? "approved" : (rawStatus === "rejected" ? "rejected" : "pending");
      const reason = data.reason || data.rejection_reason || null;
      if (status === "rejected" && (!reason || !String(reason).trim())) {
        throw new Error("A rejection reason is required when rejecting a vehicle.");
      }
      const now = new Date().toISOString();

      let updatedVehicle = null;

      if (this.isLive && this.supabaseAdmin) {
        const updatePayload = {
          verification_status: status,
          rejection_reason: status === "rejected" ? String(reason).trim() : null,
          updated_at: now
        };

        const { data: cloudUpdated, error } = await this.supabaseAdmin
          .from("vehicles")
          .update(updatePayload)
          .eq("id", targetVehId)
          .select()
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to update vehicle verification in Supabase: ${error.message}`);
        }
        if (!cloudUpdated) {
          throw new Error(`Vehicle not found in Supabase: ${targetVehId}`);
        }
        updatedVehicle = cloudUpdated;
      }

      const veh = this.db.vehicles.find((v) => v.id === targetVehId);
      if (veh) {
        veh.verification_status = status;
        veh.rejection_reason = status === "rejected" ? String(reason).trim() : "";
        veh.updated_at = now;
        if (!updatedVehicle) updatedVehicle = veh;
      }

      this._persistLocalDb();
      await logActivity("vehicle_verification_updated", `Admin set vehicle verification to ${status}`, `Vehicle: ${targetVehId}`, targetVehId);
      return updatedVehicle || { id: targetVehId, verification_status: status };
    }

    // =========================================================================
    // 4. SERVICE REQUESTS
    // =========================================================================
    if (action === "create_service_request") {
      if (!data.pickup_location) throw new Error("Pickup location is required.");
      if (!data.destination) throw new Error("Destination location is required.");

      const newRequest = {
        id: authoritativeCaller ? randomUUID() : `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        passenger_id: userId,
        service_type: data.service_type || "ride",
        pickup_location: String(data.pickup_location).trim(),
        pickup_latitude: data.pickup_latitude ?? null,
        pickup_longitude: data.pickup_longitude ?? null,
        destination: String(data.destination).trim(),
        destination_latitude: data.destination_latitude ?? null,
        destination_longitude: data.destination_longitude ?? null,
        request_date: data.request_date || new Date().toISOString(),
        preferred_time: data.preferred_time || "",
        passenger_count: data.passenger_count || 1,
        goods_type: data.goods_type || "",
        details: data.details || "",
        budget: data.budget !== undefined && data.budget !== null && data.budget !== "" ? parseFloat(data.budget) : null,
        status: "open_for_bids",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (authoritativeCaller) {
        const { data: insertedRequest, error: insertError } = await this.supabaseAdmin
          .from("service_requests")
          .insert(newRequest)
          .select()
          .single();
        if (insertError) throw new Error(`Failed to create service request in Supabase: ${insertError.message}`);
        Object.assign(newRequest, insertedRequest);
      }

      this.db.service_requests.push(newRequest);
      this._persistLocalDb();
      await logActivity("request_created", `Request posted: ${newRequest.service_type}`, `${newRequest.pickup_location} -> ${newRequest.destination}`, newRequest.id);
      return newRequest;
    }

    if (action === "list_available_requests") {
      // Driver view: find open requests matching driver's vehicle category
      let driverVehicles = this.db.vehicles.filter((v) => v.driver_id === userId && v.status === "active");
      let requestPool = this.db.service_requests;
      if (authoritativeCaller) {
        const [{ data: liveVehicles, error: vehicleError }, { data: liveRequests, error: requestError }] = await Promise.all([
          this.supabaseAdmin.from("vehicles").select("*").eq("driver_id", userId).eq("status", "active"),
          this.supabaseAdmin.from("service_requests").select("*").in("status", ["open_for_bids", "offers_received", "negotiating"])
        ]);
        if (vehicleError) throw new Error(`Failed to list driver vehicles from Supabase: ${vehicleError.message}`);
        if (requestError) throw new Error(`Failed to list available requests from Supabase: ${requestError.message}`);
        driverVehicles = liveVehicles || [];
        requestPool = liveRequests || [];
      }
      const allowedCategories = new Set(driverVehicles.map((v) => v.service_category));

      const openStatuses = ["open_for_bids", "offers_received", "negotiating"];
      const matching = requestPool.filter((r) => {
        if (!openStatuses.includes(r.status)) return false;
        if (allowedCategories.size === 0) return true; // Show all if no category restricted
        return Array.from(allowedCategories).some((cat) => isVehicleCompatibleWithRequest(cat, r.service_type));
      });

      return {
        requests: matching.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      };
    }

    if (action === "get_service_request_details") {
      const targetReqId = request_id || data.request_id;
      const loadedRequest = await this._loadRequestRecord(targetReqId);
      if (!loadedRequest) throw new Error("Service request not found.");
      return loadedRequest.record;
    }

    if (action === "list_passenger_requests") {
      let list = this.db.service_requests.filter((r) => r.passenger_id === userId);
      if (authoritativeCaller) {
        const { data: liveRequests, error } = await this.supabaseAdmin
          .from("service_requests")
          .select("*")
          .eq("passenger_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to list passenger requests from Supabase: ${error.message}`);
        list = liveRequests || [];
      }
      return {
        requests: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      };
    }

    if (action === "cancel_service_request") {
      const targetReqId = request_id || data.request_id;
      const loadedRequest = await this._loadRequestRecord(targetReqId);
      if (!loadedRequest) throw new Error("Service request not found.");
      const req = loadedRequest.record;
      if (req.passenger_id !== userId) throw new Error("Forbidden: You do not own this request.");

      req.status = "cancelled";
      req.updated_at = new Date().toISOString();
      if (loadedRequest.authoritative) {
        const { data: updatedRequest, error } = await this.supabaseAdmin
          .from("service_requests")
          .update({ status: req.status, updated_at: req.updated_at })
          .eq("id", targetReqId)
          .select()
          .single();
        if (error) throw new Error(`Failed to cancel service request in Supabase: ${error.message}`);
        Object.assign(req, updatedRequest);
      }
      this._persistLocalDb();
      return req;
    }

    if (action === "update_service_request") {
      const targetReqId = request_id || data.request_id;
      const loadedRequest = await this._loadRequestRecord(targetReqId);
      if (!loadedRequest) throw new Error("Service request not found.");
      const req = loadedRequest.record;
      if (req.passenger_id !== userId) throw new Error("Forbidden: You do not own this request.");

      if (data.pickup_location !== undefined) req.pickup_location = String(data.pickup_location).trim();
      if (data.destination !== undefined) req.destination = String(data.destination).trim();
      if (data.service_type !== undefined) req.service_type = String(data.service_type).trim();
      if (data.budget !== undefined) req.budget = parseFloat(data.budget);
      if (data.details !== undefined) req.details = String(data.details).trim();
      if (data.goods_type !== undefined) req.goods_type = String(data.goods_type).trim();
      if (data.passenger_count !== undefined) req.passenger_count = parseInt(data.passenger_count, 10);
      req.updated_at = new Date().toISOString();

      if (loadedRequest.authoritative) {
        const allowedUpdates = {
          pickup_location: req.pickup_location,
          destination: req.destination,
          service_type: req.service_type,
          budget: req.budget,
          details: req.details,
          goods_type: req.goods_type,
          passenger_count: req.passenger_count,
          updated_at: req.updated_at
        };
        const { data: updatedRequest, error } = await this.supabaseAdmin
          .from("service_requests")
          .update(allowedUpdates)
          .eq("id", targetReqId)
          .select()
          .single();
        if (error) throw new Error(`Failed to update service request in Supabase: ${error.message}`);
        Object.assign(req, updatedRequest);
      }

      this._persistLocalDb();
      return req;
    }

    if (action === "create_request_image") {
      const targetReqId = request_id || data.request_id;
      if (!targetReqId) throw new Error("Missing request_id parameter.");

      let driveFileId = data.drive_file_id || data.file_id || "";
      let filename = data.original_filename || data.filename || "request_item.jpg";
      let mimeType = data.mime_type || "image/jpeg";

      if (data.file_base64) {
        const fileBuffer = Buffer.from(data.file_base64, "base64");
        const uploadResult = await googleDriveStorage.uploadFile({
          buffer: fileBuffer,
          originalFilename: filename,
          mimeType,
          folderPath: DRIVE_FOLDERS.RECEIPTS,
          metadata: { userId, requestId: targetReqId }
        });
        driveFileId = uploadResult.id;
      }

      const imgRecord = {
        id: randomUUID(),
        request_id: targetReqId,
        passenger_id: userId,
        storage_provider: "google_drive",
        drive_file_id: driveFileId,
        file_id: driveFileId,
        file_url: `/api/files/preview/${driveFileId}`,
        created_at: new Date().toISOString()
      };

      if (!this.db.request_images) this.db.request_images = [];
      this.db.request_images.push(imgRecord);
      this._persistLocalDb();
      return imgRecord;
    }

    // =========================================================================
    // 5. BIDS & 5-FREE-JOBS ENFORCEMENT
    // =========================================================================
    if (action === "check_driver_entitlement" || action === "get_subscription_status") {
      const awardedCount = this.db.bookings.filter((b) => b.driver_id === userId).length;
      const now = new Date();
      let activeSub = this.db.subscriptions.find((s) => s.user_id === userId && s.status === "active" && new Date(s.expires_at) > now) || null;
      if (authoritativeCaller) {
        const { data: activeSubscriptions, error } = await this.supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .gt("expires_at", now.toISOString())
          .order("expires_at", { ascending: false })
          .limit(1);
        if (!error) activeSub = activeSubscriptions?.[0] || null;
        else console.warn("[payments] Supabase active subscription lookup unavailable:", error.message);
      }

      return {
        active: Boolean(activeSub),
        plan: activeSub?.plan || null,
        expires_at: activeSub?.expires_at || null,
        awarded_bookings_count: awardedCount,
        free_jobs_remaining: Math.max(0, 5 - awardedCount),
        is_subscription_required: awardedCount >= 5 && !activeSub,
        has_active_subscription: Boolean(activeSub),
        active_subscription: activeSub || null
      };
    }

    if (action === "create_bid") {
      const targetReqId = request_id || data.request_id;
      if (!targetReqId) throw new Error("Missing request_id parameter.");

      const loadedRequest = await this._loadRequestRecord(targetReqId);
      if (!loadedRequest) throw new Error("Service request not found.");
      const req = loadedRequest.record;
      const authoritative = loadedRequest.authoritative;
      if (req.passenger_id === userId) throw new Error("Drivers cannot bid on their own requests.");

      // Enforce 5 Free Awarded Bookings Rule
      const awardedCount = this.db.bookings.filter((b) => b.driver_id === userId).length;
      const now = new Date();
      const activeSub = this.db.subscriptions.find((s) => s.user_id === userId && s.status === "active" && new Date(s.expires_at) > now);

      if (awardedCount >= 5 && !activeSub) {
        const err = new Error("DRIVER_SUBSCRIPTION_REQUIRED: You have completed your 5 free awarded jobs. Please subscribe to continue placing bids.");
        err.statusCode = 402;
        err.awarded_count = awardedCount;
        throw err;
      }

      const rawPrice = data.proposed_price !== undefined && data.proposed_price !== null
        ? data.proposed_price
        : (data.amount !== undefined && data.amount !== null ? data.amount : data.price);
      const price = positiveNumber(rawPrice);
      if (!price) {
        throw new Error("Proposed price must be a positive number.");
      }

      const parsedEta = Number.parseInt(data.estimated_arrival_mins ?? data.estimated_arrival_minutes ?? data.arrival_minutes ?? data.eta, 10);
      const eta = Number.isFinite(parsedEta) && parsedEta > 0 ? parsedEta : 15;

      let vehicleId = data.vehicle_id || null;
      if (authoritative) {
        let vehicle = null;
        if (vehicleId) {
          const { data: explicitVehicle, error: vehicleError } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, driver_id, status, verification_status, is_primary")
            .eq("id", vehicleId)
            .eq("driver_id", userId)
            .eq("status", "active")
            .in("verification_status", ["approved", "verified"])
            .maybeSingle();
          if (vehicleError) throw new Error(`Failed to validate bid vehicle: ${vehicleError.message}`);
          vehicle = explicitVehicle;
        } else {
          const { data: approvedVehicles, error: vehicleError } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, driver_id, status, verification_status, is_primary")
            .eq("driver_id", userId)
            .eq("status", "active")
            .in("verification_status", ["approved", "verified"])
            .order("is_primary", { ascending: false })
            .limit(1);
          if (vehicleError) throw new Error(`Failed to resolve approved bid vehicle: ${vehicleError.message}`);
          vehicle = approvedVehicles?.[0] || null;
        }
        if (!vehicle) throw new Error("An active approved vehicle owned by the driver is required to place an offer.");
        vehicleId = vehicle.id;
      } else if (!vehicleId) {
        const driverVehicles = (this.db.vehicles || []).filter((v) => v.driver_id === userId);
        vehicleId = driverVehicles.find((v) => v.is_primary)?.id || driverVehicles[0]?.id || null;
      }

      const nowIso = new Date().toISOString();
      let bidRecord = null;

      if (authoritative) {
        const { data: existingBids, error: existingError } = await this.supabaseAdmin
          .from("bids")
          .select("*")
          .eq("request_id", targetReqId)
          .eq("driver_id", userId)
          .limit(1);
        if (existingError) throw new Error(`Failed to check existing offer: ${existingError.message}`);

        if (existingBids?.length) {
          const { data: updatedBid, error: updateError } = await this.supabaseAdmin
            .from("bids")
            .update({
              amount: price,
              estimated_arrival_minutes: eta,
              message: data.message || "",
              vehicle_id: vehicleId,
              status: "pending",
              updated_at: nowIso
            })
            .eq("id", existingBids[0].id)
            .select()
            .single();
          if (updateError) throw new Error(`Failed to update offer: ${updateError.message}`);
          bidRecord = updatedBid;
        } else {
          const { data: insertedBid, error: insertError } = await this.supabaseAdmin
            .from("bids")
            .insert({
              id: randomUUID(),
              request_id: targetReqId,
              driver_id: userId,
              vehicle_id: vehicleId,
              amount: price,
              estimated_arrival_minutes: eta,
              message: data.message || "",
              status: "pending",
              created_at: nowIso,
              updated_at: nowIso
            })
            .select()
            .single();
          if (insertError) throw new Error(`Failed to create offer: ${insertError.message}`);
          bidRecord = insertedBid;
        }

        const { error: requestUpdateError } = await this.supabaseAdmin
          .from("service_requests")
          .update({ status: "offers_received", updated_at: nowIso })
          .eq("id", targetReqId);
        if (requestUpdateError) throw new Error(`Failed to mark request as having offers: ${requestUpdateError.message}`);
      }

      if (!authoritative) {
        const existingBid = (this.db.bids || []).find((b) => b.request_id === targetReqId && b.driver_id === userId);
        if (existingBid) {
          existingBid.amount = price;
          existingBid.estimated_arrival_minutes = eta;
          existingBid.message = data.message || "";
          existingBid.vehicle_id = vehicleId;
          existingBid.status = "pending";
          existingBid.updated_at = nowIso;
          bidRecord = existingBid;
        } else {
          bidRecord = {
            id: randomUUID(),
            request_id: targetReqId,
            driver_id: userId,
            vehicle_id: vehicleId,
            amount: price,
            estimated_arrival_minutes: eta,
            message: data.message || "",
            status: "pending",
            created_at: nowIso,
            updated_at: nowIso
          };
          if (!this.db.bids) this.db.bids = [];
          this.db.bids.push(bidRecord);
        }
      } else {
        const idx = (this.db.bids || []).findIndex((b) => b.id === bidRecord.id || (b.request_id === targetReqId && b.driver_id === userId));
        if (idx >= 0) this.db.bids[idx] = { ...this.db.bids[idx], ...bidRecord };
        else {
          if (!this.db.bids) this.db.bids = [];
          this.db.bids.push(bidRecord);
        }
      }

      let localRequest = (this.db.service_requests || []).find((r) => r.id === targetReqId);
      if (!localRequest) {
        localRequest = { ...req };
        this.db.service_requests.push(localRequest);
      }
      localRequest.status = "offers_received";
      localRequest.updated_at = nowIso;

      // Create notification for passenger
      if (!this.db.notifications) this.db.notifications = [];
      this.db.notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: req.passenger_id,
        type: "new_offer",
        title: "New Driver Offer Received",
        message: `A driver submitted an offer of $${price.toFixed(2)} for your trip.`,
        related_id: bidRecord.id,
        read: false,
        created_at: nowIso
      });

      this._persistLocalDb();
      const hydrated = await this._hydrateBid(bidRecord);
      return hydrated;
    }

    if (action === "counter_bid") {
      const bidId = data.bid_id;
      const counterAmount = positiveNumber(data.counter_amount);
      if (!counterAmount) {
        throw new Error("Counter amount must be a positive number.");
      }

      const loadedBid = await this._loadBidRecord(bidId);
      if (!loadedBid) throw new Error("Bid not found.");
      let bid = loadedBid.record;
      const requestResult = await this._loadRequestRecord(bid.request_id);
      if (!requestResult) throw new Error("Service request not found.");
      const request = requestResult.record;
      if (userId !== bid.driver_id && userId !== request.passenger_id) {
        throw new Error("Forbidden: You are not a participant in this offer.");
      }

      const isPassenger = userId === request.passenger_id;
      const newStatus = isPassenger ? "countered_by_passenger" : "countered_by_driver";
      const now = new Date().toISOString();
      const negotiation = {
        id: randomUUID(),
        bid_id: bidId,
        sender_id: userId,
        sender_role: isPassenger ? "passenger" : "driver",
        counter_amount: counterAmount,
        message: data.message || "",
        status: "active",
        created_at: now
      };

      if (loadedBid.authoritative) {
        const { data: updatedBid, error: bidError } = await this.supabaseAdmin
            .from("bids")
            .update({ amount: counterAmount, status: newStatus, updated_at: now })
            .eq("id", bidId)
            .select()
            .single();
        if (bidError) throw new Error(`Failed to update counter offer: ${bidError.message}`);
        const { error: negotiationError } = await this.supabaseAdmin.from("bid_negotiations").insert(negotiation);
        if (negotiationError) throw new Error(`Failed to record counter offer: ${negotiationError.message}`);
        bid = updatedBid;
      } else {
        bid.status = newStatus;
        bid.amount = counterAmount;
        bid.updated_at = now;
      }

      bid.counter_amount = counterAmount;
      bid.negotiation_status = newStatus;
      const localBidIndex = (this.db.bids || []).findIndex((entry) => entry.id === bidId);
      if (localBidIndex >= 0) this.db.bids[localBidIndex] = { ...this.db.bids[localBidIndex], ...bid };
      else this.db.bids.push({ ...bid });

      if (!this.db.bid_negotiations) this.db.bid_negotiations = [];
      this.db.bid_negotiations.push(negotiation);

      const targetNotifyUser = isPassenger ? bid.driver_id : request.passenger_id;
      if (targetNotifyUser) {
        if (!this.db.notifications) this.db.notifications = [];
        this.db.notifications.push({
          id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          user_id: targetNotifyUser,
          type: "counter_offer",
          title: "Counter Offer Proposed",
          message: `New counter offer of $${counterAmount.toFixed(2)} received.`,
          related_id: bidId,
          read: false,
          created_at: now
        });
      }

      this._persistLocalDb();
      const hydratedBid = await this._hydrateBid(bid);
      return { bid: hydratedBid, negotiation };
    }

    if (action === "accept_counter_offer") {
      const bidId = data.bid_id;
      const loadedBid = await this._loadBidRecord(bidId);
      if (!loadedBid) throw new Error("Bid not found.");
      let bid = loadedBid.record;
      const requestResult = await this._loadRequestRecord(bid.request_id);
      if (!requestResult) throw new Error("Service request not found.");
      const request = requestResult.record;
      if (userId !== bid.driver_id && userId !== request.passenger_id) {
        throw new Error("Forbidden: You are not a participant in this offer.");
      }

      let latestNegotiation = null;
      if (loadedBid.authoritative) {
        const { data: negotiations, error } = await this.supabaseAdmin
          .from("bid_negotiations")
          .select("*")
          .eq("bid_id", bidId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw new Error(`Failed to load counter offer: ${error.message}`);
        latestNegotiation = negotiations?.[0] || null;
      } else {
        latestNegotiation = (this.db.bid_negotiations || [])
          .filter((n) => n.bid_id === bidId && n.status === "active")
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
      }
      if (!latestNegotiation) throw new Error("No active counter offer was found.");
      if (latestNegotiation.sender_id === userId) throw new Error("The counter offer must be accepted by the other party.");

      const now = new Date().toISOString();
      if (loadedBid.authoritative) {
        const { data: updatedBid, error: bidError } = await this.supabaseAdmin
          .from("bids")
          .update({ status: "pending", updated_at: now })
          .eq("id", bidId)
          .select()
          .single();
        if (bidError) throw new Error(`Failed to accept counter offer: ${bidError.message}`);
        const { error: negotiationError } = await this.supabaseAdmin
          .from("bid_negotiations")
          .update({ status: "accepted" })
          .eq("id", latestNegotiation.id);
        if (negotiationError) throw new Error(`Failed to finalize counter offer: ${negotiationError.message}`);
        bid = updatedBid;
      }
      bid.status = "pending";
      bid.counter_amount = positiveNumber(latestNegotiation.counter_amount);
      bid.negotiation_status = "accepted";
      bid.updated_at = now;
      latestNegotiation.status = "accepted";
      const localBidIndex = (this.db.bids || []).findIndex((entry) => entry.id === bidId);
      if (localBidIndex >= 0) this.db.bids[localBidIndex] = { ...this.db.bids[localBidIndex], ...bid };
      else this.db.bids.push({ ...bid });
      this._persistLocalDb();
      const hydratedBid = await this._hydrateBid(bid);
      return hydratedBid;
    }

    if (action === "withdraw_bid") {
      const bidId = data.bid_id;
      const loadedBid = await this._loadBidRecord(bidId);
      if (!loadedBid || loadedBid.record.driver_id !== userId) throw new Error("Bid not found or forbidden.");
      let bid = loadedBid.record;

      const now = new Date().toISOString();
      if (loadedBid.authoritative) {
        const { data: updatedBid, error } = await this.supabaseAdmin
          .from("bids")
          .update({ status: "withdrawn", updated_at: now })
          .eq("id", bidId)
          .eq("driver_id", userId)
          .select()
          .single();
        if (error) throw new Error(`Failed to withdraw offer: ${error.message}`);
        bid = updatedBid;
      }
      bid.status = "withdrawn";
      bid.updated_at = now;
      const localBidIndex = (this.db.bids || []).findIndex((entry) => entry.id === bidId);
      if (localBidIndex >= 0) this.db.bids[localBidIndex] = { ...this.db.bids[localBidIndex], ...bid };
      else this.db.bids.push({ ...bid });
      this._persistLocalDb();
      return bid;
    }

    // =========================================================================
    // 6. BOOKINGS & TRIP LIFECYCLE
    // =========================================================================
    if (action === "accept_bid") {
      const bidId = data.bid_id;
      if (!bidId) throw new Error("bid_id is required to accept a bid.");

      const loadedBid = await this._loadBidRecord(bidId);
      if (!loadedBid) throw new Error("Bid not found.");
      const bid = loadedBid.record;
      const loadedRequest = await this._loadRequestRecord(bid.request_id);
      if (!loadedRequest) throw new Error("Request not found.");
      const req = loadedRequest.record;
      const authoritative = loadedBid.authoritative && loadedRequest.authoritative;
      if (req.passenger_id !== userId) throw new Error("Forbidden: You do not own this request.");

      // Enforce single active booking for this request
      if (authoritative) {
        const { data: existingBookings, error: bookingLookupError } = await this.supabaseAdmin
          .from("bookings")
          .select("id, status")
          .eq("request_id", req.id)
          .neq("status", "cancelled");
        if (bookingLookupError) throw new Error(`Failed to check existing booking: ${bookingLookupError.message}`);
        if (existingBookings?.length) throw new Error("A booking already exists for this request.");
      } else if ((this.db.bookings || []).some((booking) => booking.request_id === req.id && booking.status !== "cancelled")) {
        throw new Error("A booking already exists for this request.");
      }

      let latestNegotiation = null;
      if (authoritative) {
        const { data: negotiations, error: negotiationError } = await this.supabaseAdmin
          .from("bid_negotiations")
          .select("counter_amount, status, created_at")
          .eq("bid_id", bid.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (negotiationError) throw new Error(`Failed to load agreed offer amount: ${negotiationError.message}`);
        latestNegotiation = negotiations?.[0] || null;
      } else {
        latestNegotiation = (this.db.bid_negotiations || [])
          .filter((negotiation) => negotiation.bid_id === bid.id)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
      }

      const finalPrice = positiveNumber(latestNegotiation?.counter_amount) || positiveNumber(bid.amount) || positiveNumber(bid.proposed_price);
      if (!finalPrice) {
        throw new Error("Invalid agreed fare. Fare must be a positive number.");
      }

      const tripPin = Math.floor(1000 + Math.random() * 9000).toString();
      let driverProfile = null;
      let vehicleRecord = null;
      if (authoritative) {
        const { data: profile, error: profileError } = await this.supabaseAdmin
          .from("profiles")
          .select("id, full_name, phone, profile_image_id, profile_photo_url, rating_avg, rating_count, verification_status")
          .eq("id", bid.driver_id)
          .maybeSingle();
        if (profileError) throw new Error(`Failed to load accepted driver: ${profileError.message}`);
        driverProfile = profile;

        if (bid.vehicle_id) {
          const { data: vehicle, error: vehicleError } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, driver_id, make, model, year, colour, registration_number, verification_status")
            .eq("id", bid.vehicle_id)
            .eq("driver_id", bid.driver_id)
            .maybeSingle();
          if (vehicleError) throw new Error(`Failed to load accepted vehicle: ${vehicleError.message}`);
          vehicleRecord = vehicle;
        }
        if (!vehicleRecord) {
          const { data: vehicles, error: vehicleError } = await this.supabaseAdmin
            .from("vehicles")
            .select("id, driver_id, make, model, year, colour, registration_number, verification_status")
            .eq("driver_id", bid.driver_id)
            .in("verification_status", ["approved", "verified"])
            .order("is_primary", { ascending: false })
            .limit(1);
          if (vehicleError) throw new Error(`Failed to resolve accepted vehicle: ${vehicleError.message}`);
          vehicleRecord = vehicles?.[0] || null;
        }
      } else {
        driverProfile = (this.db.profiles || []).find((profile) => profile.id === bid.driver_id || profile.user_id === bid.driver_id) || null;
        vehicleRecord = (this.db.vehicles || []).find((vehicle) =>
          vehicle.id === bid.vehicle_id || (vehicle.driver_id === bid.driver_id && vehicle.is_primary)
        ) || null;
      }

      const now = new Date().toISOString();
      const bookingInsert = {
        id: randomUUID(),
        request_id: req.id,
        passenger_id: userId,
        driver_id: bid.driver_id,
        vehicle_id: vehicleRecord?.id || bid.vehicle_id || null,
        accepted_bid_id: isUuid(bid.id) ? bid.id : null,
        amount: finalPrice,
        status: "confirmed",
        trip_pin: tripPin,
        payment_status: "pending",
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now
      };

      let persistedBooking = bookingInsert;
      if (authoritative) {
        const { data: insertedBooking, error: bookingError } = await this.supabaseAdmin
          .from("bookings")
          .insert(bookingInsert)
          .select()
          .single();
        if (bookingError) throw new Error(`Failed to create booking: ${bookingError.message}`);
        persistedBooking = insertedBooking;

        const { error: requestUpdateError } = await this.supabaseAdmin
          .from("service_requests")
          .update({ status: "accepted", updated_at: now })
          .eq("id", req.id);
        if (requestUpdateError) throw new Error(`Failed to accept service request: ${requestUpdateError.message}`);

        const { error: acceptedBidError } = await this.supabaseAdmin
          .from("bids")
          .update({ status: "accepted", updated_at: now })
          .eq("id", bid.id);
        if (acceptedBidError) throw new Error(`Failed to mark offer accepted: ${acceptedBidError.message}`);
        const { error: rejectedBidsError } = await this.supabaseAdmin
          .from("bids")
          .update({ status: "rejected", updated_at: now })
          .eq("request_id", req.id)
          .neq("id", bid.id);
        if (rejectedBidsError) throw new Error(`Failed to close remaining offers: ${rejectedBidsError.message}`);
      }

      const newBooking = {
        ...persistedBooking,
        driver: driverProfile,
        vehicle: vehicleRecord,
        request: req
      };

      if (!this.db.bookings) this.db.bookings = [];
      const localBookingIndex = this.db.bookings.findIndex((booking) => booking.id === newBooking.id);
      if (localBookingIndex >= 0) this.db.bookings[localBookingIndex] = newBooking;
      else this.db.bookings.push(newBooking);

      let localRequest = (this.db.service_requests || []).find((request) => request.id === req.id);
      if (!localRequest) {
        localRequest = { ...req };
        this.db.service_requests.push(localRequest);
      }
      localRequest.status = "accepted";
      localRequest.updated_at = now;

      const localBid = (this.db.bids || []).find((entry) => entry.id === bid.id);
      if (localBid) {
        localBid.status = "accepted";
        localBid.updated_at = now;
      } else {
        this.db.bids.push({ ...bid, status: "accepted", updated_at: now });
      }

      (this.db.bids || []).filter((b) => b.request_id === req.id && b.id !== bid.id).forEach((b) => {
        b.status = "rejected";
        b.updated_at = now;
      });

      // Notify Driver
      if (!this.db.notifications) this.db.notifications = [];
      this.db.notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: bid.driver_id,
        type: "job_confirmed",
        title: "Booking Confirmed!",
        message: `Your offer was accepted for $${finalPrice.toFixed(2)}. Prepare to pick up passenger.`,
        related_id: newBooking.id,
        read: false,
        created_at: now
      });

      this._persistLocalDb();
      await logActivity("booking_created", "Trip booking confirmed", `Amount: $${newBooking.amount}`, newBooking.id);
      return { success: true, bookingId: newBooking.id, booking: newBooking, ...newBooking };
    }

    if (action === "update_booking_status") {
      const bookingId = data.booking_id;
      const newStatus = String(data.status || "").trim(); // 'driver_arriving' | 'arrived' | 'in_progress' | 'completed' | 'cancelled'
      if (!bookingId) throw new Error("booking_id is required.");
      if (!newStatus) throw new Error("status is required.");

      const validStatuses = ["driver_arriving", "arrived", "in_progress", "completed", "cancelled"];
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status '${newStatus}'. Allowed: ${validStatuses.join(", ")}`);
      }

      let booking = (this.db.bookings || []).find((b) => b.id === bookingId);
      if (!booking && this.isLive && this.supabaseAdmin) {
        try {
          const { data: sbB } = await this.supabaseAdmin.from("bookings").select("*").eq("id", bookingId).single();
          if (sbB) booking = sbB;
        } catch (_) {}
      }
      if (!booking) throw new Error("Booking not found.");

      if (booking.driver_id !== userId && booking.passenger_id !== userId) {
        throw new Error("Forbidden: You are not a participant in this booking.");
      }

      // Check for already completed or cancelled bookings
      if (booking.status === "completed") {
        throw new Error("Cannot modify a completed booking.");
      }
      if (booking.status === "cancelled") {
        throw new Error("Cannot modify a cancelled booking.");
      }

      // Role check: only the driver can progress the trip lifecycle forward
      if (["driver_arriving", "arrived", "in_progress", "completed"].includes(newStatus)) {
        if (booking.driver_id !== userId) {
          throw new Error("Forbidden: Only the assigned driver can advance trip status to " + newStatus);
        }
      }

      // Enforce strict state machine transitions
      const ALLOWED_TRANSITIONS = {
        confirmed: ["driver_arriving", "cancelled"],
        driver_arriving: ["arrived", "cancelled"],
        arrived: ["in_progress", "cancelled"],
        in_progress: ["completed", "cancelled"]
      };

      const allowedNext = ALLOWED_TRANSITIONS[booking.status] || [];
      if (!allowedNext.includes(newStatus)) {
        throw new Error(`Invalid transition from '${booking.status}' to '${newStatus}'.`);
      }

      const now = new Date().toISOString();

      // PIN verification when starting journey
      if (newStatus === "in_progress") {
        const pin = String(data.pin || "").trim();
        const expectedPin = String(booking.trip_pin || "").trim();
        if (!pin) {
          throw new Error("Trip PIN is required to start the journey.");
        }
        if (expectedPin && pin !== expectedPin) {
          throw new Error("Invalid Trip PIN. Ask the passenger for the 4-digit verification code.");
        }
        booking.started_at = now;
      }

      if (newStatus === "completed") {
        booking.completed_at = now;
      }

      booking.status = newStatus;
      booking.updated_at = now;

      if (this.isLive && this.supabaseAdmin) {
        try {
          await this.supabaseAdmin
            .from("bookings")
            .update({
              status: newStatus,
              started_at: booking.started_at || null,
              completed_at: booking.completed_at || null,
              updated_at: now
            })
            .eq("id", booking.id);
        } catch (e) {
          console.warn("[SupabaseBackend] booking status update notice:", e.message);
        }

        try {
          await this.supabaseAdmin
            .from("booking_events")
            .insert({
              booking_id: booking.id,
              actor_id: userId,
              status: newStatus,
              event_type: `status_${newStatus}`,
              notes: data.notes || data.reason || `Status updated to ${newStatus}`,
              created_at: now
            });
        } catch (_) {}
      }

      // Local mirror
      if (!this.db.booking_events) this.db.booking_events = [];
      this.db.booking_events.push({
        id: `be_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        booking_id: booking.id,
        actor_id: userId,
        status: newStatus,
        event_type: `status_${newStatus}`,
        notes: data.notes || data.reason || `Status updated to ${newStatus}`,
        created_at: now
      });

      this._persistLocalDb();
      const hydrated = await this._hydrateBooking(booking);
      return { success: true, booking: hydrated, ...hydrated };
    }

    if (action === "confirm_trip_payment") {
      const bookingId = data.booking_id;
      let booking = (this.db.bookings || []).find((b) => b.id === bookingId);
      if (!booking && this.isLive && this.supabaseAdmin) {
        try {
          const { data: sbB } = await this.supabaseAdmin.from("bookings").select("*").eq("id", bookingId).single();
          if (sbB) booking = sbB;
        } catch (_) {}
      }
      if (!booking) throw new Error("Booking not found.");

      booking.payment_status = "paid";
      booking.updated_at = new Date().toISOString();

      if (this.isLive && this.supabaseAdmin) {
        try {
          await this.supabaseAdmin.from("bookings").update({ payment_status: "paid", updated_at: booking.updated_at }).eq("id", booking.id);
        } catch (_) {}
      }

      this._persistLocalDb();
      const hydrated = await this._hydrateBooking(booking);
      return { success: true, booking: hydrated, ...hydrated };
    }

    if (action === "get_booking" || action === "get_booking_by_id") {
      const bId = data.booking_id || data.id;
      let booking = (this.db.bookings || []).find((b) => b.id === bId);
      if (!booking && this.isLive && this.supabaseAdmin) {
        try {
          const { data: sbB } = await this.supabaseAdmin.from("bookings").select("*").eq("id", bId).single();
          if (sbB) booking = sbB;
        } catch (_) {}
      }
      if (!booking) throw new Error("Booking not found.");
      if (booking.driver_id !== userId && booking.passenger_id !== userId) {
        await requireAdmin();
      }
      const hydrated = await this._hydrateBooking(booking);
      return { booking: hydrated, ...hydrated };
    }

    if (action === "get_passenger_bookings") {
      let list = [];
      if (this.isLive && this.supabaseAdmin) {
        try {
          const { data: sbList, error } = await this.supabaseAdmin
            .from("bookings")
            .select("*, driver:profiles!driver_id(*), vehicle:vehicles(*), request:service_requests(*)")
            .eq("passenger_id", userId)
            .order("created_at", { ascending: false });
          if (!error && Array.isArray(sbList) && sbList.length > 0) {
            list = sbList;
          }
        } catch (_) {}
      }
      if (list.length === 0) {
        list = (this.db.bookings || []).filter((b) => b.passenger_id === userId);
      }
      const enriched = await Promise.all(list.map((b) => this._hydrateBooking(b)));
      return { bookings: enriched };
    }

    if (action === "get_driver_bookings") {
      let list = [];
      if (this.isLive && this.supabaseAdmin) {
        try {
          const { data: sbList, error } = await this.supabaseAdmin
            .from("bookings")
            .select("*, driver:profiles!driver_id(*), vehicle:vehicles(*), request:service_requests(*)")
            .eq("driver_id", userId)
            .order("created_at", { ascending: false });
          if (!error && Array.isArray(sbList) && sbList.length > 0) {
            list = sbList;
          }
        } catch (_) {}
      }
      if (list.length === 0) {
        list = (this.db.bookings || []).filter((b) => b.driver_id === userId);
      }
      const enriched = await Promise.all(list.map((b) => this._hydrateBooking(b)));
      return { bookings: enriched };
    }

    // =========================================================================
    // 7. REVIEWS & RATINGS
    // =========================================================================
    if (action === "submit_review" || action === "create_review") {
      const bookingId = data.booking_id;
      const rating = parseInt(data.rating, 10);
      if (isNaN(rating) || rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5.");

      const booking = this.db.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Booking not found.");
      if (booking.passenger_id !== userId) throw new Error("Only the passenger of this booking can review the driver.");
      if (booking.status !== "completed") throw new Error("Cannot review an incomplete trip.");

      const existing = this.db.reviews.find((r) => r.booking_id === bookingId);
      if (existing) throw new Error("You have already reviewed this booking.");

      const review = {
        id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        booking_id: bookingId,
        reviewer_id: userId,
        reviewee_id: booking.driver_id,
        rating,
        comment: data.comment || "",
        created_at: new Date().toISOString()
      };

      this.db.reviews.push(review);

      // Recalculate driver ratings
      const driverReviews = this.db.reviews.filter((r) => r.reviewee_id === booking.driver_id);
      const sum = driverReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = Number((sum / driverReviews.length).toFixed(2));

      const driverProfile = this.db.profiles.find((p) => p.id === booking.driver_id || p.user_id === booking.driver_id);
      if (driverProfile) {
        driverProfile.rating_avg = avg;
        driverProfile.rating_count = driverReviews.length;
      }

      this._persistLocalDb();
      return review;
    }

    if (action === "get_booking_reviews") {
      const bookingId = data.booking_id;
      const reviews = this.db.reviews.filter((r) => r.booking_id === bookingId);
      return { reviews };
    }

    if (action === "get_driver_reviews") {
      const driverId = data.driver_id;
      const reviews = this.db.reviews.filter((r) => r.reviewee_id === driverId);
      return { reviews };
    }

    if (action === "get_booking_receipt") {
      const bookingId = data.booking_id;
      const booking = this.db.bookings.find((b) => b.id === bookingId);
      if (!booking) throw new Error("Booking not found.");
      const req = this.db.service_requests.find((r) => r.id === booking.request_id);
      const driver = this.db.profiles.find((p) => p.id === booking.driver_id || p.user_id === booking.driver_id);
      const passenger = this.db.profiles.find((p) => p.id === booking.passenger_id || p.user_id === booking.passenger_id);
      const payment = this.db.payments.find((p) => p.booking_id === bookingId) || null;

      return {
        booking,
        request: req,
        driver: driver ? { full_name: driver.full_name, phone: driver.phone } : null,
        passenger: passenger ? { full_name: passenger.full_name, phone: passenger.phone } : null,
        payment,
        receipt_number: `RCP-${booking.id.toUpperCase()}`,
        issued_at: booking.completed_at || booking.updated_at
      };
    }

    // =========================================================================
    // FAVOURITES & SAVED ADDRESSES
    // =========================================================================
    if (action === "add_favourite") {
      const driverId = data.driver_id;
      const exists = this.db.favourites.some((f) => f.passenger_id === userId && f.driver_id === driverId);
      if (!exists) {
        this.db.favourites.push({ passenger_id: userId, driver_id: driverId, created_at: new Date().toISOString() });
        this._persistLocalDb();
      }
      return { success: true };
    }

    if (action === "remove_favourite") {
      const driverId = data.driver_id;
      this.db.favourites = this.db.favourites.filter((f) => !(f.passenger_id === userId && f.driver_id === driverId));
      this._persistLocalDb();
      return { success: true };
    }

    if (action === "list_favourites") {
      const driverIds = this.db.favourites.filter((f) => f.passenger_id === userId).map((f) => f.driver_id);
      const drivers = this.db.profiles.filter((p) => driverIds.includes(p.id) || driverIds.includes(p.user_id));
      return { favourites: drivers };
    }

    if (action === "create_saved_address") {
      const addr = {
        id: `addr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: userId,
        label: data.label || "Saved Address",
        address: data.address || "",
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        created_at: new Date().toISOString()
      };
      this.db.saved_addresses.push(addr);
      this._persistLocalDb();
      return addr;
    }

    if (action === "list_saved_addresses") {
      const list = this.db.saved_addresses.filter((a) => a.user_id === userId);
      return { addresses: list };
    }

    if (action === "update_saved_address") {
      const addr = this.db.saved_addresses.find((a) => a.id === data.id && a.user_id === userId);
      if (!addr) throw new Error("Address not found.");
      if (data.label) addr.label = data.label;
      if (data.address) addr.address = data.address;
      this._persistLocalDb();
      return addr;
    }

    if (action === "delete_saved_address") {
      this.db.saved_addresses = this.db.saved_addresses.filter((a) => !(a.id === data.id && a.user_id === userId));
      this._persistLocalDb();
      return { success: true };
    }

    if (action === "list_bids_for_request") {
      const targetReqId = request_id || data.request_id;
      if (!targetReqId) throw new Error("request_id is required.");

      let bids = [];
      const useSupabase = Boolean(this.isLive && this.supabaseAdmin && isUuid(targetReqId));
      if (useSupabase) {
        const loadedRequest = await this._loadRequestRecord(targetReqId);
        if (!loadedRequest) throw new Error("Service request not found.");
        if (loadedRequest.record.passenger_id !== userId) throw new Error("Forbidden: You do not own this request.");
        const { data: supabaseBids, error } = await this.supabaseAdmin
          .from("bids")
          .select("*")
          .eq("request_id", targetReqId)
          .neq("status", "withdrawn")
          .order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to list offers from Supabase: ${error.message}`);
        bids = supabaseBids || [];
      } else {
        const localRequest = (this.db.service_requests || []).find((request) => request.id === targetReqId);
        if (localRequest && localRequest.passenger_id !== userId) throw new Error("Forbidden: You do not own this request.");
        bids = (this.db.bids || []).filter((b) => b.request_id === targetReqId && b.status !== "withdrawn");
      }

      const hydratedBids = await Promise.all(bids.map((b) => this._hydrateBid(b)));
      const sorted = hydratedBids.sort((a, b) => (a.amount || 0) - (b.amount || 0));
      return { bids: sorted, total: sorted.length };
    }

    if (action === "list_driver_bids") {
      let bids = [];
      if (this.isLive && this.supabaseAdmin) {
        const { data: supabaseBids, error } = await this.supabaseAdmin
          .from("bids")
          .select("*")
          .eq("driver_id", userId)
          .order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to list driver offers from Supabase: ${error.message}`);
        bids = supabaseBids || [];
      } else {
        bids = (this.db.bids || []).filter((b) => b.driver_id === userId);
      }

      const hydratedBids = await Promise.all(bids.map((b) => this._hydrateBid(b)));
      const sorted = hydratedBids.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return { bids: sorted, total: sorted.length };
    }

    if (action === "admin_list_verifications") {
      await requireAdmin();
      const requestedFilter = String(data.status_filter || data.filter || "pending").toLowerCase().trim();

      let profiles = [];
      let allDocs = [];
      let allVehicles = [];
      let allPhotos = [];

      if (this.isLive && this.supabaseAdmin) {
        // Query profiles
        const { data: cloudProfiles, error: profErr } = await this.supabaseAdmin
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (profErr) {
          throw new Error(`Failed to query profiles from Supabase: ${profErr.message}`);
        }
        profiles = (cloudProfiles || []).filter((p) =>
          ["driver", "owner", "vehicle_owner", "machinery_owner", "logistics", "cargo_owner", "provider"].includes(p.role)
        );

        // Query verification documents
        const { data: cloudDocs, error: docErr } = await this.supabaseAdmin
          .from("verification_documents")
          .select("*")
          .order("created_at", { ascending: false });

        if (docErr) {
          throw new Error(`Failed to query verification_documents from Supabase: ${docErr.message}`);
        }
        allDocs = cloudDocs || [];

        // Query vehicles
        const { data: cloudVehicles, error: vehErr } = await this.supabaseAdmin
          .from("vehicles")
          .select("*");
        if (vehErr) {
          throw new Error(`Failed to query vehicles from Supabase: ${vehErr.message}`);
        }
        allVehicles = cloudVehicles || [];

        // Query vehicle photos
        const { data: cloudPhotos, error: photoErr } = await this.supabaseAdmin
          .from("vehicle_photos")
          .select("*");
        if (photoErr) {
          throw new Error(`Failed to query vehicle_photos from Supabase: ${photoErr.message}`);
        }
        allPhotos = cloudPhotos || [];
      } else {
        profiles = this.db.profiles.filter((p) =>
          ["driver", "owner", "vehicle_owner", "machinery_owner", "logistics", "cargo_owner", "provider"].includes(p.role)
        );
        allDocs = this.db.verification_documents || [];
        allVehicles = this.db.vehicles || [];
        allPhotos = this.db.vehicle_photos || [];
      }

      const queue = profiles.map((profile) => {
        const userDocs = allDocs.filter((d) => d.user_id === profile.id);
        const userVehicles = allVehicles.filter((v) => v.driver_id === profile.id);

        const timestamps = [
          profile.created_at,
          ...userVehicles.map((v) => v.created_at),
          ...userDocs.map((d) => d.created_at || d.uploaded_at)
        ].filter(Boolean).map((t) => new Date(t).getTime()).filter(Number.isFinite);

        const submittedAt = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : profile.created_at;

        return {
          id: profile.id,
          user_id: profile.id,
          full_name: profile.full_name || profile.name || "Provider",
          email: profile.email || "",
          phone: profile.phone || profile.phone_number || "",
          role: profile.role,
          profile_image_url: profile.profile_photo_url || (profile.profile_image_id ? `/api/files/preview/${profile.profile_image_id}` : ""),
          verification_status: profile.verification_status || "unverified",
          rejection_reason: profile.verification_rejection_reason || "",
          account_status: profile.account_status || "active",
          submitted_at: submittedAt,
          vehicles: userVehicles.map((v) => ({
            id: v.id,
            make: v.make || "",
            model: v.model || "",
            year: v.year || null,
            registration_number: v.registration_number || "",
            service_category: v.service_category || "",
            verification_status: v.verification_status || "pending",
            rejection_reason: v.rejection_reason || "",
            created_at: v.created_at,
            photos: allPhotos.filter((p) => p.vehicle_id === v.id).map((photo) => ({
              id: photo.id,
              is_primary: photo.is_primary,
              view_url: photo.drive_file_id ? `/api/files/preview/${photo.drive_file_id}` : (photo.file_url || "")
            }))
          })),
          documents: userDocs.map((d) => ({
            id: d.id,
            document_type: d.document_type || "document",
            vehicle_id: d.vehicle_id || null,
            verification_status: d.verification_status || "pending",
            rejection_reason: d.rejection_reason || "",
            created_at: d.created_at || d.uploaded_at,
            expires_at: d.expires_at || null,
            has_file: Boolean(d.drive_file_id),
            drive_file_id: d.drive_file_id,
            view_url: `/api/files/preview/${d.drive_file_id}`
          }))
        };
      });

      // Filter queue according to requestedFilter
      const filteredQueue = queue.filter((provider) => {
        if (requestedFilter === "all") return true;
        const profStatus = provider.verification_status;
        const docStatuses = provider.documents.map((d) => d.verification_status);
        const vehicleStatuses = provider.vehicles.map((v) => v.verification_status);

        if (requestedFilter === "pending") {
          return profStatus === "pending" || profStatus === "unverified" ||
            docStatuses.some((s) => s === "pending") ||
            vehicleStatuses.some((s) => s === "pending");
        }
        if (requestedFilter === "approved" || requestedFilter === "verified") {
          return profStatus === "approved" || profStatus === "verified";
        }
        if (requestedFilter === "rejected") {
          return profStatus === "rejected" || docStatuses.includes("rejected") || vehicleStatuses.includes("rejected");
        }
        return true;
      });

      // Summary counts
      const pendingProviders = profiles.filter((p) => p.verification_status === "pending" || p.verification_status === "unverified").length;
      const pendingVehicles = allVehicles.filter((v) => v.verification_status === "pending").length;
      const pendingDocuments = allDocs.filter((d) => d.verification_status === "pending").length;
      const now = Date.now();
      const expiredDocuments = allDocs.filter((d) => d.expires_at && new Date(d.expires_at).getTime() < now).length;

      return {
        verifications: filteredQueue,
        summary: {
          pending_providers: pendingProviders,
          pending_vehicles: pendingVehicles,
          pending_documents: pendingDocuments,
          expired_documents: expiredDocuments
        }
      };
    }

    if (action === "upload_ad_asset") {
      let fileBuffer;
      let filename = data.original_filename || data.filename || "campaign_banner.jpg";
      let mimeType = data.mime_type || "image/jpeg";

      if (data.file_base64) {
        fileBuffer = Buffer.from(data.file_base64, "base64");
      } else if (data.buffer) {
        fileBuffer = Buffer.from(data.buffer);
      } else {
        throw new Error("No campaign creative file provided.");
      }

      const upload = await googleDriveStorage.uploadFile({
        buffer: fileBuffer,
        originalFilename: filename,
        mimeType,
        folderPath: DRIVE_FOLDERS.PAYMENTS_ADVERTISING,
        metadata: { userId, type: "ad_creative" }
      });

      return {
        file_id: upload.id,
        $id: upload.id,
        url: `/api/files/preview/${upload.id}`,
        storage_provider: "google_drive",
        name: filename,
        size: upload.size
      };
    }

    // =========================================================================
    // 8. MESSAGES & NOTIFICATIONS
    // =========================================================================
    if (action === "send_message") {
      const msg = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversation_id: data.conversation_id || `${userId}_${data.receiver_id}`,
        booking_id: data.booking_id || null,
        sender_id: userId,
        receiver_id: data.receiver_id,
        message: String(data.message).trim(),
        read: false,
        created_at: new Date().toISOString()
      };
      this.db.messages.push(msg);
      this._persistLocalDb();
      return msg;
    }

    if (action === "list_booking_messages") {
      const bookingId = data.booking_id;
      const msgs = this.db.messages.filter((m) => m.booking_id === bookingId || (data.conversation_id && m.conversation_id === data.conversation_id));
      return { messages: msgs };
    }

    if (action === "list_notifications") {
      const list = this.db.notifications.filter((n) => n.user_id === userId);
      return { notifications: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    if (action === "mark_notification_read") {
      const notif = this.db.notifications.find((n) => n.id === data.notification_id && n.user_id === userId);
      if (notif) notif.read = true;
      this._persistLocalDb();
      return { success: true };
    }

    // =========================================================================
    // 9. DRIVER PRESENCE
    // =========================================================================
    if (action === "driver_heartbeat") {
      const existing = this.db.driver_presence.find((p) => p.driver_id === userId);
      const now = new Date().toISOString();
      if (existing) {
        existing.is_online = true;
        existing.last_seen_at = now;
        if (data.latitude) existing.current_lat = data.latitude;
        if (data.longitude) existing.current_lng = data.longitude;
        existing.updated_at = now;
      } else {
        this.db.driver_presence.push({
          driver_id: userId,
          is_online: true,
          last_seen_at: now,
          current_lat: data.latitude || null,
          current_lng: data.longitude || null,
          created_at: now,
          updated_at: now
        });
      }
      this._persistLocalDb();
      return { success: true, timestamp: now };
    }

    if (action === "driver_set_offline") {
      const now = new Date().toISOString();
      const existing = this.db.driver_presence.find((presence) => presence.driver_id === userId);
      if (existing) {
        existing.is_online = false;
        existing.updated_at = now;
      } else {
        this.db.driver_presence.push({
          driver_id: userId,
          is_online: false,
          last_seen_at: now,
          current_lat: null,
          current_lng: null,
          created_at: now,
          updated_at: now
        });
      }
      this._persistLocalDb();
      return { success: true, is_online: false };
    }

    if (action === "get_driver_presence") {
      const targetDriverId = data.driver_id || userId;
      const pres = this.db.driver_presence.find((p) => p.driver_id === targetDriverId);
      if (!pres) return { is_online: false };

      // Consider offline if no heartbeat within 3 minutes (180,000 ms)
      const diff = Date.now() - new Date(pres.last_seen_at).getTime();
      const isOnline = pres.is_online && diff < 180000;
      return { ...pres, is_online: isOnline };
    }

    // =========================================================================
    // 10. PAYMENTS & SUBSCRIPTIONS (EcoCash + Google Drive Storage)
    // =========================================================================
    if (action === "admin_manage_payment_destination") {
      await requireAdmin();
      if (!this.supabaseAdmin) throw new Error("Server payment destination storage is unavailable.");

      const operation = String(data.operation || "list").trim().toLowerCase();
      if (operation === "list") {
        const { data: destinations, error } = await this.supabaseAdmin
          .from("payment_destinations")
          .select("*")
          .order("display_order", { ascending: true });
        if (error) throw new Error(`Failed to load payment destinations: ${error.message}`);
        return { destinations: destinations || [], total: destinations?.length || 0, source: "supabase" };
      }

      if (operation === "create") {
        if (!String(data.account_name || "").trim() || !String(data.account_number || "").trim()) {
          throw new Error("Missing required destination fields (account_name, account_number).");
        }
        const payload = {
          provider: String(data.provider || data.payment_method || "ecocash").trim().toLowerCase(),
          account_name: String(data.account_name).trim(),
          account_number: String(data.account_number).trim(),
          instructions: String(data.instructions || "").trim(),
          active: data.active !== undefined ? Boolean(data.active) : true,
          display_order: Number.parseInt(data.display_order, 10) || 0,
          updated_at: new Date().toISOString()
        };
        const { data: created, error } = await this.supabaseAdmin
          .from("payment_destinations")
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(`Failed to create payment destination: ${error.message}`);
        await logActivity("destination_created", `Payment destination created: ${created.account_name}`, created.account_number, created.id);
        return created;
      }

      const destinationId = data.destination_id || data.id;
      if (!isUuid(destinationId)) throw new Error("Missing or invalid destination_id.");

      if (operation === "update") {
        const updateData = { updated_at: new Date().toISOString() };
        if (data.account_name !== undefined) updateData.account_name = String(data.account_name).trim();
        if (data.account_number !== undefined) updateData.account_number = String(data.account_number).trim();
        if (data.provider !== undefined || data.payment_method !== undefined) {
          updateData.provider = String(data.provider || data.payment_method).trim().toLowerCase();
        }
        if (data.instructions !== undefined) updateData.instructions = String(data.instructions).trim();
        if (data.active !== undefined) updateData.active = Boolean(data.active);
        if (data.display_order !== undefined) updateData.display_order = Number.parseInt(data.display_order, 10) || 0;
        const { data: updated, error } = await this.supabaseAdmin
          .from("payment_destinations")
          .update(updateData)
          .eq("id", destinationId)
          .select()
          .single();
        if (error) throw new Error(`Failed to update payment destination: ${error.message}`);
        return updated;
      }

      if (operation === "toggle_active") {
        const { data: current, error: loadError } = await this.supabaseAdmin
          .from("payment_destinations")
          .select("id, active")
          .eq("id", destinationId)
          .single();
        if (loadError) throw new Error(`Failed to load payment destination: ${loadError.message}`);
        const { data: updated, error } = await this.supabaseAdmin
          .from("payment_destinations")
          .update({ active: !current.active, updated_at: new Date().toISOString() })
          .eq("id", destinationId)
          .select()
          .single();
        if (error) throw new Error(`Failed to toggle payment destination: ${error.message}`);
        return updated;
      }

      if (operation === "delete") {
        const { error } = await this.supabaseAdmin.from("payment_destinations").delete().eq("id", destinationId);
        if (error) throw new Error(`Failed to delete payment destination: ${error.message}`);
        return { success: true, deleted: destinationId };
      }

      throw new Error(`Unsupported destination operation: ${operation}`);
    }

    if (action === "admin_manage_subscription_plan") {
      await requireAdmin();
      if (!this.supabaseAdmin) throw new Error("Server subscription plan storage is unavailable.");

      const operation = String(data.operation || "list").trim().toLowerCase();
      if (operation === "list") {
        const { data: plans, error } = await this.supabaseAdmin
          .from("subscription_plans")
          .select("*")
          .order("display_order", { ascending: true });
        if (error) throw new Error(`Failed to load subscription plans: ${error.message}`);
        return { plans: plans || [], total: plans?.length || 0, source: "supabase" };
      }

      if (operation === "create") {
        if (!String(data.name || "").trim() || !String(data.slug || "").trim() || !positiveNumber(data.price) || !positiveNumber(data.duration_days)) {
          throw new Error("Missing required plan fields (name, slug, price, duration_days).");
        }
        const payload = {
          name: String(data.name).trim(),
          slug: String(data.slug).trim().toLowerCase(),
          description: String(data.description || "").trim(),
          price: positiveNumber(data.price),
          currency: String(data.currency || "USD").trim().toUpperCase(),
          duration_days: Math.trunc(positiveNumber(data.duration_days)),
          active: data.active !== undefined ? Boolean(data.active) : true,
          recommended: Boolean(data.recommended),
          display_order: Number.parseInt(data.display_order, 10) || 0,
          features: Array.isArray(data.features) ? data.features : [],
          updated_at: new Date().toISOString()
        };
        const { data: created, error } = await this.supabaseAdmin
          .from("subscription_plans")
          .insert(payload)
          .select()
          .single();
        if (error) throw new Error(`Failed to create subscription plan: ${error.message}`);
        await logActivity("plan_created", `Subscription plan created: ${created.name}`, created.slug, created.id);
        return created;
      }

      const planId = data.plan_id || data.id;
      if (!isUuid(planId)) throw new Error("Missing or invalid plan_id.");

      if (operation === "update") {
        const updateData = { updated_at: new Date().toISOString() };
        if (data.name !== undefined) updateData.name = String(data.name).trim();
        if (data.slug !== undefined) updateData.slug = String(data.slug).trim().toLowerCase();
        if (data.description !== undefined) updateData.description = String(data.description).trim();
        if (data.price !== undefined) updateData.price = positiveNumber(data.price);
        if (data.currency !== undefined) updateData.currency = String(data.currency).trim().toUpperCase();
        if (data.duration_days !== undefined) updateData.duration_days = Math.trunc(positiveNumber(data.duration_days));
        if (data.active !== undefined) updateData.active = Boolean(data.active);
        if (data.recommended !== undefined) updateData.recommended = Boolean(data.recommended);
        if (data.display_order !== undefined) updateData.display_order = Number.parseInt(data.display_order, 10) || 0;
        if (data.features !== undefined) updateData.features = Array.isArray(data.features) ? data.features : [];
        const { data: updated, error } = await this.supabaseAdmin
          .from("subscription_plans")
          .update(updateData)
          .eq("id", planId)
          .select()
          .single();
        if (error) throw new Error(`Failed to update subscription plan: ${error.message}`);
        return updated;
      }

      if (operation === "toggle_active") {
        const { data: current, error: loadError } = await this.supabaseAdmin
          .from("subscription_plans")
          .select("id, active")
          .eq("id", planId)
          .single();
        if (loadError) throw new Error(`Failed to load subscription plan: ${loadError.message}`);
        const { data: updated, error } = await this.supabaseAdmin
          .from("subscription_plans")
          .update({ active: !current.active, updated_at: new Date().toISOString() })
          .eq("id", planId)
          .select()
          .single();
        if (error) throw new Error(`Failed to toggle subscription plan: ${error.message}`);
        return updated;
      }

      if (operation === "delete") {
        const { error } = await this.supabaseAdmin.from("subscription_plans").delete().eq("id", planId);
        if (error) throw new Error(`Failed to delete subscription plan: ${error.message}`);
        return { success: true, deleted: planId };
      }

      throw new Error(`Unsupported plan operation: ${operation}`);
    }

    if (action === "list_payment_destinations") {
      if (this.isLive && this.supabaseAdmin) {
        const { data: destinations, error } = await this.supabaseAdmin
          .from("payment_destinations")
          .select("*")
          .eq("active", true)
          .order("display_order", { ascending: true });
        if (!error && destinations?.length) return { destinations, source: "supabase" };
        if (error) console.warn("[payments] Supabase destination lookup unavailable:", error.message);
      }
      return {
        destinations: this.db.payment_destinations.filter((d) => d.active).sort((a, b) => a.display_order - b.display_order),
        source: "trusted_server_config"
      };
    }

    if (action === "list_subscription_plans") {
      if (this.isLive && this.supabaseAdmin) {
        let plansQuery = this.supabaseAdmin
          .from("subscription_plans")
          .select("*")
          .order("display_order", { ascending: true });
        if (!data.include_all) plansQuery = plansQuery.eq("active", true);
        const { data: plans, error } = await plansQuery;
        if (!error && plans?.length) return { plans, source: "supabase" };
        if (error) console.warn("[payments] Supabase plan lookup unavailable:", error.message);
      }
      return {
        plans: this.db.subscription_plans.filter((p) => p.active).sort((a, b) => a.display_order - b.display_order),
        source: "trusted_server_config"
      };
    }

    if (action === "upload_payment_proof") {
      let fileBuffer;
      let filename = data.original_filename || data.filename || "payment_proof.jpg";
      let mimeType = data.mime_type || "image/jpeg";

      if (data.file_base64) {
        fileBuffer = Buffer.from(data.file_base64, "base64");
      } else if (data.buffer) {
        fileBuffer = Buffer.from(data.buffer);
      } else {
        throw new Error("Payment proof file data is required.");
      }

      const allowedProofTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
      if (!allowedProofTypes.has(String(mimeType).toLowerCase())) {
        throw new Error("Payment proof must be a JPG, PNG, or PDF file.");
      }
      if (!fileBuffer.length || fileBuffer.length > 5 * 1024 * 1024) {
        throw new Error("Payment proof must be between 1 byte and 5MB.");
      }

      const upload = await googleDriveStorage.uploadFile({
        buffer: fileBuffer,
        originalFilename: filename,
        mimeType,
        folderPath: DRIVE_FOLDERS.PAYMENTS_SUBSCRIPTIONS,
        metadata: { userId }
      });

      return {
        file_id: upload.id,
        $id: upload.id,
        file_name: upload.name,
        mime_type: upload.mimeType || mimeType,
        storage_provider: "google_drive",
        size: upload.size
      };
    }

    if (action === "submit_ecocash_payment") {
      const destinationId = data.destination_account_id || data.payment_destination_id;
      if (!destinationId) throw new Error("Destination account required.");

      let dest = null;
      let supabasePaymentsAvailable = false;
      if (this.isLive && this.supabaseAdmin && isUuid(destinationId)) {
        const { data: liveDestination, error: destinationError } = await this.supabaseAdmin
          .from("payment_destinations")
          .select("*")
          .eq("id", destinationId)
          .eq("active", true)
          .maybeSingle();
        if (!destinationError) {
          dest = liveDestination;
          supabasePaymentsAvailable = true;
        } else {
          console.warn("[payments] Supabase destination validation unavailable:", destinationError.message);
        }
      }
      if (!dest) dest = this.db.payment_destinations.find((d) => d.id === destinationId && d.active) || null;
      if (!dest) throw new Error("Invalid or inactive payment destination.");

      const requestedPlanId = data.plan_id || data.related_id;
      if (!requestedPlanId) throw new Error("Subscription plan is required.");
      let plan = null;
      if (this.isLive && this.supabaseAdmin) {
        let planQuery = this.supabaseAdmin.from("subscription_plans").select("*").eq("active", true);
        planQuery = isUuid(requestedPlanId) ? planQuery.eq("id", requestedPlanId) : planQuery.eq("slug", requestedPlanId);
        const { data: livePlan, error: planError } = await planQuery.maybeSingle();
        if (!planError && livePlan) {
          plan = livePlan;
          supabasePaymentsAvailable = supabasePaymentsAvailable && true;
        } else if (planError) {
          supabasePaymentsAvailable = false;
          console.warn("[payments] Supabase plan validation unavailable:", planError.message);
        }
      }
      if (!plan) {
        plan = this.db.subscription_plans.find((p) => (p.id === requestedPlanId || p.slug === requestedPlanId) && p.active) || null;
      }
      if (!plan) throw new Error("Invalid or inactive subscription plan.");

      const expectedAmount = positiveNumber(plan.price);
      if (!expectedAmount) throw new Error("Selected plan has an invalid configured price.");
      if (data.amount_declared !== undefined && data.amount_declared !== null && Number(data.amount_declared) !== expectedAmount) {
        throw new Error("Declared amount does not match the selected plan price.");
      }

      const reference = String(data.transaction_reference || data.reference || "").trim();
      if (!reference) throw new Error("Transaction reference / EcoCash approval code is required.");

      let proofFileId = data.proof_file_id || "";
      let proofFilename = data.proof_filename || "payment_proof.jpg";

      // If proof file buffer/base64 is sent directly, upload to Google Drive
      if (data.proof_base64) {
        const fileBuffer = Buffer.from(data.proof_base64, "base64");
        const upload = await googleDriveStorage.uploadFile({
          buffer: fileBuffer,
          originalFilename: proofFilename,
          mimeType: data.proof_mime_type || "image/jpeg",
          folderPath: DRIVE_FOLDERS.PAYMENTS_SUBSCRIPTIONS,
          metadata: {
            userId,
            reference,
            destinationId
          }
        });
        proofFileId = upload.id;
        proofFilename = upload.name;
      }

      if (!proofFileId) throw new Error("Payment proof is required.");
      const proofMetadata = await googleDriveStorage.getFileMetadata(proofFileId);
      const proofMimeType = String(proofMetadata?.mimeType || "").toLowerCase();
      if (!["image/jpeg", "image/png", "application/pdf"].includes(proofMimeType)) {
        throw new Error("Stored payment proof must be a JPG, PNG, or PDF file.");
      }
      if (Number(proofMetadata?.size || 0) <= 0 || Number(proofMetadata?.size || 0) > 5 * 1024 * 1024) {
        throw new Error("Stored payment proof must be between 1 byte and 5MB.");
      }

      const now = new Date().toISOString();
      let subscription = {
        id: supabasePaymentsAvailable ? randomUUID() : `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId,
        plan_id: isUuid(plan.id) ? plan.id : null,
        plan: plan.name,
        amount: expectedAmount,
        currency: plan.currency || "USD",
        status: "pending_review",
        started_at: null,
        expires_at: null,
        created_at: now,
        updated_at: now
      };

      if (supabasePaymentsAvailable && authoritativeCaller) {
        const { data: insertedSubscription, error: subscriptionError } = await this.supabaseAdmin
          .from("subscriptions")
          .insert(subscription)
          .select()
          .single();
        if (subscriptionError) {
          supabasePaymentsAvailable = false;
          subscription.id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          console.warn("[payments] Supabase pending subscription insert unavailable:", subscriptionError.message);
        } else {
          subscription = insertedSubscription;
        }
      }

      let payment = {
        id: supabasePaymentsAvailable && authoritativeCaller ? randomUUID() : `pay_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId,
        payment_destination_id: isUuid(dest.id) ? dest.id : null,
        subscription_id: isUuid(subscription.id) ? subscription.id : null,
        payment_type: data.payment_type || "subscription",
        amount: expectedAmount,
        currency: plan.currency || "USD",
        provider: dest.provider || "ecocash",
        reference,
        provider_reference: reference,
        sender_name: data.sender_name || "",
        sender_phone: data.sender_phone || "",
        proof_storage_provider: "google_drive",
        proof_file_id: proofFileId,
        proof_filename: proofMetadata.originalFilename || proofFilename,
        status: "pending_review",
        admin_notes: "",
        created_at: now,
        updated_at: now
      };

      if (supabasePaymentsAvailable && authoritativeCaller) {
        const { data: insertedPayment, error: paymentError } = await this.supabaseAdmin
          .from("payments")
          .insert(payment)
          .select()
          .single();
        if (paymentError) {
          await this.supabaseAdmin.from("subscriptions").delete().eq("id", subscription.id);
          throw new Error(`Failed to create payment in Supabase: ${paymentError.message}`);
        }
        payment = insertedPayment;
      }

      const responsePayment = {
        ...payment,
        $id: payment.id,
        plan_id: plan.id,
        plan_name: plan.name,
        plan_duration_days: plan.duration_days,
        related_id: plan.id,
        amount_expected: expectedAmount,
        amount_declared: data.amount_declared !== undefined && data.amount_declared !== null
          ? Number(data.amount_declared)
          : expectedAmount,
        destination_account_id: dest.id,
        recipient_name: dest.account_name,
        recipient_number: dest.account_number,
        transaction_reference: reference,
        persistence: supabasePaymentsAvailable && authoritativeCaller ? "supabase" : "trusted_server_store"
      };

      this.db.subscriptions.push({ ...subscription });
      this.db.payments.push({ ...responsePayment, payment_destination_id: dest.id, subscription_id: subscription.id });
      this._persistLocalDb();
      await logActivity("payment_submitted", "Payment submitted for review", `Ref: ${reference}`, payment.id);
      return responsePayment;
    }

    if (action === "list_user_payments") {
      let list = this.db.payments.filter((p) => p.user_id === userId);
      if (authoritativeCaller) {
        const { data: livePayments, error } = await this.supabaseAdmin
          .from("payments")
          .select("*, destination:payment_destinations(*), subscription:subscriptions(*, plan_details:subscription_plans(*))")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (!error) {
          list = (livePayments || []).map((payment) => ({
            ...payment,
            plan_id: payment.subscription?.plan_id || null,
            plan_name: payment.subscription?.plan_details?.name || payment.subscription?.plan || "Subscription",
            destination_account_id: payment.destination?.id || payment.payment_destination_id,
            recipient_name: payment.destination?.account_name || "Payment destination",
            recipient_number: payment.destination?.account_number || "",
            transaction_reference: payment.provider_reference || payment.reference,
            rejection_reason: payment.admin_notes || ""
          }));
        } else {
          console.warn("[payments] Supabase user payment history unavailable:", error.message);
        }
      }
      return { payments: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    if (action === "admin_list_payments" || action === "admin_list_pending_payments") {
      await requireAdmin();
      const statusFilter = String(data.status || "").trim();
      let list = this.db.payments
        .filter((payment) => !statusFilter || payment.status === statusFilter)
        .map((payment) => {
          const profile = this.db.profiles.find((entry) => entry.id === payment.user_id || entry.user_id === payment.user_id);
          const destination = this.db.payment_destinations.find((entry) => entry.id === (payment.destination_account_id || payment.payment_destination_id));
          const subscription = this.db.subscriptions.find((entry) => entry.id === payment.subscription_id);
          const plan = this.db.subscription_plans.find((entry) => entry.id === (payment.plan_id || subscription?.plan_id));
          return {
            ...payment,
            $id: payment.id,
            provider_name: profile?.full_name || "User",
            provider_email: profile?.email || "",
            plan_id: payment.plan_id || subscription?.plan_id || null,
            plan_name: payment.plan_name || plan?.name || subscription?.plan || "Subscription",
            plan_duration_days: plan?.duration_days || null,
            destination_account_id: destination?.id || payment.destination_account_id || payment.payment_destination_id,
            recipient_name: destination?.account_name || payment.recipient_name || "Payment destination",
            recipient_number: destination?.account_number || payment.recipient_number || "",
            transaction_reference: payment.provider_reference || payment.reference,
            submitted_at: payment.created_at,
            rejection_reason: payment.admin_notes || payment.rejection_reason || ""
          };
        });
      if (this.isLive && this.supabaseAdmin) {
        let paymentQuery = this.supabaseAdmin
          .from("payments")
          .select("*, user:profiles!user_id(id, full_name, email, phone), destination:payment_destinations(*), subscription:subscriptions(*, plan_details:subscription_plans(*))")
          .order("created_at", { ascending: false });
        if (statusFilter) paymentQuery = paymentQuery.eq("status", statusFilter);
        const { data: livePayments, error } = await paymentQuery;
        if (!error) {
          list = (livePayments || []).map((payment) => ({
            ...payment,
            $id: payment.id,
            user_name: payment.user?.full_name || "User",
            user_email: payment.user?.email || "",
            provider_name: payment.user?.full_name || "User",
            provider_email: payment.user?.email || "",
            plan_id: payment.subscription?.plan_id || null,
            plan_name: payment.subscription?.plan_details?.name || payment.subscription?.plan || "Subscription",
            plan_duration_days: payment.subscription?.plan_details?.duration_days || null,
            amount_expected: Number(payment.amount),
            amount_declared: Number(payment.amount),
            destination_account_id: payment.destination?.id || payment.payment_destination_id,
            recipient_name: payment.destination?.account_name || "Payment destination",
            recipient_number: payment.destination?.account_number || "",
            transaction_reference: payment.provider_reference || payment.reference,
            submitted_at: payment.created_at,
            rejection_reason: payment.admin_notes || ""
          }));
        } else {
          console.warn("[payments] Supabase admin payment queue unavailable:", error.message);
        }
      }
      return { payments: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    if (action === "admin_get_payment_proof_preview" || action === "admin_create_payment_proof_token") {
      await requireAdmin();
      let fileId = data.file_id;
      if (!fileId && data.payment_id) {
        if (this.isLive && this.supabaseAdmin && isUuid(data.payment_id)) {
          const { data: livePayment } = await this.supabaseAdmin
            .from("payments")
            .select("proof_file_id")
            .eq("id", data.payment_id)
            .maybeSingle();
          fileId = livePayment?.proof_file_id || "";
        }
        if (!fileId) fileId = this.db.payments.find((payment) => payment.id === data.payment_id)?.proof_file_id || "";
      }
      if (!fileId) throw new Error("Missing file_id.");
      const download = await googleDriveStorage.downloadAuthorizedFile(fileId);

      const chunks = [];
      for await (const chunk of download.stream) {
        chunks.push(chunk);
      }
      const buf = Buffer.concat(chunks);
      return {
        filename: download.filename,
        mimeType: download.mimeType,
        mime_type: download.mimeType,
        size: download.size,
        base64: buf.toString("base64"),
        view_url: `data:${download.mimeType || "application/octet-stream"};base64,${buf.toString("base64")}`
      };
    }

    if (action === "approve_subscription_payment" || action === "admin_approve_payment") {
      await requireAdmin();
      const paymentId = data.payment_id;
      let payment = this.db.payments.find((p) => p.id === paymentId) || null;
      if (this.isLive && this.supabaseAdmin && isUuid(paymentId)) {
        const { data: livePayment, error } = await this.supabaseAdmin
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .maybeSingle();
        if (error) throw new Error(`Failed to load payment from Supabase: ${error.message}`);
        payment = livePayment || payment;
      }
      if (!payment) throw new Error("Payment record not found.");
      if (payment.user_id === userId) throw new Error("Forbidden: Administrators cannot approve their own payments.");
      if (payment.status !== "pending_review") throw new Error(`Conflict: Only pending-review payments can be approved (current status: ${payment.status}).`);

      payment.status = "approved";
      payment.paid_at = new Date().toISOString();
      payment.updated_at = new Date().toISOString();

      // Find plan details
      let subscription = this.db.subscriptions.find((s) => s.id === payment.subscription_id) || null;
      if (this.isLive && this.supabaseAdmin && isUuid(payment.subscription_id)) {
        const { data: liveSubscription, error } = await this.supabaseAdmin
          .from("subscriptions")
          .select("*")
          .eq("id", payment.subscription_id)
          .maybeSingle();
        if (error) throw new Error(`Failed to load pending subscription: ${error.message}`);
        subscription = liveSubscription || subscription;
      }
      let plan = this.db.subscription_plans.find((p) => p.id === subscription?.plan_id || p.id === payment.plan_id || p.slug === payment.plan_id) || null;
      if (!plan && this.isLive && this.supabaseAdmin && isUuid(subscription?.plan_id)) {
        const { data: livePlan, error } = await this.supabaseAdmin
          .from("subscription_plans")
          .select("*")
          .eq("id", subscription.plan_id)
          .maybeSingle();
        if (error) throw new Error(`Failed to load subscription plan: ${error.message}`);
        plan = livePlan;
      }
      plan = plan || DEFAULT_SUBSCRIPTION_PLANS.find((entry) => entry.name === subscription?.plan) || DEFAULT_SUBSCRIPTION_PLANS[1];
      const durationDays = plan.duration_days || 30;

      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

      // Create or activate subscription
      let sub = subscription || this.db.subscriptions.find((s) => s.user_id === payment.user_id && s.status === "pending_review");
      if (sub) {
        sub.status = "active";
        sub.plan_id = plan.id;
        sub.plan = plan.name;
        sub.amount = plan.price;
        sub.started_at = startedAt.toISOString();
        sub.expires_at = expiresAt.toISOString();
        sub.updated_at = new Date().toISOString();
      } else {
        sub = {
          id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          user_id: payment.user_id,
          plan_id: plan.id,
          plan: plan.name,
          amount: plan.price,
          currency: "USD",
          status: "active",
          started_at: startedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.db.subscriptions.push(sub);
      }

      payment.subscription_id = sub.id;

      if (this.isLive && this.supabaseAdmin && isUuid(payment.id)) {
        const { error: paymentUpdateError } = await this.supabaseAdmin
          .from("payments")
          .update({ status: "approved", paid_at: payment.paid_at, updated_at: payment.updated_at })
          .eq("id", payment.id);
        if (paymentUpdateError) throw new Error(`Failed to approve payment in Supabase: ${paymentUpdateError.message}`);

        const { error: subscriptionUpdateError } = await this.supabaseAdmin
          .from("subscriptions")
          .update({
            status: "active",
            plan_id: isUuid(plan.id) ? plan.id : sub.plan_id,
            plan: plan.name,
            amount: Number(plan.price),
            started_at: sub.started_at,
            expires_at: sub.expires_at,
            updated_at: sub.updated_at
          })
          .eq("id", sub.id);
        if (subscriptionUpdateError) throw new Error(`Failed to activate subscription in Supabase: ${subscriptionUpdateError.message}`);
      }

      const localPaymentIndex = this.db.payments.findIndex((entry) => entry.id === payment.id);
      if (localPaymentIndex >= 0) this.db.payments[localPaymentIndex] = { ...this.db.payments[localPaymentIndex], ...payment };
      else this.db.payments.push({ ...payment });
      const localSubscriptionIndex = this.db.subscriptions.findIndex((entry) => entry.id === sub.id);
      if (localSubscriptionIndex >= 0) this.db.subscriptions[localSubscriptionIndex] = { ...this.db.subscriptions[localSubscriptionIndex], ...sub };
      else this.db.subscriptions.push({ ...sub });

      // Notify User
      this.db.notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: payment.user_id,
        type: "payment_approved",
        title: "Subscription Payment Approved!",
        message: `Your payment of $${Number(payment.amount).toFixed(2)} was approved. Subscription active until ${expiresAt.toLocaleDateString()}.`,
        related_id: sub.id,
        read: false,
        created_at: new Date().toISOString()
      });

      this._persistLocalDb();
      await logActivity("payment_approved", `Approved payment for ${plan.name}`, `User: ${payment.user_id}`, payment.id);
      return { ...payment, $id: payment.id, payment, subscription: sub };
    }

    if (action === "reject_subscription_payment" || action === "admin_reject_payment") {
      await requireAdmin();
      const paymentId = data.payment_id;
      let payment = this.db.payments.find((p) => p.id === paymentId) || null;
      if (this.isLive && this.supabaseAdmin && isUuid(paymentId)) {
        const { data: livePayment, error } = await this.supabaseAdmin
          .from("payments")
          .select("*")
          .eq("id", paymentId)
          .maybeSingle();
        if (error) throw new Error(`Failed to load payment from Supabase: ${error.message}`);
        payment = livePayment || payment;
      }
      if (!payment) throw new Error("Payment record not found.");
      if (payment.user_id === userId) throw new Error("Forbidden: Administrators cannot reject their own payments.");
      if (payment.status !== "pending_review") throw new Error(`Conflict: Only pending-review payments can be rejected (current status: ${payment.status}).`);

      payment.status = "rejected";
      payment.admin_notes = data.rejection_reason || data.reason || "Payment details could not be verified.";
      payment.updated_at = new Date().toISOString();

      if (this.isLive && this.supabaseAdmin && isUuid(payment.id)) {
        const { error: paymentUpdateError } = await this.supabaseAdmin
          .from("payments")
          .update({ status: "rejected", admin_notes: payment.admin_notes, updated_at: payment.updated_at })
          .eq("id", payment.id);
        if (paymentUpdateError) throw new Error(`Failed to reject payment in Supabase: ${paymentUpdateError.message}`);
        if (isUuid(payment.subscription_id)) {
          const { error: subscriptionUpdateError } = await this.supabaseAdmin
            .from("subscriptions")
            .update({ status: "inactive", updated_at: payment.updated_at })
            .eq("id", payment.subscription_id)
            .eq("status", "pending_review");
          if (subscriptionUpdateError) throw new Error(`Failed to close pending subscription: ${subscriptionUpdateError.message}`);
        }
      }

      const localPaymentIndex = this.db.payments.findIndex((entry) => entry.id === payment.id);
      if (localPaymentIndex >= 0) this.db.payments[localPaymentIndex] = { ...this.db.payments[localPaymentIndex], ...payment };
      const localSub = this.db.subscriptions.find((entry) => entry.id === payment.subscription_id);
      if (localSub?.status === "pending_review") {
        localSub.status = "inactive";
        localSub.updated_at = payment.updated_at;
      }

      this.db.notifications.push({
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: payment.user_id,
        type: "payment_rejected",
        title: "Payment Submission Declined",
        message: `Your payment submission was rejected: ${payment.admin_notes}`,
        related_id: payment.id,
        read: false,
        created_at: new Date().toISOString()
      });

      this._persistLocalDb();
      return payment;
    }

    // =========================================================================
    // 11. ADMIN & BACKUP EXPORTS
    // =========================================================================
    if (action === "admin_get_platform_stats") {
      await requireAdmin();
      return {
        totalUsers: this.db.profiles.length,
        totalDrivers: this.db.profiles.filter((p) => p.role === "driver").length,
        totalVehicles: this.db.vehicles.length,
        totalRequests: this.db.service_requests.length,
        totalBookings: this.db.bookings.length,
        totalRevenue: this.db.payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0).toFixed(2),
        pendingPayments: this.db.payments.filter((p) => p.status === "pending_review").length,
        pendingVerifications: this.db.verification_documents.filter((d) => d.verification_status === "pending").length
      };
    }

    if (action === "admin_list_users") {
      await requireAdmin();
      let users = [...this.db.profiles];
      if (this.supabaseAdmin) {
        try {
          const { data, error } = await this.supabaseAdmin.from("profiles").select("*");
          if (!error && data && data.length > 0) {
            users = data;
          }
        } catch (_) {}
      }
      return { users, total: users.length };
    }

    if (action === "admin_set_profile_verification") {
      await requireAdmin();
      const profileId = data.profile_id || data.user_id || data.id;
      const rawStatus = String(data.verification_status || data.status || "").toLowerCase().trim();
      const status = (rawStatus === "verified" || rawStatus === "approved") ? "approved" : (rawStatus === "rejected" ? "rejected" : "pending");
      const reason = data.reason || data.rejection_reason || null;
      const now = new Date().toISOString();

      if (this.isLive && this.supabaseAdmin) {
        const updatePayload = {
          verification_status: status,
          updated_at: now
        };
        if (status === "rejected") {
          updatePayload.verification_rejection_reason = reason;
        } else if (status === "approved") {
          updatePayload.verification_rejection_reason = null;
        }

        const { data: updatedProf, error } = await this.supabaseAdmin
          .from("profiles")
          .update(updatePayload)
          .eq("id", profileId)
          .select()
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to update profile verification in Supabase: ${error.message}`);
        }
      }

      const prof = this.db.profiles.find((p) => p.id === profileId || p.user_id === profileId);
      if (prof) {
        prof.verification_status = status;
        if (reason) prof.verification_rejection_reason = reason;
        prof.updated_at = now;
      }
      this._persistLocalDb();
      await logActivity("profile_verification_updated", `Admin set verification to ${status}`, `Profile: ${profileId}`, profileId);
      return prof || { id: profileId, verification_status: status };
    }

    if (action === "admin_list_verification_documents") {
      await requireAdmin();
      let docs = [];
      let profiles = [];

      if (this.isLive && this.supabaseAdmin) {
        const { data: cloudDocs, error } = await this.supabaseAdmin
          .from("verification_documents")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw new Error(`Failed to list verification documents: ${error.message}`);
        docs = cloudDocs || [];

        const { data: cloudProfiles } = await this.supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, phone, role");
        profiles = cloudProfiles || [];
      } else {
        docs = this.db.verification_documents || [];
        profiles = this.db.profiles || [];
      }

      return {
        documents: docs.map((d) => {
          const owner = profiles.find((p) => p.id === d.user_id || p.user_id === d.user_id);
          return {
            ...d,
            owner: owner ? { full_name: owner.full_name, email: owner.email, phone: owner.phone, role: owner.role } : null,
            view_url: `/api/files/preview/${d.drive_file_id || d.file_id}`
          };
        }),
        total: docs.length
      };
    }

    if (action === "admin_get_activity_logs") {
      await requireAdmin();
      const logs = this.db.activity_logs || [];
      return { logs: logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) };
    }

    if (action === "admin_get_analytics" || action === "admin_get_platform_stats") {
      await requireAdmin();
      let pendingVerifs = 0;
      let pendingDocs = 0;
      let pendingProfiles = 0;
      let pendingVehs = 0;

      if (this.isLive && this.supabaseAdmin) {
        try {
          const { count: docCount } = await this.supabaseAdmin
            .from("verification_documents")
            .select("id", { count: "exact", head: true })
            .eq("verification_status", "pending");
          pendingDocs = docCount ?? 0;

          const { count: profCount } = await this.supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .in("verification_status", ["pending", "unverified"])
            .in("role", ["driver", "owner", "vehicle_owner", "machinery_owner", "logistics"]);
          pendingProfiles = profCount ?? 0;

          const { count: vehCount } = await this.supabaseAdmin
            .from("vehicles")
            .select("id", { count: "exact", head: true })
            .eq("verification_status", "pending");
          pendingVehs = vehCount ?? 0;

          pendingVerifs = Math.max(pendingDocs, pendingProfiles, pendingVehs);
        } catch (_) {}
      } else {
        pendingDocs = this.db.verification_documents.filter((d) => d.verification_status === "pending").length;
        pendingProfiles = this.db.profiles.filter((p) => p.verification_status === "pending").length;
        pendingVehs = this.db.vehicles.filter((v) => v.verification_status === "pending").length;
        pendingVerifs = Math.max(pendingDocs, pendingProfiles, pendingVehs);
      }

      const passengers = this.db.profiles.filter((p) => ["passenger", "customer"].includes(p.role)).length;
      const providers = this.db.profiles.filter((p) => p.role === "driver" || p.role === "owner").length;
      return {
        registeredPassengers: passengers,
        registeredProviders: providers,
        activeProviders: providers,
        requestsPosted: this.db.service_requests.length,
        bookingsAwarded: this.db.bookings.length,
        completedBookings: this.db.bookings.filter((b) => b.status === "completed").length,
        cancelledBookings: this.db.bookings.filter((b) => b.status === "cancelled").length,
        activeSubscriptions: this.db.subscriptions.filter((s) => s.status === "active").length,
        verificationQueue: pendingVerifs,
        pendingVerifications: pendingVerifs,
        pendingProviders: pendingProfiles,
        pendingVehicles: pendingVehs,
        pendingDocuments: pendingDocs,
        expiredDocuments: 0,
        paymentsTotal: this.db.payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + (p.amount || 0), 0),
        openDisputes: (this.db.disputes || []).filter((d) => d.status === "open").length
      };
    }

    if (action === "admin_create_verification_file_token") {
      await requireAdmin();
      const documentId = data.document_id || data.id;
      let fileId = null;

      if (this.isLive && this.supabaseAdmin) {
        const { data: doc, error } = await this.supabaseAdmin
          .from("verification_documents")
          .select("id, drive_file_id")
          .eq("id", documentId)
          .maybeSingle();
        if (error || !doc) {
          const { data: byDrive } = await this.supabaseAdmin
            .from("verification_documents")
            .select("id, drive_file_id")
            .eq("drive_file_id", documentId)
            .maybeSingle();
          if (byDrive) fileId = byDrive.drive_file_id;
        } else {
          fileId = doc.drive_file_id;
        }
      }

      if (!fileId) {
        const localDoc = (this.db.verification_documents || []).find((d) => d.id === documentId || d.drive_file_id === documentId);
        if (localDoc) fileId = localDoc.drive_file_id || localDoc.file_id;
      }

      if (!fileId) {
        fileId = documentId;
      }

      return {
        view_url: `/api/files/preview/${fileId}`,
        expires_at: new Date(Date.now() + 300000).toISOString()
      };
    }

    // =========================================================================
    // 12. ADVERTISING
    // =========================================================================
    if (action === "list_ad_rate_cards") {
      return {
        rate_cards: [
          { id: "rc_banner_home", placement: "home_banner", daily_rate: 5.0, name: "Home Banner" },
          { id: "rc_popup_promotions", placement: "popup_promo", daily_rate: 10.0, name: "Promo Popup" },
          { id: "rc_driver_feed", placement: "driver_feed", daily_rate: 7.5, name: "Driver Feed Banner" }
        ]
      };
    }

    if (action === "list_ad_packages") {
      return {
        packages: [
          { slug: "starter", name: "Starter Campaign", price: 25.0, duration_days: 7, placement: "home_banner" },
          { slug: "growth", name: "Growth Campaign", price: 75.0, duration_days: 30, placement: "home_banner" },
          { slug: "premium", name: "Premium Takeover", price: 150.0, duration_days: 30, placement: "popup_promo" }
        ]
      };
    }

    if (action === "list_active_popup_ads") {
      const ads = (this.db.ad_campaigns || []).filter((c) => c.status === "approved" || c.status === "active");
      return { campaigns: ads };
    }

    if (action === "calculate_ad_price") {
      const days = data.duration_days || 7;
      const rate = 5.0;
      return {
        duration_days: days,
        daily_rate: rate,
        total_price: days * rate,
        currency: "USD"
      };
    }

    if (action === "submit_ad_campaign") {
      const campaign = {
        id: `ad_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        user_id: userId,
        title: data.title || "Advertising Campaign",
        placement: data.placement || "home_banner",
        image_file_id: data.image_file_id || "",
        image_url: data.image_url || (data.image_file_id ? `/api/files/preview/${data.image_file_id}` : ""),
        link_url: data.link_url || "",
        duration_days: data.duration_days || 7,
        total_cost: parseFloat(data.total_cost || 35.0),
        status: "pending_review",
        created_at: new Date().toISOString()
      };
      if (!this.db.ad_campaigns) this.db.ad_campaigns = [];
      this.db.ad_campaigns.push(campaign);
      this._persistLocalDb();
      return campaign;
    }

    if (action === "create_backup_export") {
      await requireAdmin();
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `transmove-backup-${timestamp}.json`;
      const exportData = JSON.stringify({
        version: "2.0-supabase",
        exported_at: new Date().toISOString(),
        database: this.db
      }, null, 2);

      const upload = await googleDriveStorage.uploadFile({
        buffer: Buffer.from(exportData),
        originalFilename: filename,
        mimeType: "application/json",
        folderPath: DRIVE_FOLDERS.BACKUPS
      });

      return {
        success: true,
        filename,
        drive_file_id: upload.id,
        folder: DRIVE_FOLDERS.BACKUPS,
        size: upload.size
      };
    }

    throw new Error(`Unsupported trusted action: '${action}'`);
  }
}

export const supabaseBackendEngine = new SupabaseBackendEngine();
