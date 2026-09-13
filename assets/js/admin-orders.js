import {
  db
} from './firebase-config.js';

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';

import {
  requireAdmin
} from './auth.js';

import {
  renderNav
} from './nav.js';


renderNav('nav');


const ordersRoot =
  document.getElementById('adminOrders');

const statusEl =
  document.getElementById('adminOrdersStatus');

const searchEl =
  document.getElementById('orderSearch');

const filterEl =
  document.getElementById('orderFilter');

const refreshButton =
  document.getElementById('refreshOrders');


let currentAdmin = null;
let allOrders = [];


function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function money(value) {
  return new Intl.NumberFormat(
    'en-ZA',
    {
      style: 'currency',
      currency: 'ZAR'
    }
  ).format(Number(value || 0));
}


function formatDate(value) {

  if (!value) return 'Date unavailable';

  const date =
    typeof value.toDate === 'function'
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
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


function timestampValue(value) {

  if (!value) return 0;

  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  return new Date(value).getTime() || 0;
}


function customerName(order) {

  const customer = order.customer || {};

  return (
    `${customer.firstName || customer.name || ''} ${customer.lastName || ''}`.trim()
    || 'DWM Customer'
  );
}


function shippingAddress(order) {

  const s = order.shipping || {};

  const a =
    s.address &&
    typeof s.address === 'object'
      ? s.address
      : {};

  return [
    a.address1 || s.addressLine1 || s.address1 || s.streetAddress,
    a.address2 || s.addressLine2 || s.address2,
    a.city || s.city,
    a.province || s.province || s.state,
    a.postalCode || s.postalCode || s.zipCode,
    a.country || s.country
  ]
    .filter(Boolean)
    .join(', ') || 'Address unavailable';
}


function renderItem(item) {

  const image =
    item.imageUrl ||
    '/assets/img/dwm-logo-new.webp';

  const quantity =
    Math.max(1, Number(item.quantity || 1));

  const price =
    Number(item.unitPrice ?? item.price ?? 0);

  return `
    <div class="admin-item">

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

        <strong>
          ${escapeHtml(item.name || 'DWM Product')}
        </strong>

        <div class="admin-muted">
          Qty ${quantity}
          × ${escapeHtml(money(price))}
          ${item.storeId
            ? ` · Store ${escapeHtml(item.storeId)}`
            : ''}
        </div>

      </div>

    </div>
  `;
}


async function loadShipments(orderId) {

  const snap =
    await getDocs(
      collection(
        db,
        'orders',
        orderId,
        'shipments'
      )
    );

  const map = {};

  snap.forEach(
    shipment => {
      map[shipment.id] = {
        id: shipment.id,
        ...shipment.data()
      };
    }
  );

  return map;
}


function shipmentEditor(
  order,
  storeId,
  shipment = {}
) {

  const status =
    shipment.status || 'processing';

  return `
    <div
      class="shipment-admin"
      data-store-id="${escapeHtml(storeId)}"
    >

      <div class="admin-label">
        Shipment — ${escapeHtml(storeId)}
      </div>

      <div class="shipment-grid">

        <div>
          <label>Status</label>

          <select class="shipment-status">
            <option value="processing" ${status === 'processing' ? 'selected' : ''}>
              Processing
            </option>

            <option value="shipped" ${status === 'shipped' ? 'selected' : ''}>
              Shipped
            </option>

            <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>
              Delivered
            </option>
          </select>
        </div>

        <div>
          <label>Courier</label>

          <input
            class="shipment-carrier"
            value="${escapeHtml(shipment.carrier || '')}"
            placeholder="The Courier Guy"
          >
        </div>

        <div>
          <label>Tracking Number</label>

          <input
            class="shipment-number"
            value="${escapeHtml(shipment.trackingNumber || '')}"
            placeholder="Tracking number"
          >
        </div>

        <div>
          <label>Tracking URL</label>

          <input
            class="shipment-url"
            value="${escapeHtml(shipment.trackingUrl || '')}"
            placeholder="https://..."
          >
        </div>

      </div>

      <div class="admin-actions">

        <button
          type="button"
          class="btn-primary shipment-save"
        >
          Save Shipment
        </button>

        <span class="admin-message"></span>

      </div>

    </div>
  `;
}


async function renderOrder(order) {

  const card =
    document.createElement('article');

  card.className = 'admin-order';


  let shipments = {};

  try {
    shipments =
      await loadShipments(order.id);
  } catch (error) {
    console.error(
      '[admin-orders] Shipment load failed:',
      error
    );
  }


  const stores =
    Array.isArray(order.storeIds)
      ? order.storeIds
      : [];


  const items =
    Array.isArray(order.items)
      ? order.items
      : [];


  card.innerHTML = `

    <div class="admin-order-head">

      <div>

        <div class="admin-label">
          DWM Order
        </div>

        <div class="admin-order-ref">
          ${escapeHtml(
            order.orderReference ||
            order.id
          )}
        </div>

        <div class="admin-order-date">
          ${escapeHtml(
            formatDate(order.createdAt)
          )}
        </div>

      </div>

      <div class="admin-order-total">
        ${escapeHtml(
          money(order.total)
        )}
      </div>

    </div>


    <div class="admin-order-grid">

      <section class="admin-order-section">

        <div class="admin-label">
          Items
        </div>

        ${
          items.length
            ? items.map(renderItem).join('')
            : '<div class="admin-muted">No item data.</div>'
        }


        <div
          class="admin-muted"
          style="
            margin-top:18px;
            padding-top:18px;
            border-top:1px solid rgba(255,255,255,.1);
          "
        >
          Subtotal:
          <strong>${escapeHtml(money(order.subtotal))}</strong>
          <br>

          Shipping:
          <strong>${escapeHtml(money(order.shippingTotal))}</strong>
          <br>

          Total:
          <strong>${escapeHtml(money(order.total))}</strong>
        </div>

      </section>


      <section class="admin-order-section">

        <div class="admin-label">
          Customer
        </div>

        <div class="admin-muted">

          <strong>
            ${escapeHtml(
              customerName(order)
            )}
          </strong>

          <br>

          ${escapeHtml(
            order.customer?.email || ''
          )}

          ${
            order.customer?.phone ||
            order.shipping?.phone
              ? `
                <br>
                ${escapeHtml(
                  order.customer?.phone ||
                  order.shipping?.phone
                )}
              `
              : ''
          }

          <br><br>

          ${escapeHtml(
            shippingAddress(order)
          )}

        </div>


        <div
          class="admin-label"
          style="margin-top:24px;"
        >
          Order Control
        </div>


        <div class="admin-controls">

          <div class="admin-controls-grid">

            <div>
              <label>Payment</label>

              <select class="payment-status">
                ${[
                  'pending',
                  'paid',
                  'failed',
                  'refunded'
                ].map(
                  value => `
                    <option
                      value="${value}"
                      ${order.paymentStatus === value ? 'selected' : ''}
                    >
                      ${value.replaceAll('_', ' ')}
                    </option>
                  `
                ).join('')}
              </select>
            </div>


            <div>
              <label>Fulfilment</label>

              <select class="fulfilment-status">
                ${[
                  'pending',
                  'processing',
                  'shipped',
                  'delivered',
                  'cancelled'
                ].map(
                  value => `
                    <option
                      value="${value}"
                      ${order.fulfilmentStatus === value ? 'selected' : ''}
                    >
                      ${value.replaceAll('_', ' ')}
                    </option>
                  `
                ).join('')}
              </select>
            </div>


            <div>
              <label>Order Status</label>

              <select class="order-status">
                ${[
                  'pending_payment',
                  'confirmed',
                  'processing',
                  'shipped',
                  'completed',
                  'cancelled',
                  'refunded'
                ].map(
                  value => `
                    <option
                      value="${value}"
                      ${order.orderStatus === value ? 'selected' : ''}
                    >
                      ${value.replaceAll('_', ' ')}
                    </option>
                  `
                ).join('')}
              </select>
            </div>

          </div>


          <div class="admin-actions">

            <button
              type="button"
              class="btn-primary save-order"
            >
              Save Order
            </button>

            <span class="admin-message order-message"></span>

          </div>

        </div>


        ${
          stores.length
            ? stores
                .map(
                  storeId =>
                    shipmentEditor(
                      order,
                      storeId,
                      shipments[storeId] || {}
                    )
                )
                .join('')
            : ''
        }

      </section>

    </div>
  `;


  const saveOrder =
    card.querySelector('.save-order');

  const orderMessage =
    card.querySelector('.order-message');


  saveOrder.addEventListener(
    'click',
    async () => {

      saveOrder.disabled = true;
      orderMessage.textContent = 'Saving...';

      try {

        const paymentStatus =
          card.querySelector(
            '.payment-status'
          ).value;

        const fulfilmentStatus =
          card.querySelector(
            '.fulfilment-status'
          ).value;

        const orderStatus =
          card.querySelector(
            '.order-status'
          ).value;


        await updateDoc(
          doc(
            db,
            'orders',
            order.id
          ),
          {
            paymentStatus,
            fulfilmentStatus,
            orderStatus,
            updatedAt:
              serverTimestamp()
          }
        );


        order.paymentStatus =
          paymentStatus;

        order.fulfilmentStatus =
          fulfilmentStatus;

        order.orderStatus =
          orderStatus;


        orderMessage.textContent =
          'Saved ✓';

        updateStats();

      } catch (error) {

        console.error(
          '[admin-orders] Order update failed:',
          error
        );

        orderMessage.textContent =
          'Save failed';

      } finally {

        saveOrder.disabled = false;

      }

    }
  );


  card
    .querySelectorAll(
      '.shipment-admin'
    )
    .forEach(
      section => {

        const save =
          section.querySelector(
            '.shipment-save'
          );

        const message =
          section.querySelector(
            '.admin-message'
          );


        save.addEventListener(
          'click',
          async () => {

            const storeId =
              section.dataset.storeId;

            save.disabled = true;
            message.textContent =
              'Saving...';

            try {

              await setDoc(
                doc(
                  db,
                  'orders',
                  order.id,
                  'shipments',
                  storeId
                ),
                {
                  storeId,

                  status:
                    section.querySelector(
                      '.shipment-status'
                    ).value,

                  carrier:
                    section.querySelector(
                      '.shipment-carrier'
                    ).value.trim(),

                  trackingNumber:
                    section.querySelector(
                      '.shipment-number'
                    ).value.trim(),

                  trackingUrl:
                    section.querySelector(
                      '.shipment-url'
                    ).value.trim(),

                  updatedBy:
                    currentAdmin.uid,

                  updatedAt:
                    serverTimestamp()
                },
                {
                  merge: true
                }
              );

              message.textContent =
                'Shipment saved ✓';

            } catch (error) {

              console.error(
                '[admin-orders] Shipment save failed:',
                error
              );

              message.textContent =
                'Save failed';

            } finally {

              save.disabled = false;

            }

          }
        );

      }
    );


  ordersRoot.appendChild(card);
}


function updateStats() {

  document.getElementById(
    'statTotal'
  ).textContent =
    allOrders.length;


  document.getElementById(
    'statPending'
  ).textContent =
    allOrders.filter(
      order =>
        order.paymentStatus === 'pending'
    ).length;


  document.getElementById(
    'statProcessing'
  ).textContent =
    allOrders.filter(
      order =>
        order.fulfilmentStatus === 'processing'
        ||
        order.orderStatus === 'processing'
    ).length;


  document.getElementById(
    'statCompleted'
  ).textContent =
    allOrders.filter(
      order =>
        order.orderStatus === 'completed'
        ||
        order.fulfilmentStatus === 'delivered'
    ).length;
}


async function renderOrders() {

  const search =
    searchEl.value
      .trim()
      .toLowerCase();

  const filter =
    filterEl.value;


  const visible =
    allOrders.filter(
      order => {

        const haystack = [
          order.orderReference,
          order.id,
          customerName(order),
          order.customer?.email
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();


        const matchesSearch =
          !search ||
          haystack.includes(search);


        const matchesFilter =
          filter === 'all'
          ||
          order.orderStatus === filter
          ||
          order.fulfilmentStatus === filter
          ||
          order.paymentStatus === filter;


        return (
          matchesSearch &&
          matchesFilter
        );

      }
    );


  ordersRoot.innerHTML = '';


  if (!visible.length) {

    ordersRoot.innerHTML = `
      <div class="admin-empty">
        No matching orders.
      </div>
    `;

    statusEl.textContent =
      `${visible.length} orders shown`;

    return;

  }


  for (const order of visible) {
    await renderOrder(order);
  }


  statusEl.textContent =
    `${visible.length} order${visible.length === 1 ? '' : 's'} shown`;
}


async function loadOrders() {

  refreshButton.disabled = true;

  statusEl.textContent =
    'Loading orders...';

  ordersRoot.innerHTML = '';


  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          'orders'
        )
      );


    allOrders =
      snapshot.docs
        .map(
          snap => ({
            id: snap.id,
            ...snap.data()
          })
        )
        .sort(
          (a, b) =>
            timestampValue(
              b.createdAt
            )
            -
            timestampValue(
              a.createdAt
            )
        );


    updateStats();

    await renderOrders();

  } catch (error) {

    console.error(
      '[admin-orders] Load failed:',
      error
    );

    statusEl.textContent =
      'Unable to load orders.';

  } finally {

    refreshButton.disabled = false;

  }

}


searchEl.addEventListener(
  'input',
  renderOrders
);


filterEl.addEventListener(
  'change',
  renderOrders
);


refreshButton.addEventListener(
  'click',
  loadOrders
);


requireAdmin(
  async user => {

    currentAdmin = user;

    await loadOrders();

  }
);
