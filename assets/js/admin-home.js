import { db } from './firebase-config.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';

import { requireAdmin } from './auth.js';
import { renderNav } from './nav.js';

renderNav('nav');

const $ = id => document.getElementById(id);

let products = [];

function productLabel(product) {
  return `${product.name || 'Untitled'} — R ${Number(product.price || 0).toFixed(2)}`;
}

function populateProducts() {
  const html = [
    `<option value="">Not selected</option>`,
    ...products.map(product => `
      <option value="${product.id}">
        ${productLabel(product)}
      </option>
    `)
  ].join('');

  for (let i = 0; i < 5; i++) {
    $(`slot${i}`).innerHTML = html;
  }
}

async function loadHome() {

  $('status').textContent =
    'Loading homepage settings...';

  const [productsSnap, homeSnap] =
    await Promise.all([

      getDocs(
        collection(db, 'products')
      ),

      getDoc(
        doc(db, 'siteContent', 'home')
      )

    ]);

  products =
    productsSnap.docs
      .map(d => ({
        id:d.id,
        ...d.data()
      }))
      .filter(product =>
        product.status === 'live'
      )
      .sort((a,b) =>
        String(a.name || '')
          .localeCompare(String(b.name || ''))
      );

  populateProducts();

  if (homeSnap.exists()) {

    const data =
      homeSnap.data();

    $('sectionLabel').value =
      data.sectionLabel ||
      'Latest';

    $('sectionTitle').value =
      data.sectionTitle ||
      'Fresh from the market.';

    const slots =
      Array.isArray(data.featuredProductIds)
        ? data.featuredProductIds
        : [];

    for (let i = 0; i < 5; i++) {
      $(`slot${i}`).value =
        slots[i] || '';
    }
  }

  $('status').textContent = '';
}

$('homeForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const button =
      $('saveHome');

    try {

      button.disabled = true;
      button.textContent = 'Saving...';

      const featuredProductIds =
        [0,1,2,3,4]
          .map(i =>
            $(`slot${i}`).value
          );

      await setDoc(
        doc(db, 'siteContent', 'home'),
        {
          sectionLabel:
            $('sectionLabel').value.trim() ||
            'Latest',

          sectionTitle:
            $('sectionTitle').value.trim() ||
            'Fresh from the market.',

          featuredProductIds,

          updatedAt:
            serverTimestamp()
        },
        {
          merge:true
        }
      );

      $('status').textContent =
        'Homepage updated ✓';

    } catch (err) {

      console.error(
        '[admin-home]',
        err
      );

      $('status').textContent =
        err.message ||
        'Unable to save homepage.';

    } finally {

      button.disabled = false;
      button.textContent =
        'Save Home Page';
    }
  }
);

requireAdmin(loadHome);
