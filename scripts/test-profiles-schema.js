import fs from 'fs';

const env = fs.readFileSync('.env.appwrite.setup', 'utf8');
const conf = {};
env.split('\n').forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const url = `${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/profiles`;
const res = await fetch(url, {
  headers: {
    'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': conf.APPWRITE_API_KEY
  }
});

const data = await res.json();
console.log('Collection profiles:', data.$id, 'documentSecurity:', data.documentSecurity, 'permissions:', data.$permissions);
console.log('Attributes:');
(data.attributes || []).forEach(a => {
  console.log(` - ${a.key} (${a.type}, required: ${a.required}, default: ${a.default})`);
});
console.log('Indexes:');
(data.indexes || []).forEach(i => {
  console.log(` - ${i.key} (${i.type}, attributes: ${i.attributes.join(', ')})`);
});
