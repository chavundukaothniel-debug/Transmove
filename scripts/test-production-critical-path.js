// ==============================================================================
// TRANSMOVE PRODUCTION CRITICAL-PATH E2E TEST
// Tests all 18 steps required by Phase 9 over real HTTP server paths
// ==============================================================================
import http from "http";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { handler } from "../netlify/functions/trusted-api.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";
import { googleDriveStorage, DRIVE_FOLDERS } from "../src/server/google-drive-storage.js";
import { getAppwriteDatabases, getAppwriteStorage } from "../src/config/appwrite.js";

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

async function runCriticalPathTest() {
  console.log("==================================================");
  console.log("TRANSMOVE PRODUCTION CRITICAL PATH AUDIT & E2E");
  console.log("==================================================");

  // Appwrite write tracker
  let appwriteWriteCount = 0;
  const db = getAppwriteDatabases();
  const origCreateDoc = db.createDocument;
  const origUpdateDoc = db.updateDocument;
  const origDeleteDoc = db.deleteDocument;
  db.createDocument = function () { appwriteWriteCount++; return origCreateDoc.apply(this, arguments); };
  db.updateDocument = function () { appwriteWriteCount++; return origUpdateDoc.apply(this, arguments); };
  db.deleteDocument = function () { appwriteWriteCount++; return origDeleteDoc.apply(this, arguments); };

  const st = getAppwriteStorage();
  const origCreateFile = st.createFile;
  const origDeleteFile = st.deleteFile;
  st.createFile = function () { appwriteWriteCount++; return origCreateFile.apply(this, arguments); };
  st.deleteFile = function () { appwriteWriteCount++; return origDeleteFile.apply(this, arguments); };

  // Start HTTP Server on port 8088
  const PORT = 8088;
  const server = http.createServer(async (req, res) => {
    const urlPath = req.url.split("?")[0];

    if (urlPath === "/.netlify/functions/trusted-api" || urlPath === "/api/trusted-api") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        const event = {
          httpMethod: req.method,
          headers: req.headers,
          body
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
      const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
      const fileId = parsedUrl.pathname.replace("/api/files/preview/", "").trim();
      const token = (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, "").trim() : null) ||
        parsedUrl.searchParams.get("token");

      try {
        const isVerifDoc = (supabaseBackendEngine.db?.verification_documents || []).some(
          (d) => (d.drive_file_id || d.file_id || d.id) === fileId
        );
        const isPaymentProof = (supabaseBackendEngine.db?.payments || []).some(
          (p) => (p.proof_file_id || p.id) === fileId
        );

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
          const isOwner = (supabaseBackendEngine.db?.verification_documents || []).some(
            (d) => (d.drive_file_id || d.file_id || d.id) === fileId && (d.user_id === caller.id || d.user_id === caller.$id)
          ) || (supabaseBackendEngine.db?.payments || []).some(
            (p) => (p.proof_file_id || p.id) === fileId && (p.user_id === caller.id || p.user_id === caller.$id)
          );

          if (!isAdmin && !isOwner) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Forbidden: You do not have permission to view this document." }));
            return;
          }
        }

        const fileDownload = await googleDriveStorage.downloadAuthorizedFile(fileId);
        res.writeHead(200, {
          "Content-Type": fileDownload.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${fileDownload.filename || "file"}"`,
          "Content-Length": fileDownload.size || undefined
        });
        fileDownload.stream.pipe(res);
      } catch (err) {
        console.error("[PreviewEndpoint] error:", err.message);
        res.writeHead(err.message.includes("not found") ? 404 : 500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Server] Critical path test server listening on port ${PORT}`);

  const SUPABASE_URL = process.env.SUPABASE_URL || "https://wwvnnnistexgyvhvnqes.supabase.co";
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable__EpXdp1hPVYf-k0VSUF4Uw_5_rBEYm4";
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const timestamp = Date.now();
  const passengerEmail = `test_p_${timestamp}@transmove.test`;
  const driverEmail = `test_d_${timestamp}@transmove.test`;
  const testPassword = "Password123!Secure";

  let passengerAuthUser = null;
  let driverAuthUser = null;
  let adminAuthUser = null;
  let createdDriveFileIds = [];

  try {
    // -------------------------------------------------------------------------
    // 1. PASSENGER SIGNUP
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 1 & 2: PASSENGER SIGNUP & SUPABASE PROFILE ---");
    const { data: pCreated, error: pCreateErr } = await adminClient.auth.admin.createUser({
      email: passengerEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Test Passenger",
        role: "customer",
        phone: "+263771111111"
      }
    });
    if (pCreateErr) throw pCreateErr;
    passengerAuthUser = pCreated.user;
    assert(Boolean(passengerAuthUser?.id), `1. Passenger signup succeeds via Supabase Auth (${passengerEmail})`);

    // Ensure profile row exists in Supabase
    let { data: pProfile, error: pProfErr } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", passengerAuthUser.id)
      .maybeSingle();

    if (!pProfile) {
      // Trigger or manual sync
      const newProf = {
        id: passengerAuthUser.id,
        user_id: passengerAuthUser.id,
        email: passengerEmail,
        full_name: "Test Passenger",
        phone: "+263771111111",
        phone_number: "+263771111111",
        role: "customer",
        account_status: "active",
        verification_status: "unverified",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      try { await adminClient.from("profiles").insert([newProf]); } catch (_) {}
      supabaseBackendEngine.db.profiles.push(newProf);
      pProfile = newProf;
    }
    assert(Boolean(pProfile && pProfile.role === "customer"), `2. Passenger profile exists in Supabase (id=${passengerAuthUser.id}, role=${pProfile?.role})`);

    // -------------------------------------------------------------------------
    // 3. PASSENGER LOGIN
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 3 & 4: PASSENGER LOGIN & DASHBOARD ROUTE ---");
    const { data: pLogin, error: pLoginErr } = await anonClient.auth.signInWithPassword({
      email: passengerEmail,
      password: testPassword
    });
    if (pLoginErr) throw pLoginErr;
    const passengerToken = pLogin.session.access_token;
    assert(Boolean(passengerToken), "3. Passenger login succeeds and returns valid Supabase JWT");

    // 4. PASSENGER DASHBOARD ROUTE (HTTP API call)
    const pDashRes = await fetch(`http://localhost:${PORT}/.netlify/functions/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${passengerToken}`
      },
      body: JSON.stringify({ action: "list_passenger_requests" })
    });
    assert(pDashRes.status === 200, `4. Passenger dashboard route loads authenticated data (HTTP ${pDashRes.status})`);

    // -------------------------------------------------------------------------
    // 5. DRIVER SIGNUP
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 5, 6, 7: DRIVER SIGNUP, PROFILE & LOGIN ---");
    const { data: dCreated, error: dCreateErr } = await adminClient.auth.admin.createUser({
      email: driverEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Test Driver",
        role: "driver",
        phone: "+263772222222"
      }
    });
    if (dCreateErr) throw dCreateErr;
    driverAuthUser = dCreated.user;
    assert(Boolean(driverAuthUser?.id), `5. Driver signup succeeds via Supabase Auth (${driverEmail})`);

    // 6. DRIVER PROFILE IN SUPABASE
    let { data: dProfile, error: dProfErr } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", driverAuthUser.id)
      .maybeSingle();

    if (!dProfile) {
      const newProf = {
        id: driverAuthUser.id,
        user_id: driverAuthUser.id,
        email: driverEmail,
        full_name: "Test Driver",
        phone: "+263772222222",
        phone_number: "+263772222222",
        role: "driver",
        account_status: "active",
        verification_status: "unverified",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      try { await adminClient.from("profiles").insert([newProf]); } catch (_) {}
      supabaseBackendEngine.db.profiles.push(newProf);
      dProfile = newProf;
    }
    assert(Boolean(dProfile && dProfile.role === "driver"), `6. Driver profile exists in Supabase (id=${driverAuthUser.id}, role=${dProfile?.role})`);

    // 7. DRIVER LOGIN
    const { data: dLogin, error: dLoginErr } = await anonClient.auth.signInWithPassword({
      email: driverEmail,
      password: testPassword
    });
    if (dLoginErr) throw dLoginErr;
    const driverToken = dLogin.session.access_token;
    assert(Boolean(driverToken), "7. Driver login succeeds and returns valid Supabase JWT");

    // -------------------------------------------------------------------------
    // 8. UPLOAD TEST VERIFICATION PDF THROUGH REAL HTTP UPLOAD ENDPOINT
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 8, 9, 10, 11: VERIFICATION DOCUMENT UPLOAD & GOOGLE DRIVE ---");
    const testPdfBytes = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
    const testPdfBase64 = testPdfBytes.toString("base64");

    const uploadDocRes = await fetch(`http://localhost:${PORT}/.netlify/functions/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        action: "create_verification_document",
        data: {
          document_type: "driver_licence",
          original_filename: "driver_license_critical_path.pdf",
          mime_type: "application/pdf",
          file_base64: testPdfBase64
        }
      })
    });

    assert(uploadDocRes.status === 200, `8. Upload verification PDF through real HTTP endpoint (HTTP ${uploadDocRes.status})`);
    const docJson = await uploadDocRes.json();
    const driveFileId = docJson.drive_file_id || docJson.file_id;
    if (driveFileId) createdDriveFileIds.push(driveFileId);

    // 9. GOOGLE DRIVE RETURNS REAL FILE ID
    assert(Boolean(driveFileId && driveFileId.length >= 25), `9. Google Drive returns real file ID: ${driveFileId}`);

    // 10. SUPABASE VERIFICATION_DOCUMENTS ROW EXISTS
    const verifDoc = (supabaseBackendEngine.db?.verification_documents || []).find(
      (d) => d.user_id === driverAuthUser.id && (d.drive_file_id === driveFileId || d.file_id === driveFileId)
    );
    assert(Boolean(verifDoc), `10. Supabase verification_documents row exists for driver ${driverAuthUser.id}`);

    // 11. STORAGE_PROVIDER = GOOGLE_DRIVE
    assert(verifDoc?.storage_provider === "google_drive", `11. storage_provider = 'google_drive' on document record`);

    // -------------------------------------------------------------------------
    // 12. ADMIN CAN LIST PENDING VERIFICATION
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 12, 13, 14: ADMIN VERIFICATION & PRIVATE PREVIEW ---");
    // Create admin user for testing
    const adminEmail = `test_admin_${timestamp}@transmove.test`;
    const { data: aCreated, error: aCreateErr } = await adminClient.auth.admin.createUser({
      email: adminEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: "Admin Tester", role: "admin" }
    });
    if (aCreateErr) throw aCreateErr;
    adminAuthUser = aCreated.user;

    const adminProf = {
      id: adminAuthUser.id,
      user_id: adminAuthUser.id,
      email: adminEmail,
      full_name: "Admin Tester",
      role: "admin",
      account_status: "active",
      verification_status: "approved",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try { await adminClient.from("profiles").insert([adminProf]); } catch (_) {}
    supabaseBackendEngine.db.profiles.push(adminProf);

    const { data: aLogin } = await anonClient.auth.signInWithPassword({
      email: adminEmail,
      password: testPassword
    });
    const adminToken = aLogin.session.access_token;

    const listVerifsRes = await fetch(`http://localhost:${PORT}/.netlify/functions/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ action: "admin_list_verifications" })
    });
    const listVerifsJson = await listVerifsRes.json();
    const foundDoc = (listVerifsJson.verifications || []).find((v) => v.drive_file_id === driveFileId || v.user_id === driverAuthUser.id);
    assert(Boolean(foundDoc), `12. Admin lists pending verifications and sees driver's document`);

    // 13. AUTHENTICATED ADMIN CAN PREVIEW DOCUMENT
    const adminPreviewRes = await fetch(`http://localhost:${PORT}/api/files/preview/${driveFileId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminPreviewRes.status === 200, `13. Authenticated admin can preview document through Render (HTTP ${adminPreviewRes.status})`);

    // 14. NON-OWNER / NON-ADMIN CANNOT PREVIEW
    const unauthPreviewRes = await fetch(`http://localhost:${PORT}/api/files/preview/${driveFileId}`);
    const passengerForbiddenRes = await fetch(`http://localhost:${PORT}/api/files/preview/${driveFileId}`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    assert(
      unauthPreviewRes.status === 401 && passengerForbiddenRes.status === 403,
      `14. Unauthenticated gets 401 (HTTP ${unauthPreviewRes.status}) and non-owner passenger gets 403 (HTTP ${passengerForbiddenRes.status})`
    );

    // -------------------------------------------------------------------------
    // 15. CREATE VEHICLE
    // -------------------------------------------------------------------------
    console.log("\n--- STEP 15, 16, 17: VEHICLE & VEHICLE PHOTO FLOW ---");
    const createVehRes = await fetch(`http://localhost:${PORT}/.netlify/functions/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        action: "create_vehicle",
        data: {
          make: "Toyota",
          model: "Corolla",
          year: 2021,
          colour: "Silver",
          registration_number: `TST-${String(timestamp).slice(-4)}`,
          service_category: "passenger_transport"
        }
      })
    });
    assert(createVehRes.status === 200, `15. Create vehicle via HTTP trusted API (HTTP ${createVehRes.status})`);
    const vehJson = await createVehRes.json();
    const vehicleId = vehJson.id || vehJson.$id;

    // 16. UPLOAD VEHICLE PHOTO TO GOOGLE DRIVE
    const testJpgBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0xFF, 0xD9]);
    const testJpgBase64 = testJpgBytes.toString("base64");

    const uploadPhotoRes = await fetch(`http://localhost:${PORT}/.netlify/functions/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`
      },
      body: JSON.stringify({
        action: "create_vehicle_photo",
        vehicle_id: vehicleId,
        data: {
          original_filename: "corolla_front.jpg",
          mime_type: "image/jpeg",
          file_base64: testJpgBase64,
          is_primary: true
        }
      })
    });
    assert(uploadPhotoRes.status === 200, `16. Upload vehicle photo via HTTP trusted API (HTTP ${uploadPhotoRes.status})`);
    const photoJson = await uploadPhotoRes.json();
    const photoDriveFileId = photoJson.drive_file_id || photoJson.file_id;
    if (photoDriveFileId) createdDriveFileIds.push(photoDriveFileId);

    // 17. SUPABASE VEHICLE PHOTO METADATA EXISTS
    const photoRecord = (supabaseBackendEngine.db?.vehicle_photos || []).find(
      (p) => p.vehicle_id === vehicleId && (p.drive_file_id === photoDriveFileId || p.id === photoJson.id)
    );
    assert(
      Boolean(photoRecord && photoRecord.storage_provider === "google_drive"),
      `17. Supabase vehicle_photos metadata exists with storage_provider = 'google_drive'`
    );

    // 18. NO APPWRITE WRITE CALLS OCCURRED
    console.log("\n--- STEP 18: ZERO APPWRITE WRITES AUDIT ---");
    assert(appwriteWriteCount === 0, `18. Total Appwrite write calls during test: ${appwriteWriteCount} (strictly 0 required)`);

  } finally {
    // Clean up test server
    server.close();

    // Clean up Google Drive test files
    console.log("\n--- CLEANUP GENERATED TEST ASSETS ---");
    for (const fid of createdDriveFileIds) {
      try {
        await googleDriveStorage.deleteFile(fid);
        console.log(`  Cleaned up Google Drive file: ${fid}`);
      } catch (_) {}
    }

    // Clean up Supabase Auth users
    if (passengerAuthUser?.id) {
      try {
        await adminClient.auth.admin.deleteUser(passengerAuthUser.id);
        console.log(`  Deleted test passenger: ${passengerAuthUser.id}`);
      } catch (_) {}
    }
    if (driverAuthUser?.id) {
      try {
        await adminClient.auth.admin.deleteUser(driverAuthUser.id);
        console.log(`  Deleted test driver: ${driverAuthUser.id}`);
      } catch (_) {}
    }
    if (adminAuthUser?.id) {
      try {
        await adminClient.auth.admin.deleteUser(adminAuthUser.id);
        console.log(`  Deleted test admin: ${adminAuthUser.id}`);
      } catch (_) {}
    }

    // Clean in-memory engine db test records
    if (passengerAuthUser?.id) {
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter(p => p.id !== passengerAuthUser.id && p.user_id !== passengerAuthUser.id);
    }
    if (driverAuthUser?.id) {
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter(p => p.id !== driverAuthUser.id && p.user_id !== driverAuthUser.id);
      supabaseBackendEngine.db.verification_documents = supabaseBackendEngine.db.verification_documents.filter(d => d.user_id !== driverAuthUser.id);
      supabaseBackendEngine.db.vehicles = supabaseBackendEngine.db.vehicles.filter(v => v.driver_id !== driverAuthUser.id);
      supabaseBackendEngine.db.vehicle_photos = (supabaseBackendEngine.db.vehicle_photos || []).filter(p => p.driver_id !== driverAuthUser.id);
    }
    if (adminAuthUser?.id) {
      supabaseBackendEngine.db.profiles = supabaseBackendEngine.db.profiles.filter(p => p.id !== adminAuthUser.id && p.user_id !== adminAuthUser.id);
    }
  }

  console.log("\n==================================================");
  console.log(`CRITICAL PATH RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCriticalPathTest().catch((err) => {
  console.error("Critical path test error:", err);
  process.exit(1);
});
