import fs from 'fs';
const env = fs.readFileSync('.env.appwrite.setup', 'utf8');
const conf = {};
env.split('\n').forEach(l => {
  const parts = l.split('=');
  if (parts.length >= 2) conf[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const headers = {
  'X-Appwrite-Project': conf.APPWRITE_PROJECT_ID,
  'X-Appwrite-Key': conf.APPWRITE_API_KEY,
  'Content-Type': 'application/json'
};

async function testTransactionLifecycle() {
  console.log('Testing Appwrite Database Transaction Lifecycle...');
  
  // 1. Create temporary doc 1 and doc 2 in vehicles
  const createDoc = async (plate, isPrimary) => {
    const res = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        documentId: 'unique()',
        data: {
          driver_id: 'tx_test_driver',
          vehicle_type: 'sedan',
          make: 'Toyota',
          model: 'Vitz',
          registration_number: plate,
          service_category: 'passenger_transport',
          is_primary: isPrimary,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
    });
    return await res.json();
  };

  const v1 = await createDoc('TX1', true);
  const v2 = await createDoc('TX2', false);
  console.log('Created test vehicles:', v1.$id, '(primary: true),', v2.$id, '(primary: false)');

  // 2. Create Transaction
  const txRes = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transactions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  const tx = await txRes.json();
  console.log('Transaction started:', tx.$id, tx.status);

  // 3. Stage operations: unset v1, set v2
  const opRes = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transactions/${tx.$id}/operations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operations: [
        {
          action: 'update',
          databaseId: 'transmove',
          collectionId: 'vehicles',
          documentId: v1.$id,
          data: { is_primary: false }
        },
        {
          action: 'update',
          databaseId: 'transmove',
          collectionId: 'vehicles',
          documentId: v2.$id,
          data: { is_primary: true }
        }
      ]
    })
  });
  const opData = await opRes.json();
  console.log('Staged operations response:', opRes.status, opData);

  // 4. Commit Transaction
  const commitRes = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transactions/${tx.$id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ commit: true })
  });
  const commitData = await commitRes.json();
  console.log('Commit response:', commitRes.status, commitData);

  // 5. Verify live docs after commit
  const checkV1 = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents/${v1.$id}`, { headers }).then(r => r.json());
  const checkV2 = await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents/${v2.$id}`, { headers }).then(r => r.json());
  console.log('After commit:');
  console.log(' - v1 is_primary:', checkV1.is_primary, '(Expected: false)');
  console.log(' - v2 is_primary:', checkV2.is_primary, '(Expected: true)');

  // Cleanup
  await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents/${v1.$id}`, { method: 'DELETE', headers });
  await fetch(`${conf.APPWRITE_ENDPOINT}/databases/transmove/collections/vehicles/documents/${v2.$id}`, { method: 'DELETE', headers });
  console.log('Cleanup completed.');
}

testTransactionLifecycle().catch(console.error);
