// Real two-party negotiated-fare lifecycle using the existing stable test actors.
// Creates only journey documents and removes every created row on completion.
const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, value) => storageMap.set(key, value),
    removeItem: (key) => storageMap.delete(key)
  },
  location: { origin: "http://localhost:8080", hash: "", search: "" },
  console
};

import fs from "fs";
import path from "path";
import { AuthService } from "../src/services/auth.js";
import { getAppwriteAccount } from "../src/config/appwrite.js";
import { executeTrustedOperation } from "../netlify/functions/trusted-api.js";

const config = {};
fs.readFileSync(path.resolve(".env.appwrite.setup"), "utf8").split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) config[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const endpoint = String(config.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1").replace(/\/$/, "");
const projectId = config.APPWRITE_PROJECT_ID || "6aaa6531003d5747b640";
const apiKey = config.APPWRITE_API_KEY;
const databaseId = "transmove";
const password = "T3stP@ssword2026!#";
const serverHeaders = {
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
  "Content-Type": "application/json"
};

const created = { request: null, bid: null, booking: null };
const results = [];

function check(name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  results.push(name);
  console.log(`PASS ${name}`);
}

async function login(email) {
  storageMap.clear();
  const auth = await AuthService.login({ email, password });
  const jwt = (await getAppwriteAccount().createJWT()).jwt;
  return { user: auth.user, jwt };
}

async function trusted(jwt, action, data = {}) {
  return executeTrustedOperation({ jwt, action, data });
}

function equalQuery(attribute, value) {
  return encodeURIComponent(JSON.stringify({ method: "equal", attribute, values: [value] }));
}

async function listBy(collection, attribute, value) {
  const response = await fetch(
    `${endpoint}/databases/${databaseId}/collections/${collection}/documents?queries[]=${equalQuery(attribute, value)}`,
    { headers: serverHeaders }
  );
  if (!response.ok) throw new Error(`Cleanup discovery failed for ${collection}: HTTP ${response.status}`);
  return (await response.json()).documents || [];
}

async function remove(collection, id) {
  if (!id) return;
  const response = await fetch(
    `${endpoint}/databases/${databaseId}/collections/${collection}/documents/${id}`,
    { method: "DELETE", headers: serverHeaders }
  );
  if (![200, 204, 404].includes(response.status)) {
    throw new Error(`Cleanup failed for ${collection}/${id}: HTTP ${response.status}`);
  }
}

async function cleanup() {
  const relatedIds = [created.request, created.bid, created.booking].filter(Boolean);
  for (const collection of ["notifications", "activity_logs"]) {
    const found = [];
    for (const id of relatedIds) found.push(...await listBy(collection, "related_id", id));
    for (const doc of new Map(found.map((doc) => [doc.$id, doc])).values()) {
      await remove(collection, doc.$id);
    }
  }
  if (created.booking) {
    for (const event of await listBy("booking_events", "booking_id", created.booking)) {
      await remove("booking_events", event.$id);
    }
  }
  await remove("bookings", created.booking);
  await remove("bids", created.bid);
  await remove("service_requests", created.request);
}

async function run() {
  try {
    const passenger = await login("bid.test.pass.p@tm.test");
    const driver = await login("bid.test.drv.a@tm.test");
    check("distinct passenger and driver sessions", passenger.user.$id !== driver.user.$id, "accounts resolved to the same user");

    const entitlement = await trusted(driver.jwt, "check_driver_entitlement", {});
    check("driver can bid", entitlement.can_bid === true, "test driver is not entitled to bid");

    const request = await trusted(passenger.jwt, "create_service_request", {
      service_type: "ride",
      pickup_location: "MSU Batanai Campus",
      destination: "Southdowns, Gweru",
      pickup_latitude: -19.4521,
      pickup_longitude: 29.8174,
      destination_latitude: -19.4781,
      destination_longitude: 29.8049,
      budget: 10,
      passenger_count: 1,
      details: "Shared responsive UI negotiated-fare acceptance test"
    });
    created.request = request.$id || request.id;
    check("passenger request $10", Boolean(created.request) && Number(request.budget) === 10, "request was not created at $10");

    const bid = await trusted(driver.jwt, "create_bid", {
      request_id: created.request,
      proposed_price: 12,
      estimated_arrival_mins: 8,
      message: "I can pick you up shortly"
    });
    created.bid = bid.$id || bid.id;
    check("driver offer $12", Boolean(created.bid) && Number(bid.amount) === 12, "driver offer was not $12");

    const visible = await trusted(passenger.jwt, "list_bids_for_request", { request_id: created.request });
    check("passenger sees driver offer", visible.bids?.some((item) => (item.$id || item.id) === created.bid), "offer missing from passenger comparison");

    const passengerCounter = await trusted(passenger.jwt, "counter_bid", {
      bid_id: created.bid,
      counter_amount: 11,
      message: "Can you do $11?"
    });
    check("passenger counter $11", passengerCounter.bid?.negotiation_status === "countered_by_passenger" && Number(passengerCounter.bid?.counter_amount) === 11, "passenger counter was not recorded");

    const driverCounter = await trusted(driver.jwt, "counter_bid", {
      bid_id: created.bid,
      counter_amount: 11.5,
      message: "$11.50 and I can leave now"
    });
    check("driver counter $11.50", driverCounter.bid?.negotiation_status === "countered_by_driver" && Number(driverCounter.bid?.counter_amount) === 11.5, "driver counter was not recorded");

    const agreed = await trusted(passenger.jwt, "accept_counter_offer", { bid_id: created.bid });
    check("passenger accepts negotiated $11.50", agreed.bid?.negotiation_status === "accepted" && Number(agreed.amount) === 11.5, "negotiated amount was not accepted");

    const accepted = await trusted(passenger.jwt, "accept_bid", { bid_id: created.bid });
    created.booking = accepted.booking?.$id || accepted.booking?.id || accepted.bookingId;
    const tripPin = String(accepted.booking?.trip_pin || "");
    check("booking confirmed at $11.50", accepted.success === true && Boolean(created.booking) && Number(accepted.booking?.amount) === 11.5, "booking did not preserve the agreed fare");
    check("passenger receives 4-digit Trip PIN", /^\d{4}$/.test(tripPin), "Trip PIN missing or invalid");

    const driverView = await trusted(driver.jwt, "get_driver_bookings", {});
    const protectedBooking = driverView.bookings?.find((item) => (item.$id || item.id) === created.booking);
    check("Trip PIN hidden from driver", protectedBooking && protectedBooking.trip_pin === undefined, "driver response exposed the Trip PIN");

    await trusted(driver.jwt, "update_booking_status", { booking_id: created.booking, status: "driver_arriving" });
    await trusted(driver.jwt, "update_booking_status", { booking_id: created.booking, status: "arrived" });
    let wrongPinRejected = false;
    try {
      await trusted(driver.jwt, "update_booking_status", { booking_id: created.booking, status: "in_progress", pin: "0000" });
    } catch (error) {
      wrongPinRejected = /invalid trip pin/i.test(error.message);
    }
    check("wrong Trip PIN rejected", wrongPinRejected, "wrong PIN was accepted");
    const started = await trusted(driver.jwt, "update_booking_status", { booking_id: created.booking, status: "in_progress", pin: tripPin });
    check("trip starts with passenger PIN", started.status === "in_progress", "trip did not start");
    const completed = await trusted(driver.jwt, "update_booking_status", { booking_id: created.booking, status: "completed" });
    check("trip completes", completed.status === "completed", "trip did not complete");

    console.log(`NEGOTIATION LIFECYCLE: ${results.length}/${results.length} PASS`);
  } finally {
    await cleanup();
    await AuthService.logout().catch(() => {});
    console.log("CLEANUP PASS");
  }
}

run().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
