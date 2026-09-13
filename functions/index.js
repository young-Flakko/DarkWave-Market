const {setGlobalOptions} = require("firebase-functions/v2");
const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const {
  initializeApp
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

const {
  randomBytes
} = require("crypto");


initializeApp();

const db = getFirestore();


setGlobalOptions({
  region: "europe-west2",
  maxInstances: 10
});


function cleanString(
  value,
  maxLength = 500
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}


function normalizeQuantity(
  value
) {
  const quantity =
    Number(value);

  if (
    !Number.isInteger(
      quantity
    ) ||
    quantity <= 0 ||
    quantity > 20
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid product quantity."
    );
  }

  return quantity;
}


function priceToCents(
  value
) {
  const price =
    Number(value);

  if (
    !Number.isFinite(
      price
    ) ||
    price < 0
  ) {
    throw new HttpsError(
      "failed-precondition",
      "A product has an invalid price."
    );
  }

  return Math.round(
    price * 100
  );
}


function centsToPrice(
  cents
) {
  return Number(
    (
      cents / 100
    ).toFixed(2)
  );
}


function makeOrderReference() {
  const now =
    new Date();

  const yy =
    String(
      now.getUTCFullYear()
    ).slice(-2);

  const mm =
    String(
      now.getUTCMonth() + 1
    ).padStart(2, "0");

  const dd =
    String(
      now.getUTCDate()
    ).padStart(2, "0");

  const random =
    randomBytes(4)
      .toString("hex")
      .toUpperCase()
      .slice(0, 6);

  return `DWM-${yy}${mm}${dd}-${random}`;
}


function normalizeCustomer(
  input,
  auth
) {
  const customer =
    input &&
    typeof input === "object"
      ? input
      : {};

  return {
    firstName:
      cleanString(
        customer.firstName,
        100
      ),

    lastName:
      cleanString(
        customer.lastName,
        100
      ),

    email:
      cleanString(
        auth?.token?.email ||
        customer.email,
        254
      ),

    phone:
      cleanString(
        customer.phone,
        50
      )
  };
}


function normalizeShipping(
  input
) {
  const shipping =
    input &&
    typeof input === "object"
      ? input
      : {};

  const sourceAddress =
    shipping.address &&
    typeof shipping.address === "object"
      ? shipping.address
      : {};

  const address = {
    address1:
      cleanString(
        sourceAddress.address1,
        200
      ),

    address2:
      cleanString(
        sourceAddress.address2,
        200
      ),

    city:
      cleanString(
        sourceAddress.city,
        100
      ),

    province:
      cleanString(
        sourceAddress.province,
        100
      ),

    postalCode:
      cleanString(
        sourceAddress.postalCode,
        30
      ),

    country:
      "South Africa"
  };


  if (
    !address.address1 ||
    !address.city ||
    !address.province ||
    !address.postalCode
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A complete delivery address is required."
    );
  }


  return {
    method:
      cleanString(
        shipping.method ||
        "standard",
        50
      ),

    address
  };
}


function normalizeCart(
  cart
) {
  if (
    !Array.isArray(
      cart
    ) ||
    cart.length === 0 ||
    cart.length > 50
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Cart is empty or invalid."
    );
  }


  /*
    Aggregate duplicate product IDs.

    This prevents the same product being
    submitted multiple times to bypass
    per-line quantity validation.
  */

  const quantities =
    new Map();


  for (
    const entry
    of cart
  ) {
    const productId =
      cleanString(
        entry?.productId,
        200
      );

    if (!productId) {
      throw new HttpsError(
        "invalid-argument",
        "A cart item is missing its product ID."
      );
    }


    const quantity =
      normalizeQuantity(
        entry?.quantity
      );


    const nextQuantity =
      (
        quantities.get(
          productId
        ) || 0
      ) + quantity;


    if (
      nextQuantity > 20
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Maximum quantity exceeded for a product."
      );
    }


    quantities.set(
      productId,
      nextQuantity
    );
  }


  return [
    ...quantities.entries()
  ].map(
    ([
      productId,
      quantity
    ]) => ({
      productId,
      quantity
    })
  );
}


