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

    // Group released products by active storefront.
    const storefrontGroups = new Map();

    visible.forEach((product) => {
      const storeId = product.data.storeId;
      const store = activeStoreMap.get(storeId);

      if (!store || !store.data) return;

      if (!storefrontGroups.has(storeId)) {
        storefrontGroups.set(storeId, {
          store,
          products: []
        });
      }

      storefrontGroups
        .get(storeId)
        .products
        .push(product);
    });

    // Largest / most active storefronts first.
    const groups = [...storefrontGroups.values()]
      .sort((a, b) => {
        return b.products.length - a.products.length;
      });

    const storefrontHtml = groups.map(({ store, products }) => {
      const data = store.data || {};

      const storeName =
        escapeHtml(data.name || 'DWM Store');

      const storeSlug =
        sanitizeSlug(
          data.slug ||
          data.name ||
          store.id
        );

      const storeLogoRaw =
        String(
          data.logoUrl ||
          data.logo ||
          ''
        ).trim();

      /*
        If a store still uses the generic DWM placeholder,
        render both DWM theme crests and let CSS switch them.

        Real reseller-uploaded logos remain untouched.
      */
      const usesDwmPlaceholder =
        !storeLogoRaw ||
        storeLogoRaw.includes(
          'dwm-logo-new.webp'
        );

      const storeLogoHtml =
        usesDwmPlaceholder
          ? `
              <img
                src="/assets/img/dwm-crest-dark.webp"
                alt=""
                class="drop-store-logo-theme drop-store-logo-dark"
                loading="lazy"
              >

              <img
                src="/assets/img/dwm-crest-light.webp"
                alt=""
                class="drop-store-logo-theme drop-store-logo-light"
                loading="lazy"
              >
            `
          : `
              <img
                src="${escapeHtml(storeLogoRaw)}"
                alt=""
                class="drop-store-logo-custom"
                loading="lazy"
                onerror="this.src='/assets/img/dwm-crest-dark.webp'"
              >
            `;

      const productWord =
        products.length === 1
          ? 'DROP'
          : 'DROPS';

      const instagramUsername =
        String(
          data.instagramUsername || ''
        )
          .trim()
          .replace(/^@+/, '');

      const instagramHtml =
        /^[A-Za-z0-9._]{1,30}$/.test(
          instagramUsername
        )
          ? `
              <a
                class="drop-storefront-instagram"
                href="https://www.instagram.com/${encodeURIComponent(instagramUsername)}/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit ${storeName} on Instagram"
              >
                <span
                  class="drop-storefront-instagram-icon"
                  aria-hidden="true"
                >
                  ◎
                </span>

                @${escapeHtml(instagramUsername)}
              </a>
            `
          : '';

      const tiktokUsername =
        String(
          data.tiktokUsername || ''
        )
          .trim()
          .replace(/^@+/, '');

      const tiktokHtml =
        /^[A-Za-z0-9._]{1,24}$/.test(
          tiktokUsername
        )
          ? `
              <a
                class="drop-storefront-instagram"
                href="https://www.tiktok.com/@${encodeURIComponent(tiktokUsername)}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Visit ${storeName} on TikTok"
              >
                <span
                  class="drop-storefront-instagram-icon"
                  aria-hidden="true"
                >
                  ♪
                </span>

                @${escapeHtml(tiktokUsername)}
              </a>
            `
          : '';

      return `
        <section
          class="drop-storefront"
          data-store-id="${escapeHtml(store.id)}"
        >
          <header class="drop-storefront-header">

            <a
              class="drop-storefront-brand"
              href="/store.html?store=${encodeURIComponent(storeSlug)}"
              aria-label="Visit ${storeName}"
            >
              <div class="drop-storefront-logo">
                ${storeLogoHtml}
              </div>

              <div class="drop-storefront-identity">
                <span class="drop-storefront-kicker">
                  Storefront
                </span>

                <h3 class="drop-storefront-name">
                  ${storeName}
                </h3>

                <div class="drop-storefront-meta">

                  <span class="drop-storefront-count">
                    ${products.length} ${productWord}
                  </span>

                  ${instagramHtml}
                  ${tiktokHtml}

                </div>
              </div>
            </a>

            <a
              class="drop-storefront-link"
              href="/store.html?store=${encodeURIComponent(storeSlug)}"
            >
              View Store
              <span aria-hidden="true">→</span>
            </a>

          </header>

          <div class="drops-grid">
            ${products.map((product) =>
              makeProductCardHtml(
                product,
                {
                  storeName: data.name || null,
                  showBadge: true,
                  showFavorite: true
                }
              )
            ).join('')}
          </div>

        </section>
      `;
    }).join('');

    setReleasedGridHtml(
      `<div class="drop-storefronts">
        ${storefrontHtml}
      </div>`
    );
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
