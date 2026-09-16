const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  },
  location: { origin: "http://localhost:3000" },
  console: console
};

import fs from "fs";
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach(l => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

import { Client, Account, Databases, ID, Permission, Role } from "../assets/js/vendor/appwrite.js";

async function testRowPermissionBlock() {
  console.log("Testing direct client row update blocking...");

  // 1. User registers & signs in
  const client = new Client().setEndpoint(conf.APPWRITE_ENDPOINT).setProject(conf.APPWRITE_PROJECT_ID);
  const account = new Account(client);
  const databases = new Databases(client);

  const testEmail = `perm_test_${Date.now()}@transmove.test`;
  const user = await account.create(ID.unique(), testEmail, "Password123!", "Perm Tester");
  await account.createEmailPasswordSession(testEmail, "Password123!");

  // 2. Create document with READ and DELETE only (NO UPDATE)
  const doc = await databases.createDocument(
    "transmove",
    "profiles",
    ID.unique(),
    {
      user_id: user.$id,
      full_name: "Perm Tester",
      email: testEmail,
      role: "passenger",
      account_status: "active",
      verification_status: "unverified",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    [
      Permission.read(Role.user(user.$id)),
      Permission.delete(Role.user(user.$id))
      // NO Permission.update!
    ]
  );
  console.log("Document created with permissions:", doc.$permissions);

  // 3. Attempt direct client update: try to change role to "admin"
  console.log("Attempting direct client update: role -> admin");
  let directUpdateBlocked = false;
  try {
    await databases.updateDocument("transmove", "profiles", doc.$id, {
      role: "admin"
    });
    console.log("FAIL: Direct client update SUCCEEDED! (Security breach)");
  } catch (err) {
    directUpdateBlocked = true;
    console.log("PASS: Direct client update REJECTED by Appwrite:", err.message);
  }

  // 4. Cleanup
  await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/profiles/documents/${doc.$id}`, {
    method: "DELETE",
    headers: { "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID, "X-Appwrite-Key": conf.APPWRITE_API_KEY }
  });
  await fetch(`${conf.APPWRITE_ENDPOINT}/users/${user.$id}`, {
    method: "DELETE",
    headers: { "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID, "X-Appwrite-Key": conf.APPWRITE_API_KEY }
  });
  console.log("Cleanup finished.");
}

testRowPermissionBlock().catch(console.error);
