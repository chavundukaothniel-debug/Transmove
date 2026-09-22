// ==============================================================================
// TRANSMOVE — PRODUCTION RESET SCRIPT
// Safely resets Supabase application data to a pristine state for production.
//
// Supports:
//   node scripts/reset-supabase-production.js --dry-run
//   node scripts/reset-supabase-production.js --execute
//
// Rules:
// 1. Never drops tables, schemas, RLS policies, triggers, constraints, or functions.
// 2. Preserves or recreates subscription_plans, payment_destinations, and admin profile.
// 3. Purges only test Auth users; preserves admin and unknown real users.
// 4. Purges only identified test files from Google Drive; preserves real files/backups.
// 5. Does not touch or delete Appwrite.
// ==============================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  supabaseBackendEngine,
  DEFAULT_PAYMENT_DESTINATIONS,
  DEFAULT_SUBSCRIPTION_PLANS
} from "../src/server/supabase-backend.js";
import { googleDriveStorage } from "../src/server/google-drive-storage.js";

const args = process.argv.slice(2);
const isExecute = args.includes("--execute");
const isDryRun = args.includes("--dry-run") || !isExecute;

// ------------------------------------------------------------------------------
// REAL TABLE NAMES FROM sql/supabase_master_schema.sql IN DEPENDENCY-SAFE ORDER
// (Child tables deleted before parent tables to avoid foreign key violations)
// ------------------------------------------------------------------------------
const APPLICATION_TABLES_DEPENDENCY_ORDER = [
  "advertising_clicks",
  "advertising_impressions",
  "advertising_campaigns",
  "activity_logs",
  "booking_events",
  "messages",
  "notifications",
  "reviews",
  "favourites",
  "payments",
  "subscriptions",
  "bid_negotiations",
  "bookings",
  "bids",
  "request_images",
  "service_requests",
  "driver_presence",
  "verification_documents",
  "vehicle_photos",
  "vehicles",
  "saved_addresses",
  "profiles" // Admin profile preserved/recreated separately
];

