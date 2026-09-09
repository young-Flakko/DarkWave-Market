import {
  fetchAllLiveProducts,
  fetchActiveStoresByIds,
  makeProductCardHtml
} from './data.js';

import {
  addToCart
} from './cart.js';

import {
  FAVORITES_EVENT,
  getFavorites
} from './favorites.js';

import {
  initFavoriteButtons,
  refreshFavoriteButtons
} from './favorites-ui.js';

import {
  renderNav
} from './nav.js';


const grid =
  document.getElementById(
    'favoritesGrid'
  );

const count =
  document.getElementById(
    'favoritesCount'
  );


let productMap =
  new Map();

let storeMap =
  new Map();


function safeStock(product) {
  const stock =
    product?.data?.stock;

  return (
    Number.isInteger(stock) &&
    stock >= 0
  )
    ? stock
    : 0;
}


function storeNameFor(storeId) {
  const store =
    storeMap.get(storeId);

  return (
    store?.data?.name ||
    store?.data?.storeName ||
    store?.data?.slug ||
    'Store'
  );
}


function renderFavorites() {

  const ids =
    getFavorites();


  count.textContent =
    `${ids.length} ${
      ids.length === 1
        ? 'saved'
        : 'saved'
    }`;


  if (!ids.length) {

    grid.innerHTML = `
      <div class="favorites-empty">

        <h2>
          No saved drops yet.
        </h2>

        <p>
          Save drops from the Drops page and they will appear here.
        </p>

        <a
          href="drops.html"
          class="favorite-action primary"
          style="
            max-width:220px;
            margin:0 auto;
          "
        >
          Browse Drops
        </a>

      </div>
    `;

    return;
  }


  const products =
    ids
      .map((id) =>
        productMap.get(id)
      )
      .filter(Boolean);


  if (!products.length) {

    grid.innerHTML = `
      <div class="favorites-empty">

        <h2>
          Saved drops unavailable.
        </h2>

        <p>
          These drops may no longer be live.
        </p>

      </div>
    `;

    return;
  }


  grid.innerHTML =
    products
      .map((product) => {

        const d =
          product.data;

        const card =
          makeProductCardHtml(
            product,
            {
              storeName:
                storeNameFor(
                  d.storeId
                ),
              showBadge: true,
              showFavorite: true
            }
          );

        const soldOut =
          safeStock(product) <= 0;

        return `
          <div
            class="favorite-product"
            data-favorite-card="${product.id}"
          >
            ${card}

            <div class="favorite-actions">

              <a
                href="product.html?id=${encodeURIComponent(product.id)}"
                class="favorite-action"
              >
                View
              </a>

              <button
                type="button"
                class="favorite-action primary"
                data-favorite-add-cart="${product.id}"
                ${
                  soldOut
                    ? 'disabled'
                    : ''
                }
              >
                ${
                  soldOut
                    ? 'Sold Out'
                    : 'Add to Cart'
                }
              </button>

            </div>
          </div>
        `;

      })
      .join('');


  refreshFavoriteButtons();
}


async function init() {

  renderNav('nav');

  initFavoriteButtons();


  const products =
    await fetchAllLiveProducts();


  productMap =
    new Map(
      products.map(
        (product) => [
          product.id,
          product
        ]
      )
    );


  const storeIds =
    [
      ...new Set(
        products
          .map(
            (product) =>
              product?.data?.storeId
          )
          .filter(Boolean)
      )
    ];


  if (storeIds.length) {

    storeMap =
      await fetchActiveStoresByIds(
        storeIds
      );

  }


  renderFavorites();
}


grid.addEventListener(
  'click',
  (event) => {

    const button =
      event.target.closest(
        '[data-favorite-add-cart]'
      );

    if (!button) {
      return;
    }


    const productId =
      button.getAttribute(
        'data-favorite-add-cart'
      );


    const product =
      productMap.get(productId);


    if (!product) {
      return;
    }


    const d =
      product.data;


    const stock =
      safeStock(product);


    const result =
      addToCart(
        {
          productId:
            product.id,

          storeId:
            d.storeId,

          name:
            d.name ||
            'Product',

          price:
            Number(d.price),

          currency:
            d.currency ||
            'ZAR',

          imageUrl:
            d.imageUrl ||
            null,

          quantity: 1
        },
        {
          availableStock:
            stock
        }
      );


    if (result.ok) {

      button.textContent =
        'Added';

      window.setTimeout(
        () => {

          if (
            document.body.contains(
              button
            )
          ) {
            button.textContent =
              'Add to Cart';
          }

        },
        1100
      );

    }

  }
);


window.addEventListener(
  FAVORITES_EVENT,
  renderFavorites
);


init().catch(
  (error) => {

    console.error(
      'Unable to load favorites:',
      error
    );

    grid.innerHTML = `
      <div class="favorites-empty">

        <h2>
          Saved drops could not load.
        </h2>

        <p>
          Refresh the page and try again.
        </p>

      </div>
    `;

  }
);
