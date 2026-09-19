// ==============================================================================
// TRANSMOVE AUTHENTICATION & USER PROFILE SERVICE
// Primary Backend: Supabase Auth & PostgreSQL Profiles via Trusted API
// Appwrite fallback preserved intact.
// ==============================================================================
import {
  getAppwriteAccount,
  getAppwriteClient,
  getAppwriteDatabases,
  getAppwriteStorage,
  APPWRITE_CONFIG,
  getTrustedApiEndpoint,
  clearAppwriteJWTCache,
  ID,
  Query,
  Permission,
  Role
} from "../config/appwrite.js";
import { getSupabase, getAuthJwt } from "../config/supabase.js";

// Internal registry for auth state change subscribers
const authListeners = new Set();

function isSupabasePrimary() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return (window.localStorage.getItem("transmove_database_provider") || "supabase") === "supabase";
    }
  } catch (_) {}
  return true;
}

export const AuthService = {
  /**
   * Formats profile document for maximum frontend compatibility,
   * providing standard field aliases used throughout TransMove.
   */
  _formatProfile(doc) {
    if (!doc) return null;
    let photoUrl = "";
    if (doc.profile_image_id) {
      try {
        const storage = getAppwriteStorage();
        photoUrl = storage.getFileView(APPWRITE_CONFIG.bucketId, doc.profile_image_id);
      } catch (_) {}
    } else if (doc.profile_photo_url) {
      photoUrl = doc.profile_photo_url;
    }

    const uid = doc.user_id || doc.id || doc.$id;
    return {
      ...doc,
      id: uid,
      $id: uid,
      user_id: uid,
      phone_number: doc.phone || doc.phone_number || "",
      phone: doc.phone || doc.phone_number || "",
      service_area: doc.city || doc.service_area || "",
      city: doc.city || doc.service_area || "",
      profile_photo_url: photoUrl
    };
  },

  /**
   * Registers a new user and creates exactly ONE matching row
   * in public.profiles via trusted API.
   * Role: 'customer' | 'driver' | 'owner' | etc.
   */
  async register({ email, password, fullName, phoneNumber, role, city }) {
    clearAppwriteJWTCache();

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
    const assignedRole = validRoles.includes(role) ? role : "customer";

    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      let user = null;
      let session = null;
      let jwt = "";

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
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
          if (error.message?.includes("already registered") || error.status === 422) {
            throw new Error("An account with this email address already exists.");
          }
          throw error;
        }

        user = data.user;
        session = data.session;
        jwt = session?.access_token || "";
      } else {
        // Local offline / mock user simulation
        const uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        user = { id: uid, $id: uid, email, user_metadata: { full_name: fullName, phone: phoneNumber, role: assignedRole } };
        jwt = `test_user_${uid}`;
        session = { access_token: jwt, user };
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem("transmove_mock_user", JSON.stringify(user));
          window.localStorage.setItem("transmove_mock_jwt", jwt);
        }
      }

      // Call trusted create_profile
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
            fullName: fullName,
            phoneNumber: phoneNumber || "",
            role: assignedRole,
            city: city || "",
            bio: ""
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData.error || "Failed to create user profile on trusted server.");
      }

      const profileDoc = await res.json();
      this.notifyAuthStateChange("SIGNED_IN", session);

      return {
        user,
        session,
        profile: this._formatProfile(profileDoc)
      };
    }

    // Appwrite Fallback Path
    const account = getAppwriteAccount();
    let user;
    try {
      user = await account.create(ID.unique(), email, password, fullName);
    } catch (err) {
      if (err.code === 409 || err.type === "user_already_exists") {
        throw new Error("An account with this email address already exists.");
      }
      throw err;
    }

    try {
      await account.deleteSession("current");
    } catch (_) {}
    clearAppwriteJWTCache();
    const session = await account.createEmailPasswordSession(email, password);

    const jwtRes = await account.createJWT();
    const endpoint = getTrustedApiEndpoint();
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwtRes.jwt}`,
        "X-Appwrite-JWT": jwtRes.jwt
      },
      body: JSON.stringify({
        action: "create_profile",
        data: {
          fullName: fullName,
          phoneNumber: phoneNumber || "",
          role: assignedRole,
          city: city || "",
          bio: ""
        }
      })
    });

    const profileDoc = await res.json();
    this.notifyAuthStateChange("SIGNED_IN", session);
    return {
      user,
      session,
      profile: this._formatProfile(profileDoc)
    };
  },

  /**
   * Signs in an existing user via Supabase Auth (or Appwrite fallback).
   */
  async login({ email, password }) {
    clearAppwriteJWTCache();

    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      let user = null;
      let session = null;
      let jwt = "";

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw new Error("Invalid credentials. Please check your email and password.");
        }
        user = data.user;
        session = data.session;
        jwt = session?.access_token || "";
      } else {
        // Check local mock users
        const mockUser = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("transmove_mock_user") : null;
        if (mockUser) {
          user = JSON.parse(mockUser);
          jwt = window.localStorage.getItem("transmove_mock_jwt") || `test_user_${user.id}`;
          session = { access_token: jwt, user };
        } else {
          const uid = `usr_${Date.now()}`;
          user = { id: uid, $id: uid, email, user_metadata: { full_name: "TransMove User" } };
          jwt = `test_user_${uid}`;
          session = { access_token: jwt, user };
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem("transmove_mock_user", JSON.stringify(user));
            window.localStorage.setItem("transmove_mock_jwt", jwt);
          }
        }
      }

      // Load matching profile via trusted API
      let profile = null;
      try {
        const endpoint = getTrustedApiEndpoint();
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`
          },
          body: JSON.stringify({
            action: "create_profile", // Idempotent: returns existing profile if exists
            jwt,
            data: {
              fullName: user?.user_metadata?.full_name || user?.name || "TransMove User",
              phoneNumber: user?.phone || "",
              role: "customer",
              city: "",
              bio: ""
            }
          })
        });
        if (res.ok) profile = await res.json();
      } catch (e) {
        console.warn("Notice: Fetching profile during login:", e.message);
      }

      this.notifyAuthStateChange("SIGNED_IN", session);
      return {
        user,
        session,
        profile: this._formatProfile(profile)
      };
    }

    // Appwrite Fallback
    const account = getAppwriteAccount();
    try {
      await account.deleteSession("current");
    } catch (_) {}

    let session;
    try {
      session = await account.createEmailPasswordSession(email, password);
      clearAppwriteJWTCache();
    } catch (err) {
      if (err.code === 401 || err.type === "user_invalid_credentials") {
        throw new Error("Invalid credentials. Please check your email and password.");
      }
      throw err;
    }

    const user = await account.get();
    const databases = getAppwriteDatabases();
    const profileList = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", user.$id),
      Query.limit(1)
    ]).catch(() => ({ documents: [] }));

    let profile = profileList.documents[0] || null;
    this.notifyAuthStateChange("SIGNED_IN", session);

    return {
      user,
      session,
      profile: this._formatProfile(profile)
    };
  },

  /**
   * Signs out currently authenticated user.
   */
  async logout() {
    clearAppwriteJWTCache();

    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.signOut().catch(() => {});
      }
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem("transmove_mock_user");
        window.localStorage.removeItem("transmove_mock_jwt");
      }
      this.notifyAuthStateChange("SIGNED_OUT", null);
      return;
    }

    const account = getAppwriteAccount();
    try {
      await account.deleteSession("current");
    } catch (_) {}
    this.notifyAuthStateChange("SIGNED_OUT", null);
  },

  /**
   * Initiates password recovery email.
   */
  async resetPassword(email) {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        return await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#reset-password`
        });
      }
    }
    const account = getAppwriteAccount();
    const redirectUrl = `${window.location.origin}/#reset-password`;
    return await account.createRecovery(email, redirectUrl);
  },

  async completePasswordReset(userId, secret, password) {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        return await supabase.auth.updateUser({ password });
      }
    }
    const account = getAppwriteAccount();
    return await account.updateRecovery(userId, secret, password);
  },

  async sendEmailVerification() {
    if (isSupabasePrimary()) return { success: true };
    const account = getAppwriteAccount();
    const redirectUrl = `${window.location.origin}/#verify-email`;
    return await account.createVerification(redirectUrl);
  },

  async verifyEmail(userId, secret) {
    if (isSupabasePrimary()) return { success: true };
    const account = getAppwriteAccount();
    return await account.updateVerification(userId, secret);
  },

  async getSession() {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        return session ? { user: session.user } : null;
      }
      const mockUser = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("transmove_mock_user") : null;
      return mockUser ? { user: JSON.parse(mockUser) } : null;
    }

    try {
      const account = getAppwriteAccount();
      const user = await account.get();
      return user ? { user } : null;
    } catch (e) {
      return null;
    }
  },

  async getCurrentUser() {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return {
            $id: user.id,
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.email,
            phone: user.phone || ""
          };
        }
      }
      const mockUser = typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("transmove_mock_user") : null;
      return mockUser ? JSON.parse(mockUser) : null;
    }

    try {
      const account = getAppwriteAccount();
      return await account.get();
    } catch (e) {
      return null;
    }
  },

  async getCurrentProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

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
          action: "create_profile", // Idempotent: returns existing profile
          jwt,
          data: {
            fullName: user.name || user.full_name || "TransMove User",
            phoneNumber: user.phone || "",
            role: "customer"
          }
        })
      });

      if (res.ok) {
        const doc = await res.json();
        return this._formatProfile(doc);
      }
    } catch (_) {}

    return {
      id: user.id || user.$id,
      $id: user.id || user.$id,
      user_id: user.id || user.$id,
      email: user.email || "",
      full_name: user.name || user.full_name || "TransMove User",
      role: "passenger",
      account_status: "active",
      verification_status: "unverified"
    };
  },

  async subscribeToVerificationState(callback) {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      const user = await this.getCurrentUser();
      if (!supabase || !user) return () => {};

      const channel = supabase
        .channel(`public:profiles:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            if (typeof callback === "function") callback({ event: payload.eventType, payload: payload.new });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Appwrite Fallback
    const account = getAppwriteAccount();
    const user = await account.get().catch(() => null);
    if (!user || typeof callback !== "function") return () => {};

    const channels = [
      `databases.transmove.collections.profiles.documents.${user.$id}`,
      "databases.transmove.collections.vehicles.documents",
      "databases.transmove.collections.verification_documents.documents"
    ];
    const unsubscribe = getAppwriteClient().subscribe(channels, (event) => {
      const payload = event?.payload || {};
      const belongsToUser = payload.user_id === user.$id || payload.driver_id === user.$id;
      if (belongsToUser) callback({ event, payload });
    });
    return typeof unsubscribe === "function" ? unsubscribe : () => {};
  },

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
      owner: "vehicle_owner",
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
      owner: "vehicle_owner",
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

  async updatePassword(newPassword, oldPassword = "") {
    if (isSupabasePrimary()) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.auth.updateUser({ password: newPassword });
        return true;
      }
    }
    const account = getAppwriteAccount();
    await account.updatePassword(newPassword, oldPassword);
    return true;
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
