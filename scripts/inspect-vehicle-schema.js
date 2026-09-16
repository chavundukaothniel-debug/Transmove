import fs from 'fs';

const env = fs.readFileSync('.env.appwrite.setup', 'utf8');
const conf = {};
env.split('\n').forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const headers = {
  'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID,
  'X-Appwrite-Key': conf.APPWRITE_API_KEY
};

async function inspect(tableName) {
  const url = `${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/${tableName}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(`\n=== Table: ${tableName} ===`);
  console.log(`documentSecurity:`, data.documentSecurity, `permissions:`, data.$permissions);
  console.log('Attributes:');
  (data.attributes || []).forEach(a => {
    console.log(` - ${a.key} (${a.type}, required: ${a.required}, default: ${a.default})`);
  });
  console.log('Indexes:');
  (data.indexes || []).forEach(i => {
    console.log(` - ${i.key} (${i.type}, attrs: ${i.attributes.join(', ')})`);
  });
}

async function inspectBucket() {
  const url = `${conf.APPWRITE_ENDPOINT}/storage/buckets/transmove-files`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(`\n=== Bucket: transmove-files ===`);
  console.log(`fileSecurity:`, data.fileSecurity, `permissions:`, data.$permissions);
  console.log(`allowedFileExtensions:`, data.allowedFileExtensions);
  console.log(`maxFileSize:`, data.maxFileSize);
}

async function run() {
  await inspect('vehicles');
  await inspect('vehicle_photos');
  await inspect('verification_documents');
  await inspectBucket();
}

run().catch(console.error);
