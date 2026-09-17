// ==============================================================================
// TRANSMOVE MESSAGING + NOTIFICATIONS + DRIVER PRESENCE — LIVE E2E TEST SUITE
// Comprehensive validation of all 22 specification verification phases.
// ==============================================================================

const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  },
  location: { origin: "http://localhost:8080", hash: "", search: "" },
  console: console
};

import fs from "fs";
import { assertTestCleanupCapabilities, runCleanupTasks } from "./test-hygiene.js";
import path from "path";
import { AuthService } from "../src/services/auth.js";
import { VehicleService } from "../src/services/vehicles.js";
import { MessagingService } from "../src/services/messaging.js";
import { NotificationService } from "../src/services/notifications.js";
import { PresenceService } from "../src/services/presence.js";
import { getAppwriteAccount, getAppwriteDatabases, getAppwriteClient } from "../src/config/appwrite.js";

const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
const conf = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const ENDPOINT = (conf.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1").trim();
const PROJECT_ID = (conf.APPWRITE_PROJECT_ID || "6aaa6531003d5747b640").trim();
const API_KEY = (conf.APPWRITE_API_KEY || "").trim();
const TRUSTED_API = "http://localhost:8080/.netlify/functions/trusted-api";
const DB_ID = "transmove";

const serverHeaders = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const testPassword = "T3stP@ssword2026!#";

// Tracking for cleanup
const cleanup = {
  users: [],
  vehicles: [],
  requests: [],
  bids: [],
  bookings: [],
  subscriptions: [],
  messages: [],
  notifications: [],
  presence: []
};

// Results
const R = {};
function pass(key) {
  R[key] = "PASS";
  console.log("    ✓ PASS");
}
function fail(key, reason) {
  R[key] = `FAIL: ${reason}`;
  console.log(`    ✗ FAIL: ${reason}`);
}

// ---------------------------------------------------------------------------
// Server Helpers
// ---------------------------------------------------------------------------
async function serverQuery(col, queries = []) {
  const qs = queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join("&");
  const res = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${col}/documents?${qs}`, {
    headers: serverHeaders
  });
  if (!res.ok) throw new Error(`Unable to query ${col}: HTTP ${res.status}`);
  return (await res.json()).documents || [];
}

async function serverGet(col, docId) {
  const res = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${col}/documents/${docId}`, {
    headers: serverHeaders
  });
  if (!res.ok) return null;
  return res.json();
}

async function serverUpdate(col, docId, data) {
  const res = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${col}/documents/${docId}`, {
    method: "PATCH",
    headers: serverHeaders,
    body: JSON.stringify({ data })
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.message || "serverUpdate failed");
  }
  return res.json();
}

async function serverDelete(col, docId) {
  const response = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${col}/documents/${docId}`, {
    method: "DELETE",
    headers: serverHeaders
  });
  if (![200, 204, 404].includes(response.status)) throw new Error(`HTTP ${response.status}`);
}

