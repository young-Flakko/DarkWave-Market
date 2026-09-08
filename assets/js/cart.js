export const CART_STORAGE_KEY = 'dwm_cart';

export const CART_EVENT = 'dwm:cart-updated';

const MAX_SAFE_INT = 2 ** 31 - 1;

function _validItemShape(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  const qty = candidate.quantity;
  if (!Number.isInteger(qty) || qty <= 0) return false;
  if (typeof candidate.productId !== 'string' || candidate.productId.length === 0) return false;
  if (typeof candidate.storeId !== 'string' || candidate.storeId.length === 0) return false;
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) return false;
  if (!Number.isFinite(Number(candidate.price)) || Number(candidate.price) < 0) return false;
  if (typeof candidate.currency !== 'string' || candidate.currency.length === 0) return false;
  return true;
}

function _cloneItem(item) {
  return {
    productId: String(item.productId),
    storeId: String(item.storeId),
    name: String(item.name),
    price: Number(item.price),
    currency: String(item.currency),
    imageUrl:
      item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim() !== ''
        ? String(item.imageUrl)
        : null,
    quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1
  };
}

export function parseCartFromStorage(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return [];
  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch (err) {
    console.warn('[cart.js] Invalid JSON in localStorage cart; resetting to empty.', err);
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const deduped = new Map();
  for (const row of parsed) {
    if (!_validItemShape(row)) continue;
    const normalized = _cloneItem(row);
    const existing = deduped.get(normalized.productId);
    if (existing) {
      existing.quantity = Math.min(
        MAX_SAFE_INT,
        existing.quantity + normalized.quantity
      );
    } else {
      deduped.set(normalized.productId, normalized);
    }
  }
  return [...deduped.values()];
}

export function getCart() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  let raw;
  try {
    raw = window.localStorage.getItem(CART_STORAGE_KEY);
  } catch (err) {
    console.warn('[cart.js] localStorage read failed; assuming empty cart.', err);
    return [];
  }
  return parseCartFromStorage(raw);
}

export function saveCart(items) {
  if (!Array.isArray(items)) return false;
  const sanitized = [];
  for (const row of items) {
    if (_validItemShape(row)) sanitized.push(_cloneItem(row));
  }
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(sanitized)
    );
  } catch (err) {
    console.warn('[cart.js] localStorage write failed.', err);
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent(CART_EVENT, { detail: { items: sanitized } })
      );
    } catch (err) {
      console.warn('[cart.js] Unable to dispatch cart event.', err);
    }
  }
  return true;
}

export function getCartCount(items) {
  const list = Array.isArray(items) ? items : getCart();
  let total = 0;
  for (const row of list) {
    const q = Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 0;
    total = Math.min(MAX_SAFE_INT, total + q);
  }
  return total;
}

export function getCartSubtotal(items) {
  const list = Array.isArray(items) ? items : getCart();
  let total = 0;
  for (const row of list) {
    const price = Number(row.price);
    const qty = Number.isInteger(row.quantity) && row.quantity > 0 ? row.quantity : 0;
    if (!Number.isFinite(price) || price < 0) continue;
    total += price * qty;
  }
  return Number.isFinite(total) ? Math.round(total * 100) / 100 : 0;
}

export function findCartItem(items, productId) {
  if (!productId || typeof productId !== 'string') return null;
  const list = Array.isArray(items) ? items : getCart();
  for (const row of list) {
    if (row.productId === productId) return row;
  }
  return null;
}

export function addToCart(input, { availableStock = null } = {}) {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid-item' };
  if (!_validItemShape(input) && !(
    input.productId &&
    input.storeId &&
    input.name &&
    Number.isFinite(Number(input.price)) &&
    input.currency
  )) {
    return { ok: false, reason: 'invalid-item' };
  }
  const newItem = _cloneItem(input);
  const stockIsFinite = Number.isInteger(availableStock) && availableStock >= 0;
  const items = getCart();
  const existingIndex = items.findIndex((r) => r.productId === newItem.productId);
  if (existingIndex >= 0) {
    const existing = items[existingIndex];
    const next = existing.quantity + newItem.quantity;
    if (stockIsFinite && next > availableStock) {
      if (existing.quantity >= availableStock) {
        return { ok: false, reason: 'stock-exceeded', detail: { available: availableStock, inCart: existing.quantity } };
      }
      existing.quantity = availableStock;
      saveCart(items);
      return { ok: true, updated: true, reason: 'stock-capped', item: _cloneItem(existing) };
    }
    existing.quantity = Math.min(MAX_SAFE_INT, next);
    saveCart(items);
    return { ok: true, updated: true, item: _cloneItem(existing) };
  }
  if (stockIsFinite && newItem.quantity > availableStock) {
    if (availableStock <= 0) {
      return { ok: false, reason: 'sold-out' };
    }
    newItem.quantity = availableStock;
  }
  items.push(newItem);
  saveCart(items);
  return { ok: true, updated: false, item: _cloneItem(newItem) };
}

export function removeFromCart(productId) {
  if (!productId || typeof productId !== 'string') return false;
  const items = getCart();
  const next = items.filter((r) => r.productId !== productId);
  if (next.length === items.length) return false;
  saveCart(next);
  return true;
}

export function updateCartQuantity(productId, nextQuantity, { availableStock = null } = {}) {
  if (!productId || typeof productId !== 'string') return { ok: false, reason: 'invalid-product' };
  const qtyRaw = Number(nextQuantity);
  if (!Number.isFinite(qtyRaw)) return { ok: false, reason: 'invalid-quantity' };
  if (qtyRaw <= 0) {
    removeFromCart(productId);
    return { ok: true, removed: true };
  }
  const qty = Math.min(MAX_SAFE_INT, Math.trunc(qtyRaw));
  const stockIsFinite = Number.isInteger(availableStock) && availableStock >= 0;
  if (stockIsFinite && qty > availableStock) {
    return { ok: false, reason: 'stock-exceeded', detail: { available: availableStock } };
  }
  const items = getCart();
  const existing = items.find((r) => r.productId === productId);
  if (!existing) return { ok: false, reason: 'not-in-cart' };
  existing.quantity = qty;
  saveCart(items);
  return { ok: true, item: _cloneItem(existing) };
}

export function clearCart() {
  saveCart([]);
  return true;
}

export function formatZARPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || isNaN(n)) return 'P.O.A';
  const whole = Math.floor(n);
  const cents = Math.round((n - whole) * 100);
  const formattedWhole = whole.toLocaleString('en-ZA', { maximumFractionDigits: 0 });
  const centsStr = cents.toString().padStart(2, '0');
  return `R ${formattedWhole}.${centsStr}`;
}
