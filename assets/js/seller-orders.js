import {
  db
} from './firebase-config.js';


import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';


import {
  requireReseller
} from './auth.js';


import {
  renderNav
} from './nav.js';


renderNav('nav');


const sellerOrdersIntro =
  document.getElementById(
    'sellerOrdersIntro'
  );

const ordersStatus =
  document.getElementById(
    'ordersStatus'
  );

const sellerOrders =
  document.getElementById(
    'sellerOrders'
  );


let currentUser = null;

let currentStore = null;

let currentStoreId = null;


function escapeHtml(value = '') {

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


function formatPrice(value) {

  return new Intl.NumberFormat(
    'en-ZA',
    {
      style: 'currency',
      currency: 'ZAR'
    }
  ).format(
    Number(value || 0)
  );

}


function formatDate(value) {

  if (!value) {
    return 'Date unavailable';
  }

  let date;

  if (
    typeof value.toDate === 'function'
  ) {

    date =
      value.toDate();

  } else {

    date =
      new Date(value);

  }

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return 'Date unavailable';

  }

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle: 'medium',
      timeStyle: 'short'
    }
  ).format(date);

}


function safeUrl(value = '') {

  const raw =
    String(value || '').trim();

  if (!raw) {
    return '';
  }

  try {

    const url =
      new URL(raw);

    if (
      ![
        'http:',
        'https:'
      ].includes(
        url.protocol
      )
    ) {

      return '';

    }

    return url.href;

  } catch {

    return '';

  }

}


function getCustomerName(order) {

  const customer =
    order.customer || {};

  const first =
    customer.firstName ||
    customer.name ||
    '';

  const last =
    customer.lastName ||
    '';

  return (
    `${first} ${last}`.trim()
    || 'DWM Customer'
  );

}


function getCustomerEmail(order) {

  return (
    order.customer?.email ||
    ''
  );

}


function getCustomerPhone(order) {

  return (
    order.customer?.phone ||
    order.shipping?.phone ||
    ''
  );

}


function getShippingAddress(order) {

  const shipping =
    order.shipping || {};

  const nestedAddress =
    shipping.address &&
    typeof shipping.address === 'object'
      ? shipping.address
      : {};

  const parts = [

    nestedAddress.address1 ||
    shipping.addressLine1 ||
    shipping.address1 ||
    shipping.streetAddress,

    nestedAddress.address2 ||
    shipping.addressLine2 ||
    shipping.address2,

    nestedAddress.city ||
    shipping.city,

    nestedAddress.province ||
    shipping.province ||
    shipping.state,

    nestedAddress.postalCode ||
    shipping.postalCode ||
    shipping.zipCode,

    nestedAddress.country ||
    shipping.country

  ]
    .filter(Boolean)
    .map(
      value =>
        String(value).trim()
    );

  return parts.length
    ? parts.join(', ')
    : 'Delivery address unavailable';

}


function getSellerItems(order) {

  if (
    !Array.isArray(
      order.items
    )
  ) {

    return [];

  }

  return order.items.filter(
    item =>
      item.storeId ===
      currentStoreId
  );

}


function sellerSubtotal(items) {

  return items.reduce(
    (
      total,
      item
    ) => {

      const quantity =
        Math.max(
          1,
          Number(
            item.quantity || 1
          )
        );

      const price =
        Math.max(
          0,
          Number(
            item.unitPrice || item.price || 0
          )
        );

      return total +
        quantity *
        price;

    },
    0
  );

}


async function getShipment(
  orderId
) {

  const shipmentRef =
    doc(
      db,
      'orders',
      orderId,
      'shipments',
      currentStoreId
    );

  const snapshot =
    await getDoc(
      shipmentRef
    );

  if (
    !snapshot.exists()
  ) {

    return null;

  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  };

}


