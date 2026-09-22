// ==============================================================================
// TRANSMOVE REGRESSION TEST: ADMIN TRUSTED API NETWORK PATH VIA SUPABASE AUTH
//
// Exercises the exact browser-to-server chain:
// 1. Supabase Auth login
// 2. Obtain Supabase access_token
// 3. HTTP POST to /.netlify/functions/trusted-api
// 4. Authorization: Bearer <Supabase access_token> (NO Appwrite JWT)
// 5. Server cryptographically verifies Supabase token
// 6. Server resolves public.profiles by verified UUID
// 7. Role 'admin' -> HTTP 200 Success with platform stats
// 8. Role 'customer' (non-admin) -> HTTP 403 Forbidden
// 9. No token -> HTTP 401 Unauthorized
// 10. AdminService.verifyAdminAccess() and getPlatformStats() execute cleanly
// ==============================================================================

import http from "http";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

async function runAdminNetworkPathTest() {
  console.log("==================================================");
  console.log("TRANSMOVE ADMIN API NETWORK PATH TEST SUITE");
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

  const PORT = 8089;
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0];
    if (urlPath === "/.netlify/functions/trusted-api" || urlPath === "/api/trusted-api") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        const event = {
          httpMethod: req.method,
          headers: req.headers,
          body
        };
        try {
          const result = await handler(event, {});
          res.writeHead(result.statusCode, result.headers);
          res.end(result.body);
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[TestServer] Mock server listening on port ${PORT}`);

  const testSuffix = Date.now();
  const adminEmail = `test_admin_${testSuffix}@transmove.test`;
  const customerEmail = `test_customer_${testSuffix}@transmove.test`;
  const testPassword = "Password123!Secure";

  const adminClient = supabaseBackendEngine.supabaseAdmin;
  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

  let adminAuthUser = null;
  let customerAuthUser = null;

  try {
    // -------------------------------------------------------------------------
    // 1. SETUP TEST USERS IN SUPABASE AUTH & PROFILES
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1: PROVISION SUPABASE AUTH USERS ---");

    const { data: adminCreated, error: adminCreateErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: testPassword,
      email_confirm: true
    });
    if (adminCreateErr) throw adminCreateErr;
    adminAuthUser = adminCreated.user;

    const { data: customerCreated, error: customerCreateErr } = await adminClient.auth.admin.createUser({
      email: customerEmail,
      password: testPassword,
      email_confirm: true
    });
    if (customerCreateErr) throw customerCreateErr;
    customerAuthUser = customerCreated.user;

    assert(Boolean(adminAuthUser?.id), `Created Supabase admin user: ${adminEmail} (${adminAuthUser.id})`);
    assert(Boolean(customerAuthUser?.id), `Created Supabase customer user: ${customerEmail} (${customerAuthUser.id})`);

    // Seed profiles in server db
    supabaseBackendEngine.db.profiles.push({
      id: adminAuthUser.id,
      user_id: adminAuthUser.id,
      email: adminEmail,
      full_name: "TransMove Admin Test",
      role: "admin",
      account_status: "active",
      verification_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    supabaseBackendEngine.db.profiles.push({
      id: customerAuthUser.id,
      user_id: customerAuthUser.id,
      email: customerEmail,
      full_name: "TransMove Customer Test",
      role: "customer",
      account_status: "active",
      verification_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // -------------------------------------------------------------------------
    // 2. SUPABASE LOGIN & TOKEN RETRIEVAL
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 2: SUPABASE AUTH LOGIN ---");

    const { data: adminLogin, error: adminLoginErr } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: testPassword
    });
    if (adminLoginErr) throw adminLoginErr;
    const adminToken = adminLogin.session.access_token;
    assert(Boolean(adminToken && adminToken.length > 50), "Admin signed in with Supabase Auth and received access_token");

    const { data: customerLogin, error: customerLoginErr } = await anonClient.auth.signInWithPassword({
      email: customerEmail,
      password: testPassword
    });
    if (customerLoginErr) throw customerLoginErr;
    const customerToken = customerLogin.session.access_token;
    assert(Boolean(customerToken && customerToken.length > 50), "Customer signed in with Supabase Auth and received access_token");

    // -------------------------------------------------------------------------
    // 3. TEST A: ADMIN HTTP CALL TO /api/trusted-api (WITH SUPABASE BEARER TOKEN)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST A: ADMIN HTTP POST TO /api/trusted-api WITH SUPABASE BEARER TOKEN ---");

    const adminResponse = await fetch(`http://localhost:${PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        action: "admin_get_platform_stats",
        data: {}
      })
    });

    const adminResult = await adminResponse.json();
    console.log("  [HTTP STATUS]:", adminResponse.status);
    console.log("  [HTTP RESPONSE]:", JSON.stringify(adminResult));
    assert(adminResponse.status === 200, `Admin request returned HTTP 200 OK (Status: ${adminResponse.status})`);
    assert(adminResult && adminResult.totalUsers !== undefined, "Admin received platform stats payload successfully");
    assert(!adminResponse.headers.get("x-appwrite-jwt"), "Response confirmed no Appwrite dependency");

    // -------------------------------------------------------------------------
    // 4. TEST B: NON-ADMIN HTTP CALL TO /api/trusted-api (MUST BE DENIED 403)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST B: NON-ADMIN HTTP POST TO /api/trusted-api (STRICTLY DENIED) ---");

    const customerResponse = await fetch(`http://localhost:${PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`
      },
      body: JSON.stringify({
        action: "admin_get_platform_stats",
        data: {}
      })
    });

    const customerResult = await customerResponse.json();
    console.log("  [HTTP STATUS]:", customerResponse.status);
    console.log("  [HTTP RESPONSE]:", JSON.stringify(customerResult));
    assert(customerResponse.status === 403, `Non-admin request correctly returned HTTP 403 Forbidden (Status: ${customerResponse.status})`);
    assert(
      customerResult.error && customerResult.error.includes("Active administrator privileges required"),
      `Error message correctly specified administrator privileges required: "${customerResult.error}"`
    );

    // -------------------------------------------------------------------------
    // 5. TEST C: MISSING/UNAUTHENTICATED TOKEN (MUST BE 401 UNAUTHORIZED)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST C: UNAUTHENTICATED REQUEST TO /api/trusted-api (STRICTLY DENIED) ---");

    const unauthResponse = await fetch(`http://localhost:${PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "admin_get_platform_stats",
        data: {}
      })
    });

    const unauthResult = await unauthResponse.json();
    console.log("  [HTTP STATUS]:", unauthResponse.status);
    console.log("  [HTTP RESPONSE]:", JSON.stringify(unauthResult));
    assert(unauthResponse.status === 401, `Unauthenticated request returned HTTP 401 Unauthorized (Status: ${unauthResponse.status})`);

    // -------------------------------------------------------------------------
    // 6. CLIENT-SIDE AdminService SIMULATION USING getAuthJwt()
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 6: VERIFY AdminService CLIENT IMPLEMENTATION ---");

    let currentSessionUser = adminAuthUser;
    let currentSessionToken = adminToken;
    let currentSessionRole = "admin";

    // Configure global window environment mock to simulate browser calling updated AdminService
    globalThis.window = {
      location: { origin: `http://localhost:${PORT}` },
      supabase: {
        createClient: () => ({
          auth: {
            getUser: async () => ({ data: { user: { id: currentSessionUser.id, email: currentSessionUser.email } }, error: null }),
            getSession: async () => ({ data: { session: { access_token: currentSessionToken } }, error: null })
          },
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: currentSessionUser.id,
                    user_id: currentSessionUser.id,
                    role: currentSessionRole,
                    account_status: "active"
                  },
                  error: null
                })
              })
            })
          })
        })
      }
    };

    // Dynamically import updated AdminService
    const { AdminService } = await import(`../src/services/admin.js?t=${Date.now()}`);

    const verifiedAdmin = await AdminService.verifyAdminAccess();
    assert(verifiedAdmin === true, "AdminService.verifyAdminAccess() returned true for Supabase admin session");

    const stats = await AdminService.getPlatformStats();
    assert(Boolean(stats && stats.totalUsers !== undefined), "AdminService.getPlatformStats() returned real stats using Supabase token");

    // Now switch active session to non-admin (customer)
    currentSessionUser = customerAuthUser;
    currentSessionToken = customerToken;
    currentSessionRole = "customer";

    const verifiedCustomer = await AdminService.verifyAdminAccess();
    assert(verifiedCustomer === false, "AdminService.verifyAdminAccess() returned false for non-admin session");

  } finally {
    // Teardown
    server.close();

    // Clean up Supabase Auth users
    if (adminAuthUser?.id) {
      await adminClient.auth.admin.deleteUser(adminAuthUser.id).catch(() => {});
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter((p) => p.id !== adminAuthUser.id);
    }
    if (customerAuthUser?.id) {
      await adminClient.auth.admin.deleteUser(customerAuthUser.id).catch(() => {});
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter((p) => p.id !== customerAuthUser.id);
    }
    supabaseBackendEngine._persistLocalDb();

    // Reset window global
    delete globalThis.window;
  }

  console.log("\n==================================================");
  console.log(`ADMIN NETWORK PATH TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminNetworkPathTest().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
