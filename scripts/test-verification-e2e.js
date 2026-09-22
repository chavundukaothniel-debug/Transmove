// ==============================================================================
// TRANSMOVE — VERIFICATION SUBMISSION & ADMIN QUEUE E2E TEST
// Tests:
// 1. Create temporary driver through Supabase Auth
// 2. Confirm profile row exists
// 3. Login as temporary driver to get JWT
// 4. Upload a small test PDF through actual verification upload endpoint
// 5. Confirm Google Drive upload succeeds
// 6. Query Supabase verification_documents
// 7. MUST find exactly the new record with correct schema
// 8. Confirm profile verification_status = 'pending'
// 9. Login as real/admin test admin
// 10. Admin pending verification endpoint MUST return driver
// 11. Admin preview MUST return document (HTTP 200)
// 12. Non-admin preview MUST be denied (HTTP 401 / 403)
// 13. Admin approves verification
// 14. Profile verification_status MUST become 'approved'
// 15. Safe cleanup of test records and files
// ==============================================================================

import http from "http";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";
import { googleDriveStorage, DRIVE_FOLDERS } from "../src/server/google-drive-storage.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_PORT = 8089;
let serverInstance = null;

// Start local HTTP server mirroring server.js for actual HTTP testing
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

      if (urlPath.startsWith("/api/files/preview/")) {
        const parsedUrl = new URL(req.url, `http://localhost:${TEST_PORT}`);
        const fileId = parsedUrl.pathname.replace("/api/files/preview/", "").trim();
        const token = (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim() : null) ||
          parsedUrl.searchParams.get("token") ||
          parsedUrl.searchParams.get("jwt");

        try {
          let isVerifDoc = false;
          let isPaymentProof = false;
          let docOwnerId = null;

          if (supabaseBackendEngine.isLive && supabaseBackendEngine.supabaseAdmin) {
            try {
              const { data: vDoc } = await supabaseBackendEngine.supabaseAdmin
                .from("verification_documents")
                .select("id, user_id, drive_file_id")
                .or(`drive_file_id.eq.${fileId},id.eq.${fileId}`)
                .maybeSingle();
              if (vDoc) {
                isVerifDoc = true;
                docOwnerId = vDoc.user_id;
              }
            } catch (_) {}
          }

          if (!isVerifDoc) {
            const localVDoc = (supabaseBackendEngine.db?.verification_documents || []).find(
              (d) => (d.drive_file_id || d.file_id || d.id) === fileId
            );
            if (localVDoc) {
              isVerifDoc = true;
              docOwnerId = localVDoc.user_id;
            }
          }

          if (isVerifDoc || isPaymentProof) {
            if (!token) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Authentication required to view confidential document." }));
              return;
            }

            let caller = null;
            try {
              caller = await supabaseBackendEngine.authenticateUser(token);
            } catch (_) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid authentication token." }));
              return;
            }

            const profile = await supabaseBackendEngine.getCallerProfile(caller.id);
            const isAdmin = profile?.role === "admin";
            const isOwner = docOwnerId && (caller.id === docOwnerId || caller.$id === docOwnerId);

            if (!isAdmin && !isOwner) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Forbidden: You do not have permission to view this document." }));
              return;
            }
          }

          const fileData = await googleDriveStorage.downloadAuthorizedFile(fileId);
          res.writeHead(200, {
            "Content-Type": fileData.mimeType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${fileData.filename}"`
          });
          fileData.stream.pipe(res);
          return;
        } catch (err) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "File not found." }));
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    srv.listen(TEST_PORT, () => {
      serverInstance = srv;
      resolve(srv);
    });
    srv.on("error", reject);
  });
}

