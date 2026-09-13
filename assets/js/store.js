import {
  sanitizeSlug,
  findStoreBySlug,
  fetchLiveProductsByStore,
  makeProductCardHtml,
  makeStateBlock,
  makeLoadingState,
  DEFAULT_STORE_SLUG,
  formatZARPrice
} from './data.js';
import { renderNav } from './nav.js';

renderNav('nav');

function getStoreSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('store');
  return raw && raw.trim() !== '' ? sanitizeSlug(raw) : DEFAULT_STORE_SLUG;
}

const STORE_AVATAR_FALLBACK = '?';

function renderStoreHeader(store) {
  const data = store.data || {};
  const safeName = data.name || 'Unnamed Store';
  const safeDesc = data.description && String(data.description).trim() !== ''
    ? data.description
    : 'Marketplace storefront.';
  const avatarEl = document.getElementById('storeAvatar');
  const titleEl = document.getElementById('storeTitle');
  const descEl = document.getElementById('storeDesc');
  const logoUrl = data.logoUrl && String(data.logoUrl).trim() !== '' ? data.logoUrl : null;

  if (avatarEl) {
    const initial = (safeName.charAt(0) || 'D').toUpperCase();
    if (logoUrl) {
      avatarEl.innerHTML = `
        <img src="${encodeAttr(logoUrl)}" alt="${encodeAttr(safeName)}"
             onerror="this.remove();const f=document.createElement('span');f.textContent='${encodeJs(initial)}';avatarEl.appendChild(f);avatarEl.classList.add('store-avatar-fallback');"
             style="width:100%;height:100%;object-fit:contain;padding:10px;border-radius:0;display:block;"
             class="store-logo">`;
      avatarEl.style.padding = '0';
    } else {
      avatarEl.textContent = initial || STORE_AVATAR_FALLBACK;
    }
  }

  if (titleEl) titleEl.textContent = safeName;
  if (descEl) descEl.textContent = safeDesc;

  const instagramEl =
    document.getElementById('storeInstagram');

  const instagramUsername =
    String(
      data.instagramUsername || ''
    )
      .trim()
      .replace(/^@+/, '');

  if (
    instagramEl &&
    /^[A-Za-z0-9._]{1,30}$/.test(
      instagramUsername
    )
  ) {
    instagramEl.href =
      `https://www.instagram.com/${encodeURIComponent(instagramUsername)}/`;

    instagramEl.textContent =
      `◎ @${instagramUsername}`;

    instagramEl.style.display =
      'inline-block';
  } else if (instagramEl) {
    instagramEl.style.display =
      'none';

    instagramEl.removeAttribute(
      'href'
    );

    instagramEl.textContent =
      '';
  }

  const tiktokEl =
    document.getElementById('storeTikTok');

  const tiktokUsername =
    String(
      data.tiktokUsername || ''
    )
      .trim()
      .replace(/^@+/, '');

  if (
    tiktokEl &&
    /^[A-Za-z0-9._]{1,24}$/.test(
      tiktokUsername
    )
  ) {

    tiktokEl.href =
      `https://www.tiktok.com/@${encodeURIComponent(tiktokUsername)}`;

    tiktokEl.textContent =
      `♪ @${tiktokUsername}`;

    tiktokEl.style.display =
      'inline-block';

  } else if (tiktokEl) {

    tiktokEl.style.display =
      'none';

    tiktokEl.removeAttribute(
      'href'
    );

    tiktokEl.textContent =
      '';

  }

  const dropsBtn = document.getElementById('viewDropsBtn');
  if (dropsBtn) dropsBtn.href = 'drops.html';
}

function setCatalogHtml(html) {
  const wrap = document.getElementById('catalogWrap');
  if (!wrap) return;
  wrap.innerHTML = html;
}

function setHeaderLoading() {
  const avatarEl = document.getElementById('storeAvatar');
  const titleEl = document.getElementById('storeTitle');
  const descEl = document.getElementById('storeDesc');
  if (avatarEl) avatarEl.textContent = '…';
  if (titleEl) titleEl.textContent = 'Loading Store...';
  if (descEl) descEl.textContent = 'Fetching brand details from Firestore.';
}

export async function initStorePage() {
  setHeaderLoading();
  setCatalogHtml(makeLoadingState('Catalog products are being retrieved from Firestore.'));

  const slug = getStoreSlugFromUrl();

  try {
    const store = await findStoreBySlug(slug);

    if (!store) {
      const nameEl = document.getElementById('storeTitle');
      const descEl = document.getElementById('storeDesc');
      const avatarEl = document.getElementById('storeAvatar');
      if (avatarEl) avatarEl.textContent = '?';
      if (nameEl) nameEl.textContent = 'Store Not Found';
      if (descEl) descEl.textContent = `No store matches slug "${slug}". It may have been removed or the link is outdated.`;
      setCatalogHtml(makeStateBlock('error', 'Store not found.',
        `There is no active storefront for slug "${slug}". Return to the market to browse available stores.`,
        { eyebrow: '— 404 —' }));
      return;
    }

    if (store.data.status !== 'active') {
      renderStoreHeader(store);
      setCatalogHtml(makeStateBlock('suspended', 'This store is currently unavailable.',
        'The seller is in review or temporarily hidden. Please check back later.',
        { eyebrow: '— Offline —' }));
      return;
    }

    renderStoreHeader(store);

    setCatalogHtml(makeLoadingState(`Loading live catalog for ${escapeHtml(store.data.name || 'this store')}...`));
    const products = await fetchLiveProductsByStore(store.id);

    if (!products || products.length === 0) {
      setCatalogHtml(makeStateBlock('empty', 'No live products yet.',
        'The storefront is live, but no drops are listed at this time. Check back for the next release.',
        { eyebrow: '— Empty Catalog —' }));
      return;
    }

    const gridHtml = `<div class="drops-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:32px;">
        ${products.map(p => makeProductCardHtml(p, { showBadge: true })).join('')}
      </div>`;
    setCatalogHtml(gridHtml);
  } catch (err) {
    console.error('[store.js] Firestore error:', err);
    setCatalogHtml(makeStateBlock('error', 'Unable to load store data.',
      'There was a problem contacting the marketplace. Refresh the page to try again.',
      { eyebrow: '— Network Issue —' }));
  }
}

function encodeAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function encodeJs(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/'/g, "\\'").replace(/\n/g, ' ');
}
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initStorePage);
}
