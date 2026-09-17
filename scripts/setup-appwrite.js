import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  Client,
  Compression,
  Query,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from 'node-appwrite';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
dotenv.config({ path: path.join(projectRoot, '.env.appwrite.setup'), quiet: true });

const requiredEnvironment = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY'];
const missingEnvironment = requiredEnvironment.filter((key) => !process.env[key]?.trim());

if (missingEnvironment.length > 0) {
  console.error(`FAIL Configuration: missing ${missingEnvironment.join(', ')}`);
  process.exit(1);
}

const DATABASE_ID = 'transmove';
const DATABASE_NAME = 'TransMove';
const POLL_INTERVAL_MS = 750;
const POLL_TIMEOUT_MS = 90_000;

const V = (key, size, required = false, xdefault) => ({ type: 'varchar', key, size, required, xdefault });
const T = (key, required = false, xdefault) => ({ type: 'text', key, required, xdefault });
const I = (key, required = false, xdefault) => ({ type: 'integer', key, required, xdefault });
const F = (key, required = false, xdefault) => ({ type: 'float', key, required, xdefault });
const B = (key, required = false, xdefault) => ({ type: 'boolean', key, required, xdefault });
const D = (key, required = false, xdefault) => ({ type: 'datetime', key, required, xdefault });
const K = (key, columns, unique = false) => ({
  key,
  columns,
  type: unique ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
});

