import {
  doc,
  getDoc
} from 'firebase/firestore';

import { db } from './firebase-config.js';

import {
  renderNav
} from './nav.js';

import {
  addToCart,
  formatZARPrice,
  findCartItem,
  getCartCount
} from './cart.js';

import {
  normalizeCategoryToLabel,
  padDropNumber,
  makeLoadingState,
  makeStateBlock,
  getStoreById
} from './data.js';

renderNav('nav');

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('id');
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();
  if (clean.length === 0) return null;
  return clean;
}

function setSlotHtml(html) {
  const slot = document.getElementById('productSlot');
  if (!slot) return;
  slot.innerHTML = html;
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderProductPage({ product, store, productId }) {
  const d = product.data || {};

  const safeName = d.name && typeof d.name === 'string' ? d.name : 'Untitled Product';
  document.title = `DWM — ${safeName}`;

  const safeCategory = normalizeCategoryToLabel(d.category);
  const safePrice = formatZARPrice(d.price);
  const safeImageUrl = d.imageUrl && typeof d.imageUrl === 'string' && d.imageUrl.trim() !== ''
    ? d.imageUrl
    : '/assets/img/dwm-logo-new.png';

  const dropStr = padDropNumber(d.dropNumber);

  const rawStock = d.stock;
  const safeStock = Number.isInteger(rawStock) && rawStock >= 0 ? rawStock : 0;

  const rawStatus = d.status && typeof d.status === 'string'
    ? String(d.status).toLowerCase()
    : 'draft';

  const description = d.description && typeof d.description === 'string' && d.description.trim() !== ''
    ? d.description
    : null;

  const isPublicLive = rawStatus === 'live' || rawStatus === 'sold_out';
  const isSoldOut = !isPublicLive || safeStock <= 0;

  const statusPillClass =
    !isPublicLive ? 'pill-draft'
    : safeStock <= 0 ? 'pill-soldout'
    : 'pill-live';

  const statusPillLabel =
    !isPublicLive ? 'NOT PUBLIC'
    : safeStock <= 0 ? 'SOLD OUT'
    : 'LIVE';

  const availabilityPillClass = safeStock > 0 ? 'pill-instock' : 'pill-soldout';
  const availabilityPillLabel = safeStock > 0
    ? (safeStock === 1 ? `${safeStock} AVAILABLE` : `IN STOCK — ${safeStock} AVAILABLE`)
    : 'SOLD OUT';

  const storeName =
    store && store.data && typeof store.data.name === 'string' && store.data.name.trim() !== ''
      ? store.data.name
      : 'Darkwave Market Seller';

  const storeSlug =
    store && store.data && typeof store.data.slug === 'string' && store.data.slug.trim() !== ''
      ? store.data.slug
      : null;

  const storeHref = storeSlug ? `store.html?store=${encodeURIComponent(storeSlug)}` : 'brands.html';

  const cartItem = findCartItem(null, productId);
  const alreadyQty = cartItem && cartItem.quantity ? cartItem.quantity : 0;
  const addDisabled = isSoldOut;

  const currentCountTotal = getCartCount();
  const currentTotalLabel = currentCountTotal > 0
    ? `Cart (${currentCountTotal})`
    : 'Cart';

  setSlotHtml(`
    <div class="product-layout">

      <div class="product-gallery" aria-label="Product image">
        <img
          id="productMainImage"
          src="${esc(safeImageUrl)}"
          alt="${esc(safeName)}"
          onerror="this.onerror=null;this.src='/assets/img/dwm-logo-new.png';"
        >
      </div>

      <div class="product-meta">

        <div class="product-category">
          ${esc(safeCategory)}
        </div>

        <h1 class="product-name">
          ${esc(safeName)}
        </h1>

        <div class="product-drop">
          Drop ${esc(dropStr)}
        </div>

        <div class="product-price">
          ${esc(safePrice)}
        </div>

        <div class="product-pills">
          <span class="product-pill ${esc(statusPillClass)}">${esc(statusPillLabel)}</span>
          ${isPublicLive ? `<span class="product-pill ${esc(availabilityPillClass)}">${esc(availabilityPillLabel)}</span>` : ''}
        </div>

        <div class="product-divider"></div>

        ${description
          ? `<div class="product-description">${esc(description)}</div>`
          : `<div class="product-description-empty">No product description yet. Check back shortly for full details, sizing, and colourway notes.</div>`
        }

        <div class="product-divider"></div>

        <div class="seller-row" role="region" aria-label="Seller information">
          <div>
            <div class="seller-row-label">Sold by</div>
            <div class="seller-row-name">${esc(storeName)}</div>
          </div>
          <a
            class="seller-store-link"
            href="${esc(storeHref)}"
            aria-label="Visit the seller storefront for ${esc(storeName)}"
          >
            View Storefront →
          </a>
        </div>

        <div class="product-actions">
          <button
            id="addToCartButton"
            type="button"
            class="btn-addcart"
            ${addDisabled ? 'disabled' : ''}
            aria-disabled="${addDisabled ? 'true' : 'false'}"
          >
            ${addDisabled
              ? (safeStock <= 0 ? 'Sold Out' : 'Unavailable')
              : (alreadyQty > 0 ? `Add Another — In Cart (${alreadyQty})` : 'Add to Cart')
            }
          </button>

          <a
            href="cart.html"
            class="btn-checkout-soon"
            tabindex="-1"
            aria-hidden="true"
          >
            ${esc(currentTotalLabel)} — Checkout Coming Soon
          </a>

          <div
            id="productFeedback"
            class="product-feedback"
            role="status"
            aria-live="polite"
          ></div>
        </div>

      </div>

    </div>
  `);

  const btn = document.getElementById('addToCartButton');
  const fb = document.getElementById('productFeedback');

  function setFeedback(text, kind) {
    if (!fb) return;
    fb.className = 'product-feedback';
    if (kind && kind !== 'info') fb.classList.add(`fb-${kind}`);
    else fb.classList.add('fb-info');
    fb.textContent = text || '';
  }

  if (btn && !btn.disabled) {
    btn.addEventListener('click', () => {
      const cartInput = {
        productId: String(productId),
        storeId: String(d.storeId),
        name: String(safeName),
        price: Number(d.price) || 0,
        currency: String(d.currency || 'ZAR'),
        imageUrl: safeImageUrl,
        quantity: 1
      };
      const result = addToCart(cartInput, { availableStock: safeStock });
      if (result.ok) {
        const updatedQty = result.item && result.item.quantity ? result.item.quantity : 1;
        btn.textContent = updatedQty > 1
          ? `In Cart (${updatedQty}) — Add Another`
          : `In Cart (1) — Add Another`;
        setFeedback(`${esc(safeName)} added to your cart.`, 'success');
      } else if (result.reason === 'sold-out') {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
        btn.textContent = 'Sold Out';
        setFeedback('This item is sold out.', 'error');
      } else if (result.reason === 'stock-capped' && result.item) {
        btn.textContent = `In Cart (${result.item.quantity}) — Stock Reached`;
        setFeedback(`Maximum available stock (${result.item.quantity}) is already in your cart.`, 'info');
      } else if (result.reason === 'stock-exceeded') {
        const avail = result.detail && result.detail.available != null ? result.detail.available : safeStock;
        btn.textContent = avail > 0 ? `In Cart (${avail}) — Stock Reached` : 'Sold Out';
        if (avail <= 0) {
          btn.disabled = true;
          btn.setAttribute('aria-disabled', 'true');
        }
        setFeedback(`Only ${avail} units are available.`, 'error');
      } else {
        setFeedback('Unable to add item to cart.', 'error');
      }
    });
  } else if (btn && btn.disabled) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setFeedback('This item is currently unavailable and cannot be added to your cart.', 'error');
    });
  }
}

