// ==============================================================================
// TransMove Active Trip Flow — Schema Migration Script
// Adds missing columns to service_requests, bookings, and bids collections:
// - service_requests: pickup_latitude, pickup_longitude, destination_latitude, destination_longitude
// - bookings: passenger_live_lat, passenger_live_lng, live_location_active, live_location_updated_at,
//             payment_status, payment_confirmed_at, payment_confirmed_by
// - bids: counter_amount, counter_by, counter_message, negotiation_status, original_amount
// ==============================================================================
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import {
  Client,
  TablesDB,
} from 'node-appwrite';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const envPath = path.join(projectRoot, '.env.appwrite.setup');

const config = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const parts = line.split('=');
    if (parts.length >= 2) config[parts[0].trim()] = parts.slice(1).join('=').trim();
  });
}

const endpoint = (process.env.APPWRITE_ENDPOINT || config.APPWRITE_ENDPOINT || '').trim().replace(/\/$/, '');
const projectId = (process.env.APPWRITE_PROJECT_ID || config.APPWRITE_PROJECT_ID || '').trim();
const apiKey = (process.env.APPWRITE_API_KEY || config.APPWRITE_API_KEY || '').trim();

if (!endpoint || !projectId || !apiKey) {
  console.error('FAIL: Missing Appwrite configuration (APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY)');
  process.exit(1);
}

const DATABASE_ID = 'transmove';
const POLL_INTERVAL_MS = 600;
const POLL_TIMEOUT_MS = 60_000;

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tablesDB = new TablesDB(client);

const V = (key, size, required = false, xdefault) => ({ type: 'varchar', key, size, required, xdefault });
const T = (key, required = false, xdefault) => ({ type: 'text', key, required, xdefault });
const I = (key, required = false, xdefault) => ({ type: 'integer', key, required, xdefault });
const F = (key, required = false, xdefault) => ({ type: 'float', key, required, xdefault });
const B = (key, required = false, xdefault) => ({ type: 'boolean', key, required, xdefault });
const D = (key, required = false, xdefault) => ({ type: 'datetime', key, required, xdefault });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isNotFound = (error) => Number(error?.code ?? error?.response?.code) === 404;

async function getOrNull(getter) {
  try {
    return await getter();
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitUntilAvailable(getter, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const resource = await getter();
    if (resource.status === 'available') return resource;
    if (resource.status === 'failed' || resource.status === 'stuck') {
      throw new Error(`${label} entered ${resource.status} status`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`${label} was not ready within ${POLL_TIMEOUT_MS / 1000} seconds`);
}

async function createColumn(tableId, column) {
  const common = {
    databaseId: DATABASE_ID,
    tableId,
    key: column.key,
    required: column.required,
    ...(column.xdefault !== undefined ? { xdefault: column.xdefault } : {}),
  };
  switch (column.type) {
    case 'varchar': return tablesDB.createVarcharColumn({ ...common, size: column.size, array: false, encrypt: false });
    case 'text': return tablesDB.createTextColumn({ ...common, array: false, encrypt: false });
    case 'integer': return tablesDB.createIntegerColumn({ ...common, array: false });
    case 'float': return tablesDB.createFloatColumn({ ...common, array: false });
    case 'boolean': return tablesDB.createBooleanColumn({ ...common, array: false });
    case 'datetime': return tablesDB.createDatetimeColumn({ ...common, array: false });
    default: throw new Error(`Unsupported column type: ${column.type}`);
  }
}

async function ensureColumn(tableId, column) {
  let existing = await getOrNull(() => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId, key: column.key }));
  if (!existing) {
    await createColumn(tableId, column);
    existing = await waitUntilAvailable(
      () => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId, key: column.key }),
      `${tableId}.${column.key}`
    );
    console.log(`  + column ${tableId}.${column.key} created`);
  } else {
    if (existing.status !== 'available') {
      await waitUntilAvailable(
        () => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId, key: column.key }),
        `${tableId}.${column.key}`
      );
    }
    console.log(`  = column ${tableId}.${column.key} exists`);
  }
}

const SERVICE_REQUEST_EXTENSIONS = [
  F('pickup_latitude', false),
  F('pickup_longitude', false),
  F('destination_latitude', false),
  F('destination_longitude', false),
];

const BOOKINGS_EXTENSIONS = [
  F('passenger_live_lat', false),
  F('passenger_live_lng', false),
  B('live_location_active', false, false),
  D('live_location_updated_at', false),
  V('payment_status', 32, false, 'pending'),
  D('payment_confirmed_at', false),
  V('payment_confirmed_by', 64, false),
];

const BIDS_EXTENSIONS = [
  F('counter_amount', false),
  V('counter_by', 32, false),
  T('counter_message', false),
  V('negotiation_status', 32, false, 'none'),
  F('original_amount', false),
];

async function run() {
  console.log('================================================================');
  console.log('TransMove Active Trip Flow Schema Migration');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}`);
  console.log('================================================================\n');

  console.log('1. Extending service_requests collection...');
  for (const col of SERVICE_REQUEST_EXTENSIONS) {
    await ensureColumn('service_requests', col);
  }

  console.log('\n2. Extending bookings collection...');
  for (const col of BOOKINGS_EXTENSIONS) {
    await ensureColumn('bookings', col);
  }

  console.log('\n3. Extending bids collection...');
  for (const col of BIDS_EXTENSIONS) {
    await ensureColumn('bids', col);
  }

  console.log('\n✅ All trip flow schema extensions successfully applied and verified available.');
}

run().catch((err) => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
