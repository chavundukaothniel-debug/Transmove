import fs from "fs";
const env = fs.readFileSync(".env.appwrite.setup", "utf8");
const conf = {};
env.split("\n").forEach((l) => {
  const parts = l.split("=");
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join("=").trim();
});

const collections = ["profiles", "vehicles", "verification_documents", "vehicle_photos", "service_requests", "request_images"];
for (const c of collections) {
  const res = await fetch(conf.APPWRITE_ENDPOINT + "/databases/transmove/collections/" + c, {
    headers: { "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID, "X-Appwrite-Key": conf.APPWRITE_API_KEY }
  }).then((r) => r.json());
  console.log(c, "-> permissions:", res.$permissions, "documentSecurity:", res.documentSecurity);
}