function renderProductNotFound(productId, reason) {
  document.title = 'DWM — Product Not Found';
  const heading = 'Product not found.';
  const sub = reason && reason.trim() !== ''
    ? reason
    : 'The product you requested may have been removed, or the link may be incorrect. Browse the drops marketplace to view currently available items.';
  const block = makeStateBlock('error', heading, sub, { eyebrow: '— 404 —' });
  setSlotHtml(`
    <div style="margin-bottom:28px;">
      <a
        href="drops.html"
        class="btn-secondary"
        style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;font-size:0.72rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;text-decoration:none;"
      >
        ← Browse All Drops
      </a>
    </div>
    ${block}
  `);
}

async function initProductPage() {
  const productId = getProductIdFromUrl();
  if (!productId) {
    renderProductNotFound(null, 'No product identifier was provided in the URL.');
    return;
  }

  setSlotHtml(makeLoadingState('Retrieving product details from the marketplace...'));

  try {
    const productRef = doc(db, 'products', productId);
    const snap = await getDoc(productRef);

    if (!snap.exists()) {
      renderProductNotFound(productId, 'The requested product could not be located. It may have been removed by the seller or never existed under this identifier.');
      return;
    }

    const product = {
      id: snap.id,
      ref: snap.ref,
      data: snap.data()
    };

    const rawStatus =
      product.data && product.data.status && typeof product.data.status === 'string'
        ? String(product.data.status).toLowerCase()
        : 'draft';

    const isPublicLive = rawStatus === 'live' || rawStatus === 'sold_out';

    if (!isPublicLive) {
      renderProductNotFound(productId, 'This product is not currently visible. It may still be in draft or has been temporarily hidden.');
      return;
    }

    const storeId = product.data && product.data.storeId;
    let store = null;
    if (storeId && typeof storeId === 'string') {
      try {
        store = await getStoreById(storeId);
      } catch (storeErr) {
        console.warn('[product.js] Store lookup failed; falling back to generic seller label.', storeErr);
        store = null;
      }
    }

    renderProductPage({ product, store, productId });
  } catch (err) {
    console.error('[product.js] Firestore error:', err);
    document.title = 'DWM — Unable to load product';
    setSlotHtml(makeStateBlock(
      'error',
      'Unable to load product.',
      'There was a problem retrieving this product. Refresh the page to try again, or browse the current drops.',
      { eyebrow: '— Network Issue —' }
    ));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initProductPage);
}
