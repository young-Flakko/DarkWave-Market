import {
  fetchAllLiveProducts,
  fetchActiveStoresByIds,
  makeProductCardHtml,
  makeLoadingState,
  makeStateBlock,
  normalizeCategoryToLabel
} from './data.js';

import {
  renderNav
} from './nav.js';


/* =========================================================
   DOM
========================================================= */

const grid =
  document.getElementById('productGrid');

const searchInput =
  document.getElementById('shopSearch');

const clearSearchBtn =
  document.getElementById('clearSearch');

const filterToggle =
  document.getElementById('filterToggle');

const filterPanel =
  document.getElementById('filterPanel');

const resetBtn =
  document.getElementById('resetFilters');

const categoryFilter =
  document.getElementById('categoryFilter');

const storeFilter =
  document.getElementById('storeFilter');

const minPriceInput =
  document.getElementById('minPrice');

const maxPriceInput =
  document.getElementById('maxPrice');

const stockOnlyInput =
  document.getElementById('stockOnly');

const sortFilter =
  document.getElementById('sortFilter');

const resultsCount =
  document.getElementById('resultsCount');

const activeFilterLabel =
  document.getElementById('activeFilterLabel');

const heroProductCount =
  document.getElementById('heroProductCount');


/* =========================================================
   STATE
========================================================= */

let allProducts = [];

let storeMap =
  new Map();

let filteredProducts = [];


/* =========================================================
   START
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


  showLoading();


  try {

    allProducts =
      await fetchAllLiveProducts();


    const storeIds = [
      ...new Set(
        allProducts
          .map((product) => {
            return product?.data?.storeId;
          })
          .filter(Boolean)
      )
    ];


    if (storeIds.length) {

      storeMap =
        await fetchActiveStoresByIds(
          storeIds
        );

    }


    /*
      Only show products belonging to
      currently active stores.

      This prevents a live product from an
      inactive store appearing in Shop.
    */

    allProducts =
      allProducts.filter((product) => {

        const storeId =
          product?.data?.storeId;

        if (!storeId) {
          return false;
        }

        return storeMap.has(storeId);

      });


    heroProductCount.textContent =
      String(allProducts.length);


    buildCategoryOptions();

    buildStoreOptions();

    applyFilters();

  } catch (error) {

    console.error(
      'Unable to load DWM Shop:',
      error
    );


    heroProductCount.textContent = '0';


    grid.innerHTML = `
      <div class="shop-state">
        ${makeStateBlock(
          'error',
          'The market could not be loaded.',
          'Please refresh the page and try again.',
          {
            eyebrow: 'DWM Shop'
          }
        )}
      </div>
    `;

  }

}


/* =========================================================
   LOADING
========================================================= */

function showLoading() {

  grid.innerHTML = `
    <div class="shop-state">
      ${makeLoadingState(
        'Loading live products...'
      )}
    </div>
  `;

}


/* =========================================================
   CATEGORY OPTIONS
========================================================= */

function buildCategoryOptions() {

  const categories =
    new Set();


  allProducts.forEach((product) => {

    const category =
      product?.data?.category;

    if (!category) {
      return;
    }


    const label =
      normalizeCategoryToLabel(
        category
      );


    if (label) {
      categories.add(label);
    }

  });


  const sorted =
    [...categories].sort(
      (a, b) =>
        a.localeCompare(b)
    );


  categoryFilter.innerHTML = `
    <option value="">
      All Categories
    </option>
  `;


  sorted.forEach((category) => {

    const option =
      document.createElement(
        'option'
      );

    option.value =
      category;

    option.textContent =
      category;

    categoryFilter.appendChild(
      option
    );

  });

}


/* =========================================================
   STORE OPTIONS
========================================================= */