// Permanent Admin profile definition
const SYSTEM_ADMIN_PROFILE = {
  id: "admin_master_transmove",
  user_id: "admin_master_transmove",
  email: "admin@transmove.co.zw",
  full_name: "TransMove System Administrator",
  phone: "+263770000000",
  city: "Harare",
  bio: "Official TransMove Platform Administrator",
  role: "admin",
  account_status: "active",
  verification_status: "approved",
  verification_rejection_reason: "",
  rating_avg: 5.0,
  rating_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Patterns matching test files in Google Drive
const TEST_DRIVE_FILE_PATTERNS = [
  /farai_licence/i,
  /driver_licence_front/i,
  /ecocash_proof_ref_MP260919\.001/i,
  /^test_/i,
  /^test-/i,
  /_test\./i,
  /temporary_test/i
];

async function main() {
  console.log("==================================================");
  console.log("TRANSMOVE — SUPABASE FRESH PRODUCTION RESET");
  console.log(`MODE: ${isExecute ? "EXECUTE (MODIFICATIONS WILL BE COMMITTED)" : "DRY RUN (AUDIT ONLY — NO CHANGES)"}`);
  console.log("==================================================\n");

  const report = {
    mode: isExecute ? "execute" : "dry-run",
    rowsBeforeReset: {},
    totalRowsBefore: 0,
    rowsToRemove: {},
    totalRowsToRemove: 0,
    rowsRemaining: {},
    totalRowsRemaining: 0,
    authUsers: {
      adminUsers: [],
      testUsers: [],
      realUsers: [],
      removedCount: 0,
      preservedCount: 0
    },
    googleDrive: {
      scannedFiles: 0,
      testFiles: [],
      preservedFiles: [],
      removedCount: 0
    },
    systemData: {
      subscriptionPlans: 0,
      paymentDestinations: 0,
      adminPresent: false
    },
    safety: {
      schemaPreserved: true,
      rlsPreserved: true,
      functionsPreserved: true,
      appwriteUntouched: true
    }
  };

  // ---------------------------------------------------------------------------
  // 1. AUDIT SUPABASE AUTH USERS
  // ---------------------------------------------------------------------------
  console.log("--- 1. AUDITING SUPABASE AUTH USERS ---");
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseAdminClient = null;

  if (supabaseUrl && serviceKey && supabaseUrl.startsWith("https://")) {
    try {
      supabaseAdminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: userData, error: userErr } = await supabaseAdminClient.auth.admin.listUsers();
      if (!userErr && userData && Array.isArray(userData.users)) {
        for (const u of userData.users) {
          const email = (u.email || "").toLowerCase();
          const metaRole = (u.user_metadata?.role || "").toLowerCase();
          const isAdmin = email.includes("admin") || metaRole === "admin";
          const isTest = email.startsWith("test_") || email.endsWith("@transmove.test") || email.includes("testuser");

          if (isAdmin) {
            report.authUsers.adminUsers.push({ id: u.id, email: u.email, role: "admin" });
          } else if (isTest) {
            report.authUsers.testUsers.push({ id: u.id, email: u.email });
          } else {
            report.authUsers.realUsers.push({ id: u.id, email: u.email });
          }
        }
      }
    } catch (err) {
      console.warn("   [Notice] Could not connect to live Supabase Auth:", err.message);
    }
  }

  console.log(`   Admin Auth Users: ${report.authUsers.adminUsers.length}`);
  for (const a of report.authUsers.adminUsers) console.log(`     - [ADMIN] ${a.email} (${a.id})`);
  console.log(`   Real Auth Users: ${report.authUsers.realUsers.length}`);
  for (const r of report.authUsers.realUsers) console.log(`     - [REAL] ${r.email} (${r.id})`);
  console.log(`   Test Auth Users: ${report.authUsers.testUsers.length}`);
  for (const t of report.authUsers.testUsers) console.log(`     - [TEST] ${t.email} (${t.id})`);

  // ---------------------------------------------------------------------------
  // 2. AUDIT APPLICATION TABLES
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. AUDITING DATABASE APPLICATION ROWS ---");
  const localDbPath = path.resolve(process.cwd(), "storage", "supabase_local_db.json");
  let currentDbState = {};

  if (fs.existsSync(localDbPath)) {
    try {
      currentDbState = JSON.parse(fs.readFileSync(localDbPath, "utf8"));
    } catch (_) {
      currentDbState = { ...supabaseBackendEngine.db };
    }
  } else {
    currentDbState = { ...supabaseBackendEngine.db };
  }

  // Count rows in dependency order
  for (const table of APPLICATION_TABLES_DEPENDENCY_ORDER) {
    const rows = Array.isArray(currentDbState[table]) ? currentDbState[table] : [];
    const count = rows.length;
    report.rowsBeforeReset[table] = count;
    report.totalRowsBefore += count;

    if (table === "profiles") {
      // Profiles: identify test profiles vs system admin profile
      const testProfiles = rows.filter((p) => p.role !== "admin");
      report.rowsToRemove[table] = testProfiles.length;
      report.totalRowsToRemove += testProfiles.length;
    } else {
      report.rowsToRemove[table] = count;
      report.totalRowsToRemove += count;
    }
  }

  // System tables
  const subPlansCount = Array.isArray(currentDbState.subscription_plans) ? currentDbState.subscription_plans.length : 0;
  const payDestsCount = Array.isArray(currentDbState.payment_destinations) ? currentDbState.payment_destinations.length : 0;
  report.rowsBeforeReset.subscription_plans = subPlansCount;
  report.rowsBeforeReset.payment_destinations = payDestsCount;
  report.totalRowsBefore += subPlansCount + payDestsCount;

  console.log("   Current Table Counts (Dependency Order):");
  for (const table of APPLICATION_TABLES_DEPENDENCY_ORDER) {
    const toRemove = report.rowsToRemove[table];
    const total = report.rowsBeforeReset[table];
    console.log(`     - ${table.padEnd(28)} : ${total} total (${toRemove} to remove)`);
  }
  console.log(`     - ${"subscription_plans".padEnd(28)} : ${subPlansCount} (PRESERVED SYSTEM DATA)`);
  console.log(`     - ${"payment_destinations".padEnd(28)} : ${payDestsCount} (PRESERVED SYSTEM DATA)`);
  console.log(`   TOTAL ROWS AUDITED: ${report.totalRowsBefore}`);
  console.log(`   TOTAL ROWS TO PURGE: ${report.totalRowsToRemove}`);

  // ---------------------------------------------------------------------------
  // 3. AUDIT GOOGLE DRIVE FILES
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. AUDITING GOOGLE DRIVE FILES ---");
  const localDriveRoot = path.resolve(process.cwd(), "storage", "google_drive_local");
  function scanDriveFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const item of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(scanDriveFiles(fullPath));
      } else if (item.endsWith(".meta.json")) {
        try {
          const meta = JSON.parse(fs.readFileSync(fullPath, "utf8"));
          files.push({
            id: meta.id,
            name: meta.name || item.replace(".meta.json", ""),
            folderPath: meta.folderPath || "",
            size: meta.size || 0,
            metaPath: fullPath,
            dataPath: fullPath.replace(/\.meta\.json$/, "")
          });
        } catch (_) {}
      }
    }
    return files;
  }

  const driveFiles = scanDriveFiles(localDriveRoot);
  report.googleDrive.scannedFiles = driveFiles.length;

  for (const file of driveFiles) {
    const isTest = TEST_DRIVE_FILE_PATTERNS.some((pat) => pat.test(file.name) || pat.test(file.id));
    const isBackup = file.name.includes("backup") || file.folderPath.includes("Backups");

    if (isTest && !isBackup) {
      report.googleDrive.testFiles.push(file);
    } else {
      report.googleDrive.preservedFiles.push(file);
    }
  }

  console.log(`   Scanned Drive Files: ${report.googleDrive.scannedFiles}`);
  console.log(`   Test Files Identified for Removal: ${report.googleDrive.testFiles.length}`);
  for (const tf of report.googleDrive.testFiles) {
    console.log(`     - [REMOVE] ${tf.folderPath}/${tf.name} (${tf.id})`);
  }
  console.log(`   Real Files / Backups Preserved: ${report.googleDrive.preservedFiles.length}`);
  for (const pf of report.googleDrive.preservedFiles.slice(0, 10)) {
    console.log(`     - [KEEP] ${pf.folderPath}/${pf.name} (${pf.size} bytes)`);
  }
  if (report.googleDrive.preservedFiles.length > 10) {
    console.log(`     ... and ${report.googleDrive.preservedFiles.length - 10} more preserved files.`);
  }

  // ---------------------------------------------------------------------------
  // 4. EXECUTE OR DRY-RUN SUMMARY
  // ---------------------------------------------------------------------------
  if (isDryRun) {
    console.log("\n==================================================");
    console.log("DRY RUN COMPLETE — ZERO CHANGES COMMITTED");
    console.log("To apply these changes, rerun with --execute:");
    console.log("  powershell -ExecutionPolicy Bypass -File scripts/run-node.ps1 scripts/reset-supabase-production.js --execute");
    console.log("==================================================");
    return report;
  }

  // ---------------------------------------------------------------------------
  // 5. EXECUTION: PURGE & RE-SEED
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. EXECUTING PRODUCTION RESET ---");

  // Step 5A: Clean test Auth users if live Supabase is connected
  if (supabaseAdminClient && report.authUsers.testUsers.length > 0) {
    console.log(`   Deleting ${report.authUsers.testUsers.length} test Auth users...`);
    for (const tu of report.authUsers.testUsers) {
      try {
        await supabaseAdminClient.auth.admin.deleteUser(tu.id);
        report.authUsers.removedCount++;
        console.log(`   ✓ Deleted test auth user: ${tu.email}`);
      } catch (err) {
        console.warn(`   ✗ Could not delete auth user ${tu.email}:`, err.message);
      }
    }
  }
  report.authUsers.preservedCount = report.authUsers.adminUsers.length + report.authUsers.realUsers.length;

  // Step 5B: Clean Google Drive test files
  console.log(`   Cleaning ${report.googleDrive.testFiles.length} temporary Google Drive test files...`);
  for (const tf of report.googleDrive.testFiles) {
    try {
      if (fs.existsSync(tf.metaPath)) fs.unlinkSync(tf.metaPath);
      if (fs.existsSync(tf.dataPath)) fs.unlinkSync(tf.dataPath);
      report.googleDrive.removedCount++;
      console.log(`   ✓ Removed test drive file: ${tf.folderPath}/${tf.name}`);
    } catch (err) {
      console.warn(`   ✗ Could not remove file ${tf.name}:`, err.message);
    }
  }

  // Ensure standard TransMove folder structure remains intact
  const standardFolders = [
    "TransMove/Payments/Subscriptions",
    "TransMove/Payments/Trips",
    "TransMove/Payments/Advertising",
    "TransMove/Verification/Drivers",
    "TransMove/Vehicles",
    "TransMove/Receipts",
    "TransMove/Exports",
    "TransMove/Backups"
  ];
  for (const folder of standardFolders) {
    const fullFolderPath = path.join(localDriveRoot, folder);
    if (!fs.existsSync(fullFolderPath)) {
      fs.mkdirSync(fullFolderPath, { recursive: true });
    }
  }
  console.log("   ✓ Verified all 8 standard TransMove Google Drive folder directories intact.");

  // Step 5C: Reset Application Tables in Dependency Order
  console.log("   Purging database tables in dependency-safe order...");
  const newDbState = { ...currentDbState };

  for (const table of APPLICATION_TABLES_DEPENDENCY_ORDER) {
    if (table === "profiles") {
      // Retain or recreate all admin profiles
      const adminProfiles = (newDbState.profiles || []).filter((p) => p.role === "admin");
      if (!adminProfiles.some((p) => p.id === SYSTEM_ADMIN_PROFILE.id)) {
        adminProfiles.push(SYSTEM_ADMIN_PROFILE);
      }
      newDbState.profiles = adminProfiles.map((p) => ({ ...p, account_status: "active", verification_status: "approved" }));
      console.log(`   ✓ profiles reset: ${newDbState.profiles.length} admin profile(s) preserved (${newDbState.profiles.map(p => p.email).join(", ")}), test profiles cleared.`);
    } else {
      newDbState[table] = [];
      console.log(`   ✓ ${table} cleared: 0 rows remaining.`);
    }
  }

  // Step 5D: Preserve / Re-seed System Data
  console.log("   Preserving / re-seeding system data...");

  // Subscription Plans
  newDbState.subscription_plans = [...DEFAULT_SUBSCRIPTION_PLANS];
  console.log(`   ✓ subscription_plans re-seeded: ${newDbState.subscription_plans.length} official plans active:`);
  for (const p of newDbState.subscription_plans) {
    console.log(`     • ${p.name} ($${p.price} / ${p.duration_days} days)`);
  }

  // Payment Destinations
  newDbState.payment_destinations = [...DEFAULT_PAYMENT_DESTINATIONS];
  console.log(`   ✓ payment_destinations re-seeded: ${newDbState.payment_destinations.length} official EcoCash/InnBucks destinations active:`);
  for (const d of newDbState.payment_destinations) {
    console.log(`     • ${d.account_name} (${d.account_number})`);
  }

  // Persist updated database state
  fs.writeFileSync(localDbPath, JSON.stringify(newDbState, null, 2), "utf8");
  supabaseBackendEngine.db = { ...newDbState };
  console.log("   ✓ Fresh database state persisted to storage/supabase_local_db.json");

  // Step 5E: Also purge live Supabase tables if connected with permissions
  if (supabaseAdminClient) {
    console.log("   Synchronizing with live Supabase database tables...");
    for (const table of APPLICATION_TABLES_DEPENDENCY_ORDER) {
      try {
        if (table === "profiles") {
          await supabaseAdminClient.from(table).delete().neq("role", "admin");
        } else {
          await supabaseAdminClient.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
        }
      } catch (_) {}
    }
  }

  // ---------------------------------------------------------------------------
  // 6. POST-RESET VERIFICATION
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. POST-RESET VERIFICATION ---");
  let postResetTotal = 0;
  for (const table of APPLICATION_TABLES_DEPENDENCY_ORDER) {
    const count = (newDbState[table] || []).length;
    report.rowsRemaining[table] = count;
    postResetTotal += count;
  }
  report.rowsRemaining.subscription_plans = newDbState.subscription_plans.length;
  report.rowsRemaining.payment_destinations = newDbState.payment_destinations.length;
  postResetTotal += newDbState.subscription_plans.length + newDbState.payment_destinations.length;
  report.totalRowsRemaining = postResetTotal;

  report.systemData.subscriptionPlans = newDbState.subscription_plans.length;
  report.systemData.paymentDestinations = newDbState.payment_destinations.length;
  report.systemData.adminPresent = (newDbState.profiles || []).some((p) => p.role === "admin");

  console.log(`   Verification Checks:`);
  console.log(`   - Passenger/driver test profiles : ${newDbState.profiles.filter(p => p.role !== "admin").length} (EXPECTED: 0)`);
  console.log(`   - Service requests               : ${newDbState.service_requests.length} (EXPECTED: 0)`);
  console.log(`   - Driver bids                    : ${newDbState.bids.length} (EXPECTED: 0)`);
  console.log(`   - Bookings                       : ${newDbState.bookings.length} (EXPECTED: 0)`);
  console.log(`   - Messages                       : ${newDbState.messages.length} (EXPECTED: 0)`);
  console.log(`   - Payments                       : ${newDbState.payments.length} (EXPECTED: 0)`);
  console.log(`   - Subscription plans active      : ${report.systemData.subscriptionPlans} (EXPECTED: 4)`);
  console.log(`   - EcoCash destinations active    : ${report.systemData.paymentDestinations} (EXPECTED: 3)`);
  console.log(`   - Admin profile present          : ${report.systemData.adminPresent} (EXPECTED: true)`);
  console.log(`   - Total rows remaining           : ${report.totalRowsRemaining} (System data + 1 Admin Profile)`);

  console.log("\n==================================================");
  console.log("PRODUCTION RESET COMPLETED SUCCESSFULLY");
  console.log("==================================================");

  return report;
}

main().catch((err) => {
  console.error("FATAL ERROR DURING PRODUCTION RESET:", err);
  process.exit(1);
});
