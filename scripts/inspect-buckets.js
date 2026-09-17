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
  const res = await fetch(`${endpoint}/storage/buckets`, {
    headers: {
      'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID.trim(),
      'X-Appwrite-Key': conf.APPWRITE_API_KEY.trim()
    }
  });
  const data = await res.json();
  console.log('Buckets:', data.buckets?.map(b => ({ id: b.$id, name: b.name, permissions: b.permissions, fileSecurity: b.fileSecurity })));
}
run();
