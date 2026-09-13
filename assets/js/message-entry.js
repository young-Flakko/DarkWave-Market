import {
  auth
} from './firebase-config.js';

import {
  getOrCreateConversation
} from './messages.js';


let initialized = false;


function setButtonState(
  button,
  state,
  text
) {

  if (!button) return;

  button.disabled =
    state === 'loading';

  const label =
    button.querySelector(
      '.btn-message-seller-label'
    );

  if (label) {
    label.textContent = text;
  } else {
    button.textContent = text;
  }

}


async function openSellerConversation(
  button
) {

  const user =
    auth.currentUser;


  if (!user) {

    window.location.href =
      '/login.html';

    return;

  }


  const sellerUid =
    button.dataset.sellerUid || '';

  const storeId =
    button.dataset.storeId || '';

  const storeName =
    button.dataset.storeName || '';

  const productId =
    button.dataset.productId || '';

  const productName =
    button.dataset.productName || '';


  if (
    !sellerUid ||
    !storeId
  ) {

    console.error(
      '[message-entry] Missing seller/store information.'
    );

    setButtonState(
      button,
      'ready',
      'Messaging Unavailable'
    );

    return;

  }


  if (
    sellerUid === user.uid
  ) {

    setButtonState(
      button,
      'ready',
      'This Is Your Store'
    );

    return;

  }


  setButtonState(
    button,
    'loading',
    'Opening Messages...'
  );


  try {

    const conversationId =
      await getOrCreateConversation({
        buyerUid:
          user.uid,

        buyerName:
          user.displayName ||
          'DWM Customer',

        sellerUid,
        storeId,
        storeName,
        productId,
        productName
      });


    window.location.href =
      `/messages.html?conversation=${encodeURIComponent(
        conversationId
      )}`;

  } catch (error) {

    console.error(
      '[message-entry] Unable to open conversation:',
      error
    );


    setButtonState(
      button,
      'ready',
      'Message Seller'
    );


    alert(
      'Unable to open messages right now.'
    );

  }

}


export function initMessageSellerButtons() {

  if (initialized) {
    return;
  }


  initialized = true;


  document.addEventListener(
    'click',
    (event) => {

      const button =
        event.target.closest(
          '[data-dwm-message-seller]'
        );


      if (!button) {
        return;
      }


      event.preventDefault();


      openSellerConversation(
        button
      );

    }
  );

}
