import {
  fetchAllLiveProducts,
  fetchActiveStoresByIds,
  makeProductCardHtml,
  makeStateBlock,
  makeLoadingState,
  matchesCategorySlug,
  sanitizeSlug
} from './data.js';
import { renderNav } from './nav.js';

renderNav('nav');

function getFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawCategory = params.get('category');
  const categorySlug = rawCategory && rawCategory.trim() !== ''
    ? rawCategory.trim().toLowerCase().replace(/^-+|-+$/g, '')
    : null;
  const rawRegion = params.get('filter');
  const region = rawRegion && rawRegion.trim() !== ''
    ? rawRegion.trim().toLowerCase()
    : null;
  return { categorySlug, region };
}

function setReleasedGridHtml(html) {
  const slot = document.getElementById('releasedDropsSlot');
  if (slot) slot.innerHTML = html;
}

function setSectionHeading(extraLabel) {
  const heading = document.getElementById('releasedDropsHeading');
  if (!heading) return;
  heading.innerHTML = 'Released Drops' + (extraLabel ? ` <span style="font-size:0.55rem;font-weight:600;letter-spacing:0.35em;text-transform:uppercase;color:var(--teal-dim);margin-left:12px;">${escapeHtml(extraLabel)}</span>` : '');
}

export async function initDropsPage() {
  const slot = document.getElementById('releasedDropsSlot');
  if (slot) slot.innerHTML = makeLoadingState('Pulling released drops from the marketplace...');

  const { categorySlug, region } = getFiltersFromUrl();

  if (categorySlug) {
    setSectionHeading(`Filter: ${escapeHtml(categorySlug.replace(/-/g, ' '))}`);
  } else if (region) {
    // NOTE: Phase 3 schema has no region/location field on stores/products.
    // Regional filtering (?filter=sa, ?filter=worldwide) requires a future schema extension
    // (e.g., stores.region or products.region). Preserving the query param here but showing
    // the normal live list. Do NOT fabricate fields outside the approved data model.
    setSectionHeading('Marketwide (regional filter pending schema)');
  }

  try {
    const products = await fetchAllLiveProducts();

    if (!products || products.length === 0) {
      setReleasedGridHtml(makeStateBlock('empty', 'No drops yet.',
        'The marketplace is preparing its first releases. Follow @darkwavemarket to catch the first wave.',
        { eyebrow: '— The Calm Before the Drop —' }));
      return;
    }

    const storeIds = products.map(p => p.data && p.data.storeId).filter(Boolean);
    const activeStoreMap = await fetchActiveStoresByIds(storeIds);

    let visible = products.filter(p => {
      if (!p || !p.data) return false;
      const store = activeStoreMap.get(p.data.storeId);
      if (!store) return false;
      if (store.data.status !== 'active') return false;
      if (categorySlug && !matchesCategorySlug(p.data.category, categorySlug)) return false;
      return true;
    });

    if (!visible.length) {
      const heading = categorySlug
        ? `Nothing in "${categorySlug.replace(/-/g, ' ')}" yet.`
        : 'No live products from active stores.';
      const sub = categorySlug
        ? 'Browse other categories or check back for the next release in this lineup.'
        : 'The market is between drops. Come back soon.';
      setReleasedGridHtml(makeStateBlock('empty', heading, sub,
        { eyebrow: '— Empty —' }));
      return;
    }

    const gridHtml = `<div class="drops-grid">
        ${visible.map(p => {
          const store = activeStoreMap.get(p.data.storeId);
          const storeName = store && store.data ? store.data.name : null;
          return makeProductCardHtml(p, { storeName, showBadge: true });
        }).join('')}
      </div>`;
    setReleasedGridHtml(gridHtml);
  } catch (err) {
    console.error('[drops.js] Firestore error:', err);
    setReleasedGridHtml(makeStateBlock('error', 'Unable to load drops.',
      'There was a problem retrieving released drops. Refresh the page to try again.',
      { eyebrow: '— Network Issue —' }));
  }
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
  window.addEventListener('DOMContentLoaded', initDropsPage);
}
