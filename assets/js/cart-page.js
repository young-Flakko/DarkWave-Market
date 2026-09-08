 import { renderNav } from './nav.js';

import {
  CART_EVENT,
  findCartItem,
  formatZARPrice,
  getCart,
  getCartCount,
  getCartSubtotal,
  removeFromCart,
  updateCartQuantity
} from './cart.js';

import {
  fetchActiveStoresByIds,
  makeStateBlock
} from './data.js';

import { db } from './firebase-config.js';
import { doc, getDoc } from 'firebase/firestore';

renderNav('nav');

function setBodyHtml(html) {
  const slot = document.getElementById('cartBody');
  if (slot) slot.innerHTML = html;
}

function setSubtitle(text) {
  const el = document.getElementById('cartSubtitle');
  if (el) el.textContent = text || '';
}

function esc(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStock(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

async function fetchProductInventory(productId) {
  try {
    const snap = await getDoc(
      doc(db, 'products', productId)
    );

    if (!snap.exists()) {
      return {
        ok: true,
        exists: false,
        stock: 0,
        status: 'missing'
      };
    }

    const data = snap.data() || {};

    return {
      ok: true,
      exists: true,
      stock: normalizeStock(data.stock),
      status: String(data.status || 'draft')
    };
  } catch (err) {
    console.warn(
      `[cart-page.js] Unable to verify inventory for ${productId}.`,
      err
    );

    return {
      ok: false,
      exists: null,
      stock: null,
      status: null
    };
  }
}

async function fetchInventoryMap(items) {
  const entries = await Promise.all(
    items.map(async (item) => [
      item.productId,
      await fetchProductInventory(item.productId)
    ])
  );

  return new Map(entries);
}

function renderEmptyState() {
  setSubtitle(
    'Your cart is currently empty. Browse the marketplace to start building your order.'
  );

  const block = makeStateBlock(
    'empty',
    'No items in your cart yet.',
    'Explore the latest drops, discover new stores, and add pieces to your order. The wave is waiting.',
    {
      eyebrow: '— Empty Cart —'
    }
  );

  setBodyHtml(`
    <div style="max-width:720px;margin:0 auto;">
      ${block}

      <div style="margin-top:28px;text-align:center;">
        <a
          href="drops.html"
          class="btn-primary"
          style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            padding:14px 28px;
            font-size:.7rem;
            font-weight:700;
            letter-spacing:.3em;
            text-transform:uppercase;
            text-decoration:none;
          "
        >
          Continue Shopping
        </a>
      </div>
    </div>
  `);
}

async function renderCart() {
  let items = getCart();

  if (!items.length) {
    renderEmptyState();
    return;
  }

  const inventoryMap =
    await fetchInventoryMap(items);

  let cartWasAdjusted = false;

  for (const row of [...items]) {
    const inventory =
      inventoryMap.get(row.productId);

    if (!inventory || !inventory.ok) {
      continue;
    }

    if (
      !inventory.exists ||
      inventory.status !== 'live' ||
      inventory.stock <= 0
    ) {
      removeFromCart(row.productId);
      cartWasAdjusted = true;
      continue;
    }

    if (
      row.quantity >
      inventory.stock
    ) {
      updateCartQuantity(
        row.productId,
        inventory.stock,
        {
          availableStock:
            inventory.stock
        }
      );

      cartWasAdjusted = true;
    }
  }

  if (cartWasAdjusted) {
    items = getCart();

    if (!items.length) {
      renderEmptyState();
      return;
    }
  }

  const count =
    getCartCount(items);

  const subtotal =
    getCartSubtotal(items);

  setSubtitle(
    `${count} item${count === 1 ? '' : 's'} from the marketplace ready for checkout preview.`
  );

  const storeIds = items
    .map((item) =>
      typeof item.storeId === 'string'
        ? item.storeId
        : null
    )
    .filter(Boolean);

  let storeMap =
    new Map();

  try {
    storeMap =
      await fetchActiveStoresByIds(
        storeIds
      );
  } catch (err) {
    console.warn(
      '[cart-page.js] Store lookup failed.',
      err
    );
  }

  const itemsHtml = items
    .map((row) => {
      const pid =
        String(row.productId);

      const inventory =
        inventoryMap.get(pid);

      const knownStock =
        inventory &&
        inventory.ok &&
        inventory.exists &&
        inventory.status === 'live'
          ? inventory.stock
          : null;

      const imgUrl =
        row.imageUrl ||
        '/assets/img/dwm-logo-new.png';

      const unitPrice =
        Number.isFinite(
          Number(row.price)
        )
          ? Number(row.price)
          : 0;

      const lineTotal =
        Math.round(
          unitPrice *
          row.quantity *
          100
        ) / 100;

      const store =
        storeMap.get(
          row.storeId
        );

      const storeName =
        store?.data?.name ||
        'Marketplace Seller';

      const minDisabled =
        row.quantity <= 1
          ? 'disabled'
          : '';

      const maxDisabled =
        Number.isInteger(
          knownStock
        ) &&
        row.quantity >= knownStock
          ? 'disabled'
          : '';

      const stockText =
        Number.isInteger(
          knownStock
        )
          ? `${knownStock} in stock`
          : 'Stock check unavailable';

      return `
        <div
          class="cart-item"
          data-product-id="${esc(pid)}"
        >

          <div class="cart-item-img">
            <img
              src="${esc(imgUrl)}"
              alt="${esc(row.name)}"
              loading="lazy"
              onerror="
                this.onerror=null;
                this.src='/assets/img/dwm-logo-new.png';
              "
            >
          </div>

          <div class="cart-item-info">

            <div class="cart-item-cat">
              ${esc(
                String(
                  row.currency ||
                  'ZAR'
                )
              )}
              · DROP
            </div>

            <div class="cart-item-name">
              ${esc(row.name)}
            </div>

            <div class="cart-item-store">
              From ${esc(storeName)}
            </div>

            <div class="cart-item-price">
              ${esc(
                formatZARPrice(
                  unitPrice
                )
              )}
              each
            </div>

            <div
              style="
                margin-top:8px;
                font-size:.68rem;
                letter-spacing:.12em;
                text-transform:uppercase;
                opacity:.75;
              "
            >
              ${esc(stockText)}
            </div>

          </div>

          <div class="cart-item-actions">

            <div class="cart-item-price-col">
              <small>
                Line total
              </small>

              ${esc(
                formatZARPrice(
                  lineTotal
                )
              )}
            </div>

            <div
              style="
                display:flex;
                gap:16px;
                align-items:center;
                flex-wrap:wrap;
              "
            >

              <div
                class="qty-wrap"
                role="group"
                aria-label="Quantity for ${esc(row.name)}"
              >

                <button
                  type="button"
                  class="qty-btn qty-dec"
                  data-action="dec"
                  data-pid="${esc(pid)}"
                  ${minDisabled}
                >
                  –
                </button>

                <span
                  class="qty-num"
                  data-qty-display="${esc(pid)}"
                >
                  ${row.quantity}
                </span>

                <button
                  type="button"
                  class="qty-btn qty-inc"
                  data-action="inc"
                  data-pid="${esc(pid)}"
                  ${maxDisabled}
                >
                  +
                </button>

              </div>

              <button
                type="button"
                class="remove-btn"
                data-action="remove"
                data-pid="${esc(pid)}"
              >
                ✕ Remove
              </button>

            </div>

          </div>

        </div>
      `;
    })
    .join('');

  setBodyHtml(`
    <div class="cart-layout">

      <section
        aria-label="Cart items"
        style="min-width:0;"
      >

        <div
          class="cart-items"
          role="list"
        >
          ${itemsHtml}
        </div>

        <p
          id="cartFeedback"
          class="cart-feedback"
          role="status"
          aria-live="polite"
          style="margin-top:18px;"
        ></p>

      </section>

      <aside
        class="cart-summary"
        aria-label="Cart summary"
      >

        <h3>
          Order Summary
        </h3>

        <div class="summary-row">
          <span>Items</span>
          <strong>${count}</strong>
        </div>

        <div class="summary-row">
          <span>Unique Products</span>
          <strong>${items.length}</strong>
        </div>

        <div
          class="
            summary-row
            summary-subtotal
          "
        >
          <span>Subtotal</span>

          <strong>
            ${esc(
              formatZARPrice(
                subtotal
              )
            )}
          </strong>
        </div>

        <p class="summary-note">
          Subtotal reflects current marketplace prices locally.
          Final pricing, shipping, duties and taxes will be confirmed
          at checkout. Checkout will revalidate inventory before payment.
        </p>

        <div class="summary-actions">

          <a
            href="drops.html"
            class="btn-continue"
          >
            ← Continue Shopping
          </a>

          <a
            href="/checkout.html"
            class="btn-checkout-live"
            id="checkoutButton"
          >
            Checkout
          </a>

        </div>

      </aside>

    </div>
  `);

  const bodySlot =
    document.getElementById(
      'cartBody'
    );

  if (!bodySlot) return;

  const setFeedback = (
    text,
    kind = 'info'
  ) => {
    const feedback =
      document.getElementById(
        'cartFeedback'
      );

    if (!feedback) return;

    feedback.className =
      kind === 'info'
        ? 'cart-feedback cf-info'
        : `cart-feedback cf-${kind}`;

    feedback.textContent =
      text || '';
  };

  if (cartWasAdjusted) {
    setFeedback(
      'Your cart was adjusted to match current marketplace stock.'
    );
  }

  bodySlot
    .querySelectorAll(
      '[data-action]'
    )
    .forEach((button) => {

      button.addEventListener(
        'click',
        async (event) => {

          event.preventDefault();

          const pid =
            button.getAttribute(
              'data-pid'
            );

          const action =
            button.getAttribute(
              'data-action'
            );

          if (
            !pid ||
            !action
          ) {
            return;
          }

          const current =
            findCartItem(
              null,
              pid
            );

          if (!current) {
            setFeedback(
              'That item is no longer in your cart.',
              'error'
            );

            await renderCart();
            return;
          }

          if (
            action === 'remove'
          ) {
            removeFromCart(pid);

            await renderCart();

            return;
          }

          if (
            action === 'dec'
          ) {
            const next =
              Math.max(
                1,
                current.quantity - 1
              );

            if (
              next !==
              current.quantity
            ) {
              updateCartQuantity(
                pid,
                next
              );

              await renderCart();
            }

            return;
          }

          if (
            action === 'inc'
          ) {

            const inventory =
              await fetchProductInventory(
                pid
              );

            if (!inventory.ok) {
              setFeedback(
                'Unable to verify current stock. Try again.',
                'error'
              );

              return;
            }

            if (
              !inventory.exists ||
              inventory.status !== 'live' ||
              inventory.stock <= 0
            ) {
              setFeedback(
                'This product is no longer available.',
                'error'
              );

              await renderCart();

              return;
            }

            const result =
              updateCartQuantity(
                pid,
                current.quantity + 1,
                {
                  availableStock:
                    inventory.stock
                }
              );

            if (
              !result.ok &&
              result.reason ===
              'stock-exceeded'
            ) {
              setFeedback(
                `Maximum available stock reached (${inventory.stock}).`,
                'error'
              );

              return;
            }

            if (!result.ok) {
              setFeedback(
                'Unable to increase quantity.',
                'error'
              );

              return;
            }

            await renderCart();
          }

        }
      );

    });
}

window.addEventListener(
  'DOMContentLoaded',
  () => {

    renderCart();

    window.addEventListener(
      CART_EVENT,
      () => {
        renderCart();
      }
    );

    document.addEventListener(
      'visibilitychange',
      () => {

        if (
          document.visibilityState ===
          'visible'
        ) {
          renderCart();
        }

      }
    );

  }
);