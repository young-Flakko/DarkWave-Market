// =====================================================================
// DARKWAVE MARKET — PHASE 3: FOUNDER STORE SEED (ONE-OFF ADMIN SCRIPT)
// =====================================================================
//
// PURPOSE
//   Creates the OFFICIAL Darkwave Market founder store (slug: darkwave)
//   with isFounderStore=true.
//
//   Idempotent:
//   If a store with slug === "darkwave" already exists,
//   this script will NOT create a duplicate.
//
// BEFORE YOU RUN THIS
//   1) Set MY_ADMIN_UID below to the Firebase Auth UID of
//      the official DWM admin account.
//
//   2) Place your Firebase service account file at:
//
//      F:\Daa_Bluprint\Dark wave\service-account.json
//
//   3) Make sure service-account.json is included in .gitignore.
//
// HOW TO RUN
//   cd "F:\Daa_Bluprint\Dark wave"
//   node scripts/seed-darkwave-store.mjs
//
// SAFETY
//   - No other stores are touched.
//   - No products are created.
//   - No data is deleted.
//   - Existing darkwave founder store is not duplicated.
// =====================================================================

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue
} from 'firebase-admin/firestore';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// =====================================================================
// OFFICIAL DWM ADMIN UID
// =====================================================================

const MY_ADMIN_UID = '5KaKZzQopOWDLWIIqQ3EljnqpAq2';

// =====================================================================
// PATHS / STORE SETTINGS
// =====================================================================

const SERVICE_ACCOUNT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'service-account.json'
);

const STORE_SLUG = 'darkwave';
const STORE_NAME = 'Darkwave Market';

// Use the new DWM logo asset.
const STORE_LOGO_URL = '/assets/img/dwm-logo-new.png';

// =====================================================================
// VALIDATE ADMIN UID
// =====================================================================

if (!MY_ADMIN_UID || MY_ADMIN_UID === '<MY_ADMIN_UID>') {
  console.error('');
  console.error('❌ MY_ADMIN_UID is not set.');
  console.error(
    '   Open scripts/seed-darkwave-store.mjs and set it to your Firebase Auth UID.'
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
  console.error('Expected file:');
  console.error(`   ${SERVICE_ACCOUNT_PATH}`);
  console.error('');
  console.error('Firebase Console → Project Settings → Service accounts →');
  console.error('Generate new private key.');
  console.error('');
  console.error('Do NOT commit service-account.json.');
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
  console.log('🌊 DARKWAVE MARKET — Founder Store Seed');
  console.log('----------------------------------------');
  console.log('🔎 Checking for existing store with slug:', STORE_SLUG);

  const querySnapshot = await db
    .collection('stores')
    .where('slug', '==', STORE_SLUG)
    .limit(1)
    .get();

  // -------------------------------------------------------------------
  // STORE ALREADY EXISTS
  // -------------------------------------------------------------------

  if (!querySnapshot.empty) {
    const existing = querySnapshot.docs[0];

    console.log('');
    console.log('✅ Founder store already exists.');
    console.log('   No duplicate was created.');
    console.log('');
    console.log('   Document ID:', existing.id);
    console.log('   Slug:       ', existing.get('slug'));
    console.log('   Name:       ', existing.get('name'));
    console.log('   ownerUid:   ', existing.get('ownerUid'));
    console.log('   Status:     ', existing.get('status'));
    console.log('   Founder:    ', existing.get('isFounderStore'));
    console.log('   Logo URL:   ', existing.get('logoUrl'));
    console.log('');

    console.log(
      'Next step: set DARKWAVE_STORE_DOCUMENT_ID in seed-test-product.mjs to:'
    );

    console.log(JSON.stringify(existing.id));
    console.log('');

    return;
  }

  // -------------------------------------------------------------------
  // CREATE FOUNDER STORE
  // -------------------------------------------------------------------

  const payload = {
    name: STORE_NAME,
    slug: STORE_SLUG,
    ownerUid: MY_ADMIN_UID,

    description:
      'Official Darkwave Market founder store.',

    logoUrl: STORE_LOGO_URL,

    status: 'active',

    isFounderStore: true,

    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const ref = await db.collection('stores').add(payload);

  console.log('');
  console.log('🔥 Founder store created successfully.');
  console.log('');
  console.log('   Document ID:', ref.id);
  console.log('   Slug:       ', payload.slug);
  console.log('   Name:       ', payload.name);
  console.log('   ownerUid:   ', payload.ownerUid);
  console.log('   Status:     ', payload.status);
  console.log('   Founder:    ', payload.isFounderStore);
  console.log('   Logo URL:   ', payload.logoUrl);
  console.log('');

  console.log(
    'Next step: set DARKWAVE_STORE_DOCUMENT_ID in seed-test-product.mjs to:'
  );

  console.log(JSON.stringify(ref.id));
  console.log('');
}

// =====================================================================
// RUN
// =====================================================================

main()
  .then(() => {
    console.log('✅ Seed script finished.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('');
    console.error('💥 Fatal seed error:');
    console.error(err);
    console.error('');
    process.exit(99);
  });