import { readFile } from 'node:fs/promises';

import {
  cert,
  getApps,
  initializeApp
} from 'firebase-admin/app';

import {
  getFirestore,
  FieldValue
} from 'firebase-admin/firestore';


// ============================================================
// DWM ADMIN CONFIG
// ============================================================

const ADMIN_UID =
  '5KaKZzQopOWDLWIIqQ3EljnqpAq2';

const ADMIN_EMAIL =
  'lilimuambani@gmail.com';

const ADMIN_DISPLAY_NAME =
  'Darkwave Admin';


// ============================================================
// LOAD SERVICE ACCOUNT
// ============================================================

const serviceAccount = JSON.parse(
  await readFile(
    new URL('../service-account.json', import.meta.url),
    'utf8'
  )
);


// ============================================================
// INITIALIZE FIREBASE ADMIN
// ============================================================

const firebaseApp =
  getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount)
      });

const db = getFirestore(firebaseApp);


// ============================================================
// CREATE / UPDATE ADMIN PROFILE
// ============================================================

const userRef =
  db.collection('users').doc(ADMIN_UID);

await userRef.set(
  {
    uid: ADMIN_UID,

    email: ADMIN_EMAIL,

    displayName: ADMIN_DISPLAY_NAME,

    role: 'admin',

    updatedAt:
      FieldValue.serverTimestamp()
  },
  {
    merge: true
  }
);


// ============================================================
// VERIFY
// ============================================================

const snapshot =
  await userRef.get();

console.log('');
console.log('========================================');
console.log(' DWM ADMIN BOOTSTRAP COMPLETE');
console.log('========================================');
console.log('');
console.log('UID:', snapshot.id);
console.log('Email:', snapshot.data()?.email);
console.log('Name:', snapshot.data()?.displayName);
console.log('Role:', snapshot.data()?.role);
console.log('');
console.log('Admin account is ready.');
console.log('========================================');