import {
  collection,
  doc,
  getDoc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';

import {
  db
} from './firebase-config.js';

import {
  renderNav
} from './nav.js';

import {
  getCurrentUser
} from './auth.js';

import {
  getCart
} from './cart.js';

import {
  fetchActiveStoresByIds,
  formatZARPrice
} from './data.js';


/* =========================================================
   CONSTANTS
========================================================= */

const CART_KEY =
  'dwm_cart';


/* =========================================================
   DOM
========================================================= */

const checkoutItems =
  document.getElementById(
    'checkoutItems'
  );

const subtotalValue =
  document.getElementById(
    'subtotalValue'
  );

const shippingValue =
  document.getElementById(
    'shippingValue'
  );

const totalValue =
  document.getElementById(
    'totalValue'
  );

const placeOrderBtn =
  document.getElementById(
    'placeOrderBtn'
  );

const checkoutFeedback =
  document.getElementById(
    'checkoutFeedback'
  );

const checkoutForm =
  document.getElementById(
    'checkoutForm'
  );

const emailInput =
  document.getElementById(
    'email'
  );


/* =========================================================
   STATE
========================================================= */

let currentUser = null;

let validatedItems = [];

let subtotal = 0;

let shippingCost = 0;

let total = 0;

let validationPassed = false;

let orderSubmitting = false;


/* =========================================================
   INIT
========================================================= */

async function init() {

  try {

    renderNav('nav');

  } catch (error) {

    console.error(
      'Unable to render nav:',
      error
    );

  }


  /*
    Checkout requires authentication.
  */

  currentUser =
    await getCurrentUser();


  if (!currentUser) {

    window.location.href =
      '/login.html';

    return;

  }


  /*
    Prefill authenticated email.
  */

  if (
    emailInput &&
    currentUser.email
  ) {

    emailInput.value =
      currentUser.email;

  }


  await validateCartFromFirestore();

}


/* =========================================================
   FEEDBACK
========================================================= */

function setFeedback(
  message,
  type = 'error'
) {

  checkoutFeedback.textContent =
    message;

  checkoutFeedback.classList.add(
    'show'
  );


  if (type === 'success') {

    checkoutFeedback.style.borderColor =
      'rgba(74,157,168,0.42)';

    checkoutFeedback.style.background =
      'rgba(74,157,168,0.08)';

    checkoutFeedback.style.color =
      '#7dd4e0';

  } else {

    checkoutFeedback.style.borderColor =
      'rgba(207,88,88,0.35)';

    checkoutFeedback.style.background =
      'rgba(207,88,88,0.06)';

    checkoutFeedback.style.color =
      '#ff9898';

  }

}


function clearFeedback() {

  checkoutFeedback.textContent =
    '';

  checkoutFeedback.classList.remove(
    'show'
  );

}


/* =========================================================
   PRODUCT FETCH
========================================================= */

async function fetchProductById(
  productId
) {

  if (!productId) {
    return null;
  }


  const ref =
    doc(
      db,
      'products',
      productId
    );


  const snap =
    await getDoc(ref);


  if (!snap.exists()) {
    return null;
  }


  return {
    id:
      snap.id,

    data:
      snap.data()
  };

}


/* =========================================================
   NORMALISERS
========================================================= */

function normalizeStock(
  value
) {

  const n =
    Number(value);


  if (
    !Number.isFinite(n) ||
    n < 0
  ) {
    return 0;
  }


  return Math.trunc(n);

}


function normalizeQuantity(
  value
) {

  const n =
    Number(value);


  if (
    !Number.isFinite(n) ||
    n <= 0
  ) {
    return 0;
  }


  return Math.trunc(n);

}


function normalizePrice(
  value
) {

  const n =
    Number(value);


  if (
    !Number.isFinite(n) ||
    n < 0
  ) {
    return null;
  }


  return n;

}


/* =========================================================
   CART VALIDATION
========================================================= */

async function validateCartFromFirestore() {

  clearFeedback();

  validationPassed =
    false;

  placeOrderBtn.disabled =
    true;

  placeOrderBtn.textContent =
    'Validating Order...';


  checkoutItems.innerHTML = `
    <div class="loading-block">
      Checking live product data...
    </div>
  `;


  const cart =
    getCart();


  if (
    !Array.isArray(cart) ||
    cart.length === 0
  ) {

    renderEmptyCart();

    return;

  }


  try {

    /*
      Fetch every product fresh from Firestore.

      Local cart price/stock is NOT trusted.
    */

    const fetched =
      await Promise.all(
        cart.map(
          async (
            cartItem
          ) => {

            const product =
              await fetchProductById(
                cartItem.productId
              );


            return {
              cartItem,
              product
            };

          }
        )
      );


    const nextItems = [];

    const errors = [];


    for (
      const entry
      of fetched
    ) {

      const {
        cartItem,
        product
      } = entry;


      if (!product) {

        errors.push(
          `${
            cartItem.name ||
            'A product'
          } is no longer available.`
        );

        continue;

      }


      const data =
        product.data || {};


      const status =
        String(
          data.status || ''
        )
          .trim()
          .toLowerCase();


      if (
        status !== 'live'
      ) {

        errors.push(
          `${
            data.name ||
            'A product'
          } is no longer live.`
        );

        continue;

      }


      const stock =
        normalizeStock(
          data.stock
        );


      const quantity =
        normalizeQuantity(
          cartItem.quantity
        );


      if (
        quantity <= 0
      ) {

        errors.push(
          `${
            data.name ||
            'A product'
          } has an invalid quantity.`
        );

        continue;

      }


      if (
        stock <= 0
      ) {

        errors.push(
          `${
            data.name ||
            'A product'
          } is sold out.`
        );

        continue;

      }


      if (
        quantity > stock
      ) {

        errors.push(
          `${
            data.name ||
            'A product'
          } only has ${stock} available.`
        );

        continue;

      }


      const price =
        normalizePrice(
          data.price
        );


      if (
        price === null
      ) {

        errors.push(
          `${
            data.name ||
            'A product'
          } has an invalid price.`
        );

        continue;

      }


      if (!data.storeId) {

        errors.push(
          `${
            data.name ||
            'A product'
          } is missing seller information.`
        );

        continue;

      }


      nextItems.push({

        productId:
          product.id,

        storeId:
          data.storeId,

        name:
          data.name ||
          'Untitled',

        imageUrl:
          data.imageUrl ||
          '/assets/img/dwm-logo-new.png',

        category:
          data.category ||
          '',

        quantity,

        stock,

        unitPrice:
          price,

        currency:
          data.currency ||
          'ZAR',

        lineTotal:
          price *
          quantity

      });

    }


    if (
      errors.length > 0
    ) {

      renderValidationFailure(
        errors
      );

      return;

    }


    validatedItems =
      nextItems;


    /*
      Resolve active stores.
    */

    const storeIds = [
      ...new Set(
        validatedItems
          .map(
            (
              item
            ) =>
              item.storeId
          )
          .filter(Boolean)
      )
    ];


    const stores =
      await fetchActiveStoresByIds(
        storeIds
      );


    for (
      const item
      of validatedItems
    ) {

      const store =
        stores.get(
          item.storeId
        );


      if (!store) {

        errors.push(
          `${item.name} belongs to a store that is not currently active.`
        );

        continue;

      }


      item.storeName =
        store.data?.name ||
        store.data?.storeName ||
        store.data?.slug ||
        'Store';


      item.storeSlug =
        store.data?.slug ||
        null;

      item.sellerUid =
        store.data?.ownerUid ||
        null;

    }


    if (
      errors.length > 0
    ) {

      renderValidationFailure(
        errors
      );

      return;

    }


    subtotal =
      validatedItems.reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.lineTotal,
        0
      );


    /*
      Phase 5A shipping.

      Still zero until shipping pricing
      architecture is finalised.
    */

    shippingCost =
      0;


    total =
      subtotal +
      shippingCost;


    validationPassed =
      true;


    renderValidatedOrder();


    placeOrderBtn.disabled =
      false;

    placeOrderBtn.textContent =
      'Place Test Order';

  } catch (error) {

    console.error(
      'Checkout validation failed:',
      error
    );


    resetOrderState();


    checkoutItems.innerHTML = `
      <div class="empty-block">
        Unable to validate your cart.
      </div>
    `;


    updateTotals();


    setFeedback(
      'We could not verify the latest product information. Refresh and try again.'
    );


    placeOrderBtn.disabled =
      true;

    placeOrderBtn.textContent =
      'Validate Order';

  }

}


