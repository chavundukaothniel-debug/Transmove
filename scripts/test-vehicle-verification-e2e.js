// ==============================================================================
// TRANSMOVE — VEHICLE CREATION, VERIFICATION AND DRIVER PORTAL SYNC E2E TEST
// Tests:
// 1. Create temporary driver
// 2. Confirm profile exists
// 3. Login and get Supabase JWT
// 4. Create vehicle through actual vehicle endpoint (POST /api/trusted-api create_vehicle)
// 5. Query public.vehicles directly from Supabase
// 6. MUST find exactly the created row
// 7. Driver vehicle list MUST contain it (POST /api/trusted-api list_driver_vehicles)
// 8. Verify initial verification_status is 'pending'
// 9. Create/promote temporary admin safely using service-role test setup
// 10. Admin vehicle queue MUST contain vehicle (POST /api/trusted-api admin_list_verifications)
// 11. Approve vehicle through actual admin endpoint (POST /api/trusted-api admin_verify_vehicle)
// 12. Query public.vehicles directly from Supabase
// 13. MUST show verification_status='approved'
// 14. Driver vehicle list after approval MUST show approved
// 15. Reject non-admin approval attempt with 403
// 16. Cleanup all temporary rows/files
// Appwrite Check: Appwrite vehicle reads = 0, writes = 0, auth calls = 0
// ==============================================================================

import http from "http";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_PORT = 8091;
let serverInstance = null;

// Track Appwrite calls to verify zero Appwrite traffic
let appwriteReadCount = 0;
let appwriteWriteCount = 0;
let appwriteAuthCount = 0;

const originalFetch = globalThis.fetch;
globalThis.fetch = async function (url, options = {}) {
  const urlStr = String(url);
  if (urlStr.includes("appwrite.io") || urlStr.includes("/v1/account") || urlStr.includes("/databases/transmove")) {
    const method = (options.method || "GET").toUpperCase();
    if (urlStr.includes("/v1/account")) {
      appwriteAuthCount++;
    } else if (urlStr.includes("/collections/vehicles")) {
      if (method === "GET") appwriteReadCount++;
      else appwriteWriteCount++;
    }
  }
  return originalFetch.apply(this, arguments);
};

// Start local HTTP server mirroring server.js
function startTestServer() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(async (req, res) => {
      const urlPath = req.url.split("?")[0];

      if (urlPath === "/.netlify/functions/trusted-api" || urlPath === "/api/trusted-api") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          const event = {
            httpMethod: req.method,
            headers: req.headers,
            body: body
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

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    srv.listen(TEST_PORT, () => {
      serverInstance = srv;
      resolve(srv);
    });
    srv.on("error", reject);
  });
}

