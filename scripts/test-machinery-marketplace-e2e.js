// ==============================================================================
// TRANSMOVE — MACHINERY MARKETPLACE, HIRING & SPONSORED ADVERTISING E2E TEST
// Exercises the real HTTP trusted-api handler, Supabase, Google Drive,
// Machinery Listings, Authoritative Pricing, Hire Lifecycle, and Sponsored Ads.
// Strict zero-Appwrite verification and 100% Real Supabase UUID Auth Users.
// ==============================================================================

import http from "http";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const isUuid = (val) =>
  typeof val === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

const TEST_PORT = 8098;
const originalFetch = globalThis.fetch;
let appwriteReads = 0;
let appwriteWrites = 0;
let appwriteAuth = 0;

// Intercept all network calls to ensure zero Appwrite usage
globalThis.fetch = async (...args) => {
  const requestUrl = String(args[0]?.url || args[0] || "");
  if (/appwrite/i.test(requestUrl)) {
    const method = String(args[1]?.method || args[0]?.method || "GET").toUpperCase();
    if (/\/account(?:\/|\?|$)|\/jwts(?:\/|\?|$)/i.test(requestUrl)) appwriteAuth++;
    else if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) appwriteWrites++;
    else appwriteReads++;
  }
  return originalFetch(...args);
};

function startTestServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const urlPath = req.url.split("?")[0];
      if (urlPath !== "/api/trusted-api" && urlPath !== "/.netlify/functions/trusted-api") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const result = await handler({ httpMethod: req.method, headers: req.headers, body }, {});
          res.writeHead(result.statusCode, result.headers);
          res.end(result.body);
        } catch (error) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    });
    server.on("error", reject);
    server.listen(TEST_PORT, "127.0.0.1", () => resolve(server));
  });
}

async function callApi(jwt, action, data = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, data });
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload)
    };
    if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

    const req = http.request(
      `http://127.0.0.1:${TEST_PORT}/api/trusted-api`,
      { method: "POST", headers },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => { raw += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode, data: parsed });
          } catch (_) {
            resolve({ status: res.statusCode, raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// User state
let testOwnerId = null;
let testOwnerJwt = null;
let testPassengerId = null;
let testPassengerJwt = null;
let testDriverId = null;
let testDriverJwt = null;
let testUnrelatedId = null;
let testUnrelatedJwt = null;

// Entity state
let createdMachineryId = null;
let secondaryMachineryId = null;
let passengerHireId = null;
let driverHireId = null;
let testAdId = null;
let testEnquiryId = null;
let testSubId = null;

let server = null;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS ${passedAssertions}] ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function createRealTestUser(role, fullName, prefix) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const email = `${prefix}_${stamp}@transmove.test`;
  const password = `TestPass_${stamp}!123`;

  // 1. Create real Supabase Auth user
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role }
  });
  if (authErr || !authUser?.user?.id) {
    throw new Error(`Failed to create real Supabase auth user for ${role}: ${authErr?.message}`);
  }
  const userId = authUser.user.id;

  // 2. Insert real matching row in public.profiles
  const profileRow = {
    id: userId,
    email,
    full_name: fullName,
    phone: `+26377${Math.floor(1000000 + Math.random() * 9000000)}`,
    role,
    account_status: "active",
    verification_status: "verified",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error: profErr } = await supabaseAdmin.from("profiles").upsert(profileRow, { onConflict: "id" });
  if (profErr) {
    throw new Error(`Failed to insert profile row for ${userId}: ${profErr.message}`);
  }

  // Also seed memory cache for consistency
  const existingIdx = (supabaseBackendEngine.db.profiles || []).findIndex(p => p.id === userId);
  if (existingIdx >= 0) supabaseBackendEngine.db.profiles[existingIdx] = profileRow;
  else (supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles || []).push(profileRow);

  // 3. Obtain real cryptographic Supabase access token (JWT)
  const { data: sessionData, error: signErr } = await supabaseAnon.auth.signInWithPassword({
    email,
    password
  });
  if (signErr || !sessionData?.session?.access_token) {
    throw new Error(`Failed to sign in real Supabase user ${email}: ${signErr?.message}`);
  }

  return {
    id: userId,
    jwt: sessionData.session.access_token,
    email
  };
}

