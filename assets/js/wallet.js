import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore';

import {
  onAuthStateChanged
} from 'firebase/auth';

import {
  auth,
  db
} from './firebase-config.js';

import {
  renderNav
} from './nav.js';


renderNav('nav');


const walletBalance =
  document.getElementById(
    'walletBalance'
  );

const walletStatus =
  document.getElementById(
    'walletStatus'
  );

const walletActivity =
  document.getElementById(
    'walletActivity'
  );


function money(value) {

  const amount =
    Number(value) || 0;

  return new Intl.NumberFormat(
    'en-ZA',
    {
      style: 'currency',
      currency: 'ZAR'
    }
  ).format(amount);

}


function dateLabel(value) {

  if (
    !value ||
    typeof value.toDate !==
    'function'
  ) {
    return 'Pending date';
  }


  return value
    .toDate()
    .toLocaleString(
      'en-ZA',
      {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    );

}


function escapeHtml(value) {

  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


function renderTransactions(
  transactions
) {

  if (!transactions.length) {

    walletActivity.innerHTML = `
      <div class="wallet-empty">
        No wallet activity yet.
      </div>
    `;

    return;
  }


  walletActivity.innerHTML =
    transactions
      .map(
        (transaction) => {

          const amount =
            Number(
              transaction.amount || 0
            );

          const positive =
            amount >= 0;

          const title =
            transaction.description ||
            transaction.title ||
            transaction.type ||
            'Wallet activity';

          const reference =
            transaction.reference
              ? ` · ${escapeHtml(
                  transaction.reference
                )}`
              : '';

          return `
            <div class="wallet-transaction">

              <div>

                <p class="wallet-transaction-title">
                  ${escapeHtml(title)}
                </p>

                <div class="wallet-transaction-meta">
                  ${escapeHtml(
                    dateLabel(
                      transaction.createdAt
                    )
                  )}
                  ${reference}
                </div>

              </div>


              <div
                class="
                  wallet-transaction-amount
                  ${
                    positive
                      ? 'wallet-positive'
                      : 'wallet-negative'
                  }
                "
              >
                ${
                  positive
                    ? '+'
                    : ''
                }${money(amount)}
              </div>

            </div>
          `;

        }
      )
      .join('');

}


let stopWallet =
  () => {};

let stopTransactions =
  () => {};


onAuthStateChanged(
  auth,
  (user) => {

    stopWallet();
    stopTransactions();

    stopWallet =
      () => {};

    stopTransactions =
      () => {};


    if (!user) {

      window.location.href =
        '/account.html';

      return;
    }


    const walletRef =
      doc(
        db,
        'wallets',
        user.uid
      );


    stopWallet =
      onSnapshot(
        walletRef,
        (snapshot) => {

          if (!snapshot.exists()) {

            walletBalance.textContent =
              money(0);

            walletStatus.textContent =
              'No Credit Yet';

            return;
          }


          const wallet =
            snapshot.data();


          walletBalance.textContent =
            money(
              wallet.balance || 0
            );


          walletStatus.textContent =
            wallet.status ===
            'suspended'
              ? 'Wallet Suspended'
              : 'Wallet Active';

        },
        (error) => {

          console.error(
            '[wallet] balance listener:',
            error
          );

          walletStatus.textContent =
            'Wallet Unavailable';

        }
      );


    const transactionsQuery =
      query(
        collection(
          db,
          'wallets',
          user.uid,
          'transactions'
        ),
        orderBy(
          'createdAt',
          'desc'
        ),
        limit(50)
      );


    stopTransactions =
      onSnapshot(
        transactionsQuery,
        (snapshot) => {

          renderTransactions(
            snapshot.docs.map(
              (item) => ({
                id: item.id,
                ...item.data()
              })
            )
          );

        },
        (error) => {

          console.error(
            '[wallet] transaction listener:',
            error
          );

          walletActivity.innerHTML = `
            <div class="wallet-empty">
              Unable to load wallet activity.
            </div>
          `;

        }
      );

  }
);
