import {
  doc,
  getDoc
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


/* =========================================================
   DOM
========================================================= */

const root =
  document.getElementById(
    'orderRoot'
  );


/* =========================================================
   INIT
========================================================= */

async function init() {

  try {

    renderNav('nav');

  } catch (error) {

    console.error(
      'Unable to render navigation:',
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


  const params =
    new URLSearchParams(
      window.location.search
    );


  const orderId =
    params.get(
      'order'
    );


  if (!orderId) {

    renderError(
      'Order not found.',
      'No order reference was supplied.'
    );

    return;

  }


  try {

    const orderRef =
      doc(
        db,
        'orders',
        orderId
      );


    const snap =
      await getDoc(
        orderRef
      );


    if (!snap.exists()) {

      renderError(
        'Order not found.',
        'This order does not exist or is no longer available.'
      );

      return;

    }


    const order =
      snap.data();


    /*
      Do not expose somebody else's order.

      Firestore rules should already block
      this, but we also enforce it in UI.
    */

    if (
      order.customerUid !==
      user.uid
    ) {

      renderError(
        'Access denied.',
        'This order does not belong to your account.'
      );

      return;

    }


    renderOrder(
      order
    );

  } catch (error) {

    console.error(
      'Unable to load order:',
      error
    );


    renderError(
      'Unable to load your order.',
      'Refresh the page and try again.'
    );

  }

}


/* =========================================================
   ORDER RENDER
========================================================= */

function renderOrder(
  order
) {

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  const customer =
    order.customer || {};


  const shipping =
    order.shipping || {};


  const address =
    shipping.address || {};


  const orderReference =
    order.orderReference ||
    'DWM ORDER';


  const paymentStatus =
    String(
      order.paymentStatus ||
      'pending'
    ).toLowerCase();


  const fulfilmentStatus =
    String(
      order.fulfilmentStatus ||
      'pending'
    ).toLowerCase();


  const orderStatus =
    String(
      order.orderStatus ||
      'pending_payment'
    ).toLowerCase();


  const itemsHtml =
    items.length
      ? items
          .map(
            (
              item
            ) =>
              renderItem(
                item
              )
          )
          .join('')
      : `
        <div class="detail-copy">
          No products were found on this order.
        </div>
      `;


  root.className =
    'order-layout';


  root.innerHTML = `

    <section class="panel">

      <div class="panel-head">

        <div class="panel-label">
          Order
        </div>

        <h2 class="panel-title">
          Your Pieces
        </h2>

      </div>


      <div class="panel-body">

        <div class="order-reference">

          <div class="reference-label">
            DWM Order Reference
          </div>

          <div class="reference-value">
            ${escapeHtml(
              orderReference
            )}
          </div>

        </div>


        <div class="items">
          ${itemsHtml}
        </div>


        <div class="totals">

          <div class="row">

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


          <div class="row">

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


          <div class="row final">

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

      </div>

    </section>


    <aside class="panel">

      <div class="panel-head">

        <div class="panel-label">
          Status
        </div>

        <h2 class="panel-title">
          Order Details
        </h2>

      </div>


      <div class="panel-body">

        <div class="status-grid">

          ${renderStatus(
            'Payment',
            paymentStatus
          )}

          ${renderStatus(
            'Fulfilment',
            fulfilmentStatus
          )}

        </div>


        <div class="details">

          <div class="detail-group">

            <div class="detail-title">
              Order Status
            </div>

            <div class="detail-copy">
              ${escapeHtml(
                humanizeStatus(
                  orderStatus
                )
              )}
            </div>

          </div>


          <div class="detail-group">

            <div class="detail-title">
              Customer
            </div>

            <div class="detail-copy">

              ${escapeHtml(
                [
                  customer.firstName,
                  customer.lastName
                ]
                  .filter(Boolean)
                  .join(' ')
              )}

              <br>

              ${escapeHtml(
                customer.email ||
                ''
              )}

              <br>

              ${escapeHtml(
                customer.phone ||
                ''
              )}

            </div>

          </div>


          <div class="detail-group">

            <div class="detail-title">
              Delivery Address
            </div>

            <div class="detail-copy">

              ${escapeHtml(
                address.address1 ||
                ''
              )}

              ${
                address.address2
                  ? `
                    <br>
                    ${escapeHtml(
                      address.address2
                    )}
                  `
                  : ''
              }

              <br>

              ${escapeHtml(
                [
                  address.city,
                  address.province
                ]
                  .filter(Boolean)
                  .join(', ')
              )}

              <br>

              ${escapeHtml(
                address.postalCode ||
                ''
              )}

              <br>

              ${escapeHtml(
                address.country ||
                'South Africa'
              )}

            </div>

          </div>


          <div class="detail-group">

            <div class="detail-title">
              Shipping Method
            </div>

            <div class="detail-copy">
              ${escapeHtml(
                humanizeStatus(
                  shipping.method ||
                  'standard'
                )
              )}
              Delivery
            </div>

          </div>

        </div>


        <div class="payment-warning">

          Payment status is currently
          <strong>
            ${escapeHtml(
              paymentStatus.toUpperCase()
            )}
          </strong>.

          This test-order phase does not
          charge your card or bank account.

        </div>


        <div class="actions">

          <a
            class="action primary"
            href="/shop.html"
          >
            Continue Shopping
          </a>

          <a
            class="action"
            href="/account.html"
          >
            My Account
          </a>

        </div>

      </div>

    </aside>

  `;

}


/* =========================================================
   ITEM
========================================================= */

function renderItem(
  item
) {

  const name =
    item?.name ||
    'Untitled Product';


  const imageUrl =
    item?.imageUrl ||
    '/assets/img/dwm-logo-new.png';


  const storeName =
    item?.storeName ||
    'DWM Store';


  const quantity =
    Number(
      item?.quantity
    ) || 0;


  const unitPrice =
    Number(
      item?.unitPrice
    ) || 0;


  const lineTotal =
    Number(
      item?.lineTotal
    ) || 0;


  return `

    <article class="item">

      <div class="item-image">

        <img
          src="${escapeAttr(
            imageUrl
          )}"

          alt="${escapeAttr(
            name
          )}"

          onerror="
            this.onerror=null;
            this.src='/assets/img/dwm-logo-new.png';
          "
        >

      </div>


      <div>

        <div class="item-name">
          ${escapeHtml(
            name
          )}
        </div>

        <div class="item-store">
          Sold by
          ${escapeHtml(
            storeName
          )}
        </div>

        <div class="item-meta">

          Qty
          ${quantity}

          ×

          ${escapeHtml(
            formatZARPrice(
              unitPrice
            )
          )}

        </div>

        <div class="item-total">

          ${escapeHtml(
            formatZARPrice(
              lineTotal
            )
          )}

        </div>

      </div>

    </article>

  `;

}


/* =========================================================
   STATUS
========================================================= */

function renderStatus(
  label,
  status
) {

  return `

    <div class="status-box">

      <div class="status-label">
        ${escapeHtml(
          label
        )}
      </div>

      <div
        class="
          status-value
          ${statusClass(status)}
        "
      >
        ${escapeHtml(
          humanizeStatus(
            status
          )
        )}
      </div>

    </div>

  `;

}


function statusClass(
  status
) {

  const s =
    String(
      status || ''
    ).toLowerCase();


  if (
    s === 'paid' ||
    s === 'delivered'
  ) {

    return (
      `status-${s}`
    );

  }


  if (
    s === 'failed' ||
    s === 'cancelled'
  ) {

    return (
      `status-${s}`
    );

  }


  return 'status-pending';

}


function humanizeStatus(
  value
) {

  return String(
    value ||
    ''
  )

    .replace(
      /_/g,
      ' '
    )

    .replace(
      /\b\w/g,
      (
        letter
      ) =>
        letter.toUpperCase()
    );

}


/* =========================================================
   ERROR
========================================================= */

function renderError(
  title,
  message
) {

  root.className =
    'error';


  root.innerHTML = `

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

    <br>

    <a
      href="/shop.html"
      style="
        color:var(--teal-bright);
        text-decoration:none;
      "
    >
      Return to Shop
    </a>

  `;

}


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


  return String(
    value
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