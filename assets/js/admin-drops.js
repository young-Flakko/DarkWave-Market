import { db } from './firebase-config.js';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

import { requireAdmin } from './auth.js';
import { renderNav } from './nav.js';

renderNav('nav');

let products = [];
let stores = [];
let storesById = new Map();

const grid = document.getElementById('productsGrid');
const statusEl = document.getElementById('productsStatus');

const searchEl = document.getElementById('productSearch');
const statusFilter = document.getElementById('statusFilter');
const storeFilter = document.getElementById('storeFilter');

const modal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const form = document.getElementById('productForm');
const formStatus = document.getElementById('formStatus');

const editingId = document.getElementById('editingProductId');
const nameEl = document.getElementById('productName');
const storeEl = document.getElementById('productStore');
const categoryEl = document.getElementById('productCategory');
const priceEl = document.getElementById('productPrice');
const stockEl = document.getElementById('productStock');
const dropEl = document.getElementById('dropNumber');
const productStatusEl = document.getElementById('productStatus');
const imageEl = document.getElementById('productImageUrl');
const descriptionEl = document.getElementById('productDescription');

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(Number(value) || 0);
}

function storeName(id) {
  return storesById.get(id)?.name || storesById.get(id)?.storeName || id || 'Unknown Store';
}

function updateStats() {
  document.getElementById('statTotal').textContent = products.length;

  document.getElementById('statLive').textContent =
    products.filter(p => p.status === 'live').length;

  document.getElementById('statDraft').textContent =
    products.filter(p => p.status === 'draft').length;

  document.getElementById('statSold').textContent =
    products.filter(p => p.status === 'sold_out').length;
}

function filteredProducts() {
  const term = searchEl.value.trim().toLowerCase();
  const wantedStatus = statusFilter.value;
  const wantedStore = storeFilter.value;

  return products.filter(product => {
    const haystack = [
      product.name,
      product.category,
      storeName(product.storeId)
    ].join(' ').toLowerCase();

    if (term && !haystack.includes(term)) return false;
    if (wantedStatus && product.status !== wantedStatus) return false;
    if (wantedStore && product.storeId !== wantedStore) return false;

    return true;
  });
}

function render() {
  updateStats();

  const rows = filteredProducts();

  if (!rows.length) {
    grid.innerHTML = `
      <div class="empty">
        No products match the current filters.
      </div>
    `;
    return;
  }

  grid.innerHTML = rows.map(product => {
    const image =
      product.imageUrl ||
      '/assets/img/dwm-logo-new.webp';

    const status =
      product.status || 'draft';

    return `
      <article class="product-card">

        <img
          class="product-image"
          src="${esc(image)}"
          alt="${esc(product.name || 'Product')}"
          onerror="this.onerror=null;this.src='/assets/img/dwm-logo-new.webp'"
        >

        <div class="product-body">

          <div class="product-top">
            <div>
              <div class="product-name">
                ${esc(product.name || 'Untitled')}
              </div>

              <div class="product-store">
                ${esc(storeName(product.storeId))}
              </div>
            </div>

            <span class="badge badge-${esc(status)}">
              ${esc(status.replace('_', ' '))}
            </span>
          </div>

          <div class="product-meta">

            <div class="meta">
              <small>Price</small>
              ${esc(money(product.price))}
            </div>

            <div class="meta">
              <small>Stock</small>
              ${Number(product.stock) || 0}
            </div>

            <div class="meta">
              <small>Category</small>
              ${esc(product.category || '—')}
            </div>

            <div class="meta">
              <small>Drop</small>
              #${Number(product.dropNumber) || 1}
            </div>

          </div>

          <div class="card-actions">
            <button
              class="admin-btn"
              data-edit="${esc(product.id)}"
            >
              Edit
            </button>

            <button
              class="admin-btn danger"
              data-delete="${esc(product.id)}"
            >
              Delete
            </button>
          </div>

        </div>

      </article>
    `;
  }).join('');
}

function populateStores() {
  const options = stores.map(store => `
    <option value="${esc(store.id)}">
      ${esc(store.name || store.storeName || store.id)}
    </option>
  `).join('');

  storeEl.innerHTML =
    `<option value="">Select Store</option>${options}`;

  storeFilter.innerHTML =
    `<option value="">All Stores</option>${options}`;
}

