import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");
const envContent = fs.readFileSync(envPath, "utf8");
const conf = {};
envContent.split("\n").forEach((line) => {
  const parts = line.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const serverHeaders = {
  "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": conf.APPWRITE_API_KEY,
  "Content-Type": "application/json"
};

const collectionsToHarden = [
  { id: "profiles", name: "Profiles" },
  { id: "vehicles", name: "Vehicles" },
  { id: "verification_documents", name: "Verification Documents" },
  { id: "vehicle_photos", name: "Vehicle Photos" },
  { id: "service_requests", name: "Service Requests" },
  { id: "request_images", name: "Request Images" }
];

async function hardenCollections() {
  console.log("Hardening Appwrite Table-Level Permissions (Removing Client CREATE)...");

  for (const c of collectionsToHarden) {
    const res = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/${c.id}`, {
      method: "PUT",
      headers: serverHeaders,
      body: JSON.stringify({
        name: c.name,
        permissions: [], // Empty permissions = NO direct client create/read/update/delete at table level!
        documentSecurity: true, // Row-level security strictly enforced
        enabled: true
      })
    });

    const d = await res.json();
    if (res.ok) {
      console.log(`✅ [${c.id}]: Table permissions hardened to [] (documentSecurity: ${d.documentSecurity})`);
    } else {
      console.error(`❌ [${c.id}]: Failed to update permissions:`, d.message);
    }
  }

  // Audit request_images (do not change, just check)
  const reqImgRes = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/request_images`, {
    headers: serverHeaders
  }).then((r) => r.json());
  console.log(`ℹ️ [request_images]: Audited. Permissions:`, reqImgRes.$permissions, `documentSecurity:`, reqImgRes.documentSecurity);
}

hardenCollections().catch(console.error);
