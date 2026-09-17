// ==============================================================================
// TransMove EcoCash Payment System — End-to-End (E2E) Test Suite
// Verifies complete user and admin lifecycles:
// 1. Public catalog queries (destinations, plans, rate cards, price calculations)
// 2. Provider free job quota check (first 5 jobs free)
// 3. Provider subscription submission, admin approval, and instant activation
// 4. Advertising campaign submission, pricing, proof submission, and approval
// 5. Payment rejection workflow with rejection reason
// 6. Complete data hygiene cleanup
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
import { Client, Account, ID } from "../assets/js/vendor/appwrite.js";
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

const password = "E2ETestPassword2026!";
const cleanup = {
  users: [],
  profiles: [],
  subscriptions: [],
  payments: [],
  campaigns: [],
  notifications: []
};

const results = {};

function record(stepNum, name, passed, detail = "") {
  const key = `Step ${stepNum}: ${name}`;
  results[key] = passed ? "PASS" : `FAIL${detail ? `: ${detail}` : ""}`;
  console.log(`[${passed ? "PASS" : "FAIL"}] Step ${stepNum}: ${name}${detail ? ` (${detail})` : ""}`);
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
    phone: "+263772000000",
    role,
    city: "Harare",
    bio: "E2E automated test profile",
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

async function runE2ETests() {
  console.log("==================================================================");
  console.log("STARTING TRANSMOVE ECOCASH E2E FULL LIFECYCLE TEST SUITE");
  console.log("==================================================================");

  let driver = null;
  let advertiser = null;
  let admin = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Public Catalog Discovery
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1: Public Catalog Discovery ---");
    const dests = await executeTrustedOperation({ action: "list_payment_destinations" });
    const hasDests = Array.isArray(dests.destinations) && dests.destinations.length >= 2;
    record(1, "Public Payment Destinations Discovery", hasDests,
      `Found ${dests.destinations?.length || 0} active destinations`);

    const plans = await executeTrustedOperation({ action: "list_subscription_plans" });
    const hasPlans = Array.isArray(plans.plans) && plans.plans.length >= 4;
    record(2, "Public Subscription Plans Discovery", hasPlans,
      `Found ${plans.plans?.length || 0} multi-tier plans`);

    const rateCards = await executeTrustedOperation({ action: "list_ad_rate_cards" });
    const hasCards = Array.isArray(rateCards.rate_cards) && rateCards.rate_cards.length >= 5;
    record(3, "Public Ad Rate Cards Discovery", hasCards,
      `Found ${rateCards.rate_cards?.length || 0} placement rate cards`);

    const priceCalc = await executeTrustedOperation({
      action: "calculate_ad_price",
      data: { placement: "homepage_banner", duration_days: 14, is_targeted: true, is_featured: false }
    });
    const priceValid = typeof priceCalc.total_price === "number" && priceCalc.total_price > 0;
    record(4, "Ad Price Dynamic Calculation", priceValid,
      `14-day targeted homepage banner = $${priceCalc.total_price}`);

    // -------------------------------------------------------------------------
    // STEP 2: User Setup & Provider Free Job Quota Verification
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 2: Provider Free Job Quota ---");
    driver = await createTestUser("driver", "E2EDriver");
    advertiser = await createTestUser("passenger", "E2EAdvertiser");
    admin = await createTestUser("admin", "E2EAdmin");

    const subStatus = await executeTrustedOperation({
      action: "get_subscription_status",
      jwt: driver.jwt
    });
    const freeJobsOk = (subStatus.free_jobs_quota === 5 || subStatus.free_jobs_total === 5) && subStatus.free_jobs_remaining === 5;
    record(5, "Provider First 5 Free Jobs Quota", freeJobsOk,
      `Free jobs remaining: ${subStatus.free_jobs_remaining}/${subStatus.free_jobs_quota || subStatus.free_jobs_total}`);

    // -------------------------------------------------------------------------
    // STEP 3: Provider Subscription Purchase & Activation Flow
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3: Provider Subscription Lifecycle ---");
    const chosenDest = dests.destinations[0];
    const subRef = `ECO-SUB-${Date.now()}`;

    // Driver submits EcoCash payment for TransMove Professional ($15)
    const paymentSub = await executeTrustedOperation({
      action: "submit_ecocash_payment",
      jwt: driver.jwt,
      data: {
        payment_type: "subscription",
        related_id: "professional",
        payment_destination_id: chosenDest.$id,
        sender_name: "Tinashe Driver",
        sender_phone: "0787111222",
        transaction_reference: subRef,
        proof_file_id: "e2e_proof_screenshot_1",
        amount_declared: 15.00
      }
    });
    cleanup.payments.push(paymentSub.$id);

    const subPendingOk = paymentSub.status === "pending_review" && paymentSub.amount_expected === 15;
    record(6, "Provider EcoCash Payment Submission", subPendingOk,
      `Ref: ${paymentSub.reference}, Expected: $${paymentSub.amount_expected}, Status: ${paymentSub.status}`);

    // Admin lists pending payments and sees submission
    const pendingList = await executeTrustedOperation({
      action: "admin_list_pending_payments",
      jwt: admin.jwt,
      data: { status: "pending_review" }
    });
    const foundInQueue = (pendingList.payments || []).some(p => p.$id === paymentSub.$id);
    record(7, "Admin Pending Payment Queue Visibility", foundInQueue,
      `Payment found in pending queue`);

    // Admin approves payment
    const approvalRes = await executeTrustedOperation({
      action: "admin_approve_payment",
      jwt: admin.jwt,
      data: { payment_id: paymentSub.$id }
    });
    record(8, "Admin Payment Approval", approvalRes.status === "approved",
      `Payment approved by admin`);

    // Driver checks subscription status — must now be active!
    const activeSubStatus = await executeTrustedOperation({
      action: "get_subscription_status",
      jwt: driver.jwt
    });
    const subActivated = activeSubStatus.active === true &&
      activeSubStatus.plan.includes("Professional") &&
      Boolean(activeSubStatus.expires_at);
    record(9, "Provider Subscription Instant Activation", subActivated,
      `Active: ${activeSubStatus.active}, Plan: ${activeSubStatus.plan}, Expires: ${activeSubStatus.expires_at}`);

    // Track active subscription for cleanup
    const subQuery = encodeURIComponent(JSON.stringify({ method: "equal", attribute: "user_id", values: [driver.user.$id] }));
    const subFetch = await fetch(`${endpoint}/databases/transmove/collections/subscriptions/documents?queries[]=${subQuery}`, { headers: serverHeaders });
    if (subFetch.ok) {
      const subJson = await subFetch.json();
      (subJson.documents || []).forEach(s => cleanup.subscriptions.push(s.$id));
    }

    // -------------------------------------------------------------------------
    // STEP 4: Advertising Campaign Lifecycle
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 4: Advertising Campaign Lifecycle ---");
    // Advertiser creates campaign
    const campaign = await executeTrustedOperation({
      action: "submit_ad_campaign",
      jwt: advertiser.jwt,
      data: {
        business_name: "Sunrise Agro Logistics",
        title: "Fresh Farm Produce Transport",
        description: "Refrigerated trucks available for Harare to Bulawayo route daily.",
        destination_url: "https://sunriseagro.co.zw",
        placement: "homepage_banner",
        duration_days: 7,
        is_targeted: false,
        is_featured: false
      }
    });
    cleanup.campaigns.push(campaign.$id);
    record(10, "Ad Campaign Creation", Boolean(campaign.$id && campaign.amount_expected > 0),
      `Campaign ID: ${campaign.$id}, Budget Expected: $${campaign.amount_expected}`);

    // Advertiser submits EcoCash payment for campaign
    const adPayRef = `ECO-AD-${Date.now()}`;
    const adPayment = await executeTrustedOperation({
      action: "submit_ecocash_payment",
      jwt: advertiser.jwt,
      data: {
        payment_type: "advertising",
        related_id: campaign.$id,
        payment_destination_id: chosenDest.$id,
        sender_name: "Sunrise Accounts",
        sender_phone: "0787333444",
        transaction_reference: adPayRef,
        proof_file_id: "e2e_ad_proof_screenshot",
        amount_declared: campaign.amount_expected
      }
    });
    cleanup.payments.push(adPayment.$id);
    record(11, "Ad Campaign Payment Submission", adPayment.status === "pending_review",
      `Payment linked to campaign ${campaign.$id}`);

    // Admin approves ad content
    const adContentApproval = await executeTrustedOperation({
      action: "admin_approve_ad_content",
      jwt: admin.jwt,
      data: { campaign_id: campaign.$id }
    });
    record(12, "Admin Ad Content Moderation", adContentApproval.status === "active",
      `Ad campaign content marked active`);

    // Admin approves ad payment
    const adPayApproval = await executeTrustedOperation({
      action: "admin_approve_payment",
      jwt: admin.jwt,
      data: { payment_id: adPayment.$id }
    });
    record(13, "Admin Ad Payment Approval", adPayApproval.status === "approved",
      `Ad payment verified and approved`);

    // -------------------------------------------------------------------------
    // STEP 5: Payment Rejection Workflow
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5: Payment Rejection Workflow ---");
    const badRef = `ECO-REJECT-${Date.now()}`;
    const badPayment = await executeTrustedOperation({
      action: "submit_ecocash_payment",
      jwt: driver.jwt,
      data: {
        payment_type: "subscription",
        related_id: "flex-pass",
        payment_destination_id: chosenDest.$id,
        sender_name: "Invalid Payer",
        sender_phone: "0787555666",
        transaction_reference: badRef,
        proof_file_id: "fake_proof_screenshot_rejected"
      }
    });
    cleanup.payments.push(badPayment.$id);

    // Admin rejects with explicit reason
    const rejection = await executeTrustedOperation({
      action: "admin_reject_payment",
      jwt: admin.jwt,
      data: {
        payment_id: badPayment.$id,
        rejection_reason: "EcoCash reference code not found on statement"
      }
    });
    record(14, "Admin Payment Rejection", rejection.status === "rejected",
      `Payment marked as rejected with mandatory audit note`);

    // Confirm driver's previously approved subscription is NOT affected
    const subAfterReject = await executeTrustedOperation({
      action: "get_subscription_status",
      jwt: driver.jwt
    });
    record(15, "Provider Subscription Persistence", subAfterReject.active === true,
      `Subscription remains active despite subsequent rejected payment`);

  } finally {
    console.log("\n------------------------------------------------------------------");
    console.log("CLEANING UP TEMPORARY E2E TEST DATA...");
    for (const id of cleanup.payments) {
      await serverDelete("payments", id);
    }
    for (const id of cleanup.subscriptions) {
      await serverDelete("subscriptions", id);
    }
    for (const id of cleanup.campaigns) {
      await serverDelete("ad_campaigns", id);
    }
    for (const id of cleanup.profiles) {
      await serverDelete("profiles", id);
    }
    for (const id of cleanup.users) {
      await serverDeleteUser(id);
    }
    console.log("E2E Cleanup completed successfully.");
  }

  console.log("\n==================================================================");
  console.log("E2E TEST SUMMARY");
  console.log("==================================================================");
  let allPass = true;
  for (const [name, res] of Object.entries(results)) {
    if (!res.startsWith("PASS")) allPass = false;
    console.log(`${res.startsWith("PASS") ? "✅" : "❌"} ${name}: ${res}`);
  }
  console.log("==================================================================");

  if (!allPass) {
    console.error("FAIL: Some E2E tests failed.");
    process.exit(1);
  } else {
    console.log("SUCCESS: All 15/15 E2E lifecycle tests PASSED!");
  }
}

runE2ETests().catch((err) => {
  console.error("FATAL ERROR running E2E test suite:", err);
  process.exit(1);
});
