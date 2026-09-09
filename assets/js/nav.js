import { createParticleCanvas } from './particle-canvas.js';

import {
  CART_EVENT,
  getCartCount
} from './cart.js';

import {
  FAVORITES_EVENT,
  getFavoriteCount
} from './favorites.js';

import {
  initFavoriteButtons,
  refreshFavoriteButtons
} from './favorites-ui.js';

const currentPath = window.location.pathname.split('/').pop() || 'index.html';

const navLogoSessions = new WeakMap();

const THEME_KEY = 'dwm_theme';

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme) {
  const normalized =
    theme === 'light'
      ? 'light'
      : 'dark';

  document.documentElement.setAttribute(
    'data-theme',
    normalized
  );

  try {
    localStorage.setItem(
      THEME_KEY,
      normalized
    );
  } catch {
    // Ignore unavailable storage.
  }

  const heroLogo =
    document.querySelector(
      '[data-dwm-hero-logo]'
    );

  if (heroLogo) {
    heroLogo.src =
      normalized === 'light'
        ? '/assets/img/dwm-crest-light.png'
        : '/assets/img/dwm-crest-dark.png';
  }

  document
    .querySelectorAll('[data-dwm-theme-toggle]')
    .forEach((button) => {
      const isLight =
        normalized === 'light';

      button.textContent =
        isLight
          ? '☀'
          : '☾';

      button.setAttribute(
        'aria-label',
        isLight
          ? 'Switch to dark mode'
          : 'Switch to light mode'
      );

      button.setAttribute(
        'title',
        isLight
          ? 'Dark mode'
          : 'Light mode'
      );
    });
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute(
      'data-theme'
    ) || 'dark';

  applyTheme(
    current === 'light'
      ? 'dark'
      : 'light'
  );
}

if (typeof document !== 'undefined') {
  applyTheme(
    getSavedTheme()
  );
}

function isActive(path) {
  return currentPath === path ? 'nav-active' : '';
}

const NAV_LINKS = [
  { href: 'index.html', label: 'Home' },
  { href: 'shop.html', label: 'Shop' },
  { href: 'drops.html', label: 'Drops' },
  { href: 'brands.html', label: 'Brands' },
  { href: 'events.html', label: 'Events' },
  { href: 'about.html', label: 'About' },
  { href: 'account.html', label: 'Account' }
];

function refreshCartBadge(targetSelector = 'nav') {
  if (typeof document === 'undefined') return;
  const nav = document.querySelector(targetSelector);
  if (!nav) return;
  const badge = nav.querySelector('[data-dwm-cart-count]');
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count > 0 ? `CART (${count})` : 'CART';
}

