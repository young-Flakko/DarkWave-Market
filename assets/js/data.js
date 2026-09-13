import { db } from './firebase-config.js';

import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc,
  documentId
} from 'firebase/firestore';


export const DEFAULT_STORE_SLUG = 'darkwave';
export const DEFAULT_CURRENCY = 'ZAR';


const CATEGORY_SLUG_MAP = {
  'sneakers': 'Sneakers',
  'tops-tees': 'Tops & Tees',
  'tops_and_tees': 'Tops & Tees',
  'tops': 'Tops & Tees',
  'tees': 'Tops & Tees',
  'outerwear': 'Outerwear',
  'cologne': 'Cologne',
  'streetwear': 'Streetwear',
  'decor': 'Decor',
  'high-end': 'High End',
  'high': 'High End',
  'accessories': 'Accessories',
  'fragrance': 'Fragrance'
};


// =====================================================================
// SLUG / CATEGORY HELPERS
// =====================================================================

export function sanitizeSlug(raw) {

  if (!raw || typeof raw !== 'string') {
    return DEFAULT_STORE_SLUG;
  }

  const trimmed =
    raw.trim().toLowerCase();

  const clean =
    trimmed
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

  return clean || DEFAULT_STORE_SLUG;
}


export function normalizeCategoryToSlug(displayName) {

  if (
    !displayName ||
    typeof displayName !== 'string'
  ) {
    return 'uncategorized';
  }

  const key =
    displayName
      .toString()
      .trim()
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  for (
    const [slug, label]
    of Object.entries(CATEGORY_SLUG_MAP)
  ) {

    const labelKey =
      label
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (
      key === labelKey ||
      key === displayName
        .toLowerCase()
        .replace(/\s+/g, '')
    ) {
      return slug;
    }
  }

  return key;
}


export function normalizeCategoryToLabel(
  slugOrName
) {

  if (
    !slugOrName ||
    typeof slugOrName !== 'string'
  ) {
    return 'Uncategorized';
  }

  const key =
    slugOrName
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

  for (
    const [slug, label]
    of Object.entries(CATEGORY_SLUG_MAP)
  ) {

    const slugCompact =
      slug.replace(/-/g, '');

    const labelCompact =
      label
        .toLowerCase()
        .replace(/&/g, '')
        .replace(/\s+/g, '');

    if (
      slugCompact === key ||
      labelCompact === key
    ) {
      return label;
    }
  }

  const label =
    slugOrName
      .toString()
      .trim();

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}


export function matchesCategorySlug(
  productCategory,
  filterSlug
) {

  if (!filterSlug) {
    return true;
  }

  if (!productCategory) {
    return false;
  }

  const productSlug =
    normalizeCategoryToSlug(
      productCategory
    );

  const filter =
    filterSlug
      .toString()
      .trim()
      .toLowerCase()
      .replace(/^-+|-+$/g, '');

  return productSlug === filter;
}


// =====================================================================
// PRICE / DROP HELPERS
// =====================================================================

export function formatZARPrice(value) {

  const n =
    Number(value);

  if (
    !isFinite(n) ||
    isNaN(n)
  ) {
    return 'P.O.A';
  }

  const whole =
    Math.floor(n);

  const cents =
    Math.round(
      (n - whole) * 100
    );

  const formattedWhole =
    whole.toLocaleString(
      'en-ZA',
      {
        maximumFractionDigits: 0
      }
    );

  const centsStr =
    cents
      .toString()
      .padStart(2, '0');

  return `R ${formattedWhole}.${centsStr}`;
}


export function padDropNumber(
  num,
  pad = 3
) {

  if (
    num === null ||
    num === undefined ||
    !isFinite(Number(num))
  ) {
    return '—';
  }

  return String(num)
    .padStart(
      pad,
      '0'
    );
}


// =====================================================================
// DATE / SORT HELPERS
// =====================================================================