/* =========================================================
   RESET STATE
========================================================= */

function resetOrderState() {

  validatedItems = [];

  subtotal = 0;

  shippingCost = 0;

  total = 0;

  validationPassed =
    false;

}


/* =========================================================
   RENDER ORDER
========================================================= */

function renderValidatedOrder() {

  checkoutItems.innerHTML =
    validatedItems
      .map(
        (
          item
        ) => {

          return `
            <div class="summary-item">

              <div class="summary-image">

                <img
                  src="${escapeAttr(
                    item.imageUrl
                  )}"

                  alt="${escapeAttr(
                    item.name
                  )}"

                  onerror="
                    this.onerror=null;
                    this.src='/assets/img/dwm-logo-new.png';
                  "
                >

              </div>

              <div>

                <div class="summary-name">
                  ${escapeHtml(
                    item.name
                  )}
                </div>

                <div class="summary-meta">

                  Sold by
                  ${escapeHtml(
                    item.storeName
                  )}

                  <br>

                  Qty
                  ${item.quantity}

                  ×

                  ${escapeHtml(
                    formatZARPrice(
                      item.unitPrice
                    )
                  )}

                </div>

                <div class="summary-price">

                  ${escapeHtml(
                    formatZARPrice(
                      item.lineTotal
                    )
                  )}

                </div>

              </div>

            </div>
          `;

        }
      )
      .join('');


  updateTotals();

}