function buildStoreOptions() {

  const stores = [];


  storeMap.forEach(
    (store, storeId) => {

      const name =
        store?.data?.name ||
        store?.data?.storeName ||
        store?.data?.slug ||
        'Store';


      stores.push({
        id: storeId,
        name
      });

    }
  );


  stores.sort(
    (a, b) =>
      a.name.localeCompare(
        b.name
      )
  );


  storeFilter.innerHTML = `
    <option value="">
      All Stores
    </option>
  `;


  stores.forEach((store) => {

    const option =
      document.createElement(
        'option'
      );

    option.value =
      store.id;

    option.textContent =
      store.name;

    storeFilter.appendChild(
      option
    );

  });

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {

  return String(
    value ?? ''
  )
    .trim()
    .toLowerCase();

}


function getStock(product) {

  const raw =
    product?.data?.stock;


  if (
    Number.isInteger(raw) &&
    raw >= 0
  ) {
    return raw;
  }


  const converted =
    Number(raw);


  if (
    Number.isFinite(converted) &&
    converted >= 0
  ) {
    return Math.trunc(
      converted
    );
  }


  return 0;

}


function getPrice(product) {

  const price =
    Number(
      product?.data?.price
    );


  if (
    !Number.isFinite(price)
  ) {
    return 0;
  }


  return price;

}


function getStoreName(storeId) {

  if (!storeId) {
    return null;
  }


  const store =
    storeMap.get(
      storeId
    );


  if (!store) {
    return null;
  }


  return (
    store?.data?.name ||
    store?.data?.storeName ||
    store?.data?.slug ||
    null
  );

}


/* =========================================================
   FILTERING
========================================================= */

function applyFilters() {

  const search =
    normalizeText(
      searchInput.value
    );


  const selectedCategory =
    categoryFilter.value;


  const selectedStore =
    storeFilter.value;


  const minPriceRaw =
    minPriceInput.value.trim();


  const maxPriceRaw =
    maxPriceInput.value.trim();


  const minPrice =
    minPriceRaw === ''
      ? null
      : Number(minPriceRaw);


  const maxPrice =
    maxPriceRaw === ''
      ? null
      : Number(maxPriceRaw);


  const stockOnly =
    stockOnlyInput.checked;


  filteredProducts =
    allProducts.filter(
      (product) => {

        const data =
          product?.data || {};


        /* -------------------------
           SEARCH
        ------------------------- */

        if (search) {

          const storeName =
            getStoreName(
              data.storeId
            );


          const haystack =
            normalizeText([
              data.name,
              data.category,
              data.description,
              storeName
            ].join(' '));


          if (
            !haystack.includes(
              search
            )
          ) {
            return false;
          }

        }


        /* -------------------------
           CATEGORY
        ------------------------- */

        if (selectedCategory) {

          const categoryLabel =
            normalizeCategoryToLabel(
              data.category
            );


          if (
            categoryLabel !==
            selectedCategory
          ) {
            return false;
          }

        }


        /* -------------------------
           STORE
        ------------------------- */

        if (
          selectedStore &&
          data.storeId !==
            selectedStore
        ) {
          return false;
        }


        /* -------------------------
           PRICE
        ------------------------- */

        const price =
          getPrice(product);


        if (
          minPrice !== null &&
          Number.isFinite(minPrice) &&
          price < minPrice
        ) {
          return false;
        }


        if (
          maxPrice !== null &&
          Number.isFinite(maxPrice) &&
          price > maxPrice
        ) {
          return false;
        }


        /* -------------------------
           STOCK
        ------------------------- */

        if (
          stockOnly &&
          getStock(product) <= 0
        ) {
          return false;
        }


        return true;

      }
    );


  sortProducts();

  renderProducts();

  updateResultsBar();

  updateClearSearch();

}


/* =========================================================
   SORTING
========================================================= */

function sortProducts() {

  const mode =
    sortFilter.value;


  /*
    fetchAllLiveProducts already
    returns newest-first.

    For "newest" we preserve the
    original Firestore-derived order.
  */

  if (mode === 'newest') {

    const order =
      new Map();


    allProducts.forEach(
      (product, index) => {

        order.set(
          product.id,
          index
        );

      }
    );


    filteredProducts.sort(
      (a, b) => {

        return (
          (order.get(a.id) ?? 0) -
          (order.get(b.id) ?? 0)
        );

      }
    );


    return;

  }


  if (mode === 'price-low') {

    filteredProducts.sort(
      (a, b) =>
        getPrice(a) -
        getPrice(b)
    );


    return;

  }


  if (mode === 'price-high') {

    filteredProducts.sort(
      (a, b) =>
        getPrice(b) -
        getPrice(a)
    );


    return;

  }


  if (mode === 'name') {

    filteredProducts.sort(
      (a, b) => {

        const nameA =
          String(
            a?.data?.name || ''
          );


        const nameB =
          String(
            b?.data?.name || ''
          );


        return nameA.localeCompare(
          nameB
        );

      }
    );

  }

}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

  if (
    !filteredProducts.length
  ) {

    grid.innerHTML = `
      <div class="shop-state">
        ${makeStateBlock(
          'empty',
          'Nothing surfaced.',
          'No live products match the current filters. Try widening your search.',
          {
            eyebrow: 'DWM Shop'
          }
        )}
      </div>
    `;


    return;

  }


  const html =
    filteredProducts
      .map((product) => {

        const storeName =
          getStoreName(
            product?.data?.storeId
          );


        return makeProductCardHtml(
          product,
          {
            storeName,
            showBadge: true
          }
        );

      })
      .join('');


  grid.innerHTML =
    html;

}


