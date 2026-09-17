// ==============================================================================
// TRANSMOVE CREATE-PERMISSION SECURITY & REGRESSION TEST SUITE
// Directly tests live Appwrite database engine & trusted server operations:
// - Direct client CREATE & DELETE bypass attempts are REJECTED by database engine
// - Trusted server endpoints enforce authentication, field derivation & authorization
// - Full regression testing of existing features through trusted paths
// ==============================================================================

const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  },
  location: {
    origin: "http://localhost:8080",
    hash: "",
    search: ""
  },
  console: console
};

import fs from "fs";
import { assertTestCleanupCapabilities, deleteOrThrow, runCleanupTasks } from "./test-hygiene.js";
import path from "path";
import { Client, Account, Databases, Storage, ID, Permission, Role } from "../assets/js/vendor/appwrite.js";
import { AuthService } from "../src/services/auth.js";
import { VehicleService } from "../src/services/vehicles.js";
import { APPWRITE_CONFIG } from "../src/config/appwrite.js";

// Load configuration securely
const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
const conf = {};
fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const ENDPOINT = conf.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID = conf.APPWRITE_PROJECT_ID || "6aaa6531003d5747b640";
const API_KEY = conf.APPWRITE_API_KEY;
const TRUSTED_API = "http://localhost:8080/.netlify/functions/trusted-api";

const serverHeaders = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

const cleanup = {
  users: [],
  profiles: [],
  vehicles: [],
  photos: [],
  documents: [],
  files: []
};

const testReport = {
  directAdminProfileCreation: false,
  legitimateProfileCreation: false,
  directProfileDeletion: false,
  directVerifiedVehicleCreation: false,
  trustedVehicleCreation: false,
  driverIdSpoofing: false,
  documentSelfVerificationOnCreation: false,
  trustedVerificationDocCreation: false,
  vehiclePhotoOwnershipSpoofing: false,
  existingAuthRegression: false,
  existingVehicleRegression: false
};

const livePermissions = {};

async function cleanupTestArtifacts() {
  const tasks = [];
  const targets = [
    ["verification_documents", cleanup.documents],
    ["vehicle_photos", cleanup.photos],
    ["vehicles", cleanup.vehicles],
    ["profiles", cleanup.profiles]
  ];
  for (const [collection, ids] of targets) {
    for (const id of ids) tasks.push({
      label: `${collection}/${id}`,
      run: () => deleteOrThrow(
        `${ENDPOINT}/databases/transmove/collections/${collection}/documents/${id}`,
        { headers: serverHeaders },
        `${collection}/${id}`
      )
    });
  }
  for (const fileId of cleanup.files) {
    tasks.push({
      label: `file ${fileId}`,
      run: () => deleteOrThrow(
        `${ENDPOINT}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}`,
        { headers: serverHeaders },
        `file ${fileId}`
      )
    });
  }
  for (const userId of cleanup.users) {
    tasks.push({
      label: `Auth user ${userId}`,
      run: () => deleteOrThrow(
        `${ENDPOINT}/users/${userId}`,
        { headers: serverHeaders },
        `Auth user ${userId}`
      )
    });
  }
  await runCleanupTasks("create-security", tasks);
}

