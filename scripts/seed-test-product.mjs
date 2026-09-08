// =====================================================================
// DARKWAVE MARKET — PHASE 3: TEST PRODUCT SEED
// =====================================================================
//
// PURPOSE
//   Inserts ONE clearly labeled test product for Phase 3 verification.
//
// BEFORE YOU RUN
//   1) Run scripts/seed-darkwave-store.mjs first.
//   2) Copy the exact Firestore DOCUMENT ID of the founder store.
//   3) Paste it into DARKWAVE_STORE_DOCUMENT_ID below.
//   4) Ensure service-account.json exists in the project root.
//
// HOW TO RUN
//   cd "F:\Daa_Bluprint\Dark wave"
//   node scripts/seed-test-product.mjs
//
// SAFETY
//   - Creates only one test product.
//   - Does not modify the store.
//   - Does not delete anything.
// =====================================================================

import {
  initializeApp,
  cert,
  getApps
} from 'firebase-admin/app';

import {
  getFirestore,
  FieldValue
} from 'firebase-admin/firestore';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// =====================================================================
// DARKWAVE FOUNDER STORE DOCUMENT ID
// =====================================================================

// IMPORTANT:
// This must be the exact Firestore document ID printed by
// seed-darkwave-store.mjs.
//
// Example:
// const DARKWAVE_STORE_DOCUMENT_ID = 'Abc123XYZ';

const DARKWAVE_STORE_DOCUMENT_ID = 'YjWu4xBzv7Vu0DoOrYEm';

// =====================================================================
// SERVICE ACCOUNT
// =====================================================================

const SERVICE_ACCOUNT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'service-account.json'
);

// =====================================================================
// TEST PRODUCT DATA
// =====================================================================

const PRODUCT_NAME = 'DWM TEST PRODUCT';
const CATEGORY = 'Sneakers';
const PRICE_ZAR = 1299;
const CURRENCY = 'ZAR';
const IMAGE_URL = '/assets/img/dwm-logo-new.png';
const STATUS = 'live';
const DROP_NUMBER = 1;

// =====================================================================
// VALIDATE STORE ID
// =====================================================================

if (
  !DARKWAVE_STORE_DOCUMENT_ID ||
  DARKWAVE_STORE_DOCUMENT_ID === 'PASTE_EXACT_STORE_DOCUMENT_ID_HERE'
) {
  console.error('');
  console.error('❌ DARKWAVE_STORE_DOCUMENT_ID is not set.');
  console.error('');
  console.error(
    'Run scripts/seed-darkwave-store.mjs and copy the exact founder-store document ID.'
  );
  console.error('');
  process.exit(1);
}

// =====================================================================
// LOAD SERVICE ACCOUNT
// =====================================================================

let serviceAccount;

try {
  const raw = readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
  serviceAccount = JSON.parse(raw);
} catch (err) {
  console.error('');
  console.error('❌ Could not load service-account.json.');
  console.error('');
  console.error('Expected location:');
  console.error(`   ${SERVICE_ACCOUNT_PATH}`);
  console.error('');
  console.error('Inner error:', err.message);
  console.error('');
  process.exit(2);
}

// =====================================================================
// INITIALIZE FIREBASE ADMIN
// =====================================================================

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}

const db = getFirestore();

// =====================================================================
// MAIN
// =====================================================================

async function main() {
  console.log('');
  console.log('🌊 DARKWAVE MARKET — Test Product Seed');
  console.log('---------------------------------------');
  console.log('');
  console.log(
    '🔎 Validating founder store:',
    DARKWAVE_STORE_DOCUMENT_ID
  );

  const storeRef = db
    .collection('stores')
    .doc(DARKWAVE_STORE_DOCUMENT_ID);

  const storeSnap = await storeRef.get();

  if (!storeSnap.exists) {
    console.error('');
    console.error('❌ Store document not found.');
    console.error('');
    console.error(
      'Double-check DARKWAVE_STORE_DOCUMENT_ID against Firestore.'
    );
    console.error('');
    process.exit(3);
  }

  const storeSlug = storeSnap.get('slug');
  const storeName = storeSnap.get('name');
  const storeStatus = storeSnap.get('status');

  console.log('');
  console.log('✅ Founder store found.');
  console.log('   Name:   ', storeName);
  console.log('   Slug:   ', storeSlug);
  console.log('   Status: ', storeStatus);

  if (storeSlug !== 'darkwave') {
    console.error('');
    console.error(
      '❌ Safety stop: selected store does not have slug "darkwave".'
    );
    console.error('');
    process.exit(4);
  }

  // ===================================================================
  // DUPLICATE TEST PRODUCT CHECK
  // ===================================================================

  console.log('');
  console.log('🔎 Checking whether test product already exists...');

  const existingProductQuery = await db
    .collection('products')
    .where('storeId', '==', DARKWAVE_STORE_DOCUMENT_ID)
    .where('name', '==', PRODUCT_NAME)
    .limit(1)
    .get();

  if (!existingProductQuery.empty) {
    const existing = existingProductQuery.docs[0];

    console.log('');
    console.log('✅ Test product already exists.');
    console.log('   No duplicate was created.');
    console.log('');
    console.log('   Product ID:', existing.id);
    console.log('   Name:      ', existing.get('name'));
    console.log('   Price:     ', existing.get('price'));
    console.log('   Status:    ', existing.get('status'));
    console.log('');

    return;
  }

  // ===================================================================
  // CREATE TEST PRODUCT
  // ===================================================================

  const payload = {
    storeId: DARKWAVE_STORE_DOCUMENT_ID,

    name: PRODUCT_NAME,

    category: CATEGORY,

    price: PRICE_ZAR,

    currency: CURRENCY,

    imageUrl: IMAGE_URL,

    status: STATUS,

    dropNumber: DROP_NUMBER,

    createdAt: FieldValue.serverTimestamp(),

    updatedAt: FieldValue.serverTimestamp()
  };

  console.log('');
  console.log('⚠️ Creating ONE clearly labeled test product:');
  console.log('');
  console.log('   Store ID:   ', payload.storeId);
  console.log('   Name:       ', payload.name);
  console.log('   Category:   ', payload.category);
  console.log('   Price:      ', `R${payload.price}`);
  console.log('   Currency:   ', payload.currency);
  console.log('   Status:     ', payload.status);
  console.log('   Drop #:     ', payload.dropNumber);
  console.log('   Image:      ', payload.imageUrl);
  console.log('');

  const ref = await db
    .collection('products')
    .add(payload);

  console.log('🔥 Test product created successfully.');
  console.log('');
  console.log('   Document ID:', ref.id);
  console.log('');

  console.log('Verification pages:');
  console.log('');
  console.log('   /store.html');
  console.log('   /store.html?store=darkwave');
  console.log('   /drops.html');
  console.log('   /drops.html?category=sneakers');
  console.log('');
  console.log(
    `After verification, remove /products/${ref.id} if you no longer need the test product.`
  );
  console.log('');
}

// =====================================================================
// RUN
// =====================================================================

main()
  .then(() => {
    console.log('✅ Test-product seed finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('');
    console.error('💥 Fatal test-product seed error:');
    console.error(err);
    console.error('');
    process.exit(99);
  });