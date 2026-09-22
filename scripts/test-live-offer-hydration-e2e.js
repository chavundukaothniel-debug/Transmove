// ==============================================================================
// TRANSMOVE — LIVE OFFER HYDRATION E2E TEST (28 AUTHORITATIVE ASSERTIONS)
// Verifies:
// 1. Temporary passenger created
// 2. Temporary verified driver created
// 3. Approved vehicle created
// 4. Passenger creates service request
// 5. Driver sends $12.00 offer through actual HTTP trusted-api path
// 6. Passenger loads responses through list_bids_for_request
// 7. Response count = 1
// 8. Returned driver full_name is correct (matches real driver profile)
// 9. Returned driver_id is correct
// 10. Returned vehicle_id is correct
// 11. Returned vehicle make/model is correct
// 12. Returned registration_number is correct
// 13. Returned amount = 12
// 14. Amount is not 0
// 15. View Profile data uses the same real driver and vehicle
// 16. Counter input starts at current amount ($12)
// 17. Passenger counters from $12 to $11
// 18. Current negotiated amount correctly reflects conversation/state ($11)
// 19. Final accept succeeds
// 20. Exactly one booking created
// 21. Booking driver_id = selected driver
// 22. Booking vehicle_id = selected vehicle
// 23. Booking amount = final negotiated amount ($11)
// 24. No generic "Driver" runtime fallback
// 25. No $0 runtime fare fallback
// 26. Appwrite reads = 0
// 27. Appwrite writes = 0
// 28. Appwrite auth = 0
// ==============================================================================

import http from "http";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";
import { CustomerView } from "../src/views/CustomerView.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration in .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_PORT = 8094;
let serverInstance = null;

let appwriteReads = 0;
let appwriteWrites = 0;
let appwriteAuth = 0;
const originalFetch = globalThis.fetch;

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

      res.writeHead(404);
      res.end("Not found");
    });

    srv.listen(TEST_PORT, () => {
      serverInstance = srv;
      resolve();
    });
    srv.on("error", reject);
  });
}

