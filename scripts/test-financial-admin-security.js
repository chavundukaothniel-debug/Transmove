// Live Appwrite financial/admin security regression tests.
// Creates temporary users/documents and removes them in finally.
const sessionStore = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => sessionStore.get(key) || null,
    setItem: (key, value) => sessionStore.set(key, value),
    removeItem: (key) => sessionStore.delete(key)
  },
  location: { origin: "http://localhost:8080", hash: "", search: "" },
  console
};

import fs from "fs";
import { Client, Account, Databases, ID, Permission, Role } from "../assets/js/vendor/appwrite.js";
import { executeTrustedOperation } from "../netlify/functions/trusted-api.js";

const config = {};
fs.readFileSync(".env.appwrite.setup", "utf8").split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) config[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const endpoint = config.APPWRITE_ENDPOINT.replace(/\/$/, "");
const projectId = config.APPWRITE_PROJECT_ID;
const apiKey = config.APPWRITE_API_KEY;
const serverHeaders = {
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
  "Content-Type": "application/json"
};
const password = "TakeoverTest2026!";
const cleanup = { users: [], profiles: [], subscriptions: [], payments: [], ledger: [], bookings: [], vehicles: [], documents: [] };
const results = {};

function record(name, passed, detail = "") {
  results[name] = passed ? "PASS" : `FAIL${detail ? `: ${detail}` : ""}`;
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function serverCreate(collection, data, permissions = []) {
  const response = await fetch(`${endpoint}/databases/transmove/collections/${collection}/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({ documentId: "unique()", data, permissions })
  });
  if (!response.ok) throw new Error((await response.json()).message || `Cannot create ${collection}`);
  return response.json();
}

async function serverDelete(collection, id) {
  await fetch(`${endpoint}/databases/transmove/collections/${collection}/documents/${id}`, { method: "DELETE", headers: serverHeaders });
}

async function serverDeleteUser(id) {
  await fetch(`${endpoint}/users/${id}`, { method: "DELETE", headers: serverHeaders });
}

function activate(user) {
  sessionStore.clear();
  if (user.cookie) sessionStore.set("cookieFallback", user.cookie);
}

async function createUser(role, label) {
  sessionStore.clear();
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  const account = new Account(client);
  const databases = new Databases(client);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${label}_${stamp}@transmove.test`;
  const accountUser = await account.create(ID.unique(), email, password, `${label} Test`);
  await account.createEmailPasswordSession(email, password);
  const cookie = sessionStore.get("cookieFallback");
  const jwt = (await account.createJWT()).jwt;
  cleanup.users.push(accountUser.$id);
  const now = new Date().toISOString();
  const profile = await serverCreate("profiles", {
    user_id: accountUser.$id,
    full_name: `${label} Test`,
    email,
    phone: "+263770000000",
    role,
    city: "Harare",
    bio: "Temporary security test",
    profile_image_id: "",
    verification_status: role === "admin" ? "approved" : "pending",
    account_status: "active",
    created_at: now,
    updated_at: now
  }, [Permission.read(Role.user(accountUser.$id)), Permission.delete(Role.user(accountUser.$id))]);
  cleanup.profiles.push(profile.$id);
  return { client, account, databases, id: accountUser.$id, jwt, cookie, profile };
}

async function trusted(user, action, data = {}) {
  return executeTrustedOperation({ action, data, jwt: user.jwt });
}

async function expectRejected(name, operation) {
  try {
    await operation();
    record(name, false, "operation unexpectedly succeeded");
  } catch (_) {
    record(name, true);
  }
}

async function run() {
  let driverA;
  let driverB;
  let admin;
  try {
    driverA = await createUser("driver", "finance_driver_a");
    driverB = await createUser("driver", "finance_driver_b");
    admin = await createUser("admin", "takeover_admin");

    const now = new Date();
    const expired = await serverCreate("subscriptions", {
      user_id: driverA.id,
      plan: "TransMove Professional",
      amount: 15,
      currency: "USD",
      status: "active",
      started_at: new Date(now.getTime() - 60 * 86400000).toISOString(),
      expires_at: new Date(now.getTime() - 30 * 86400000).toISOString(),
      created_at: new Date(now.getTime() - 60 * 86400000).toISOString(),
      updated_at: now.toISOString()
    }, [Permission.read(Role.user(driverA.id))]);
    cleanup.subscriptions.push(expired.$id);

    const expiredStatus = await trusted(driverA, "get_subscription_status");
    record("Expired subscription inactive", expiredStatus.active === false && expiredStatus.status === "expired");
    await expectRejected("Cross-user subscription access rejected", () => trusted(driverA, "get_subscription_status", { user_id: driverB.id }));

    activate(driverA);
    await expectRejected("Browser fake subscription creation rejected", () => driverA.databases.createDocument("transmove", "subscriptions", ID.unique(), {
      user_id: driverA.id, plan: "TransMove Professional", amount: 15, currency: "USD", status: "active",
      created_at: now.toISOString(), updated_at: now.toISOString()
    }));
    await expectRejected("Browser fake subscription activation rejected", () => driverA.databases.updateDocument("transmove", "subscriptions", expired.$id, { status: "active", expires_at: new Date(now.getTime() + 30 * 86400000).toISOString() }));

    const payment = await serverCreate("payments", {
      user_id: driverA.id,
      booking_id: "",
      subscription_id: expired.$id,
      reference: `TEST-PAY-${Date.now()}`,
      provider: "test",
      provider_reference: "",
      amount: 15,
      currency: "USD",
      status: "pending",
      payment_type: "subscription",
      poll_url: "",
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }, [Permission.read(Role.user(driverA.id))]);
    cleanup.payments.push(payment.$id);
    const payments = await trusted(driverA, "list_user_payments");
    record("Own payment history", payments.payments.some((item) => item.id === payment.$id));
    await expectRejected("Cross-user payment access rejected", () => trusted(driverB, "list_user_payments", { user_id: driverA.id }));
    activate(driverA);
    await expectRejected("Browser fake payment creation rejected", () => driverA.databases.createDocument("transmove", "payments", ID.unique(), { ...payment, $id: undefined }));
    await expectRejected("Browser payment manipulation rejected", () => driverA.databases.updateDocument("transmove", "payments", payment.$id, { status: "paid" }));

    const ledger = await serverCreate("wallet_ledger", {
      user_id: driverA.id,
      amount: 25,
      transaction_type: "credit",
      category: "earning",
      description: "Temporary test earning",
      reference_id: "test",
      balance_after: 25,
      created_at: now.toISOString()
    }, [Permission.read(Role.user(driverA.id))]);
    cleanup.ledger.push(ledger.$id);
    const balance = await trusted(driverA, "get_wallet_balance");
    record("Wallet balance", balance.balance === 25);
    const history = await trusted(driverA, "list_wallet_transactions");
    record("Wallet transaction history", history.transactions.some((item) => item.id === ledger.$id));
    await expectRejected("Fake wallet credit rejected", () => driverA.databases.createDocument("transmove", "wallet_ledger", ID.unique(), {
      user_id: driverA.id, amount: 999, transaction_type: "credit", category: "fake", description: "fake", balance_after: 999, created_at: now.toISOString()
    }));
    await expectRejected("Cross-user wallet access rejected", () => trusted(driverB, "get_wallet_balance", { user_id: driverA.id }));

    for (let index = 0; index < 5; index += 1) {
      const booking = await serverCreate("bookings", {
        request_id: `test-request-${Date.now()}-${index}`,
        passenger_id: driverB.id,
        driver_id: driverA.id,
        vehicle_id: `test-vehicle-${index}`,
        accepted_bid_id: `test-bid-${index}`,
        amount: 10 + index,
        status: "completed",
        started_at: now.toISOString(),
        completed_at: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      }, [Permission.read(Role.user(driverA.id)), Permission.read(Role.user(driverB.id))]);
      cleanup.bookings.push(booking.$id);
    }
    const earnings = await trusted(driverA, "get_driver_earnings");
    record("Driver earnings", earnings.totalTrips === 5 && earnings.month === 60 && earnings.available === 25);
    const entitlement = await trusted(driverA, "check_driver_entitlement");
    record("Five-job entitlement regression", entitlement.awarded_jobs === 5 && entitlement.free_jobs_remaining === 0 && entitlement.can_bid === false);

    await expectRejected("Normal user admin data rejected", () => trusted(driverA, "admin_get_platform_stats"));
    sessionStore.set("transmove_active_role", "admin");
    await expectRejected("Local role spoof rejected", () => trusted(driverA, "admin_list_users"));
    const adminStats = await trusted(admin, "admin_get_platform_stats");
    record("Real Appwrite admin access", Number.isFinite(adminStats.totalUsers));

    const vehicle = await serverCreate("vehicles", {
      driver_id: driverB.id, vehicle_type: "sedan", make: "Test", model: "Admin", year: 2024,
      colour: "White", registration_number: `TEST-${Date.now()}`, passenger_capacity: 4, load_capacity: 0,
      service_category: "passenger_transport", description: "Temporary", status: "active", verification_status: "unverified",
      is_primary: true, created_at: now.toISOString(), updated_at: now.toISOString()
    }, [Permission.read(Role.user(driverB.id)), Permission.delete(Role.user(driverB.id))]);
    cleanup.vehicles.push(vehicle.$id);
    const document = await serverCreate("verification_documents", {
      user_id: driverB.id, vehicle_id: vehicle.$id, document_type: "vehicle_registration", file_id: "temporary-test-file",
      verification_status: "pending", rejection_reason: "", verified_at: null, created_at: now.toISOString(), updated_at: now.toISOString()
    }, [Permission.read(Role.user(driverB.id)), Permission.delete(Role.user(driverB.id))]);
    cleanup.documents.push(document.$id);

    await expectRejected("Driver document self-verification rejected", () => trusted(driverB, "admin_verify_document", { document_id: document.$id, verification_status: "verified" }));
    await expectRejected("Driver vehicle self-verification rejected", () => trusted(driverB, "admin_verify_vehicle", { vehicle_id: vehicle.$id, verification_status: "approved" }));
    const verifiedDocument = await trusted(admin, "admin_verify_document", { document_id: document.$id, verification_status: "verified" });
    record("Admin verifies document", verifiedDocument.verification_status === "verified");
    const verifiedVehicle = await trusted(admin, "admin_verify_vehicle", { vehicle_id: vehicle.$id, verification_status: "approved" });
    record("Admin verifies vehicle", verifiedVehicle.verification_status === "approved");

    const directory = await trusted(admin, "admin_list_users");
    const adminBookings = await trusted(admin, "admin_list_bookings");
    const adminPayments = await trusted(admin, "admin_list_payments");
    record("Admin protected data access", Array.isArray(directory.users) && Array.isArray(adminBookings.bookings) && Array.isArray(adminPayments.payments));
    const suspended = await trusted(admin, "admin_set_account_status", { profile_id: driverB.profile.$id, account_status: "suspended" });
    record("Admin account status change", suspended.account_status === "suspended");
    await trusted(admin, "admin_set_account_status", { profile_id: driverB.profile.$id, account_status: "active" });
  } finally {
    for (const [collection, ids] of [
      ["verification_documents", cleanup.documents], ["vehicles", cleanup.vehicles], ["bookings", cleanup.bookings],
      ["wallet_ledger", cleanup.ledger], ["payments", cleanup.payments], ["subscriptions", cleanup.subscriptions], ["profiles", cleanup.profiles]
    ]) {
      for (const id of ids) await serverDelete(collection, id).catch(() => {});
    }
    for (const id of cleanup.users) await serverDeleteUser(id).catch(() => {});
  }

  console.log("\nTRANSMOVE FINANCIAL + ADMIN SECURITY RESULTS");
  Object.entries(results).forEach(([name, value]) => console.log(`${name}: ${value}`));
  if (Object.values(results).some((value) => value !== "PASS")) process.exitCode = 1;
}

run().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