function timestampToMillis(value) {

  if (!value) {
    return 0;
  }

  if (
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis();
  }

  if (
    value.seconds !== undefined
  ) {
    return (
      Number(value.seconds) *
      1000
    );
  }

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}


// =====================================================================
// STORE QUERIES
// =====================================================================

export async function findStoreBySlug(slug) {

  const normalized =
    sanitizeSlug(slug);

  const q =
    query(
      collection(
        db,
        'stores'
      ),

      where(
        'slug',
        '==',
        normalized
      ),

      where(
        'status',
        '==',
        'active'
      ),

      limit(1)
    );

  const snap =
    await getDocs(q);

  if (snap.empty) {
    return null;
  }

  const d =
    snap.docs[0];

  return {
    id: d.id,
    ref: d.ref,
    data: d.data()
  };
}


export async function getStoreById(id) {

  if (!id) {
    return null;
  }

  const d =
    await getDoc(
      doc(
        db,
        'stores',
        id
      )
    );

  if (!d.exists()) {
    return null;
  }

  return {
    id: d.id,
    ref: d.ref,
    data: d.data()
  };
}


export async function fetchActiveStoresByIds(
  storeIds
) {

  if (
    !storeIds ||
    !storeIds.length
  ) {
    return new Map();
  }

  const unique = [
    ...new Set(
      storeIds.filter(Boolean)
    )
  ];

  const chunks = [];

  for (
    let i = 0;
    i < unique.length;
    i += 30
  ) {

    chunks.push(
      unique.slice(
        i,
        i + 30
      )
    );
  }

  const out =
    new Map();

  for (
    const batch
    of chunks
  ) {

    const q =
      query(
        collection(
          db,
          'stores'
        ),

        where(
          documentId(),
          'in',
          batch
        ),

        where(
          'status',
          '==',
          'active'
        )
      );

    const snap =
      await getDocs(q);

    snap.forEach(
      (d) => {

        out.set(
          d.id,
          {
            id: d.id,
            data: d.data()
          }
        );

      }
    );
  }

  return out;
}


// =====================================================================
// PRODUCT QUERIES
// =====================================================================

export async function fetchLiveProductsByStore(
  storeId
) {

  if (!storeId) {
    return [];
  }

  const q =
    query(
      collection(
        db,
        'products'
      ),

      where(
        'storeId',
        '==',
        storeId
      ),

      where(
        'status',
        '==',
        'live'
      )
    );

  const snap =
    await getDocs(q);

  const products =
    snap.docs.map(
      (d) => ({
        id: d.id,
        data: d.data()
      })
    );

  products.sort(
    (a, b) => {

      const dropA =
        Number(
          a.data?.dropNumber ??
          0
        );

      const dropB =
        Number(
          b.data?.dropNumber ??
          0
        );

      if (
        dropA !== dropB
      ) {
        return dropA - dropB;
      }

      const createdA =
        timestampToMillis(
          a.data?.createdAt
        );

      const createdB =
        timestampToMillis(
          b.data?.createdAt
        );

      return (
        createdA -
        createdB
      );
    }
  );

  return products;
}


export async function fetchAllLiveProducts() {

  const q =
    query(
      collection(
        db,
        'products'
      ),

      where(
        'status',
        '==',
        'live'
      )
    );

  const snap =
    await getDocs(q);

  const products =
    snap.docs.map(
      (d) => ({
        id: d.id,
        data: d.data()
      })
    );

  products.sort(
    (a, b) => {

      const createdA =
        timestampToMillis(
          a.data?.createdAt
        );

      const createdB =
        timestampToMillis(
          b.data?.createdAt
        );

      return (
        createdB -
        createdA
      );
    }
  );

  return products;
}


// =====================================================================
// PRODUCT CARD
// =====================================================================