async function run() {
  console.log("\n=======================================================");
  console.log("TRANSMOVE — MACHINERY MARKETPLACE E2E TEST SUITE");
  console.log("100% Real Supabase UUIDs & Authoritative Persistence");
  console.log("=======================================================\n");

  server = await startTestServer();
  console.log(`[TestServer] Running at http://127.0.0.1:${TEST_PORT}`);

  try {
    // -------------------------------------------------------------------------
    // PHASE 1: REAL SUPABASE AUTH USERS & PROFILES SETUP
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 1: Real Supabase Auth User & Profile Setup ---");

    const ownerUser = await createRealTestUser("machinery_owner", "Chavunduka Heavy Plant", "mach_owner");
    testOwnerId = ownerUser.id;
    testOwnerJwt = ownerUser.jwt;

    const passUser = await createRealTestUser("customer", "Tinashe Passenger", "passenger");
    testPassengerId = passUser.id;
    testPassengerJwt = passUser.jwt;

    const driverUser = await createRealTestUser("driver", "Farai Transport Driver", "driver");
    testDriverId = driverUser.id;
    testDriverJwt = driverUser.jwt;

    const unrelatedUser = await createRealTestUser("customer", "Tatenda Unrelated User", "unrelated");
    testUnrelatedId = unrelatedUser.id;
    testUnrelatedJwt = unrelatedUser.jwt;

    // Requirement 6: PROVE UUID CONFORMANCE FIRST
    assert(isUuid(testOwnerId), `1a. Machinery owner auth ID is valid UUID (${testOwnerId})`);
    assert(isUuid(testPassengerId), `1b. Passenger auth ID is valid UUID (${testPassengerId})`);
    assert(isUuid(testDriverId), `1c. Driver auth ID is valid UUID (${testDriverId})`);

    // Verify profile ID matches auth UUID directly in Supabase
    const { data: checkProf, error: checkErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, verification_status")
      .eq("id", testOwnerId)
      .single();

    assert(!checkErr && checkProf?.id === testOwnerId && checkProf?.role === "machinery_owner", "1d. Supabase public.profiles row matches owner UUID with verified role");
    if (!checkProf) {
      throw new Error("ABORTING TEST EARLY: Owner profile does not exist in Supabase.");
    }

    // -------------------------------------------------------------------------
    // PHASE 2: PRICING & OPERATOR VALIDATION ON CREATION
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 2: Listing Creation & Pricing Rule Validation ---");

    // Negative test: invalid base rate <= 0
    const invBaseRes = await callApi(testOwnerJwt, "create_machinery_listing", {
      name: "CAT 320 Excavator",
      category: "Excavators",
      brand: "Caterpillar",
      model: "320D",
      location: "Gweru",
      base_hire_rate: 0
    });
    assert(invBaseRes.status !== 200 || invBaseRes.data?.error, "2. Base rate <= 0 rejected");

    // Negative test: operator available but operator_inclusive_rate <= base_hire_rate
    const invOpRes = await callApi(testOwnerJwt, "create_machinery_listing", {
      name: "CAT 320 Excavator",
      category: "Excavators",
      brand: "Caterpillar",
      model: "320D",
      location: "Gweru",
      base_hire_rate: 180,
      operator_available: true,
      operator_inclusive_rate: 150 // <= base rate
    });
    assert(invOpRes.status !== 200 || invOpRes.data?.error, "3. Operator rate <= base rate rejected by server");

    // Positive test: valid listing with operator-inclusive rate > base rate & listing_type = both
    const createRes = await callApi(testOwnerJwt, "create_machinery_listing", {
      name: "CAT 320 Excavator",
      category: "Excavators",
      brand: "Caterpillar",
      model: "320D",
      year: 2020,
      condition: "excellent",
      location: "Gweru",
      province: "Midlands",
      listing_type: "both",
      hourly_rate: 45.0,
      daily_rate: 180.0,
      weekly_rate: 1100.0,
      monthly_rate: 4200.0,
      base_hire_rate: 180.0,
      rate_period: "daily",
      sale_price: 52000.0,
      operator_available: true,
      operator_hourly_rate: 60.0,
      operator_daily_rate: 230.0,
      operator_weekly_rate: 1450.0,
      operator_monthly_rate: 5400.0,
      operator_inclusive_rate: 230.0,
      transport_available: true,
      transport_notes: "Lowbed delivery available upon request",
      minimum_hire_period: 1,
      minimum_hire_unit: "days",
      photos: ["/assets/images/logo.png"]
    });

    // Requirement 7: FAIL FAST ON LISTING CREATION
    if (createRes.status !== 200 || !createRes.data?.id) {
      console.error("Listing creation failed:", createRes.data || createRes.raw);
      throw new Error("ABORTING TEST EARLY: Failed to create primary machinery listing.");
    }

    createdMachineryId = createRes.data.id;
    assert(isUuid(createdMachineryId), `4. Created machinery listing successfully with UUID: ${createdMachineryId}`);
    assert(Number(createRes.data.base_hire_rate) === 180, "5. Base hire rate is valid positive amount ($180)");
    assert(createRes.data.operator_available === true, "6. Operator available is true");
    assert(Number(createRes.data.operator_inclusive_rate) > Number(createRes.data.base_hire_rate), "7. Operator-inclusive rate ($230) > base rate ($180)");
    assert(createRes.data.listing_type === "both", "8. Listing type is 'both' (hire & sale)");
    assert(Number(createRes.data.sale_price) === 52000, "9. Outright sale price is valid positive amount ($52,000)");

    // Requirement 8: VERIFY ACTUAL SUPABASE ROW
    const { data: supaRow, error: supaErr } = await supabaseAdmin
      .from("machinery")
      .select("*")
      .eq("id", createdMachineryId)
      .single();

    assert(!supaErr && supaRow, "10. Verified machinery row exists directly in Supabase table");
    assert(supaRow?.owner_id === testOwnerId, `11. Supabase machinery.owner_id matches owner UUID (${testOwnerId})`);
    assert(supaRow?.brand === "Caterpillar" && supaRow?.model === "320D", "12. Supabase row brand and model match created values");
    assert(Number(supaRow?.daily_rate) === 180 && Number(supaRow?.sale_price) === 52000, "13. Supabase row multi-rates and sale price are accurately stored");

    // Create a secondary normal machine for sort-order tests
    const secondRes = await callApi(testOwnerJwt, "create_machinery_listing", {
      name: "JCB 3CX Backhoe Loader",
      category: "TLB / Backhoe Loaders",
      brand: "JCB",
      model: "3CX",
      location: "Harare",
      province: "Harare",
      listing_type: "hire",
      base_hire_rate: 140.0,
      daily_rate: 140.0,
      rate_period: "daily",
      operator_available: false
    });
    assert(secondRes.status === 200 && secondRes.data?.id, "14. Created secondary machinery listing for sort-order tests");
    secondaryMachineryId = secondRes.data?.id;

    // -------------------------------------------------------------------------
    // PHASE 3: MARKETPLACE BROWSING & NON-SPONSORED DASHBOARD BEHAVIOR
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 3: Marketplace Browsing & Dashboard Visibility Rules ---");

    const passBrowseRes = await callApi(testPassengerJwt, "list_machinery_marketplace", {});
    assert(passBrowseRes.status === 200 && Array.isArray(passBrowseRes.data?.machinery), "15. Passenger loads machinery marketplace");

    const driverBrowseRes = await callApi(testDriverJwt, "list_machinery_marketplace", {});
    assert(driverBrowseRes.status === 200 && Array.isArray(driverBrowseRes.data?.machinery), "16. Driver loads machinery marketplace");

    const foundForPass = passBrowseRes.data?.machinery?.some((m) => m.id === createdMachineryId);
    const foundForDriver = driverBrowseRes.data?.machinery?.some((m) => m.id === createdMachineryId);
    assert(foundForPass && foundForDriver, "17. Both passenger and driver see normal machinery listing in marketplace");

    // Normal non-advertised listing must NOT appear on dashboard sponsored section
    const passDashAds1 = await callApi(testPassengerJwt, "get_active_sponsored_machinery", {});
    const appearsInDashAds1 = (passDashAds1.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId);
    assert(!appearsInDashAds1, "18. Normal non-advertised listing does NOT appear in dashboard sponsored section");

    // -------------------------------------------------------------------------
    // PHASE 4: HIRE REQUESTS & AUTHORITATIVE SERVER PRICING
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 4: Hire Lifecycle & Authoritative Server Pricing ---");

    // Requirement 9: Passenger hires WITHOUT operator for 2 days
    const passHireRes = await callApi(testPassengerJwt, "submit_machinery_hire_request", {
      machinery_id: createdMachineryId,
      with_operator: false,
      rate_period: "daily",
      duration_units: 2,
      job_location: "Kwekwe Mine Site",
      notes: "Trenching for pipeline",
      contact_name: "Tinashe Passenger",
      contact_phone: "+263771234567"
    });

    assert(passHireRes.status === 200 && passHireRes.data?.id, "19. Passenger submits machinery-only hire");
    passengerHireId = passHireRes.data?.id;
    // Expected total: 2 days * $180 = $360
    assert(Number(passHireRes.data?.rate_applied) === 180 && Number(passHireRes.data?.calculated_total) === 360, "20. Authoritative price uses base rate ($180/day * 2 = $360)");

    // Verify real Supabase row in public.machinery_hires
    const { data: supaPassHire } = await supabaseAdmin.from("machinery_hires").select("*").eq("id", passengerHireId).single();
    assert(supaPassHire?.renter_id === testPassengerId && supaPassHire?.owner_id === testOwnerId, "21. Real Supabase hire row has matching renter_id and owner_id UUIDs");

    // Driver hires WITH operator for 3 days
    const driverHireRes = await callApi(testDriverJwt, "submit_machinery_hire_request", {
      machinery_id: createdMachineryId,
      with_operator: true,
      rate_period: "daily",
      duration_units: 3,
      job_location: "Midlands Roadworks",
      notes: "Road scraping",
      contact_name: "Farai Transport Driver",
      contact_phone: "+263777888999"
    });

    assert(driverHireRes.status === 200 && driverHireRes.data?.id, "22. Driver submits machinery + operator hire");
    driverHireId = driverHireRes.data?.id;
    // Expected total: 3 days * $230 = $690
    assert(Number(driverHireRes.data?.rate_applied) === 230 && Number(driverHireRes.data?.calculated_total) === 690, "23. Authoritative price uses higher operator rate ($230/day * 3 = $690)");
    assert(driverHireRes.data?.with_operator === true, "24. Hire record with_operator is true");

    // -------------------------------------------------------------------------
    // PHASE 5: OWNER RECEIVES AND ACCEPTS/DECLINES HIRES
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 5: Owner Receives, Accepts & Declines Hires ---");

    const ownerHiresRes = await callApi(testOwnerJwt, "list_owner_machinery_hires", {});
    const receivedPassHire = (ownerHiresRes.data?.hires || []).some((h) => h.id === passengerHireId);
    const receivedDriverHire = (ownerHiresRes.data?.hires || []).some((h) => h.id === driverHireId);
    assert(receivedPassHire && receivedDriverHire, "25. Owner receives both hire requests");

    // Owner accepts passenger hire
    const acceptRes = await callApi(testOwnerJwt, "update_machinery_hire_status", {
      hire_id: passengerHireId,
      status: "accepted"
    });
    assert(acceptRes.status === 200 && acceptRes.data?.status === "accepted", "26. Owner can accept hire request");

    // Owner declines driver hire
    const declineRes = await callApi(testOwnerJwt, "update_machinery_hire_status", {
      hire_id: driverHireId,
      status: "declined",
      decline_reason: "Equipment committed to another contract"
    });
    assert(declineRes.status === 200 && declineRes.data?.status === "declined", "27. Owner can decline hire request");

    // Unrelated user cannot accept/decline hire (Requirement 10)
    const rogueHireAction = await callApi(testUnrelatedJwt, "update_machinery_hire_status", {
      hire_id: passengerHireId,
      status: "declined"
    });
    assert(rogueHireAction.status !== 200 || rogueHireAction.data?.error, "28. Unrelated user gets 403 trying to accept/decline owner's hire");

    // -------------------------------------------------------------------------
    // PHASE 6: SECURITY ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 6: Security Enforcement ---");

    const rogueEditRes = await callApi(testPassengerJwt, "update_machinery_listing", {
      machinery_id: createdMachineryId,
      name: "Hacked Machinery Name"
    });
    assert(rogueEditRes.status !== 200 || rogueEditRes.data?.error, "29. Another user cannot edit owner's machinery");

    // -------------------------------------------------------------------------
    // PHASE 7: ADVERTISING & SUBSCRIPTION ENTITLEMENT (Requirement 4 & 11)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 7: Advertising & Subscription Entitlement ---");

    // 4A: Attempt promotion without active machinery-fleet plan -> must be rejected
    const unentitledAdRes = await callApi(testOwnerJwt, "promote_machinery_listing", {
      machinery_id: createdMachineryId,
      duration_days: 14
    });
    assert(unentitledAdRes.status !== 200 || unentitledAdRes.data?.error?.includes("upgrade") || unentitledAdRes.data?.error?.includes("plan"), "30. Advertising rejected when owner lacks active machinery-fleet plan");

    // 4B: Activate real machinery-fleet subscription in public.subscriptions
    const subRecord = {
      user_id: testOwnerId,
      plan_id: "30000000-0000-4000-8000-000000000002",
      plan: "Machinery Fleet Pro",
      amount: 60,
      currency: "USD",
      status: "active",
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    const { data: insertedSub, error: subInsErr } = await supabaseAdmin.from("subscriptions").insert(subRecord).select().single();
    if (!subInsErr && insertedSub) {
      testSubId = insertedSub.id;
    }
    // Also update in-memory cache for instant propagation
    (supabaseBackendEngine.db.subscriptions = supabaseBackendEngine.db.subscriptions || []).push({
      ...subRecord,
      id: testSubId || `sub_${Date.now()}`,
      plan_slug: "machinery-fleet"
    });

    assert(Boolean(testSubId || insertedSub), "31. Activated machinery-fleet plan in Supabase subscriptions");

    // Retry promotion with active subscription -> success
    const adRes = await callApi(testOwnerJwt, "promote_machinery_listing", {
      machinery_id: createdMachineryId,
      duration_days: 30
    });
    assert(adRes.status === 200 && adRes.data?.advertisement?.status === "active", "32. Owner activates advertising successfully with active plan");
    testAdId = adRes.data?.advertisement?.id;

    // Verify real Supabase row in public.machinery_advertisements
    const { data: supaAd } = await supabaseAdmin.from("machinery_advertisements").select("*").eq("id", testAdId).single();
    assert(supaAd?.owner_id === testOwnerId && supaAd?.machinery_id === createdMachineryId, "33. Real Supabase advertisement row has matching owner_id and machinery_id UUIDs");

    // Passenger dashboard receives promoted machinery (Requirement 12)
    const passDashAds2 = await callApi(testPassengerJwt, "get_active_sponsored_machinery", {});
    const passHasAd = (passDashAds2.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId && m.is_sponsored);
    assert(passHasAd, "34. Passenger dashboard receives promoted machinery");

    // Driver dashboard receives promoted machinery
    const driverDashAds2 = await callApi(testDriverJwt, "get_active_sponsored_machinery", {});
    const driverHasAd = (driverDashAds2.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId && m.is_sponsored);
    assert(driverHasAd, "35. Driver dashboard receives promoted machinery");

    // Verify is_sponsored flag
    const promotedItem = passDashAds2.data?.sponsored_machinery?.find((m) => m.id === createdMachineryId);
    assert(promotedItem?.is_sponsored === true, "36. Sponsored machinery item has is_sponsored = true");

    // User can View details
    const viewRes = await callApi(testPassengerJwt, "get_machinery_details", { machinery_id: createdMachineryId });
    assert(viewRes.status === 200 && viewRes.data?.name === "CAT 320 Excavator" && viewRes.data?.is_sponsored === true, "37. User can View promoted machinery details");

    // User can Hire from promoted ad
    const adHireRes = await callApi(testPassengerJwt, "submit_machinery_hire_request", {
      machinery_id: createdMachineryId,
      with_operator: false,
      duration_units: 1
    });
    assert(adHireRes.status === 200 && adHireRes.data?.calculated_total === 180, "38. User can Hire promoted machinery from sponsored card");

    // -------------------------------------------------------------------------
    // PHASE 8: AD DISMISSAL & USER SCOPING (Requirement 13)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 8: Ad Dismissal & User Scoping ---");

    // Passenger dismisses the ad
    const dismissRes = await callApi(testPassengerJwt, "dismiss_sponsored_machinery_ad", { advertisement_id: testAdId });
    assert(dismissRes.status === 200 && dismissRes.data?.dismissed === true, "39. Passenger can Dismiss sponsored ad");

    // Verify Supabase machinery_ad_dismissals table
    const { data: supaDism } = await supabaseAdmin.from("machinery_ad_dismissals").select("*").eq("advertisement_id", testAdId).eq("user_id", testPassengerId).single();
    assert(supaDism?.user_id === testPassengerId, "40. Real Supabase ad dismissal record created with passenger UUID");

    // Dismissed ad does NOT immediately reappear for that passenger
    const passDashAds3 = await callApi(testPassengerJwt, "get_active_sponsored_machinery", {});
    const passSeesDismissed = (passDashAds3.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId);
    assert(!passSeesDismissed, "41. Dismissed ad does not reappear for dismissing passenger");

    // Driver (who did NOT dismiss) should still see the sponsored ad
    const driverDashAds3 = await callApi(testDriverJwt, "get_active_sponsored_machinery", {});
    const driverStillSees = (driverDashAds3.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId);
    assert(driverStillSees, "42. Driver still sees sponsored ad (dismissal is strictly user-scoped)");

    // -------------------------------------------------------------------------
    // PHASE 9: PROMOTED MARKETPLACE SORT ORDER (Requirement 14)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 9: Marketplace Sort Order ---");

    const marketRes = await callApi(null, "list_machinery_marketplace", {});
    const marketListings = marketRes.data?.machinery || [];
    assert(marketListings.length >= 2, "43. Marketplace returns multiple listings");

    const firstItem = marketListings[0];
    assert(firstItem?.id === createdMachineryId && firstItem?.is_sponsored === true, "44. Sponsored listing appears at top of Machinery marketplace");

    const nonSponsoredItems = marketListings.slice(1);
    assert(nonSponsoredItems.some((m) => m.id === secondaryMachineryId && !m.is_sponsored), "45. Non-sponsored listings remain below sponsored machinery");

    // -------------------------------------------------------------------------
    // PHASE 10: AD PAUSE & EXPIRY BEHAVIOR (Requirement 15)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 10: Ad Pause & Expiry Behavior ---");

    // Owner pauses/stops advertising
    const stopRes = await callApi(testOwnerJwt, "stop_machinery_promotion", { machinery_id: createdMachineryId });
    assert(stopRes.status === 200 && stopRes.data?.advertisement?.status === "paused", "46. Owner stops/pauses advertising");

    // Driver dashboard now should NOT see the paused ad
    const driverDashAds4 = await callApi(testDriverJwt, "get_active_sponsored_machinery", {});
    const driverSeesPaused = (driverDashAds4.data?.sponsored_machinery || []).some((m) => m.id === createdMachineryId);
    assert(!driverSeesPaused, "47. Paused ad disappears from dashboard");

    // Paused listing remains visible normally in Machinery marketplace
    const marketRes2 = await callApi(null, "list_machinery_marketplace", {});
    const stillInMarketings = (marketRes2.data?.machinery || []).some((m) => m.id === createdMachineryId && !m.is_sponsored);
    assert(stillInMarketings, "48. Paused listing remains visible normally in Machinery marketplace");

    // -------------------------------------------------------------------------
    // PHASE 11: SALE ENQUIRY (Requirement 16)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 11: Purchase & Sale Enquiry ---");

    const enquiryRes = await callApi(testPassengerJwt, "submit_machinery_enquiry", {
      machinery_id: createdMachineryId,
      enquiry_type: "sale",
      message: "Ready to inspect machine for purchase in Msasa.",
      contact_name: "Tinashe Passenger",
      contact_phone: "+263771234567",
      contact_email: "tinashe@transmove.test"
    });
    testEnquiryId = enquiryRes.data?.id || enquiryRes.data?.enquiry?.id;
    assert(enquiryRes.status === 200 && Boolean(testEnquiryId), "49. Passenger sends sale enquiry for machinery");

    // Verify real Supabase row in public.machinery_enquiries
    const { data: supaEnq } = await supabaseAdmin.from("machinery_enquiries").select("*").eq("id", testEnquiryId).single();
    assert(supaEnq?.user_id === testPassengerId && supaEnq?.owner_id === testOwnerId, "50. Real Supabase enquiry row has matching user_id and owner_id UUIDs");

    // -------------------------------------------------------------------------
    // PHASE 12: ZERO APPWRITE CALL VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 12: Zero Appwrite Verification ---");
    assert(appwriteReads === 0, `51. Appwrite reads = 0 (actual: ${appwriteReads})`);
    assert(appwriteWrites === 0, `52. Appwrite writes = 0 (actual: ${appwriteWrites})`);
    assert(appwriteAuth === 0, `53. Appwrite auth = 0 (actual: ${appwriteAuth})`);

  } catch (err) {
    console.error("Test execution exception:", err);
    failedAssertions++;
  } finally {
    // -------------------------------------------------------------------------
    // PHASE 13: CLEANUP IN DEPENDENCY-SAFE ORDER (Requirement 17)
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 13: Supabase Cleanup in Dependency Order ---");
    try {
      if (testAdId) {
        await supabaseAdmin.from("machinery_ad_dismissals").delete().eq("advertisement_id", testAdId);
        await supabaseAdmin.from("machinery_advertisements").delete().eq("id", testAdId);
      }
      if (passengerHireId) await supabaseAdmin.from("machinery_hires").delete().eq("id", passengerHireId);
      if (driverHireId) await supabaseAdmin.from("machinery_hires").delete().eq("id", driverHireId);
      if (testEnquiryId) await supabaseAdmin.from("machinery_enquiries").delete().eq("id", testEnquiryId);

      if (createdMachineryId) {
        await supabaseAdmin.from("machinery_documents").delete().eq("machinery_id", createdMachineryId);
        await supabaseAdmin.from("machinery").delete().eq("id", createdMachineryId);
      }
      if (secondaryMachineryId) {
        await supabaseAdmin.from("machinery").delete().eq("id", secondaryMachineryId);
      }
      if (testSubId) {
        await supabaseAdmin.from("subscriptions").delete().eq("id", testSubId);
      }

      // Cleanup profiles
      const userIds = [testOwnerId, testPassengerId, testDriverId, testUnrelatedId].filter(Boolean);
      for (const uid of userIds) {
        await supabaseAdmin.from("profiles").delete().eq("id", uid);
        await supabaseAdmin.auth.admin.deleteUser(uid);
      }

      // Memory cleanup
      if (testOwnerId) {
        supabaseBackendEngine.db.profiles = (supabaseBackendEngine.db.profiles || []).filter(p => !userIds.includes(p.id));
        supabaseBackendEngine.db.subscriptions = (supabaseBackendEngine.db.subscriptions || []).filter(s => s.user_id !== testOwnerId);
      }
      if (createdMachineryId) {
        supabaseBackendEngine.db.machinery = (supabaseBackendEngine.db.machinery || []).filter(m => m.id !== createdMachineryId && m.id !== secondaryMachineryId);
        supabaseBackendEngine.db.machinery_hires = (supabaseBackendEngine.db.machinery_hires || []).filter(h => h.machinery_id !== createdMachineryId);
        supabaseBackendEngine.db.machinery_advertisements = (supabaseBackendEngine.db.machinery_advertisements || []).filter(a => a.machinery_id !== createdMachineryId);
      }
      supabaseBackendEngine._persistLocalDb();
      console.log("✓ Cleanup completed successfully.");
    } catch (cleanErr) {
      console.warn("Cleanup warning:", cleanErr.message);
    }

    if (server) {
      server.close();
      console.log("\n[TestServer] Stopped");
    }

    console.log("\n=======================================================");
    console.log(`TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED`);
    console.log(`APPWRITE AUDIT: Reads=${appwriteReads}, Writes=${appwriteWrites}, Auth=${appwriteAuth}`);
    console.log("=======================================================\n");

    if (failedAssertions > 0) {
      process.exit(1);
    }
  }
}

run();
