// ==============================================================================
// TRANSMOVE — SUBSCRIPTION PAYMENT E2E (28 AUTHORITATIVE ASSERTIONS)
// Exercises the real HTTP trusted-api handler, Supabase, and private Google Drive.
// ==============================================================================

import http from "http";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";
import { googleDriveStorage } from "../src/server/google-drive-storage.js";

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

const TEST_PORT = 8097;
const originalFetch = globalThis.fetch;
let appwriteReads = 0;
let appwriteWrites = 0;
let appwriteAuth = 0;

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
    const request = http.request({
      hostname: "127.0.0.1",
      port: TEST_PORT,
      path: "/api/trusted-api",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      }
    }, (response) => {
      let responseBody = "";
      response.on("data", (chunk) => { responseBody += chunk; });
      response.on("end", () => {
        let parsed = {};
        try { parsed = JSON.parse(responseBody); } catch (_) { parsed = { raw: responseBody }; }
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

async function createTestIdentity({ email, password, fullName, role, createdUsers }) {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role }
  });
  if (authError) throw authError;
  createdUsers.push(authData.user.id);

  const now = new Date().toISOString();
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: authData.user.id,
    full_name: fullName,
    email,
    role,
    account_status: "active",
    verification_status: role === "admin" ? "approved" : "verified",
    updated_at: now
  }, { onConflict: "id" });
  if (profileError) throw profileError;

  const { data: loginData, error: loginError } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (loginError) throw loginError;
  return { id: authData.user.id, jwt: loginData.session.access_token, email };
}