async function runE2ETest() {
  console.log("==================================================");
  console.log("TRANSMOVE VERIFICATION SUBMISSION & ADMIN QUEUE E2E TEST");
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

  await startTestServer();
  console.log(`Test HTTP server listening on http://localhost:${TEST_PORT}`);

  const testSuffix = Date.now();
  const driverEmail = `test_driver_${testSuffix}@transmove.test`;
  const driverPassword = "DriverPassword2026!";
  const adminEmail = `test_admin_${testSuffix}@transmove.test`;
  const adminPassword = "AdminPassword2026!";
  const unauthorizedEmail = `test_unauth_${testSuffix}@transmove.test`;
  const unauthorizedPassword = "UnauthPassword2026!";

  let driverId = null;
  let driverJwt = null;
  let adminId = null;
  let adminJwt = null;
  let unauthJwt = null;
  let unauthId = null;

  let uploadedDriveFileId = null;
  let createdDocumentId = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: CREATE TEMPORARY DRIVER THROUGH SUPABASE AUTH
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1: CREATE DRIVER THROUGH SUPABASE AUTH ---");
    const { data: driverAuth, error: dAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: driverEmail,
      password: driverPassword,
      email_confirm: true,
      user_metadata: { full_name: "Tinashe Test Driver", role: "driver" }
    });
    assert(!dAuthErr && driverAuth?.user?.id, `Created temporary driver auth user: ${driverEmail}`);
    driverId = driverAuth.user.id;

    // STEP 2: CONFIRM PROFILE ROW EXISTS
    console.log("\n--- STEP 2: CONFIRM DRIVER PROFILE ROW EXISTS ---");
    // Ensure driver profile is explicitly unverified for test
    const { error: dUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "driver",
        verification_status: "unverified",
        account_status: "active"
      })
      .eq("id", driverId);

    assert(!dUpdateErr, "Updated temporary driver profile in Supabase to role='driver', verification_status='unverified'");

    const { data: profRow, error: pSelectErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, account_status, verification_status")
      .eq("id", driverId)
      .single();

    assert(!pSelectErr && profRow?.verification_status === "unverified", `Driver profile confirmed in public.profiles: verification_status='${profRow?.verification_status}'`);

    // STEP 3: LOGIN AS DRIVER
    console.log("\n--- STEP 3: DRIVER LOGIN VIA SUPABASE AUTH ---");
    const { data: dLogin, error: dLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: driverEmail,
      password: driverPassword
    });
    assert(!dLoginErr && dLogin?.session?.access_token, `Driver logged in, obtained live Supabase JWT (${dLogin?.session?.access_token.slice(0, 20)}...)`);
    driverJwt = dLogin.session.access_token;

    // Create temporary auth user using Supabase Admin API/service-role test setup
    console.log("\n--- SETUP: CREATE & PROMOTE TEST ADMIN ---");
    const { data: adminAuth, error: aAuthErr } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: "System Verification Admin" }
    });
    assert(!aAuthErr && adminAuth?.user?.id, `Created temporary admin auth user: ${adminEmail}`);
    adminId = adminAuth.user.id;

    // Promote ONLY that temporary test profile using server-side service-role
    const { error: aUpdateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "admin",
        account_status: "active",
        verification_status: "approved"
      })
      .eq("id", adminId);
    assert(!aUpdateErr, "Promoted temporary test admin profile via service-role: role='admin', account_status='active', verification_status='approved'");

    // Verify before admin tests: SELECT id, email, role, account_status from public.profiles where id = tempAdminId
    const { data: adminProf, error: aVerifyErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, account_status")
      .eq("id", adminId)
      .single();

    assert(!aVerifyErr && adminProf?.role === "admin" && adminProf?.account_status === "active",
      `Verified temporary admin profile: role='${adminProf?.role}', account_status='${adminProf?.account_status}'`);

    // Log in that temporary admin normally via Supabase Auth
    const { data: aLogin, error: aLoginErr } = await supabaseAnon.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    assert(!aLoginErr && aLogin?.session?.access_token, `Admin authenticated normally via Supabase Auth, obtained live JWT`);
    adminJwt = aLogin.session.access_token;

    // Also create unauthorized user for preview check
    const { data: unauthAuth } = await supabaseAdmin.auth.admin.createUser({
      email: unauthorizedEmail,
      password: unauthorizedPassword,
      email_confirm: true,
      user_metadata: { full_name: "Unauthorized Bystander", role: "customer" }
    });
    unauthId = unauthAuth.user.id;
    await supabaseAdmin.from("profiles").update({
      role: "customer",
      account_status: "active"
    }).eq("id", unauthId);
    const { data: uLogin } = await supabaseAnon.auth.signInWithPassword({
      email: unauthorizedEmail,
      password: unauthorizedPassword
    });
    unauthJwt = uLogin.session.access_token;

    // -------------------------------------------------------------------------
    // STEP 4: UPLOAD SMALL TEST PDF THROUGH ACTUAL VERIFICATION UPLOAD ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 4: UPLOAD VERIFICATION DOCUMENT VIA HTTP ENDPOINT ---");
    const testPdfBase64 = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n167\n%%EOF").toString("base64");

    const uploadRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverJwt}`
      },
      body: JSON.stringify({
        action: "create_verification_document",
        jwt: driverJwt,
        data: {
          document_type: "driver_licence",
          original_filename: "national_driver_licence_test.pdf",
          mime_type: "application/pdf",
          file_size: 256,
          file_base64: testPdfBase64
        }
      })
    });

    console.log(`  HTTP status: ${uploadRes.status} ${uploadRes.statusText}`);
    const uploadBody = await uploadRes.json();
    assert(uploadRes.status === 200, `Verification document upload endpoint returned HTTP 200`);
    assert(Boolean(uploadBody.drive_file_id), `Document record returned Google Drive file ID: ${uploadBody.drive_file_id}`);
    uploadedDriveFileId = uploadBody.drive_file_id;
    createdDocumentId = uploadBody.id;

    // -------------------------------------------------------------------------
    // STEP 5: CONFIRM GOOGLE DRIVE UPLOAD SUCCEEDS
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5: CONFIRM GOOGLE DRIVE UPLOAD ---");
    const driveMeta = await googleDriveStorage.getFileMetadata(uploadedDriveFileId);
    assert(Boolean(driveMeta && driveMeta.name), `Google Drive file exists in storage: "${driveMeta?.name}" (ID: ${uploadedDriveFileId})`);

    // -------------------------------------------------------------------------
    // STEP 6 & 7: QUERY SUPABASE VERIFICATION_DOCUMENTS FOR EXACT ROW
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 6 & 7: QUERY SUPABASE verification_documents TABLE ---");
    const { data: verifDocs, error: verifQueryErr } = await supabaseAdmin
      .from("verification_documents")
      .select("*")
      .eq("user_id", driverId);

    if (verifQueryErr) {
      console.error("  Supabase query error:", verifQueryErr);
      assert(false, `Supabase verification_documents query failed: ${verifQueryErr.message}`);
    } else {
      assert(verifDocs && verifDocs.length === 1, `Found exactly 1 record in public.verification_documents for user ${driverId}`);
      const doc = verifDocs[0];
      assert(doc.document_type === "driver_licence", `Document type matches: ${doc.document_type}`);
      assert(doc.storage_provider === "google_drive", `Storage provider is google_drive: ${doc.storage_provider}`);
      assert(doc.drive_file_id === uploadedDriveFileId, `Drive file ID matches: ${doc.drive_file_id}`);
      assert(doc.verification_status === "pending", `Verification status is pending: ${doc.verification_status}`);
      assert(Boolean(doc.created_at), `created_at timestamp exists: ${doc.created_at}`);
    }

    // -------------------------------------------------------------------------
    // STEP 8: CONFIRM PROFILE verification_status = 'pending'
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 8: CONFIRM PROFILE STATUS IN SUPABASE ---");
    const { data: updatedProfile } = await supabaseAdmin
      .from("profiles")
      .select("verification_status")
      .eq("id", driverId)
      .single();

    assert(
      updatedProfile?.verification_status === "pending",
      `Profile verification_status in Supabase became 'pending' (actual: '${updatedProfile?.verification_status}')`
    );

    // -------------------------------------------------------------------------
    // STEP 9 & 10: ADMIN PENDING VERIFICATION ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 9 & 10: ADMIN VERIFICATION QUEUE (admin_list_verifications) ---");
    const queueRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        action: "admin_list_verifications",
        jwt: adminJwt,
        data: { status_filter: "pending" }
      })
    });

    console.log(`  HTTP status: ${queueRes.status} ${queueRes.statusText}`);
    const queueBody = await queueRes.json();
    assert(queueRes.status === 200, `Admin verification queue returned HTTP 200`);

    const queueItems = queueBody.verifications || [];
    const matchedProvider = queueItems.find((p) => p.id === driverId || p.user_id === driverId);
    assert(Boolean(matchedProvider), `Admin queue contains the newly registered driver: ${driverEmail}`);
    assert(
      matchedProvider?.documents?.some((d) => d.drive_file_id === uploadedDriveFileId || d.id === createdDocumentId),
      `Admin queue provider record contains the uploaded verification document`
    );

    // -------------------------------------------------------------------------
    // STEP 11: ADMIN SECURE PREVIEW (STREAM FROM GOOGLE DRIVE)
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 11: ADMIN DOCUMENT PREVIEW ---");
    const previewRes = await fetch(`http://localhost:${TEST_PORT}/api/files/preview/${uploadedDriveFileId}`, {
      headers: { Authorization: `Bearer ${adminJwt}` }
    });

    console.log(`  HTTP status: ${previewRes.status} ${previewRes.statusText}`);
    assert(previewRes.status === 200, `Admin document preview returned HTTP 200`);
    const previewContentType = previewRes.headers.get("content-type");
    assert(previewContentType?.includes("pdf"), `Preview returned PDF stream: ${previewContentType}`);

    // -------------------------------------------------------------------------
    // STEP 12: NON-ADMIN PREVIEW DENIED
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 12: PREVIEW ACCESS CONTROL (401 & 403) ---");
    const noAuthRes = await fetch(`http://localhost:${TEST_PORT}/api/files/preview/${uploadedDriveFileId}`);
    console.log(`  Unauthenticated request HTTP status: ${noAuthRes.status}`);
    assert(noAuthRes.status === 401, `Unauthenticated preview request rejected with HTTP 401`);

    const unauthRes = await fetch(`http://localhost:${TEST_PORT}/api/files/preview/${uploadedDriveFileId}`, {
      headers: { Authorization: `Bearer ${unauthJwt}` }
    });
    console.log(`  Unauthorized user request HTTP status: ${unauthRes.status}`);
    assert(unauthRes.status === 403, `Unauthorized non-owner non-admin user request rejected with HTTP 403`);

    // -------------------------------------------------------------------------
    // STEP 13: APPROVE VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 13: ADMIN APPROVES VERIFICATION ---");
    const approveRes = await fetch(`http://localhost:${TEST_PORT}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`
      },
      body: JSON.stringify({
        action: "admin_verify_document",
        jwt: adminJwt,
        data: {
          document_id: createdDocumentId,
          verification_status: "approved"
        }
      })
    });

    console.log(`  HTTP status: ${approveRes.status} ${approveRes.statusText}`);
    assert(approveRes.status === 200, `Admin verify document returned HTTP 200`);

    // -------------------------------------------------------------------------
    // STEP 14: CONFIRM STATUS IN SUPABASE IS APPROVED
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 14: CONFIRM SUPABASE ROW AND PROFILE ARE APPROVED ---");
    const { data: approvedDoc } = await supabaseAdmin
      .from("verification_documents")
      .select("verification_status")
      .eq("id", createdDocumentId)
      .single();

    assert(
      approvedDoc?.verification_status === "approved",
      `verification_documents status in Supabase is 'approved' (actual: '${approvedDoc?.verification_status}')`
    );

    const { data: finalProfile } = await supabaseAdmin
      .from("profiles")
      .select("verification_status")
      .eq("id", driverId)
      .single();

    assert(
      finalProfile?.verification_status === "approved",
      `Driver profiles verification_status in Supabase became 'approved' (actual: '${finalProfile?.verification_status}')`
    );

  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    console.log("\n--- CLEANUP TEMPORARY TEST DATA ---");
    if (uploadedDriveFileId) {
      try {
        await googleDriveStorage.deleteFile(uploadedDriveFileId);
        console.log(`  ✓ Cleaned up test file from Google Drive: ${uploadedDriveFileId}`);
      } catch (e) {
        console.warn(`  Could not delete drive file: ${e.message}`);
      }
    }
    if (createdDocumentId) {
      await supabaseAdmin.from("verification_documents").delete().eq("id", createdDocumentId);
      console.log(`  ✓ Cleaned up verification_documents row`);
    }
    if (driverId) {
      await supabaseAdmin.from("profiles").delete().eq("id", driverId);
      await supabaseAdmin.auth.admin.deleteUser(driverId);
      console.log(`  ✓ Cleaned up driver profile and auth user`);
    }
    if (adminId) {
      await supabaseAdmin.from("profiles").delete().eq("id", adminId);
      await supabaseAdmin.auth.admin.deleteUser(adminId);
      console.log(`  ✓ Cleaned up admin profile and auth user`);
    }
    if (unauthId) {
      await supabaseAdmin.from("profiles").delete().eq("id", unauthId);
      await supabaseAdmin.auth.admin.deleteUser(unauthId);
      console.log(`  ✓ Cleaned up bystander profile and auth user`);
    }
    if (serverInstance) {
      serverInstance.close();
      console.log(`  ✓ Closed test HTTP server`);
    }
  }

  console.log("\n==================================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETest().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  if (serverInstance) serverInstance.close();
  process.exit(1);
});