function renderItem(
  item
) {

  const image =
    item.imageUrl ||
    '/assets/img/dwm-logo-new.webp';

  const quantity =
    Math.max(
      1,
      Number(
        item.quantity || 1
      )
    );

  return `

    <div class="seller-order-item">

      <img
        src="${escapeHtml(image)}"
        alt="${escapeHtml(item.name || 'Product')}"
        loading="lazy"
        onerror="
          this.onerror=null;
          this.src='/assets/img/dwm-logo-new.webp';
        "
      >

      <div>

        <div class="seller-order-item-name">

          ${escapeHtml(
            item.name ||
            'DWM Product'
          )}

        </div>

        <div class="seller-order-item-meta">

          Qty ${escapeHtml(
            String(quantity)
          )}

          ×

          ${escapeHtml(
            formatPrice(
              item.unitPrice ?? item.price ?? 0
            )
          )}

        </div>

      </div>

    </div>

  `;

}


async function renderOrder(
  order
) {

  const items =
    getSellerItems(
      order
    );

  if (
    !items.length
  ) {

    return;

  }

  let shipment =
    null;

  try {

    shipment =
      await getShipment(
        order.id
      );

  } catch (error) {

    console.error(
      '[seller-orders] Shipment load error:',
      error
    );

  }

  const currentStatus =
    shipment?.status ||
    'processing';

  const carrier =
    shipment?.carrier ||
    '';

  const trackingNumber =
    shipment?.trackingNumber ||
    '';

  const trackingUrl =
    shipment?.trackingUrl ||
    '';

  const card =
    document.createElement(
      'article'
    );

  card.className =
    'seller-order';

  card.innerHTML = `

    <div class="seller-order-head">

      <div>

        <div class="seller-order-label">
          DWM Order
        </div>

        <div class="seller-order-reference">

          ${escapeHtml(
            order.orderReference ||
            order.id
          )}

        </div>

        <div class="seller-order-date">

          ${escapeHtml(
            formatDate(
              order.createdAt
            )
          )}

        </div>

      </div>

      <div class="seller-status-pill">

        ${escapeHtml(
          currentStatus
            .replaceAll(
              '_',
              ' '
            )
            .toUpperCase()
        )}

      </div>

    </div>

    <div class="seller-order-grid">

      <section class="seller-order-section">

        <div class="seller-order-label">
          Your Items
        </div>

        ${
          items
            .map(renderItem)
            .join('')
        }

        <div class="seller-order-subtotal">

          <span>
            Seller subtotal
          </span>

          <strong>

            ${escapeHtml(
              formatPrice(
                sellerSubtotal(
                  items
                )
              )
            )}

          </strong>

        </div>

      </section>

      <section class="seller-order-section">

        <div class="seller-order-label">
          Delivery
        </div>

        <div class="seller-customer">

          <strong>

            ${escapeHtml(
              getCustomerName(
                order
              )
            )}

          </strong>

          <br>

          ${escapeHtml(
            getCustomerEmail(
              order
            )
          )}

          ${
            getCustomerPhone(order)
              ? `
                <br>
                ${escapeHtml(
                  getCustomerPhone(
                    order
                  )
                )}
              `
              : ''
          }

          <br><br>

          ${escapeHtml(
            getShippingAddress(
              order
            )
          )}

        </div>

        <div class="seller-order-label">
          Shipment Tracking
        </div>

        <form class="shipment-form">

          <div class="shipment-field">

            <label>
              Fulfilment Status
            </label>

            <select class="shipment-status">

              <option
                value="processing"
                ${
                  currentStatus === 'processing'
                    ? 'selected'
                    : ''
                }
              >
                Processing
              </option>

              <option
                value="shipped"
                ${
                  currentStatus === 'shipped'
                    ? 'selected'
                    : ''
                }
              >
                Shipped
              </option>

              <option
                value="delivered"
                ${
                  currentStatus === 'delivered'
                    ? 'selected'
                    : ''
                }
              >
                Delivered
              </option>

            </select>

          </div>

          <div class="shipment-field">

            <label>
              Carrier / Courier
            </label>

            <input
              class="shipment-carrier"
              type="text"
              maxlength="100"
              placeholder="e.g. The Courier Guy"
              value="${escapeHtml(carrier)}"
            >

          </div>

          <div class="shipment-field">

            <label>
              Tracking Number
            </label>

            <input
              class="shipment-number"
              type="text"
              maxlength="150"
              placeholder="e.g. TCG123456"
              value="${escapeHtml(
                trackingNumber
              )}"
            >

          </div>

          <div class="shipment-field">

            <label>
              Tracking URL
            </label>

            <input
              class="shipment-url"
              type="url"
              maxlength="500"
              placeholder="https://..."
              value="${escapeHtml(
                trackingUrl
              )}"
            >

          </div>

          <div class="shipment-actions">

            <button
              class="btn-primary shipment-save"
              type="submit"
            >
              Save Tracking
            </button>

            <div
              class="shipment-message"
              aria-live="polite"
            ></div>

          </div>

        </form>

      </section>

    </div>

  `;


  const form =
    card.querySelector(
      '.shipment-form'
    );

  const statusInput =
    card.querySelector(
      '.shipment-status'
    );

  const carrierInput =
    card.querySelector(
      '.shipment-carrier'
    );

  const numberInput =
    card.querySelector(
      '.shipment-number'
    );

  const urlInput =
    card.querySelector(
      '.shipment-url'
    );

  const saveButton =
    card.querySelector(
      '.shipment-save'
    );

  const message =
    card.querySelector(
      '.shipment-message'
    );

  const pill =
    card.querySelector(
      '.seller-status-pill'
    );


  form.addEventListener(
    'submit',
    async (
      event
    ) => {

      event.preventDefault();

      message.textContent =
        '';

      const status =
        statusInput.value;

      const carrierValue =
        carrierInput.value
          .trim()
          .slice(
            0,
            100
          );

      const numberValue =
        numberInput.value
          .trim()
          .slice(
            0,
            150
          );

      const rawUrl =
        urlInput.value.trim();

      const cleanUrl =
        rawUrl
          ? safeUrl(rawUrl)
          : '';

      if (
        rawUrl &&
        !cleanUrl
      ) {

        message.style.color =
          '#d46f6f';

        message.textContent =
          'Tracking URL must use http:// or https://';

        return;

      }

      if (
        status === 'shipped'
        && !numberValue
      ) {

        message.style.color =
          '#d46f6f';

        message.textContent =
          'Add a tracking number before marking this order shipped.';

        return;

      }

      saveButton.disabled =
        true;

      saveButton.textContent =
        'Saving...';

      try {

        const shipmentRef =
          doc(
            db,
            'orders',
            order.id,
            'shipments',
            currentStoreId
          );

        const existing =
          await getDoc(
            shipmentRef
          );

        const payload = {

          storeId:
            currentStoreId,

          storeName:
            currentStore?.name ||
            'DWM Seller',

          status,

          carrier:
            carrierValue,

          trackingNumber:
            numberValue,

          trackingUrl:
            cleanUrl,

          updatedAt:
            serverTimestamp(),

          updatedBy:
            currentUser.uid

        };


        if (
          !existing.exists()
        ) {

          payload.createdAt =
            serverTimestamp();

        }


        if (
          status === 'shipped'
        ) {

          payload.shippedAt =
            serverTimestamp();

        }


        if (
          status === 'delivered'
        ) {

          payload.deliveredAt =
            serverTimestamp();

        }


        await setDoc(
          shipmentRef,
          payload,
          {
            merge: true
          }
        );


        pill.textContent =
          status.toUpperCase();


        message.style.color =
          'var(--teal-bright)';


        message.textContent =
          'Shipment updated.';


      } catch (error) {

        console.error(
          '[seller-orders] Shipment save error:',
          error
        );


        message.style.color =
          '#d46f6f';


        message.textContent =
          error?.message ||
          'Unable to update shipment.';


      } finally {

        saveButton.disabled =
          false;


        saveButton.textContent =
          'Save Tracking';

      }

    }
  );


  sellerOrders.appendChild(
    card
  );

}


