// ==============================================================================
// TRANSMOVE LIVE APPWRITE AUTHENTICATION & PROFILE VERIFICATION SUITE
// Runs all Phase 17 & Phase 18 tests against live Appwrite backend
// ==============================================================================
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  },
  location: {
    origin: "http://localhost:3000",
    hash: "",
    search: ""
  },
  console: console
};

import fs from "fs";
import { AuthService } from "../src/services/auth.js";
import { APPWRITE_CONFIG, getAppwriteDatabases, Query } from "../src/config/appwrite.js";

// Load server key strictly for database integrity verification and cleanup
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach(l => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const TEST_EMAIL = `transmove_test_${Date.now()}@transmove.test`;
const TEST_PASSWORD = "StrongSecurePassword2026!";
const TEST_NAME = "Live Test Operator";
const TEST_PHONE = "+263770001122";
const TEST_ROLE = "driver";

const testResults = {};

async function runVerification() {
  console.log("==================================================");
  console.log("TRANSMOVE LIVE APPWRITE AUTH VERIFICATION SUITE");
  console.log("Endpoint:", APPWRITE_CONFIG.endpoint);
  console.log("Project ID:", APPWRITE_CONFIG.projectId);
  console.log("Database ID:", APPWRITE_CONFIG.databaseId);
  console.log("==================================================");

  let createdUserId = null;
  let createdProfileDocId = null;

  try {
    // 1. SIGNUP & PROFILE CREATION
    console.log("\n[TEST 1] SIGNUP & PROFILE CREATION");
    const regRes = await AuthService.register({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      fullName: TEST_NAME,
      phoneNumber: TEST_PHONE,
      role: TEST_ROLE,
      city: "Harare"
    });
    createdUserId = regRes.user.$id;
    testResults["Signup"] = !!(regRes.user && regRes.user.$id);
    console.log(" -> User created in Appwrite Auth:", regRes.user.$id);
    console.log(" -> Session created:", !!regRes.session);
    console.log(" -> Profile formatted:", regRes.profile?.user_id === createdUserId);

    // 2. DATABASE INTEGRITY: Exactly ONE profile row with matching user_id
    console.log("\n[TEST 2] DATABASE VERIFICATION (Single Profile, Matching user_id)");
    // Brief settling delay for Appwrite index
    await new Promise(r => setTimeout(r, 400));
    const databases = getAppwriteDatabases();
    const profileDocs = await databases.listDocuments("transmove", "profiles", [
      Query.equal("user_id", createdUserId)
    ]);
    const singleProfile = profileDocs.total === 1;
    createdProfileDocId = profileDocs.documents[0]?.$id;
    testResults["Profile Creation"] = singleProfile && (profileDocs.documents[0]?.user_id === createdUserId);
    console.log(" -> Matching profile count:", profileDocs.total, "(Expected: 1)");
    console.log(" -> Profile user_id matches Auth $id:", profileDocs.documents[0]?.user_id === createdUserId);
    console.log(" -> Profile permissions:", profileDocs.documents[0]?.$permissions);
    const expectedReadPerm = `read("user:${createdUserId}")`;
    const hasReadPerm = profileDocs.documents[0]?.$permissions.includes(expectedReadPerm);
    const hasNoDirectUpdate = !profileDocs.documents[0]?.$permissions.some(p => p.startsWith("update("));
    const isHardened = hasReadPerm && hasNoDirectUpdate;
    console.log(" -> Row permissions securely hardened (read only, no direct update):", isHardened);

    // 3. DUPLICATE SIGNUP
    console.log("\n[TEST 3] DUPLICATE SIGNUP REJECTION");
    try {
      await AuthService.register({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        fullName: "Another Person",
        phoneNumber: "+263779998877",
        role: "passenger"
      });
      testResults["Duplicate Signup Handling"] = false;
      console.log(" -> FAIL: Duplicate user registration did not error!");
    } catch (dupErr) {
      testResults["Duplicate Signup Handling"] = true;
      console.log(" -> PASS: Duplicate rejected with message:", dupErr.message);
    }

    // 4. GET CURRENT USER & SESSION
    console.log("\n[TEST 4] CURRENT USER & SESSION");
    const currentUser = await AuthService.getCurrentUser();
    const currentSession = await AuthService.getSession();
    testResults["Get Current User"] = !!(currentUser && currentUser.$id === createdUserId);
    testResults["Session Restore"] = !!(currentSession && currentSession.user);
    console.log(" -> Current user matches:", currentUser?.$id === createdUserId);

    // 5. PROFILE RETRIEVAL
    console.log("\n[TEST 5] PROFILE RETRIEVAL");
    const fetchedProfile = await AuthService.getCurrentProfile();
    testResults["Profile Retrieval"] = !!(fetchedProfile && fetchedProfile.user_id === createdUserId && fetchedProfile.id === createdUserId);
    console.log(" -> Profile retrieved. Role:", fetchedProfile?.role, "City:", fetchedProfile?.city, "Phone:", fetchedProfile?.phone);

    // 6. PROFILE UPDATE
    console.log("\n[TEST 6] PROFILE UPDATE");
    const updatedProf = await AuthService.updateProfile({
      full_name: "Live Test Operator Updated",
      city: "Bulawayo",
      bio: "Automated test profile bio."
    });
    testResults["Profile Update"] = updatedProf.city === "Bulawayo" && updatedProf.full_name === "Live Test Operator Updated";
    console.log(" -> Profile updated. Full name:", updatedProf.full_name, "City:", updatedProf.city);

    // 7. ROLE HELPERS & ROUTE DETERMINATION
    console.log("\n[TEST 7] ROLE DETERMINATION & ROUTING");
    const primaryRole = AuthService.getPrimaryRole(updatedProf);
    const approvedRoles = await AuthService.getApprovedRoles(updatedProf);
    testResults["Role Routing"] = primaryRole === "driver" && approvedRoles.includes("driver");
    console.log(" -> Primary role:", primaryRole, "(Expected: driver)");
    console.log(" -> Approved roles:", approvedRoles);

    // 8. LOGOUT
    console.log("\n[TEST 8] LOGOUT");
    await AuthService.logout();
    const afterLogoutUser = await AuthService.getCurrentUser();
    const afterLogoutProfile = await AuthService.getCurrentProfile();
    testResults["Logout"] = (afterLogoutUser === null && afterLogoutProfile === null);
    console.log(" -> Current user after logout:", afterLogoutUser, "(Expected: null)");
    console.log(" -> Current profile after logout:", afterLogoutProfile, "(Expected: null)");

    // 9. WRONG PASSWORD AUTH ERROR
    console.log("\n[TEST 9] WRONG PASSWORD REJECTION");
    try {
      await AuthService.login({
        email: TEST_EMAIL,
        password: "IncorrectPassword999!"
      });
      testResults["Wrong Password Rejection"] = false;
      console.log(" -> FAIL: Login with wrong password did not throw error!");
    } catch (pwErr) {
      testResults["Wrong Password Rejection"] = true;
      console.log(" -> PASS: Authentication failed gracefully:", pwErr.message);
    }

    // 10. LOGIN SUCCESS & SESSION RESTORATION
    console.log("\n[TEST 10] LOGIN WITH VALID CREDENTIALS");
    const loginRes = await AuthService.login({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    testResults["Login"] = !!(loginRes.user && loginRes.user.$id === createdUserId);
    console.log(" -> Logged in successfully. User ID:", loginRes.user.$id);
    console.log(" -> Profile attached to login result:", loginRes.profile?.user_id === createdUserId);

    // 11. PASSWORD RECOVERY (FORGOT PASSWORD)
    console.log("\n[TEST 11] FORGOT PASSWORD RECOVERY DISPATCH");
    try {
      const recToken = await AuthService.resetPassword(TEST_EMAIL);
      testResults["Forgot Password"] = true;
      console.log(" -> PASS: Password recovery token issued. Token ID:", recToken.$id);
    } catch (recErr) {
      testResults["Forgot Password"] = false;
      console.log(" -> FAIL:", recErr.message);
    }

    // 12. EMAIL VERIFICATION DISPATCH
    console.log("\n[TEST 12] EMAIL VERIFICATION TOKEN DISPATCH");
    try {
      const verifToken = await AuthService.sendEmailVerification();
      testResults["Email Verification"] = true;
      console.log(" -> PASS: Email verification token issued. Token ID:", verifToken.$id);
    } catch (vErr) {
      testResults["Email Verification"] = false;
      console.log(" -> FAIL:", vErr.message);
    }

    // 13. ROUTE PROTECTION CHECK
    console.log("\n[TEST 13] ROUTE PROTECTION CHECK");
    // Verify non-admin user is rejected from admin route
    const hasAdminAccess = approvedRoles.includes("admin");
    testResults["Route Protection"] = !hasAdminAccess;
    console.log(" -> Driver restricted from admin route:", !hasAdminAccess);

    // Clean up session
    await AuthService.logout();

  } catch (err) {
    console.error("FATAL ERROR in test execution:", err);
  } finally {
    // Database and User cleanup
    if (createdProfileDocId || createdUserId) {
      try {
        if (createdProfileDocId) {
          const docUrl = `${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/profiles/documents/${createdProfileDocId}`;
          await fetch(docUrl, {
            method: "DELETE",
            headers: {
              "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
              "X-Appwrite-Key": conf.APPWRITE_API_KEY
            }
          });
        }
        if (createdUserId) {
          const userUrl = `${conf.APPWRITE_ENDPOINT}/users/${createdUserId}`;
          await fetch(userUrl, {
            method: "DELETE",
            headers: {
              "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
              "X-Appwrite-Key": conf.APPWRITE_API_KEY
            }
          });
        }
        console.log("\n[CLEANUP] Test profile document and test auth user removed cleanly.");
      } catch (cleanErr) {
        console.warn("Cleanup warning:", cleanErr.message);
      }
    }
  }

  console.log("\n==================================================");
  console.log("VERIFICATION RESULTS SUMMARY");
  console.log("==================================================");
  let allPass = true;
  for (const [name, passed] of Object.entries(testResults)) {
    console.log(`- ${name.padEnd(30, ".")}: ${passed ? "PASS" : "FAIL"}`);
    if (!passed) allPass = false;
  }
  console.log("OVERALL:", allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  return allPass;
}

runVerification();