/* =========================================================
   RESULT LABEL
========================================================= */

function updateResultsBar() {

  const count =
    filteredProducts.length;


  resultsCount.innerHTML = `
    <span>${count}</span>
    ${count === 1
      ? 'product'
      : 'products'}
  `;


  const active = [];


  if (
    searchInput.value.trim()
  ) {
    active.push('Search');
  }


  if (
    categoryFilter.value
  ) {
    active.push(
      categoryFilter.value
    );
  }


  if (
    storeFilter.value
  ) {

    const store =
      storeMap.get(
        storeFilter.value
      );


    const storeName =
      store?.data?.name ||
      store?.data?.storeName ||
      store?.data?.slug;


    if (storeName) {
      active.push(
        storeName
      );
    }

  }


  if (
    minPriceInput.value.trim() ||
    maxPriceInput.value.trim()
  ) {
    active.push('Price');
  }


  if (
    stockOnlyInput.checked
  ) {
    active.push('In Stock');
  }


  activeFilterLabel.textContent =
    active.length
      ? active.join(' / ')
      : 'All live listings';

}


/* =========================================================
   SEARCH UI
========================================================= */

function updateClearSearch() {

  const hasSearch =
    searchInput.value
      .trim()
      .length > 0;


  clearSearchBtn.classList.toggle(
    'show',
    hasSearch
  );

}


/* =========================================================
   RESET
========================================================= */

function resetFilters() {

  searchInput.value = '';

  categoryFilter.value = '';

  storeFilter.value = '';

  minPriceInput.value = '';

  maxPriceInput.value = '';

  stockOnlyInput.checked = false;

  sortFilter.value = 'newest';


  applyFilters();

}


/* =========================================================
   EVENTS
========================================================= */

searchInput.addEventListener(
  'input',
  applyFilters
);


clearSearchBtn.addEventListener(
  'click',
  () => {

    searchInput.value = '';

    searchInput.focus();

    applyFilters();

  }
);


filterToggle.addEventListener(
  'click',
  () => {

    const isOpen =
      filterPanel.classList.toggle(
        'open'
      );


    filterToggle.classList.toggle(
      'active',
      isOpen
    );


    filterToggle.textContent =
      isOpen
        ? 'Close Filters'
        : 'Filters';

  }
);


resetBtn.addEventListener(
  'click',
  resetFilters
);


categoryFilter.addEventListener(
  'change',
  applyFilters
);


storeFilter.addEventListener(
  'change',
  applyFilters
);


minPriceInput.addEventListener(
  'input',
  applyFilters
);


maxPriceInput.addEventListener(
  'input',
  applyFilters
);


stockOnlyInput.addEventListener(
  'change',
  applyFilters
);


sortFilter.addEventListener(
  'change',
  applyFilters
);


/* =========================================================
   GO
========================================================= */

init();