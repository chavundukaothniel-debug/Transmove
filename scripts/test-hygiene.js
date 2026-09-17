// Shared safeguards for every live TransMove test suite.
// Live tests must prove they can clean up Auth users before creating anything.

import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env.appwrite.setup");

function loadConfig() {
  const conf = {};
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) conf[match[1]] = match[2];
  }
  return conf;
}

export function createTestEmail(suite, suffix = "user") {
  const safeSuite = String(suite || "suite").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  const safeSuffix = String(suffix || "user").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
  return `__test__.${safeSuite}.${safeSuffix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@transmove.test`;
}

export async function assertTestCleanupCapabilities(suiteName = "live-suite") {
  const conf = loadConfig();
  if (!conf.APPWRITE_ENDPOINT || !conf.APPWRITE_PROJECT_ID || !conf.APPWRITE_API_KEY) {
    throw new Error(`[${suiteName}] Refusing to run: Appwrite cleanup credentials are incomplete.`);
  }
  const headers = {
    "X-Appwrite-Project": conf.APPWRITE_PROJECT_ID,
    "X-Appwrite-Key": conf.APPWRITE_API_KEY
  };
  const listProbe = await fetch(
    `${conf.APPWRITE_ENDPOINT}/users?queries[]=${encodeURIComponent(JSON.stringify({ method: "limit", values: [1] }))}`,
    { headers }
  );
  if (!listProbe.ok) {
    const error = await listProbe.json().catch(() => ({}));
    throw new Error(
      `[${suiteName}] Refusing to create live test users because Auth discovery/cleanup is unavailable ` +
      `(HTTP ${listProbe.status}: ${error.message || listProbe.statusText}). Add users.read to the server test key first.`
    );
  }
  const probeId = `__test__cleanup_probe_${Date.now()}`.slice(0, 36);
  const response = await fetch(`${conf.APPWRITE_ENDPOINT}/users/${probeId}`, {
    method: "DELETE",
    headers
  });
  // 404 proves the key was authorized and only the deliberately absent probe
  // user was missing. 204 is accepted for forward compatibility.
  if (![204, 404].includes(response.status)) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `[${suiteName}] Refusing to create live test users because guaranteed Auth cleanup is unavailable ` +
      `(HTTP ${response.status}: ${error.message || response.statusText}). Add users.write to the server test key first.`
    );
  }
  return true;
}

export async function deleteOrThrow(url, options, label) {
  const response = await fetch(url, { ...options, method: "DELETE" });
  if (![200, 204, 404].includes(response.status)) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Cleanup failed for ${label}: HTTP ${response.status} ${error.message || response.statusText}`);
  }
}

export async function runCleanupTasks(suiteName, tasks) {
  const failures = [];
  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      failures.push(`${task.label}: ${error.message}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`[${suiteName}] Cleanup was incomplete:\n- ${failures.join("\n- ")}`);
  }
}