/* =========================================================
   FAILURE STATE
========================================================= */

function renderValidationFailure(
  errors
) {

  resetOrderState();


  checkoutItems.innerHTML = `
    <div class="empty-block">
      Your cart needs attention before checkout.
    </div>
  `;


  updateTotals();


  setFeedback(
    errors.join(' ')
  );


  placeOrderBtn.disabled =
    true;

  placeOrderBtn.textContent =
    'Cart Needs Attention';

}


/* =========================================================
   EMPTY CART
========================================================= */

function renderEmptyCart() {

  resetOrderState();


  checkoutItems.innerHTML = `
    <div class="empty-block">

      Your cart is empty.

      <br><br>

      <a
        href="/shop.html"

        style="
          color:var(--teal-bright);
          text-decoration:none;
        "
      >
        Return to Shop
      </a>

    </div>
  `;


  updateTotals();


  placeOrderBtn.disabled =
    true;

  placeOrderBtn.textContent =
    'Cart Empty';

}


/* =========================================================
   TOTALS
========================================================= */

function updateTotals() {

  subtotalValue.textContent =
    formatZARPrice(
      subtotal
    );


  shippingValue.textContent =
    formatZARPrice(
      shippingCost
    );


  totalValue.textContent =
    formatZARPrice(
      total
    );

}


/* =========================================================
   CUSTOMER FORM
========================================================= */

function validateCustomerForm() {

  clearFeedback();


  if (
    !checkoutForm.checkValidity()
  ) {

    checkoutForm.reportValidity();


    setFeedback(
      'Complete all required customer and delivery fields.'
    );


    return false;

  }


  const postalCode =
    document
      .getElementById(
        'postalCode'
      )
      .value
      .trim();


  if (
    !/^\d{4}$/.test(
      postalCode
    )
  ) {

    setFeedback(
      'Enter a valid 4-digit South African postal code.'
    );


    return false;

  }


  const phone =
    document
      .getElementById(
        'phone'
      )
      .value
      .replace(
        /[\s\-()]/g,
        ''
      );


  if (
    phone.length < 9
  ) {

    setFeedback(
      'Enter a valid contact number.'
    );


    return false;

  }


  return true;

}


/* =========================================================
   CUSTOMER DATA
========================================================= */

function getCustomerData() {

  const form =
    new FormData(
      checkoutForm
    );


  return {

    firstName:
      String(
        form.get(
          'firstName'
        ) || ''
      ).trim(),

    lastName:
      String(
        form.get(
          'lastName'
        ) || ''
      ).trim(),

    email:
      String(
        form.get(
          'email'
        ) || ''
      ).trim(),

    phone:
      String(
        form.get(
          'phone'
        ) || ''
      ).trim()

  };

}


/* =========================================================
   SHIPPING DATA
========================================================= */

function getShippingData() {

  const form =
    new FormData(
      checkoutForm
    );


  return {

    method:
      String(
        form.get(
          'shippingMethod'
        ) ||
        'standard'
      ),

    address: {

      address1:
        String(
          form.get(
            'address1'
          ) || ''
        ).trim(),

      address2:
        String(
          form.get(
            'address2'
          ) || ''
        ).trim(),

      city:
        String(
          form.get(
            'city'
          ) || ''
        ).trim(),

      province:
        String(
          form.get(
            'province'
          ) || ''
        ).trim(),

      postalCode:
        String(
          form.get(
            'postalCode'
          ) || ''
        ).trim(),

      country:
        'South Africa'

    }

  };

}


/* =========================================================
   ORDER NOTES
========================================================= */

function getOrderNotes() {

  const field =
    document.getElementById(
      'orderNotes'
    );


  if (!field) {
    return '';
  }


  return String(
    field.value || ''
  )
    .trim()
    .slice(
      0,
      500
    );

}


/* =========================================================
   ORDER REFERENCE
========================================================= */

function generateOrderReference() {

  const now =
    new Date();


  const year =
    now
      .getFullYear()
      .toString()
      .slice(-2);


  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      '0'
    );


  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      '0'
    );


  const random =
    Math.random()
      .toString(36)
      .slice(
        2,
        8
      )
      .toUpperCase();


  return (
    `DWM-${year}${month}${day}-${random}`
  );

}


/* =========================================================
   STORE BREAKDOWN
========================================================= */

