// Read-only Appwrite data audit for TransMove.
//
// This script NEVER deletes or updates data. It classifies only strong,
// deterministic automated-test markers as confirmed test accounts and keeps
// every ambiguous account. Run it before any cleanup operation:
//   node scripts/audit-test-data.js
//   node scripts/audit-test-data.js --json

import fs from "fs";
import path from "path";

const DATABASE_ID = "transmove";
const ENV_FILE = path.resolve(process.cwd(), ".env.appwrite.setup");
const JSON_OUTPUT = process.argv.includes("--json");

function loadConfig() {
  if (!fs.existsSync(ENV_FILE)) {
    throw new Error("Missing .env.appwrite.setup; live Appwrite audit cannot run.");
  }
  const values = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ["APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"]) {
    if (!values[key]) throw new Error(`Missing ${key} in .env.appwrite.setup.`);
  }
  return values;
}

const conf = loadConfig();
const headers = {
  "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
  "X-Appwrite-Key": conf.APPWRITE_API_KEY,
  "Content-Type": "application/json"
};

function query(method, attribute, values) {
  const value = { method, values };
  if (attribute) value.attribute = attribute;
  return JSON.stringify(value);
}

async function request(apiPath, { optional = false } = {}) {
  const response = await fetch(`${conf.APPWRITE_ENDPOINT}${apiPath}`, { headers });
  if (!response.ok) {
    if (optional && response.status === 404) return null;
    const error = await response.json().catch(() => ({}));
    throw new Error(`${response.status} ${error.message || response.statusText} (${apiPath})`);
  }
  return response.json();
}

async function listAll(apiPath, resultKey) {
  const records = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const params = new URLSearchParams();
    params.append("queries[]", query("limit", null, [pageSize]));
    params.append("queries[]", query("offset", null, [offset]));
    const separator = apiPath.includes("?") ? "&" : "?";
    const page = await request(`${apiPath}${separator}${params}`);
    const items = page[resultKey] || [];
    records.push(...items);
    if (items.length < pageSize || records.length >= Number(page.total || 0)) break;
  }
  return records;
}

function classifyIdentity({ email = "", name = "", full_name = "", prefs = {} }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || full_name || "").trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1] || "";

  if (domain === "transmove.test" || domain === "tm.test" || domain.endsWith(".test")) {
    return {
      classification: "confirmed_test",
      reason: `Reserved .test email domain used by automated suites (${domain})`
    };
  }
  if (prefs?.test_mode === true || prefs?.is_test === true || prefs?.transmove_test === true) {
    return { classification: "confirmed_test", reason: "Explicit Appwrite test metadata" };
  }

  const explicitGeneratedEmail = /(?:^|[._+-])(?:__test__|regression|debug|temporary|testuser|jwt_test|perm_test|verif_test|reg_driver|driver_[abc]_\d{8,}|passenger_[px]_\d{8,})(?:[._+@-]|$)/i;
  if (explicitGeneratedEmail.test(normalizedEmail)) {
    return { classification: "review_only", reason: "Test-like email marker on a non-reserved domain" };
  }
  if (/\b(?:regression|debug|temporary test|test user|driver alpha|driver beta)\b/i.test(normalizedName)) {
    return { classification: "review_only", reason: "Test-like display name without corroborating test metadata" };
  }

  return { classification: "preserved", reason: "No deterministic automated-test marker" };
}

function documentIdentity(document) {
  return classifyIdentity({
    email: document.email,
    full_name: document.full_name || document.name
  });
}

function containsAnyReference(value, ids) {
  if (typeof value === "string") return ids.has(value);
  if (Array.isArray(value)) return value.some((entry) => containsAnyReference(entry, ids));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, entry]) => {
      if (key.startsWith("$")) return false;
      return containsAnyReference(entry, ids);
    });
  }
  return false;
}