async function runVehicleE2ETest() {
  console.log("==================================================");
  console.log("TRANSMOVE VEHICLE VERIFICATION & DRIVER SYNC E2E TEST");
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

  await startTestServer();
  console.log(`Test HTTP server running on http://localhost:${TEST_PORT}`);

  const testSuffix = Date.now();
  const driverEmail = `driver_veh_${testSuffix}@transmove.test`;
  const driverPassword = "TestDriverPassword2026!";
  const adminEmail = `admin_veh_${testSuffix}@transmove.test`;
  const adminPassword = "TestAdminPassword2026!";

  let driverId = null;
  let driverJwt = null;
  let adminId = null;
  let adminJwt = null;
  let createdVehicleId = null;
  const testRegPlate = `ABC-${String(testSuffix).slice(-4)}-ZW`;

  try {
    // -------------------------------------------------------------------------
    // 1. CREATE TEMPORARY DRIVER
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1: CREATE TEMPORARY DRIVER ---");
    const { data: driverAuth, error: dAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: driverEmail,
      password: driverPassword,
      email_confirm: true,
      user_metadata: { full_name: "Farai Chitepo (Driver)", role: "driver" }
    });
    assert(!dAuthErr && driverAuth?.user?.id, `Created temporary driver auth user: ${driverEmail}`);
    driverId = driverAuth.user.id;

    // -------------------------------------------------------------------------
    // 2. CONFIRM PROFILE EXISTS
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 2: CONFIRM PROFILE EXISTS ---");
    await supabaseAdmin
      .from("profiles")
      .update({
        role: "driver",
        account_status: "active",
        verification_status: "unverified"
      })
      .eq("id", driverId);

    const { data: driverProf, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, verification_status")
      .eq("id", driverId)
      .single();

    assert(!pErr && driverProf?.id === driverId, `Driver profile exists in public.profiles: ${driverProf?.email} (role='${driverProf?.role}')`);

    // -------------------------------------------------------------------------
    // 3. LOGIN AND GET SUPABASE JWT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3: LOGIN AND GET SUPABASE JWT ---");
    const { data: dLogin, error: dLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: driverEmail,
      password: driverPassword
    });
    assert(!dLoginErr && dLogin?.session?.access_token, `Driver logged in successfully, obtained Supabase JWT`);
    driverJwt = dLogin.session.access_token;

    // -------------------------------------------------------------------------
    // 4. CREATE VEHICLE THROUGH ACTUAL VEHICLE ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 4: CREATE VEHICLE THROUGH ACTUAL VEHICLE ENDPOINT ---");
    const createPayload = {
      action: "create_vehicle",
      jwt: driverJwt,
      data: {
        vehicle_type: "sedan",
        make: "Toyota",
        model: "Corolla Quest",
        year: 2022,
        colour: "Silver Metallic",
        registration_number: testRegPlate,
        passenger_capacity: 4,
        load_capacity: 450,
        service_category: "passenger_transport",
        description: "Comfortable air-conditioned executive sedan",
        is_primary: true
      }
    };

    const createRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverJwt}`
      },
      body: JSON.stringify(createPayload)
    });

    console.log(`  Vehicle creation HTTP status: ${createRes.status} ${createRes.statusText}`);
    const createBody = await createRes.json();
    assert(createRes.status === 200, `Vehicle creation HTTP endpoint returned 200 OK`);
    assert(Boolean(createBody?.id), `Vehicle creation returned real UUID: ${createBody?.id}`);
    assert(createBody?.driver_id === driverId, `Vehicle driver_id correctly derived from JWT: ${createBody?.driver_id}`);
    assert(createBody?.registration_number === testRegPlate, `Vehicle registration matches: ${createBody?.registration_number}`);
    createdVehicleId = createBody?.id;

    // -------------------------------------------------------------------------
    // 5 & 6. QUERY PUBLIC.VEHICLES — MUST FIND EXACTLY THE CREATED ROW
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5 & 6: QUERY public.vehicles IN SUPABASE ---");
    const { data: cloudVehicle, error: vQueryErr } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("id", createdVehicleId)
      .maybeSingle();

    assert(!vQueryErr, `Queried public.vehicles in Supabase without error: ${vQueryErr ? vQueryErr.message : "OK"}`);
    assert(cloudVehicle && cloudVehicle.id === createdVehicleId, `MUST find exactly the created row in public.vehicles: ${cloudVehicle?.id}`);
    assert(cloudVehicle?.make === "Toyota" && cloudVehicle?.model === "Corolla Quest", `Supabase row make/model matches: Toyota Corolla Quest`);
    assert(cloudVehicle?.registration_number === testRegPlate, `Supabase row registration_number matches: ${cloudVehicle?.registration_number}`);

    // -------------------------------------------------------------------------
    // 7. DRIVER VEHICLE LIST MUST CONTAIN IT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 7: DRIVER VEHICLE LIST (list_driver_vehicles) ---");
    const listRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverJwt}`
      },
      body: JSON.stringify({ action: "list_driver_vehicles", jwt: driverJwt })
    });

    assert(listRes.status === 200, `Driver vehicle list HTTP returned 200 OK`);
    const listBody = await listRes.json();
    const foundInList = (listBody?.vehicles || []).find((v) => v.id === createdVehicleId);
    assert(Boolean(foundInList), `Driver vehicle list contains newly created vehicle: ${foundInList?.id}`);

    // -------------------------------------------------------------------------
    // 8. VERIFY INITIAL VERIFICATION STATUS IS PENDING
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 8: VERIFY INITIAL VERIFICATION_STATUS ---");
    assert(cloudVehicle?.verification_status === "pending", `Supabase public.vehicles verification_status is 'pending'`);
    assert(foundInList?.verification_status === "pending", `Driver portal vehicle list verification_status is 'pending'`);

    // -------------------------------------------------------------------------
    // 9. CREATE/PROMOTE TEMPORARY ADMIN SAFELY USING SERVICE-ROLE TEST SETUP
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 9: CREATE & PROMOTE TEMPORARY ADMIN ---");
    const { data: adminAuth, error: aAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "Operations Admin", role: "admin" }
    });
    assert(!aAuthErr && adminAuth?.user?.id, `Created temporary admin user: ${adminEmail}`);
    adminId = adminAuth.user.id;

    // Promote in public.profiles
    const { error: aProfErr } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "admin",
        account_status: "active",
        verification_status: "approved"
      })
      .eq("id", adminId);
    assert(!aProfErr, `Promoted admin profile via service-role: role='admin', account_status='active'`);

    // Login as admin
    const { data: aLogin, error: aLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    assert(!aLoginErr && aLogin?.session?.access_token, `Admin authenticated, obtained live Supabase JWT`);
    adminJwt = aLogin.session.access_token;

    // -------------------------------------------------------------------------
    // 10. ADMIN VEHICLE QUEUE MUST CONTAIN VEHICLE
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 10: ADMIN VEHICLE QUEUE (admin_list_verifications) ---");
    const queueRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`
      },
      body: JSON.stringify({ action: "admin_list_verifications", data: { status_filter: "all" }, jwt: adminJwt })
    });

    assert(queueRes.status === 200, `Admin verification queue endpoint returned 200 OK`);
    const queueBody = await queueRes.json();
    const driverEntry = (queueBody?.verifications || []).find((p) => p.id === driverId || p.user_id === driverId);
    assert(Boolean(driverEntry), `Admin queue contains driver profile entry`);
    const vehicleInQueue = (driverEntry?.vehicles || []).find((v) => v.id === createdVehicleId);
    assert(Boolean(vehicleInQueue), `Admin queue contains vehicle ${createdVehicleId} (status: '${vehicleInQueue?.verification_status}')`);

    // -------------------------------------------------------------------------
    // 11. APPROVE VEHICLE THROUGH ACTUAL ADMIN ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 11: APPROVE VEHICLE VIA ACTUAL ADMIN ENDPOINT ---");
    const approveRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        action: "admin_verify_vehicle",
        jwt: adminJwt,
        data: {
          vehicle_id: createdVehicleId,
          verification_status: "approved"
        }
      })
    });

    console.log(`  Admin approval HTTP status: ${approveRes.status} ${approveRes.statusText}`);
    const approveBody = await approveRes.json();
    assert(approveRes.status === 200, `Admin vehicle approval endpoint returned 200 OK`);
    assert(approveBody?.verification_status === "approved", `Approval endpoint response verification_status='approved'`);

    // -------------------------------------------------------------------------
    // 12 & 13. QUERY PUBLIC.VEHICLES — MUST SHOW VERIFICATION_STATUS='APPROVED'
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 12 & 13: QUERY public.vehicles AFTER APPROVAL ---");
    const { data: updatedCloudVehicle, error: uQueryErr } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .eq("id", createdVehicleId)
      .single();

    assert(!uQueryErr, `Queried public.vehicles in Supabase after approval without error`);
    assert(updatedCloudVehicle?.verification_status === "approved", `Authoritative Supabase row verification_status='${updatedCloudVehicle?.verification_status}' (APPROVED)`);

    // -------------------------------------------------------------------------
    // 14. DRIVER VEHICLE LIST AFTER APPROVAL MUST SHOW APPROVED
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 14: DRIVER VEHICLE LIST AFTER APPROVAL ---");
    const driverRefreshRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverJwt}`
      },
      body: JSON.stringify({ action: "list_driver_vehicles", jwt: driverJwt })
    });

    assert(driverRefreshRes.status === 200, `Driver vehicle list refresh returned 200 OK`);
    const driverRefreshBody = await driverRefreshRes.json();
    const refreshedVehicle = (driverRefreshBody?.vehicles || []).find((v) => v.id === createdVehicleId);
    assert(refreshedVehicle?.verification_status === "approved", `Driver vehicle list after admin approval displays verification_status='approved'`);

    // -------------------------------------------------------------------------
    // 15. REJECT NON-ADMIN APPROVAL ATTEMPT WITH 403
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 15: SECURITY CHECK: REJECT NON-ADMIN APPROVAL WITH 403 ---");
    const unauthAttemptRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverJwt}` // Driver trying to approve own vehicle!
      },
      body: JSON.stringify({
        action: "admin_verify_vehicle",
        jwt: driverJwt,
        data: {
          vehicle_id: createdVehicleId,
          verification_status: "approved"
        }
      })
    });

    assert(
      unauthAttemptRes.status === 403,
      `Non-admin approval attempt correctly rejected with HTTP 403 Forbidden (Actual: ${unauthAttemptRes.status})`
    );

    // -------------------------------------------------------------------------
    // STEP 16: APPWRITE CHECK
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 16: APPWRITE ZERO CALLS VERIFICATION ---");
    console.log(`  Appwrite vehicle reads: ${appwriteReadCount}`);
    console.log(`  Appwrite vehicle writes: ${appwriteWriteCount}`);
    console.log(`  Appwrite auth calls: ${appwriteAuthCount}`);
    assert(appwriteReadCount === 0, `Appwrite vehicle reads = 0`);
    assert(appwriteWriteCount === 0, `Appwrite vehicle writes = 0`);
    assert(appwriteAuthCount === 0, `Appwrite auth calls = 0`);

  } catch (err) {
    console.error("EXCEPTION IN TEST RUNNER:", err);
    failed++;
  } finally {
    console.log("\n--- CLEANUP: REMOVE TEMPORARY TEST DATA ---");
    if (createdVehicleId) {
      await supabaseAdmin.from("vehicles").delete().eq("id", createdVehicleId);
      console.log(`  ✓ Deleted temporary vehicle from public.vehicles`);
    }
    if (driverId) {
      await supabaseAdmin.from("profiles").delete().eq("id", driverId);
      await supabaseAdmin.auth.admin.deleteUser(driverId);
      console.log(`  ✓ Deleted temporary driver auth user and profile`);
    }
    if (adminId) {
      await supabaseAdmin.from("profiles").delete().eq("id", adminId);
      await supabaseAdmin.auth.admin.deleteUser(adminId);
      console.log(`  ✓ Deleted temporary admin auth user and profile`);
    }
    if (serverInstance) {
      serverInstance.close();
      console.log(`  ✓ Closed test HTTP server`);
    }
  }

  console.log("\n==================================================");
  console.log(`FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runVehicleE2ETest().catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