const tables = [
  {
    id: 'profiles', name: 'Profiles',
    columns: [
      V('user_id', 64, true), V('full_name', 128, true), V('email', 320, true), V('phone', 32),
      V('role', 32, true), V('profile_image_id', 64), V('city', 128), T('bio'),
      V('verification_status', 32, false, 'unverified'), T('verification_rejection_reason'), V('account_status', 32, false, 'active'),
      D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('uniq_user_id', ['user_id'], true), K('idx_role', ['role']), K('idx_account_status', ['account_status'])],
  },
  {
    id: 'vehicles', name: 'Vehicles',
    columns: [
      V('driver_id', 64, true), V('vehicle_type', 64, true), V('make', 128, true), V('model', 128, true),
      I('year'), V('colour', 64), V('registration_number', 64, true), I('passenger_capacity'), F('load_capacity'),
      V('service_category', 64, true), T('description'), V('status', 32, false, 'active'),
      V('verification_status', 32, false, 'unverified'), T('rejection_reason'), B('is_primary', false, false), D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('idx_driver_id', ['driver_id']), K('idx_registration_number', ['registration_number']), K('idx_service_category', ['service_category']), K('idx_status', ['status'])],
  },
  {
    id: 'vehicle_photos', name: 'Vehicle Photos',
    columns: [V('vehicle_id', 64, true), V('driver_id', 64, true), V('file_id', 64, true), B('is_primary', false, false), D('created_at', true)],
    indexes: [K('idx_vehicle_id', ['vehicle_id']), K('idx_driver_id', ['driver_id'])],
  },
  {
    id: 'service_requests', name: 'Service Requests',
    columns: [
      V('passenger_id', 64, true), V('service_type', 64, true), V('pickup_location', 512, true), V('destination', 512, true),
      D('request_date'), V('preferred_time', 64), I('passenger_count'), V('goods_type', 128), T('details'), F('budget'),
      V('status', 32, false, 'open_for_bids'), D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('idx_passenger_id', ['passenger_id']), K('idx_service_type', ['service_type']), K('idx_status', ['status']), K('idx_created_at', ['created_at'])],
  },
  {
    id: 'bids', name: 'Bids',
    columns: [
      V('request_id', 64, true), V('driver_id', 64, true), V('vehicle_id', 64, true), F('amount', true), T('message'),
      V('status', 32, false, 'pending'), D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('idx_request_id', ['request_id']), K('idx_driver_id', ['driver_id']), K('idx_status', ['status']), K('uniq_request_driver', ['request_id', 'driver_id'], true)],
  },
  {
    id: 'bookings', name: 'Bookings',
    columns: [
      V('request_id', 64, true), V('passenger_id', 64, true), V('driver_id', 64, true), V('vehicle_id', 64, true),
      V('accepted_bid_id', 64), F('amount', true), V('status', 32, false, 'confirmed'), D('started_at'), D('completed_at'),
      D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('idx_request_id', ['request_id']), K('idx_passenger_id', ['passenger_id']), K('idx_driver_id', ['driver_id']), K('idx_status', ['status'])],
  },
  {
    id: 'favourites', name: 'Favourites',
    columns: [V('passenger_id', 64, true), V('driver_id', 64, true), D('created_at', true)],
    indexes: [K('idx_passenger_id', ['passenger_id']), K('idx_driver_id', ['driver_id']), K('uniq_passenger_driver', ['passenger_id', 'driver_id'], true)],
  },
  {
    id: 'messages', name: 'Messages',
    columns: [
      V('conversation_id', 64, true), V('sender_id', 64, true), V('receiver_id', 64, true), V('booking_id', 64),
      T('message', true), B('read', false, false), D('created_at', true),
    ],
    indexes: [K('idx_conversation_id', ['conversation_id']), K('idx_sender_id', ['sender_id']), K('idx_receiver_id', ['receiver_id']), K('idx_created_at', ['created_at'])],
  },
  {
    id: 'notifications', name: 'Notifications',
    columns: [V('user_id', 64, true), V('type', 64, true), V('title', 256, true), T('message', true), V('related_id', 64), B('read', false, false), D('created_at', true)],
    indexes: [K('idx_user_id', ['user_id']), K('idx_read', ['read']), K('idx_created_at', ['created_at'])],
  },
  {
    id: 'payments', name: 'Payments',
    columns: [
      V('user_id', 64, true), V('booking_id', 64), V('subscription_id', 64), V('reference', 128, true), V('provider', 64, true),
      V('provider_reference', 128), F('amount', true), V('currency', 8, false, 'USD'), V('status', 32, false, 'pending'),
      V('payment_type', 64, true), T('poll_url'), D('created_at', true), D('paid_at'), D('updated_at', true),
    ],
    indexes: [K('idx_user_id', ['user_id']), K('uniq_reference', ['reference'], true), K('idx_status', ['status']), K('idx_payment_type', ['payment_type'])],
  },
  {
    id: 'subscriptions', name: 'Subscriptions',
    columns: [
      V('user_id', 64, true), V('plan', 128, false, 'TransMove Professional'), F('amount', false, 15),
      V('currency', 8, false, 'USD'), V('status', 32, false, 'inactive'), D('started_at'), D('expires_at'),
      D('created_at', true), D('updated_at', true),
    ],
    indexes: [K('idx_user_id', ['user_id']), K('idx_status', ['status']), K('idx_expires_at', ['expires_at'])],
  },
  {
    id: 'driver_presence', name: 'Driver Presence',
    columns: [V('driver_id', 64, true), D('last_seen_at', true), D('created_at', true), D('updated_at', true)],
    indexes: [K('uniq_driver_id', ['driver_id'], true), K('idx_last_seen_at', ['last_seen_at'])],
  },
  {
    id: 'activity_logs', name: 'Activity Logs',
    columns: [V('user_id', 64, true), V('activity_type', 64, true), V('title', 256, true), T('description'), V('related_id', 64), D('created_at', true)],
    indexes: [K('idx_user_id', ['user_id']), K('idx_activity_type', ['activity_type']), K('idx_created_at', ['created_at'])],
  },
];

const buckets = [
  { id: 'profile-images', name: 'Profile Images', maximumFileSize: 5 * 1024 * 1024, extensions: ['jpg', 'jpeg', 'png', 'webp'], transformations: true },
  { id: 'vehicle-images', name: 'Vehicle Images', maximumFileSize: 10 * 1024 * 1024, extensions: ['jpg', 'jpeg', 'png', 'webp'], transformations: true },
  { id: 'verification-documents', name: 'Verification Documents', maximumFileSize: 10 * 1024 * 1024, extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'], transformations: false },
  { id: 'request-images', name: 'Request Images', maximumFileSize: 10 * 1024 * 1024, extensions: ['jpg', 'jpeg', 'png', 'webp'], transformations: true },
];

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT.trim().replace(/\/$/, ''))
  .setProject(process.env.APPWRITE_PROJECT_ID.trim())
  .setKey(process.env.APPWRITE_API_KEY.trim());
