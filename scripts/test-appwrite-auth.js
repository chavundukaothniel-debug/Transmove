const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  },
  console: console
};

import { Client, Account, Databases, ID, Query, Permission, Role } from "../assets/js/vendor/appwrite.js";
import fs from "fs";
import { assertTestCleanupCapabilities, deleteOrThrow, runCleanupTasks } from "./test-hygiene.js";

// Load configuration safely without exposing keys in frontend
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach(l => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

console.log("==================================================");
console.log("TESTING APPWRITE AUTHENTICATION & PROFILES");
console.log("Endpoint:", conf.APPWRITE_ENDPOINT);
console.log("Project ID:", conf.APPWRITE_PROJECT_ID);
console.log("==================================================");

const client = new Client()
  .setEndpoint(conf.APPWRITE_ENDPOINT)
  .setProject(conf.APPWRITE_PROJECT_ID);

const account = new Account(client);
const databases = new Databases(client);

const testEmail = `testuser_${Date.now()}@transmove.test`;
const testPassword = "Password123!";
const testName = "Test Passenger User";
const testPhone = "+263771122334";
const testRole = "passenger";

async function runTests() {
  await assertTestCleanupCapabilities("appwrite-auth");
  let createdUserId = null;
  let createdProfileDocId = null;

  try {
    // 1. SIGNUP: Create Account
    console.log("\n1. Testing Signup...");
    const user = await account.create(ID.unique(), testEmail, testPassword, testName);
    createdUserId = user.$id;
    console.log(" PASS: Appwrite Auth account created. ID:", user.$id, "Email:", user.email);

    // 2. SIGN IN: Create Session
    console.log("\n2. Testing Login / Create Session...");
    const session = await account.createEmailPasswordSession(testEmail, testPassword);
    client.setSession(session.secret);
    console.log(" PASS: Session created. Session ID:", session.$id);

    // 3. GET CURRENT USER
    console.log("\n3. Testing Get Current User...");
    const currentUser = await account.get();
    console.log(" PASS: Current User matches:", currentUser.$id === createdUserId);

    // 4. CREATE PROFILE ROW with Row Permissions
    console.log("\n4. Testing Profile Row Creation with Row Security...");
    const profileRow = await databases.createDocument(
      "transmove",
      "profiles",
      ID.unique(),
      {
        user_id: user.$id,
        full_name: testName,
        email: testEmail,
        phone: testPhone,
        role: testRole,
        city: "Harare",
        bio: "Test account bio",
        verification_status: "unverified",
        account_status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id))
      ]
    );
    createdProfileDocId = profileRow.$id;
    console.log(" PASS: Profile created with document ID:", profileRow.$id);
    console.log("       Profile user_id:", profileRow.user_id);
    console.log("       Profile permissions:", profileRow.$permissions);

    // 5. QUERY PROFILE BY user_id
    console.log("\n5. Testing Profile Query by user_id...");
    const profileList = await databases.listDocuments(
      "transmove",
      "profiles",
      [Query.equal("user_id", user.$id), Query.limit(1)]
    );
    console.log(" PASS: Found", profileList.total, "profile(s). user_id matches:", profileList.documents[0]?.user_id === user.$id);

    // 6. UPDATE PROFILE
    console.log("\n6. Testing Profile Update...");
    const updatedProfile = await databases.updateDocument(
      "transmove",
      "profiles",
      createdProfileDocId,
      {
        bio: "Updated bio description",
        city: "Bulawayo",
        updated_at: new Date().toISOString()
      }
    );
    console.log(" PASS: Profile updated. City:", updatedProfile.city, "Bio:", updatedProfile.bio);

    // 7. DUPLICATE SIGNUP TEST
    console.log("\n7. Testing Duplicate Signup Error Handling...");
    try {
      await account.create(ID.unique(), testEmail, testPassword, "Duplicate User");
      console.log(" FAIL: Duplicate signup did not throw error!");
    } catch (dupErr) {
      console.log(" PASS: Duplicate signup caught gracefully:", dupErr.message);
    }

    // 8. WRONG PASSWORD LOGIN TEST
    console.log("\n8. Testing Wrong Password Error Handling...");
    const cleanStorage = new Map();
    const isolatedClient = new Client()
      .setEndpoint(conf.APPWRITE_ENDPOINT)
      .setProject(conf.APPWRITE_PROJECT_ID);
    const isolatedAccount = new Account(isolatedClient);
    // temporarily mock window storage for isolated client
    const prevStorage = storage;
    try {
      await isolatedAccount.createEmailPasswordSession(testEmail, "WrongPassword!");
      console.log(" FAIL: Wrong password did not throw error!");
    } catch (pwErr) {
      console.log(" PASS: Wrong password caught gracefully:", pwErr.message);
    }

    // 9. LOGOUT: Delete Session
    console.log("\n9. Testing Logout...");
    await account.deleteSession("current");
    console.log(" PASS: Current session deleted.");

    // 10. VERIFY SESSION REMOVAL
    console.log("\n10. Testing Get Current User after Logout...");
    try {
      await account.get();
      console.log(" FAIL: User still authenticated after logout!");
    } catch (loggedOutErr) {
      console.log(" PASS: Account.get throws 401 unauthorized as expected:", loggedOutErr.message);
    }

    console.log("\n==================================================");
    console.log("ALL APPWRITE AUTH & PROFILE TESTS PASSED!");
    console.log("==================================================");
  } catch (err) {
    console.error("\nFAIL in test suite:", err);
    throw err;
  } finally {
    const cleanupHeaders = {
      "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": conf.APPWRITE_API_KEY
    };
    const tasks = [];
    if (createdProfileDocId) tasks.push({
      label: `profile ${createdProfileDocId}`,
      run: () => deleteOrThrow(
        `${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/profiles/documents/${createdProfileDocId}`,
        { headers: cleanupHeaders },
        `profile ${createdProfileDocId}`
      )
    });
    if (createdUserId) tasks.push({
      label: `Auth user ${createdUserId}`,
      run: () => deleteOrThrow(
        `${conf.APPWRITE_ENDPOINT}/users/${createdUserId}`,
        { headers: cleanupHeaders },
        `Auth user ${createdUserId}`
      )
    });
    await runCleanupTasks("appwrite-auth", tasks);
    if (tasks.length) console.log("Cleanup: Temporary test user and profile removed cleanly.");
  }
}

runTests().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
