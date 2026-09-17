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
import { assertTestCleanupCapabilities } from "./test-hygiene.js";
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach(l => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

import { Client, Account, ID } from "../assets/js/vendor/appwrite.js";

async function testJWT() {
  await assertTestCleanupCapabilities("jwt");
  console.log("Testing Appwrite createJWT()...");
  const client = new Client()
    .setEndpoint(conf.APPWRITE_ENDPOINT)
    .setProject(conf.APPWRITE_PROJECT_ID);
  const account = new Account(client);
  let user = null;
  try {
  const testEmail = `__test__.jwt.${Date.now()}@transmove.test`;
  user = await account.create(ID.unique(), testEmail, "Password123!", "JWT Test User");
  await account.createEmailPasswordSession(testEmail, "Password123!");

  // Generate JWT
  const jwtRes = await account.createJWT();
  console.log("Generated JWT:", jwtRes.jwt.slice(0, 30) + "...");

  // Verify JWT on server side using GET /account with X-Appwrite-JWT
  const verifyRes = await fetch(`${conf.APPWRITE_ENDPOINT}/account`, {
    headers: {
      "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
      "X-Appwrite-JWT": jwtRes.jwt
    }
  });
  const verifiedUser = await verifyRes.json();
  console.log("Server verified user from JWT:", verifiedUser.$id === user.$id, "User ID:", verifiedUser.$id);

  } finally {
    if (user?.$id) {
      const response = await fetch(`${conf.APPWRITE_ENDPOINT}/users/${user.$id}`, {
        method: "DELETE",
        headers: {
          "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
          "X-Appwrite-Key": conf.APPWRITE_API_KEY
        }
      });
      if (![200, 204, 404].includes(response.status)) throw new Error(`JWT test cleanup failed: HTTP ${response.status}`);
      console.log("Cleaned up test user.");
    }
  }
}

testJWT().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