export function makeProductCardHtml(
  p,
  {
    storeName = null,
    showBadge = true,
    showFavorite = false
  } = {}
) {

  if (
    !p ||
    !p.data
  ) {
    return '';
  }

  const d =
    p.data;


  const productId =
    p.id &&
    typeof p.id === 'string'
      ? p.id
      : '';

  const productHref =
    productId
      ? `product.html?id=${encodeURIComponent(productId)}`
      : null;


  const safeName =
    d.name &&
    typeof d.name === 'string'
      ? d.name
      : 'Untitled';


  const safeCategory =
    normalizeCategoryToLabel(
      d.category
    );


  const safePrice =
    formatZARPrice(
      d.price
    );


  const safeImg =
    d.imageUrl &&
    typeof d.imageUrl === 'string' &&
    d.imageUrl.trim() !== ''
      ? d.imageUrl
      : '/assets/img/dwm-logo-new.webp';


  const dropStr =
    padDropNumber(
      d.dropNumber
    );


  const rawStock =
    d.stock;

  const safeStock =
    Number.isInteger(rawStock) &&
    rawStock >= 0
      ? rawStock
      : 0;

  const safeStatus =
    d.status &&
    typeof d.status === 'string'
      ? String(d.status).toLowerCase()
      : 'draft';

  let extraBadge = '';

  if (
    safeStatus === 'live' ||
    safeStatus === 'sold_out'
  ) {
    if (safeStock <= 0) {
      extraBadge = `
        <div
          class="drop-status-badge badge-soldout"
          style="
            position:absolute;
            top:12px;
            left:12px;
            z-index:4;
            padding:6px 12px;
            border-radius:999px;
            font-size:0.58rem;
            font-weight:800;
            letter-spacing:0.22em;
            text-transform:uppercase;
            line-height:1;
            background:rgba(207,88,88,0.16);
            color:#ff9898;
            border:1px solid rgba(207,88,88,0.42);
            backdrop-filter:blur(6px);
          "
        >
          Sold Out
        </div>
      `;
    }
  }


  const badge =
    showBadge
      ? `
        <div
          class="drop-status-badge badge-live"
          style="
            position:absolute;
            top:12px;
            right:12px;
            z-index:3;
          "
        >
          ⚡ Live
        </div>
      `
      : '';


  const storeLine =
    storeName
      ? `
        <div
          style="
            margin-top:4px;
            font-size:0.55rem;
            font-weight:600;
            letter-spacing:0.2em;
            text-transform:uppercase;
            color:var(--teal-dim);
          "
        >
          ${escapeHtml(storeName)}
        </div>
      `
      : '';


  const cardInner = `
    <div class="drop-card">

      <!-- PRODUCT IMAGE -->

      <div
        class="drop-img"
        style="
          position:relative;

          width:100%;
          aspect-ratio:1 / 1;

          display:flex;
          align-items:center;
          justify-content:center;

          overflow:hidden;

          box-sizing:border-box;

          background:
            linear-gradient(
              145deg,
              #1a1a1a,
              #222
            );
        "
      >

        ${badge}

        ${extraBadge}

        ${
          showFavorite && productId
            ? `
              <button
                type="button"
                class="dwm-favorite-btn"
                data-dwm-favorite-product="${escapeAttr(productId)}"
                aria-label="Save ${escapeAttr(safeName)} to saved drops"
                aria-pressed="false"
                title="Save drop"
              >
                ♡
              </button>
            `
            : ''
        }

        <img
          src="${escapeAttr(safeImg)}"

          alt="${escapeAttr(safeName)}"

          loading="lazy"

          decoding="async"

          onerror="
            this.onerror=null;
            this.src='/assets/img/dwm-logo-new.webp';
          "

          style="
            display:block;

            width:100%;
            height:100%;

            max-width:100%;
            max-height:100%;

            padding:22px;

            box-sizing:border-box;

            object-fit:contain;
            object-position:center center;

            margin:auto;

            flex:0 0 auto;

            filter:
              drop-shadow(
                0 10px 28px
                rgba(
                  0,
                  0,
                  0,
                  0.35
                )
              );
          "
        >

      </div>


      <!-- PRODUCT INFO -->

      <div class="drop-info">

        <div class="drop-cat">
          ${escapeHtml(
            safeCategory
          )}
        </div>


        <div class="drop-name">
          ${escapeHtml(
            safeName
          )}
        </div>


        ${storeLine}


        <div class="drop-footer">

          <span class="drop-price">
            ${escapeHtml(
              safePrice
            )}
          </span>


          <span class="drop-num-label">
            DROP ${escapeHtml(
              dropStr
            )}
          </span>

        </div>

      </div>

    </div>
  `;

  if (productHref) {
    return `
      <a
        href="${escapeAttr(productHref)}"
        style="
          display:block;
          text-decoration:none;
          color:inherit;
          outline:none;
        "
        aria-label="${escapeAttr('View product: ' + safeName)}"
      >
        ${cardInner}
      </a>
    `;
  }

  return cardInner;
}


