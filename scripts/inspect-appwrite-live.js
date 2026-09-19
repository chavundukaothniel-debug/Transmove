const endpoint = 'https://fra.cloud.appwrite.io/v1';
const projectId = '6aaa6531003d5747b640';
const apiKey = 'standard_7979159e2a34164d43b60611737b5ec38ca439326a7c69becd2fcb06173ec4c7295dced0caceacf7a3b41c87f9ac1aca6e5aa531722f46c3eabc62258274dc1a7025081891805279551c4a29c8dbf04fa55043b8dc7b8cb3b3b76770fafe3794fb34f5043716c97cf39f80031abc36adbaf97dfa1b681857ccfe4329823ea1b7';

const headers = {
  'X-Appwrite-Project': projectId,
  'X-Appwrite-Key': apiKey,
  'Content-Type': 'application/json'
};

async function checkAppwrite() {
  try {
    // Check users
    const usersRes = await fetch(endpoint + '/users?limit=10', { headers });
    const users = await usersRes.json();
    console.log('Appwrite Users total:', users.total || 0);
    if (users.users) {
      console.log('Sample users:', users.users.slice(0, 5).map(u => ({ id: u.$id, email: u.email, name: u.name })));
    }

    // Check collections
    const collectionsRes = await fetch(endpoint + '/databases/transmove/collections?limit=50', { headers });
    const collections = await collectionsRes.json();
    console.log('\nAppwrite Collections count:', collections.total || collections.collections?.length || 0);
    if (collections.collections) {
      for (const col of collections.collections) {
        const docsRes = await fetch(endpoint + '/databases/transmove/collections/' + col.$id + '/documents?limit=1', { headers });
        const docs = await docsRes.json();
        console.log(` - ${col.name} (${col.$id}): ${docs.total ?? 0} documents`);
      }
    }

    // Check storage buckets
    const bucketsRes = await fetch(endpoint + '/storage/buckets?limit=10', { headers });
    const buckets = await bucketsRes.json();
    console.log('\nAppwrite Storage buckets:', (buckets.buckets || []).map(b => `${b.name} (${b.$id})`));
    if (buckets.buckets) {
      for (const b of buckets.buckets) {
        const filesRes = await fetch(endpoint + `/storage/buckets/${b.$id}/files?limit=5`, { headers });
        const files = await filesRes.json();
        console.log(`   Files in bucket ${b.name}: ${files.total || 0}`);
      }
    }
  } catch (err) {
    console.error('Appwrite check error:', err);
  }
}
checkAppwrite();