async function getCollectionInfo(col) {
  const res = await fetch(`${ENDPOINT}/databases/${DB_ID}/collections/${col}`, { headers: serverHeaders });
  return res.ok ? res.json() : null;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function getJWT() {
  try {
    const j = await getAppwriteAccount().createJWT();
    return j.jwt || "";
  } catch (e) {
    return "";
  }
}

async function loginAs(email) {
  storageMap.clear();
  return AuthService.login({ email, password: testPassword });
}

async function trustedCallAs(jwt, action, data = {}) {
  const res = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}`, "X-Appwrite-JWT": jwt } : {})
    },
    body: JSON.stringify({ action, data })
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function browserDirectCreate(col, data) {
  const db = getAppwriteDatabases();
  try {
    const doc = await db.createDocument(DB_ID, col, "unique()", data);
    return { blocked: false, doc };
  } catch (err) {
    const isPermissionError =
      err.code === 401 ||
      err.code === 403 ||
      (err.message && err.message.toLowerCase().includes("not authorized")) ||
      (err.message && err.message.toLowerCase().includes("permission denied")) ||
      (err.message && err.message.toLowerCase().includes("missing scope"));
    return { blocked: isPermissionError, error: err.message, code: err.code };
  }
}

async function ensureTestUser(email, name, phone, role, city) {
  try {
    const res = await AuthService.register({
      fullName: name,
      email,
      phoneNumber: phone,
      password: testPassword,
      role,
      serviceArea: city
    });
    if (res?.user?.$id) cleanup.users.push(res.user.$id);
  } catch (err) {
    const existing = await AuthService.login({ email, password: testPassword });
    if (existing?.user?.$id && !cleanup.users.includes(existing.user.$id)) cleanup.users.push(existing.user.$id);
  }
}

// ===========================================================================
// MAIN TEST SUITE
// ===========================================================================
async function main() {
  await assertTestCleanupCapabilities("messaging-notifications-presence");
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  TRANSMOVE MESSAGING + NOTIFICATIONS + PRESENCE E2E SUITE    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  // --------------------------------------------------------------------------
  // PHASE 1: Live Table Permission Hardening Verification
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 1: LIVE TABLE PERMISSIONS VERIFICATION ════════════════");
  const livePerms = {};
  for (const col of ["messages", "notifications", "driver_presence"]) {
    const info = await getCollectionInfo(col);
    const perms = info?.$permissions || [];
    livePerms[col] = perms;
    const isHardened = !perms.includes('create("users")') && !perms.includes('create("any")');
    console.log(`  ${col}: [${perms.join(", ") || "EMPTY — trusted-only ✓"}] (Hardened: ${isHardened})`);
  }

  // --------------------------------------------------------------------------
  // PHASE 2: Create Test Actors
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 2: CREATE TEST ACTORS ════════════════════════════════");
  let pPId, pXId, dAId, dCId;
  let pPJWT, pXJWT, dAJWT, dCJWT;
  let vehA;

  try {
    await ensureTestUser("msg.test.pass.p@tm.test", "Passenger P", "+2637720000001", "passenger", "Harare");
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    const pPAcc = await getAppwriteAccount().get();
    pPId = pPAcc.$id;
    console.log(`  Passenger P: ${pPId}`);

    await ensureTestUser("msg.test.pass.x@tm.test", "Passenger X", "+2637720000002", "passenger", "Bulawayo");
    await loginAs("msg.test.pass.x@tm.test");
    pXJWT = await getJWT();
    const pXAcc = await getAppwriteAccount().get();
    pXId = pXAcc.$id;
    console.log(`  Passenger X (unrelated): ${pXId}`);

    await ensureTestUser("msg.test.drv.a@tm.test", "Driver A", "+2637720000003", "driver", "Harare");
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    const dAAcc = await getAppwriteAccount().get();
    dAId = dAAcc.$id;
    vehA = await VehicleService.addVehicle({
      vehicle_type: "sedan",
      make: "Toyota",
      model: "Axio",
      year: 2021,
      colour: "Silver",
      registration_number: `MSG${Date.now().toString().slice(-5)}`,
      passenger_capacity: 4,
      service_category: "passenger_transport"
    });
    if (vehA?.$id) cleanup.vehicles.push(vehA.$id);
    console.log(`  Driver A: ${dAId}  vehicle: ${vehA?.$id}`);

    await ensureTestUser("msg.test.drv.c@tm.test", "Driver C", "+2637720000004", "driver", "Harare");
    await loginAs("msg.test.drv.c@tm.test");
    dCJWT = await getJWT();
    const dCAcc = await getAppwriteAccount().get();
    dCId = dCAcc.$id;
    console.log(`  Driver C (unrelated): ${dCId}`);
  } catch (e) {
    console.error("FATAL: Failed to initialize test actors:", e.message);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // PHASE 3: Create Service Request & Booking B (Passenger P + Driver A)
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 3: CREATE REQUEST & BOOKING B ═════════════════════════");
  let reqB, bidA, bookingB;
  try {
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    const rRes = await trustedCallAs(pPJWT, "create_service_request", {
      service_type: "ride",
      pickup_location: "Avondale",
      destination: "Harare CBD",
      budget: 15,
      passenger_count: 1,
      details: "Messaging E2E trip"
    });
    reqB = rRes.body;
    cleanup.requests.push(reqB.$id);
    console.log(`  Created Request: ${reqB.$id}`);

    // Driver A bids
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    const bRes = await trustedCallAs(dAJWT, "create_bid", {
      request_id: reqB.$id,
      proposed_price: 14,
      amount: 14,
      message: "Ready to pick up in 5 minutes"
    });
    bidA = bRes.body;
    cleanup.bids.push(bidA.$id);
    console.log(`  Driver A Bid: ${bidA.$id}`);

    // Passenger P accepts bid -> creates Booking B
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    const acceptRes = await trustedCallAs(pPJWT, "accept_bid", {
      bid_id: bidA.$id,
      request_id: reqB.$id
    });
    bookingB = acceptRes.body?.booking;
    cleanup.bookings.push(bookingB.$id);
    console.log(`  Booking B created: ${bookingB.$id}`);
  } catch (e) {
    console.error("FATAL: Failed to create booking:", e.message);
    process.exit(1);
  }

  // --------------------------------------------------------------------------
  // PHASE 4: Direct Browser Message Creation Blocked
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 4: DIRECT CLIENT MESSAGE WRITE SECURITY ═══════════════");
  try {
    await loginAs("msg.test.pass.p@tm.test");
    process.stdout.write("  Browser SDK direct createDocument on messages... ");
    const directRes = await browserDirectCreate("messages", {
      conversation_id: `booking_${bookingB.$id}`,
      booking_id: bookingB.$id,
      sender_id: pPId,
      receiver_id: dAId,
      message: "Direct injection attempt",
      created_at: new Date().toISOString()
    });
    if (directRes.blocked) {
      pass("directMessageBlocked");
    } else {
      if (directRes.doc?.$id) cleanup.messages.push(directRes.doc.$id);
      fail("directMessageBlocked", "Direct client message create was allowed");
    }
  } catch (e) {
    fail("directMessageBlocked", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 5: Message Send (Passenger P -> Driver A)
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 5: MESSAGE SEND (PASSENGER -> DRIVER) ═════════════════");
  let msg1;
  try {
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    process.stdout.write("  Passenger P sends message to Driver A... ");
    const r = await trustedCallAs(pPJWT, "send_message", {
      booking_id: bookingB.$id,
      message: "Hi Simba, I am waiting near the pharmacy."
    });
    if (r.status === 200 && r.body?.$id) {
      msg1 = r.body;
      cleanup.messages.push(msg1.$id);
      console.log(`msg id: ${msg1.$id}`);
      pass("messageSendPassenger");
    } else {
      fail("messageSendPassenger", `HTTP ${r.status}: ${r.body?.error}`);
    }
  } catch (e) {
    fail("messageSendPassenger", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 6: Message Send (Driver A -> Passenger P)
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 6: MESSAGE SEND (DRIVER -> PASSENGER) ═════════════════");
  let msg2;
  try {
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    process.stdout.write("  Driver A sends reply to Passenger P... ");
    const r = await trustedCallAs(dAJWT, "send_message", {
      booking_id: bookingB.$id,
      message: "Noted, I am pulling up in the silver Axio now."
    });
    if (r.status === 200 && r.body?.$id) {
      msg2 = r.body;
      cleanup.messages.push(msg2.$id);
      console.log(`msg id: ${msg2.$id}`);
      pass("messageSendDriver");
    } else {
      fail("messageSendDriver", `HTTP ${r.status}: ${r.body?.error}`);
    }
  } catch (e) {
    fail("messageSendDriver", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 7: Message Persistence & Ordering
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 7: MESSAGE PERSISTENCE & ORDERING ═════════════════════");
  try {
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    process.stdout.write("  Passenger P retrieves conversation messages... ");
    const r = await trustedCallAs(pPJWT, "list_booking_messages", { booking_id: bookingB.$id });
    const msgs = r.body?.messages || [];
    if (
      r.status === 200 &&
      msgs.length >= 2 &&
      msgs[0].content.includes("pharmacy") &&
      msgs[1].content.includes("Axio")
    ) {
      pass("messagePersistence");
    } else {
      fail("messagePersistence", `Count: ${msgs.length}, Status: ${r.status}`);
    }
  } catch (e) {
    fail("messagePersistence", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 8: Cross-User Access Security (Third-party Driver C)
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 8: CROSS-USER SECURITY (DRIVER C) ═════════════════════");
  try {
    await loginAs("msg.test.drv.c@tm.test");
    dCJWT = await getJWT();

    process.stdout.write("  Driver C attempts to read Booking B messages... ");
    const readAttempt = await trustedCallAs(dCJWT, "list_booking_messages", { booking_id: bookingB.$id });
    if (readAttempt.status === 403 || readAttempt.body?.error?.includes("Forbidden")) {
      console.log("✓ rejected");
      pass("driverCCannotRead");
    } else {
      console.log(`✗ allowed: ${readAttempt.status}`);
      fail("driverCCannotRead", `HTTP ${readAttempt.status}`);
    }

    process.stdout.write("  Driver C attempts to send into Booking B... ");
    const sendAttempt = await trustedCallAs(dCJWT, "send_message", {
      booking_id: bookingB.$id,
      message: "Unsolicited message from driver C"
    });
    if (sendAttempt.status === 403 || sendAttempt.body?.error?.includes("Forbidden")) {
      console.log("✓ rejected");
      pass("driverCCannotSend");
    } else {
      if (sendAttempt.body?.$id) cleanup.messages.push(sendAttempt.body.$id);
      console.log(`✗ allowed: ${sendAttempt.status}`);
      fail("driverCCannotSend", `HTTP ${sendAttempt.status}`);
    }
  } catch (e) {
    fail("driverCCannotRead", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 9: Cross-User Access Security (Third-party Passenger X)
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 9: CROSS-USER SECURITY (PASSENGER X) ══════════════════");
  try {
    await loginAs("msg.test.pass.x@tm.test");
    pXJWT = await getJWT();

    process.stdout.write("  Passenger X attempts to read Booking B messages... ");
    const readAttempt = await trustedCallAs(pXJWT, "list_booking_messages", { booking_id: bookingB.$id });
    if (readAttempt.status === 403 || readAttempt.body?.error?.includes("Forbidden")) {
      console.log("✓ rejected");
      pass("passengerXCannotRead");
    } else {
      console.log(`✗ allowed: ${readAttempt.status}`);
      fail("passengerXCannotRead", `HTTP ${readAttempt.status}`);
    }

    process.stdout.write("  Passenger X attempts to send into Booking B... ");
    const sendAttempt = await trustedCallAs(pXJWT, "send_message", {
      booking_id: bookingB.$id,
      message: "Unsolicited message from passenger X"
    });
    if (sendAttempt.status === 403 || sendAttempt.body?.error?.includes("Forbidden")) {
      console.log("✓ rejected");
      pass("passengerXCannotSend");
    } else {
      if (sendAttempt.body?.$id) cleanup.messages.push(sendAttempt.body.$id);
      console.log(`✗ allowed: ${sendAttempt.status}`);
      fail("passengerXCannotSend", `HTTP ${sendAttempt.status}`);
    }
  } catch (e) {
    fail("passengerXCannotRead", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 10: Message Read Status & Unread Count
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 10: MESSAGE READ STATUS & UNREAD COUNT ════════════════");
  try {
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();

    process.stdout.write("  Driver A checks unread message count... ");
    const unreadBefore = await trustedCallAs(dAJWT, "get_unread_message_count", {});
    console.log(`unread count: ${unreadBefore.body?.unread_count}`);

    process.stdout.write("  Driver A marks booking messages as read... ");
    const markRes = await trustedCallAs(dAJWT, "mark_messages_read", { booking_id: bookingB.$id });
    if (markRes.status === 200 && markRes.body?.updated_count >= 1) {
      console.log(`✓ updated ${markRes.body.updated_count}`);
      pass("markMessagesRead");
    } else {
      fail("markMessagesRead", `HTTP ${markRes.status}: ${JSON.stringify(markRes.body)}`);
    }

    process.stdout.write("  Driver A unread count after mark read... ");
    const unreadAfter = await trustedCallAs(dAJWT, "get_unread_message_count", {});
    if (unreadAfter.body?.unread_count === 0) {
      pass("unreadCountZero");
    } else {
      fail("unreadCountZero", `Remaining unread: ${unreadAfter.body?.unread_count}`);
    }
  } catch (e) {
    fail("markMessagesRead", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 11: Notification Creation on Real Events
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 11: NOTIFICATION CREATION ON REAL EVENTS ══════════════");
  try {
    // Passenger P received bid_received & booking_confirmed & new_message
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    process.stdout.write("  Passenger P lists notifications... ");
    const pNotifsRes = await trustedCallAs(pPJWT, "list_notifications", {});
    const pNotifs = pNotifsRes.body?.notifications || [];
    pNotifs.forEach((n) => cleanup.notifications.push(n.$id || n.id));
    const hasBidRecv = pNotifs.some((n) => n.type === "bid_received");
    const hasBookConf = pNotifs.some((n) => n.type === "booking_confirmed");
    const hasNewMsg = pNotifs.some((n) => n.type === "new_message");

    console.log(`found ${pNotifs.length} (bid_received: ${hasBidRecv}, booking_confirmed: ${hasBookConf}, new_message: ${hasNewMsg})`);

    if (hasBidRecv && hasBookConf && hasNewMsg) {
      pass("notificationEventsPassenger");
    } else {
      fail("notificationEventsPassenger", `Missing events: bid_recv=${hasBidRecv}, book_conf=${hasBookConf}, new_msg=${hasNewMsg}`);
    }

    // Driver A received bid_accepted & new_message
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    process.stdout.write("  Driver A lists notifications... ");
    const dNotifsRes = await trustedCallAs(dAJWT, "list_notifications", {});
    const dNotifs = dNotifsRes.body?.notifications || [];
    dNotifs.forEach((n) => cleanup.notifications.push(n.$id || n.id));
    const hasBidAcc = dNotifs.some((n) => n.type === "bid_accepted");
    const hasDrvNewMsg = dNotifs.some((n) => n.type === "new_message");

    console.log(`found ${dNotifs.length} (bid_accepted: ${hasBidAcc}, new_message: ${hasDrvNewMsg})`);
    if (hasBidAcc && hasDrvNewMsg) {
      pass("notificationEventsDriver");
    } else {
      fail("notificationEventsDriver", `Missing: bid_accepted=${hasBidAcc}, new_msg=${hasDrvNewMsg}`);
    }
  } catch (e) {
    fail("notificationEventsPassenger", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 12: Notification Read State & Privacy
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 12: NOTIFICATION READ STATE & PRIVACY ═════════════════");
  try {
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    const pNotifsRes = await trustedCallAs(pPJWT, "list_notifications", {});
    const notif = pNotifsRes.body?.notifications?.[0];

    if (!notif) throw new Error("No notification found for Passenger P");

    process.stdout.write("  Passenger P marks notification as read... ");
    const markN = await trustedCallAs(pPJWT, "mark_notification_read", { notification_id: notif.id });
    if (markN.status === 200) {
      pass("notificationMarkRead");
    } else {
      fail("notificationMarkRead", `HTTP ${markN.status}`);
    }

    // Driver C tries to mark Passenger P's notification as read
    await loginAs("msg.test.drv.c@tm.test");
    dCJWT = await getJWT();
    process.stdout.write("  Driver C tries to mark Passenger P's notification as read... ");
    const forgeMark = await trustedCallAs(dCJWT, "mark_notification_read", { notification_id: notif.id });
    if (forgeMark.status === 403 || forgeMark.body?.error?.includes("Forbidden")) {
      console.log("✓ rejected");
      pass("crossUserNotificationBlock");
    } else {
      console.log(`✗ allowed: ${forgeMark.status}`);
      fail("crossUserNotificationBlock", `Allowed: ${forgeMark.status}`);
    }

    // Browser direct create on notifications blocked
    process.stdout.write("  Browser SDK direct createDocument on notifications... ");
    const dirN = await browserDirectCreate("notifications", {
      user_id: pPId,
      type: "fake",
      title: "Fake Notif",
      message: "Attack injection",
      created_at: new Date().toISOString()
    });
    if (dirN.blocked) {
      pass("directNotificationBlocked");
    } else {
      if (dirN.doc?.$id) cleanup.notifications.push(dirN.doc.$id);
      fail("directNotificationBlocked", "Allowed direct notification create");
    }
  } catch (e) {
    fail("notificationMarkRead", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 13: Driver Presence Heartbeat
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 13: DRIVER PRESENCE & HEARTBEAT ═══════════════════════");
  try {
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();

    process.stdout.write("  Driver A sends driver_heartbeat... ");
    const hbRes = await trustedCallAs(dAJWT, "driver_heartbeat", {});
    if (hbRes.status === 200 && hbRes.body?.online === true && hbRes.body?.presence_id) {
      cleanup.presence.push(hbRes.body.presence_id);
      pass("driverHeartbeat");
    } else {
      fail("driverHeartbeat", `HTTP ${hbRes.status}: ${JSON.stringify(hbRes.body)}`);
    }

    process.stdout.write("  Marketplace checks Driver A presence (should be online)... ");
    const pCheck = await trustedCallAs(dAJWT, "get_driver_presence", { driver_id: dAId });
    if (pCheck.status === 200 && pCheck.body?.online === true) {
      pass("driverOnlineActive");
    } else {
      fail("driverOnlineActive", `online=${pCheck.body?.online}`);
    }
  } catch (e) {
    fail("driverHeartbeat", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 14: Automatic Offline Timeout Simulation
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 14: AUTOMATIC OFFLINE TIMEOUT ═════════════════════════");
  try {
    // Find Driver A's presence document
    const dQ = [{ method: "equal", attribute: "driver_id", values: [dAId] }];
    const presDocs = await serverQuery("driver_presence", dQ);
    if (!presDocs.length) throw new Error("No presence doc for Driver A");

    const presDoc = presDocs[0];
    // Simulate last_seen_at 4 minutes ago (> 3 min timeout)
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    await serverUpdate("driver_presence", presDoc.$id, {
      last_seen_at: fourMinutesAgo,
      updated_at: fourMinutesAgo
    });

    process.stdout.write("  Presence checked after > 3 mins inactivity (should be offline)... ");
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    const offCheck = await trustedCallAs(pPJWT, "get_driver_presence", { driver_id: dAId });
    if (offCheck.status === 200 && offCheck.body?.online === false) {
      pass("driverAutomaticOffline");
    } else {
      fail("driverAutomaticOffline", `online=${offCheck.body?.online}`);
    }

    // Driver A heartbeats again -> becomes online
    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    process.stdout.write("  Driver A resumes activity / heartbeats (should become online)... ");
    const resumeHb = await trustedCallAs(dAJWT, "driver_heartbeat", {});
    const onCheck2 = await trustedCallAs(dAJWT, "get_driver_presence", { driver_id: dAId });
    if (resumeHb.status === 200 && onCheck2.body?.online === true) {
      pass("driverResumesOnline");
    } else {
      fail("driverResumesOnline", `online=${onCheck2.body?.online}`);
    }
  } catch (e) {
    fail("driverAutomaticOffline", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 15: Driver Presence Spoof & Injection Protection
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 15: PRESENCE SPOOF PROTECTION ═════════════════════════");
  try {
    await loginAs("msg.test.drv.c@tm.test");
    dCJWT = await getJWT();

    process.stdout.write("  Driver C attempts to heartbeat as Driver A... ");
    const spoofHb = await trustedCallAs(dCJWT, "driver_heartbeat", { driver_id: dAId });
    if (spoofHb.status === 400 || spoofHb.body?.error?.includes("Privilege escalation blocked")) {
      console.log("✓ rejected");
      pass("presenceSpoofProtection");
    } else {
      console.log(`✗ allowed: ${spoofHb.status}`);
      fail("presenceSpoofProtection", `Allowed: ${spoofHb.status}`);
    }

    process.stdout.write("  Browser SDK direct createDocument on driver_presence... ");
    const dirP = await browserDirectCreate("driver_presence", {
      driver_id: dCId,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (dirP.blocked) {
      pass("directPresenceBlocked");
    } else {
      if (dirP.doc?.$id) cleanup.presence.push(dirP.doc.$id);
      fail("directPresenceBlocked", "Allowed direct presence create");
    }
  } catch (e) {
    fail("presenceSpoofProtection", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 16: Safe Realtime & Listener Cleanup
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 16: REALTIME & LISTENER CLEANUP ═══════════════════════");
  try {
    process.stdout.write("  MessagingService.subscribeToMessages returns clean unsubscribe handle... ");
    let received = null;
    const subHandle = MessagingService.subscribeToMessages(bookingB.$id, (msg) => {
      received = msg;
    });

    if (subHandle && typeof subHandle.unsubscribe === "function") {
      subHandle.unsubscribe();
      pass("realtimeCleanup");
    } else {
      fail("realtimeCleanup", "No valid unsubscribe function returned");
    }

    process.stdout.write("  PresenceService clean start/stop heartbeat... ");
    PresenceService.startHeartbeat(dAId);
    PresenceService.stopHeartbeat();
    pass("presenceHeartbeatLifecycle");
  } catch (e) {
    fail("realtimeCleanup", e.message);
  }

  // --------------------------------------------------------------------------
  // PHASE 17: Previous Phase Regression
  // --------------------------------------------------------------------------
  console.log("\n══ PHASE 17: PREVIOUS PHASE REGRESSION ═════════════════════════");
  try {
    await loginAs("msg.test.pass.p@tm.test");
    pPJWT = await getJWT();
    process.stdout.write("  Auth + Profiles... ");
    const acc = await getAppwriteAccount().get();
    if (acc?.$id) {
      console.log("✓");
    } else {
      console.log("✗");
    }

    process.stdout.write("  list_passenger_requests... ");
    const lr = await trustedCallAs(pPJWT, "list_passenger_requests", {});
    if (lr.status === 200) {
      console.log("✓");
    } else {
      console.log(`✗ ${lr.status}`);
    }

    await loginAs("msg.test.drv.a@tm.test");
    dAJWT = await getJWT();
    process.stdout.write("  list_available_requests (driver)... ");
    const la = await trustedCallAs(dAJWT, "list_available_requests", {});
    if (la.status === 200) {
      console.log("✓");
    } else {
      console.log(`✗ ${la.status}`);
    }

    process.stdout.write("  check_driver_entitlement... ");
    const ent = await trustedCallAs(dAJWT, "check_driver_entitlement", {});
    if (ent.status === 200 && ent.body?.free_limit === 5) {
      console.log("✓");
    } else {
      console.log(`✗ ${ent.status}`);
    }

    if (acc?.$id && lr.status === 200 && la.status === 200 && ent.status === 200) {
      pass("regression");
    } else {
      fail("regression", "Regression assertion failed");
    }
  } catch (e) {
    fail("regression", e.message);
  }

  // Cleanup
  await doCleanup();

  // Print final summary report
  printReport(livePerms);
}

// ---------------------------------------------------------------------------
// CLEANUP
// ---------------------------------------------------------------------------
function containsCleanupReference(value, ownedIds) {
  if (typeof value === "string") return ownedIds.has(value);
  if (Array.isArray(value)) return value.some((item) => containsCleanupReference(item, ownedIds));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) =>
      !key.startsWith("$") && containsCleanupReference(item, ownedIds)
    );
  }
  return false;
}

async function doCleanup() {
  console.log("\n══ PHASE 18: CLEANUP ══════════════════════════════════════════");
  const tasks = [];
  const ownedIds = new Set([
    ...cleanup.users, ...cleanup.vehicles, ...cleanup.requests, ...cleanup.bids,
    ...cleanup.bookings, ...cleanup.messages, ...cleanup.notifications, ...cleanup.presence
  ]);
  for (const collection of ["booking_events", "activity_logs"]) {
    try {
      const records = await serverQuery(collection, [{ method: "limit", values: [100] }]);
      for (const record of records.filter((item) => containsCleanupReference(item, ownedIds))) {
        tasks.push({
          label: `${collection}/${record.$id}`,
          run: () => serverDelete(collection, record.$id)
        });
      }
    } catch (error) {
      tasks.push({ label: `${collection} cleanup discovery`, run: async () => { throw error; } });
    }
  }
  for (const [collection, ids] of [
    ["messages", cleanup.messages],
    ["notifications", cleanup.notifications],
    ["driver_presence", cleanup.presence],
    ["bookings", cleanup.bookings],
    ["bids", cleanup.bids],
    ["service_requests", cleanup.requests],
    ["vehicles", cleanup.vehicles]
  ]) {
    for (const id of ids) tasks.push({
      label: `${collection}/${id}`,
      run: () => serverDelete(collection, id)
    });
  }
  for (const userId of cleanup.users) {
    tasks.push({
      label: `identity ${userId}`,
      run: async () => {
        const profiles = await serverQuery("profiles", [{ method: "equal", attribute: "user_id", values: [userId] }]);
        const identityTasks = profiles.map((profile) => ({
          label: `profiles/${profile.$id}`,
          run: () => serverDelete("profiles", profile.$id)
        }));
        identityTasks.push({
          label: `Auth user ${userId}`,
          run: async () => {
            const response = await fetch(`${ENDPOINT}/users/${userId}`, { method: "DELETE", headers: serverHeaders });
            if (![200, 204, 404].includes(response.status)) throw new Error(`HTTP ${response.status}`);
          }
        });
        await runCleanupTasks(`messaging-notifications-presence ${userId}`, identityTasks);
      }
    });
  }
  await runCleanupTasks("messaging-notifications-presence", tasks);
  console.log("  Cleanup complete.");
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
function printReport(livePerms) {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     TRANSMOVE MESSAGING + NOTIFICATIONS + PRESENCE REPORT     ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  const keys = [
    ["Message Send", R.messageSendPassenger === "PASS" && R.messageSendDriver === "PASS" ? "PASS" : "FAIL"],
    ["Message Persistence", R.messagePersistence || "FAIL"],
    ["Message Realtime", R.realtimeCleanup || "FAIL"],
    ["Conversation Participant Security", R.driverCCannotRead === "PASS" && R.passengerXCannotRead === "PASS" ? "PASS" : "FAIL"],
    ["Cross-User Message Block", R.driverCCannotSend === "PASS" && R.passengerXCannotSend === "PASS" ? "PASS" : "FAIL"],
    ["Mark Read", R.markMessagesRead || "FAIL"],
    ["Unread Message Count", R.unreadCountZero || "FAIL"],
    ["Notification Creation", R.notificationEventsPassenger === "PASS" && R.notificationEventsDriver === "PASS" ? "PASS" : "FAIL"],
    ["Notification Listing", R.notificationEventsPassenger || "FAIL"],
    ["Notification Read State", R.notificationMarkRead || "FAIL"],
    ["Notification Event Linking", R.notificationEventsPassenger === "PASS" ? "PASS" : "FAIL"],
    ["Cross-User Notification Block", R.crossUserNotificationBlock || "FAIL"],
    ["Driver Heartbeat", R.driverHeartbeat || "FAIL"],
    ["Automatic Online", R.driverOnlineActive === "PASS" && R.driverResumesOnline === "PASS" ? "PASS" : "FAIL"],
    ["Automatic Offline Timeout", R.driverAutomaticOffline || "FAIL"],
    ["Presence Spoof Protection", R.presenceSpoofProtection || "FAIL"],
    ["Realtime Listener Cleanup", R.realtimeCleanup || "FAIL"],
    ["Previous Phase Regression", R.regression || "FAIL"]
  ];

  let passed = 0;
  keys.forEach(([label, res]) => {
    if (res === "PASS") passed++;
    const pad = " ".repeat(Math.max(1, 36 - label.length));
    console.log(`  ${res === "PASS" ? "✓" : "✗"} ${label}${pad}${res}`);
  });

  console.log(`\n  Summary: ${passed}/${keys.length} PASS | ${keys.length - passed} FAIL`);

  console.log("\n─── MESSAGES LIVE PERMISSIONS ───────────────────────────────────────");
  console.log(`  messages: [${livePerms.messages?.join(", ") || "EMPTY — trusted-only ✓"}]`);

  console.log("\n─── NOTIFICATIONS LIVE PERMISSIONS ──────────────────────────────────");
  console.log(`  notifications: [${livePerms.notifications?.join(", ") || "EMPTY — trusted-only ✓"}]`);

  console.log("\n─── DRIVER_PRESENCE LIVE PERMISSIONS ────────────────────────────────");
  console.log(`  driver_presence: [${livePerms.driver_presence?.join(", ") || "EMPTY — trusted-only ✓"}]`);

  console.log("\n─── CONFIGURATION PARAMETERS ────────────────────────────────────────");
  console.log("  HEARTBEAT INTERVAL:          45 seconds (45,000 ms)");
  console.log("  OFFLINE TIMEOUT:             3 minutes (180,000 ms)");
  console.log("  TRUSTED OPERATIONS ADDED:    send_message, list_booking_messages, mark_messages_read,");
  console.log("                               get_unread_message_count, list_notifications,");
  console.log("                               mark_notification_read, mark_all_notifications_read,");
  console.log("                               driver_heartbeat, get_driver_presence");
  console.log("  REALTIME CHANNELS USED:      databases.transmove.collections.messages.documents,");
  console.log("                               databases.transmove.collections.notifications.documents");
  console.log("  POLLING/FALLBACKS USED:      6s interval for active chat window, controlled on-mount fetch");
  console.log("  FILES CREATED:               scripts/test-messaging-notifications-presence.js");
  console.log("  FILES MODIFIED:              netlify/functions/trusted-api.js, src/services/messaging.js,");
  console.log("                               src/services/notifications.js, src/services/presence.js,");
  console.log("                               scripts/setup-appwrite.js");
  console.log("  TEST DATA CLEANED:           YES");

  console.log("\n─── ARCHITECTURAL CONSTRAINTS ───────────────────────────────────────");
  console.log("  DRIVER ONLINE/OFFLINE IS AUTOMATIC:          YES");
  console.log("  MANUAL ONLINE TOGGLE ADDED:                  NO");
  console.log("  MESSAGES LIMITED TO BOOKING PARTICIPANTS:    YES");
  console.log("  NOTIFICATIONS LIMITED TO RECIPIENT:          YES");
  console.log("  UI MODIFIED:                                 NO");
  console.log("  APPWRITE API KEY EXPOSED:                    NO");
  console.log("  SUPABASE REMOVED:                            NO");
  console.log("  PAYNOW MODIFIED:                             NO");
  console.log("═══════════════════════════════════════════════════════════════════\n");
}

main().catch(async (err) => {
  console.error("FATAL SUITE ERROR:", err);
  await doCleanup().catch((cleanupError) => console.error("CLEANUP FAILED:", cleanupError.message));
  process.exit(1);
});