// =====================================================================
// UI STATES
// =====================================================================

export function makeStateBlock(
  type,
  headline,
  sub,
  {
    eyebrow = null
  } = {}
) {

  const eyebrowHtml =
    eyebrow
      ? `
        <span
          class="section-label"
          style="margin-bottom:16px;"
        >
          ${escapeHtml(
            eyebrow
          )}
        </span>
      `
      : '';


  return `
    <div
      class="state state-${escapeAttr(type)}"

      style="
        padding:64px 24px;
        text-align:center;

        border:
          1px dashed
          rgba(
            74,
            157,
            168,
            0.18
          );

        background:
          rgba(
            74,
            157,
            168,
            0.03
          );

        position:relative;
        z-index:2;
      "
    >

      ${eyebrowHtml}


      <div
        style="
          font-family:'Cinzel',serif;

          font-size:
            clamp(
              1.2rem,
              2.5vw,
              1.8rem
            );

          font-weight:700;

          color:var(--white);

          margin-bottom:12px;
        "
      >
        ${escapeHtml(
          headline
        )}
      </div>


      <div
        style="
          font-size:0.9rem;

          color:
            var(--gray-light);

          letter-spacing:
            0.05em;

          line-height:1.6;
        "
      >
        ${escapeHtml(
          sub
        )}
      </div>

    </div>
  `;
}


export function makeLoadingState(label) {

  const l =
    label ||
    'Loading...';


  return `
    <div
      class="state state-loading"

      style="
        padding:64px 24px;

        text-align:center;

        border:
          1px dashed
          rgba(
            74,
            157,
            168,
            0.18
          );

        background:
          rgba(
            74,
            157,
            168,
            0.03
          );

        position:relative;
        z-index:2;
      "
    >

      <div
        style="
          display:inline-block;

          width:24px;
          height:24px;

          border:
            2px solid
            rgba(
              74,
              157,
              168,
              0.25
            );

          border-top-color:
            var(--teal);

          border-radius:50%;

          animation:
            spin
            0.9s
            linear
            infinite;

          margin-bottom:16px;
        "
      ></div>


      <div
        style="
          font-size:0.65rem;

          font-weight:700;

          letter-spacing:
            0.4em;

          text-transform:
            uppercase;

          color:
            var(--teal-dim);

          margin-bottom:8px;
        "
      >
        Fetching from Firestore
      </div>


      <div
        style="
          font-size:0.9rem;

          color:
            var(--gray-light);

          letter-spacing:
            0.05em;
        "
      >
        ${escapeHtml(l)}
      </div>

    </div>


    <style>

      @keyframes spin {

        to {
          transform:rotate(360deg);
        }

      }

    </style>
  `;
}


// =====================================================================
// ESCAPING HELPERS
// =====================================================================

function escapeHtml(s) {

  if (
    s === null ||
    s === undefined
  ) {
    return '';
  }

  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


function escapeAttr(s) {
  return escapeHtml(s);
}