const tablesDB = new TablesDB(client);
const storage = new Storage(client);

const results = [];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const isNotFound = (error) => Number(error?.code ?? error?.response?.code) === 404;
const safeMessage = (error) => {
  const message = String(error?.message || error || 'Unknown error');
  const secret = process.env.APPWRITE_API_KEY;
  return secret ? message.split(secret).join('[REDACTED]') : message;
};

function report(status, kind, id, detail = '') {
  const item = { status, kind, id, detail };
  results.push(item);
  console.log(`${status} ${kind}: ${id}${detail ? ` (${detail})` : ''}`);
}

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

async function ensureDatabase() {
  const existing = await getOrNull(() => tablesDB.get({ databaseId: DATABASE_ID }));
  if (!existing) {
    await tablesDB.create({ databaseId: DATABASE_ID, name: DATABASE_NAME, enabled: true });
    report('PASS', 'database', DATABASE_ID, 'created');
    return;
  }
  await tablesDB.update({ databaseId: DATABASE_ID, name: DATABASE_NAME, enabled: true });
  report('PASS', 'database', DATABASE_ID, 'verified');
}

async function ensureTable(table) {
  const existing = await getOrNull(() => tablesDB.getTable({ databaseId: DATABASE_ID, tableId: table.id }));
  if (!existing) {
    await tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId: table.id,
      name: table.name,
      permissions: [],
      rowSecurity: true,
      enabled: true,
    });
    report('PASS', 'table', table.id, 'created; restrictive permissions');
  } else {
    await tablesDB.updateTable({
      databaseId: DATABASE_ID,
      tableId: table.id,
      name: table.name,
      permissions: [],
      rowSecurity: true,
      enabled: true,
    });
    report('PASS', 'table', table.id, 'verified; restrictive permissions');
  }
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

function normalizedColumnType(type) {
  if (type === 'double') return 'float';
  if (type === 'string' || type === 'varchar' || type === 'text') return 'string';
  return type;
}

function verifyColumnDefinition(actual, expected) {
  const mismatches = [];
  const expectedType = normalizedColumnType(expected.type);
  if (normalizedColumnType(actual.type) !== expectedType) mismatches.push(`type=${actual.type}`);
  if (Boolean(actual.required) !== expected.required) mismatches.push(`required=${actual.required}`);
  if (expected.xdefault !== undefined && actual.default !== expected.xdefault) mismatches.push(`default=${JSON.stringify(actual.default)}`);
  return mismatches;
}

async function repairColumnDefinition(table, actual, expected) {
  const rowList = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: table.id,
    queries: [Query.limit(1)],
    total: true,
  });
  if (rowList.total !== 0) {
    throw new Error('definition mismatch cannot be repaired automatically because the table contains rows');
  }

  const common = {
    databaseId: DATABASE_ID,
    tableId: table.id,
    key: expected.key,
    required: expected.required,
    xdefault: expected.xdefault ?? null,
  };
  switch (actual.type) {
    case 'string': await tablesDB.updateStringColumn({ ...common, size: expected.size }); break;
    case 'varchar': await tablesDB.updateVarcharColumn({ ...common, size: expected.size }); break;
    case 'text': await tablesDB.updateTextColumn(common); break;
    case 'integer': await tablesDB.updateIntegerColumn(common); break;
    case 'double':
    case 'float': await tablesDB.updateFloatColumn(common); break;
    case 'boolean': await tablesDB.updateBooleanColumn(common); break;
    case 'datetime': await tablesDB.updateDatetimeColumn(common); break;
    default: throw new Error(`unsupported existing column type for repair: ${actual.type}`);
  }
  return waitUntilAvailable(
    () => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId: table.id, key: expected.key }),
    `${table.id}.${expected.key}`,
  );
}

