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
  const headers = {
    'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID.trim(),
    'X-Appwrite-Key': conf.APPWRITE_API_KEY.trim()
  };
  for (const tableId of ['payment_destinations', 'subscription_plans', 'ad_rate_cards', 'ad_packages', 'ad_campaigns', 'payments']) {
    const res = await fetch(`${endpoint}/databases/transmove/collections/${tableId}`, { headers });
    const c = await res.json();
    const rowsRes = await fetch(`${endpoint}/databases/transmove/collections/${tableId}/documents?limit=10`, { headers });
    const rowsData = await rowsRes.json();
    console.log(`\nTable ${tableId}: attributes = ${c.attributes?.length || 0}, rows = ${rowsData.total || 0}`);
    if (rowsData.documents && rowsData.documents.length > 0) {
      console.log(`  Sample row IDs: ${rowsData.documents.map(d => d.$id).join(', ')}`);
    }
  }
}
run();
