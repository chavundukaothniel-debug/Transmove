// ==============================================================================
// TRANSMOVE — BACKUP DATABASE EXPORT TO GOOGLE DRIVE
//
// Exports full Supabase database snapshot to:
//   TransMove/Backups/transmove-backup-YYYY-MM-DD.json
// ==============================================================================

import { googleDriveStorage, DRIVE_FOLDERS } from "../src/server/google-drive-storage.js";
import { supabaseBackendEngine } from "../src/server/supabase-backend.js";

async function executeBackup() {
  console.log("==================================================");
  console.log("TRANSMOVE — AUTOMATED DATABASE BACKUP EXPORT");
  console.log("==================================================");

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `transmove-backup-${timestamp}.json`;

  console.log(`1. Generating relational snapshot from Supabase backend engine...`);
  const exportPayload = {
    version: "2.0-supabase",
    timestamp: new Date().toISOString(),
    tables: {
      profiles: supabaseBackendEngine.db.profiles.length,
      vehicles: supabaseBackendEngine.db.vehicles.length,
      service_requests: supabaseBackendEngine.db.service_requests.length,
      bids: supabaseBackendEngine.db.bids.length,
      bookings: supabaseBackendEngine.db.bookings.length,
      payments: supabaseBackendEngine.db.payments.length,
      subscriptions: supabaseBackendEngine.db.subscriptions.length,
      reviews: supabaseBackendEngine.db.reviews.length,
      payment_destinations: supabaseBackendEngine.db.payment_destinations.length,
      subscription_plans: supabaseBackendEngine.db.subscription_plans.length
    },
    database_state: supabaseBackendEngine.db
  };

  const buffer = Buffer.from(JSON.stringify(exportPayload, null, 2), "utf8");
  console.log(`✓ Snapshot size: ${buffer.length} bytes`);

  console.log(`2. Uploading backup to Google Drive (${DRIVE_FOLDERS.BACKUPS}/${filename})...`);
  const upload = await googleDriveStorage.uploadFile({
    buffer,
    originalFilename: filename,
    mimeType: "application/json",
    folderPath: DRIVE_FOLDERS.BACKUPS,
    metadata: {
      backupDate: timestamp,
      type: "database_snapshot"
    }
  });

  console.log(`✓ Backup successfully uploaded to Google Drive!`);
  console.log(`   File ID: ${upload.id}`);
  console.log(`   Filename: ${upload.name}`);
  console.log(`   Folder: ${upload.folderPath}`);
  console.log(`   Size: ${upload.size} bytes`);
  console.log("==================================================");
}

executeBackup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
