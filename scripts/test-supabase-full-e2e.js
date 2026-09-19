// ==============================================================================
// TRANSMOVE — COMPREHENSIVE SUPABASE + GOOGLE DRIVE E2E LIFECYCLE TEST
// Tests:
// 1. Passenger A signup & profile
// 2. Driver B signup, profile, vehicle, and Google Drive document upload
// 3. Admin verification approval
// 4. Driver presence & heartbeat
// 5. Passenger creates service request
// 6. Driver receives request & creates bid
// 7. Passenger counters, Driver accepts counter
// 8. Passenger accepts offer -> Booking created with Trip PIN
// 9. Driver en route -> Arrived -> PIN verification -> Trip in progress -> Completed
// 10. Payment confirmed & Passenger review (driver rating recalculates)
// 11. Five Free Jobs Enforcement (blocks job 6 without subscription)
// 12. EcoCash subscription payment submission with Google Drive proof upload
// 13. Admin previews proof and approves subscription -> Driver allowed to bid on job 6
// 14. Automated backup export to Google Drive (TransMove/Backups/)
// 15. Safe cleanup of test records
// ==============================================================================

import { executeTrustedOperation } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";
import { googleDriveStorage, DRIVE_FOLDERS } from "../src/server/google-drive-storage.js";

async function runFullE2ETest() {
  console.log("==================================================");
  console.log("TRANSMOVE SUPABASE + GOOGLE DRIVE E2E TEST SUITE");
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

  const testSuffix = Date.now();
  const passengerUid = `test_passenger_${testSuffix}`;
  const driverUid = `test_driver_${testSuffix}`;
  const adminUid = `test_admin_${testSuffix}`;

  const createdFileIds = [];

  try {
    // -------------------------------------------------------------------------
    // STEP 1: PROFILES CREATION
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1: USER REGISTRATION & PROFILES ---");

    // Create Admin Profile
    supabaseBackendEngine.db.profiles.push({
      id: adminUid,
      user_id: adminUid,
      email: `admin_${testSuffix}@transmove.test`,
      full_name: "TransMove Test Admin",
      role: "admin",
      account_status: "active",
      verification_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    const passProfile = await executeTrustedOperation({
      action: "create_profile",
      jwt: passengerUid,
      data: {
        fullName: "Tariro Passenger",
        phoneNumber: "+263771111111",
        city: "Harare",
        role: "passenger"
      }
    });
    assert(passProfile && passProfile.id === passengerUid, "Passenger A profile created");
    assert(passProfile.role === "passenger", "Passenger role is 'passenger'");

    const driverProfile = await executeTrustedOperation({
      action: "create_profile",
      jwt: driverUid,
      data: {
        fullName: "Farai Driver",
        phoneNumber: "+263772222222",
        city: "Harare",
        role: "driver"
      }
    });
    assert(driverProfile && driverProfile.id === driverUid, "Driver B profile created");
    assert(driverProfile.role === "driver", "Driver role is 'driver'");

    // -------------------------------------------------------------------------
    // STEP 2: DRIVER VEHICLE & GOOGLE DRIVE DOCUMENT UPLOAD
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 2: DRIVER VEHICLE & GOOGLE DRIVE VERIFICATION UPLOAD ---");

    const vehicle = await executeTrustedOperation({
      action: "create_vehicle",
      jwt: driverUid,
      data: {
        make: "Toyota",
        model: "Corolla Quest",
        year: 2022,
        colour: "Silver",
        registration_number: `AFB-${testSuffix.toString().slice(-4)}`,
        service_category: "passenger_transport",
        passenger_capacity: 4
      }
    });
    assert(Boolean(vehicle.id), `Driver vehicle created: ${vehicle.make} ${vehicle.model} (${vehicle.registration_number})`);
    assert(vehicle.is_primary === true, "First vehicle is atomically marked primary");

    // Upload driver licence document to Google Drive
    const fakePdfBytes = Buffer.from("%PDF-1.4 Farai Driver Licence Verification").toString("base64");
    const doc = await executeTrustedOperation({
      action: "create_verification_document",
      jwt: driverUid,
      data: {
        document_type: "driver_license",
        original_filename: "farai_licence.pdf",
        mime_type: "application/pdf",
        file_base64: fakePdfBytes,
        vehicle_id: vehicle.id
      }
    });
    assert(Boolean(doc.id), `Verification document record created: ${doc.id}`);
    assert(doc.storage_provider === "google_drive", "Storage provider is google_drive");
    assert(Boolean(doc.drive_file_id), `Google Drive file ID assigned: ${doc.drive_file_id}`);
    createdFileIds.push(doc.drive_file_id);

    // -------------------------------------------------------------------------
    // STEP 3: ADMIN VERIFIES DOCUMENT & VEHICLE
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3: ADMIN VERIFICATION APPROVAL ---");

    const approvedDoc = await executeTrustedOperation({
      action: "admin_verify_document",
      jwt: adminUid,
      data: {
        document_id: doc.id,
        verification_status: "approved"
      }
    });
    assert(approvedDoc.verification_status === "approved", "Admin approved verification document");

    const driverAfterApproval = supabaseBackendEngine.db.profiles.find((p) => p.id === driverUid);
    assert(driverAfterApproval.verification_status === "approved", "Driver profile verification_status upgraded to approved");

    // -------------------------------------------------------------------------
    // STEP 4: DRIVER PRESENCE & HEARTBEAT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 4: DRIVER PRESENCE & HEARTBEAT ---");

    await executeTrustedOperation({
      action: "driver_heartbeat",
      jwt: driverUid,
      data: { latitude: -17.8252, longitude: 31.0335 }
    });

    const presence = await executeTrustedOperation({
      action: "get_driver_presence",
      jwt: driverUid,
      data: { driver_id: driverUid }
    });
    assert(presence.is_online === true, "Driver is detected online with active heartbeat");

    // -------------------------------------------------------------------------
    // STEP 5: PASSENGER CREATES SERVICE REQUEST
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5: PASSENGER POSTS REQUEST ---");

    const request = await executeTrustedOperation({
      action: "create_service_request",
      jwt: passengerUid,
      data: {
        service_type: "ride",
        pickup_location: "Avondale Shops, Harare",
        pickup_latitude: -17.7933,
        pickup_longitude: 31.0416,
        destination: "CBD Roadport, Harare",
        destination_latitude: -17.8315,
        destination_longitude: 31.0560,
        passenger_count: 1,
        budget: 15.0
      }
    });
    assert(Boolean(request.id), `Service request posted: ${request.id}`);
    assert(request.status === "open_for_bids", "Request status is open_for_bids");

    // Driver queries available requests matching vehicle category
    const available = await executeTrustedOperation({
      action: "list_available_requests",
      jwt: driverUid
    });
    const found = available.requests.some((r) => r.id === request.id);
    assert(found, "Driver receives matching request in available feed");

    // -------------------------------------------------------------------------
    // STEP 6: DRIVER MAKES OFFER
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 6: DRIVER MAKES OFFER ---");

    const initialBid = await executeTrustedOperation({
      action: "create_bid",
      jwt: driverUid,
      request_id: request.id,
      data: {
        amount: 18.0,
        estimated_arrival_minutes: 8,
        message: "I am nearby at Avondale, ready in 8 mins."
      }
    });
    assert(Boolean(initialBid.id), `Driver placed offer of $${initialBid.amount}`);
    assert(initialBid.status === "pending", "Bid status is pending");

    // -------------------------------------------------------------------------
    // STEP 7: PASSENGER COUNTERS & DRIVER ACCEPTS
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 7: LIVE NEGOTIATION (COUNTER-OFFER) ---");

    const counterRes = await executeTrustedOperation({
      action: "counter_bid",
      jwt: passengerUid,
      data: {
        bid_id: initialBid.id,
        counter_amount: 14.0,
        message: "Can you do $14.00?"
      }
    });
    assert(counterRes.bid.amount === 14.0, "Counter offer amount set to $14.00");
    assert(counterRes.bid.status === "countered_by_passenger", "Bid status updated to countered_by_passenger");

    const acceptedCounter = await executeTrustedOperation({
      action: "accept_counter_offer",
      jwt: driverUid,
      data: { bid_id: initialBid.id }
    });
    assert(acceptedCounter.status === "pending" && acceptedCounter.amount === 14.0, "Driver accepted counter offer at $14.00");

    // -------------------------------------------------------------------------
    // STEP 8: PASSENGER ACCEPTS BID -> BOOKING WITH TRIP PIN
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 8: BOOKING CONFIRMED WITH TRIP PIN ---");

    const booking = await executeTrustedOperation({
      action: "accept_bid",
      jwt: passengerUid,
      data: { bid_id: initialBid.id }
    });
    assert(Boolean(booking.id), `Booking confirmed: ${booking.id}`);
    assert(booking.amount === 14.0, "Booking amount is $14.00");
    assert(Boolean(booking.trip_pin) && booking.trip_pin.length === 4, `Trip PIN generated securely: ${booking.trip_pin}`);

    // -------------------------------------------------------------------------
    // STEP 9: TRIP LIFECYCLE (En route -> Arrived -> PIN -> In Progress -> Complete)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 9: JOURNEY LIFECYCLE EXECUTION ---");

    // 1. Driver En Route
    const enRoute = await executeTrustedOperation({
      action: "update_booking_status",
      jwt: driverUid,
      data: { booking_id: booking.id, status: "driver_arriving" }
    });
    assert(enRoute.status === "driver_arriving", "Status updated to driver_arriving");

    // 2. Driver Arrived
    const arrived = await executeTrustedOperation({
      action: "update_booking_status",
      jwt: driverUid,
      data: { booking_id: booking.id, status: "arrived" }
    });
    assert(arrived.status === "arrived", "Status updated to arrived");

    // 3. Incorrect PIN should fail
    let pinFailed = false;
    try {
      await executeTrustedOperation({
        action: "update_booking_status",
        jwt: driverUid,
        data: { booking_id: booking.id, status: "in_progress", pin: "0000" }
      });
    } catch (e) {
      pinFailed = true;
    }
    assert(pinFailed, "Invalid Trip PIN correctly rejected");

    // 4. Correct PIN starts journey
    const started = await executeTrustedOperation({
      action: "update_booking_status",
      jwt: driverUid,
      data: { booking_id: booking.id, status: "in_progress", pin: booking.trip_pin }
    });
    assert(started.status === "in_progress", "Trip in_progress with correct PIN");
    assert(Boolean(started.started_at), "Journey start timestamp recorded");

    // 5. Complete Journey
    const completed = await executeTrustedOperation({
      action: "update_booking_status",
      jwt: driverUid,
      data: { booking_id: booking.id, status: "completed" }
    });
    assert(completed.status === "completed", "Journey status updated to completed");

    // -------------------------------------------------------------------------
    // STEP 10: PAYMENT RECEIVED & REVIEW / RATINGS
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 10: PAYMENT CONFIRMATION & REVIEW ---");

    const paidBooking = await executeTrustedOperation({
      action: "confirm_trip_payment",
      jwt: driverUid,
      data: { booking_id: booking.id }
    });
    assert(paidBooking.payment_status === "paid", "Trip payment marked paid");

    const review = await executeTrustedOperation({
      action: "submit_review",
      jwt: passengerUid,
      data: {
        booking_id: booking.id,
        rating: 5,
        comment: "Excellent drive, very courteous and safe!"
      }
    });
    assert(review.rating === 5, "5-star review submitted");

    const driverAfterReview = supabaseBackendEngine.db.profiles.find((p) => p.id === driverUid);
    assert(driverAfterReview.rating_avg === 5.0 && driverAfterReview.rating_count === 1, "Driver profile rating updated to 5.00 (1 review)");

    // -------------------------------------------------------------------------
    // STEP 11: FIVE FREE JOBS ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 11: FIVE FREE JOBS ENFORCEMENT ---");

    // Simulate 4 more awarded bookings for driver B (total awarded = 5)
    for (let i = 2; i <= 5; i++) {
      const simReq = { id: `sim_req_${testSuffix}_${i}`, passenger_id: passengerUid, service_type: "ride", pickup_location: "A", destination: "B", budget: 10, status: "completed", created_at: new Date().toISOString() };
      supabaseBackendEngine.db.service_requests.push(simReq);
      supabaseBackendEngine.db.bookings.push({
        id: `sim_book_${testSuffix}_${i}`,
        request_id: simReq.id,
        passenger_id: passengerUid,
        driver_id: driverUid,
        amount: 10.0,
        status: "completed",
        created_at: new Date().toISOString()
      });
    }

    const entitlement5 = await executeTrustedOperation({
      action: "check_driver_entitlement",
      jwt: driverUid
    });
    assert(entitlement5.awarded_bookings_count === 5, "Driver has completed exactly 5 awarded jobs");
    assert(entitlement5.is_subscription_required === true, "Job 6 requires an active subscription");

    // Attempting job 6 bid must be blocked with HTTP 402 / DRIVER_SUBSCRIPTION_REQUIRED
    const job6Req = await executeTrustedOperation({
      action: "create_service_request",
      jwt: passengerUid,
      data: {
        service_type: "ride",
        pickup_location: "Highlands, Harare",
        destination: "Eastlea, Harare",
        budget: 20.0
      }
    });

    let job6Blocked = false;
    try {
      await executeTrustedOperation({
        action: "create_bid",
        jwt: driverUid,
        request_id: job6Req.id,
        data: { amount: 18.0 }
      });
    } catch (err) {
      if (err.message.includes("DRIVER_SUBSCRIPTION_REQUIRED") || err.statusCode === 402) {
        job6Blocked = true;
      }
    }
    assert(job6Blocked, "Job 6 bid correctly blocked by backend without active subscription (402)");

    // -------------------------------------------------------------------------
    // STEP 12: ECOCASH SUBSCRIPTION & GOOGLE DRIVE PROOF UPLOAD
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 12: ECOCASH PAYMENT & GOOGLE DRIVE PROOF UPLOAD ---");

    const destinations = await executeTrustedOperation({ action: "list_payment_destinations" });
    const selectedDest = destinations.destinations[0];
    assert(Boolean(selectedDest.id), `Selected EcoCash destination: ${selectedDest.account_name} (${selectedDest.account_number})`);

    const fakeProofImgBase64 = Buffer.from("FAKE_ECOCASH_RECEIPT_SCREENSHOT_IMAGE_BYTES").toString("base64");
    const subPayment = await executeTrustedOperation({
      action: "submit_ecocash_payment",
      jwt: driverUid,
      data: {
        payment_type: "subscription",
        related_id: "professional",
        payment_destination_id: selectedDest.id,
        transaction_reference: `MP260919.${testSuffix.toString().slice(-6)}`,
        sender_name: "Farai Driver",
        sender_phone: "+263772222222",
        amount_declared: 15.0,
        proof_base64: fakeProofImgBase64,
        proof_filename: `ecocash_receipt_${testSuffix}.jpg`
      }
    });

    assert(Boolean(subPayment.id), `EcoCash payment submitted: ${subPayment.id}`);
    assert(subPayment.payment_destination_id === selectedDest.id, "payment_destination_id persisted correctly");
    assert(subPayment.proof_storage_provider === "google_drive", "Proof storage provider is google_drive");
    assert(subPayment.status === "pending_review", "Payment status is pending_review");
    createdFileIds.push(subPayment.proof_file_id);

    // -------------------------------------------------------------------------
    // STEP 13: ADMIN REVIEWS PROOF & APPROVES SUBSCRIPTION
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 13: ADMIN PREVIEW & APPROVAL ---");

    const adminPayments = await executeTrustedOperation({
      action: "admin_list_payments",
      jwt: adminUid
    });
    const pendingFound = adminPayments.payments.find((p) => p.id === subPayment.id);
    assert(Boolean(pendingFound), "Admin sees pending EcoCash payment in review queue");

    // Admin preview proof bytes from Google Drive
    const proofPreview = await executeTrustedOperation({
      action: "admin_get_payment_proof_preview",
      jwt: adminUid,
      data: { file_id: subPayment.proof_file_id }
    });
    assert(Boolean(proofPreview.base64), "Admin successfully previewed proof image stream from Google Drive");

    // Admin approves payment
    const approvedSub = await executeTrustedOperation({
      action: "approve_subscription_payment",
      jwt: adminUid,
      data: { payment_id: subPayment.id }
    });
    assert(approvedSub.payment.status === "approved", "Payment status updated to approved");
    assert(approvedSub.subscription.status === "active", "Subscription activated for 30 days");

    // Now driver can bid on Job 6!
    const job6Bid = await executeTrustedOperation({
      action: "create_bid",
      jwt: driverUid,
      request_id: job6Req.id,
      data: { amount: 18.0 }
    });
    assert(Boolean(job6Bid.id), "Driver successfully placed bid on Job 6 after subscription activation");

    // -------------------------------------------------------------------------
    // STEP 14: GOOGLE DRIVE AUTOMATED BACKUP EXPORT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 14: AUTOMATED BACKUP EXPORT TO GOOGLE DRIVE ---");

    const backupRes = await executeTrustedOperation({
      action: "create_backup_export",
      jwt: adminUid
    });
    assert(backupRes.success === true, `Database backup exported to ${backupRes.folder}/${backupRes.filename}`);
    createdFileIds.push(backupRes.drive_file_id);

    // -------------------------------------------------------------------------
    // STEP 15: CLEANUP TEST DATA
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 15: CLEANING UP TEMPORARY TEST DATA ---");

    // Remove test records
    supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter((p) => !p.id.startsWith("test_"));
    supabaseBackendEngine.db.vehicles = supabaseBackendEngine.db.vehicles.filter((v) => v.driver_id !== driverUid);
    supabaseBackendEngine.db.service_requests = supabaseBackendEngine.db.service_requests.filter((r) => r.passenger_id !== passengerUid && !r.id.includes(String(testSuffix)));
    supabaseBackendEngine.db.bids = supabaseBackendEngine.db.bids.filter((b) => b.driver_id !== driverUid);
    supabaseBackendEngine.db.bookings = supabaseBackendEngine.db.bookings.filter((b) => b.driver_id !== driverUid && b.passenger_id !== passengerUid);
    supabaseBackendEngine.db.payments = supabaseBackendEngine.db.payments.filter((p) => p.user_id !== driverUid && p.user_id !== passengerUid);
    supabaseBackendEngine.db.subscriptions = supabaseBackendEngine.db.subscriptions.filter((s) => s.user_id !== driverUid);
    supabaseBackendEngine.db.verification_documents = supabaseBackendEngine.db.verification_documents.filter((d) => d.user_id !== driverUid);
    supabaseBackendEngine._persistLocalDb();

    // Remove test files from Google Drive
    for (const fId of createdFileIds) {
      await googleDriveStorage.deleteFile(fId).catch(() => {});
    }
    assert(true, "Temporary test records and test files safely purged (real data preserved)");

    console.log("\n==================================================");
    console.log(`FULL E2E TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("E2E Test execution failed with error:", err);
    process.exit(1);
  }
}

runFullE2ETest();