async function ensureColumn(table, column) {
  let existing = await getOrNull(() => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId: table.id, key: column.key }));
  if (!existing) {
    await createColumn(table.id, column);
    existing = await waitUntilAvailable(
      () => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId: table.id, key: column.key }),
      `${table.id}.${column.key}`,
    );
    report('PASS', 'column', `${table.id}.${column.key}`, 'created');
  } else {
    if (existing.status !== 'available') {
      existing = await waitUntilAvailable(
        () => tablesDB.getColumn({ databaseId: DATABASE_ID, tableId: table.id, key: column.key }),
        `${table.id}.${column.key}`,
      );
    }
    let mismatches = verifyColumnDefinition(existing, column);
    if (mismatches.length > 0) {
      existing = await repairColumnDefinition(table, existing, column);
      mismatches = verifyColumnDefinition(existing, column);
      if (mismatches.length > 0) throw new Error(`definition mismatch after safe repair: ${mismatches.join(', ')}`);
      report('PASS', 'column', `${table.id}.${column.key}`, 'repaired and verified');
    } else {
      report('PASS', 'column', `${table.id}.${column.key}`, 'verified');
    }
  }
}

async function ensureIndex(table, index) {
  let existing = await getOrNull(() => tablesDB.getIndex({ databaseId: DATABASE_ID, tableId: table.id, key: index.key }));
  if (!existing) {
    await tablesDB.createIndex({
      databaseId: DATABASE_ID,
      tableId: table.id,
      key: index.key,
      type: index.type,
      columns: index.columns,
    });
    existing = await waitUntilAvailable(
      () => tablesDB.getIndex({ databaseId: DATABASE_ID, tableId: table.id, key: index.key }),
      `${table.id}.${index.key}`,
    );
    report('PASS', 'index', `${table.id}.${index.key}`, 'created');
  } else {
    if (existing.status !== 'available') {
      existing = await waitUntilAvailable(
        () => tablesDB.getIndex({ databaseId: DATABASE_ID, tableId: table.id, key: index.key }),
        `${table.id}.${index.key}`,
      );
    }
    const actualColumns = existing.attributes || existing.columns || [];
    if (existing.type !== index.type || JSON.stringify(actualColumns) !== JSON.stringify(index.columns)) {
      throw new Error(`definition mismatch: expected ${index.type}(${index.columns.join(',')})`);
    }
    report('PASS', 'index', `${table.id}.${index.key}`, 'verified');
  }
}

async function ensureBucket(bucket) {
  const settings = {
    bucketId: bucket.id,
    name: bucket.name,
    permissions: [],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: bucket.maximumFileSize,
    allowedFileExtensions: bucket.extensions,
    compression: Compression.None,
    encryption: true,
    antivirus: true,
    transformations: bucket.transformations,
  };
  const existing = await getOrNull(() => storage.getBucket({ bucketId: bucket.id }));
  if (!existing) {
    await storage.createBucket(settings);
    report('PASS', 'bucket', bucket.id, 'created; private');
  } else {
    await storage.updateBucket(settings);
    report('PASS', 'bucket', bucket.id, 'verified; private');
  }
}

async function run() {
  console.log('Starting TransMove Appwrite setup (credentials are loaded but never printed).');
  await ensureDatabase();

  for (const table of tables) {
    try {
      await ensureTable(table);
      for (const column of table.columns) await ensureColumn(table, column);
      for (const index of table.indexes) await ensureIndex(table, index);
    } catch (error) {
      report('FAIL', 'table setup', table.id, safeMessage(error));
    }
  }

  for (const bucket of buckets) {
    try {
      await ensureBucket(bucket);
    } catch (error) {
      report('FAIL', 'bucket', bucket.id, safeMessage(error));
    }
  }

  const failures = results.filter((item) => item.status === 'FAIL');
  const expectedColumns = tables.reduce((total, table) => total + table.columns.length, 0);
  const expectedIndexes = tables.reduce((total, table) => total + table.indexes.length, 0);
  console.log('\nSetup summary');
  console.log(`Database: ${DATABASE_ID}`);
  console.log(`Tables expected: ${tables.length}`);
  console.log(`Columns expected: ${expectedColumns}`);
  console.log(`Indexes expected: ${expectedIndexes}`);
  console.log(`Buckets expected: ${buckets.length}`);
  console.log(`Failures: ${failures.length}`);

  if (failures.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(`FAIL setup: ${safeMessage(error)}`);
  process.exitCode = 1;
});
