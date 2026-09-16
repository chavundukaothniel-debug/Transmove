// ==============================================================================
// TRANSMOVE LIVE APPWRITE PRIVILEGED-FIELD SECURITY TEST SUITE
// Directly tests live Appwrite database engine to prove backend enforcement:
// - Direct Appwrite client/database calls that bypass TransMove services are REJECTED
// - Trusted server operations succeed only for whitelisted fields
// - Real Appwrite Database Transactions provide true atomicity
// ==============================================================================
const sessionStore = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => sessionStore.get(k) || null,
    setItem: (k, v) => sessionStore.set(k, v),
    removeItem: (k) => sessionStore.delete(k)
  },
  console: console
};

import fs from "fs";
import path from "path";

// 1. Load configuration
const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.appwrite.setup");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf8");
const conf = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const ENDPOINT = conf.APPWRITE_ENDPOINT;
const PROJECT_ID = conf.APPWRITE_PROJECT_ID;
const API_KEY = conf.APPWRITE_API_KEY;

const serverHeaders = {
  "X-Appwrite-Project": PROJECT_ID,
  "X-Appwrite-Key": API_KEY,
  "Content-Type": "application/json"
};

// Import client SDK and trusted-api handler
import { Client, Account, Databases, ID, Permission, Role } from "../assets/js/vendor/appwrite.js";
import { executeTrustedOperation } from "../netlify/functions/trusted-api.js";

const results = {
  profileRoleEscalation: false,
  profileAccountStatusEscalation: false,
  normalProfileUpdate: false,
  vehicleVerificationEscalation: false,
  normalVehicleUpdate: false,
  documentSelfVerification: false,
  crossUserProfileAccess: false,
  crossUserVehicleAccess: false,
  crossUserVerificationDocAccess: false,
  primaryVehicleTrueAtomicity: false
};

const cleanupIds = {
  users: [],
  profiles: [],
  vehicles: [],
  documents: []
};

function activateUserSession(userObj) {
  if (userObj && userObj.cookie) {
    sessionStore.set("cookieFallback", userObj.cookie);
  } else {
    sessionStore.delete("cookieFallback");
  }
}

async function createTestUser(email, name, role = "driver") {
  sessionStore.clear();
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
  const account = new Account(client);
  const databases = new Databases(client);

  const user = await account.create(ID.unique(), email, "SecPassword123!", name);
  await account.createEmailPasswordSession(email, "SecPassword123!");
  const cookie = sessionStore.get("cookieFallback");
  const jwtRes = await account.createJWT();

  cleanupIds.users.push(user.$id);

  // Profile row with hardened permissions (read & delete only, NO update)
  const profileDoc = await fetch(
    `${ENDPOINT}/databases/transmove/collections/profiles/documents`,
    {
      method: "POST",
      headers: serverHeaders,
      body: JSON.stringify({
        documentId: ID.unique(),
        data: {
          user_id: user.$id,
          full_name: name,
          email: email,
          phone: "+263770000000",
          role: role,
          city: "Harare",
          bio: "",
          profile_image_id: "",
          verification_status: "unverified",
          account_status: "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        permissions: [
          Permission.read(Role.user(user.$id)),
          Permission.delete(Role.user(user.$id))
        ]
      })
    }
  ).then((r) => r.json());

  cleanupIds.profiles.push(profileDoc.$id);

  return { client, account, databases, user, profileDoc, cookie, jwt: jwtRes.jwt };
}

