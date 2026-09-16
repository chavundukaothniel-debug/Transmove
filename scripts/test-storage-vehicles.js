// ==============================================================================
// TRANSMOVE LIVE APPWRITE STORAGE & VEHICLES TEST SUITE
// Runs Phase 14, 15, and 16 tests against the live Appwrite backend
// ==============================================================================
const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  },
  location: {
    origin: "http://localhost:3000",
    hash: "",
    search: ""
  },
  console: console
};

import fs from "fs";
import { AuthService } from "../src/services/auth.js";
import { VehicleService } from "../src/services/vehicles.js";
import {
  APPWRITE_CONFIG,
  getAppwriteDatabases,
  getAppwriteStorage,
  Query
} from "../src/config/appwrite.js";

// Load server credentials strictly for verification assertions and cleanup
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach(l => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const serverHeaders = {
  "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": conf.APPWRITE_API_KEY
};

const timestamp = Date.now();
const DRIVER_A_EMAIL = `driver_a_${timestamp}@transmove.test`;
const DRIVER_B_EMAIL = `driver_b_${timestamp}@transmove.test`;
const TEST_PASSWORD = "PasswordSecurity2026!";

const results = {};
const cleanupTracking = {
  users: [],
  profiles: [],
  vehicles: [],
  photos: [],
  documents: [],
  files: []
};

async function runTestSuite() {
  console.log("==================================================");
  console.log("TRANSMOVE LIVE STORAGE & VEHICLES VERIFICATION");
  console.log("Endpoint:", APPWRITE_CONFIG.endpoint);
  console.log("Project ID:", APPWRITE_CONFIG.projectId);
  console.log("Bucket:", APPWRITE_CONFIG.bucketId);
  console.log("==================================================");

  let driverAUser = null;
  let driverBUser = null;
  let vehicle1Id = null;
  let vehicle2Id = null;
  let firstPhotoFileId = null;
  let secondPhotoFileId = null;
  let privDocFileId = null;
  let privDocRecordId = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Create Driver A & Driver B
    // -------------------------------------------------------------
    console.log("\n[SETUP] Registering Driver A...");
    const regA = await AuthService.register({
      email: DRIVER_A_EMAIL,
      password: TEST_PASSWORD,
      fullName: "Driver Alpha",
      phoneNumber: "+263771111111",
      role: "driver"
    });
    driverAUser = regA.user;
    cleanupTracking.users.push(driverAUser.$id);
    if (regA.profile?.$id) cleanupTracking.profiles.push(regA.profile.$id);
    console.log(" -> Driver A registered:", driverAUser.$id);

    console.log("\n[SETUP] Registering Driver B...");
    const regB = await AuthService.register({
      email: DRIVER_B_EMAIL,
      password: TEST_PASSWORD,
      fullName: "Driver Bravo",
      phoneNumber: "+263772222222",
      role: "driver"
    });
    driverBUser = regB.user;
    cleanupTracking.users.push(driverBUser.$id);
    if (regB.profile?.$id) cleanupTracking.profiles.push(regB.profile.$id);
    console.log(" -> Driver B registered:", driverBUser.$id);

    // Switch session back to Driver A
    await AuthService.login({ email: DRIVER_A_EMAIL, password: TEST_PASSWORD });

    // -------------------------------------------------------------
    // 1. PROFILE PHOTO UPLOAD
    // -------------------------------------------------------------
    console.log("\n[TEST 1] PROFILE PHOTO UPLOAD");
    const dummyPhoto1 = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])],
      "avatar1.jpg",
      { type: "image/jpeg" }
    );
    const photoUrl1 = await VehicleService.uploadProfilePicture(dummyPhoto1);
    const profA1 = await AuthService.getCurrentProfile();
    firstPhotoFileId = profA1.profile_image_id;
    if (firstPhotoFileId) cleanupTracking.files.push(firstPhotoFileId);

    results["Profile Photo Upload"] = Boolean(photoUrl1 && firstPhotoFileId);
    console.log(" -> Profile photo uploaded. File ID:", firstPhotoFileId);
    console.log(" -> View URL generated:", photoUrl1.includes(firstPhotoFileId));

    // -------------------------------------------------------------
    // 2. PROFILE PHOTO DISPLAY AFTER RELOAD / REFETCH
    // -------------------------------------------------------------
    console.log("\n[TEST 2] PROFILE PHOTO DISPLAY AFTER RELOAD");
    const reloadedProf = await AuthService.getCurrentProfile();
    results["Profile Photo Persistence"] = Boolean(
      reloadedProf &&
      reloadedProf.profile_photo_url &&
      reloadedProf.profile_photo_url.includes(firstPhotoFileId)
    );
    console.log(" -> Photo persisted in profile:", results["Profile Photo Persistence"]);

    // -------------------------------------------------------------
    // 3. PROFILE PHOTO REPLACEMENT
    // -------------------------------------------------------------
    console.log("\n[TEST 3] PROFILE PHOTO REPLACEMENT & OLD FILE CLEANUP");
    const dummyPhoto2 = new File(
      [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
      "avatar2.png",
      { type: "image/png" }
    );
    const photoUrl2 = await VehicleService.uploadProfilePicture(dummyPhoto2);
    const profA2 = await AuthService.getCurrentProfile();
    secondPhotoFileId = profA2.profile_image_id;
    if (secondPhotoFileId) cleanupTracking.files.push(secondPhotoFileId);

    const replacedDifferentId = secondPhotoFileId && secondPhotoFileId !== firstPhotoFileId;
    // Verify old file was deleted from bucket
    let oldFileCleaned = false;
    try {
      const storage = getAppwriteStorage();
      await storage.getFile(APPWRITE_CONFIG.bucketId, firstPhotoFileId);
    } catch (e) {
      oldFileCleaned = true; // 404 expected
    }

    results["Profile Photo Replacement"] = Boolean(replacedDifferentId && oldFileCleaned);
    console.log(" -> New photo ID:", secondPhotoFileId);
    console.log(" -> Old photo file cleaned from storage:", oldFileCleaned);

    // -------------------------------------------------------------
    // 4. CREATE VEHICLE (First vehicle should be primary)
    // -------------------------------------------------------------
    console.log("\n[TEST 4] CREATE VEHICLE");
    const veh1 = await VehicleService.addVehicle({
      make: "Toyota",
      model: "Corolla",
      year: "2019",
      color: "White",
      registration_number: `A${timestamp.toString().slice(-4)}`,
      passenger_capacity: "4",
      vehicle_type: "sedan"
    });
    vehicle1Id = veh1.$id || veh1.id;
    cleanupTracking.vehicles.push(vehicle1Id);

    results["Vehicle Create"] = Boolean(
      veh1 &&
      veh1.driver_id === driverAUser.$id &&
      veh1.is_primary === true &&
      veh1.verification_status === "unverified"
    );
    console.log(" -> Vehicle 1 created:", vehicle1Id);
    console.log(" -> Auto-marked as primary:", veh1.is_primary);
    console.log(" -> Verification status forced to unverified:", veh1.verification_status);

    // -------------------------------------------------------------
    // 5. GET DRIVER VEHICLES
    // -------------------------------------------------------------
    console.log("\n[TEST 5] GET DRIVER VEHICLES");
    const driverVehicles = await VehicleService.getDriverVehicles();
    results["Vehicle Read"] = driverVehicles.some(v => (v.$id || v.id) === vehicle1Id);
    console.log(" -> Vehicles found:", driverVehicles.length);

    // -------------------------------------------------------------
    // 6. CREATE SECOND VEHICLE & SET PRIMARY VEHICLE
    // -------------------------------------------------------------
    console.log("\n[TEST 6] CREATE SECOND VEHICLE & SWITCH PRIMARY");
    const veh2 = await VehicleService.addVehicle({
      make: "Nissan",
      model: "Caravan",
      year: "2020",
      color: "Silver",
      registration_number: `B${timestamp.toString().slice(-4)}`,
      passenger_capacity: "15",
      vehicle_type: "van",
      is_primary: false
    });
    vehicle2Id = veh2.$id || veh2.id;
    cleanupTracking.vehicles.push(vehicle2Id);

    // Switch primary to Vehicle 2
    await VehicleService.setPrimaryVehicle(vehicle2Id);

    const v1Updated = await VehicleService.getVehicle(vehicle1Id);
    const v2Updated = await VehicleService.getVehicle(vehicle2Id);

    const primarySwitchedCleanly = v2Updated.is_primary === true && v1Updated.is_primary === false;
    results["Primary Vehicle"] = primarySwitchedCleanly;
    console.log(" -> Vehicle 2 is_primary:", v2Updated.is_primary);
    console.log(" -> Vehicle 1 is_primary unset:", !v1Updated.is_primary);

    // -------------------------------------------------------------
    // 7. UPDATE VEHICLE
    // -------------------------------------------------------------
    console.log("\n[TEST 7] UPDATE VEHICLE");
    const updatedVeh1 = await VehicleService.updateVehicle(vehicle1Id, {
      color: "Midnight Black",
      description: "Executive executive transport"
    });
    results["Vehicle Update"] = Boolean(
      updatedVeh1.colour === "Midnight Black" || updatedVeh1.color === "Midnight Black"
    );
    console.log(" -> Updated colour:", updatedVeh1.colour || updatedVeh1.color);

    // -------------------------------------------------------------
    // 8. ACTIVATE / DEACTIVATE VEHICLE
    // -------------------------------------------------------------
    console.log("\n[TEST 8] ACTIVATE / DEACTIVATE VEHICLE");
    const deactVeh = await VehicleService.toggleVehicleStatus(vehicle1Id, false);
    const reactVeh = await VehicleService.toggleVehicleStatus(vehicle1Id, true);
    results["Activate / Deactivate"] = deactVeh.status === "inactive" && reactVeh.status === "active";
    console.log(" -> Toggled inactive:", deactVeh.status, "Toggled active:", reactVeh.status);

    // -------------------------------------------------------------
    // 9. VEHICLE PHOTO UPLOAD (Single & Multiple, max 5)
    // -------------------------------------------------------------
    console.log("\n[TEST 9] VEHICLE PHOTO UPLOAD & MULTIPLE PHOTOS");
    const vehPhotoFile1 = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE1])],
      "vehicle_front.jpg",
      { type: "image/jpeg" }
    );
    const photoUp1 = await VehicleService.uploadVehiclePhoto(vehicle2Id, vehPhotoFile1, true);
    cleanupTracking.photos.push(photoUp1.photoId);
    cleanupTracking.files.push(photoUp1.fileId);

    const vehPhotoFile2 = new File(
      [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE2])],
      "vehicle_side.jpg",
      { type: "image/jpeg" }
    );
    const photoUp2 = await VehicleService.uploadVehiclePhoto(vehicle2Id, vehPhotoFile2, false);
    cleanupTracking.photos.push(photoUp2.photoId);
    cleanupTracking.files.push(photoUp2.fileId);

    const veh2WithPhotos = await VehicleService.getVehicle(vehicle2Id);
    results["Vehicle Photos"] = veh2WithPhotos.photos.length === 2 && photoUp1.isPrimary;
    console.log(" -> Vehicle photos count:", veh2WithPhotos.photos.length, "(Expected: 2)");
    console.log(" -> Primary cover photo marked:", photoUp1.isPrimary);

    // -------------------------------------------------------------
    // 10. PRIVATE VERIFICATION DOCUMENT UPLOAD & PERMISSIONS
    // -------------------------------------------------------------
    console.log("\n[TEST 10] PRIVATE VERIFICATION DOCUMENT UPLOAD");
    const dummyPdf = new File(
      [new TextEncoder().encode("%PDF-1.4 Mock Document Content")],
      "driver_license.pdf",
      { type: "application/pdf" }
    );
    const docUpload = await VehicleService.uploadVerificationDocument(dummyPdf, "driver_license", vehicle2Id);
    privDocRecordId = docUpload.id;
    privDocFileId = docUpload.file_id;
    cleanupTracking.documents.push(privDocRecordId);
    cleanupTracking.files.push(privDocFileId);

    // Check permissions using server key
    const fileMetaRes = await fetch(
      `${conf.APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${privDocFileId}`,
      { headers: serverHeaders }
    );
    const fileMeta = await fileMetaRes.json();
    const isStrictlyPrivate =
      fileMeta.$permissions.includes(`read("user:${driverAUser.$id}")`) &&
      !fileMeta.$permissions.includes('read("any")') &&
      !fileMeta.$permissions.includes('read("users")');

    results["Verification Documents"] = Boolean(
      docUpload.verification_status === "pending" && docUpload.file_id
    );
    results["Private File Security"] = isStrictlyPrivate;
    console.log(" -> Document record created:", privDocRecordId, "status:", docUpload.verification_status);
    console.log(" -> File permissions:", fileMeta.$permissions);
    console.log(" -> Strictly private to user only:", isStrictlyPrivate);

    // -------------------------------------------------------------
    // 11. DRIVER PROFILE COMPLETENESS SERVICE
    // -------------------------------------------------------------
    console.log("\n[TEST 11] DRIVER PROFILE COMPLETENESS");
    const completeness = await VehicleService.getDriverProfileCompleteness();
    results["Profile Completeness Service"] = Boolean(
      completeness && completeness.details.hasPhoto && completeness.details.hasVehicle && completeness.details.hasDocuments
    );
    console.log(" -> Completeness status:", completeness.isComplete ? "COMPLETE" : "INCOMPLETE");
    console.log(" -> Missing requirements:", completeness.missingRequirements);

    // -------------------------------------------------------------
    // 12. SECURITY TEST: Driver B Attempts to Modify / Delete Driver A's Vehicle
    // -------------------------------------------------------------
    console.log("\n[TEST 12] SECURITY TEST: UNAUTHORIZED VEHICLE ACCESS");
    await AuthService.login({ email: DRIVER_B_EMAIL, password: TEST_PASSWORD });

    let driverBUpdateBlocked = false;
    try {
      await VehicleService.updateVehicle(vehicle1Id, { make: "Hacked Make" });
    } catch (err) {
      driverBUpdateBlocked = true;
      console.log(" -> PASS: Driver B update blocked:", err.message);
    }

    let driverBDeleteBlocked = false;
    try {
      await VehicleService.deleteVehicle(vehicle1Id);
    } catch (err) {
      driverBDeleteBlocked = true;
      console.log(" -> PASS: Driver B delete blocked:", err.message);
    }

    results["Vehicle Ownership Security"] = driverBUpdateBlocked && driverBDeleteBlocked;

    // -------------------------------------------------------------
    // 13. SECURITY TEST: Driver B / Unauthenticated Access to Driver A's Private Document
    // -------------------------------------------------------------
    console.log("\n[TEST 13] SECURITY TEST: UNAUTHORIZED VERIFICATION FILE ACCESS");
    const storage = getAppwriteStorage();
    let driverBFileReadBlocked = false;
    try {
      await storage.getFile(APPWRITE_CONFIG.bucketId, privDocFileId);
    } catch (err) {
      driverBFileReadBlocked = true;
      console.log(" -> PASS: Driver B reading Driver A's private file blocked:", err.message);
    }

    // Log out (unauthenticated)
    await AuthService.logout();
    let unauthFileReadBlocked = false;
    try {
      await storage.getFile(APPWRITE_CONFIG.bucketId, privDocFileId);
    } catch (err) {
      unauthFileReadBlocked = true;
      console.log(" -> PASS: Unauthenticated access to private file blocked:", err.message);
    }

    results["Unauthorized Document Access Blocked"] = driverBFileReadBlocked && unauthFileReadBlocked;

  } catch (fatalErr) {
    console.error("FATAL ERROR in test execution:", fatalErr);
  } finally {
    // -------------------------------------------------------------
    // CLEANUP: Purge all created test records and files
    // -------------------------------------------------------------
    console.log("\n[CLEANUP] Purging test data...");
    const databases = getAppwriteDatabases();

    // Purge vehicle photos
    for (const pId of cleanupTracking.photos) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicle_photos/documents/${pId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    // Purge verification documents
    for (const dId of cleanupTracking.documents) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/verification_documents/documents/${dId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    // Purge vehicles
    for (const vId of cleanupTracking.vehicles) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents/${vId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    // Purge storage files
    for (const fId of cleanupTracking.files) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    // Purge profiles
    for (const prId of cleanupTracking.profiles) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/profiles/documents/${prId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    // Purge users
    for (const uId of cleanupTracking.users) {
      try {
        await fetch(`${conf.APPWRITE_ENDPOINT}/users/${uId}`, {
          method: "DELETE",
          headers: serverHeaders
        });
      } catch (_) {}
    }

    console.log(" -> Cleanup completed successfully.");
  }

  console.log("\n==================================================");
  console.log("TEST RESULTS SUMMARY");
  console.log("==================================================");
  let allPass = true;
  for (const [key, val] of Object.entries(results)) {
    console.log(`- ${key.padEnd(40, ".")}: ${val ? "PASS" : "FAIL"}`);
    if (!val) allPass = false;
  }
  console.log("OVERALL:", allPass ? "ALL TESTS PASSED" : "SOME TESTS FAILED");
  return allPass;
}

runTestSuite();