async function loadData() {
  statusEl.textContent = 'Loading products...';

  try {
    const [productSnap, storeSnap] = await Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'stores'))
    ]);

    stores = storeSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    storesById = new Map(
      stores.map(store => [store.id, store])
    );

    products = productSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    products.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    populateStores();
    render();

    statusEl.textContent = '';

  } catch (err) {
    console.error('[admin-drops] load error:', err);
    statusEl.textContent =
      err.message || 'Unable to load products.';
  }
}

function resetForm() {
  form.reset();
  editingId.value = '';
  dropEl.value = '1';
  stockEl.value = '0';
  productStatusEl.value = 'draft';
  formStatus.textContent = '';
}

function openCreate() {
  resetForm();
  modalTitle.textContent = 'Add Product';
  modal.classList.add('open');
}

function openEdit(id) {
  const product = products.find(p => p.id === id);
  if (!product) return;

  resetForm();

  editingId.value = product.id;
  nameEl.value = product.name || '';
  storeEl.value = product.storeId || '';
  categoryEl.value = product.category || '';
  priceEl.value = Number(product.price) || 0;
  stockEl.value = Number(product.stock) || 0;
  dropEl.value = Number(product.dropNumber) || 1;
  productStatusEl.value = product.status || 'draft';
  imageEl.value = product.imageUrl || '';
  descriptionEl.value = product.description || '';

  modalTitle.textContent = 'Edit Product';
  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
}

form.addEventListener('submit', async event => {
  event.preventDefault();

  const id = editingId.value.trim();

  const price = Number(priceEl.value);
  const stock = Number(stockEl.value);
  const dropNumber = Number(dropEl.value);

  if (!nameEl.value.trim()) return;
  if (!storeEl.value) return;
  if (!categoryEl.value) return;

  if (!Number.isFinite(price) || price < 0) {
    formStatus.textContent = 'Enter a valid price.';
    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    formStatus.textContent = 'Stock must be zero or higher.';
    return;
  }

  if (!Number.isInteger(dropNumber) || dropNumber < 1) {
    formStatus.textContent = 'Drop number must be at least 1.';
    return;
  }

  const payload = {
    name: nameEl.value.trim(),
    category: categoryEl.value,
    price,
    currency: 'ZAR',
    dropNumber,
    stock,
    description: descriptionEl.value.trim(),
    status: productStatusEl.value,
    storeId: storeEl.value,
    imageUrl: imageEl.value.trim(),
    updatedAt: serverTimestamp()
  };

  const saveButton = document.getElementById('saveProduct');

  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    formStatus.textContent = '';

    if (id) {
      await updateDoc(
        doc(db, 'products', id),
        payload
      );

      formStatus.textContent = 'Product updated.';
    } else {
      await addDoc(
        collection(db, 'products'),
        {
          ...payload,
          media: [],
          createdAt: serverTimestamp()
        }
      );

      formStatus.textContent = 'Product created.';
    }

    await loadData();
    closeModal();

  } catch (err) {
    console.error('[admin-drops] save error:', err);

    formStatus.textContent =
      err.message || 'Unable to save product.';

  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Product';
  }
});

grid.addEventListener('click', async event => {
  const editButton = event.target.closest('[data-edit]');
  const deleteButton = event.target.closest('[data-delete]');

  if (editButton) {
    openEdit(editButton.dataset.edit);
    return;
  }

  if (!deleteButton) return;

  const id = deleteButton.dataset.delete;
  const product = products.find(p => p.id === id);

  if (!product) return;

  const confirmed = window.confirm(
    `Delete "${product.name || 'this product'}" permanently?`
  );

  if (!confirmed) return;

  try {
    deleteButton.disabled = true;

    await deleteDoc(
      doc(db, 'products', id)
    );

    await loadData();

  } catch (err) {
    console.error('[admin-drops] delete error:', err);
    alert(err.message || 'Unable to delete product.');
  }
});

document.getElementById('addProduct')
  .addEventListener('click', openCreate);

document.getElementById('closeModal')
  .addEventListener('click', closeModal);

document.getElementById('cancelForm')
  .addEventListener('click', closeModal);

document.getElementById('refreshProducts')
  .addEventListener('click', loadData);

searchEl.addEventListener('input', render);
statusFilter.addEventListener('change', render);
storeFilter.addEventListener('change', render);

modal.addEventListener('click', event => {
  if (event.target === modal) closeModal();
});

requireAdmin(async () => {
  await loadData();
});