async function audit() {
  let authInspectionError = null;
  const [users, collections] = await Promise.all([
    listAll("/users", "users").catch((error) => {
      authInspectionError = error.message;
      return [];
    }),
    listAll(`/databases/${DATABASE_ID}/collections`, "collections")
  ]);
  const authInspectionAvailable = authInspectionError === null;

  const documentsByCollection = {};
  await Promise.all(collections.map(async (collection) => {
    documentsByCollection[collection.$id] = await listAll(
      `/databases/${DATABASE_ID}/collections/${collection.$id}/documents`,
      "documents"
    );
  }));

  const profiles = documentsByCollection.profiles || [];
  const profilesByUser = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const authById = new Map(users.map((user) => [user.$id, user]));
  const confirmedUsers = [];
  const reviewUsers = [];
  const preservedUsers = [];

  for (const user of users) {
    const profile = profilesByUser.get(user.$id);
    const authClass = classifyIdentity(user);
    const profileClass = profile ? documentIdentity(profile) : { classification: "preserved", reason: "" };
    const classification = authClass.classification === "confirmed_test" || profileClass.classification === "confirmed_test"
      ? { classification: "confirmed_test", reason: authClass.classification === "confirmed_test" ? authClass.reason : profileClass.reason }
      : authClass.classification === "review_only" || profileClass.classification === "review_only"
        ? { classification: "review_only", reason: authClass.classification === "review_only" ? authClass.reason : profileClass.reason }
        : authClass;
    const summary = {
      user_id: user.$id,
      email: user.email || profile?.email || "",
      name: user.name || profile?.full_name || "",
      role: profile?.role || "no profile",
      profile_id: profile?.$id || null,
      created_at: user.$createdAt || profile?.created_at || null,
      reason: classification.reason
    };
    if (classification.classification === "confirmed_test") confirmedUsers.push(summary);
    else if (classification.classification === "review_only") reviewUsers.push(summary);
    else preservedUsers.push(summary);
  }

  // A database-only fallback is intentionally read-only. It permits review of
  // the profile dependency graph when the API key lacks users.read, but cleanup
  // must stay blocked until Auth inspection succeeds.
  if (!authInspectionAvailable) {
    for (const profile of profiles) {
      const classification = documentIdentity(profile);
      const summary = {
        user_id: profile.user_id,
        email: profile.email || "",
        name: profile.full_name || "",
        role: profile.role || "",
        profile_id: profile.$id,
        created_at: profile.created_at || profile.$createdAt || null,
        reason: classification.reason
      };
      if (classification.classification === "confirmed_test") confirmedUsers.push(summary);
      else if (classification.classification === "review_only") reviewUsers.push(summary);
      else preservedUsers.push(summary);
    }
  }

  // Include test-marked orphan profiles in the dependency audit. They are not
  // silently promoted to an Auth user, and are reported separately.
  const orphanProfiles = profiles
    .filter((profile) => !authById.has(profile.user_id))
    .map((profile) => ({ profile, classification: documentIdentity(profile) }));
  const confirmedOrphanProfiles = authInspectionAvailable
    ? orphanProfiles.filter((item) => item.classification.classification === "confirmed_test")
    : [];
  const reviewOrphanProfiles = authInspectionAvailable
    ? orphanProfiles.filter((item) => item.classification.classification === "review_only")
    : [];

  const confirmedUserIds = new Set(confirmedUsers.map((user) => user.user_id));
  for (const item of confirmedOrphanProfiles) confirmedUserIds.add(item.profile.user_id);

  // Build a transitive dependency map. A row is related when it directly
  // references a confirmed test user or another confirmed test row.
  const relatedDocumentIds = new Set();
  const relatedByCollection = Object.fromEntries(collections.map((collection) => [collection.$id, []]));
  let changed = true;
  while (changed) {
    changed = false;
    const knownIds = new Set([...confirmedUserIds, ...relatedDocumentIds]);
    for (const collection of collections) {
      for (const document of documentsByCollection[collection.$id] || []) {
        if (relatedDocumentIds.has(document.$id)) continue;
        const identity = documentIdentity(document);
        const explicitTestDocument = identity.classification === "confirmed_test";
        if (explicitTestDocument || containsAnyReference(document, knownIds)) {
          relatedDocumentIds.add(document.$id);
          relatedByCollection[collection.$id].push(document);
          changed = true;
        }
      }
    }
  }

  const relatedFiles = new Set();
  for (const documents of Object.values(relatedByCollection)) {
    for (const document of documents) {
      for (const key of ["file_id", "profile_image_id"]) {
        if (document[key]) relatedFiles.add(document[key]);
      }
    }
  }

  const dependencyCounts = Object.fromEntries(
    Object.entries(relatedByCollection)
      .filter(([, documents]) => documents.length > 0)
      .map(([collectionId, documents]) => [collectionId, documents.length])
  );

  const isRelatedTestDocument = (document) => relatedDocumentIds.has(document.$id);
  const preservedProviderProfiles = profiles.filter((profile) =>
    !isRelatedTestDocument(profile) &&
    ["driver", "owner", "vehicle_owner", "logistics", "logistics_provider", "machinery_owner"].includes(profile.role)
  );
  const preservedProviderIds = new Set(preservedProviderProfiles.map((profile) => profile.user_id));
  const preservedVehicles = (documentsByCollection.vehicles || []).filter((vehicle) =>
    !isRelatedTestDocument(vehicle) && preservedProviderIds.has(vehicle.driver_id)
  );
  const preservedVehicleIds = new Set(preservedVehicles.map((vehicle) => vehicle.$id));
  const preservedDocuments = (documentsByCollection.verification_documents || []).filter((document) =>
    !isRelatedTestDocument(document) && preservedProviderIds.has(document.user_id)
  );
  const preservedVehiclePhotos = (documentsByCollection.vehicle_photos || []).filter((photo) =>
    !isRelatedTestDocument(photo) &&
    (preservedProviderIds.has(photo.driver_id) || preservedVehicleIds.has(photo.vehicle_id))
  );

  const perUser = confirmedUsers.map((testUser) => {
    const ownedIds = new Set([testUser.user_id, testUser.profile_id].filter(Boolean));
    const counts = {};
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const [collectionId, documents] of Object.entries(relatedByCollection)) {
        for (const document of documents) {
          if (ownedIds.has(document.$id)) continue;
          if (containsAnyReference(document, ownedIds)) {
            ownedIds.add(document.$id);
            counts[collectionId] = (counts[collectionId] || 0) + 1;
            expanded = true;
          }
        }
      }
    }
    return { ...testUser, related_record_counts: counts };
  });

  const report = {
    generated_at: new Date().toISOString(),
    mode: "DRY_RUN_READ_ONLY",
    auth_inspection: {
      available: authInspectionAvailable,
      error: authInspectionError
    },
    totals: {
      auth_users: users.length,
      profiles: profiles.length,
      collections: collections.length,
      confirmed_test_users: confirmedUsers.length,
      confirmed_test_orphan_profiles: confirmedOrphanProfiles.length,
      review_only_users: reviewUsers.length,
      preserved_users: preservedUsers.length,
      related_storage_files: relatedFiles.size
    },
    test_users_to_delete: perUser,
    confirmed_test_orphan_profiles: confirmedOrphanProfiles.map(({ profile, classification }) => ({
      profile_id: profile.$id,
      user_id: profile.user_id,
      email: profile.email || "",
      name: profile.full_name || "",
      role: profile.role || "",
      reason: classification.reason
    })),
    review_only_keep: reviewUsers,
    real_preserved_users: preservedUsers,
    preserved_verification_assets: {
      providers: preservedProviderProfiles.map((profile) => ({
        profile_id: profile.$id,
        user_id: profile.user_id,
        email: profile.email || "",
        name: profile.full_name || "",
        role: profile.role,
        phone: profile.phone || "",
        profile_image_present: Boolean(profile.profile_image_id),
        verification_status: profile.verification_status,
        created_at: profile.created_at || profile.$createdAt
      })),
      vehicles: preservedVehicles.map((vehicle) => ({
        vehicle_id: vehicle.$id,
        driver_id: vehicle.driver_id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        registration_number: vehicle.registration_number,
        service_category: vehicle.service_category,
        verification_status: vehicle.verification_status,
        created_at: vehicle.created_at || vehicle.$createdAt,
        photo_count: preservedVehiclePhotos.filter((photo) => photo.vehicle_id === vehicle.$id).length,
        document_count: preservedDocuments.filter((document) => document.vehicle_id === vehicle.$id).length
      })),
      documents: preservedDocuments.map((document) => ({
        document_id: document.$id,
        user_id: document.user_id,
        vehicle_id: document.vehicle_id || null,
        document_type: document.document_type,
        file_present: Boolean(document.file_id),
        verification_status: document.verification_status,
        rejection_reason: document.rejection_reason || null,
        created_at: document.created_at || document.$createdAt,
        expires_at: document.expires_at || null,
        permissions: document.$permissions || []
      }))
    },
    dependency_counts: dependencyCounts,
    live_collection_counts: Object.fromEntries(
      collections.map((collection) => [collection.$id, (documentsByCollection[collection.$id] || []).length])
    )
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("TRANSMOVE TEST DATA DRY RUN (READ ONLY)");
  console.log(`Generated: ${report.generated_at}`);
  console.log("No records were changed or deleted.\n");
  if (!authInspectionAvailable) {
    console.log("AUTH INSPECTION: BLOCKED - configured key lacks users.read scope");
    console.log("DELETION GATE: CLOSED - no cleanup may run until Auth inspection succeeds\n");
  } else {
    console.log("AUTH INSPECTION: COMPLETE\n");
  }
  console.log(`TEST USERS TO DELETE (${perUser.length})`);
  for (const user of perUser) {
    console.log(`- ${user.user_id} | ${user.email} | ${user.name} | ${user.role}`);
    console.log(`  Reason: ${user.reason}`);
    console.log(`  Related: ${JSON.stringify(user.related_record_counts)}`);
  }
  console.log(`\nREVIEW ONLY - KEPT (${reviewUsers.length})`);
  for (const user of reviewUsers) {
    console.log(`- ${user.user_id} | ${user.email} | ${user.name} | ${user.role} | ${user.reason}`);
  }
  console.log(`\nREAL / PRESERVED USERS (${preservedUsers.length})`);
  for (const user of preservedUsers) {
    console.log(`- ${user.user_id} | ${user.email} | ${user.name} | ${user.role}`);
  }
  console.log("\nDEPENDENCY COUNTS");
  for (const [collectionId, count] of Object.entries(dependencyCounts)) {
    console.log(`- ${collectionId}: ${count}`);
  }
  console.log(`- storage_files: ${relatedFiles.size}`);
  console.log("\nPRESERVED REAL VERIFICATION ASSETS");
  console.log(JSON.stringify(report.preserved_verification_assets, null, 2));
  console.log("\nLIVE COLLECTION COUNTS");
  for (const [collectionId, count] of Object.entries(report.live_collection_counts)) {
    console.log(`- ${collectionId}: ${count}`);
  }
}

audit().catch((error) => {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 1;
});
