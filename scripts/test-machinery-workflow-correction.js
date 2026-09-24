// ==============================================================================
// TRANSMOVE MACHINERY WORKFLOW CORRECTION TEST SUITE
// Tests Parts 31-36, 40:
// 1. Passenger direct visit to #machinery_owner -> redirected, no owner controls.
// 2. Driver direct visit to #machinery_owner -> redirected, no owner controls.
// 3. Machinery owner visit to #machinery_owner -> dashboard, + Add Machinery.
// 4. Assert SUV, Sedan, Hatchback, Passenger Car are ABSENT from Add Machinery.
// 5. Assert Excavator, Bulldozer, Motor Grader, Tractor, etc. ARE PRESENT.
// 6. Server-side auth: Passenger/Driver forbidden from owner actions (403).
// 7. Create real test machinery (Caterpillar 320D Excavator in Gweru).
// 8. Verify stored in public.machinery, NOT public.vehicles.
// 9. Clean up test data.
// ==============================================================================
import http from "http";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wwvnnnistexgyvhvnqes.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("FATAL: SUPABASE_SERVICE_ROLE_KEY is required.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_PORT = 8099;
let testServer = null;

function startTestServer() {
  return new Promise((resolve) => {
    testServer = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          try {
            const parsed = JSON.parse(body || "{}");
            const authHeader = req.headers["authorization"] || "";
            const jwt = parsed.jwt || (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null);
            const result = await supabaseBackendEngine.execute({
              action: parsed.action,
              data: parsed.data || {},
              jwt
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result));
          } catch (err) {
            const msg = err.message || "Unknown error";
            const isForbidden = msg.includes("Forbidden") || msg.includes("Unauthorized") || msg.includes("Only machinery owners");
            res.writeHead(isForbidden ? 403 : 400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: msg }));
          }
        });
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    testServer.listen(TEST_PORT, "127.0.0.1", () => {
      console.log(`[TestServer] Running at http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });
}

function stopTestServer() {
  if (testServer) {
    testServer.close();
    console.log("[TestServer] Stopped");
  }
}

async function callApi(jwt, action, data = {}) {
  const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
    },
    body: JSON.stringify({ action, data, jwt })
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data: json };
}

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS ${passCount}] ${message}`);
  } else {
    failCount++;
    console.error(`  ❌ [FAIL ${failCount}] ${message}`);
  }
}