function buildStoreBreakdown() {

  const stores =
    new Map();


  validatedItems.forEach(
    (
      item
    ) => {

      if (
        !stores.has(
          item.storeId
        )
      ) {

        stores.set(
          item.storeId,
          {

            storeId:
              item.storeId,

            storeName:
              item.storeName,

            storeSlug:
              item.storeSlug ||
              null,

            subtotal:
              0,

            itemCount:
              0

          }
        );

      }


      const entry =
        stores.get(
          item.storeId
        );


      entry.subtotal +=
        item.lineTotal;


      entry.itemCount +=
        item.quantity;

    }
  );


  return [
    ...stores.values()
  ];

}


/* =========================================================
   BUILD ORDER
========================================================= */

function buildOrderPayload() {

  const customer =
    getCustomerData();


  const shipping =
    getShippingData();


  const storeIds = [
    ...new Set(
      validatedItems.map(
        (
          item
        ) =>
          item.storeId
      )
    )
  ];


  const sellerUids = [
    ...new Set(
      validatedItems
        .map(
          (
            item
          ) =>
            item.sellerUid
        )
        .filter(Boolean)
    )
  ];


  const items =
    validatedItems.map(
      (
        item
      ) => ({

        productId:
          item.productId,

        storeId:
          item.storeId,

        storeName:
          item.storeName,

        storeSlug:
          item.storeSlug ||
          null,

        name:
          item.name,

        imageUrl:
          item.imageUrl,

        category:
          item.category,

        quantity:
          item.quantity,

        unitPrice:
          item.unitPrice,

        lineTotal:
          item.lineTotal,

        currency:
          item.currency

      })
    );


  return {

    orderReference:
      generateOrderReference(),

    customerUid:
      currentUser.uid,

    customer,

    shipping,

    orderNotes:
      getOrderNotes(),

    items,

    storeIds,

    sellerUids,

    storeBreakdown:
      buildStoreBreakdown(),

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
      'ZAR',

    subtotal,

    shippingTotal:
      shippingCost,

    total,

    paymentStatus:
      'pending',

    paymentProvider:
      null,

    paymentReference:
      null,

    fulfilmentStatus:
      'pending',

    orderStatus:
      'pending_payment',

    source:
      'web',

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp()

  };

}


/* =========================================================
   CREATE FIRESTORE ORDER
========================================================= */

async function createOrder() {

  if (
    orderSubmitting
  ) {
    return;
  }


  if (
    !currentUser
  ) {

    window.location.href =
      '/login.html';

    return;

  }


  if (
    !validationPassed ||
    validatedItems.length === 0
  ) {

    setFeedback(
      'Your cart must be validated before creating an order.'
    );

    return;

  }


  if (
    !validateCustomerForm()
  ) {
    return;
  }


  orderSubmitting =
    true;


  placeOrderBtn.disabled =
    true;

  placeOrderBtn.textContent =
    'Rechecking Market...';


  /*
    IMPORTANT:

    Re-fetch Firestore immediately before
    writing the order.
  */

  await validateCartFromFirestore();


  if (
    !validationPassed ||
    validatedItems.length === 0
  ) {

    orderSubmitting =
      false;

    return;

  }


  /*
    validateCartFromFirestore re-enables
    the button, so disable it again while
    we actually write.
  */

  placeOrderBtn.disabled =
    true;

  placeOrderBtn.textContent =
    'Creating Order...';


  try {

    const payload =
      buildOrderPayload();


    const orderRef =
      await addDoc(
        collection(
          db,
          'orders'
        ),
        payload
      );


    /*
      Test-order lifecycle:
      clear local cart only AFTER
      Firestore successfully created
      the order.
    */

    localStorage.setItem(
      CART_KEY,
      JSON.stringify([])
    );


    /*
      Redirect to confirmation page.

      We pass only the Firestore document ID.
      The success page will read trusted order
      details from Firestore.
    */

    window.location.href =
      `/order-success.html?order=${encodeURIComponent(
        orderRef.id
      )}`;

  } catch (error) {

    console.error(
      'Unable to create order:',
      error
    );


    orderSubmitting =
      false;


    placeOrderBtn.disabled =
      false;

    placeOrderBtn.textContent =
      'Place Test Order';


    setFeedback(
      'The order could not be created. Your cart has not been cleared. Please try again.'
    );

  }

}


/* =========================================================
   BUTTON
========================================================= */

placeOrderBtn.addEventListener(
  'click',
  createOrder
);


/* =========================================================
   ESCAPING
========================================================= */

function escapeHtml(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }


  return String(value)

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#39;'
    );

}


function escapeAttr(
  value
) {

  return escapeHtml(
    value
  );

}


/* =========================================================
   GO
========================================================= */

init();