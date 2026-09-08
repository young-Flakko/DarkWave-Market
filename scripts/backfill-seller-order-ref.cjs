const {
  initializeApp,
  cert
} = require('firebase-admin/app');

const {
  getFirestore,
  FieldValue
} = require('firebase-admin/firestore');

const serviceAccount =
  require('../service-account.json');

initializeApp({
  credential:
    cert(serviceAccount)
});

const db =
  getFirestore();

async function main() {

  const reference =
    'DWM-260906-D44MA3';

  const querySnapshot =
    await db
      .collection('orders')
      .where(
        'orderReference',
        '==',
        reference
      )
      .limit(1)
      .get();

  if (querySnapshot.empty) {
    throw new Error(
      `Order not found: ${reference}`
    );
  }

  const orderDoc =
    querySnapshot.docs[0];

  const order =
    orderDoc.data();

  const sellerUids =
    Array.isArray(
      order.sellerUids
    )
      ? [
          ...new Set(
            order.sellerUids.filter(Boolean)
          )
        ]
      : [];

  if (!sellerUids.length) {
    throw new Error(
      'Order has no sellerUids.'
    );
  }

  for (const sellerUid of sellerUids) {

    const refId =
      `${orderDoc.id}_${sellerUid}`;

    await db
      .collection('sellerOrderRefs')
      .doc(refId)
      .set(
        {
          orderId:
            orderDoc.id,

          orderReference:
            order.orderReference,

          sellerUid,

          createdAt:
            FieldValue.serverTimestamp()
        },
        {
          merge:true
        }
      );

    console.log(
      `‚úÖ Seller ref: ${sellerUid} -> ${orderDoc.id}`
    );
  }

  console.log('');
  console.log(
    'Ì¥• SELLER ORDER REF BACKFILL COMPLETE'
  );

  process.exit(0);
}

main().catch(error => {
  console.error('');
  console.error('‚ùå BACKFILL FAILED');
  console.error(error);
  process.exit(1);
});
