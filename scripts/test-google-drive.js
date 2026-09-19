// ==============================================================================
// TEST GOOGLE DRIVE STORAGE SERVICE
// Verifies folder creation, uploads (proofs & verification docs), private downloads,
// metadata inspection, deletions, and backup exports.
// ==============================================================================

import { googleDriveStorage, DRIVE_FOLDERS } from "../src/server/google-drive-storage.js";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING GOOGLE DRIVE STORAGE SERVICE TESTS");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Test Folder Resolution / Creation
    console.log("\n1. Testing Folder Creation...");
    const subFolder = await googleDriveStorage.createFolderIfNeeded(DRIVE_FOLDERS.PAYMENTS_SUBSCRIPTIONS);
    assert(Boolean(subFolder), "Payments/Subscriptions folder resolved/created");

    const verifFolder = await googleDriveStorage.createFolderIfNeeded(DRIVE_FOLDERS.VERIFICATION_DRIVERS);
    assert(Boolean(verifFolder), "Verification/Drivers folder resolved/created");

    const backupFolder = await googleDriveStorage.createFolderIfNeeded(DRIVE_FOLDERS.BACKUPS);
    assert(Boolean(backupFolder), "Backups folder resolved/created");

    // 2. Test Payment Proof Upload (Private)
    console.log("\n2. Testing Payment Proof Upload...");
    const fakeProofBuffer = Buffer.from("FAKE_ECOCASH_PAYMENT_SCREENSHOT_BYTES_PNG");
    const proofUpload = await googleDriveStorage.uploadFile({
      buffer: fakeProofBuffer,
      originalFilename: "ecocash_proof_ref_MP260919.001.png",
      mimeType: "image/png",
      folderPath: DRIVE_FOLDERS.PAYMENTS_SUBSCRIPTIONS,
      metadata: {
        reference: "MP260919.001",
        userId: "user_test_123"
      }
    });

    assert(Boolean(proofUpload.id), `Proof uploaded with ID: ${proofUpload.id}`);
    assert(proofUpload.storage_provider === "google_drive", "Storage provider is google_drive");
    assert(proofUpload.name === "ecocash_proof_ref_MP260919.001.png", "Filename preserved");
    assert(proofUpload.size === fakeProofBuffer.length, `Size matches: ${proofUpload.size} bytes`);

    // 3. Test Verification Document Upload
    console.log("\n3. Testing Verification Document Upload...");
    const fakeDocBuffer = Buffer.from("%PDF-1.4 FAKE_DRIVER_LICENCE_CONTENT");
    const docUpload = await googleDriveStorage.uploadFile({
      buffer: fakeDocBuffer,
      originalFilename: "driver_licence_front.pdf",
      mimeType: "application/pdf",
      folderPath: DRIVE_FOLDERS.VERIFICATION_DRIVERS,
      metadata: {
        documentType: "driver_license",
        driverId: "driver_test_456"
      }
    });

    assert(Boolean(docUpload.id), `Verification doc uploaded with ID: ${docUpload.id}`);
    assert(docUpload.mimeType === "application/pdf", "MIME type is application/pdf");

    // 4. Test Private Authorized Download Stream
    console.log("\n4. Testing Private Authorized Download Stream...");
    const download = await googleDriveStorage.downloadAuthorizedFile(proofUpload.id);
    assert(Boolean(download.stream), "Authorized download stream obtained");
    assert(download.mimeType === "image/png", "Download stream has correct mimeType");

    const chunks = [];
    for await (const chunk of download.stream) {
      chunks.push(chunk);
    }
    const downloadedBuffer = Buffer.concat(chunks);
    assert(downloadedBuffer.toString() === fakeProofBuffer.toString(), "Downloaded content matches uploaded content exactly");

    // 5. Test Metadata Retrieval
    console.log("\n5. Testing Metadata Retrieval...");
    const meta = await googleDriveStorage.getFileMetadata(proofUpload.id);
    assert(meta.id === proofUpload.id, "Metadata ID matches");
    assert(meta.size === fakeProofBuffer.length, "Metadata size matches");

    // 6. Test Backup Export Upload
    console.log("\n6. Testing Backup Export Upload...");
    const backupJson = JSON.stringify({ version: "1.0", timestamp: new Date().toISOString(), tables: { profiles: [], bookings: [] } });
    const backupUpload = await googleDriveStorage.uploadFile({
      buffer: Buffer.from(backupJson),
      originalFilename: `transmove-backup-${new Date().toISOString().split("T")[0]}.json`,
      mimeType: "application/json",
      folderPath: DRIVE_FOLDERS.BACKUPS
    });
    assert(Boolean(backupUpload.id), `Backup uploaded successfully: ${backupUpload.name}`);

    // 7. Test Authorized File Deletion
    console.log("\n7. Testing File Deletion...");
    await googleDriveStorage.deleteFile(docUpload.id);
    let deletedFound = false;
    try {
      await googleDriveStorage.getFileMetadata(docUpload.id);
      deletedFound = true;
    } catch (err) {
      deletedFound = false;
    }
    assert(!deletedFound, "Deleted file is no longer accessible");

    // Cleanup proof test file
    await googleDriveStorage.deleteFile(proofUpload.id);
    await googleDriveStorage.deleteFile(backupUpload.id);

    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
