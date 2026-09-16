import fs from 'fs';
const env = fs.readFileSync('.env.appwrite.setup', 'utf8');
const conf = {};
env.split('\n').forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});
const headers = { 'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID, 'X-Appwrite-Key': conf.APPWRITE_API_KEY };
const [v, vp, vd, f] = await Promise.all([
  fetch(conf.APPWRITE_ENDPOINT + '/databases/transmove/collections/vehicles/documents', { headers }).then(r => r.json()),
  fetch(conf.APPWRITE_ENDPOINT + '/databases/transmove/collections/vehicle_photos/documents', { headers }).then(r => r.json()),
  fetch(conf.APPWRITE_ENDPOINT + '/databases/transmove/collections/verification_documents/documents', { headers }).then(r => r.json()),
  fetch(conf.APPWRITE_ENDPOINT + '/storage/buckets/transmove-files/files', { headers }).then(r => r.json())
]);
console.log('Live Database Counts:');
console.log(' - vehicles:', v.total);
console.log(' - vehicle_photos:', vp.total);
console.log(' - verification_documents:', vd.total);
console.log(' - transmove-files storage files:', f.total);
