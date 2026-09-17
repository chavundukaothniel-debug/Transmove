// Idempotent verification schema migration.
// Adds rejection-reason fields without modifying or deleting existing records.

import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
const conf = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (match) conf[match[1]] = match[2];
}

const headers = {
  "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": conf.APPWRITE_API_KEY,
  "Content-Type": "application/json"
};

async function getCollection(collectionId) {
  const response = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/${collectionId}`, { headers });
  if (!response.ok) throw new Error(`Unable to inspect ${collectionId}.`);
  return response.json();
}

async function ensureStringAttribute(collectionId, key, size = 1000) {
  const collection = await getCollection(collectionId);
  const existing = (collection.attributes || []).find((attribute) => attribute.key === key);
  if (existing) {
    if (existing.status !== "available") throw new Error(`${collectionId}.${key} is ${existing.status}.`);
    console.log(`UNCHANGED ${collectionId}.${key}`);
    return;
  }
  const response = await fetch(
    `${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/${collectionId}/attributes/string`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ key, size, required: false, default: "", array: false, encrypt: false })
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Unable to add ${collectionId}.${key}.`);
  }
  console.log(`CREATED ${collectionId}.${key}`);
}

await ensureStringAttribute("profiles", "verification_rejection_reason", 1000);
await ensureStringAttribute("vehicles", "rejection_reason", 1000);
console.log("Verification schema migration complete.");
