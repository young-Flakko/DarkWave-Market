const {
  initializeApp,
  cert
} = require('firebase-admin/app');

const {
  getFirestore,
  FieldValue
} = require('firebase-admin/firestore');

const serviceAccount = require('../service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {

  const reference = 'DWM-260906-D44MA3';

  console.log(`Looking for order: ${reference}`);

  const snap = await db
    .collection('orders')
    .where('orderReference', '==', reference)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error(`Order not found: ${reference}`);
  }

  const orderDoc = snap.docs[0];
  const order = orderDoc.data();

  console.log(`‚úÖ Found order ID: ${orderDoc.id}`);

  const storeIds = Array.isArray(order.storeIds)
    ? [...new Set(order.storeIds.filter(Boolean))]
    : [];

  if (!storeIds.length) {
    throw new Error('Order contains no storeIds.');
  }

  console.log(`Store IDs: ${storeIds.join(', ')}`);

  const sellerUids = [];

  for (const storeId of storeIds) {

    const storeSnap = await db
      .collection('stores')
      .doc(storeId)
      .get();

    if (!storeSnap.exists) {
      throw new Error(`Store missing: ${storeId}`);
    }

    const store = storeSnap.data();

    if (!store.ownerUid) {
      throw new Error(`Store has no ownerUid: ${storeId}`);
    }

    sellerUids.push(store.ownerUid);

    console.log(
      `‚úÖ ${store.name || storeId} -> ${store.ownerUid}`
    );
  }

  const uniqueSellerUids = [
    ...new Set(sellerUids)
  ];

  await orderDoc.ref.update({
    sellerUids: uniqueSellerUids,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log('');
  console.log(`Ì¥• BACKFILLED: ${reference}`);
  console.log(`Order ID: ${orderDoc.id}`);
  console.log('sellerUids:', uniqueSellerUids);

  process.exit(0);
}

main().catch(error => {

  console.error('');
  console.error('‚ùå BACKFILL FAILED');
  console.error(error);

  process.exit(1);
});
