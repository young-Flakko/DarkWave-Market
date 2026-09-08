import { createParticleCanvas } from './particle-canvas.js';

import {
  CART_EVENT,
  getCartCount
} from './cart.js';

const currentPath = window.location.pathname.split('/').pop() || 'index.html';

const navLogoSessions = new WeakMap();

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

  nav.innerHTML = `
    <a href="index.html" class="nav-logo-wrap" aria-label="Darkwave Market Home">
      <div class="nav-logo-inner">
        <div class="nav-logo-glow" aria-hidden="true"></div>
        <div class="nav-logo-canvas-slot" aria-hidden="true"></div>
        <img src="/assets/img/dwm-logo-new.png" alt="DWM" class="nav-logo-img" onerror="this.parentNode.replaceChild(Object.assign(document.createElement('span'),{className:'nav-logo-fallback',textContent:'DWM'}),this);">
      </div>
    </a>
    <ul class="nav-links">${linksHtml}</ul>
    <div style="display:flex;gap:12px;align-items:center;">
      ${cartHtml}
      ${igHtml}
      ${ctaHtml}
    </div>
  `;

  refreshCartBadge(targetSelector);

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener(CART_EVENT, () => refreshCartBadge(targetSelector));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshCartBadge(targetSelector);
    });
  }

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
