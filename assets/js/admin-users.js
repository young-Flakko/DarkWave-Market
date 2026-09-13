import { db } from './firebase-config.js';

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

import { requireAdmin } from './auth.js';
import { renderNav } from './nav.js';

renderNav('nav');

const list = document.getElementById('usersList');
const status = document.getElementById('usersStatus');
const search = document.getElementById('userSearch');
const filter = document.getElementById('userFilter');
const refresh = document.getElementById('refreshUsers');

let users = [];
let currentAdmin = null;
let storesByOwner = new Map();

const esc = value =>
  String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

function roleOf(user) {
  return ['customer','reseller','admin'].includes(user.role)
    ? user.role
    : 'customer';
}

function updateStats() {
  document.getElementById('statUsers').textContent = users.length;
  document.getElementById('statCustomers').textContent =
    users.filter(u => roleOf(u) === 'customer').length;
  document.getElementById('statResellers').textContent =
    users.filter(u => roleOf(u) === 'reseller').length;
  document.getElementById('statAdmins').textContent =
    users.filter(u => roleOf(u) === 'admin').length;
}

async function loadStores() {
  storesByOwner = new Map();

  const snap = await getDocs(collection(db,'stores'));

  snap.forEach(storeSnap => {
    const store = {
      id: storeSnap.id,
      ...storeSnap.data()
    };

    if (!store.ownerUid) return;

    if (!storesByOwner.has(store.ownerUid)) {
      storesByOwner.set(store.ownerUid,[]);
    }

    storesByOwner.get(store.ownerUid).push(store);
  });
}

function renderUser(user) {
  const role = roleOf(user);
  const ownAccount = user.id === currentAdmin.uid;
  const stores = storesByOwner.get(user.id) || [];

  const card = document.createElement('article');
  card.className = 'user-card';

  card.innerHTML = `
    <section class="user-main">
      <div class="user-name">
        ${esc(user.displayName || 'DWM User')}
      </div>

      <div class="user-email">
        ${esc(user.email || 'No email stored')}
      </div>

      <span class="user-pill">
        ${esc(role)}
      </span>

      <div class="user-meta">
        UID: ${esc(user.id)}
        <br>
        Stores: ${stores.length}
        ${
          stores.length
            ? `<br>${stores.map(s => esc(s.name || s.id)).join('<br>')}`
            : ''
        }
      </div>
    </section>

    <section class="user-control">
      <div class="user-label">Access Level</div>

      <select class="user-role" ${ownAccount ? 'disabled' : ''}>
        <option value="customer" ${role === 'customer' ? 'selected' : ''}>Customer</option>
        <option value="reseller" ${role === 'reseller' ? 'selected' : ''}>Reseller</option>
        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Administrator</option>
      </select>

      <button
        type="button"
        class="btn-primary save-role"
        ${ownAccount ? 'disabled' : ''}
      >
        Save Role
      </button>

      <div class="user-message">
        ${ownAccount ? 'Your own admin role is locked.' : ''}
      </div>
    </section>
  `;

  if (!ownAccount) {
    const select = card.querySelector('.user-role');
    const button = card.querySelector('.save-role');
    const message = card.querySelector('.user-message');

    button.addEventListener('click', async () => {
      const nextRole = select.value;

      if (nextRole === roleOf(user)) {
        message.textContent = 'No changes';
        return;
      }

      button.disabled = true;
      select.disabled = true;
      message.textContent = 'Saving...';

      try {
        await updateDoc(
          doc(db,'users',user.id),
          {
            role: nextRole,
            updatedAt: serverTimestamp()
          }
        );

        user.role = nextRole;
        message.textContent = 'Role updated ✓';
        updateStats();

      } catch (error) {
        console.error('[admin-users]',error);
        message.textContent = 'Update failed';
      }

      button.disabled = false;
      select.disabled = false;
    });
  }

  list.appendChild(card);
}

function renderUsers() {
  const q = search.value.trim().toLowerCase();
  const selectedRole = filter.value;

  const visible = users.filter(user => {
    const stores = storesByOwner.get(user.id) || [];

    const haystack = [
      user.displayName,
      user.email,
      user.id,
      ...stores.map(store => store.name)
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return (
      (!q || haystack.includes(q))
      &&
      (selectedRole === 'all' || roleOf(user) === selectedRole)
    );
  });

  list.innerHTML = '';

  visible.forEach(renderUser);

  status.textContent =
    `${visible.length} user${visible.length === 1 ? '' : 's'} shown`;
}

async function loadUsers() {
  refresh.disabled = true;
  status.textContent = 'Loading users...';

  try {
    await loadStores();

    const snap = await getDocs(collection(db,'users'));

    users = snap.docs.map(userSnap => ({
      id: userSnap.id,
      ...userSnap.data()
    }));

    users.sort((a,b) =>
      String(a.displayName || a.email || '')
        .localeCompare(String(b.displayName || b.email || ''))
    );

    updateStats();
    renderUsers();

  } catch (error) {
    console.error('[admin-users]',error);
    status.textContent = 'Unable to load users.';
  }

  refresh.disabled = false;
}

search.addEventListener('input',renderUsers);
filter.addEventListener('change',renderUsers);
refresh.addEventListener('click',loadUsers);

requireAdmin(async user => {
  currentAdmin = user;
  await loadUsers();
});
