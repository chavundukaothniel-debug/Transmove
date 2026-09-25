// ==============================================================================
// TRANSMOVE AUTHENTICATION & USER PROFILE SERVICE
// PRIMARY AND SOLE ACTIVE BACKEND: SUPABASE AUTH & POSTGRESQL PROFILES
// ==============================================================================
import { getSupabase, getAuthJwt } from "../config/supabase.js";
import { getTrustedApiEndpoint, getAppwriteStorage, APPWRITE_CONFIG } from "../config/appwrite.js";
import { resolveAvatarUrl } from "../utils/avatar.js";

// Internal registry for auth state change subscribers
const authListeners = new Set();

export const AuthService = {
  /**
   * Formats profile document for maximum frontend compatibility,
   * providing standard field aliases used throughout TransMove.
   */
  _formatProfile(doc) {
    if (!doc) return null;
    const photoUrl = resolveAvatarUrl(doc);

    const uid = doc.user_id || doc.id || doc.$id;
    const parseRoles = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
        return val.replace(/[{}"\s]/g, "").split(",").filter(Boolean);
      }
      return [];
    };
    const approvedRoles = [
      ...new Set([
        doc.role || "customer",
        ...parseRoles(doc.approved_roles),
        ...parseRoles(doc.approvedRoles)
      ])
    ];

    return {
      ...doc,
      id: uid,
      $id: uid,
      user_id: uid,
      approved_roles: approvedRoles,
      approvedRoles: approvedRoles,
      phone_number: doc.phone || doc.phone_number || "",
      phone: doc.phone || doc.phone_number || "",
      service_area: doc.city || doc.service_area || "",
      city: doc.city || doc.service_area || "",
      profile_photo_url: photoUrl
    };
  },

  /**
   * Registers a new user via Supabase Auth and creates exactly ONE matching row
   * in public.profiles via the trusted API.
   * Normal signup can NEVER assign the 'admin' role.
   */
  async register({ email, password, fullName, phoneNumber, role, city }) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Unable to connect to authentication service. Please check your network connection.");
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

    // SECURITY: Normal signup can NEVER assign role='admin'
    let assignedRole = validRoles.includes(role) ? role : "customer";
    if (assignedRole === "admin") {
      assignedRole = "customer";
    }

    const cleanEmail = String(email || "").trim().toLowerCase();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phoneNumber || "",
          role: assignedRole
        }
      }
    });

    if (error) {
      if (
        error.message?.includes("already registered") ||
        error.message?.includes("already exists") ||
        error.status === 422
      ) {
        throw new Error("An account with this email address already exists. Please Sign In.");
      }
      throw new Error(error.message || "Failed to create account. Please check your details.");
    }

    const user = data.user;
    const session = data.session;
    const jwt = session?.access_token || "";

    // Provision matching row in public.profiles via trusted API
    let profile = null;
    try {
      const endpoint = getTrustedApiEndpoint();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
        },
        body: JSON.stringify({
          action: "create_profile",
          jwt,
          data: {
            fullName: fullName || user?.user_metadata?.full_name || "TransMove User",
            phoneNumber: phoneNumber || "",
            role: assignedRole,
            city: city || "",
            bio: ""
          }
        })
      });

      if (res.ok) {
        profile = await res.json();
      }
    } catch (_) {}

    // Fallback: direct load if profile already created
    if (!profile && user?.id) {
      try {
        const { data: directProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (directProfile) profile = directProfile;
      } catch (_) {}
    }

    this.notifyAuthStateChange("SIGNED_IN", session);

    return {
      user,
      session,
      profile: this._formatProfile(profile)
    };
  },

  /**
   * Signs in an existing user via Supabase Auth as the SOLE active authentication provider.
   * Loads matching row from public.profiles, enforces account_status, and returns formatted profile.
   */
  async login({ email, password }) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Unable to connect to authentication service. Please check your network connection.");
    }

    const cleanEmail = String(email || "").trim().toLowerCase();

    // 1. Authenticate with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    });

    if (error) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }

    const user = data.user;
    const session = data.session;
    const jwt = session?.access_token || "";

    // Persist JWT for headless environments and tests
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("transmove_auth_jwt", jwt);
    }

    if (!user || !user.id) {
      throw new Error("Authentication failed: No valid user returned from server.");
    }

    // 2. Load exactly one row from public.profiles where profiles.id = auth user.id
    let profile = null;

    // Direct database query via Supabase RLS client
    try {
      const { data: profileRow, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!pErr && profileRow) {
        profile = profileRow;
      }
    } catch (_) {}

    // Fallback query via trusted server backend endpoint
    if (!profile) {
      try {
        const endpoint = getTrustedApiEndpoint();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`
          },
          body: JSON.stringify({
            action: "get_profile",
            jwt
          })
        });

        if (res.ok) {
          const resData = await res.json();
          profile = resData.profile || resData;
        }
      } catch (_) {}
    }

    // Provision profile if missing
    if (!profile) {
      try {
        const endpoint = getTrustedApiEndpoint();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`
          },
          body: JSON.stringify({
            action: "create_profile",
            jwt,
            data: {
              fullName: user?.user_metadata?.full_name || user?.name || cleanEmail.split("@")[0],
              phoneNumber: user?.phone || user?.user_metadata?.phone || "",
              role: user?.user_metadata?.role || "customer",
              city: "",
              bio: ""
            }
          })
        });
        if (res.ok) {
          profile = await res.json();
        }
      } catch (_) {}
    }

    if (!profile) {
      throw new Error("Your account profile could not be loaded. Please contact support.");
    }

    // 3. Enforce account_status
    if (profile.account_status === "suspended" || profile.account_status === "deactivated") {
      await supabase.auth.signOut().catch(() => {});
      throw new Error("Your account has been suspended. Please contact support.");
    }

    const formattedProfile = this._formatProfile(profile);

    // 4. Notify app listeners & return
    this.notifyAuthStateChange("SIGNED_IN", session);

    return {
      user,
      session,
      profile: formattedProfile
    };
  },

  /**
   * Signs out the currently authenticated user from Supabase Auth.
   */
  async logout() {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem("transmove_active_role");
      window.localStorage.removeItem("transmove_mock_user");
      window.localStorage.removeItem("transmove_mock_jwt");
      window.localStorage.removeItem("transmove_auth_jwt");
    }

    this.notifyAuthStateChange("SIGNED_OUT", null);
  },

  /**
   * Initiates password recovery email via Supabase Auth.
   */
  async resetPassword(email) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase authentication service unavailable.");
    }
    const cleanEmail = String(email || "").trim().toLowerCase();
    const redirectUrl = `${window.location.origin}/#reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });
    if (error) {
      throw new Error(error.message || "Failed to send password reset email.");
    }
    return { success: true };
  },

  /**
   * Completes password reset using new password via Supabase Auth.
   */
  async completePasswordReset(userId, secret, password) {
    const supabase = getSupabase();
    if (!supabase) {
      throw new Error("Supabase authentication service unavailable.");
    }
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(error.message || "Failed to update password.");
    }
    return data;
  },

  async sendEmailVerification() {
    return { success: true };
  },

  async verifyEmail(userId, secret) {
    return { success: true };
  },

  /**
   * Retrieves current Supabase session.
   */
  async getSession() {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session ? { user: session.user, session } : null;
    } catch (_) {
      return null;
    }
  },

  /**
   * Retrieves currently authenticated Supabase Auth user.
   */
  async getCurrentUser() {
    const supabase = getSupabase();
    if (!supabase) return null;

    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        return {
          $id: user.id,
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          phone: user.phone || user.user_metadata?.phone || ""
        };
      }
    } catch (_) {}

    return null;
  },

  /**
   * Loads current user's profile from Supabase PostgreSQL public.profiles.
   */
  async getCurrentProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const supabase = getSupabase();
    let profile = null;

    // 1. Direct query from Supabase
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (row) profile = row;
      } catch (_) {}
    }

    // 2. Fallback to trusted API with JWT
    if (!profile) {
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
            action: "get_profile",
            jwt
          })
        });
        if (res.ok) {
          const data = await res.json();
          profile = data.profile || data;
        }
      } catch (_) {}
    }

    if (!profile) return null;
    return this._formatProfile(profile);
  },

  /**
   * Subscribes to realtime verification state changes for current user.
   */
  async subscribeToVerificationState(callback) {
    return this.subscribeVerificationUpdates(callback);
  },

  /**
   * Realtime subscription for profile and verification document changes.
   */
  async subscribeVerificationUpdates(callback) {
    const user = await this.getCurrentUser();
    if (!user || typeof callback !== "function") return () => {};

    const supabase = getSupabase();
    if (!supabase) return () => {};

    const channelName = `profile_sync_${user.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          callback({ event: "profile_updated", payload: payload.new });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "verification_documents",
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          callback({ event: "doc_updated", payload: payload.new });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Updates non-privileged user profile fields via trusted API.
   */
  async updateProfile(updates) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    const jwt = await getAuthJwt();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({
        action: "update_profile",
        jwt,
        data: updates
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Failed to update profile via trusted server.");
    }

    const updated = await res.json();
    this.notifyAuthStateChange("USER_UPDATED", { user });
    return this._formatProfile(updated);
  },

  async submitDriverVerification({ nationalId, nationalIdPhoto, licenseUrl, vehicleDetails } = {}) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("You must be signed in to submit verification.");

    const { VehicleService } = await import("./vehicles.js");

    const docUploads = [
      { file: nationalIdPhoto, type: "national_id" },
      { file: licenseUrl, type: "driver_license" }
    ].filter((d) => d.file);

    const hasVehicle = Boolean(vehicleDetails && vehicleDetails.make);
    if (docUploads.length === 0 && !hasVehicle) {
      throw new Error("Nothing to submit. Attach your National ID or Driver's Licence document (and vehicle details) to apply for verification.");
    }

    const submitted = [];
    for (const doc of docUploads) {
      submitted.push(await VehicleService.uploadVerificationDocument(doc.file, doc.type));
    }
    if (hasVehicle) {
      submitted.push(await VehicleService.addVehicle(vehicleDetails));
    }

    return submitted;
  },

  async getApprovedRoles(user) {
    const defaultRoles = ["passenger"];
    if (!user) return defaultRoles;

    const baseRoleMap = {
      customer: "passenger",
      passenger: "passenger",
      driver: "driver",
      owner: "machinery_owner",
      cargo_owner: "cargo_owner",
      logistics: "logistics_provider",
      vehicle_owner: "vehicle_owner",
      machinery_owner: "machinery_owner",
      machinery_hirer: "machinery_hirer",
      business: "business_admin",
      business_owner: "business_owner",
      business_admin: "business_admin",
      business_dispatcher: "business_dispatcher",
      business_finance: "business_finance",
      business_employee: "business_employee",
      advertiser: "advertiser",
      admin: "admin"
    };

    const primaryRole = baseRoleMap[user.role] || "passenger";
    const approvedRoles = new Set([primaryRole]);

    const parseRoles = (val) => {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
        return val.replace(/[{}"\s]/g, "").split(",").filter(Boolean);
      }
      return [];
    };

    parseRoles(user.approved_roles).forEach((r) => approvedRoles.add(r));
    parseRoles(user.approvedRoles).forEach((r) => approvedRoles.add(r));

    if (user.role === "admin" || user.role === "machinery_owner" || user.role === "owner") {
      approvedRoles.add("machinery_owner");
    }
    if (user.role === "owner") {
      approvedRoles.add("vehicle_owner");
    }
    if (user.role === "admin") {
      approvedRoles.add("admin");
    }

    return Array.from(approvedRoles);
  },

  getPrimaryRole(user) {
    if (!user) return "guest";
    const baseRoleMap = {
      customer: "passenger",
      passenger: "passenger",
      driver: "driver",
      owner: "machinery_owner",
      cargo_owner: "cargo_owner",
      logistics: "logistics_provider",
      vehicle_owner: "vehicle_owner",
      machinery_owner: "machinery_owner",
      machinery_hirer: "machinery_hirer",
      business: "business_admin",
      advertiser: "advertiser",
      admin: "admin"
    };
    return baseRoleMap[user.role] || "passenger";
  },

  async getActiveRole(user) {
    if (!user) return "guest";
    const approvedRoles = await this.getApprovedRoles(user);
    const userId = user.user_id || user.id || user.$id;
    const saved = localStorage.getItem(`tm_active_role_${userId}`);
    if (saved && approvedRoles.includes(saved)) {
      return saved;
    }
    return this.getPrimaryRole(user);
  },

  setActiveRole(user, roleName) {
    if (!user) return;
    const userId = user.user_id || user.id || user.$id;
    localStorage.setItem(`tm_active_role_${userId}`, roleName);

    const hashRouteMap = {
      passenger: "#passenger",
      customer: "#passenger",
      driver: "#driver",
      cargo_owner: "#cargo-owner",
      logistics_provider: "#logistics",
      logistics: "#logistics",
      vehicle_owner: "#vehicle-owner",
      machinery_owner: "#machinery-owner",
      machinery_hirer: "#machinery-hirer",
      business_owner: "#business",
      business_admin: "#business",
      business_dispatcher: "#business",
      business_finance: "#business",
      business_employee: "#business",
      business: "#business",
      advertiser: "#advertiser",
      admin: "#admin"
    };

    const targetHash = hashRouteMap[roleName] || "#passenger";
    window.location.hash = targetHash;
  },

  async requestAdditionalRole(user, roleName) {
    const approvedRoles = await this.getApprovedRoles(user);
    if (approvedRoles.includes(roleName)) {
      this.setActiveRole(user, roleName);
      return { status: "active", alreadyApproved: true };
    }
    throw new Error("Additional role requests are not available yet. Roles are granted by TransMove after verification — please contact support.");
  },

  async updatePassword(newPassword) {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message || "Failed to update password.");
      return true;
    }
    throw new Error("Supabase authentication service unavailable.");
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    return {
      unsubscribe: () => authListeners.delete(callback)
    };
  },

  notifyAuthStateChange(event, session) {
    authListeners.forEach((cb) => {
      try {
        cb(event, session);
      } catch (err) {
        console.warn("Error in auth state change listener:", err);
      }
    });
  }
};