async function run() {
  await assertTestCleanupCapabilities("create-security");
  console.log("==================================================");
  console.log("TRANSMOVE CREATE-PERMISSION SECURITY TEST SUITE");
  console.log("==================================================");

  const timestamp = Date.now();
  const testPassword = "SecPassw0rd2026!#";

  // ==============================================================
  // 9. VERIFY LIVE APPWRITE PERMISSIONS
  // ==============================================================
  console.log("\n--- [STEP 1] INSPECTING LIVE TABLE PERMISSIONS ---");
  const collectionsToCheck = [
    "profiles",
    "vehicles",
    "verification_documents",
    "vehicle_photos",
    "request_images"
  ];

  for (const colId of collectionsToCheck) {
    const res = await fetch(
      `${ENDPOINT}/databases/transmove/collections/${colId}`,
      { headers: serverHeaders }
    );
    if (res.ok) {
      const data = await res.json();
      livePermissions[colId] = {
        permissions: data.$permissions || data.permissions,
        documentSecurity: data.documentSecurity
      };
      console.log(`Live collection: ${colId}`);
      console.log(`  permissions: [${livePermissions[colId].permissions.join(", ")}]`);
      console.log(`  documentSecurity: ${livePermissions[colId].documentSecurity}`);
    } else {
      console.error(`Failed to fetch collection ${colId}:`, res.status);
    }
  }

  // ==============================================================
  // 8. DIRECT APPWRITE ATTACK TESTS
  // ==============================================================
  console.log("\n--- [STEP 2] DIRECT APPWRITE ATTACK TESTS ---");

  // Create two test driver accounts
  const emailA = `driver_a_${timestamp}@transmove.test`;
  const emailB = `driver_b_${timestamp}@transmove.test`;

  // Create Driver A using Appwrite Client SDK directly
  const clientA = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
  const accountA = new Account(clientA);
  const databasesA = new Databases(clientA);

  storageMap.clear();
  const userA = await accountA.create(ID.unique(), emailA, testPassword, "Driver Alpha");
  cleanup.users.push(userA.$id);
  await accountA.createEmailPasswordSession(emailA, testPassword);
  const cookieA = storageMap.get("cookieFallback");
  const jwtA = (await accountA.createJWT()).jwt;

  // Create Driver B using Appwrite Client SDK directly
  const clientB = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
  const accountB = new Account(clientB);
  const databasesB = new Databases(clientB);

  storageMap.clear();
  const userB = await accountB.create(ID.unique(), emailB, testPassword, "Driver Bravo");
  cleanup.users.push(userB.$id);
  await accountB.createEmailPasswordSession(emailB, testPassword);
  const cookieB = storageMap.get("cookieFallback");
  const jwtB = (await accountB.createJWT()).jwt;

  console.log(`Created test users: Driver A (${userA.$id}), Driver B (${userB.$id})`);

  // --------------------------------------------------------------
  // TEST A: CREATE ADMIN PROFILE
  // --------------------------------------------------------------
  console.log("\n--- TEST A: CREATE ADMIN PROFILE ---");
  // 1. Direct Appwrite client attempt by Driver A
  storageMap.set("cookieFallback", cookieA);
  let directAdminCreateBlocked = false;
  try {
    await databasesA.createDocument("transmove", "profiles", ID.unique(), {
      user_id: userA.$id,
      full_name: "Attacker Admin",
      email: emailA,
      role: "admin",
      account_status: "active",
      verification_status: "verified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    directAdminCreateBlocked = true;
    console.log("  [Direct Client] createDocument on profiles REJECTED by database engine:", err.message);
  }

  // 2. Trusted create_profile with role="admin" should also be rejected
  let trustedAdminRoleBlocked = false;
  const adminAttemptRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_profile",
      data: {
        fullName: "Attacker Admin",
        role: "admin"
      }
    })
  });
  if (!adminAttemptRes.ok) {
    trustedAdminRoleBlocked = true;
    const errData = await adminAttemptRes.json();
    console.log("  [Trusted API] role='admin' REJECTED:", errData.error);
  }

  // 3. Legitimate creation via trusted API with normal role
  let legitimateProfileCreated = false;
  let profileDocA = null;
  const legitProfileRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_profile",
      data: {
        fullName: "Driver Alpha",
        role: "driver",
        phoneNumber: "+263771111111",
        city: "Harare"
      }
    })
  });

  if (legitProfileRes.ok) {
    profileDocA = await legitProfileRes.json();
    cleanup.profiles.push(profileDocA.$id);
    if (
      profileDocA.user_id === userA.$id &&
      profileDocA.role === "driver" &&
      profileDocA.account_status === "active" &&
      profileDocA.verification_status === "unverified"
    ) {
      legitimateProfileCreated = true;
      console.log("  [Trusted API] Legitimate profile created:", profileDocA.$id);
      console.log(`    user_id: ${profileDocA.user_id}, role: ${profileDocA.role}`);
      console.log(`    account_status: ${profileDocA.account_status}, verification_status: ${profileDocA.verification_status}`);
    }
  } else {
    console.error("  [Trusted API] Legitimate profile creation failed:", await legitProfileRes.text());
  }

  testReport.directAdminProfileCreation = directAdminCreateBlocked && trustedAdminRoleBlocked;
  testReport.legitimateProfileCreation = legitimateProfileCreated;

  console.log(`Direct admin profile creation: ${testReport.directAdminProfileCreation ? "PASS" : "FAIL"}`);
  console.log(`Legitimate profile creation: ${testReport.legitimateProfileCreation ? "PASS" : "FAIL"}`);

  // Also create profile for Driver B via trusted API
  const legitProfBRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtB}`,
      "X-Appwrite-JWT": jwtB
    },
    body: JSON.stringify({
      action: "create_profile",
      data: {
        fullName: "Driver Bravo",
        role: "driver",
        phoneNumber: "+263772222222",
        city: "Bulawayo"
      }
    })
  });
  if (legitProfBRes.ok) {
    const profB = await legitProfBRes.json();
    cleanup.profiles.push(profB.$id);
  }

  // --------------------------------------------------------------
  // TEST B: PROFILE DELETE
  // --------------------------------------------------------------
  console.log("\n--- TEST B: PROFILE DELETE ---");
  // Driver A attempts direct client SDK deleteDocument on their own profile
  storageMap.set("cookieFallback", cookieA);
  let directProfileDeleteBlocked = false;
  try {
    await databasesA.deleteDocument("transmove", "profiles", profileDocA.$id);
    console.log("  ❌ Direct deleteDocument SUCCEEDED (unexpected)");
  } catch (err) {
    directProfileDeleteBlocked = true;
    console.log("  [Direct Client] deleteDocument on profile REJECTED:", err.message);
  }

  testReport.directProfileDeletion = directProfileDeleteBlocked;
  console.log(`Direct profile deletion: ${testReport.directProfileDeletion ? "PASS" : "FAIL"}`);

  // --------------------------------------------------------------
  // TEST C: CREATE VERIFIED VEHICLE
  // --------------------------------------------------------------
  console.log("\n--- TEST C: CREATE VERIFIED VEHICLE ---");
  // 1. Direct Appwrite client attempt to create verified vehicle
  storageMap.set("cookieFallback", cookieA);
  let directVehicleCreateBlocked = false;
  try {
    await databasesA.createDocument("transmove", "vehicles", ID.unique(), {
      driver_id: userA.$id,
      make: "Toyota",
      model: "Wish",
      registration_number: `A${timestamp.toString().slice(-4)}`,
      verification_status: "verified",
      created_at: new Date().toISOString()
    });
    console.log("  ❌ Direct vehicle createDocument SUCCEEDED (unexpected)");
  } catch (err) {
    directVehicleCreateBlocked = true;
    console.log("  [Direct Client] createDocument on vehicles REJECTED:", err.message);
  }

  // 2. Trusted create_vehicle submits the vehicle for verification.
  let trustedVehicleCreated = false;
  let vehicleA1 = null;
  const legitVehRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_vehicle",
      data: {
        make: "Toyota",
        model: "Wish",
        year: 2018,
        colour: "Silver",
        registration_number: `AF${timestamp.toString().slice(-4)}`,
        passenger_capacity: 7,
        load_capacity: 500,
        vehicle_type: "van",
        is_primary: true
      }
    })
  });

  if (legitVehRes.ok) {
    vehicleA1 = await legitVehRes.json();
    cleanup.vehicles.push(vehicleA1.$id);
    if (
      vehicleA1.driver_id === userA.$id &&
      vehicleA1.verification_status === "pending" &&
      vehicleA1.is_primary === true
    ) {
      trustedVehicleCreated = true;
      console.log("  [Trusted API] Vehicle created successfully:", vehicleA1.$id);
      console.log(`    driver_id: ${vehicleA1.driver_id}`);
      console.log(`    verification_status: ${vehicleA1.verification_status} (Submitted as pending: true)`);
      console.log(`    is_primary: ${vehicleA1.is_primary}`);
    }
  } else {
    console.error("  [Trusted API] Vehicle creation failed:", await legitVehRes.text());
  }

  testReport.directVerifiedVehicleCreation = directVehicleCreateBlocked;
  testReport.trustedVehicleCreation = trustedVehicleCreated;

  console.log(`Direct verified vehicle creation: ${testReport.directVerifiedVehicleCreation ? "PASS" : "FAIL"}`);
  console.log(`Trusted vehicle creation: ${testReport.trustedVehicleCreation ? "PASS" : "FAIL"}`);

  // Create a vehicle for Driver B as well for cross-user tests
  let vehicleB1 = null;
  const vehBRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtB}`,
      "X-Appwrite-JWT": jwtB
    },
    body: JSON.stringify({
      action: "create_vehicle",
      data: {
        make: "Honda",
        model: "Fit",
        year: 2017,
        colour: "Blue",
        registration_number: `BF${timestamp.toString().slice(-4)}`,
        passenger_capacity: 4,
        vehicle_type: "sedan",
        is_primary: true
      }
    })
  });
  if (vehBRes.ok) {
    vehicleB1 = await vehBRes.json();
    cleanup.vehicles.push(vehicleB1.$id);
  }

  // --------------------------------------------------------------
  // TEST D: SPOOF DRIVER ID
  // --------------------------------------------------------------
  console.log("\n--- TEST D: SPOOF DRIVER ID ---");
  // Driver A attempts to create a vehicle specifying driver_id = Driver B
  let driverIdSpoofBlocked = false;
  const spoofVehRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_vehicle",
      data: {
        driver_id: userB.$id,
        make: "Spoofed",
        model: "Ghost",
        registration_number: `SP${timestamp.toString().slice(-4)}`
      }
    })
  });

  if (!spoofVehRes.ok) {
    driverIdSpoofBlocked = true;
    const errData = await spoofVehRes.json();
    console.log("  [Trusted API] driver_id spoofing REJECTED:", errData.error);
  } else {
    console.log("  ❌ Spoofed vehicle was accepted (unexpected)");
  }

  testReport.driverIdSpoofing = driverIdSpoofBlocked;
  console.log(`Driver ID spoofing: ${testReport.driverIdSpoofing ? "PASS" : "FAIL"}`);

  // --------------------------------------------------------------
  // TEST E: SELF-VERIFIED DOCUMENT
  // --------------------------------------------------------------
  console.log("\n--- TEST E: SELF-VERIFIED DOCUMENT ---");
  // 1. Direct Appwrite client attempt to create verification document
  storageMap.set("cookieFallback", cookieA);
  let directDocCreateBlocked = false;
  try {
    await databasesA.createDocument("transmove", "verification_documents", ID.unique(), {
      user_id: userA.$id,
      vehicle_id: vehicleA1.$id,
      document_type: "driver_licence",
      file_id: "fake_file_id",
      verification_status: "verified",
      verified_at: new Date().toISOString()
    });
    console.log("  ❌ Direct document createDocument SUCCEEDED (unexpected)");
  } catch (err) {
    directDocCreateBlocked = true;
    console.log("  [Direct Client] createDocument on verification_documents REJECTED:", err.message);
  }

  // 2. Client attempts to pass verification_status = "verified" to trusted API
  let trustedSelfVerifyBlocked = false;
  const selfVerifyRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_verification_document",
      vehicle_id: vehicleA1.$id,
      data: {
        document_type: "driver_licence",
        file_id: "fake_file_id",
        verification_status: "verified",
        verified_at: new Date().toISOString()
      }
    })
  });
  if (!selfVerifyRes.ok) {
    trustedSelfVerifyBlocked = true;
    const errData = await selfVerifyRes.json();
    console.log("  [Trusted API] document verification_status tampering REJECTED:", errData.error);
  }

  // 3. Trusted create_verification_document creates record with pending/null
  let trustedDocCreated = false;
  let docA1 = null;
  const legitDocRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_verification_document",
      vehicle_id: vehicleA1.$id,
      data: {
        document_type: "driver_licence",
        file_id: "valid_dummy_file_id"
      }
    })
  });

  if (legitDocRes.ok) {
    docA1 = await legitDocRes.json();
    cleanup.documents.push(docA1.$id);
    if (
      docA1.user_id === userA.$id &&
      docA1.verification_status === "pending" &&
      docA1.verified_at === null &&
      docA1.rejection_reason === null
    ) {
      trustedDocCreated = true;
      console.log("  [Trusted API] Verification document created:", docA1.$id);
      console.log(`    user_id: ${docA1.user_id}`);
      console.log(`    verification_status: ${docA1.verification_status} (Expected: pending)`);
      console.log(`    verified_at: ${docA1.verified_at} (Expected: null)`);
      console.log(`    rejection_reason: ${docA1.rejection_reason} (Expected: null)`);
    }
  } else {
    console.error("  [Trusted API] Legitimate doc creation failed:", await legitDocRes.text());
  }

  testReport.documentSelfVerificationOnCreation = directDocCreateBlocked && trustedSelfVerifyBlocked;
  testReport.trustedVerificationDocCreation = trustedDocCreated;

  console.log(`Document self-verification on creation: ${testReport.documentSelfVerificationOnCreation ? "PASS" : "FAIL"}`);
  console.log(`Trusted verification document creation: ${testReport.trustedVerificationDocCreation ? "PASS" : "FAIL"}`);

  // --------------------------------------------------------------
  // TEST F: VEHICLE PHOTO SPOOFING
  // --------------------------------------------------------------
  console.log("\n--- TEST F: VEHICLE PHOTO SPOOFING ---");
  // 1. Direct Appwrite client attempt on vehicle_photos
  storageMap.set("cookieFallback", cookieA);
  let directPhotoCreateBlocked = false;
  try {
    await databasesA.createDocument("transmove", "vehicle_photos", ID.unique(), {
      vehicle_id: vehicleB1.$id,
      driver_id: userB.$id,
      file_id: "fake_photo_file",
      is_primary: false,
      created_at: new Date().toISOString()
    });
    console.log("  ❌ Direct vehicle_photos createDocument SUCCEEDED (unexpected)");
  } catch (err) {
    directPhotoCreateBlocked = true;
    console.log("  [Direct Client] createDocument on vehicle_photos REJECTED:", err.message);
  }

  // 2. Driver A attempts to create photo for Driver B's vehicle via trusted API
  let crossVehiclePhotoBlocked = false;
  const photoSpoofRes = await fetch(TRUSTED_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtA}`,
      "X-Appwrite-JWT": jwtA
    },
    body: JSON.stringify({
      action: "create_vehicle_photo",
      vehicle_id: vehicleB1.$id,
      data: {
        file_id: "fake_photo_file_id"
      }
    })
  });

  if (!photoSpoofRes.ok) {
    crossVehiclePhotoBlocked = true;
    const errData = await photoSpoofRes.json();
    console.log("  [Trusted API] Cross-user vehicle photo REJECTED (HTTP 403):", errData.error);
  } else {
    console.log("  ❌ Driver A successfully created photo on Driver B's vehicle (unexpected)");
  }

  testReport.vehiclePhotoOwnershipSpoofing = directPhotoCreateBlocked && crossVehiclePhotoBlocked;
  console.log(`Vehicle photo ownership spoofing: ${testReport.vehiclePhotoOwnershipSpoofing ? "PASS" : "FAIL"}`);

  // ==============================================================
  // 10. REGRESSION TESTS (Through Service Layer)
  // ==============================================================
  console.log("\n--- [STEP 3] REGRESSION TESTS ---");

  // 1. Signup through AuthService.register
  console.log("\n[Regression 1] Signup Flow via AuthService.register...");
  const regEmail = `reg_driver_${timestamp}@transmove.test`;
  const regResult = await AuthService.register({
    email: regEmail,
    password: testPassword,
    fullName: "Regression Driver",
    phoneNumber: "+263779999999",
    role: "driver",
    city: "Mutare"
  });
  const regUser = regResult.user;
  cleanup.users.push(regUser.$id);
  if (regResult.profile?.$id) cleanup.profiles.push(regResult.profile.$id);
  console.log("  AuthService.register SUCCEEDED: User ID:", regUser.$id, "Profile ID:", regResult.profile?.id);

  // 2. Login through AuthService.login
  console.log("\n[Regression 2] Login Flow via AuthService.login...");
  const loginResult = await AuthService.login({ email: regEmail, password: testPassword });
  console.log("  AuthService.login SUCCEEDED: User ID:", loginResult.user.$id);

  // 3. Profile retrieval
  console.log("\n[Regression 3] Profile Retrieval via AuthService.getCurrentProfile...");
  const currProfile = await AuthService.getCurrentProfile();
  const profileRetrieved = Boolean(
    currProfile &&
    currProfile.id === regUser.$id &&
    currProfile.full_name === "Regression Driver" &&
    currProfile.role === "driver"
  );
  console.log("  AuthService.getCurrentProfile result:", currProfile?.full_name, "Valid:", profileRetrieved);

  // 4. Profile update via AuthService.updateProfile
  console.log("\n[Regression 4] Profile Update via AuthService.updateProfile...");
  const updatedProfile = await AuthService.updateProfile({
    bio: "Experienced professional cross-border driver",
    service_area: "Masvingo"
  });
  const profileUpdated = Boolean(
    updatedProfile &&
    updatedProfile.bio === "Experienced professional cross-border driver" &&
    (updatedProfile.city === "Masvingo" || updatedProfile.service_area === "Masvingo")
  );
  console.log("  AuthService.updateProfile result: bio updated =", profileUpdated);

  // 5. Profile photo upload via VehicleService.uploadProfilePicture
  console.log("\n[Regression 5] Profile Photo Upload via VehicleService.uploadProfilePicture...");
  const dummyAvatar = new File(
    [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])],
    "avatar_reg.jpg",
    { type: "image/jpeg" }
  );
  const avatarUrl = await VehicleService.uploadProfilePicture(dummyAvatar);
  const recheckProfile = await AuthService.getCurrentProfile();
  const profilePhotoSuccess = Boolean(
    avatarUrl &&
    recheckProfile.profile_image_id &&
    avatarUrl.includes(recheckProfile.profile_image_id)
  );
  if (recheckProfile.profile_image_id) cleanup.files.push(recheckProfile.profile_image_id);
  console.log("  Profile photo uploaded. Photo ID:", recheckProfile.profile_image_id, "Success:", profilePhotoSuccess);

  testReport.existingAuthRegression = Boolean(
    regUser &&
    loginResult.user &&
    profileRetrieved &&
    profileUpdated &&
    profilePhotoSuccess
  );
  console.log(`Existing auth regression: ${testReport.existingAuthRegression ? "PASS" : "FAIL"}`);

  // 6. Create vehicle via VehicleService.addVehicle
  console.log("\n[Regression 6] Vehicle Creation via VehicleService.addVehicle...");
  const regVeh1 = await VehicleService.addVehicle({
    make: "Mercedes",
    model: "Sprinter",
    year: 2021,
    color: "White",
    registration_number: `RG${timestamp.toString().slice(-4)}`,
    passenger_capacity: 22,
    load_capacity: 1500,
    vehicle_type: "bus",
    description: "Intercity shuttle",
    is_primary: true
  });
  const veh1Id = regVeh1.id || regVeh1.$id;
  cleanup.vehicles.push(veh1Id);
  console.log("  Vehicle 1 created:", veh1Id, "is_primary:", regVeh1.is_primary, "status:", regVeh1.verification_status);

  // 7. Update vehicle via VehicleService.updateVehicle
  console.log("\n[Regression 7] Vehicle Update via VehicleService.updateVehicle...");
  const updatedVeh = await VehicleService.updateVehicle(veh1Id, {
    colour: "Pearl White",
    description: "Updated intercity luxury shuttle"
  });
  const vehUpdateSuccess = Boolean(
    updatedVeh &&
    (updatedVeh.colour === "Pearl White" || updatedVeh.color === "Pearl White")
  );
  console.log("  Vehicle update result: colour =", updatedVeh.colour || updatedVeh.color, "Success:", vehUpdateSuccess);

  // 8. Primary vehicle switching via atomic transaction
  console.log("\n[Regression 8] Primary Vehicle Atomic Switch...");
  const regVeh2 = await VehicleService.addVehicle({
    make: "Toyota",
    model: "Quantum",
    year: 2022,
    color: "Silver",
    registration_number: `QT${timestamp.toString().slice(-4)}`,
    passenger_capacity: 15,
    vehicle_type: "minibus",
    is_primary: false
  });
  const veh2Id = regVeh2.id || regVeh2.$id;
  cleanup.vehicles.push(veh2Id);

  // Atomically set Vehicle 2 as primary
  await VehicleService.setPrimaryVehicle(veh2Id);
  const checkV1 = await VehicleService.getVehicle(veh1Id);
  const checkV2 = await VehicleService.getVehicle(veh2Id);
  const primarySwitchSuccess = Boolean(checkV2.is_primary === true && checkV1.is_primary === false);
  console.log("  Vehicle 2 is_primary:", checkV2.is_primary, "(Expected: true)");
  console.log("  Vehicle 1 is_primary:", checkV1.is_primary, "(Expected: false)");
  console.log("  Primary vehicle atomic switch success:", primarySwitchSuccess);

  // 9. Vehicle photo upload via VehicleService.uploadVehiclePhoto
  console.log("\n[Regression 9] Vehicle Photo Upload via VehicleService.uploadVehiclePhoto...");
  const dummyVehPhoto = new File(
    [new Uint8Array([0xFF, 0xD8, 0xFF, 0xE2, 0x00, 0x10, 0x4A, 0x46])],
    "sprinter_front.jpg",
    { type: "image/jpeg" }
  );
  const photoResult = await VehicleService.uploadVehiclePhoto(veh1Id, dummyVehPhoto, true);
  cleanup.photos.push(photoResult.photoId);
  cleanup.files.push(photoResult.fileId);
  const vehWithPhotos = await VehicleService.getVehicle(veh1Id);
  const vehiclePhotoSuccess = Boolean(
    photoResult.photoId &&
    vehWithPhotos.photos &&
    vehWithPhotos.photos.length >= 1
  );
  console.log("  Vehicle photo uploaded:", photoResult.photoId, "Count:", vehWithPhotos.photos.length);

  // 10. Verification document upload via VehicleService.uploadVerificationDocument
  console.log("\n[Regression 10] Verification Document Upload via VehicleService.uploadVerificationDocument...");
  const dummyLicense = new File(
    [new TextEncoder().encode("%PDF-1.4 Mock Regression Driver License")],
    "license_reg.pdf",
    { type: "application/pdf" }
  );
  const docResult = await VehicleService.uploadVerificationDocument(dummyLicense, "driver_license", veh1Id);
  cleanup.documents.push(docResult.id);
  cleanup.files.push(docResult.file_id);
  const docSuccess = Boolean(
    docResult.id &&
    docResult.verification_status === "pending"
  );
  console.log("  Verification doc uploaded:", docResult.id, "Status:", docResult.verification_status);

  testReport.existingVehicleRegression = Boolean(
    veh1Id &&
    vehUpdateSuccess &&
    primarySwitchSuccess &&
    vehiclePhotoSuccess &&
    docSuccess
  );
  console.log(`Existing vehicle regression: ${testReport.existingVehicleRegression ? "PASS" : "FAIL"}`);

  // ==============================================================
  // CLEANUP
  // ==============================================================
  console.log("\n--- [STEP 4] PURGING ALL TEST ARTIFACTS ---");

  await cleanupTestArtifacts();
  console.log("Database and storage successfully purged of test records.");

  // ==============================================================
  // FINAL REPORT FORMAT
  // ==============================================================
  console.log("\n==================================================");
  console.log("TRANSMOVE CREATE-PERMISSION SECURITY REPORT");
  console.log("==================================================");
  console.log(`Direct admin profile creation: ${testReport.directAdminProfileCreation ? "PASS" : "FAIL"}`);
  console.log(`Legitimate profile creation: ${testReport.legitimateProfileCreation ? "PASS" : "FAIL"}`);
  console.log(`Direct profile deletion: ${testReport.directProfileDeletion ? "PASS" : "FAIL"}`);
  console.log(`Direct verified vehicle creation: ${testReport.directVerifiedVehicleCreation ? "PASS" : "FAIL"}`);
  console.log(`Trusted vehicle creation: ${testReport.trustedVehicleCreation ? "PASS" : "FAIL"}`);
  console.log(`Driver ID spoofing: ${testReport.driverIdSpoofing ? "PASS" : "FAIL"}`);
  console.log(`Document self-verification on creation: ${testReport.documentSelfVerificationOnCreation ? "PASS" : "FAIL"}`);
  console.log(`Trusted verification document creation: ${testReport.trustedVerificationDocCreation ? "PASS" : "FAIL"}`);
  console.log(`Vehicle photo ownership spoofing: ${testReport.vehiclePhotoOwnershipSpoofing ? "PASS" : "FAIL"}`);
  console.log(`Existing auth regression: ${testReport.existingAuthRegression ? "PASS" : "FAIL"}`);
  console.log(`Existing vehicle regression: ${testReport.existingVehicleRegression ? "PASS" : "FAIL"}`);
  console.log("==================================================");

  const allPassed = Object.values(testReport).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

run().catch(async (err) => {
  console.error("FATAL ERROR during test execution:", err);
  await cleanupTestArtifacts().catch((cleanupError) => console.error("CLEANUP FAILED:", cleanupError.message));
  process.exit(1);
});