export function renderNav(targetSelector = 'nav', { showCta = true, showIg = true, showCart = true } = {}) {
  const nav = document.querySelector(targetSelector);
  if (!nav) return;

  const linksHtml = NAV_LINKS.map(link =>
    `<li><a href="${link.href}" class="${isActive(link.href)}">${link.label}</a></li>`
  ).join('');

  const igHtml = showIg
    ? `<a href="https://www.instagram.com/darkwavemarket" target="_blank" rel="noopener" class="nav-ig">IG</a>`
    : '';

  const cartHtml = showCart
    ? `<a href="cart.html" class="nav-cart-link" data-dwm-cart-link="1" aria-label="View shopping cart" style="display:inline-flex;align-items:center;justify-content:center;padding:8px 14px;font-size:0.72rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--white);border:1px solid rgba(74,157,168,0.35);background:rgba(74,157,168,0.06);text-decoration:none;cursor:pointer;transition:all 0.25s ease;font-family:'Inter',system-ui,sans-serif;" onmouseover="this.style.borderColor='rgba(91,191,204,0.75)';this.style.color='var(--teal-bright)'" onmouseout="this.style.borderColor='rgba(74,157,168,0.35)';this.style.color='var(--white)'"><span data-dwm-cart-count="1">CART</span></a>`
    : '';

  const ctaHtml = showCta
    ? `<a href="shop.html" class="nav-cta">Shop Now</a>`
    : '';

  const themeHtml = `
    <button
      type="button"
      class="nav-theme-toggle"
      data-dwm-theme-toggle="1"
      aria-label="Switch theme"
      title="Switch theme"
    >
      ☾
    </button>
  `;

  nav.innerHTML = `
    <button
      type="button"
      class="nav-logo-wrap dwm-options-trigger"
      data-dwm-options-trigger="1"
      aria-label="Open Dark Wave options"
      aria-expanded="false"
    >
      <div class="nav-logo-inner">
        <div class="nav-logo-glow" aria-hidden="true"></div>
        <div class="nav-logo-canvas-slot" aria-hidden="true"></div>
        <img src="/assets/img/dwm-logo-new.png" alt="DWM Options" class="nav-logo-img" onerror="this.parentNode.replaceChild(Object.assign(document.createElement('span'),{className:'nav-logo-fallback',textContent:'DWM'}),this);">
      </div>
    </button>

    <div
      class="dwm-options-backdrop"
      data-dwm-options-backdrop="1"
      hidden
    ></div>

    <aside
      class="dwm-options-drawer"
      data-dwm-options-drawer="1"
      aria-hidden="true"
    >
      <div class="dwm-options-head">
        <div>
          <span class="dwm-options-kicker">
            Dark Wave
          </span>

          <strong>
            OPTIONS
          </strong>
        </div>

        <button
          type="button"
          class="dwm-options-close"
          data-dwm-options-close="1"
          aria-label="Close options"
        >
          ×
        </button>
      </div>

      <nav class="dwm-options-menu">
        <a href="index.html">
          <span>Home</span>
          <small>Return home</small>
        </a>

        <a href="favorites.html">
          <span>Saved Drops</span>
          <b data-dwm-favorite-count="1">0</b>
        </a>

        <a href="cart.html">
          <span>Cart</span>
          <b data-dwm-drawer-cart-count="1">0</b>
        </a>

        <a href="account.html">
          <span>Account</span>
          <small>Profile & orders</small>
        </a>

        <a href="shop.html">
          <span>Shop</span>
          <small>Browse the market</small>
        </a>

        <button
          type="button"
          data-dwm-drawer-theme="1"
        >
          <span>Appearance</span>
          <small>Switch theme</small>
        </button>
      </nav>
    </aside>

    <ul class="nav-links">${linksHtml}</ul>
    <div class="nav-actions">
      ${themeHtml}
      ${cartHtml}
      ${igHtml}
      ${ctaHtml}
    </div>
  `;

  refreshCartBadge(targetSelector);

  const themeToggle =
    nav.querySelector(
      '[data-dwm-theme-toggle]'
    );

  if (themeToggle) {
    themeToggle.addEventListener(
      'click',
      toggleTheme
    );
  }

  applyTheme(
    getSavedTheme()
  );

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener(CART_EVENT, () => refreshCartBadge(targetSelector));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshCartBadge(targetSelector);
    });
  }

  const optionsTrigger =
    nav.querySelector('[data-dwm-options-trigger]');

  const optionsDrawer =
    nav.querySelector('[data-dwm-options-drawer]');

  const optionsBackdrop =
    nav.querySelector('[data-dwm-options-backdrop]');

  const optionsClose =
    nav.querySelector('[data-dwm-options-close]');

  const drawerTheme =
    nav.querySelector('[data-dwm-drawer-theme]');

  function refreshOptionsCounts() {
    const favoriteCount =
      nav.querySelector('[data-dwm-favorite-count]');

    const drawerCartCount =
      nav.querySelector('[data-dwm-drawer-cart-count]');

    if (favoriteCount) {
      favoriteCount.textContent =
        String(getFavoriteCount());
    }

    if (drawerCartCount) {
      drawerCartCount.textContent =
        String(getCartCount());
    }
  }

  function setOptionsOpen(open) {
    if (!optionsDrawer || !optionsBackdrop) {
      return;
    }

    optionsDrawer.classList.toggle(
      'open',
      open
    );

    optionsBackdrop.hidden = !open;

    optionsBackdrop.classList.toggle(
      'open',
      open
    );

    optionsDrawer.setAttribute(
      'aria-hidden',
      open ? 'false' : 'true'
    );

    optionsTrigger?.setAttribute(
      'aria-expanded',
      open ? 'true' : 'false'
    );

    document.body.classList.toggle(
      'dwm-options-open',
      open
    );
  }

  optionsTrigger?.addEventListener(
    'click',
    () => {
      setOptionsOpen(
        !optionsDrawer?.classList.contains('open')
      );
    }
  );

  optionsClose?.addEventListener(
    'click',
    () => setOptionsOpen(false)
  );

  optionsBackdrop?.addEventListener(
    'click',
    () => setOptionsOpen(false)
  );

  drawerTheme?.addEventListener(
    'click',
    () => {
      toggleTheme();
      setOptionsOpen(false);
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        setOptionsOpen(false);
      }
    }
  );

  refreshOptionsCounts();

  initFavoriteButtons();
  refreshFavoriteButtons();

  window.addEventListener(
    CART_EVENT,
    refreshOptionsCounts
  );

  window.addEventListener(
    FAVORITES_EVENT,
    refreshOptionsCounts
  );

  const slot = nav.querySelector('.nav-logo-canvas-slot');
  if (slot && !navLogoSessions.has(nav)) {
    const inst = createParticleCanvas(slot, {
      count: 18,
      baseSpeed: 0.15,
      dotMin: 0.4,
      dotMax: 1.2,
      alphaMin: 0.08,
      alphaMax: 0.3,
      glowIntensity: 0.04,
      scanLine: false,
      zIndex: 1
    });
    navLogoSessions.set(nav, inst);
  }
}

export function highlightActiveNav() {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPath) {
      a.classList.add('nav-active');
    }
  });
}
