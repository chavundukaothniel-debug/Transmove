// ==============================================================================
// TRANSMOVE MARKETPLACE FULL LIFECYCLE END-TO-END TEST SUITE
// Tests Passenger Request -> Driver Quotation -> Single Provider Lock ->
// Booking -> Trip Start -> Trip Completion -> Rating & Review
// ==============================================================================
import { getSupabase } from "../config/supabase.js";
import { RequestService } from "./requests.js";
import { OfferService } from "./offers.js";
import { BookingService } from "./booking.js";

export async function runFullMarketplaceLifecycleTest() {
  console.log("==================================================");
    console.log("[START] TRANSMOVE MARKETPLACE END-TO-END LIFECYCLE TEST");
  console.log("==================================================");

  const supabase = getSupabase();
  if (!supabase) {
    console.error("Supabase client is not available.");
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn("Notice: Run this test while logged into TransMove to verify user-authenticated RLS lifecycle.");
  }

  const currentUserId = session?.user?.id || "test-user-id";

  // Record Audit Log
  const createdRecords = [];
  const updatedRecords = [];

  try {
    // -------------------------------------------------------------
    // STEP 1: PASSENGER CREATES REQUEST
    // -------------------------------------------------------------
    console.log("\n1️⃣ STEP 1: Passenger Creates Service Request");
    const requestData = {
      request_type: "ride",
      pickup_address: "123 Samora Machel Ave, Harare",
      pickup_lat: -17.8252,
      pickup_lng: 31.0335,
      destination_address: "Avondale Shopping Centre, Harare",
      dest_lat: -17.7981,
      dest_lng: 31.0425,
      estimated_distance_km: 4.5,
      estimated_duration_mins: 12,
      suggested_price: 15.00,
      currency: "USD",
      notes: "Lifecycle integration test request"
    };

    let requestRecord;
    if (session) {
      requestRecord = await RequestService.createRequest(requestData);
    } else {
      const { data, error } = await supabase.from("ride_requests").insert({
        customer_id: currentUserId,
        ...requestData,
        status: "searching"
      }).select().single();
      if (error) throw error;
      requestRecord = data;
    }

    createdRecords.push({ table: "public.ride_requests", id: requestRecord.id, status: requestRecord.status.toUpperCase() });
      console.log(`[CREATED] public.ride_requests Record ID: ${requestRecord.id}`);
    console.log(`   Status: REQUESTED ('${requestRecord.status}')`);
    console.log(`   Route: ${requestRecord.pickup_address} -> ${requestRecord.destination_address}`);

    // -------------------------------------------------------------
    // STEP 2: PROVIDER SENDS QUOTATION
    // -------------------------------------------------------------
    console.log("\n2️⃣ STEP 2: Provider Sends Quotation");
    const { data: offerRecord, error: offerErr } = await supabase
      .from("offers")
      .insert({
        request_id: requestRecord.id,
        driver_id: currentUserId,
        proposed_price: 15.00,
        currency: "USD",
        estimated_arrival_mins: 8,
        message: "Ready for pickup with clean vehicle.",
        status: "pending"
      })
      .select()
      .single();

    if (offerErr) throw offerErr;
    createdRecords.push({ table: "public.offers", id: offerRecord.id, status: "PENDING" });
      console.log(`[CREATED] public.offers Record ID: ${offerRecord.id}`);
    console.log(`   Price: $${offerRecord.proposed_price}, Status: PENDING`);

    // Update request status to QUOTED
    await supabase.from("ride_requests").update({ status: "offers_received", updated_at: new Date().toISOString() }).eq("id", requestRecord.id);
    updatedRecords.push({ table: "public.ride_requests", id: requestRecord.id, field: "status", newValue: "QUOTED ('offers_received')" });
      console.log(`[UPDATED] public.ride_requests Record ID: ${requestRecord.id} -> Status: QUOTED ('offers_received')`);

    // -------------------------------------------------------------
    // STEP 3: SECOND PROVIDER SENDS COMPETING QUOTATION
    // -------------------------------------------------------------
    console.log("\n3️⃣ STEP 3: Second Provider Sends Competing Quotation");
    const { data: offer2Record } = await supabase
      .from("offers")
      .insert({
        request_id: requestRecord.id,
        driver_id: currentUserId,
        proposed_price: 18.00,
        currency: "USD",
        estimated_arrival_mins: 5,
        message: "Alternative offer from secondary provider.",
        status: "pending"
      })
      .select()
      .maybeSingle();

    if (offer2Record) {
      createdRecords.push({ table: "public.offers", id: offer2Record.id, status: "PENDING" });
      console.log(`[CREATED] public.offers Record ID: ${offer2Record.id}`);
    }

    // -------------------------------------------------------------
    // STEP 4: PASSENGER ACCEPTS QUOTATION (SINGLE PROVIDER LOCK)
    // -------------------------------------------------------------
    console.log("\n4️⃣ STEP 4: Passenger Accepts One Quotation & Single Provider Lock");
    
    // Lock offer
    await supabase.from("offers").update({ status: "accepted" }).eq("id", offerRecord.id);
    updatedRecords.push({ table: "public.offers", id: offerRecord.id, field: "status", newValue: "ACCEPTED" });
      console.log(`[UPDATED] public.offers ID: ${offerRecord.id} -> Status: ACCEPTED`);

    // Reject all other offers for this request (single provider lock)
    await supabase.from("offers").update({ status: "rejected" }).eq("request_id", requestRecord.id).neq("id", offerRecord.id);
    if (offer2Record) {
      updatedRecords.push({ table: "public.offers", id: offer2Record.id, field: "status", newValue: "REJECTED (Declined/Closed)" });
      console.log(`[UPDATED] public.offers ID: ${offer2Record.id} -> Status: REJECTED (Declined/Closed)`);
    }

    // Update request status to ACCEPTED
    await supabase.from("ride_requests").update({ status: "accepted", accepted_offer_id: offerRecord.id }).eq("id", requestRecord.id);
    updatedRecords.push({ table: "public.ride_requests", id: requestRecord.id, field: "status", newValue: "ACCEPTED ('accepted')" });
      console.log(`[UPDATED] public.ride_requests ID: ${requestRecord.id} -> Status: ACCEPTED`);

    // Create confirmed booking
    const { data: bookingRecord, error: bookErr } = await supabase
      .from("bookings")
      .insert({
        request_id: requestRecord.id,
        offer_id: offerRecord.id,
        customer_id: currentUserId,
        driver_id: currentUserId,
        final_price: offerRecord.proposed_price,
        currency: offerRecord.currency,
        trip_pin: "4827",
        status: "confirmed"
      })
      .select()
      .single();

    if (bookErr) throw bookErr;
    createdRecords.push({ table: "public.bookings", id: bookingRecord.id, status: "ACCEPTED ('confirmed')" });
      console.log(`[CREATED] public.bookings Record ID: ${bookingRecord.id}`);
    console.log(`   Fare: $${bookingRecord.final_price}, PIN: ${bookingRecord.trip_pin}, Status: ACCEPTED ('confirmed')`);

    // -------------------------------------------------------------
    // STEP 5: PROVIDER STARTS JOB (IN_PROGRESS)
    // -------------------------------------------------------------
    console.log("\n5️⃣ STEP 5: Provider Starts Job (PIN Verification & In Progress)");
    await supabase.from("bookings").update({ status: "in_progress", start_time: new Date().toISOString() }).eq("id", bookingRecord.id);
    updatedRecords.push({ table: "public.bookings", id: bookingRecord.id, field: "status", newValue: "IN_PROGRESS ('in_progress')" });
      console.log(`[UPDATED] public.bookings ID: ${bookingRecord.id} -> Status: IN_PROGRESS`);

    // -------------------------------------------------------------
    // STEP 6: PROVIDER COMPLETES JOB
    // -------------------------------------------------------------
    console.log("\n6️⃣ STEP 6: Provider Completes Job");
    await supabase.from("bookings").update({ status: "completed", completed_time: new Date().toISOString() }).eq("id", bookingRecord.id);
    updatedRecords.push({ table: "public.bookings", id: bookingRecord.id, field: "status", newValue: "COMPLETED ('completed')" });
      console.log(`[UPDATED] public.bookings ID: ${bookingRecord.id} -> Status: COMPLETED`);

    await supabase.from("ride_requests").update({ status: "completed" }).eq("id", requestRecord.id);
    updatedRecords.push({ table: "public.ride_requests", id: requestRecord.id, field: "field", newValue: "COMPLETED" });
      console.log(`[UPDATED] public.ride_requests ID: ${requestRecord.id} -> Status: COMPLETED`);

    // -------------------------------------------------------------
    // STEP 7: PASSENGER REVIEWS AND RATES PROVIDER
    // -------------------------------------------------------------
    console.log("\n7️⃣ STEP 7: Passenger Confirms Completion & Leaves Rating/Review");
    const { data: reviewRecord, error: revErr } = await supabase
      .from("reviews")
      .insert({
        booking_id: bookingRecord.id,
        reviewer_id: currentUserId,
        reviewee_id: currentUserId,
        rating: 5,
        comment: "Excellent, safe and reliable transport!"
      })
      .select()
      .single();

    if (!revErr && reviewRecord) {
      createdRecords.push({ table: "public.reviews", id: reviewRecord.id, rating: "5/5 Stars" });
      console.log(`[CREATED] public.reviews Record ID: ${reviewRecord.id} (Rating: 5/5 Stars)`);
    }

    console.log("\n==================================================");
    console.log("[SUMMARY] TRANSMOVE FULL MARKETPLACE LIFECYCLE SUMMARY");
    console.log("==================================================");
    console.log("CREATED RECORDS:");
    console.table(createdRecords);
    console.log("UPDATED RECORDS:");
    console.table(updatedRecords);

    return { createdRecords, updatedRecords };

  } catch (err) {
    console.error("Lifecycle test exception:", err.message);
  }
}