async function loadOrders() {

  sellerOrders.innerHTML =
    '';


  ordersStatus.textContent =
    'Loading orders...';


  try {

    // TEMP DEBUG: prove whether this seller can read the known order directly.
    try {
      const debugOrder = await getDoc(
        doc(
          db,
          'orders',
          'CNiFi3NoqnCPqkyTs0ty'
        )
      );

      console.log(
        '[seller-orders] DIRECT ORDER READ:',
        debugOrder.exists(),
        debugOrder.exists()
          ? debugOrder.data()?.sellerUids
          : null
      );
    } catch (debugError) {
      console.error(
        '[seller-orders] DIRECT ORDER READ FAILED:',
        debugError.code,
        debugError.message
      );
    }

    const refsQuery =
      query(
        collection(
          db,
          'sellerOrderRefs'
        ),
        where(
          'sellerUid',
          '==',
          currentUser.uid
        )
      );


    const refsSnapshot =
      await getDocs(
        refsQuery
      );


    const orders =
      [];


    for (
      const refDoc
      of refsSnapshot.docs
    ) {

      const refData =
        refDoc.data() || {};


      if (
        !refData.orderId
      ) {
        continue;
      }


      const orderSnapshot =
        await getDoc(
          doc(
            db,
            'orders',
            refData.orderId
          )
        );


      if (
        !orderSnapshot.exists()
      ) {
        continue;
      }


      orders.push({
        id:
          orderSnapshot.id,

        ...orderSnapshot.data()
      });

    }


    orders.sort(
      (
        a,
        b
      ) => {

        const aTime =
          a.createdAt?.toMillis?.() ||
          0;


        const bTime =
          b.createdAt?.toMillis?.() ||
          0;


        return bTime -
          aTime;

      }
    );


    if (
      !orders.length
    ) {

      ordersStatus.textContent =
        '0 orders';


      sellerOrders.innerHTML = `

        <div class="seller-empty">

          No orders for this store yet.

        </div>

      `;


      return;

    }


    ordersStatus.textContent =
      `${orders.length} order${
        orders.length === 1
          ? ''
          : 's'
      }`;


    for (
      const order of orders
    ) {

      await renderOrder(
        order
      );

    }


  } catch (error) {

    console.error(
      '[seller-orders] Order load error:',
      error
    );


    ordersStatus.textContent =
      'Unable to load orders.';


    sellerOrders.innerHTML = `

      <div class="seller-empty">

        Seller orders could not be loaded.
        Check Firestore rules and the browser console.

      </div>

    `;

  }

}