async function callApi(jwt, action, data = {}, extra = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, data, ...extra });
    const options = {
      hostname: "127.0.0.1",
      port: TEST_PORT,
      path: "/api/trusted-api",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let resBody = "";
      res.on("data", (chunk) => { resBody += chunk; });
      res.on("end", () => {
        let parsed = null;
        try { parsed = JSON.parse(resBody); } catch (_) { parsed = resBody; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("TRANSMOVE — LIVE OFFER HYDRATION E2E TEST (28 STEPS)");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testNumber, description) {
    if (condition) {
      console.log(`[PASS] Assertion ${testNumber}: ${description}`);
      passed++;
    } else {
      console.error(`[FAIL] Assertion ${testNumber}: ${description}`);
      failed++;
    }
  }

  await startTestServer();

  const runId = Math.random().toString(36).slice(2, 8);
  const passengerEmail = `test.pass.hyd.${runId}@transmove.test`;
  const driverEmail = `test.drv.hyd.${runId}@transmove.test`;
  const driverFullName = `Farai K. ${runId}`;
  const passengerFullName = `Tatenda M. ${runId}`;
  const vehicleMake = "Nissan";
  const vehicleModel = "Hardbody";
  const vehicleReg = `ABC ${Math.floor(1000 + Math.random() * 9000)}`;

  let passengerAuth = null;
  let driverAuth = null;
  let passengerJwt = null;
  let driverJwt = null;
  let vehicle = null;
  let serviceRequest = null;
  let driverOffer = null;
  let hydratedOffers = null;
  let bookingResult = null;

  try {
    // 1. Create temp passenger
    const { data: pData, error: pErr } = await supabaseAdmin.auth.admin.createUser({
      email: passengerEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { full_name: passengerFullName }
    });
    if (pErr) throw pErr;
    passengerAuth = pData.user;

    // Update profile row (created by DB trigger on auth.users insert)
    const { error: passengerProfileError } = await supabaseAdmin.from("profiles")
      .update({ full_name: passengerFullName, role: "passenger", account_status: "active" })
      .eq("id", passengerAuth.id);
    if (passengerProfileError) throw passengerProfileError;

    // Obtain a real JWT via sign-in so the trusted-api can verify it
    const { data: pLogin, error: pLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: passengerEmail, password: "Password123!"
    });
    if (pLoginErr) throw pLoginErr;
    passengerJwt = pLogin.session.access_token;

    supabaseBackendEngine.db.profiles.push({
      id: passengerAuth.id,
      user_id: passengerAuth.id,
      email: passengerEmail,
      full_name: passengerFullName,
      role: "passenger",
      account_status: "active"
    });
    assert(Boolean(passengerAuth.id), 1, "Temporary passenger created");

    // 2. Create temp verified driver
    const { data: dData, error: dErr } = await supabaseAdmin.auth.admin.createUser({
      email: driverEmail,
      password: "Password123!",
      email_confirm: true,
      user_metadata: { full_name: driverFullName }
    });
    if (dErr) throw dErr;
    driverAuth = dData.user;

    // Update profile row (created by DB trigger on auth.users insert)
    const { error: driverProfileError } = await supabaseAdmin.from("profiles")
      .update({
        full_name: driverFullName,
        role: "driver",
        account_status: "active",
        verification_status: "approved",
        rating_avg: 4.9,
        rating_count: 14
      })
      .eq("id", driverAuth.id);
    if (driverProfileError) throw driverProfileError;

    // Obtain a real JWT via sign-in
    const { data: dLogin, error: dLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: driverEmail, password: "Password123!"
    });
    if (dLoginErr) throw dLoginErr;
    driverJwt = dLogin.session.access_token;

    supabaseBackendEngine.db.profiles.push({
      id: driverAuth.id,
      user_id: driverAuth.id,
      email: driverEmail,
      full_name: driverFullName,
      role: "driver",
      account_status: "active",
      verification_status: "approved",
      rating_avg: 4.9,
      rating_count: 14
    });
    assert(Boolean(driverAuth.id), 2, `Temporary verified driver created: ${driverFullName}`);

    // 3. Create approved vehicle
    const vehicleId = randomUUID();
    const { data: vData, error: vErr } = await supabaseAdmin.from("vehicles").insert({
      id: vehicleId,
      driver_id: driverAuth.id,
      make: vehicleMake,
      model: vehicleModel,
      year: 2021,
      colour: "White",
      registration_number: vehicleReg,
      vehicle_type: "pickup",
      service_category: "passenger_transport",
      verification_status: "approved",
      is_primary: true
    }).select().single();
    if (vErr) throw vErr;

    vehicle = vData || {
      id: vehicleId,
      driver_id: driverAuth.id,
      make: vehicleMake,
      model: vehicleModel,
      registration_number: vehicleReg,
      is_primary: true
    };
    supabaseBackendEngine.db.vehicles.push({
      ...vehicle,
      is_primary: true,
      verification_status: "approved"
    });
    assert(Boolean(vehicle.id), 3, `Approved vehicle created: ${vehicleMake} ${vehicleModel} (${vehicleReg})`);

    // 4. Passenger creates an authoritative Supabase request through actual HTTP.
    const requestRes = await callApi(passengerJwt, "create_service_request", {
      service_type: "passenger",
      pickup_location: "Avondale, Harare",
      pickup_latitude: -17.800,
      pickup_longitude: 31.033,
      destination: "Borrowdale, Harare",
      destination_latitude: -17.750,
      destination_longitude: 31.083,
      request_date: new Date(Date.now() + 3600000).toISOString(),
      budget: 10
    });
    serviceRequest = requestRes.body.request || requestRes.body;
    const reqId = serviceRequest.id;
    assert(requestRes.status === 200 && Boolean(reqId), 4, `Passenger request created through actual HTTP endpoint: ${reqId}`);

    // 5. Driver sends $12 offer through ACTUAL HTTP/UI backend path
    const offerRes = await callApi(driverJwt, "create_bid", {
      request_id: reqId,
      vehicle_id: vehicle.id,
      proposed_price: 12.00,
      estimated_arrival_mins: 15,
      message: "Ready to pick you up in 15 minutes."
    });
    driverOffer = offerRes.body.bid || offerRes.body;
    assert(
      offerRes.status === 200 &&
      (Number(driverOffer.amount) === 12 || Number(driverOffer.proposed_price) === 12),
      5,
      `Driver sends $12 offer through actual HTTP endpoint (amount: $${driverOffer.amount})`
    );

    const { data: rawStoredOffer, error: rawOfferError } = await supabaseAdmin
      .from("bids")
      .select("id, request_id, driver_id, vehicle_id, amount, estimated_arrival_minutes, message, status, created_at, updated_at")
      .eq("id", driverOffer.id)
      .single();
    if (rawOfferError) throw rawOfferError;
    console.log(`TRACE raw stored offer before hydration: ${JSON.stringify(rawStoredOffer)}`);

    // 6. Passenger loads responses through ACTUAL passenger responses endpoint
    const listRes = await callApi(passengerJwt, "list_bids_for_request", {
      request_id: reqId
    });
    assert(listRes.status === 200, 6, "Passenger loads responses through list_bids_for_request");

    const bids = listRes.body.bids || [];
    hydratedOffers = bids;

    // 7. Response count = 1
    assert(bids.length === 1, 7, `Response count = 1 (actual: ${bids.length})`);

    const firstOffer = bids[0] || {};
    const initialOfferHtml = CustomerView.renderSmartOfferList([firstOffer]);

    // 8. Returned driver full_name is correct
    assert(
      firstOffer.driver?.full_name === driverFullName,
      8,
      `Returned driver full_name is correct: "${firstOffer.driver?.full_name}" === "${driverFullName}"`
    );

    // 9. Returned driver_id correct
    assert(
      firstOffer.driver_id === driverAuth.id,
      9,
      `Returned driver_id correct: "${firstOffer.driver_id}" === "${driverAuth.id}"`
    );

    // 10. Returned vehicle_id correct
    assert(
      firstOffer.vehicle_id === vehicle.id && firstOffer.vehicle?.id === vehicle.id,
      10,
      `Returned vehicle_id correct: "${firstOffer.vehicle_id}" === "${vehicle.id}"`
    );

    // 11. Returned vehicle make/model correct
    const vMake = firstOffer.vehicle?.make;
    const vModel = firstOffer.vehicle?.model;
    assert(
      vMake === vehicleMake && vModel === vehicleModel,
      11,
      `Returned vehicle make/model correct: "${vMake} ${vModel}" === "${vehicleMake} ${vehicleModel}"`
    );

    // 12. Returned registration correct
    const vReg = firstOffer.vehicle?.registration_number;
    assert(
      vReg === vehicleReg,
      12,
      `Returned registration correct: "${vReg}" === "${vehicleReg}"`
    );

    // 13. Returned amount = 12
    const offerAmt = Number(firstOffer.amount);
    assert(offerAmt === 12, 13, `Returned amount = 12 (actual: ${offerAmt})`);

    // 14. Amount is not 0
    assert(offerAmt > 0 && offerAmt !== 0, 14, `Amount is not 0 (actual: $${offerAmt.toFixed(2)})`);

    // 15. View Profile data uses the same real driver and vehicle
    assert(
      firstOffer.driver?.id === driverAuth.id &&
        firstOffer.driver?.full_name === driverFullName &&
        firstOffer.vehicle?.id === vehicle.id &&
        firstOffer.vehicle?.registration_number === vehicleReg,
      15,
      `View Profile data uses real driver and vehicle: ${firstOffer.driver?.full_name}, ${firstOffer.vehicle?.make} ${firstOffer.vehicle?.model} (${firstOffer.vehicle?.registration_number})`
    );

    // 16. Counter input starts from the current authoritative amount
    const counterStartingAmount = Number(firstOffer.current_amount ?? firstOffer.counter_amount ?? firstOffer.amount);
    assert(
      counterStartingAmount === 12,
      16,
      `Counter input starts at current amount: $${counterStartingAmount.toFixed(2)}`
    );

    // 17. Counter from 12 to 11
    const counterRes = await callApi(passengerJwt, "counter_bid", {
      bid_id: firstOffer.id,
      counter_amount: 11.00,
      message: "Can you do $11?"
    });
    assert(counterRes.status === 200, 17, "Passenger counters from $12 to $11");

    // Passenger reloads offers; assertion 18 verifies the authoritative result.
    const reloadRes = await callApi(passengerJwt, "list_bids_for_request", {
      request_id: reqId
    });

    const reloadedBids = reloadRes.body.bids || [];
    const reloadedOffer = reloadedBids[0] || {};
    const reloadedOfferHtml = CustomerView.renderSmartOfferList([reloadedOffer]);

    // 18. Current negotiated amount correctly reflects conversation/state ($11)
    const reloadedAmt = Number(reloadedOffer.amount);
    assert(
      reloadRes.status === 200 && reloadedAmt === 11 && Number(reloadedOffer.current_amount) === 11,
      18,
      `Current negotiated amount correctly reflects counter state: $${reloadedAmt} === $11.00`
    );

    // 19. Final accept succeeds
    const acceptRes = await callApi(passengerJwt, "accept_bid", {
      bid_id: reloadedOffer.id
    });
    assert(acceptRes.status === 200, 19, "Final accept succeeds (agreed fare derived server-side)");
    bookingResult = acceptRes.body.booking || acceptRes.body;

    // 20. Exactly one booking created
    const { data: allBookings, error: bookingLookupError } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("request_id", reqId);
    if (bookingLookupError) throw bookingLookupError;
    const bookingCount = allBookings?.length || 0;
    assert(bookingCount === 1, 20, `Exactly one booking created (count: ${bookingCount})`);

    const booking = allBookings?.[0] || bookingResult;

    // 21. Booking driver_id = selected driver
    assert(
      booking.driver_id === driverAuth.id,
      21,
      `Booking driver_id matches selected driver: "${booking.driver_id}" === "${driverAuth.id}"`
    );

    // 22. Booking vehicle_id = selected vehicle
    assert(
      booking.vehicle_id === vehicle.id,
      22,
      `Booking vehicle_id matches selected vehicle: "${booking.vehicle_id}" === "${vehicle.id}"`
    );

    // 23. Booking amount = final negotiated amount ($11)
    const finalBookingAmt = Number(booking.amount);
    assert(
      finalBookingAmt === 11,
      23,
      `Booking amount = final negotiated amount: $${finalBookingAmt.toFixed(2)} === $11.00`
    );

    // 24. No generic Driver runtime fallback
    assert(
      firstOffer.driver?.full_name !== "Driver" &&
        firstOffer.driver?.full_name === driverFullName &&
        initialOfferHtml.includes(driverFullName) &&
        !initialOfferHtml.includes(">Driver<"),
      24,
      `No generic Driver runtime fallback (actual: ${firstOffer.driver?.full_name})`
    );

    // 25. No $0 runtime fare fallback
    assert(
      offerAmt === 12 &&
        reloadedAmt === 11 &&
        finalBookingAmt === 11 &&
        initialOfferHtml.includes("$12") &&
        reloadedOfferHtml.includes("$11") &&
        !initialOfferHtml.includes("$0") &&
        !reloadedOfferHtml.includes("$0"),
      25,
      `No $0 runtime fare fallback (offer: $${offerAmt}, counter: $${reloadedAmt}, booking: $${finalBookingAmt})`
    );

    // 26-28. No Appwrite access in this passenger-driver offer flow
    assert(appwriteReads === 0, 26, `Appwrite reads = ${appwriteReads}`);
    assert(appwriteWrites === 0, 27, `Appwrite writes = ${appwriteWrites}`);
    assert(appwriteAuth === 0, 28, `Appwrite auth = ${appwriteAuth}`);

  } catch (err) {
    console.error("Test execution failed with unhandled exception:", err);
    failed = Math.max(failed, 28 - passed);
  } finally {
    // Cleanup test data
    console.log("\nCleaning up temporary test records...");
    try {
      if (driverOffer?.id) {
        await supabaseAdmin.from("bid_negotiations").delete().eq("bid_id", driverOffer.id);
      }
      if (serviceRequest?.id) {
        await supabaseAdmin.from("bookings").delete().eq("request_id", serviceRequest.id);
        await supabaseAdmin.from("bids").delete().eq("request_id", serviceRequest.id);
        await supabaseAdmin.from("service_requests").delete().eq("id", serviceRequest.id);
      }
      if (vehicle?.id) {
        await supabaseAdmin.from("vehicles").delete().eq("id", vehicle.id);
      }
      if (driverAuth?.id) {
        await supabaseAdmin.from("profiles").delete().eq("id", driverAuth.id);
        await supabaseAdmin.auth.admin.deleteUser(driverAuth.id);
      }
      if (passengerAuth?.id) {
        await supabaseAdmin.from("profiles").delete().eq("id", passengerAuth.id);
        await supabaseAdmin.auth.admin.deleteUser(passengerAuth.id);
      }
    } catch (cleanupErr) {
      console.warn("Cleanup error (ignorable):", cleanupErr.message);
    }

    const ids = new Set([passengerAuth?.id, driverAuth?.id].filter(Boolean));
    const requestId = serviceRequest?.id;
    const offerId = driverOffer?.id;
    supabaseBackendEngine.db.profiles = (supabaseBackendEngine.db.profiles || []).filter((row) => !ids.has(row.id) && !ids.has(row.user_id));
    supabaseBackendEngine.db.vehicles = (supabaseBackendEngine.db.vehicles || []).filter((row) => row.id !== vehicle?.id);
    supabaseBackendEngine.db.service_requests = (supabaseBackendEngine.db.service_requests || []).filter((row) => row.id !== requestId);
    supabaseBackendEngine.db.bids = (supabaseBackendEngine.db.bids || []).filter((row) => row.id !== offerId && row.request_id !== requestId);
    supabaseBackendEngine.db.bid_negotiations = (supabaseBackendEngine.db.bid_negotiations || []).filter((row) => row.bid_id !== offerId);
    supabaseBackendEngine.db.bookings = (supabaseBackendEngine.db.bookings || []).filter((row) => row.request_id !== requestId);
    supabaseBackendEngine._persistLocalDb();

    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    globalThis.fetch = originalFetch;
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL 28)`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
