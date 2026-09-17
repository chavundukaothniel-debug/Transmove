const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k)
  },
  location: { origin: 'http://localhost:3000' },
  console: console
};

import fs from 'fs';
import { assertTestCleanupCapabilities } from './test-hygiene.js';
const env = fs.readFileSync('.env.appwrite.setup', 'utf8');
const conf = {};
env.split('\n').forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});

import { Client, Account, ID } from '../assets/js/vendor/appwrite.js';

async function testVerifAndRecovery() {
  await assertTestCleanupCapabilities("verification-recovery");
  const client = new Client().setEndpoint(conf.APPWRITE_ENDPOINT).setProject(conf.APPWRITE_PROJECT_ID);
  const account = new Account(client);
  let u = null;
  try {
  const testEmail = `__test__.verification-recovery.${Date.now()}@transmove.test`;
  const testPassword = 'Password123!';
  u = await account.create(ID.unique(), testEmail, testPassword, 'Verification Test User');
  console.log('Account created:', u.$id);

  await account.createEmailPasswordSession(testEmail, testPassword);
  console.log('Session created');

  // Test createVerification
  try {
    const verif = await account.createVerification('http://localhost:3000/#verify-email');
    console.log('PASS: Verification email request created. ID:', verif.$id, 'status:', verif.status);
  } catch (e) {
    console.log('Verification request response:', e.message, 'Code:', e.code);
  }

  // Test createRecovery
  try {
    const recovery = await account.createRecovery(testEmail, 'http://localhost:3000/#reset-password');
    console.log('PASS: Password recovery request created. ID:', recovery.$id, 'status:', recovery.status);
  } catch (e) {
    console.log('Recovery request response:', e.message, 'Code:', e.code);
  }

  } finally {
    if (u?.$id) {
      const userCleanupUrl = `${conf.APPWRITE_ENDPOINT}/users/${u.$id}`;
      const response = await fetch(userCleanupUrl, {
        method: 'DELETE',
        headers: {
          'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID,
          'X-Appwrite-Key': conf.APPWRITE_API_KEY
        }
      });
      if (![200, 204, 404].includes(response.status)) throw new Error(`Verification/recovery cleanup failed: HTTP ${response.status}`);
      console.log('Cleanup completed.');
    }
  }
}

testVerifAndRecovery().catch((error) => {
  console.error(`FATAL: ${error.message}`);
  process.exitCode = 1;
});