requireReseller(
  async (
    user,
    profile
  ) => {

    currentUser =
      user;


    try {

      currentStoreId =
        profile?.storeId ||
        null;


      if (
        !currentStoreId
      ) {

        sellerOrdersIntro.textContent =
          'Your reseller account does not have a store assigned.';


        ordersStatus.textContent =
          'No store assigned.';


        return;

      }


      const storeSnapshot =
        await getDoc(
          doc(
            db,
            'stores',
            currentStoreId
          )
        );


      if (
        !storeSnapshot.exists()
      ) {

        throw new Error(
          'Store not found.'
        );

      }


      currentStore = {

        id:
          storeSnapshot.id,

        ...storeSnapshot.data()

      };


      if (
        profile.role !== 'admin'
        && currentStore.ownerUid !== user.uid
      ) {

        console.error(
          '[seller-orders] Store ownership mismatch.'
        );


        window.location.href =
          '/account.html';


        return;

      }


      sellerOrdersIntro.textContent =
        `Incoming purchases for ${
          currentStore.name ||
          'your store'
        }. Update fulfilment and shipment tracking here.`;


      await loadOrders();


    } catch (error) {

      console.error(
        '[seller-orders] Startup error:',
        error
      );


      sellerOrdersIntro.textContent =
        'Unable to load your seller order dashboard.';


      ordersStatus.textContent =
        'Something went wrong.';

    }

  }
);