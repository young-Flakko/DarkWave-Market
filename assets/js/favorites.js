export const FAVORITES_STORAGE_KEY = 'dwm_favorites';
export const FAVORITES_EVENT = 'dwm:favorites-updated';

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((id) => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ];
}

export function getFavorites() {
  if (
    typeof window === 'undefined' ||
    !window.localStorage
  ) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        FAVORITES_STORAGE_KEY
      );

    if (!raw) return [];

    return normalizeIds(
      JSON.parse(raw)
    );
  } catch (error) {
    console.warn(
      '[favorites] Unable to read favorites.',
      error
    );

    return [];
  }
}

export function saveFavorites(ids) {
  const normalized =
    normalizeIds(ids);

  try {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(normalized)
    );

    window.dispatchEvent(
      new CustomEvent(
        FAVORITES_EVENT,
        {
          detail: {
            favorites: normalized
          }
        }
      )
    );

    return true;
  } catch (error) {
    console.warn(
      '[favorites] Unable to save favorites.',
      error
    );

    return false;
  }
}

export function isFavorite(productId) {
  return getFavorites().includes(
    String(productId || '')
  );
}

export function addFavorite(productId) {
  const id =
    String(productId || '').trim();

  if (!id) return false;

  const favorites =
    getFavorites();

  if (!favorites.includes(id)) {
    favorites.push(id);
  }

  return saveFavorites(favorites);
}

export function removeFavorite(productId) {
  const id =
    String(productId || '').trim();

  if (!id) return false;

  return saveFavorites(
    getFavorites().filter(
      (item) => item !== id
    )
  );
}

export function toggleFavorite(productId) {
  const id =
    String(productId || '').trim();

  if (!id) {
    return {
      ok: false,
      favorite: false
    };
  }

  const currentlyFavorite =
    isFavorite(id);

  const ok =
    currentlyFavorite
      ? removeFavorite(id)
      : addFavorite(id);

  return {
    ok,
    favorite: !currentlyFavorite
  };
}

export function getFavoriteCount() {
  return getFavorites().length;
}