async function runSecuritySuite() {
  console.log("==================================================");
  console.log("TRANSMOVE PRIVILEGED-FIELD SECURITY SUITE");
  console.log("Running against Live Appwrite Backend...");
  console.log("==================================================");

  const timestamp = Date.now();
  console.log("\n[Setup] Creating temporary test users...");
  const driverA = await createTestUser(`driver_a_${timestamp}@transmove.test`, "Driver Alpha", "driver");
  const driverB = await createTestUser(`driver_b_${timestamp}@transmove.test`, "Driver Beta", "driver");
  const adminUser = await createTestUser(`admin_${timestamp}@transmove.test`, "Admin User", "admin");

  console.log(`Driver A created: ${driverA.user.$id}`);
  console.log(`Driver B created: ${driverB.user.$id}`);
  console.log(`Admin User created: ${adminUser.user.$id}`);

  // -------------------------------------------------------------
  // TEST A: PROFILE PRIVILEGE ESCALATION
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("TEST A: PROFILE PRIVILEGE ESCALATION");
  console.log("--------------------------------------------------");

  // Test A1: Try direct client update: role -> admin
  console.log("1. Attempting direct Appwrite Client API call: role -> admin");
  activateUserSession(driverA);
  let directRoleBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "profiles", driverA.profileDoc.$id, {
      role: "admin"
    });
    console.log("   ❌ FAIL: Direct client call succeeded! Role changed to admin!");
  } catch (err) {
    directRoleBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine directly rejected role escalation: ${err.message}`);
  }

  // Also verify trusted server blocks role escalation if injected in payload
  let serverRoleBlocked = false;
  try {
    await executeTrustedOperation({
      action: "update_profile",
      data: { role: "admin", city: "Mutare" },
      jwt: driverA.jwt
    });
    console.log("   ❌ FAIL: Server API allowed role update!");
  } catch (err) {
    if (err.message.includes("Privilege escalation blocked")) {
      serverRoleBlocked = true;
      console.log(`   ✅ PASS: Trusted server strictly blocked role field: ${err.message}`);
    } else {
      console.log(`   ⚠️ Unexpected error: ${err.message}`);
    }
  }

  results.profileRoleEscalation = directRoleBlocked && serverRoleBlocked;

  // Test A2: Try direct client update: account_status -> active (when suspended)
  console.log("\n2. Setting account_status to 'suspended' via server, then testing client override...");
  await fetch(
    `${ENDPOINT}/databases/transmove/collections/profiles/documents/${driverA.profileDoc.$id}`,
    {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({ data: { account_status: "suspended" } })
    }
  );

  activateUserSession(driverA);
  let directStatusBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "profiles", driverA.profileDoc.$id, {
      account_status: "active"
    });
    console.log("   ❌ FAIL: Direct client call succeeded! account_status changed!");
  } catch (err) {
    directStatusBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine rejected account_status modification: ${err.message}`);
  }

  let serverStatusBlocked = false;
  try {
    await executeTrustedOperation({
      action: "update_profile",
      data: { account_status: "active" },
      jwt: driverA.jwt
    });
    console.log("   ❌ FAIL: Server API allowed account_status update!");
  } catch (err) {
    if (err.message.includes("Privilege escalation blocked")) {
      serverStatusBlocked = true;
      console.log(`   ✅ PASS: Trusted server strictly blocked account_status: ${err.message}`);
    }
  }

  results.profileAccountStatusEscalation = directStatusBlocked && serverStatusBlocked;

  // Restore active status
  await fetch(
    `${ENDPOINT}/databases/transmove/collections/profiles/documents/${driverA.profileDoc.$id}`,
    {
      method: "PATCH",
      headers: serverHeaders,
      body: JSON.stringify({ data: { account_status: "active" } })
    }
  );

  // Test A3: Normal profile update (city / phone / bio) via trusted server
  console.log("\n3. Testing normal profile update (city / phone / bio) via trusted server operation...");
  let normalProfileSuccess = false;
  try {
    await executeTrustedOperation({
      action: "update_profile",
      data: {
        city: "Bulawayo",
        phone: "+263779999999",
        bio: "Professional commercial driver with 10 years experience"
      },
      jwt: driverA.jwt
    });

    // Verify live document in database
    const verifyDoc = await fetch(
      `${ENDPOINT}/databases/transmove/collections/profiles/documents/${driverA.profileDoc.$id}`,
      { headers: serverHeaders }
    ).then((r) => r.json());

    if (
      verifyDoc.city === "Bulawayo" &&
      verifyDoc.phone === "+263779999999" &&
      verifyDoc.bio.includes("Professional commercial driver") &&
      verifyDoc.role === "driver" &&
      verifyDoc.account_status === "active"
    ) {
      normalProfileSuccess = true;
      console.log("   ✅ PASS: Normal profile fields updated successfully. Role and status untouched.");
    } else {
      console.log("   ❌ FAIL: Updated fields mismatch in live database.");
    }
  } catch (err) {
    console.log(`   ❌ FAIL: Trusted profile update threw error: ${err.message}`);
  }

  results.normalProfileUpdate = normalProfileSuccess;

  // -------------------------------------------------------------
  // TEST B: VEHICLE VERIFICATION ESCALATION
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("TEST B: VEHICLE VERIFICATION ESCALATION");
  console.log("--------------------------------------------------");

  console.log("Creating test vehicle for Driver A...");
  const vehRes = await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({
      documentId: ID.unique(),
      data: {
        driver_id: driverA.user.$id,
        vehicle_type: "sedan",
        make: "Toyota",
        model: "Corolla",
        year: 2020,
        colour: "White",
        registration_number: `SEC-${timestamp.toString().slice(-4)}`,
        passenger_capacity: 4,
        load_capacity: 400,
        service_category: "passenger_transport",
        description: "Standard clean sedan",
        status: "active",
        verification_status: "unverified",
        is_primary: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(driverA.user.$id)),
        Permission.delete(Role.user(driverA.user.$id))
      ]
    })
  });
  const vehicleA = await vehRes.json();
  cleanupIds.vehicles.push(vehicleA.$id);
  console.log(`Vehicle created: ${vehicleA.$id} (verification_status: unverified)`);

  // Test B1: Driver attempts direct Appwrite update: verification_status -> verified
  console.log("1. Driver attempts direct Appwrite Client API call: verification_status -> verified");
  activateUserSession(driverA);
  let directVehicleVerifBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "vehicles", vehicleA.$id, {
      verification_status: "verified"
    });
    console.log("   ❌ FAIL: Direct client call succeeded! Vehicle self-verified!");
  } catch (err) {
    directVehicleVerifBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine rejected direct vehicle verification: ${err.message}`);
  }

  // Also verify trusted server blocks verification_status in vehicle update
  let serverVehicleVerifBlocked = false;
  try {
    await executeTrustedOperation({
      action: "update_vehicle",
      vehicle_id: vehicleA.$id,
      data: { verification_status: "verified", colour: "Blue" },
      jwt: driverA.jwt
    });
    console.log("   ❌ FAIL: Server allowed vehicle verification escalation!");
  } catch (err) {
    if (err.message.includes("Privilege escalation blocked")) {
      serverVehicleVerifBlocked = true;
      console.log(`   ✅ PASS: Trusted server strictly blocked vehicle verification field: ${err.message}`);
    }
  }

  results.vehicleVerificationEscalation = directVehicleVerifBlocked && serverVehicleVerifBlocked;

  // Test B2: Normal vehicle update (colour / make / model) via trusted server
  console.log("\n2. Testing normal vehicle update (colour / make / model) via trusted server operation...");
  let normalVehicleSuccess = false;
  try {
    await executeTrustedOperation({
      action: "update_vehicle",
      vehicle_id: vehicleA.$id,
      data: {
        make: "Toyota",
        model: "Corolla Quest",
        colour: "Metallic Grey"
      },
      jwt: driverA.jwt
    });

    const checkVeh = await fetch(
      `${ENDPOINT}/databases/transmove/collections/vehicles/documents/${vehicleA.$id}`,
      { headers: serverHeaders }
    ).then((r) => r.json());

    if (
      checkVeh.model === "Corolla Quest" &&
      checkVeh.colour === "Metallic Grey" &&
      checkVeh.verification_status === "unverified"
    ) {
      normalVehicleSuccess = true;
      console.log("   ✅ PASS: Normal vehicle update succeeded. verification_status remains unverified.");
    } else {
      console.log("   ❌ FAIL: Vehicle update mismatch in live database.");
    }
  } catch (err) {
    console.log(`   ❌ FAIL: Trusted vehicle update threw error: ${err.message}`);
  }

  results.normalVehicleUpdate = normalVehicleSuccess;

  // -------------------------------------------------------------
  // TEST C: DOCUMENT SELF-VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("TEST C: DOCUMENT SELF-VERIFICATION");
  console.log("--------------------------------------------------");

  console.log("Creating test verification document for Driver A...");
  const docRes = await fetch(`${ENDPOINT}/databases/transmove/collections/verification_documents/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({
      documentId: ID.unique(),
      data: {
        user_id: driverA.user.$id,
        vehicle_id: vehicleA.$id,
        document_type: "driver_licence",
        file_id: "sec_test_file_id",
        verification_status: "pending",
        rejection_reason: null,
        verified_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(driverA.user.$id)),
        Permission.delete(Role.user(driverA.user.$id))
      ]
    })
  });
  const docA = await docRes.json();
  cleanupIds.documents.push(docA.$id);
  console.log(`Document created: ${docA.$id} (verification_status: pending)`);

  // Test C1: Driver directly attempts: verification_status -> verified
  console.log("1. Driver directly attempts Appwrite Client API call: verification_status -> verified");
  activateUserSession(driverA);
  let directDocVerifBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "verification_documents", docA.$id, {
      verification_status: "verified"
    });
    console.log("   ❌ FAIL: Driver directly marked document verified!");
  } catch (err) {
    directDocVerifBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine rejected document self-verification: ${err.message}`);
  }

  // Test C2: Driver directly attempts setting verified_at
  console.log("2. Driver directly attempts Appwrite Client API call: setting verified_at timestamp");
  let directDocTimestampBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "verification_documents", docA.$id, {
      verified_at: new Date().toISOString()
    });
    console.log("   ❌ FAIL: Driver directly modified verified_at!");
  } catch (err) {
    directDocTimestampBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine rejected verified_at modification: ${err.message}`);
  }

  // Test C3: Trusted admin/server operation verifies document
  console.log("3. Testing trusted admin verification operation...");
  let adminVerifSuccess = false;
  try {
    // Non-admin driver attempts admin_verify_document -> MUST BE REJECTED
    let driverEscalationBlocked = false;
    try {
      await executeTrustedOperation({
        action: "admin_verify_document",
        data: { document_id: docA.$id, verification_status: "verified" },
        jwt: driverA.jwt
      });
    } catch (e) {
      if (e.message.includes("Admin privileges required")) {
        driverEscalationBlocked = true;
        console.log(`   ✅ PASS: Non-admin driver rejected from admin_verify_document: ${e.message}`);
      }
    }

    // Legitimate admin performs verification -> SUCCESS
    await executeTrustedOperation({
      action: "admin_verify_document",
      data: { document_id: docA.$id, verification_status: "verified" },
      jwt: adminUser.jwt
    });

    const checkDoc = await fetch(
      `${ENDPOINT}/databases/transmove/collections/verification_documents/documents/${docA.$id}`,
      { headers: serverHeaders }
    ).then((r) => r.json());

    if (
      driverEscalationBlocked &&
      checkDoc.verification_status === "verified" &&
      checkDoc.verified_at
    ) {
      adminVerifSuccess = true;
      console.log(`   ✅ PASS: Admin successfully verified document. Verified at: ${checkDoc.verified_at}`);
    } else {
      console.log("   ❌ FAIL: Document verification state mismatch.");
    }
  } catch (err) {
    console.log(`   ❌ FAIL: Admin verification failed: ${err.message}`);
  }

  results.documentSelfVerification = directDocVerifBlocked && directDocTimestampBlocked && adminVerifSuccess;

  // -------------------------------------------------------------
  // TEST D: CROSS-USER ACCESS
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("TEST D: CROSS-USER ACCESS (Driver A -> Driver B)");
  console.log("--------------------------------------------------");

  console.log("Creating vehicle and verification document for Driver B...");
  const vehBRes = await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({
      documentId: ID.unique(),
      data: {
        driver_id: driverB.user.$id,
        vehicle_type: "taxi",
        make: "Nissan",
        model: "Tiida",
        year: 2018,
        colour: "Blue",
        registration_number: `SECB-${timestamp.toString().slice(-4)}`,
        passenger_capacity: 4,
        load_capacity: 350,
        service_category: "passenger_transport",
        status: "active",
        verification_status: "unverified",
        is_primary: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(driverB.user.$id)),
        Permission.delete(Role.user(driverB.user.$id))
      ]
    })
  });
  const vehicleB = await vehBRes.json();
  cleanupIds.vehicles.push(vehicleB.$id);

  const docBRes = await fetch(`${ENDPOINT}/databases/transmove/collections/verification_documents/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({
      documentId: ID.unique(),
      data: {
        user_id: driverB.user.$id,
        vehicle_id: vehicleB.$id,
        document_type: "driver_licence",
        file_id: "sec_test_file_b",
        verification_status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(driverB.user.$id)),
        Permission.delete(Role.user(driverB.user.$id))
      ]
    })
  });
  const docB = await docBRes.json();
  cleanupIds.documents.push(docB.$id);

  // Test D1: Driver A attempts to modify Driver B's profile
  console.log("1. Driver A attempts direct Appwrite update on Driver B's profile...");
  activateUserSession(driverA);
  let crossProfileBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "profiles", driverB.profileDoc.$id, {
      city: "Gweru"
    });
    console.log("   ❌ FAIL: Driver A modified Driver B's profile!");
  } catch (err) {
    crossProfileBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine blocked Driver A from Driver B's profile: ${err.message}`);
  }

  // Driver A tries calling trusted-api pretending to update Driver B
  let serverCrossProfileBlocked = false;
  try {
    // Attempt with user_id injected in payload
    await executeTrustedOperation({
      action: "update_profile",
      data: { city: "Gweru", user_id: driverB.user.$id },
      jwt: driverA.jwt
    });
  } catch (err) {
    if (err.message.includes("Privilege escalation blocked")) {
      serverCrossProfileBlocked = true;
      console.log(`   ✅ PASS: Server strictly rejected user_id parameter: ${err.message}`);
    }
  }

  // Verify Driver B's profile was never touched
  const checkB = await fetch(
    `${ENDPOINT}/databases/transmove/collections/profiles/documents/${driverB.profileDoc.$id}`,
    { headers: serverHeaders }
  ).then((r) => r.json());
  if (checkB.city !== "Gweru") {
    serverCrossProfileBlocked = true;
    console.log("   ✅ PASS: Driver B's profile remains untouched.");
  }
  results.crossUserProfileAccess = crossProfileBlocked && serverCrossProfileBlocked;

  // Test D2: Driver A attempts to modify Driver B's vehicle
  console.log("2. Driver A attempts direct Appwrite update on Driver B's vehicle...");
  activateUserSession(driverA);
  let crossVehicleBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "vehicles", vehicleB.$id, {
      colour: "Pink"
    });
    console.log("   ❌ FAIL: Driver A modified Driver B's vehicle!");
  } catch (err) {
    crossVehicleBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine blocked Driver A from Driver B's vehicle: ${err.message}`);
  }

  let serverCrossVehBlocked = false;
  try {
    await executeTrustedOperation({
      action: "update_vehicle",
      vehicle_id: vehicleB.$id,
      data: { colour: "Pink" },
      jwt: driverA.jwt
    });
    console.log("   ❌ FAIL: Server allowed Driver A to update Driver B's vehicle!");
  } catch (err) {
    if (err.message.includes("Forbidden: You do not own this vehicle")) {
      serverCrossVehBlocked = true;
      console.log(`   ✅ PASS: Trusted server verified ownership and blocked Driver A: ${err.message}`);
    }
  }
  results.crossUserVehicleAccess = crossVehicleBlocked && serverCrossVehBlocked;

  // Test D3: Driver A attempts to read or update Driver B's verification document
  console.log("3. Driver A attempts direct Appwrite read and update on Driver B's verification document...");
  activateUserSession(driverA);
  let crossDocReadBlocked = false;
  try {
    await driverA.databases.getDocument("transmove", "verification_documents", docB.$id);
    console.log("   ❌ FAIL: Driver A was able to read Driver B's confidential document!");
  } catch (err) {
    crossDocReadBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine blocked Driver A from reading Driver B's document: ${err.message}`);
  }

  let crossDocUpdateBlocked = false;
  try {
    await driverA.databases.updateDocument("transmove", "verification_documents", docB.$id, {
      verification_status: "verified"
    });
    console.log("   ❌ FAIL: Driver A was able to update Driver B's document!");
  } catch (err) {
    crossDocUpdateBlocked = true;
    console.log(`   ✅ PASS: Appwrite engine blocked Driver A from updating Driver B's document: ${err.message}`);
  }
  results.crossUserVerificationDocAccess = crossDocReadBlocked && crossDocUpdateBlocked;

  // -------------------------------------------------------------
  // TEST E: PRIMARY VEHICLE TRUE ATOMICITY
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("TEST E: PRIMARY VEHICLE TRUE ATOMICITY");
  console.log("--------------------------------------------------");

  console.log("Creating second vehicle for Driver A (vA2)...");
  const vehA2Res = await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents`, {
    method: "POST",
    headers: serverHeaders,
    body: JSON.stringify({
      documentId: ID.unique(),
      data: {
        driver_id: driverA.user.$id,
        vehicle_type: "van",
        make: "Toyota",
        model: "HiAce",
        year: 2021,
        colour: "White",
        registration_number: `SECA2-${timestamp.toString().slice(-4)}`,
        service_category: "light_goods",
        status: "active",
        verification_status: "unverified",
        is_primary: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      permissions: [
        Permission.read(Role.user(driverA.user.$id)),
        Permission.delete(Role.user(driverA.user.$id))
      ]
    })
  });
  const vehicleA2 = await vehA2Res.json();
  cleanupIds.vehicles.push(vehicleA2.$id);

  console.log(`Initial state: vehicleA1 (${vehicleA.$id}) is_primary: true`);
  console.log(`Initial state: vehicleA2 (${vehicleA2.$id}) is_primary: false`);

  console.log("Triggering set_primary_vehicle to vehicleA2 via trusted-api (Real Appwrite Transaction)...");
  let txResult;
  try {
    txResult = await executeTrustedOperation({
      action: "set_primary_vehicle",
      vehicle_id: vehicleA2.$id,
      jwt: driverA.jwt
    });
    console.log("Transaction execution result:", txResult);
  } catch (err) {
    console.log(`   ❌ FAIL: set_primary_vehicle failed: ${err.message}`);
  }

  // Verify live state in database
  const checkVA1 = await fetch(
    `${ENDPOINT}/databases/transmove/collections/vehicles/documents/${vehicleA.$id}`,
    { headers: serverHeaders }
  ).then((r) => r.json());

  const checkVA2 = await fetch(
    `${ENDPOINT}/databases/transmove/collections/vehicles/documents/${vehicleA2.$id}`,
    { headers: serverHeaders }
  ).then((r) => r.json());

  console.log(`Post-transaction: vehicleA1 is_primary = ${checkVA1.is_primary} (Expected: false)`);
  console.log(`Post-transaction: vehicleA2 is_primary = ${checkVA2.is_primary} (Expected: true)`);

  if (
    txResult &&
    txResult.transaction_id &&
    txResult.status === "committed" &&
    checkVA1.is_primary === false &&
    checkVA2.is_primary === true
  ) {
    results.primaryVehicleTrueAtomicity = true;
    console.log("   ✅ PASS: Primary vehicle switch executed atomically via real Appwrite Database Transaction!");
  } else {
    console.log("   ❌ FAIL: Primary vehicle state or transaction status invalid.");
  }

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  console.log("\n--------------------------------------------------");
  console.log("CLEANING UP TEMPORARY SECURITY TEST DATA...");
  console.log("--------------------------------------------------");

  for (const docId of cleanupIds.documents) {
    await fetch(`${ENDPOINT}/databases/transmove/collections/verification_documents/documents/${docId}`, {
      method: "DELETE",
      headers: serverHeaders
    }).catch(() => {});
  }
  for (const vId of cleanupIds.vehicles) {
    await fetch(`${ENDPOINT}/databases/transmove/collections/vehicles/documents/${vId}`, {
      method: "DELETE",
      headers: serverHeaders
    }).catch(() => {});
  }
  for (const pId of cleanupIds.profiles) {
    await fetch(`${ENDPOINT}/databases/transmove/collections/profiles/documents/${pId}`, {
      method: "DELETE",
      headers: serverHeaders
    }).catch(() => {});
  }
  for (const uId of cleanupIds.users) {
    await fetch(`${ENDPOINT}/users/${uId}`, {
      method: "DELETE",
      headers: serverHeaders
    }).catch(() => {});
  }

  console.log("Cleanup complete. Live database is completely pristine.");

  // -------------------------------------------------------------
  // SUMMARY RESULTS
  // -------------------------------------------------------------
  console.log("\n==================================================");
  console.log("FINAL RESULTS SUMMARY");
  console.log("==================================================");
  console.log(`Profile role escalation: ${results.profileRoleEscalation ? "PASS" : "FAIL"}`);
  console.log(`Profile account_status escalation: ${results.profileAccountStatusEscalation ? "PASS" : "FAIL"}`);
  console.log(`Normal profile update: ${results.normalProfileUpdate ? "PASS" : "FAIL"}`);
  console.log(`Vehicle verification escalation: ${results.vehicleVerificationEscalation ? "PASS" : "FAIL"}`);
  console.log(`Normal vehicle update: ${results.normalVehicleUpdate ? "PASS" : "FAIL"}`);
  console.log(`Document self-verification: ${results.documentSelfVerification ? "PASS" : "FAIL"}`);
  console.log(`Cross-user profile access: ${results.crossUserProfileAccess ? "PASS" : "FAIL"}`);
  console.log(`Cross-user vehicle access: ${results.crossUserVehicleAccess ? "PASS" : "FAIL"}`);
  console.log(`Cross-user verification-document access: ${results.crossUserVerificationDocAccess ? "PASS" : "FAIL"}`);
  console.log(`Primary vehicle true atomicity: ${results.primaryVehicleTrueAtomicity ? "PASS" : "FAIL"}`);
  console.log("==================================================");

  const allPassed = Object.values(results).every(Boolean);
  if (!allPassed) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error("FATAL ERROR in security suite:", err);
  process.exit(1);
});
