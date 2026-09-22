// ==============================================================================
// TRANSMOVE — PROFILE PHOTO E2E (7 AUTHORITATIVE ASSERTIONS)
// Exercises the real local HTTP server, trusted API, Supabase, and private Drive.
// ==============================================================================

import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { googleDriveStorage } from "../src/server/google-drive-storage.js";
import { avatarInitials, resolveAvatarUrl } from "../src/utils/avatar.js";

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

const TEST_PORT = 8098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function waitForServer(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local server exited with code ${child.exitCode}`);
    try {
      const response = await fetch(`${BASE_URL}/api/config`);
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the profile-photo HTTP test server.");
}

async function run() {
  console.log("============================================================");
  console.log("TRANSMOVE PROFILE PHOTO E2E — 7 ASSERTIONS");
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
  const email = `profile.photo.${stamp}@transmove.test`;
  const password = "TransMovePhoto2026!";
  const fullName = "Simba Musasu";
  let userId = null;
  let jwt = null;
  let fileId = null;
  let serverProcess = null;
  let serverLogs = "";

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "passenger" }
    });
    if (authError) throw authError;
    userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: fullName,
      email,
      role: "passenger",
      account_status: "active",
      verification_status: "unverified",
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { data: loginData, error: loginError } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (loginError) throw loginError;
    jwt = loginData.session.access_token;

    serverProcess = spawn(process.execPath, ["server.js"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(TEST_PORT) },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    serverProcess.stdout.on("data", (chunk) => { serverLogs += chunk.toString(); });
    serverProcess.stderr.on("data", (chunk) => { serverLogs += chunk.toString(); });
    await waitForServer(serverProcess);

    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl2QAAAAASUVORK5CYII=";
    const uploadResponse = await fetch(`${BASE_URL}/api/trusted-api`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`
      },
      body: JSON.stringify({
        action: "upload_profile_picture",
        data: {
          file_base64: pngBase64,
          original_filename: `avatar-${stamp}.png`,
          mime_type: "image/png"
        }
      })
    });
    const upload = await uploadResponse.json();
    fileId = upload.file_id;
    assert(uploadResponse.status === 200 && Boolean(fileId), 1, "Authenticated user uploads profile photo through HTTP backend");

    const metadata = await googleDriveStorage.getFileMetadata(fileId);
    assert(metadata?.id === fileId && metadata?.mimeType === "image/png", 2, "Private Google Drive photo object created");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, profile_image_id, profile_photo_url, updated_at")
      .eq("id", userId)
      .single();
    assert(profile?.profile_image_id === fileId && profile?.profile_photo_url === `/api/files/preview/${fileId}`, 3, "Supabase profile references authoritative photo fields");

    const previewResponse = await fetch(`${BASE_URL}/api/files/preview/${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
    const previewBytes = Buffer.from(await previewResponse.arrayBuffer());
    assert(previewResponse.status === 200 && previewBytes.length > 0, 4, "Authenticated profile-photo preview returns HTTP 200");
    assert(String(previewResponse.headers.get("content-type") || "").startsWith("image/png"), 5, "Profile-photo preview returns the correct image MIME type");

    const resolvedPhoto = resolveAvatarUrl(profile);
    const privateExposureBlocked = !/drive\.google\.com|googleusercontent\.com/i.test(
      `${upload.photo_url || ""} ${profile.profile_photo_url || ""} ${resolvedPhoto || ""}`
    );
    assert(privateExposureBlocked && /\/api\/files\/preview\//.test(resolvedPhoto), 6, "No public Drive URL is exposed; shared resolver uses backend preview proxy");

    const missingPhotoUrl = resolveAvatarUrl({ full_name: fullName, profile_image_id: "", profile_photo_url: "" });
    assert(missingPhotoUrl === "" && avatarInitials(fullName) === "SM", 7, "Missing photo resolves to professional initials placeholder");
  } catch (error) {
    console.error("[FATAL]", error.stack || error.message);
    if (serverLogs) console.error(serverLogs);
  } finally {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await new Promise((resolve) => serverProcess.once("exit", resolve));
    }
    if (fileId) await googleDriveStorage.deleteFile(fileId).catch(() => {});
    if (userId) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
  }

  console.log("============================================================");
  console.log(`PROFILE PHOTO TEST TOTALS: ${passed} PASSED, ${failed} FAILED (TOTAL 7)`);
  console.log("============================================================");
  if (passed !== 7 || failed !== 0) process.exit(1);
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
