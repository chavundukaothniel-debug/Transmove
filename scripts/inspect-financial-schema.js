import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.appwrite.setup');
const conf = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});

async function run() {
  const endpoint = conf.APPWRITE_ENDPOINT.trim().replace(/\/$/, '');
  for (const collId of ['wallet_ledger', 'payments', 'subscriptions', 'bookings']) {
    const res = await fetch(`${endpoint}/databases/transmove/collections/${collId}`, {
      headers: {
        'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID.trim(),
        'X-Appwrite-Key': conf.APPWRITE_API_KEY.trim()
      }
    });
    const c = await res.json();
    console.log(`\n=== Collection: ${collId} ===`);
    console.log('Name:', c.name);
    console.log('Permissions:', c['$permissions'] || c.permissions);
    console.log('Document Security:', c.documentSecurity);
    console.log('Attributes:', c.attributes?.map(a => `${a.key} (${a.type}${a.required ? ', required' : ''}${a.default !== undefined ? ', def=' + a.default : ''})`).join(', '));
  }
}
run();
