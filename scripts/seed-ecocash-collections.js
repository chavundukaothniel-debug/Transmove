// ==============================================================================
// TransMove EcoCash Payment System — Seeding & Schema Migration Script
// Creates collections, attributes, indexes, and initial seed records for:
// - payment_destinations (EcoCash accounts)
// - subscription_plans (Flex Pass, Professional, Pro 90, Pro Annual)
// - ad_rate_cards (7 placement rate cards)
// - ad_packages (3 preset packages)
// - ad_campaigns (campaign lifecycle)
// - payments (extended attributes for EcoCash manual submission & verification)
// ==============================================================================
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import {
  Client,
  TablesDB,
  TablesDBIndexType,
  Query,
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
const K = (key, columns, unique = false) => ({
  key,
  columns,
  type: unique ? TablesDBIndexType.Unique : TablesDBIndexType.Key,
});

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

async function ensureTable(tableId, tableName) {
  const existing = await getOrNull(() => tablesDB.getTable({ databaseId: DATABASE_ID, tableId }));
  if (!existing) {
    await tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId,
      name: tableName,
      permissions: [],
      rowSecurity: true,
      enabled: true,
    });
    console.log(`PASS table ${tableId} created`);
  } else {
    console.log(`PASS table ${tableId} already exists`);
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

async function ensureIndex(tableId, index) {
  let existing = await getOrNull(() => tablesDB.getIndex({ databaseId: DATABASE_ID, tableId, key: index.key }));
  if (!existing) {
    await tablesDB.createIndex({
      databaseId: DATABASE_ID,
      tableId,
      key: index.key,
      type: index.type,
      columns: index.columns,
    });
    await waitUntilAvailable(
      () => tablesDB.getIndex({ databaseId: DATABASE_ID, tableId, key: index.key }),
      `${tableId}.${index.key}`
    );
    console.log(`  + index ${tableId}.${index.key} created`);
  } else {
    console.log(`  = index ${tableId}.${index.key} exists`);
  }
}

// -----------------------------------------------------------------------------
// Schema Definitions
// -----------------------------------------------------------------------------
const NEW_TABLES = [
  {
    id: 'payment_destinations',
    name: 'Payment Destinations',
    columns: [
      V('payment_method', 32, true),
      V('account_name', 128, true),
      V('account_number', 64, true),
      B('active', false, true),
      I('display_order', false, 0),
      D('created_at', true),
      D('updated_at', true),
    ],
    indexes: [
      K('idx_active', ['active']),
      K('idx_display_order', ['display_order']),
    ],
  },
  {
    id: 'subscription_plans',
    name: 'Subscription Plans',
    columns: [
      V('name', 128, true),
      V('slug', 64, true),
      T('description'),
      F('price', true),
      V('currency', 8, false, 'USD'),
      I('duration_days', true),
      B('active', false, true),
      I('display_order', false, 0),
      B('recommended', false, false),
      T('features'),
      D('created_at', true),
      D('updated_at', true),
    ],
    indexes: [
      K('uniq_slug', ['slug'], true),
      K('idx_active', ['active']),
      K('idx_display_order', ['display_order']),
    ],
  },
  {
    id: 'ad_rate_cards',
    name: 'Ad Rate Cards',
    columns: [
      V('placement', 64, true),
      V('placement_label', 128, true),
      F('base_rate', true),
      V('currency', 8, false, 'USD'),
      V('billing_unit', 32, false, 'daily'),
      I('minimum_days', false, 1),
      I('maximum_days', false, 365),
      F('targeting_multiplier', false, 1.0),
      F('featured_multiplier', false, 1.0),
      T('description'),
      B('active', false, true),
      I('display_order', false, 0),
      D('created_at', true),
      D('updated_at', true),
    ],
    indexes: [
      K('uniq_placement', ['placement'], true),
      K('idx_active', ['active']),
      K('idx_display_order', ['display_order']),
    ],
  },
  {
    id: 'ad_packages',
    name: 'Ad Packages',
    columns: [
      V('name', 128, true),
      V('slug', 64, true),
      V('placement', 64, true),
      I('duration_days', true),
      F('price', true),
      V('currency', 8, false, 'USD'),
      T('description'),
      V('discount_label', 64),
      B('active', false, true),
      I('display_order', false, 0),
      D('created_at', true),
      D('updated_at', true),
    ],
    indexes: [
      K('uniq_slug', ['slug'], true),
      K('idx_active', ['active']),
      K('idx_display_order', ['display_order']),
    ],
  },
  {
    id: 'ad_campaigns',
    name: 'Ad Campaigns',
    columns: [
      V('user_id', 64, true),
      V('business_name', 128, true),
      V('title', 128, true),
      T('description'),
      V('image_file_id', 64),
      V('destination_url', 512),
      V('placement', 64, true),
      V('targeting', 128),
      D('start_date'),
      I('duration_days', true),
      F('amount_expected', true),
      V('currency', 8, false, 'USD'),
      V('payment_id', 64),
      V('status', 32, false, 'draft'),
      T('admin_rejection_reason'),
      D('created_at', true),
      D('updated_at', true),
    ],
    indexes: [
      K('idx_user_id', ['user_id']),
      K('idx_status', ['status']),
      K('idx_placement', ['placement']),
      K('idx_payment_id', ['payment_id']),
    ],
  },
];

// Additional columns for the existing 'payments' table
const PAYMENTS_EXTENSIONS = [
  V('related_id', 64),
  V('payment_destination_id', 64),
  V('recipient_name', 128),
  V('recipient_number', 64),
  V('sender_name', 128),
  V('sender_phone', 64),
  V('transaction_reference', 128),
  V('proof_file_id', 64),
  F('amount_expected'),
  F('amount_declared'),
  D('reviewed_at'),
  V('reviewed_by', 64),
  T('rejection_reason'),
];

const PAYMENTS_INDEXES = [
  K('idx_transaction_ref', ['transaction_reference']),
  K('idx_related_id', ['related_id']),
  K('idx_payment_destination', ['payment_destination_id']),
];

// -----------------------------------------------------------------------------
// Seed Data
// -----------------------------------------------------------------------------
const SEED_DESTINATIONS = [
  {
    rowId: 'ecocash_othniel',
    data: {
      payment_method: 'ecocash',
      account_name: 'Othniel Nyasha Chavunduka',
      account_number: '0787692127',
      active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    rowId: 'ecocash_simba',
    data: {
      payment_method: 'ecocash',
      account_name: 'Simba Musasu',
      account_number: '0786447601',
      active: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

const SEED_PLANS = [
  {
    slug: 'flex-pass',
    data: {
      name: 'Flex Pass',
      slug: 'flex-pass',
      description: '7-day access for short-term and flexible providers',
      price: 5.0,
      currency: 'USD',
      duration_days: 7,
      active: true,
      display_order: 1,
      recommended: false,
      features: JSON.stringify([
        'Full bidding access for 7 days',
        'Direct passenger & shipper communication',
        'Standard marketplace listing',
        'EcoCash manual verification',
      ]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    slug: 'professional',
    data: {
      name: 'TransMove Professional',
      slug: 'professional',
      description: 'Standard 30-day access with full bidding & route tools',
      price: 15.0,
      currency: 'USD',
      duration_days: 30,
      active: true,
      display_order: 2,
      recommended: true,
      features: JSON.stringify([
        'Full bidding access for 30 days',
        'Direct passenger & shipper communication',
        'Priority vehicle listing in search',
        'Verified Driver badge on profile',
        'Automated receipt & invoice history',
      ]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    slug: 'pro-90',
    data: {
      name: 'Pro 90',
      slug: 'pro-90',
      description: 'Quarterly savings for consistent transport professionals',
      price: 40.0,
      currency: 'USD',
      duration_days: 90,
      active: true,
      display_order: 3,
      recommended: false,
      features: JSON.stringify([
        'Full bidding access for 90 days (save $5)',
        'Featured placement in provider search',
        'Direct customer phone & chat connections',
        'Quarterly performance badge',
        'Priority dispute resolution',
      ]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    slug: 'pro-annual',
    data: {
      name: 'Pro Annual',
      slug: 'pro-annual',
      description: 'Best annual value with priority support and marketplace badge',
      price: 140.0,
      currency: 'USD',
      duration_days: 365,
      active: true,
      display_order: 4,
      recommended: false,
      features: JSON.stringify([
        'Full bidding access for 365 days (save $40)',
        'Top-tier priority in search & matching',
        'Gold Verified Provider profile badge',
        'Dedicated account & support line',
        'Complimentary 7-day Search Sponsored ad',
      ]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

const SEED_RATE_CARDS = [
  {
    placement: 'homepage_banner',
    data: {
      placement: 'homepage_banner',
      placement_label: 'Homepage Top Banner',
      base_rate: 10.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 3,
      maximum_days: 90,
      targeting_multiplier: 1.25,
      featured_multiplier: 1.5,
      description: 'Prime placement at the very top of the TransMove home page. Maximum visibility for high-impact brand campaigns.',
      active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'homepage_featured',
    data: {
      placement: 'homepage_featured',
      placement_label: 'Homepage Featured Spotlight',
      base_rate: 8.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 3,
      maximum_days: 90,
      targeting_multiplier: 1.2,
      featured_multiplier: 1.4,
      description: 'Prominent showcase card on the homepage hero section with custom imagery and call to action.',
      active: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'marketplace_featured',
    data: {
      placement: 'marketplace_featured',
      placement_label: 'Marketplace Featured Card',
      base_rate: 6.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 2,
      maximum_days: 90,
      targeting_multiplier: 1.15,
      featured_multiplier: 1.3,
      description: 'Highlighted card directly inside the live marketplace feed. Targeted to shippers and riders comparing options.',
      active: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'provider_marketplace',
    data: {
      placement: 'provider_marketplace',
      placement_label: 'Provider Marketplace Spotlight',
      base_rate: 5.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 2,
      maximum_days: 90,
      targeting_multiplier: 1.15,
      featured_multiplier: 1.25,
      description: 'Targeted directly to transport operators, logistics fleets, and machinery owners in the provider directory.',
      active: true,
      display_order: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'machinery_freight',
    data: {
      placement: 'machinery_freight',
      placement_label: 'Machinery & Heavy Freight Header',
      base_rate: 7.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 3,
      maximum_days: 90,
      targeting_multiplier: 1.2,
      featured_multiplier: 1.35,
      description: 'Dominant header spot on the Machinery & Freight view. Ideal for heavy haulage, cranes, tippers, and earthmovers.',
      active: true,
      display_order: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'search_sponsored',
    data: {
      placement: 'search_sponsored',
      placement_label: 'Search & Route Sponsored Slot',
      base_rate: 5.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 1,
      maximum_days: 90,
      targeting_multiplier: 1.1,
      featured_multiplier: 1.2,
      description: 'Top placement in search and route estimation results whenever users search for routes matching your focus.',
      active: true,
      display_order: 6,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    placement: 'sidebar',
    data: {
      placement: 'sidebar',
      placement_label: 'App Sidebar & Navigation Banner',
      base_rate: 4.0,
      currency: 'USD',
      billing_unit: 'daily',
      minimum_days: 1,
      maximum_days: 90,
      targeting_multiplier: 1.0,
      featured_multiplier: 1.2,
      description: 'Persistent banner in the left-hand navigation sidebar visible across all application views on desktop.',
      active: true,
      display_order: 7,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

const SEED_PACKAGES = [
  {
    slug: 'starter',
    data: {
      name: 'Starter Ad Pack',
      slug: 'starter',
      placement: 'search_sponsored',
      duration_days: 7,
      price: 30.0,
      currency: 'USD',
      discount_label: 'Save 15%',
      description: '7 days of sponsored search & listing placement. Great for testing campaign response in your region.',
      active: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    slug: 'growth',
    data: {
      name: 'Growth Ad Pack',
      slug: 'growth',
      placement: 'marketplace_featured',
      duration_days: 14,
      price: 70.0,
      currency: 'USD',
      discount_label: 'Save 20%',
      description: '14 days featured placement across Marketplace & Search with custom branding banner.',
      active: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
  {
    slug: 'premium',
    data: {
      name: 'Premium Spotlight',
      slug: 'premium',
      placement: 'homepage_banner',
      duration_days: 30,
      price: 240.0,
      currency: 'USD',
      discount_label: 'Save 25%',
      description: '30 days high-impact homepage top banner + featured marketplace placement. Maximum TransMove exposure.',
      active: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  },
];

// -----------------------------------------------------------------------------
// Main Execution
// -----------------------------------------------------------------------------
async function run() {
  console.log('================================================================');
  console.log('TransMove EcoCash Collections & Seed Setup');
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Project:  ${projectId}`);
  console.log('================================================================\n');

  // Step 1: Create New Tables
  for (const table of NEW_TABLES) {
    console.log(`\nConfiguring table: ${table.id} (${table.name})...`);
    await ensureTable(table.id, table.name);
    for (const col of table.columns) {
      await ensureColumn(table.id, col);
    }
    for (const idx of table.indexes) {
      await ensureIndex(table.id, idx);
    }
  }

  // Step 2: Extend Existing 'payments' Table
  console.log('\nExtending "payments" table...');
  for (const col of PAYMENTS_EXTENSIONS) {
    await ensureColumn('payments', col);
  }
  for (const idx of PAYMENTS_INDEXES) {
    await ensureIndex('payments', idx);
  }

  // Step 3: Seed Payment Destinations
  console.log('\nSeeding Payment Destinations (EcoCash accounts)...');
  for (const item of SEED_DESTINATIONS) {
    try {
      const existing = await getOrNull(() => tablesDB.getRow({ databaseId: DATABASE_ID, tableId: 'payment_destinations', rowId: item.rowId }));
      if (!existing) {
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: 'payment_destinations',
          rowId: item.rowId,
          data: item.data,
          permissions: [],
        });
        console.log(`  + Seeded destination: ${item.rowId} (${item.data.account_name} - ${item.data.account_number})`);
      } else {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'payment_destinations',
          rowId: item.rowId,
          data: item.data,
        });
        console.log(`  = Updated destination: ${item.rowId} (${item.data.account_name})`);
      }
    } catch (err) {
      console.error(`  ! Destination seed error (${item.rowId}): ${err.message}`);
    }
  }

  // Step 4: Seed Subscription Plans
  console.log('\nSeeding Subscription Plans...');
  for (const item of SEED_PLANS) {
    try {
      const list = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: 'subscription_plans',
        queries: [Query.equal('slug', item.slug)],
      });
      if (list.total === 0) {
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: 'subscription_plans',
          rowId: item.slug.replace(/[^a-zA-Z0-9_-]/g, '_'),
          data: item.data,
          permissions: [],
        });
        console.log(`  + Seeded plan: ${item.data.name} ($${item.data.price}/${item.data.duration_days}d)`);
      } else {
        const rowId = list.rows[0].$id;
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'subscription_plans',
          rowId,
          data: item.data,
        });
        console.log(`  = Updated plan: ${item.data.name}`);
      }
    } catch (err) {
      console.error(`  ! Plan seed error (${item.slug}): ${err.message}`);
    }
  }

  // Step 5: Seed Ad Rate Cards
  console.log('\nSeeding Ad Rate Cards...');
  for (const item of SEED_RATE_CARDS) {
    try {
      const list = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: 'ad_rate_cards',
        queries: [Query.equal('placement', item.placement)],
      });
      if (list.total === 0) {
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: 'ad_rate_cards',
          rowId: item.placement.replace(/[^a-zA-Z0-9_-]/g, '_'),
          data: item.data,
          permissions: [],
        });
        console.log(`  + Seeded rate card: ${item.data.placement_label} ($${item.data.base_rate}/day)`);
      } else {
        const rowId = list.rows[0].$id;
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'ad_rate_cards',
          rowId,
          data: item.data,
        });
        console.log(`  = Updated rate card: ${item.data.placement_label}`);
      }
    } catch (err) {
      console.error(`  ! Rate card seed error (${item.placement}): ${err.message}`);
    }
  }

  // Step 6: Seed Ad Packages
  console.log('\nSeeding Ad Packages...');
  for (const item of SEED_PACKAGES) {
    try {
      const list = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: 'ad_packages',
        queries: [Query.equal('slug', item.slug)],
      });
      if (list.total === 0) {
        await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: 'ad_packages',
          rowId: item.slug.replace(/[^a-zA-Z0-9_-]/g, '_'),
          data: item.data,
          permissions: [],
        });
        console.log(`  + Seeded ad package: ${item.data.name} ($${item.data.price}/${item.data.duration_days}d)`);
      } else {
        const rowId = list.rows[0].$id;
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: 'ad_packages',
          rowId,
          data: item.data,
        });
        console.log(`  = Updated ad package: ${item.data.name}`);
      }
    } catch (err) {
      console.error(`  ! Ad package seed error (${item.slug}): ${err.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('EcoCash Collections & Seed Data successfully provisioned!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal seed failure:', err);
  process.exit(1);
});
