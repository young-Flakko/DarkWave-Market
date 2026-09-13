import { db } from './firebase-config.js';
import { collection, getDocs } from 'firebase/firestore';
import { requireAdmin } from './auth.js';
import { renderNav } from './nav.js';

renderNav('nav');

const $ = id => document.getElementById(id);

function money(value) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusRows(map, total) {
  if (!map.size) return '<div class="rank-meta">No data yet.</div>';

  return [...map.entries()]
    .sort((a,b) => b[1] - a[1])
    .map(([name,count]) => {
      const percentage = total ? (count / total) * 100 : 0;

      return `
        <div class="breakdown-row">
          <div class="breakdown-top">
            <span>${esc(String(name).replaceAll('_',' '))}</span>
            <strong>${count}</strong>
          </div>

          <div class="bar-track">
            <div
              class="bar-fill"
              style="width:${Math.max(percentage, 1)}%"
            ></div>
          </div>
        </div>
      `;
    }).join('');
}

async function loadAnalytics() {
  $('analyticsStatus').textContent = 'Loading marketplace data...';

  try {
    const [ordersSnap, usersSnap, storesSnap, productsSnap] =
      await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'stores')),
        getDocs(collection(db, 'products'))
      ]);

    const orders = ordersSnap.docs.map(d => ({
      id:d.id,
      ...d.data()
    }));

    const users = usersSnap.docs.map(d => ({
      id:d.id,
      ...d.data()
    }));

    const stores = storesSnap.docs.map(d => ({
      id:d.id,
      ...d.data()
    }));

    const products = productsSnap.docs.map(d => ({
      id:d.id,
      ...d.data()
    }));

    const storeMap = new Map(
      stores.map(s => [
        s.id,
        s.name || s.storeName || s.id
      ])
    );

    const productMap = new Map(
      products.map(p => [
        p.id,
        p.name || p.id
      ])
    );

    let totalValue = 0;
    let paidRevenue = 0;
    let units = 0;

    const orderStatuses = new Map();
    const paymentStatuses = new Map();

    const storePerformance = new Map();
    const productPerformance = new Map();

    for (const order of orders) {
      const total = Number(order.total) || 0;
      totalValue += total;

      const paymentStatus =
        String(order.paymentStatus || 'unknown').toLowerCase();

      const orderStatus =
        String(order.orderStatus || 'unknown').toLowerCase();

      paymentStatuses.set(
        paymentStatus,
        (paymentStatuses.get(paymentStatus) || 0) + 1
      );

      orderStatuses.set(
        orderStatus,
        (orderStatuses.get(orderStatus) || 0) + 1
      );

      if (
        ['paid','completed','succeeded'].includes(paymentStatus)
      ) {
        paidRevenue += total;
      }

      units += Number(order.itemCount) || 0;

      const items = Array.isArray(order.items)
        ? order.items
        : [];

      for (const item of items) {
        const qty = Math.max(0, Number(item.quantity) || 0);

        const unitPrice =
          Number(item.unitPrice ?? item.price) || 0;

        const itemValue = qty * unitPrice;

        const storeId = item.storeId || 'unknown';

        if (!storePerformance.has(storeId)) {
          storePerformance.set(storeId, {
            value:0,
            units:0
          });
        }

        const storeRow = storePerformance.get(storeId);
        storeRow.value += itemValue;
        storeRow.units += qty;

        const productId =
          item.productId ||
          item.id ||
          item.name ||
          'unknown';

        if (!productPerformance.has(productId)) {
          productPerformance.set(productId, {
            name:
              item.name ||
              productMap.get(productId) ||
              'Unknown Product',
            value:0,
            units:0
          });
        }

        const productRow = productPerformance.get(productId);
        productRow.value += itemValue;
        productRow.units += qty;
      }
    }

    const customers =
      users.filter(u =>
        !u.role || u.role === 'customer'
      ).length;

    const resellers =
      users.filter(u =>
        u.role === 'reseller'
      ).length;

    const liveProducts =
      products.filter(p =>
        p.status === 'live'
      ).length;

    $('paidRevenue').textContent =
      money(paidRevenue);

    $('orderValue').textContent =
      money(totalValue);

    $('orderCount').textContent =
      orders.length;

    $('averageOrder').textContent =
      money(
        orders.length
          ? totalValue / orders.length
          : 0
      );

    $('userCount').textContent =
      users.length;

    $('userNote').textContent =
      `${customers} customers · ${resellers} resellers`;

    $('storeCount').textContent =
      stores.length;

    $('productCount').textContent =
      products.length;

    $('productNote').textContent =
      `${liveProducts} live`;

    $('unitsOrdered').textContent =
      units;

    $('orderBreakdown').innerHTML =
      statusRows(orderStatuses, orders.length);

    $('paymentBreakdown').innerHTML =
      statusRows(paymentStatuses, orders.length);

    const topStores =
      [...storePerformance.entries()]
        .sort((a,b) => b[1].value - a[1].value)
        .slice(0,5);

    $('topStores').innerHTML =
      topStores.length
        ? topStores.map(([id,row], index) => `
            <div class="rank-row">
              <div class="rank-num">${index + 1}</div>

              <div>
                <div class="rank-name">
                  ${esc(storeMap.get(id) || id)}
                </div>

                <div class="rank-meta">
                  ${row.units} units
                </div>
              </div>

              <div class="rank-value">
                ${esc(money(row.value))}
              </div>
            </div>
          `).join('')
        : '<div class="rank-meta">No order data yet.</div>';

    const topProducts =
      [...productPerformance.values()]
        .sort((a,b) => {
          if (b.units !== a.units)
            return b.units - a.units;

          return b.value - a.value;
        })
        .slice(0,5);

    $('topProducts').innerHTML =
      topProducts.length
        ? topProducts.map((row,index) => `
            <div class="rank-row">
              <div class="rank-num">${index + 1}</div>

              <div>
                <div class="rank-name">
                  ${esc(row.name)}
                </div>

                <div class="rank-meta">
                  ${row.units} units ordered
                </div>
              </div>

              <div class="rank-value">
                ${esc(money(row.value))}
              </div>
            </div>
          `).join('')
        : '<div class="rank-meta">No product order data yet.</div>';

    $('analyticsStatus').textContent =
      `Updated from ${orders.length} orders, ${users.length} users, ${stores.length} stores and ${products.length} products.`;

  } catch (err) {
    console.error('[admin-analytics]', err);

    $('analyticsStatus').textContent =
      err.message || 'Unable to load analytics.';
  }
}

$('refreshAnalytics')
  .addEventListener('click', loadAnalytics);

requireAdmin(loadAnalytics);