exports.createTrustedOrder =
  onCall(
    async (
      request
    ) => {

      if (
        !request.auth
      ) {
        throw new HttpsError(
          "unauthenticated",
          "You must be signed in to place an order."
        );
      }


      const input =
        request.data &&
        typeof request.data === "object"
          ? request.data
          : {};


      const cart =
        normalizeCart(
          input.cart
        );


      const customer =
        normalizeCustomer(
          input.customer,
          request.auth
        );


      const shipping =
        normalizeShipping(
          input.shipping
        );


      const orderNotes =
        cleanString(
          input.orderNotes,
          1000
        );


      const customerUid =
        request.auth.uid;


      const orderReference =
        makeOrderReference();


      const orderRef =
        db.collection(
          "orders"
        ).doc();


      const result =
        await db.runTransaction(
          async (
            transaction
          ) => {

            /*
              =========================================
              PRODUCT READS
              =========================================
            */

            const productEntries =
              [];


            for (
              const cartItem
              of cart
            ) {
              const productRef =
                db.collection(
                  "products"
                ).doc(
                  cartItem.productId
                );


              const productSnap =
                await transaction.get(
                  productRef
                );


              if (
                !productSnap.exists
              ) {
                throw new HttpsError(
                  "not-found",
                  "A product in your cart no longer exists."
                );
              }


              productEntries.push({
                cartItem,
                productRef,
                productSnap
              });
            }


            /*
              =========================================
              VALIDATE PRODUCTS + COLLECT STORES
              =========================================
            */

            const storeIds =
              new Set();


            for (
              const entry
              of productEntries
            ) {
              const data =
                entry.productSnap.data();


              const status =
                cleanString(
                  data.status,
                  50
                ).toLowerCase();


              if (
                status !== "live"
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  `${cleanString(
                    data.name,
                    150
                  ) || "A product"} is no longer live.`
                );
              }


              const stock =
                Number(
                  data.stock
                );


              if (
                !Number.isInteger(
                  stock
                ) ||
                stock < 0
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "A product has invalid stock data."
                );
              }


              if (
                entry.cartItem.quantity >
                stock
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  `${cleanString(
                    data.name,
                    150
                  ) || "A product"} only has ${stock} available.`
                );
              }


              if (
                !data.storeId
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "A product is missing seller information."
                );
              }


              storeIds.add(
                String(
                  data.storeId
                )
              );
            }


            /*
              =========================================
              STORE READS
              =========================================
            */

            const stores =
              new Map();


            for (
              const storeId
              of storeIds
            ) {
              const storeRef =
                db.collection(
                  "stores"
                ).doc(
                  storeId
                );


              const storeSnap =
                await transaction.get(
                  storeRef
                );


              if (
                !storeSnap.exists
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "A seller store no longer exists."
                );
              }


              const storeData =
                storeSnap.data();


              if (
                cleanString(
                  storeData.status,
                  50
                ).toLowerCase() !==
                "active"
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "A seller store is not currently active."
                );
              }


              if (
                !storeData.ownerUid
              ) {
                throw new HttpsError(
                  "failed-precondition",
                  "A seller store is missing ownership information."
                );
              }


              stores.set(
                storeId,
                {
                  id:
                    storeSnap.id,

                  ...storeData
                }
              );
            }


            /*
              =========================================
              BUILD TRUSTED ORDER ITEMS
              =========================================
            */

            let subtotalCents =
              0;


            const items =
              [];


            const sellerUids =
              new Set();


            const storeBreakdownMap =
              new Map();


            for (
              const entry
              of productEntries
            ) {
              const product =
                entry.productSnap.data();


              const store =
                stores.get(
                  String(
                    product.storeId
                  )
                );


              const unitPriceCents =
                priceToCents(
                  product.price
                );


              const lineTotalCents =
                unitPriceCents *
                entry.cartItem.quantity;


              subtotalCents +=
                lineTotalCents;


              const sellerUid =
                String(
                  store.ownerUid
                );


              sellerUids.add(
                sellerUid
              );


              items.push({
                productId:
                  entry.productSnap.id,

                storeId:
                  store.id,

                storeName:
                  cleanString(
                    store.name,
                    150
                  ) ||
                  "DWM Store",

                storeSlug:
                  cleanString(
                    store.slug,
                    150
                  ) ||
                  null,

                name:
                  cleanString(
                    product.name,
                    200
                  ) ||
                  "Untitled",

                imageUrl:
                  cleanString(
                    product.imageUrl,
                    1000
                  ) ||
                  "/assets/img/dwm-logo-new.webp",

                category:
                  cleanString(
                    product.category,
                    100
                  ),

                quantity:
                  entry.cartItem.quantity,

                unitPrice:
                  centsToPrice(
                    unitPriceCents
                  ),

                lineTotal:
                  centsToPrice(
                    lineTotalCents
                  ),

                currency:
                  "ZAR"
              });


              if (
                !storeBreakdownMap.has(
                  store.id
                )
              ) {
                storeBreakdownMap.set(
                  store.id,
                  {
                    storeId:
                      store.id,

                    storeName:
                      cleanString(
                        store.name,
                        150
                      ) ||
                      "DWM Store",

                    storeSlug:
                      cleanString(
                        store.slug,
                        150
                      ) ||
                      null,

                    sellerUid,

                    subtotalCents:
                      0,

                    itemCount:
                      0
                  }
                );
              }


              const breakdown =
                storeBreakdownMap.get(
                  store.id
                );


              breakdown.subtotalCents +=
                lineTotalCents;


              breakdown.itemCount +=
                entry.cartItem.quantity;
            }


            /*
              Shipping remains zero until the
              server-side shipping rules are added.
            */

            const shippingCents =
              0;


            const totalCents =
              subtotalCents +
              shippingCents;


            const storeBreakdown =
              [
                ...storeBreakdownMap.values()
              ].map(
                (
                  entry
                ) => ({
                  storeId:
                    entry.storeId,

                  storeName:
                    entry.storeName,

                  storeSlug:
                    entry.storeSlug,

                  sellerUid:
                    entry.sellerUid,

                  subtotal:
                    centsToPrice(
                      entry.subtotalCents
                    ),

                  itemCount:
                    entry.itemCount
                })
              );


            const sellerUidList =
              [
                ...sellerUids
              ];


            const storeIdList =
              [
                ...storeIds
              ];


            const order =
              {
                orderReference,

                customerUid,

                customer,

                shipping,

                orderNotes,

                items,

                storeIds:
                  storeIdList,

                sellerUids:
                  sellerUidList,

                storeBreakdown,

                itemCount:
                  items.reduce(
                    (
                      sum,
                      item
                    ) =>
                      sum +
                      item.quantity,
                    0
                  ),

                uniqueProductCount:
                  items.length,

                currency:
                  "ZAR",

                subtotal:
                  centsToPrice(
                    subtotalCents
                  ),

                shippingTotal:
                  centsToPrice(
                    shippingCents
                  ),

                total:
                  centsToPrice(
                    totalCents
                  ),

                paymentStatus:
                  "pending",

                paymentProvider:
                  null,

                paymentReference:
                  null,

                fulfilmentStatus:
                  "pending",

                orderStatus:
                  "pending_payment",

                source:
                  "web",

                trustedOrder:
                  true,

                createdAt:
                  FieldValue.serverTimestamp(),

                updatedAt:
                  FieldValue.serverTimestamp()
              };


            /*
              =========================================
              WRITES
              =========================================

              Parent order + seller query references
              are committed atomically.
            */

            transaction.set(
              orderRef,
              order
            );


            for (
              const sellerUid
              of sellerUidList
            ) {
              const sellerRef =
                db.collection(
                  "sellerOrderRefs"
                ).doc(
                  `${orderRef.id}_${sellerUid}`
                );


              transaction.set(
                sellerRef,
                {
                  orderId:
                    orderRef.id,

                  orderReference,

                  sellerUid,

                  customerUid,

                  storeIds:
                    storeIdList,

                  createdAt:
                    FieldValue.serverTimestamp()
                }
              );
            }


            return {
              orderId:
                orderRef.id,

              orderReference,

              subtotal:
                centsToPrice(
                  subtotalCents
                ),

              shippingTotal:
                centsToPrice(
                  shippingCents
                ),

              total:
                centsToPrice(
                  totalCents
                ),

              currency:
                "ZAR"
            };
          }
        );


      return result;
    }
  );
