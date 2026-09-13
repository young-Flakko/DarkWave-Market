import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import {
  db
} from './firebase-config.js';

import {
  getCurrentUser
} from './auth.js';

import {
  renderNav
} from './nav.js';

import {
  formatZARPrice
} from './data.js';


const root =
  document.getElementById(
    'ordersRoot'
  );


async function init() {

  try {
    renderNav('nav');
  } catch (error) {
    console.error(
      'Nav error:',
      error
    );
  }


  const user =
    await getCurrentUser();


  if (!user) {

    window.location.href =
      '/login.html';

    return;

  }


  try {

    /*
      Query must include customerUid
      because Firestore rules are not filters.
    */

    const q =
      query(
        collection(
          db,
          'orders'
        ),
        where(
          'customerUid',
          '==',
          user.uid
        )
      );


    const snap =
      await getDocs(q);


    const orders =
      snap.docs.map(
        (document) => ({
          id:
            document.id,

          data:
            document.data()
        })
      );


    /*
      Load shipment documents for every customer order.

      Shipment architecture:
      orders/{orderId}/shipments/{storeId}

      Sellers write only their own shipment document.
      Customers read those shipment documents here.
    */

    await Promise.all(
      orders.map(
        async (order) => {

          try {

            const shipmentSnap =
              await getDocs(
                collection(
                  db,
                  'orders',
                  order.id,
                  'shipments'
                )
              );


            order.data.shipments =
              shipmentSnap.docs.map(
                (shipmentDocument) => ({
                  id:
                    shipmentDocument.id,

                  ...shipmentDocument.data()
                })
              );

          } catch (error) {

            console.error(
              '[my-orders] Shipment load error:',
              order.id,
              error
            );


            /*
              Do not kill the entire My Orders page
              if one shipment cannot be loaded.
            */

            order.data.shipments = [];

          }

        }
      )
    );


    orders.sort(
      (a, b) =>
        getDateMillis(
          b.data.createdAt
        ) -
        getDateMillis(
          a.data.createdAt
        )
    );


    renderOrders(
      orders
    );

  } catch (error) {

    console.error(
      'Unable to fetch orders:',
      error
    );


    renderState(
      'Unable to load orders',
      'Refresh the page and try again.'
    );

  }

}


function renderOrders(
  orders
) {

  if (
    !orders.length
  ) {

    root.innerHTML = `
      <div class="state">

        <h2>
          No orders yet.
        </h2>

        <p>
          Your Dark Wave purchases will appear here.
        </p>

        <br>

        <a
          href="/shop.html"
          style="
            color:var(--teal-bright);
            text-decoration:none;
          "
        >
          Enter the Shop
        </a>

      </div>
    `;

    return;

  }


  root.innerHTML =
    orders
      .map(
        renderOrder
      )
      .join('');

}


function renderOrder(
  orderRecord
) {

  const order =
    orderRecord.data || {};


  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  const reference =
    order.orderReference ||
    orderRecord.id;


  const payment =
    String(
      order.paymentStatus ||
      'pending'
    ).toLowerCase();


  const fulfilment =
    String(
      order.fulfilmentStatus ||
      'pending'
    ).toLowerCase();


  return `

    <article class="order">

      <header class="order-head">

        <div>

          <div class="reference-label">
            DWM Order
          </div>

          <div class="reference">
            ${escapeHtml(
              reference
            )}
          </div>

          <div class="order-date">
            ${escapeHtml(
              formatDate(
                order.createdAt
              )
            )}
          </div>

        </div>


        <div class="statuses">

          <span
            class="
              pill
              ${statusClass(payment)}
            "
          >
            Payment:
            ${escapeHtml(
              humanize(payment)
            )}
          </span>

          <span
            class="
              pill
              ${statusClass(fulfilment)}
            "
          >
            Order:
            ${escapeHtml(
              humanize(
                fulfilment
              )
            )}
          </span>

        </div>

      </header>


      <div class="order-body">

        <div class="items">

          ${
            items.length
              ? items
                  .map(
                    renderItem
                  )
                  .join('')
              : `
                <div>
                  No items found.
                </div>
              `
          }

        </div>


        <aside class="side">

          <div class="side-title">
            Shipment Tracking
          </div>


          <div class="tracking-list">

            ${renderShipments(
              order
            )}

          </div>


          <div class="totals">

            <div class="total-row">

              <span>
                Subtotal
              </span>

              <strong>
                ${escapeHtml(
                  formatZARPrice(
                    order.subtotal || 0
                  )
                )}
              </strong>

            </div>


            <div class="total-row">

              <span>
                Shipping
              </span>

              <strong>
                ${escapeHtml(
                  formatZARPrice(
                    order.shippingTotal || 0
                  )
                )}
              </strong>

            </div>


            <div class="total-row final">

              <span>
                Total
              </span>

              <strong>
                ${escapeHtml(
                  formatZARPrice(
                    order.total || 0
                  )
                )}
              </strong>

            </div>

          </div>

        </aside>

      </div>


      <div class="order-actions">

        <a
          class="btn"
          href="/order-success.html?order=${encodeURIComponent(
            orderRecord.id
          )}"
        >
          View Order
        </a>

        <a
          class="btn"
          href="/shop.html"
        >
          Shop
        </a>

      </div>

    </article>

  `;

}


