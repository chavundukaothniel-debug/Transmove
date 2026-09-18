// ==============================================================================
// TRANSMOVE AUTHENTICATION & USER PROFILE SERVICE
// Powered by Appwrite Web SDK (Account & Databases / Profiles)
// Supabase remains intact as backup during incremental migration
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
import { getSupabase } from "../config/supabase.js";

// Internal registry for auth state change subscribers
const authListeners = new Set();

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

    return {
      ...doc,
      id: doc.user_id || doc.$id,
      phone_number: doc.phone || "",
      service_area: doc.city || "",
      profile_photo_url: photoUrl
    };
  },

  /**
   * Registers a new user with Appwrite Auth and creates exactly ONE matching row
   * in transmove.profiles with explicit row-level permissions.
   * Role: 'customer' | 'driver' | 'owner' | etc.
   */
  async register({ email, password, fullName, phoneNumber, role, city }) {
    const account = getAppwriteAccount();
    const databases = getAppwriteDatabases();

    // Enforce valid user roles for public registration (never allow normal signup to specify "admin")
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

    // 1. Create Appwrite Auth account
    let user;
    try {
      user = await account.create(ID.unique(), email, password, fullName);
    } catch (err) {
      if (err.code === 409 || err.type === "user_already_exists") {
        throw new Error("An account with this email address already exists.");
      }
      throw err;
    }

    // 2. Create authenticated session
    try {
      await account.deleteSession("current");
    } catch (_) {
      // Ignore if no prior session existed
    }
    const session = await account.createEmailPasswordSession(email, password);

    // 3. Create JWT and call trusted create_profile
    let profileDoc;
    try {
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errData.error || "Failed to create user profile on trusted server.");
      }

      profileDoc = await res.json();
    } catch (profileErr) {
      console.error("Profile creation error after account signup:", profileErr);
      throw new Error(`Account created, but profile setup failed: ${profileErr.message}`);
    }

    // 4. Send Appwrite verification email
    try {
      const redirectUrl = `${window.location.origin}/#verify-email`;
      await account.createVerification(redirectUrl);
    } catch (verifErr) {
      console.warn("Appwrite verification email dispatch notice:", verifErr.message);
    }

    // 5. Notify active auth listeners
    this.notifyAuthStateChange("SIGNED_IN", session);

    return {
      user,
      session,
      profile: this._formatProfile(profileDoc)
    };
  },

  /**
   * Signs in an existing user via Appwrite Auth.
   * Clears any lingering prior session to prevent 409 conflict.
   */
  async login({ email, password }) {
    const account = getAppwriteAccount();
    const databases = getAppwriteDatabases();

    // Clear any existing active session on client
    try {
      await account.deleteSession("current");
    } catch (_) {
      // Ignore if no active session
    }

    // Create new email/password session
    let session;
    try {
      session = await account.createEmailPasswordSession(email, password);
    } catch (err) {
      if (err.code === 401 || err.type === "user_invalid_credentials") {
        throw new Error("Invalid credentials. Please check your email and password.");
      }
      throw err;
    }

    // Retrieve current Appwrite user
    const user = await account.get();

    // Retrieve matching profile using user_id
    const profileList = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", user.$id),
      Query.limit(1)
    ]);

    let profile = profileList.documents[0] || null;

    // Self-healing fallback: create profile if missing via trusted API
    if (!profile) {
      try {
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
            action: "create_profile",
            data: {
              fullName: user.name || "TransMove User",
              phoneNumber: user.phone || "",
              role: "customer",
              city: "",
              bio: ""
            }
          })
        });

        if (res.ok) {
          profile = await res.json();
        } else {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || "Failed to initialize user profile.");
        }
      } catch (profErr) {
        console.warn("Self-healing profile creation warning:", profErr.message);
      }
    }

    // Check account status
    if (!profile) {
      await account.deleteSession("current").catch(() => {});
      throw new Error("Your account profile could not be loaded. Please try signing in again or contact support.");
    }
    if (profile?.account_status === "suspended" || profile?.account_status === "deactivated") {
      await account.deleteSession("current").catch(() => {});
      throw new Error("Your account has been suspended. Please contact support.");
    }

    // Notify auth listeners
    this.notifyAuthStateChange("SIGNED_IN", session);

    return {
      user,
      session,
      profile: this._formatProfile(profile)
    };
  },

  /**
   * Signs out currently authenticated user from Appwrite.
   */
  async logout() {
    clearAppwriteJWTCache();
    const account = getAppwriteAccount();
    try {
      await account.deleteSession("current");
    } catch (_) {
      // Ignore error if session already cleared
    }
    this.notifyAuthStateChange("SIGNED_OUT", null);
  },

  /**
   * Initiates password recovery email via Appwrite Account API.
   */
  async resetPassword(email) {
    const account = getAppwriteAccount();
    const redirectUrl = `${window.location.origin}/#reset-password`;
    return await account.createRecovery(email, redirectUrl);
  },

  /**
   * Completes password reset using userId, secret, and new password from recovery link.
   */
  async completePasswordReset(userId, secret, password) {
    const account = getAppwriteAccount();
    return await account.updateRecovery(userId, secret, password);
  },

  /**
   * Sends email verification link for currently authenticated user.
   */
  async sendEmailVerification() {
    const account = getAppwriteAccount();
    const redirectUrl = `${window.location.origin}/#verify-email`;
    return await account.createVerification(redirectUrl);
  },

  /**
   * Completes email verification using userId and secret from verification link.
   */
  async verifyEmail(userId, secret) {
    const account = getAppwriteAccount();
    return await account.updateVerification(userId, secret);
  },

  /**
   * Fetches current authenticated session/user.
   */
  async getSession() {
    try {
      const account = getAppwriteAccount();
      const user = await account.get();
      return user ? { user } : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Fetches current authenticated Appwrite account user.
   */
  async getCurrentUser() {
    try {
      const account = getAppwriteAccount();
      return await account.get();
    } catch (e) {
      return null;
    }
  },

  /**
   * Fetches current user profile from transmove.profiles.
   */
  async getCurrentProfile() {
    try {
      const account = getAppwriteAccount();
      const user = await account.get();
      if (!user) return null;

      const databases = getAppwriteDatabases();
      const res = await databases.listDocuments("transmove", "profiles", [
        Query.equal("user_id", user.$id),
        Query.limit(1)
      ]);

      if (!res.documents || res.documents.length === 0) {
        return null;
      }

      return this._formatProfile(res.documents[0]);
    } catch (e) {
      return null;
    }
  },

  /**
   * Subscribes the signed-in user to their own provider verification records.
   * Collection permissions still determine which realtime payloads are visible.
   */
  async subscribeToVerificationState(callback) {
    const account = getAppwriteAccount();
    const user = await account.get().catch(() => null);
    if (!user || typeof callback !== "function") return () => {};

    const databases = getAppwriteDatabases();
    const profiles = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", user.$id),
      Query.limit(1)
    ]);
    const profile = profiles.documents?.[0];
    if (!profile) return () => {};

    const channels = [
      `databases.transmove.collections.profiles.documents.${profile.$id}`,
      "databases.transmove.collections.vehicles.documents",
      "databases.transmove.collections.verification_documents.documents"
    ];
    const unsubscribe = getAppwriteClient().subscribe(channels, (event) => {
      const payload = event?.payload || {};
      const belongsToUser = payload.user_id === user.$id || payload.driver_id === user.$id || payload.$id === profile.$id;
      if (belongsToUser) callback({ event, payload });
    });
    return typeof unsubscribe === "function" ? unsubscribe : () => {};
  },

  /**
   * Updates current user's profile details in transmove.profiles.
   */
  async updateProfile(updates) {
    const account = getAppwriteAccount();
    const user = await account.get();
    if (!user) throw new Error("Not authenticated");

    // Cryptographically authenticate session via Appwrite JWT
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
        action: "update_profile",
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

  /**
   * Submits driver verification documents via the trusted create_verification_document path.
   */
  async submitDriverVerification({ nationalId, nationalIdPhoto, licenseUrl, vehicleDetails } = {}) {
    const account = getAppwriteAccount();
    const user = await account.get().catch(() => null);
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

  /**
   * Fetches all approved roles for the user from profile.
   */
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

  /**
   * Returns primary default role for a user account.
   */
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

  /**
   * Retrieves current active viewing role from local storage or profile default.
   */
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

  /**
   * Sets active viewing role and updates session storage.
   */
  setActiveRole(user, roleName) {
    if (!user) return;
    const userId = user.user_id || user.id || user.$id;
    localStorage.setItem(`tm_active_role_${userId}`, roleName);
    
    // Redirect to the appropriate dashboard hash route
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

  /**
   * Requests additional role approval for user account.
   * No backend exists for role requests yet, so this only activates
   * roles the user genuinely already holds and otherwise fails honestly.
   */
  async requestAdditionalRole(user, roleName) {
    const approvedRoles = await this.getApprovedRoles(user);
    if (approvedRoles.includes(roleName)) {
      this.setActiveRole(user, roleName);
      return { status: "active", alreadyApproved: true };
    }
    throw new Error("Additional role requests are not available yet. Roles are granted by TransMove after verification — please contact support.");
  },

  /**
   * Updates user password on current Appwrite account.
   */
  async updatePassword(newPassword, oldPassword = "") {
    const account = getAppwriteAccount();
    await account.updatePassword(newPassword, oldPassword);
    return true;
  },

  /**
   * Listens for auth state changes.
   */
  onAuthStateChange(callback) {
    authListeners.add(callback);
    return {
      unsubscribe: () => authListeners.delete(callback)
    };
  },

  /**
   * Broadcasts auth state events to all registered listeners.
   */
  notifyAuthStateChange(event, session) {
    authListeners.forEach(cb => {
      try {
        cb(event, session);
      } catch (err) {
        console.warn("Error in auth state change listener:", err);
      }
    });
  }
};
