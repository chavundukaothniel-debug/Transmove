// ==============================================================================
// TransMove EcoCash Payment System — Security Tests (10 Security Assertions)
// Tests:
// 1. Client amount manipulation blocked (amount_expected derived from server truth)
// 2. Destination spoofing blocked (invalid destination ID rejected)
// 3. Privilege escalation blocked (cannot pass status: approved)
// 4. Non-admin approval blocked (requires verified admin role)
// 5. Self-approval blocked (admin cannot approve their own payment)
// 6. Duplicate transaction reference conflict (already approved reference cannot be re-approved)
// 7. Missing proof file rejected (proof_file_id is mandatory)
// 8. Missing sender details rejected (sender_name, sender_phone, transaction_reference mandatory)
// 9. Unauthenticated submission blocked
// 10. Admin rejection requires mandatory reason
// ==============================================================================

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
import { Client, Account, Databases, ID } from "../assets/js/vendor/appwrite.js";
import { executeTrustedOperation } from "../netlify/functions/trusted-api.js";

const config = {};
if (fs.existsSync(".env.appwrite.setup")) {
  fs.readFileSync(".env.appwrite.setup", "utf8").split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) config[parts[0].trim()] = parts.slice(1).join("=").trim();
  });
}

const endpoint = (process.env.APPWRITE_ENDPOINT || config.APPWRITE_ENDPOINT || "").trim().replace(/\/$/, "");
const projectId = (process.env.APPWRITE_PROJECT_ID || config.APPWRITE_PROJECT_ID || "").trim();
const apiKey = (process.env.APPWRITE_API_KEY || config.APPWRITE_API_KEY || "").trim();

const serverHeaders = {
  "X-Appwrite-Project": projectId,
  "X-Appwrite-Key": apiKey,
  "Content-Type": "application/json"
};

const password = "SecTestPassword2026!";
const cleanup = {
  users: [],
  profiles: [],
  payments: [],
  notifications: [],
  activityLogs: []
};

const results = {};

function record(testNum, name, passed, detail = "") {
  const key = `Test ${testNum}: ${name}`;
  results[key] = passed ? "PASS" : `FAIL${detail ? `: ${detail}` : ""}`;
  console.log(`[${passed ? "PASS" : "FAIL"}] Test ${testNum}: ${name}${detail ? ` (${detail})` : ""}`);
}

async function serverCreate(collection, data, permissions = []) {
  const response = await fetch(`${endpoint}/databases/transmove/collections/${collection}/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({ documentId: "unique()", data, permissions })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Cannot create ${collection}`);
  }
  return response.json();
}

async function serverDelete(collection, id) {
  await fetch(`${endpoint}/databases/transmove/collections/${collection}/documents/${id}`, {
    method: "DELETE",
    headers: serverHeaders
  }).catch(() => {});
}

async function serverDeleteUser(id) {
  await fetch(`${endpoint}/users/${id}`, {
    method: "DELETE",
    headers: serverHeaders
  }).catch(() => {});
}

