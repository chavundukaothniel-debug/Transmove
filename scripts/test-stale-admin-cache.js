// ==============================================================================
// TRANSMOVE REGRESSION TEST: STALE SERVER ADMIN PROFILE CACHE OVERRIDE
//
// Proves:
// 1. Stale cached profile role='customer' in this.db.profiles
// 2. Authoritative Supabase profile role='admin' in cloud public.profiles
// 3. getCallerProfile() queries Supabase cloud FIRST and resolves to admin
// 4. Stale entry in this.db.profiles is updated/replaced with role='admin'
// 5. requireAdmin() allows admin action (e.g. admin_get_platform_stats)
// 6. Non-admin cloud profile (role='customer') remains strictly denied
//    even if local cache had role='admin'
// 7. Suspended admin cloud profile (account_status='suspended') remains denied
// 8. Fallback to this.db.profiles only occurs when Supabase is unavailable or errors
// ==============================================================================

import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

async function runStaleCacheRegressionTest() {
  console.log("==================================================");
  console.log("TRANSMOVE STALE ADMIN CACHE REGRESSION TEST SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Backup original state
  const originalProfiles = JSON.parse(JSON.stringify(supabaseBackendEngine.db.profiles));
  const originalSupabaseAdmin = supabaseBackendEngine.supabaseAdmin;

  const testUserId = `usr_test_${Date.now()}_admin_cache`;
  const testUserJwt = testUserId; // Using test mock JWT format supported by authenticateUser

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: STALE CACHED 'CUSTOMER' -> AUTHORITATIVE SUPABASE CLOUD 'ADMIN'
    // ---------------------------------------------------------------------------
    console.log("\n--- TEST 1: STALE LOCAL CACHE OVERRIDDEN BY AUTHORITATIVE CLOUD ADMIN ---");

    // 1. Seed local db cache with STALE customer profile
    const staleCustomerProfile = {
      id: testUserId,
      user_id: testUserId,
      email: "admin-candidate@transmove.test",
      full_name: "Admin Candidate",
      role: "customer", // STALE CACHE
      account_status: "active",
      verification_status: "approved",
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString()
    };
    supabaseBackendEngine.db.profiles.push(staleCustomerProfile);

    // Verify initial cache has role = 'customer'
    const cachedBefore = supabaseBackendEngine.db.profiles.find((p) => p.id === testUserId);
    assert(cachedBefore?.role === "customer", "Initial local cache has role='customer'");

    // 2. Mock authoritative Supabase client returning role = 'admin'
    const authoritativeCloudAdminProfile = {
      id: testUserId,
      user_id: testUserId,
      email: "admin-candidate@transmove.test",
      full_name: "Admin Candidate",
      role: "admin", // AUTHORITATIVE CLOUD VALUE
      account_status: "active",
      verification_status: "approved",
      created_at: staleCustomerProfile.created_at,
      updated_at: new Date().toISOString()
    };

    let cloudQueryCount = 0;
    supabaseBackendEngine.supabaseAdmin = {
      from(table) {
        return {
          select(fields) {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    cloudQueryCount++;
                    if (table === "profiles" && col === "id" && val === testUserId) {
                      return { data: authoritativeCloudAdminProfile, error: null };
                    }
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    // 3. Execute admin operation (admin_get_platform_stats)
    const statsResult = await supabaseBackendEngine.execute({
      action: "admin_get_platform_stats",
      jwt: testUserJwt
    });

    assert(cloudQueryCount > 0, "getCallerProfile() queried Supabase cloud FIRST before trusting cache");
    assert(Boolean(statsResult && statsResult.totalUsers !== undefined), "requireAdmin() allowed admin action (admin_get_platform_stats succeeded)");

    // 4. Verify local cache was updated to authoritative role='admin'
    const cachedAfter = supabaseBackendEngine.db.profiles.find((p) => p.id === testUserId);
    assert(cachedAfter?.role === "admin", `Local cache was updated/replaced: role='${cachedAfter?.role}'`);

    // Also verify get_profile action returns authoritative admin profile
    const profileResult = await supabaseBackendEngine.execute({
      action: "get_profile",
      jwt: testUserJwt
    });
    assert(profileResult?.role === "admin", "get_profile resolves to authoritative role='admin'");

    // ---------------------------------------------------------------------------
    // TEST 2: NON-ADMIN CLOUD PROFILE STRICTLY DENIED (EVEN IF CACHE CLAIMS ADMIN)
    // ---------------------------------------------------------------------------
    console.log("\n--- TEST 2: NON-ADMIN CLOUD PROFILE REMAINS DENIED ---");

    const nonAdminUserId = `usr_test_${Date.now()}_non_admin`;
    const nonAdminJwt = nonAdminUserId;

    // Seed cache with forged or stale role='admin'
    supabaseBackendEngine.db.profiles.push({
      id: nonAdminUserId,
      user_id: nonAdminUserId,
      email: "tampering-user@transmove.test",
      full_name: "Tampering User",
      role: "admin", // STALE OR TAMPERED LOCAL ENTRY
      account_status: "active"
    });

    // Authoritative cloud profile is role = 'customer'
    const authoritativeCustomerProfile = {
      id: nonAdminUserId,
      user_id: nonAdminUserId,
      email: "tampering-user@transmove.test",
      full_name: "Tampering User",
      role: "customer", // AUTHORITATIVE CLOUD ROLE
      account_status: "active"
    };

    supabaseBackendEngine.supabaseAdmin = {
      from(table) {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    if (table === "profiles" && col === "id" && val === nonAdminUserId) {
                      return { data: authoritativeCustomerProfile, error: null };
                    }
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    let nonAdminBlocked = false;
    let nonAdminErrorMsg = "";
    try {
      await supabaseBackendEngine.execute({
        action: "admin_get_platform_stats",
        jwt: nonAdminJwt
      });
    } catch (err) {
      nonAdminBlocked = true;
      nonAdminErrorMsg = err.message;
    }

    assert(nonAdminBlocked, `Non-admin cloud profile correctly blocked: "${nonAdminErrorMsg}"`);
    assert(
      nonAdminErrorMsg.includes("Active administrator privileges required"),
      "Error correctly requires active administrator privileges"
    );

    // Verify cache was corrected to customer
    const nonAdminCachedAfter = supabaseBackendEngine.db.profiles.find((p) => p.id === nonAdminUserId);
    assert(nonAdminCachedAfter?.role === "customer", "Tampered/stale cache was sanitized to role='customer'");

    // ---------------------------------------------------------------------------
    // TEST 3: SUSPENDED ADMIN IN CLOUD IS DENIED
    // ---------------------------------------------------------------------------
    console.log("\n--- TEST 3: SUSPENDED ADMIN IN CLOUD IS DENIED ---");

    const suspendedAdminUserId = `usr_test_${Date.now()}_suspended_admin`;
    const suspendedAdminJwt = suspendedAdminUserId;

    supabaseBackendEngine.supabaseAdmin = {
      from(table) {
        return {
          select() {
            return {
              eq(col, val) {
                return {
                  async maybeSingle() {
                    if (table === "profiles" && col === "id" && val === suspendedAdminUserId) {
                      return {
                        data: {
                          id: suspendedAdminUserId,
                          user_id: suspendedAdminUserId,
                          email: "suspended@transmove.test",
                          role: "admin",
                          account_status: "suspended" // SUSPENDED STATUS
                        },
                        error: null
                      };
                    }
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    let suspendedBlocked = false;
    try {
      await supabaseBackendEngine.execute({
        action: "admin_get_platform_stats",
        jwt: suspendedAdminJwt
      });
    } catch (err) {
      suspendedBlocked = true;
    }

    assert(suspendedBlocked, "Suspended admin in Supabase cloud is denied admin action");

    // ---------------------------------------------------------------------------
    // TEST 4: FALLBACK TO CACHE WHEN CLOUD GENUINELY FAILS (OFFLINE / NETWORK ERROR)
    // ---------------------------------------------------------------------------
    console.log("\n--- TEST 4: SAFE FALLBACK WHEN SUPABASE CLOUD QUERY FAILS ---");

    const offlineAdminId = `usr_test_${Date.now()}_offline_admin`;
    const offlineAdminJwt = offlineAdminId;

    // Seed local cache
    supabaseBackendEngine.db.profiles.push({
      id: offlineAdminId,
      user_id: offlineAdminId,
      email: "offline-admin@transmove.test",
      role: "admin",
      account_status: "active"
    });

    // Supabase query genuinely throws network failure
    supabaseBackendEngine.supabaseAdmin = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    throw new Error("ETIMEDOUT: Supabase cloud unreachable");
                  }
                };
              }
            };
          }
        };
      }
    };

    const offlineStats = await supabaseBackendEngine.execute({
      action: "admin_get_platform_stats",
      jwt: offlineAdminJwt
    });

    assert(Boolean(offlineStats), "Fallback to local cache succeeded when cloud query threw network exception");

  } finally {
    // Restore original state
    supabaseBackendEngine.db.profiles = originalProfiles;
    supabaseBackendEngine.supabaseAdmin = originalSupabaseAdmin;
    supabaseBackendEngine._persistLocalDb();
  }

  console.log("\n==================================================");
  console.log(`STALE CACHE REGRESSION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runStaleCacheRegressionTest().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