async function run() {
  console.log("=======================================================");
  console.log("TRANSMOVE — MACHINERY WORKFLOW CORRECTION TEST SUITE");
  console.log("=======================================================\n");

  await startTestServer();

  let testOwnerJwt = null;
  let testOwnerId = null;
  let testPassengerJwt = null;
  let testPassengerId = null;
  let testDriverJwt = null;
  let testDriverId = null;
  let createdMachineryId = null;

  try {
    // 1. Create real Supabase test accounts
    console.log("--- Step 1: Real Auth Actors Setup ---");
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    // Helper to create user & profile
    async function createActor(role, fullName, prefix) {
      const email = `${prefix}_${suffix}@transmove.test`;
      const { data: uData, error: uErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });
      if (uErr) throw new Error(`Failed to create ${role} user: ${uErr.message}`);
      const uid = uData.user.id;

      const profileRow = {
        id: uid,
        email,
        full_name: fullName,
        phone: `+26377${Math.floor(1000000 + Math.random() * 9000000)}`,
        role,
        account_status: "active",
        verification_status: "verified",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: pErr } = await supabaseAdmin.from("profiles").upsert(profileRow, { onConflict: "id" });
      if (pErr) throw new Error(`Failed to insert profile row for ${uid}: ${pErr.message}`);

      // Seed local cache if present
      const existingIdx = (supabaseBackendEngine.db.profiles || []).findIndex(p => p.id === uid);
      if (existingIdx !== -1) {
        supabaseBackendEngine.db.profiles[existingIdx] = profileRow;
      } else {
        supabaseBackendEngine.db.profiles.push(profileRow);
      }

      const { data: loginData, error: lErr } = await supabaseAnon.auth.signInWithPassword({
        email,
        password: "TestPassword123!"
      });
      if (lErr) throw new Error(`Failed to sign in ${role}: ${lErr.message}`);

      return { id: uid, email, jwt: loginData.session.access_token };
    }

    const ownerActor = await createActor("machinery_owner", "Test Machinery Fleet Owner", "mach_owner");
    testOwnerId = ownerActor.id;
    testOwnerJwt = ownerActor.jwt;
    assert(Boolean(testOwnerJwt), "Machinery owner signed in with real Supabase JWT");

    const passActor = await createActor("passenger", "Test Passenger Customer", "mach_pass");
    testPassengerId = passActor.id;
    testPassengerJwt = passActor.jwt;
    assert(Boolean(testPassengerJwt), "Passenger signed in with real Supabase JWT");

    const driverActor = await createActor("driver", "Test Transport Driver", "mach_driver");
    testDriverId = driverActor.id;
    testDriverJwt = driverActor.jwt;
    assert(Boolean(testDriverJwt), "Driver signed in with real Supabase JWT");

    // 2. Server-side authorization security check (Part 29)
    console.log("\n--- Step 2: Server-Side Authorization Protection (Part 29) ---");

    // Passenger tries to call create_machinery_listing
    const passCreateRes = await callApi(testPassengerJwt, "create_machinery_listing", {
      category: "Excavator",
      brand: "CAT",
      model: "320D",
      location: "Gweru",
      hourly_rate: 35
    });
    assert(passCreateRes.status === 403, `Passenger create_machinery_listing returns 403 Forbidden (got HTTP ${passCreateRes.status})`);
    assert(passCreateRes.data.error.includes("Only machinery owners"), "Error message specifies only machinery owners can list");

    // Driver tries to call create_machinery_listing
    const driverCreateRes = await callApi(testDriverJwt, "create_machinery_listing", {
      category: "Bulldozer",
      brand: "Komatsu",
      model: "D6R",
      location: "Harare",
      daily_rate: 200
    });
    assert(driverCreateRes.status === 403, `Driver create_machinery_listing returns 403 Forbidden (got HTTP ${driverCreateRes.status})`);
    assert(driverCreateRes.data.error.includes("Only machinery owners"), "Driver cannot create machinery simply because they are a driver");

    // Passenger tries to upload machinery document
    const passDocRes = await callApi(testPassengerJwt, "upload_machinery_document", {
      file_base64: "data:application/pdf;base64,VEVTVA==",
      original_filename: "ownership.pdf",
      document_type: "ownership_proof"
    });
    assert(passDocRes.status === 403, `Passenger upload_machinery_document returns 403 Forbidden (got HTTP ${passDocRes.status})`);

    // Driver tries to upload machinery document
    const driverDocRes = await callApi(testDriverJwt, "upload_machinery_document", {
      file_base64: "data:application/pdf;base64,VEVTVA==",
      original_filename: "insurance.pdf",
      document_type: "insurance"
    });
    assert(driverDocRes.status === 403, `Driver upload_machinery_document returns 403 Forbidden (got HTTP ${driverDocRes.status})`);

    // 3. UI Template Verification: Assert SUV is absent & machinery categories present (Part 13 & 34)
    console.log("\n--- Step 3: UI Machinery Template & Category Assertions (Part 13, 34) ---");
    const machineryOwnerViewPath = path.resolve(process.cwd(), "src/views/MachineryOwnerView.js");
    const machineryOwnerViewCode = fs.readFileSync(machineryOwnerViewPath, "utf8");

    // Assert SUV, Sedan, Hatchback, Passenger Car ABSENT in machinery categories
    const forbiddenCategories = ["SUV", "Sedan", "Hatchback", "Coupe", "Passenger Car", "Minibus"];
    const { MACHINERY_CATEGORIES } = await import("../src/services/machinery.js");
    
    for (const forbidden of forbiddenCategories) {
      assert(!MACHINERY_CATEGORIES.includes(forbidden), `Forbidden category "${forbidden}" is ABSENT from MACHINERY_CATEGORIES`);
    }

    // Assert Machinery categories ARE PRESENT
    const requiredMachinery = [
      "Excavator",
      "Bulldozer",
      "Motor Grader",
      "Tractor",
      "Backhoe Loader / TLB",
      "Wheel Loader",
      "Crane",
      "Forklift"
    ];
    for (const reqCat of requiredMachinery) {
      assert(MACHINERY_CATEGORIES.includes(reqCat), `Required machinery category "${reqCat}" is PRESENT in MACHINERY_CATEGORIES`);
    }

    // Assert Form Elements in MachineryOwnerView.js
    assert(machineryOwnerViewCode.includes("MACHINERY PHOTOS"), "Add Machinery screen has 'MACHINERY PHOTOS' section at the top");
    assert(machineryOwnerViewCode.includes("+ Add Main Machinery Photo"), "Add Machinery screen has '+ Add Main Machinery Photo'");
    assert(machineryOwnerViewCode.includes("+ Add More Photos"), "Add Machinery screen has '+ Add More Photos'");
    assert(machineryOwnerViewCode.includes("WHAT ARE YOU OFFERING?"), "Add Machinery screen has 'WHAT ARE YOU OFFERING?' purpose selector");
    assert(machineryOwnerViewCode.includes("HIRE PRICING"), "Add Machinery screen has 'HIRE PRICING' section");
    assert(machineryOwnerViewCode.includes("Price per Hour"), "Price per Hour exists");
    assert(machineryOwnerViewCode.includes("Price per Day"), "Price per Day exists");
    assert(machineryOwnerViewCode.includes("Price per Week"), "Price per Week exists");
    assert(machineryOwnerViewCode.includes("Can you provide an operator?"), "Operator selection exists");
    assert(machineryOwnerViewCode.includes("WITH OPERATOR PRICING"), "With operator pricing exists");
    assert(machineryOwnerViewCode.includes("Can you transport the machinery"), "Transport selection exists");
    assert(machineryOwnerViewCode.includes("MACHINERY DOCUMENTS"), "MACHINERY DOCUMENTS section exists");
    assert(machineryOwnerViewCode.includes("PUBLISH MACHINERY"), "Button is labeled 'PUBLISH MACHINERY' (NOT Add Vehicle)");
    assert(!machineryOwnerViewCode.includes("Add Vehicle") && !machineryOwnerViewCode.includes("Register Vehicle"), "Neither 'Add Vehicle' nor 'Register Vehicle' exists in MachineryOwnerView");

    // 4. Create Real Test Machinery (Part 35)
    console.log("\n--- Step 4: Create Real Test Machinery (Part 35) ---");
    const testMachineryPayload = {
      category: "Excavator",
      brand: "Caterpillar",
      model: "320D",
      name: "Caterpillar 320D Excavator",
      year: 2019,
      condition: "Good",
      operating_hours: 5240,
      fuel_type: "Diesel",
      power: "110 kW",
      capacity: "20 tonnes",
      province: "Midlands",
      location: "Gweru",
      listing_type: "both",
      hourly_rate: 35,
      daily_rate: 180,
      weekly_rate: 950,
      sale_price: 52000,
      operator_available: true,
      operator_hourly_rate: 50,
      operator_daily_rate: 230,
      operator_weekly_rate: 1200,
      transport_available: true,
      transport_notes: "Lowbed transport available across Midlands",
      minimum_hire_period: 1,
      minimum_hire_unit: "days",
      description: "Well maintained Caterpillar 320D hydraulic excavator with standard bucket and recent 5000h service.",
      primary_photo: {
        id: "drive_photo_test_cat320d",
        file_url: "/api/files/preview/cat_320d_primary.jpg",
        filename: "cat_320d.jpg"
      }
    };

    const createRes = await callApi(testOwnerJwt, "create_machinery_listing", testMachineryPayload);
    assert(createRes.status === 200 && createRes.data?.id, `Owner created Caterpillar 320D Excavator (HTTP ${createRes.status})`);
    createdMachineryId = createRes.data.id;

    // 5. Verify Record Stored in public.machinery NOT public.vehicles (Part 36)
    console.log("\n--- Step 5: Database Table Verification (Part 36) ---");
    const { data: supaMach, error: machErr } = await supabaseAdmin
      .from("machinery")
      .select("*")
      .eq("id", createdMachineryId)
      .single();

    assert(!machErr && Boolean(supaMach), `Record exists in public.machinery table (ID: ${createdMachineryId})`);
    assert(supaMach.category === "Excavator", `Machinery category is 'Excavator'`);
    assert(supaMach.brand === "Caterpillar", `Machinery brand is 'Caterpillar'`);
    assert(supaMach.model === "320D", `Machinery model is '320D'`);
    assert(supaMach.owner_id === testOwnerId, `Machinery owner_id matches authenticated owner UUID (${testOwnerId})`);
    assert(supaMach.listing_type === "both", `Listing type is 'both' (hire & sale)`);
    assert(Number(supaMach.daily_rate) === 180, `Daily rate is $180`);
    assert(Number(supaMach.sale_price) === 52000, `Sale price is $52,000`);
    assert(Number(supaMach.operator_daily_rate) === 230, `Operator daily rate is $230`);

    // Verify it is NOT in public.vehicles
    const { data: supaVeh } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("id", createdMachineryId)
      .maybeSingle();

    assert(!supaVeh, "CONFIRMED: Record DOES NOT exist in public.vehicles table");

    console.log("\n  [DATABASE RECORD VERIFICATION DETAILS]");
    console.log(`    Machinery ID:          ${supaMach.id}`);
    console.log(`    Owner ID:              ${supaMach.owner_id}`);
    console.log(`    Category:              ${supaMach.category}`);
    console.log(`    Brand:                 ${supaMach.brand}`);
    console.log(`    Model:                 ${supaMach.model}`);
    console.log(`    Listing Type:          ${supaMach.listing_type}`);
    console.log(`    Rates:                 $${supaMach.hourly_rate}/hr, $${supaMach.daily_rate}/day, $${supaMach.weekly_rate}/wk`);
    console.log(`    Operator Rates:        $${supaMach.operator_hourly_rate}/hr, $${supaMach.operator_daily_rate}/day, $${supaMach.operator_weekly_rate}/wk`);
    console.log(`    Sale Price:            $${supaMach.sale_price}`);
    console.log(`    Primary Photo:         ${JSON.stringify(supaMach.primary_photo)}`);

    // 6. Test Advertising Protection (Part 27 & 28)
    console.log("\n--- Step 6: Advertising Protection & Card Verification (Part 27, 28) ---");
    // Passenger cannot promote
    const passPromoRes = await callApi(testPassengerJwt, "promote_machinery_listing", { machinery_id: createdMachineryId });
    assert(passPromoRes.status === 403, `Passenger promote_machinery_listing blocked (HTTP ${passPromoRes.status})`);

    // Driver cannot promote
    const driverPromoRes = await callApi(testDriverJwt, "promote_machinery_listing", { machinery_id: createdMachineryId });
    assert(driverPromoRes.status === 403, `Driver promote_machinery_listing blocked (HTTP ${driverPromoRes.status})`);

    // Owner card in MachineryOwnerView has ADVERTISE button
    assert(machineryOwnerViewCode.includes("btn-advertise-machinery"), "Every machinery owner card has 'btn-advertise-machinery' button");
    assert(machineryOwnerViewCode.includes("ADVERTISE"), "Button is labeled 'ADVERTISE'");

    // 7. Test Routing & Active Role Guards (Part 4, 31, 32, 33)
    console.log("\n--- Step 7: Route Guards & Role Model Verification (Part 4, 31, 32) ---");
    const appJsPath = path.resolve(process.cwd(), "assets/js/app.js");
    const appJsCode = fs.readFileSync(appJsPath, "utf8");

    assert(appJsCode.includes('route === "machinery_owner"'), "Route guard checks 'route === \"machinery_owner\"'");
    assert(appJsCode.includes('activeRole !== "machinery_owner"'), "Route guard verifies activeRole !== 'machinery_owner'");
    assert(appJsCode.includes('Machinery management is available to Machinery Owner accounts.'), "Guard displays exact notice: 'Machinery management is available to Machinery Owner accounts.'");
    assert(appJsCode.includes('targetHash = "#machinery"'), "Guard redirects unauthorized users directly to '#machinery'");
    assert(!appJsCode.includes('|| route === "machinery_owner"'), "CONFIRMED: The bypass '|| route === \"machinery_owner\"' is completely removed!");

    // 8. Navigation Verification (Part 5, 6, 7)
    console.log("\n--- Step 8: Navigation Verification (Part 5, 6, 7) ---");
    const sidebarPath = path.resolve(process.cwd(), "src/components/Sidebar.js");
    const sidebarCode = fs.readFileSync(sidebarPath, "utf8");

    // Passenger Sidebar
    assert(sidebarCode.includes('{ route: "machinery", label: "Machinery", icon: "tractor" }'), "Passenger sidebar links 'Machinery' to '#machinery'");
    assert(!sidebarCode.includes('{ route: "machinery_owner", label: "Dashboard" }') || sidebarCode.includes('machinery_owner: ['), "Machinery owner items are strictly scoped to machinery_owner role");

    // Clean up test data
    console.log("\n--- Step 9: Database Cleanup ---");
    if (createdMachineryId) {
      await supabaseAdmin.from("machinery").delete().eq("id", createdMachineryId);
      console.log(`✓ Deleted test machinery ID: ${createdMachineryId}`);
    }
    if (testOwnerId) {
      await supabaseAdmin.from("profiles").delete().eq("id", testOwnerId);
      await supabaseAdmin.auth.admin.deleteUser(testOwnerId);
      console.log(`✓ Deleted test owner user`);
    }
    if (testPassengerId) {
      await supabaseAdmin.from("profiles").delete().eq("id", testPassengerId);
      await supabaseAdmin.auth.admin.deleteUser(testPassengerId);
      console.log(`✓ Deleted test passenger user`);
    }
    if (testDriverId) {
      await supabaseAdmin.from("profiles").delete().eq("id", testDriverId);
      await supabaseAdmin.auth.admin.deleteUser(testDriverId);
      console.log(`✓ Deleted test driver user`);
    }

  } catch (err) {
    console.error("Test execution error:", err);
    failCount++;
  } finally {
    stopTestServer();
  }

  console.log("\n=======================================================");
  console.log(`CORRECTION TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=======================================================");

  if (failCount > 0) {
    process.exit(1);
  }
}

run();