function renderItem(
  item
) {

  const image =
    item?.imageUrl ||
    '/assets/img/dwm-logo-new.webp';


  return `

    <div class="item">

      <div class="item-image">

        <img
          src="${escapeAttr(
            image
          )}"

          alt="${escapeAttr(
            item?.name ||
            'Product'
          )}"

          onerror="
            this.onerror=null;
            this.src='/assets/img/dwm-logo-new.webp';
          "
        >

      </div>


      <div>

        <div class="item-name">
          ${escapeHtml(
            item?.name ||
            'Product'
          )}
        </div>

        <div class="item-store">
          Sold by
          ${escapeHtml(
            item?.storeName ||
            'DWM Store'
          )}
        </div>

        <div class="item-meta">

          Qty
          ${Number(
            item?.quantity
          ) || 0}

          ×

          ${escapeHtml(
            formatZARPrice(
              item?.unitPrice ||
              0
            )
          )}

        </div>

      </div>

    </div>

  `;

}


/* =========================================================
   TRACKING
========================================================= */

function renderShipments(
  order
) {

  /*
    FUTURE / SELLER ORDERS FORMAT:

    shipments: [
      {
        storeId: "...",
        storeName: "Sneaker Wave",
        status: "shipped",
        carrier: "The Courier Guy",
        trackingNumber: "TCG123456",
        trackingUrl: "https://...",
        shippedAt: ...
      }
    ]

    This means one checkout can have multiple
    sellers and multiple parcels.
  */

  const shipments =
    Array.isArray(
      order.shipments
    )
      ? order.shipments
      : [];


  if (
    shipments.length
  ) {

    return shipments
      .map(
        renderShipment
      )
      .join('');

  }


  /*
    No shipment assigned yet.

    Build placeholders per seller so customers
    can still see who is responsible.
  */

  const stores =
    Array.isArray(
      order.storeBreakdown
    )
      ? order.storeBreakdown
      : [];


  if (
    stores.length
  ) {

    return stores
      .map(
        (store) => `

          <div class="shipment">

            <div class="shipment-store">
              ${escapeHtml(
                store.storeName ||
                'DWM Store'
              )}
            </div>

            <div class="shipment-status">
              Awaiting shipment
            </div>

            <div class="carrier">
              Tracking will appear here once
              the seller dispatches your order.
            </div>

          </div>

        `
      )
      .join('');

  }


  return `

    <div class="shipment">

      <div class="shipment-store">
        Dark Wave Market
      </div>

      <div class="shipment-status">
        Awaiting shipment
      </div>

    </div>

  `;

}


function renderShipment(
  shipment
) {

  const status =
    String(
      shipment?.status ||
      'processing'
    );


  const carrier =
    shipment?.carrier ||
    'Carrier pending';


  const trackingNumber =
    shipment?.trackingNumber ||
    '';


  const trackingUrl =
    safeTrackingUrl(
      shipment?.trackingUrl
    );


  return `

    <div class="shipment">

      <div class="shipment-store">

        ${escapeHtml(
          shipment?.storeName ||
          'DWM Store'
        )}

      </div>


      <div class="shipment-status">

        ${escapeHtml(
          humanize(
            status
          )
        )}

      </div>


      <div class="carrier">

        Carrier:
        ${escapeHtml(
          carrier
        )}

      </div>


      ${
        trackingNumber
          ? `

            <div class="tracking-code">
              ${escapeHtml(
                trackingNumber
              )}
            </div>

          `
          : ''
      }


      ${
        trackingUrl
          ? `

            <a
              class="track-link"
              href="${escapeAttr(
                trackingUrl
              )}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Track Package →
            </a>

          `
          : ''
      }

    </div>

  `;

}


function safeTrackingUrl(
  value
) {

  if (
    !value ||
    typeof value !==
      'string'
  ) {
    return null;
  }


  try {

    const url =
      new URL(value);


    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return null;
    }


    return url.href;

  } catch {

    return null;

  }

}


/* =========================================================
   HELPERS
========================================================= */

function getDateMillis(
  timestamp
) {

  if (!timestamp) {
    return 0;
  }


  if (
    typeof timestamp.toMillis ===
    'function'
  ) {

    return timestamp.toMillis();

  }


  if (
    timestamp.seconds !==
    undefined
  ) {

    return (
      Number(
        timestamp.seconds
      ) * 1000
    );

  }


  return (
    new Date(
      timestamp
    ).getTime() || 0
  );

}


function formatDate(
  timestamp
) {

  const milliseconds =
    getDateMillis(
      timestamp
    );


  if (!milliseconds) {
    return 'Order date unavailable';
  }


  return new Date(
    milliseconds
  ).toLocaleString(
    'en-ZA',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short'
    }
  );

}


function humanize(
  value
) {

  return String(
    value || ''
  )

    .replace(
      /_/g,
      ' '
    )

    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );

}


function statusClass(
  status
) {

  const value =
    String(
      status || ''
    ).toLowerCase();


  if (
    [
      'paid',
      'shipped',
      'delivered',
      'complete',
      'completed'
    ].includes(value)
  ) {

    return 'good';

  }


  if (
    [
      'cancelled',
      'failed',
      'refunded'
    ].includes(value)
  ) {

    return 'bad';

  }


  return 'pending';

}


function renderState(
  title,
  message
) {

  root.innerHTML = `

    <div class="state">

      <h2>
        ${escapeHtml(
          title
        )}
      </h2>

      <p>
        ${escapeHtml(
          message
        )}
      </p>

    </div>

  `;

}


function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )

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