async function run() {
  console.log("============================================================");
  console.log("TRANSMOVE SUBSCRIPTION PAYMENT E2E — 28 ASSERTIONS");
  console.log("============================================================");

  let passed = 0;
  let failed = 0;
  const assert = (condition, number, description) => {
    if (condition) {
      passed++;
      console.log(`[PASS] ${number}. ${description}`);
    } else {
      failed++;
      console.error(`[FAIL] ${number}. ${description}`);
    }
  };

  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const password = "TransMoveE2E2026!";
  const createdUsers = [];
  const driveFiles = [];
  let server = null;
  let provider = null;
  let normalUser = null;
  let admin = null;
  let approvedPayment = null;
  let rejectedPayment = null;
  let cleanupSucceeded = false;

  try {
    server = await startTestServer();

    // Recover safely from any previously interrupted run of this exact test.
    const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const existingUser of existingAuthUsers?.users || []) {
      if (/^pay\.(?:provider|normal|admin)\..+@transmove\.test$/i.test(existingUser.email || "")) {
        await supabaseAdmin.auth.admin.deleteUser(existingUser.id).catch(() => {});
      }
    }

    provider = await createTestIdentity({
      email: `pay.provider.${stamp}@transmove.test`,
      password,
      fullName: `Payment Provider ${stamp}`,
      role: "driver",
      createdUsers
    });
    normalUser = await createTestIdentity({
      email: `pay.normal.${stamp}@transmove.test`,
      password,
      fullName: `Payment Normal ${stamp}`,
      role: "passenger",
      createdUsers
    });
    admin = await createTestIdentity({
      email: `pay.admin.${stamp}@transmove.test`,
      password,
      fullName: `Payment Admin ${stamp}`,
      role: "admin",
      createdUsers
    });
    assert(Boolean(provider.id && provider.jwt), 1, "Temporary normal provider created and authenticated");

    const plansResponse = await callApi(provider.jwt, "list_subscription_plans");
    const plans = plansResponse.body.plans || [];
    assert(plansResponse.status === 200 && plans.length === 4, 2, "Subscription plans retrieved through HTTP backend");

    const destinationsResponse = await callApi(provider.jwt, "list_payment_destinations");
    const destinations = destinationsResponse.body.destinations || [];
    assert(destinationsResponse.status === 200, 3, "Active payment destinations retrieved through HTTP backend");
    assert(destinations.length > 0, 4, "Payment destination list is not empty");

    const destination = destinations[0];
    assert(Boolean(destination?.id), 5, "Authoritative destination account selected by stable ID");

    const plan = plans.find((entry) => entry.slug === "professional") || plans[0];
    assert(Boolean(plan?.id), 6, "Subscription plan selected by authoritative ID");
    assert(Number(plan.price) === 15, 7, "Expected amount is derived from the selected plan");

    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl2QAAAAASUVORK5CYII=";
    const proofUpload = await callApi(provider.jwt, "upload_payment_proof", {
      file_base64: pngBase64,
      original_filename: `payment-proof-${stamp}.png`,
      mime_type: "image/png"
    });
    const proofFileId = proofUpload.body.file_id;
    if (proofFileId) driveFiles.push(proofFileId);
    assert(proofUpload.status === 200 && Boolean(proofFileId), 8, "Test proof uploaded to private Google Drive through HTTP backend");

    const paymentSubmission = await callApi(provider.jwt, "submit_ecocash_payment", {
      payment_type: "subscription",
      plan_id: plan.id,
      destination_account_id: destination.id,
      sender_name: "Payment Provider",
      sender_phone: "+263771234567",
      transaction_reference: `E2E-APPROVE-${stamp}`,
      proof_file_id: proofFileId,
      amount_declared: Number(plan.price)
    });
    approvedPayment = paymentSubmission.body;
    assert(paymentSubmission.status === 200 && Boolean(approvedPayment.id), 9, "Payment submission succeeds through HTTP backend");

    const { data: createdPaymentRow } = await supabaseAdmin.from("payments").select("*").eq("id", approvedPayment.id).maybeSingle();
    assert(Boolean(createdPaymentRow), 10, "Payment row created in Supabase");
    assert(createdPaymentRow?.user_id === provider.id, 11, "Payment user_id matches authenticated provider");

    const { data: pendingSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*, plan_details:subscription_plans(*)")
      .eq("id", approvedPayment.subscription_id)
      .maybeSingle();
    assert(pendingSubscription?.plan_id === plan.id, 12, "Payment is linked to the selected plan");
    assert(Number(createdPaymentRow?.amount) === Number(plan.price), 13, "Stored payment amount matches authoritative plan price");
    assert(createdPaymentRow?.payment_destination_id === destination.id, 14, "Stored destination account matches authoritative selection");

    const proofMetadata = await googleDriveStorage.getFileMetadata(proofFileId);
    assert(proofMetadata?.id === proofFileId && proofMetadata?.mimeType === "image/png", 15, "Private Drive proof metadata exists");
    assert(createdPaymentRow?.status === "pending_review", 16, "Submitted payment status is pending_review");

    const selfApproval = await callApi(provider.jwt, "admin_approve_payment", { payment_id: approvedPayment.id });
    assert(selfApproval.status === 403, 17, "Provider cannot self-approve payment");

    const nonAdminApproval = await callApi(normalUser.jwt, "admin_approve_payment", { payment_id: approvedPayment.id });
    assert(nonAdminApproval.status === 403, 18, "Non-admin cannot approve another user's payment");

    const preview = await callApi(admin.jwt, "admin_create_payment_proof_token", { payment_id: approvedPayment.id });
    assert(preview.status === 200 && preview.body.mime_type === "image/png" && Boolean(preview.body.base64), 19, "Admin can preview private payment proof");

    const approval = await callApi(admin.jwt, "admin_approve_payment", { payment_id: approvedPayment.id });
    assert(approval.status === 200 && approval.body.status === "approved", 20, "Admin approval succeeds");

    const { data: approvedRow } = await supabaseAdmin.from("payments").select("*").eq("id", approvedPayment.id).single();
    assert(approvedRow?.status === "approved", 21, "Payment status becomes approved");

    const { data: activeSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*, plan_details:subscription_plans(*)")
      .eq("id", approvedPayment.subscription_id)
      .single();
    assert(activeSubscription?.status === "active" && Boolean(activeSubscription.started_at && activeSubscription.expires_at), 22, "Subscription becomes active with start and expiry dates");
    assert(activeSubscription?.plan_id === plan.id && activeSubscription?.plan_details?.name === plan.name, 23, "Activated subscription uses the selected plan");

    const rejectProof = await callApi(provider.jwt, "upload_payment_proof", {
      file_base64: pngBase64,
      original_filename: `payment-proof-reject-${stamp}.png`,
      mime_type: "image/png"
    });
    if (rejectProof.body.file_id) driveFiles.push(rejectProof.body.file_id);
    const rejectionSubmission = await callApi(provider.jwt, "submit_ecocash_payment", {
      payment_type: "subscription",
      plan_id: plan.id,
      destination_account_id: destination.id,
      sender_name: "Payment Provider",
      sender_phone: "+263771234567",
      transaction_reference: `E2E-REJECT-${stamp}`,
      proof_file_id: rejectProof.body.file_id,
      amount_declared: Number(plan.price)
    });
    rejectedPayment = rejectionSubmission.body;
    const rejection = await callApi(admin.jwt, "admin_reject_payment", {
      payment_id: rejectedPayment.id,
      rejection_reason: "Automated rejection-path validation"
    });
    const { data: rejectedRow } = await supabaseAdmin.from("payments").select("*").eq("id", rejectedPayment.id).single();
    const { data: inactiveSubscription } = await supabaseAdmin.from("subscriptions").select("status").eq("id", rejectedPayment.subscription_id).single();
    assert(rejection.status === 200 && rejectedRow?.status === "rejected" && inactiveSubscription?.status !== "active", 24, "Separate rejection path rejects payment without activation");

    assert(appwriteReads === 0, 25, "Appwrite reads = 0");
    assert(appwriteWrites === 0, 26, "Appwrite writes = 0");
    assert(appwriteAuth === 0, 27, "Appwrite auth = 0");
  } catch (error) {
    console.error("[FATAL]", error.stack || error.message);
  } finally {
    try {
      if (server) await new Promise((resolve) => server.close(resolve));
      if (createdUsers.length) {
        await supabaseAdmin.from("payments").delete().in("user_id", createdUsers);
        await supabaseAdmin.from("subscriptions").delete().in("user_id", createdUsers);
      }
      for (const fileId of driveFiles) {
        await googleDriveStorage.deleteFile(fileId).catch(() => {});
      }
      for (const userId of createdUsers) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      }
      const ids = new Set(createdUsers);
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter((row) => !ids.has(row.id) && !ids.has(row.user_id));
      supabaseBackendEngine.db.payments = supabaseBackendEngine.db.payments.filter((row) => !ids.has(row.user_id));
      supabaseBackendEngine.db.subscriptions = supabaseBackendEngine.db.subscriptions.filter((row) => !ids.has(row.user_id));
      supabaseBackendEngine._persistLocalDb();
      cleanupSucceeded = true;
    } catch (cleanupError) {
      console.error("[CLEANUP ERROR]", cleanupError.message);
    }
  }

  assert(cleanupSucceeded, 28, "Temporary users, rows, and private proof files cleaned up");
  console.log("============================================================");
  console.log(`PAYMENT E2E TOTALS: ${passed} PASSED, ${failed} FAILED (TOTAL 28)`);
  console.log(`APPWRITE CALLS: reads=${appwriteReads}, writes=${appwriteWrites}, auth=${appwriteAuth}`);
  console.log("============================================================");
  if (passed !== 28 || failed !== 0) process.exit(1);
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
