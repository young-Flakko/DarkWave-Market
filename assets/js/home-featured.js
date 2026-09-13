import { db } from './firebase-config.js';

import {
  doc,
  getDoc
} from 'firebase/firestore';

import {
  formatZARPrice
} from './data.js';

const grid =
  document.getElementById(
    'homeFeaturedProducts'
  );

const label =
  document.getElementById(
    'homeDropsLabel'
  );

const title =
  document.getElementById(
    'homeDropsTitle'
  );

function esc(value = '') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function productCard(
  product,
  index
) {

  const image =
    product.imageUrl ||
    '/assets/img/dwm-logo-new.webp';

  const href =
    `/product.html?id=${encodeURIComponent(product.id)}`;

  return `
    <a
      href="${href}"
      class="drop-card ${index === 0 ? 'featured' : ''}"
      style="text-decoration:none;color:inherit;"
    >

      <div
        class="drop-img-placeholder"
        style="padding:0;overflow:hidden;"
      >

        <img
          src="${esc(image)}"
          alt="${esc(product.name || 'DWM Product')}"
          loading="lazy"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          "
          onerror="
            this.onerror=null;
            this.src='/assets/img/dwm-logo-new.webp';
          "
        >

      </div>

      <div class="drop-info">

        <div class="drop-tag">
          ${index === 0
            ? '⚡ Featured'
            : esc(product.category || 'DWM')}
        </div>

        <div class="drop-name">
          ${esc(product.name || 'Untitled')}
        </div>

        <div class="drop-price">
          ${esc(formatZARPrice(product.price))}
        </div>

      </div>

    </a>
  `;
}

async function loadFeatured() {

  if (!grid)
    return;

  try {

    const homeSnap =
      await getDoc(
        doc(
          db,
          'siteContent',
          'home'
        )
      );

    if (!homeSnap.exists()) {

      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;">
          Featured drops coming soon.
        </div>
      `;

      return;
    }

    const config =
      homeSnap.data();

    if (label && config.sectionLabel)
      label.textContent =
        config.sectionLabel;

    if (title && config.sectionTitle)
      title.textContent =
        config.sectionTitle;

    const ids =
      Array.isArray(
        config.featuredProductIds
      )
        ? config.featuredProductIds.filter(Boolean)
        : [];

    const products = [];

    for (const id of ids) {

      try {

        const snap =
          await getDoc(
            doc(
              db,
              'products',
              id
            )
          );

        if (
          snap.exists() &&
          snap.data().status === 'live'
        ) {

          products.push({
            id:snap.id,
            ...snap.data()
          });
        }

      } catch (err) {

        console.warn(
          '[home] featured product unavailable:',
          id,
          err
        );
      }
    }

    if (!products.length) {

      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;">
          Featured drops coming soon.
        </div>
      `;

      return;
    }

    grid.innerHTML =
      products
        .map(productCard)
        .join('');

  } catch (err) {

    console.error(
      '[home-featured]',
      err
    );

    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:40px;">
        Unable to load featured drops.
      </div>
    `;
  }
}

loadFeatured();