async function createTestUser(role, label) {
  sessionStore.clear();
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  const account = new Account(client);
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}_${stamp}@transmove.test`;

  const accountUser = await account.create(ID.unique(), email, password, `${label} Test`);
  await account.createEmailPasswordSession(email, password);
  const jwt = (await account.createJWT()).jwt;

  cleanup.users.push(accountUser.$id);

  const now = new Date().toISOString();
  const profile = await serverCreate("profiles", {
    user_id: accountUser.$id,
    full_name: `${label} Test`,
    email,
    phone: "+263771000000",
    role,
    city: "Harare",
    bio: "Temporary security test profile",
    profile_image_id: "",
    verification_status: role === "admin" ? "approved" : "verified",
    account_status: "active",
    created_at: now,
    updated_at: now
  });

  cleanup.profiles.push(profile.$id);

  return {
    user: accountUser,
    profile,
    jwt,
    email
  };
}

async function runSecurityTests() {
  console.log("==================================================================");
  console.log("STARTING TRANSMOVE ECOCASH PAYMENT SECURITY TEST SUITE");
  console.log("==================================================================");

  let driver = null;
  let driver2 = null;
  let admin = null;
  let testDestinationId = null;

  try {
    // 0. Setup test users and fetch valid destination
    console.log("Setting up test users (Driver, Driver2, Admin)...");
    driver = await createTestUser("driver", "SecDriver");
    driver2 = await createTestUser("driver", "SecDriverTwo");
    admin = await createTestUser("admin", "SecAdmin");

    const dests = await executeTrustedOperation({ action: "list_payment_destinations" });
    if (!dests.destinations || dests.destinations.length === 0) {
      throw new Error("No active payment destinations available in database for testing.");
    }
    testDestinationId = dests.destinations[0].$id;
    console.log(`Using active payment destination: ${testDestinationId} (${dests.destinations[0].account_name})`);

    // -------------------------------------------------------------------------
    // TEST 1: Client amount manipulation blocked
    // -------------------------------------------------------------------------
    try {
      const p1 = await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Tamper Test",
          sender_phone: "0771234567",
          transaction_reference: `REF-TAMPER-${Date.now()}`,
          proof_file_id: "fake_proof_file_1",
          amount: 0.01,
          amount_declared: 0.01
        }
      });
      cleanup.payments.push(p1.$id);

      const isExpectedTrue = p1.amount_expected === 5.0 || p1.amount_expected === 5;
      const isStatusPending = p1.status === "pending_review";
      record(1, "Client amount manipulation blocked", isExpectedTrue && isStatusPending,
        `Expected: $${p1.amount_expected}, Declared: $${p1.amount_declared}, Status: ${p1.status}`);
    } catch (e) {
      record(1, "Client amount manipulation blocked", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Payment destination spoofing blocked
    // -------------------------------------------------------------------------
    try {
      await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: "non_existent_destination_999",
          sender_name: "Spoofer",
          sender_phone: "0771234567",
          transaction_reference: `REF-SPOOF-${Date.now()}`,
          proof_file_id: "fake_proof_file_2"
        }
      });
      record(2, "Payment destination spoofing blocked", false, "Should have thrown for fake destination");
    } catch (e) {
      const blocked = e.message.includes("Invalid payment destination") || e.message.includes("not found");
      record(2, "Payment destination spoofing blocked", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Privilege escalation blocked (client cannot force approved status)
    // -------------------------------------------------------------------------
    try {
      await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Escalator",
          sender_phone: "0771234567",
          transaction_reference: `REF-ESCALATE-${Date.now()}`,
          proof_file_id: "fake_proof_file_3",
          status: "approved"
        }
      });
      record(3, "Privilege escalation blocked", false, "Should have rejected status: approved");
    } catch (e) {
      const blocked = e.message.includes("Privilege escalation blocked");
      record(3, "Privilege escalation blocked", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Non-admin approval blocked
    // -------------------------------------------------------------------------
    try {
      const p4 = await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Non Admin Target",
          sender_phone: "0771234567",
          transaction_reference: `REF-NONADMIN-${Date.now()}`,
          proof_file_id: "fake_proof_file_4"
        }
      });
      cleanup.payments.push(p4.$id);

      // driver2 attempts to approve driver1's payment
      await executeTrustedOperation({
        action: "admin_approve_payment",
        jwt: driver2.jwt,
        data: { payment_id: p4.$id }
      });
      record(4, "Non-admin approval blocked", false, "Driver was able to approve payment");
    } catch (e) {
      const blocked = e.message.includes("administrator privileges required") || e.message.includes("Forbidden") || e.message.includes("Unauthorized");
      record(4, "Non-admin approval blocked", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Self-approval blocked (admin cannot approve their own payment)
    // -------------------------------------------------------------------------
    try {
      const p5 = await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: admin.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Admin Self",
          sender_phone: "0771234567",
          transaction_reference: `REF-SELF-${Date.now()}`,
          proof_file_id: "fake_proof_file_5"
        }
      });
      cleanup.payments.push(p5.$id);

      // Admin attempts to approve their own payment
      await executeTrustedOperation({
        action: "admin_approve_payment",
        jwt: admin.jwt,
        data: { payment_id: p5.$id }
      });
      record(5, "Self-approval blocked", false, "Admin approved their own payment");
    } catch (e) {
      const blocked = e.message.includes("Administrators cannot approve their own payments");
      record(5, "Self-approval blocked", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Duplicate approved transaction reference conflict
    // -------------------------------------------------------------------------
    try {
      const sharedRef = `REF-DUP-${Date.now()}`;

      // Create Payment A
      const p6a = await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Original Payer",
          sender_phone: "0771234567",
          transaction_reference: sharedRef,
          proof_file_id: "fake_proof_file_6a"
        }
      });
      cleanup.payments.push(p6a.$id);

      // Admin approves Payment A
      await executeTrustedOperation({
        action: "admin_approve_payment",
        jwt: admin.jwt,
        data: { payment_id: p6a.$id }
      });

      // Now create Payment B with the same reference (from driver2)
      // Since submission validates duplicate approved references, submission should reject, OR if submitted before, approval rejects!
      let rejectedAtSubmission = false;
      let rejectedAtApproval = false;
      try {
        const p6b = await executeTrustedOperation({
          action: "submit_ecocash_payment",
          jwt: driver2.jwt,
          data: {
            payment_type: "subscription",
            related_id: "flex-pass",
            payment_destination_id: testDestinationId,
            sender_name: "Copycat Payer",
            sender_phone: "0771234568",
            transaction_reference: sharedRef,
            proof_file_id: "fake_proof_file_6b"
          }
        });
        cleanup.payments.push(p6b.$id);

        // If submission succeeded, attempt approval
        await executeTrustedOperation({
          action: "admin_approve_payment",
          jwt: admin.jwt,
          data: { payment_id: p6b.$id }
        });
      } catch (eDup) {
        if (eDup.message.includes("Conflict") || eDup.message.includes("already been verified") || eDup.message.includes("already been approved")) {
          rejectedAtSubmission = true;
        } else {
          throw eDup;
        }
      }

      record(6, "Duplicate transaction reference conflict", rejectedAtSubmission || rejectedAtApproval,
        "Duplicate EcoCash reference properly blocked with Conflict");
    } catch (e) {
      record(6, "Duplicate transaction reference conflict", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Missing proof file rejected
    // -------------------------------------------------------------------------
    try {
      await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "No Proof Payer",
          sender_phone: "0771234567",
          transaction_reference: `REF-NOPROOF-${Date.now()}`,
          proof_file_id: ""
        }
      });
      record(7, "Missing proof file rejected", false, "Allowed submission without proof file");
    } catch (e) {
      const blocked = e.message.includes("proof_file_id") && e.message.includes("required");
      record(7, "Missing proof file rejected", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Missing sender details rejected
    // -------------------------------------------------------------------------
    try {
      await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "",
          sender_phone: "0771234567",
          transaction_reference: `REF-NONAME-${Date.now()}`,
          proof_file_id: "fake_proof_file_8"
        }
      });
      record(8, "Missing sender details rejected", false, "Allowed submission without sender name");
    } catch (e) {
      const blocked = e.message.includes("sender_name is required");
      record(8, "Missing sender details rejected", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Unauthenticated submission blocked
    // -------------------------------------------------------------------------
    try {
      await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: null,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Anon",
          sender_phone: "0771234567",
          transaction_reference: `REF-ANON-${Date.now()}`,
          proof_file_id: "fake_proof_file_9"
        }
      });
      record(9, "Unauthenticated submission blocked", false, "Allowed unauthenticated payment submission");
    } catch (e) {
      const blocked = e.message.includes("Unauthorized") || e.message.includes("Missing");
      record(9, "Unauthenticated submission blocked", blocked, e.message);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Admin rejection requires mandatory reason
    // -------------------------------------------------------------------------
    try {
      const p10 = await executeTrustedOperation({
        action: "submit_ecocash_payment",
        jwt: driver.jwt,
        data: {
          payment_type: "subscription",
          related_id: "flex-pass",
          payment_destination_id: testDestinationId,
          sender_name: "Reject Target",
          sender_phone: "0771234567",
          transaction_reference: `REF-REJECT-${Date.now()}`,
          proof_file_id: "fake_proof_file_10"
        }
      });
      cleanup.payments.push(p10.$id);

      // Admin attempts to reject with empty reason
      await executeTrustedOperation({
        action: "admin_reject_payment",
        jwt: admin.jwt,
        data: {
          payment_id: p10.$id,
          rejection_reason: ""
        }
      });
      record(10, "Admin rejection requires mandatory reason", false, "Allowed rejection with empty reason");
    } catch (e) {
      const blocked = e.message.includes("rejection_reason is required");
      record(10, "Admin rejection requires mandatory reason", blocked, e.message);
    }

  } finally {
    console.log("\n------------------------------------------------------------------");
    console.log("CLEANING UP TEMPORARY SECURITY TEST DATA...");
    for (const id of cleanup.payments) {
      await serverDelete("payments", id);
    }
    for (const id of cleanup.profiles) {
      await serverDelete("profiles", id);
    }
    for (const id of cleanup.users) {
      await serverDeleteUser(id);
    }
    console.log("Cleanup finished.");
  }

  console.log("\n==================================================================");
  console.log("TEST SUMMARY");
  console.log("==================================================================");
  let allPass = true;
  for (const [name, res] of Object.entries(results)) {
    if (!res.startsWith("PASS")) allPass = false;
    console.log(`${res.startsWith("PASS") ? "✅" : "❌"} ${name}: ${res}`);
  }
  console.log("==================================================================");

  if (!allPass) {
    console.error("FAIL: Some security tests failed.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All 10/10 security tests PASSED!");
  }
}

runSecurityTests().catch((err) => {
  console.error("FATAL ERROR running security test suite:", err);
  process.exit(1);
});
