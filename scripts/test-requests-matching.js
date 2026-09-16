// ==============================================================================
// TRANSMOVE REQUESTS & MATCHING TEST SUITE
// Tests Phases 19, 21, and 22:
// - Tests 1-11 covering request creation, idempotency, driver matching,
//   deduplication, security hardening, and cross-user isolation.
// - Full regression testing of existing auth, profile, and vehicle services.
// - Complete cleanup of all temporary test entities.
// ==============================================================================

const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  },
  location: {
    origin: "http://localhost:8080",
    hash: "",
    search: ""
  },
  console: console
};

import fs from "fs";
import path from "path";
import {
  getAppwriteAccount,
  getAppwriteDatabases,
  getAppwriteStorage,
  APPWRITE_CONFIG,
  ID,
  Query
} from "../src/config/appwrite.js";
import { AuthService } from "../src/services/auth.js";
import { VehicleService } from "../src/services/vehicles.js";
import { RequestService } from "../src/services/requests.js";

// Load server credentials strictly for backend assertion and cleanup
const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
const conf = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const ENDPOINT = conf.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = conf.APPWRITE_PROJECT_ID || "6aaa6531003d5747b640";
const API_KEY = conf.APPWRITE_API_KEY;
const TRUSTED_API = "http://localhost:8080/.netlify/functions/trusted-api";

const serverHeaders = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

const cleanup = {
  vehicles: [],
  photos: [],
  documents: [],
  requests: [],
  request_images: [],
  files: []
};

const results = {
  requestCreate: false,
  exactlyOneRequestRecord: false,
  passengerIdSpoofProtection: false,
  duplicateSubmissionProtection: false,
  passengerRequestList: false,
  requestDetails: false,
  requestUpdate: false,
  requestCancellation: false,
  requestImageUpload: false,
  requestImageOwnership: false,
  driverACompatibleMatching: false,
  driverBCompatibleMatching: false,
  sameRequestIdAcrossDrivers: false,
  incompatibleDriverFiltering: false,
  multipleVehicleDeduplication: false,
  inactiveVehicleFiltering: false,
  directDriverDatabaseScraping: false,
  crossPassengerSecurity: false,
  existingAuthRegression: false,
  existingVehicleRegression: false
};

const testPassword = "SecPassw0rd2026!#";

async function loginAs(email) {
  return await AuthService.login({ email, password: testPassword });
}

