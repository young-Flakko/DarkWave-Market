import {
  FAVORITES_EVENT,
  getFavorites,
  toggleFavorite
} from './favorites.js';

function refreshButtons() {
  const favorites = new Set(
    getFavorites()
  );

  document
    .querySelectorAll(
      '[data-dwm-favorite-product]'
    )
    .forEach((button) => {
      const productId =
        String(
          button.getAttribute(
            'data-dwm-favorite-product'
          ) || ''
        );

      const active =
        favorites.has(productId);

      button.classList.toggle(
        'is-favorite',
        active
      );

      button.textContent =
        active
          ? '♥'
          : '♡';

      button.setAttribute(
        'aria-pressed',
        active
          ? 'true'
          : 'false'
      );

      button.setAttribute(
        'title',
        active
          ? 'Remove from favorites'
          : 'Save to favorites'
      );
    });
}

let initialized = false;

export function initFavoriteButtons() {
  if (initialized) {
    refreshButtons();
    return;
  }

  initialized = true;

  document.addEventListener(
    'click',
    (event) => {
      const button =
        event.target.closest(
          '[data-dwm-favorite-product]'
        );

      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const productId =
        button.getAttribute(
          'data-dwm-favorite-product'
        );

      if (!productId) {
        return;
      }

      toggleFavorite(productId);

      refreshButtons();
    }
  );

  window.addEventListener(
    FAVORITES_EVENT,
    refreshButtons
  );

  refreshButtons();
}

export function refreshFavoriteButtons() {
  refreshButtons();
}