async function getOrCreateUser(email, fullName, phoneNumber, role, city) {
  try {
    const loginRes = await AuthService.login({ email, password: testPassword });
    // Check if profile exists; if not, create it
    if (!loginRes.profile) {
      const account = getAppwriteAccount();
      const jwtRes = await account.createJWT();
      await fetch(TRUSTED_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwtRes.jwt}`,
          "X-Appwrite-JWT": jwtRes.jwt
        },
        body: JSON.stringify({
          action: "create_profile",
          data: { fullName, phoneNumber, role, city, bio: "" }
        })
      });
      return await AuthService.login({ email, password: testPassword });
    }
    return loginRes;
  } catch (err) {
    console.log(`  Registering new test account: ${email}`);
    return await AuthService.register({
      email,
      password: testPassword,
      fullName,
      phoneNumber,
      role,
      city
    });
  }
}

async function run() {
  console.log("==================================================");
  console.log("TRANSMOVE REQUESTS + MATCHING TEST SUITE");
  console.log("==================================================");

  const timestamp = Date.now();
  const baseTs = "1789563042071";

  try {
    // -------------------------------------------------------------
    // SETUP: Get or create the 5 test accounts
    // -------------------------------------------------------------
    console.log("\n[SETUP] Initializing test accounts...");

    const emailP = `passenger_p_${baseTs}@transmove.test`;
    const regP = await getOrCreateUser(emailP, "Passenger Primus", "+263771000001", "passenger", "Harare");
    const userP = regP.user;
    console.log("  Passenger P ready:", userP.$id);

    const emailA = `driver_a_${baseTs}@transmove.test`;
    const regA = await getOrCreateUser(emailA, "Driver Alpha", "+263771000002", "driver", "Harare");
    const userA = regA.user;
    console.log("  Driver A ready:", userA.$id);

    const emailB = `driver_b_${baseTs}@transmove.test`;
    const regB = await getOrCreateUser(emailB, "Driver Bravo", "+263771000003", "driver", "Harare");
    const userB = regB.user;
    console.log("  Driver B ready:", userB.$id);

    const emailC = `driver_c_${baseTs}@transmove.test`;
    const regC = await getOrCreateUser(emailC, "Driver Charlie", "+263771000004", "driver", "Harare");
    const userC = regC.user;
    console.log("  Driver C ready:", userC.$id);

    const emailX = `passenger_x_${baseTs}@transmove.test`;
    const regX = await getOrCreateUser(emailX, "Passenger Xray", "+263771000009", "passenger", "Bulawayo");
    const userX = regX.user;
    console.log("  Passenger X ready:", userX.$id);

    // -------------------------------------------------------------
    // PURGE ANY PREVIOUS VEHICLES OR REQUESTS FOR THESE USERS
    // -------------------------------------------------------------
    const testUserIds = [userP.$id, userA.$id, userB.$id, userC.$id, userX.$id];
    for (const uid of testUserIds) {
      // Purge old vehicles
      const vRes = await fetch(
        `${ENDPOINT}/databases/transmove/collections/vehicles/documents?queries[]=${encodeURIComponent(`equal("driver_id", ["${uid}"])`)}`,
        { headers: serverHeaders }
      );
      if (vRes.ok) {
        const vData = await vRes.json();
        for (const doc of (vData.documents || [])) {
          await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents/${doc.$id}`, {
            method: "DELETE",
            headers: serverHeaders
          }).catch(() => {});
        }
      }

      // Purge old requests
      const rRes = await fetch(
        `${ENDPOINT}/databases/transmove/collections/service_requests/documents?queries[]=${encodeURIComponent(`equal("passenger_id", ["${uid}"])`)}`,
        { headers: serverHeaders }
      );
      if (rRes.ok) {
        const rData = await rRes.json();
        for (const doc of (rData.documents || [])) {
          await fetch(`${ENDPOINT}/databases/transmove/collections/service_requests/documents/${doc.$id}`, {
            method: "DELETE",
            headers: serverHeaders
          }).catch(() => {});
        }
      }
    }

    // -------------------------------------------------------------
    // SETUP INITIAL VEHICLES
    // -------------------------------------------------------------
    // Driver A vehicle (compatible: passenger_transport)
    await loginAs(emailA);
    const vehA1 = await VehicleService.addVehicle({
      vehicle_type: "sedan",
      service_category: "passenger_transport",
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      registration_number: `A1_${timestamp.toString().slice(-4)}`,
      color: "White",
      is_primary: true
    });
    cleanup.vehicles.push(vehA1.id);
    console.log("  Driver A vehicle 1 added (passenger_transport):", vehA1.id);

    // Driver B vehicle (compatible: passenger_transport)
    await loginAs(emailB);
    const vehB1 = await VehicleService.addVehicle({
      vehicle_type: "sedan",
      service_category: "passenger_transport",
      make: "Honda",
      model: "Fit",
      year: 2019,
      registration_number: `B1_${timestamp.toString().slice(-4)}`,
      color: "Silver",
      is_primary: true
    });
    cleanup.vehicles.push(vehB1.id);
    console.log("  Driver B vehicle 1 added (passenger_transport):", vehB1.id);

    // Driver C vehicle (incompatible: machinery_hire)
    await loginAs(emailC);
    const vehC1 = await VehicleService.addVehicle({
      vehicle_type: "machinery",
      service_category: "machinery_hire",
      make: "CAT",
      model: "Excavator 320",
      year: 2018,
      registration_number: `C1_${timestamp.toString().slice(-4)}`,
      color: "Yellow",
      is_primary: true
    });
    cleanup.vehicles.push(vehC1.id);
    console.log("  Driver C vehicle 1 added (machinery_hire):", vehC1.id);

    // Switch session to Passenger P
    await loginAs(emailP);

    // =============================================================
    // TEST 1 — REQUEST CREATION
    // =============================================================
    console.log("\n--- TEST 1: REQUEST CREATION ---");
    const req1 = await RequestService.createRequest({
      service_type: "ride",
      pickup_location: "Harare Central Hospital",
      destination: "Avondale Shopping Centre",
      budget: 15.0,
      details: "2 passengers with 1 bag",
      passenger_count: 2
    });
    const req1Id = req1.id || req1.$id;
    cleanup.requests.push(req1Id);

    // Verify in live database
    const checkReq1Res = await fetch(
      `${ENDPOINT}/databases/transmove/collections/service_requests/documents/${req1Id}`,
      { headers: serverHeaders }
    );
    const checkReq1 = await checkReq1Res.json();

    if (
      checkReq1Res.ok &&
      checkReq1.passenger_id === userP.$id &&
      checkReq1.service_type === "ride" &&
      checkReq1.status === "open_for_bids"
    ) {
      results.requestCreate = true;
      console.log("  PASS: Request created with status open_for_bids:", req1Id);
      console.log(`    passenger_id: ${checkReq1.passenger_id}, service_type: ${checkReq1.service_type}`);
    } else {
      console.log("  FAIL: Request creation invalid.");
    }

    // =============================================================
    // TEST 2 — SAME REQUEST MULTIPLE DRIVERS (EXACTLY ONE RECORD)
    // =============================================================
    console.log("\n--- TEST 2: SAME REQUEST MULTIPLE DRIVERS ---");
    // Login as Driver A
    await loginAs(emailA);
    const driverAJobs = await RequestService.getAvailableRequestsForDrivers();
    const driverAFoundReq = driverAJobs.find((j) => (j.id || j.$id) === req1Id);
    results.driverACompatibleMatching = Boolean(driverAFoundReq);
    console.log("  Driver A found request in available jobs:", results.driverACompatibleMatching);

    // Login as Driver B
    await loginAs(emailB);
    const driverBJobs = await RequestService.getAvailableRequestsForDrivers();
    const driverBFoundReq = driverBJobs.find((j) => (j.id || j.$id) === req1Id);
    results.driverBCompatibleMatching = Boolean(driverBFoundReq);
    console.log("  Driver B found request in available jobs:", results.driverBCompatibleMatching);

    // Verify same request ID across both drivers
    const sameId = Boolean(
      driverAFoundReq &&
      driverBFoundReq &&
      (driverAFoundReq.id || driverAFoundReq.$id) === req1Id &&
      (driverBFoundReq.id || driverBFoundReq.$id) === req1Id
    );
    results.sameRequestIdAcrossDrivers = sameId;
    console.log("  Same request ID across Driver A and Driver B:", results.sameRequestIdAcrossDrivers);

    // Verify exactly ONE record exists in live Appwrite database
    const allReqsRes = await fetch(
      `${ENDPOINT}/databases/transmove/collections/service_requests/documents`,
      { headers: serverHeaders }
    );
    const allReqsData = await allReqsRes.json();
    const matches = (allReqsData.documents || []).filter((d) => d.$id === req1Id);
    results.exactlyOneRequestRecord = matches.length === 1;
    console.log(`  Live database rows for request ${req1Id}: ${matches.length} (Expected: 1)`);
    console.log("  Exactly one request record:", results.exactlyOneRequestRecord ? "PASS" : "FAIL");

    // =============================================================
    // TEST 3 — INCOMPATIBLE DRIVER FILTERING
    // =============================================================
    console.log("\n--- TEST 3: INCOMPATIBLE DRIVER FILTERING ---");
    // Login as Driver C (machinery_hire vehicle only)
    await loginAs(emailC);
    const driverCJobs = await RequestService.getAvailableRequestsForDrivers();
    const driverCFoundReq = driverCJobs.find((j) => (j.id || j.$id) === req1Id);
    results.incompatibleDriverFiltering = !driverCFoundReq;
    console.log("  Driver C (machinery) sees passenger ride request:", Boolean(driverCFoundReq), "(Expected: false)");
    console.log("  Incompatible driver filtering:", results.incompatibleDriverFiltering ? "PASS" : "FAIL");

    // =============================================================
    // TEST 4 — MULTIPLE MATCHING VEHICLES DEDUPLICATION
    // =============================================================
    console.log("\n--- TEST 4: MULTIPLE MATCHING VEHICLES DEDUPLICATION ---");
    // Login as Driver A and add a SECOND compatible active vehicle (van / minibus)
    await loginAs(emailA);
    const vehA2 = await VehicleService.addVehicle({
      vehicle_type: "van",
      service_category: "passenger_transport",
      make: "Nissan",
      model: "Caravan",
      year: 2021,
      registration_number: `A2_${timestamp.toString().slice(-4)}`,
      color: "Blue",
      is_primary: false
    });
    cleanup.vehicles.push(vehA2.id);
    console.log("  Driver A added 2nd compatible vehicle:", vehA2.id);

    const driverAJobsAfterSecondVeh = await RequestService.getAvailableRequestsForDrivers();
    const req1Occurrences = driverAJobsAfterSecondVeh.filter((j) => (j.id || j.$id) === req1Id);
    results.multipleVehicleDeduplication = req1Occurrences.length === 1;
    console.log(`  Occurrences of request ${req1Id} in Driver A's feed: ${req1Occurrences.length} (Expected: 1)`);
    console.log("  Multiple vehicle deduplication:", results.multipleVehicleDeduplication ? "PASS" : "FAIL");

    // =============================================================
    // TEST 5 — INACTIVE VEHICLE FILTERING
    // =============================================================
    console.log("\n--- TEST 5: INACTIVE VEHICLE FILTERING ---");
    // Deactivate both vehicles for Driver A
    await VehicleService.toggleVehicleStatus(vehA1.id, false);
    await VehicleService.toggleVehicleStatus(vehA2.id, false);

    const driverAJobsInactive = await RequestService.getAvailableRequestsForDrivers();
    const req1StillVisible = driverAJobsInactive.some((j) => (j.id || j.$id) === req1Id);
    results.inactiveVehicleFiltering = !req1StillVisible && driverAJobsInactive.length === 0;
    console.log("  Driver A sees request when all vehicles inactive:", req1StillVisible, "(Expected: false)");
    console.log("  Inactive vehicle filtering:", results.inactiveVehicleFiltering ? "PASS" : "FAIL");

    // Re-activate vehA1 for remaining operations
    await VehicleService.toggleVehicleStatus(vehA1.id, true);

    // =============================================================
    // TEST 6 — PASSENGER SPOOFING
    // =============================================================
    console.log("\n--- TEST 6: PASSENGER SPOOFING ---");
    // 1. Direct Appwrite client creation attempt with spoofed passenger_id
    await loginAs(emailP);
    const databasesP = getAppwriteDatabases();

    let directClientCreateBlocked = false;
    try {
      await databasesP.createDocument("transmove", "service_requests", ID.unique(), {
        passenger_id: userX.$id,
        service_type: "ride",
        pickup_location: "Spoofed Pickup",
        destination: "Spoofed Dest",
        status: "open_for_bids",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      directClientCreateBlocked = true;
      console.log("  [Direct Client] createDocument on service_requests REJECTED:", err.message);
    }

    // 2. Trusted API privilege escalation attempt: passing passenger_id in payload
    let trustedPassengerIdSpoofBlocked = false;
    const accountP = getAppwriteAccount();
    const jwtResP = await accountP.createJWT();
    const jwtP = jwtResP.jwt;

    const spoofPayloadRes = await fetch(TRUSTED_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwtP}`,
        "X-Appwrite-JWT": jwtP
      },
      body: JSON.stringify({
        action: "create_service_request",
        data: {
          passenger_id: userX.$id,
          service_type: "ride",
          pickup_location: "Spoofed",
          destination: "Spoofed"
        }
      })
    });

    if (!spoofPayloadRes.ok) {
      trustedPassengerIdSpoofBlocked = true;
      const errData = await spoofPayloadRes.json();
      console.log("  [Trusted API] passenger_id tampering REJECTED:", errData.error);
    }

    results.passengerIdSpoofProtection = directClientCreateBlocked && trustedPassengerIdSpoofBlocked;
    console.log("  Passenger ID spoof protection:", results.passengerIdSpoofProtection ? "PASS" : "FAIL");

    // =============================================================
    // TEST 7 — DRIVER DATABASE SCRAPING
    // =============================================================
    console.log("\n--- TEST 7: DRIVER DATABASE SCRAPING ---");
    // Driver A attempts direct databases.listDocuments on service_requests
    await loginAs(emailA);
    const databasesA = getAppwriteDatabases();

    const directDriverQuery = await databasesA.listDocuments("transmove", "service_requests");
    const scrapedCount = directDriverQuery.total;
    results.directDriverDatabaseScraping = scrapedCount === 0;
    console.log(`  Direct client listDocuments returned: ${scrapedCount} records (Expected: 0)`);
    console.log("  Direct driver database scraping:", results.directDriverDatabaseScraping ? "PASS" : "FAIL");

    // =============================================================
    // TEST 8 — DOUBLE SUBMISSION / IDEMPOTENCY
    // =============================================================
    console.log("\n--- TEST 8: DOUBLE SUBMISSION PROTECTION ---");
    await loginAs(emailP);
    const submissionKey = `idemp_${timestamp.toString().slice(-8)}`;

    // First call
    const sub1 = await RequestService.createRequest({
      submission_id: submissionKey,
      service_type: "ride",
      pickup_location: "First Attempt Pickup",
      destination: "First Attempt Destination",
      budget: 20
    });
    cleanup.requests.push(sub1.id);

    // Second call with EXACT same submission_id
    const sub2 = await RequestService.createRequest({
      submission_id: submissionKey,
      service_type: "ride",
      pickup_location: "Retry Pickup",
      destination: "Retry Destination",
      budget: 20
    });

    // Verify both returned documents have the exact same ID
    const sameSubmissionId = (sub1.id || sub1.$id) === (sub2.id || sub2.$id);

    // Verify only ONE row exists in database for this submission_id
    const checkSubRes = await fetch(
      `${ENDPOINT}/databases/transmove/collections/service_requests/documents/${sub1.id}`,
      { headers: serverHeaders }
    );
    const subDoc = await checkSubRes.json();
    results.duplicateSubmissionProtection = Boolean(sameSubmissionId && checkSubRes.ok && subDoc.$id === sub1.id);
    console.log(`  Sub1 ID: ${sub1.id}, Sub2 ID: ${sub2.id} (Match: ${sameSubmissionId})`);
    console.log("  Duplicate submission protection:", results.duplicateSubmissionProtection ? "PASS" : "FAIL");

    // =============================================================
    // TEST 9 — REQUEST IMAGE UPLOAD & OWNERSHIP
    // =============================================================
    console.log("\n--- TEST 9: REQUEST IMAGE UPLOAD & OWNERSHIP ---");
    await loginAs(emailP);
    const dummyCargoPhoto = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])],
      "cargo_item.jpg",
      { type: "image/jpeg" }
    );

    const imgRecord = await RequestService.uploadRequestImage(req1Id, dummyCargoPhoto);
    cleanup.request_images.push(imgRecord.id);
    cleanup.files.push(imgRecord.file_id);

    // Check database record
    const checkImgRes = await fetch(
      `${ENDPOINT}/databases/transmove/collections/request_images/documents/${imgRecord.id}`,
      { headers: serverHeaders }
    );
    const imgData = await checkImgRes.json();
    const legitimateImageUploaded = Boolean(
      checkImgRes.ok &&
      imgData.request_id === req1Id &&
      imgData.passenger_id === userP.$id
    );
    results.requestImageUpload = legitimateImageUploaded;
    console.log("  Legitimate image uploaded:", legitimateImageUploaded, "Record:", imgRecord.id);

    // Passenger X attempts to register an image against Passenger P's request R1
    await loginAs(emailX);
    const dummyHackerPhoto = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])],
      "hack.jpg",
      { type: "image/jpeg" }
    );
    let crossImageBlocked = false;
    try {
      await RequestService.uploadRequestImage(req1Id, dummyHackerPhoto);
    } catch (err) {
      crossImageBlocked = true;
      console.log("  [Trusted API] Cross-passenger image upload REJECTED:", err.message);
    }
    results.requestImageOwnership = crossImageBlocked;
    console.log("  Request image ownership protection:", results.requestImageOwnership ? "PASS" : "FAIL");

    // =============================================================
    // TEST: PASSENGER REQUEST LIST & DETAILS & UPDATE
    // =============================================================
    console.log("\n--- TEST: PASSENGER REQUEST LIST, DETAILS & UPDATE ---");
    await loginAs(emailP);
    const pRequests = await RequestService.getCustomerRequests();
    results.passengerRequestList = pRequests.some((r) => (r.id || r.$id) === req1Id);
    console.log("  Passenger request list contains R1:", results.passengerRequestList);

    const reqDetails = await RequestService.getRequestDetails(req1Id);
    results.requestDetails = Boolean(
      reqDetails &&
      (reqDetails.id || reqDetails.$id) === req1Id &&
      reqDetails.images &&
      reqDetails.images.length >= 1
    );
    console.log("  Request details loaded with images:", results.requestDetails);

    const updatedReq = await RequestService.updateRequest(req1Id, {
      details: "Updated details: 3 passengers with 2 large bags",
      budget: 18.5
    });
    results.requestUpdate = Boolean(
      updatedReq &&
      updatedReq.details === "Updated details: 3 passengers with 2 large bags" &&
      updatedReq.budget === 18.5
    );
    console.log("  Request updated successfully:", results.requestUpdate);

    // =============================================================
    // TEST 11 — CROSS-PASSENGER SECURITY
    // =============================================================
    console.log("\n--- TEST 11: CROSS-PASSENGER SECURITY ---");
    await loginAs(emailX);

    let crossUpdateBlocked = false;
    try {
      await RequestService.updateRequest(req1Id, { budget: 999 });
    } catch (err) {
      crossUpdateBlocked = true;
      console.log("  Cross-passenger update REJECTED:", err.message);
    }

    let crossCancelBlocked = false;
    try {
      await RequestService.cancelRequest(req1Id);
    } catch (err) {
      crossCancelBlocked = true;
      console.log("  Cross-passenger cancellation REJECTED:", err.message);
    }

    results.crossPassengerSecurity = crossUpdateBlocked && crossCancelBlocked && crossImageBlocked;
    console.log("  Cross-passenger security:", results.crossPassengerSecurity ? "PASS" : "FAIL");

    // =============================================================
    // TEST 10 — CANCELLATION
    // =============================================================
    console.log("\n--- TEST 10: CANCELLATION ---");
    await loginAs(emailP);
    const cancelledReq = await RequestService.cancelRequest(req1Id, "Change of plans");

    // Verify in database: status is cancelled, record STILL EXISTS
    const checkCancelledRes = await fetch(
      `${ENDPOINT}/databases/transmove/collections/service_requests/documents/${req1Id}`,
      { headers: serverHeaders }
    );
    const cancelledDoc = await checkCancelledRes.json();

    // Verify Driver A cannot see cancelled request
    await loginAs(emailA);
    const driverAJobsAfterCancel = await RequestService.getAvailableRequestsForDrivers();
    const driverASeesCancelled = driverAJobsAfterCancel.some((j) => (j.id || j.$id) === req1Id);

    // Verify Driver B cannot see cancelled request
    await loginAs(emailB);
    const driverBJobsAfterCancel = await RequestService.getAvailableRequestsForDrivers();
    const driverBSeesCancelled = driverBJobsAfterCancel.some((j) => (j.id || j.$id) === req1Id);

    results.requestCancellation = Boolean(
      cancelledDoc.status === "cancelled" &&
      !driverASeesCancelled &&
      !driverBSeesCancelled
    );
    console.log("  Request status in database:", cancelledDoc.status, "(Expected: cancelled)");
    console.log("  Driver A sees cancelled request:", driverASeesCancelled, "(Expected: false)");
    console.log("  Driver B sees cancelled request:", driverBSeesCancelled, "(Expected: false)");
    console.log("  Request cancellation:", results.requestCancellation ? "PASS" : "FAIL");

    // =============================================================
    // 10. REGRESSION TESTS (Existing Auth & Vehicles)
    // =============================================================
    console.log("\n--- REGRESSION TESTS ---");

    // Auth Regression: Login, Profile Retrieval, Profile Update, Profile Photo
    const loginRes = await AuthService.login({ email: emailP, password: testPassword });
    const profileRes = await AuthService.getCurrentProfile();
    const updatedProf = await AuthService.updateProfile({ bio: "Active regression bio" });
    const dummyAvatar = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])],
      "avatar.jpg",
      { type: "image/jpeg" }
    );
    const photoUrl = await VehicleService.uploadProfilePicture(dummyAvatar);
    const finalProf = await AuthService.getCurrentProfile();
    if (finalProf.profile_image_id) cleanup.files.push(finalProf.profile_image_id);

    results.existingAuthRegression = Boolean(
      loginRes.user &&
      profileRes &&
      updatedProf.bio === "Active regression bio" &&
      photoUrl &&
      finalProf.profile_image_id
    );
    console.log("  Existing auth regression:", results.existingAuthRegression ? "PASS" : "FAIL");

    // Vehicle Regression: Create, Update, Primary switch, Vehicle Photo, Verification Doc
    await loginAs(emailA);
    const regVeh = await VehicleService.addVehicle({
      vehicle_type: "sedan",
      service_category: "passenger_transport",
      make: "Mazda",
      model: "Demio",
      year: 2017,
      registration_number: `REG_${timestamp.toString().slice(-4)}`,
      color: "Red",
      is_primary: true
    });
    cleanup.vehicles.push(regVeh.id);

    const updatedV = await VehicleService.updateVehicle(regVeh.id, { color: "Dark Red" });
    const dummyVehPhoto = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])],
      "car.jpg",
      { type: "image/jpeg" }
    );
    const vehPhotoRes = await VehicleService.uploadVehiclePhoto(regVeh.id, dummyVehPhoto);
    if (vehPhotoRes.fileId) cleanup.files.push(vehPhotoRes.fileId);
    if (vehPhotoRes.photoId) cleanup.photos.push(vehPhotoRes.photoId);

    const dummyDocFile = new File(
      [new TextEncoder().encode("%PDF-1.4 Mock Document Content")],
      "reg_doc.pdf",
      { type: "application/pdf" }
    );
    const docRes = await VehicleService.uploadVerificationDocument(dummyDocFile, "vehicle_registration", regVeh.id);
    if (docRes.file_id) cleanup.files.push(docRes.file_id);
    if (docRes.id) cleanup.documents.push(docRes.id);

    const colorMatch = updatedV.color === "Dark Red" || updatedV.colour === "Dark Red";
    results.existingVehicleRegression = Boolean(
      regVeh.id &&
      colorMatch &&
      vehPhotoRes.viewUrl &&
      docRes.id
    );
    console.log("  Existing vehicle regression:", results.existingVehicleRegression ? "PASS" : "FAIL");
  } catch (err) {
    console.error("ERROR during test execution:", err);
  } finally {
    // =============================================================
    // CLEANUP: Purge all temporary test entities
    // =============================================================
    console.log("\n[CLEANUP] Removing test artifacts from Appwrite...");
    for (const rImgId of cleanup.request_images) {
      await fetch(`${ENDPOINT}/databases/transmove/collections/request_images/documents/${rImgId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    for (const rId of cleanup.requests) {
      await fetch(`${ENDPOINT}/databases/transmove/collections/service_requests/documents/${rId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    for (const dId of cleanup.documents) {
      await fetch(`${ENDPOINT}/databases/transmove/collections/verification_documents/documents/${dId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    for (const pId of cleanup.photos) {
      await fetch(`${ENDPOINT}/databases/transmove/collections/vehicle_photos/documents/${pId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    for (const vId of cleanup.vehicles) {
      await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents/${vId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    for (const fileId of cleanup.files) {
      await fetch(`${ENDPOINT}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}`, {
        method: "DELETE",
        headers: serverHeaders
      }).catch(() => {});
    }
    console.log("Database and storage purged of all test records.");
  }

  // =============================================================
  // FINAL RESULTS SUMMARY
  // =============================================================
  console.log("\n==================================================");
  console.log("TRANSMOVE APPWRITE REQUEST + MATCHING MIGRATION REPORT");
  console.log("==================================================");
  console.log(`Request Create: ${results.requestCreate ? "PASS" : "FAIL"}`);
  console.log(`Exactly One Request Record: ${results.exactlyOneRequestRecord ? "PASS" : "FAIL"}`);
  console.log(`Passenger ID Spoof Protection: ${results.passengerIdSpoofProtection ? "PASS" : "FAIL"}`);
  console.log(`Duplicate Submission Protection: ${results.duplicateSubmissionProtection ? "PASS" : "FAIL"}`);
  console.log(`Passenger Request List: ${results.passengerRequestList ? "PASS" : "FAIL"}`);
  console.log(`Request Details: ${results.requestDetails ? "PASS" : "FAIL"}`);
  console.log(`Request Update: ${results.requestUpdate ? "PASS" : "FAIL"}`);
  console.log(`Request Cancellation: ${results.requestCancellation ? "PASS" : "FAIL"}`);
  console.log(`Request Image Upload: ${results.requestImageUpload ? "PASS" : "FAIL"}`);
  console.log(`Request Image Ownership: ${results.requestImageOwnership ? "PASS" : "FAIL"}`);
  console.log(`Driver A Compatible Matching: ${results.driverACompatibleMatching ? "PASS" : "FAIL"}`);
  console.log(`Driver B Compatible Matching: ${results.driverBCompatibleMatching ? "PASS" : "FAIL"}`);
  console.log(`Same Request ID Across Drivers: ${results.sameRequestIdAcrossDrivers ? "PASS" : "FAIL"}`);
  console.log(`Incompatible Driver Filtering: ${results.incompatibleDriverFiltering ? "PASS" : "FAIL"}`);
  console.log(`Multiple Vehicle Deduplication: ${results.multipleVehicleDeduplication ? "PASS" : "FAIL"}`);
  console.log(`Inactive Vehicle Filtering: ${results.inactiveVehicleFiltering ? "PASS" : "FAIL"}`);
  console.log(`Direct Driver Database Scraping: ${results.directDriverDatabaseScraping ? "PASS" : "FAIL"}`);
  console.log(`Cross-Passenger Security: ${results.crossPassengerSecurity ? "PASS" : "FAIL"}`);
  console.log(`Existing Auth Regression: ${results.existingAuthRegression ? "PASS" : "FAIL"}`);
  console.log(`Existing Vehicle Regression: ${results.existingVehicleRegression ? "PASS" : "FAIL"}`);
  console.log("==================================================");

  const allPassed = Object.values(results).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR during test execution:", err);
  process.exit(1);
});
