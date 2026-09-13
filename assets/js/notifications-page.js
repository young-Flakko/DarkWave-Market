import {
  renderNav
} from './nav.js';

import {
  requireAuth
} from './auth.js';

import {
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications
} from './notifications.js';


renderNav('nav');


const list =
  document.getElementById(
    'notificationsList'
  );

const count =
  document.getElementById(
    'notificationsCount'
  );

const markAllButton =
  document.getElementById(
    'markAllReadButton'
  );


let currentNotifications =
  [];

let unsubscribe =
  null;


function escapeHtml(
  value = ''
) {

  return String(value)
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


function getIcon(
  type = ''
) {

  const normalized =
    String(type)
      .toLowerCase();


  if (
    normalized.includes(
      'order'
    )
  ) {
    return '📦';
  }


  if (
    normalized.includes(
      'message'
    )
  ) {
    return '💬';
  }


  if (
    normalized.includes(
      'seller'
    ) ||
    normalized.includes(
      'store'
    )
  ) {
    return '🌊';
  }


  if (
    normalized.includes(
      'payment'
    )
  ) {
    return '💳';
  }


  if (
    normalized.includes(
      'drop'
    ) ||
    normalized.includes(
      'product'
    )
  ) {
    return '⚡';
  }


  return '🔔';

}


function formatDate(
  timestamp
) {

  if (
    !timestamp ||
    typeof timestamp.toDate !==
      'function'
  ) {
    return 'Just now';
  }


  const date =
    timestamp.toDate();


  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle:
        'medium',

      timeStyle:
        'short'
    }
  ).format(date);

}


function render() {

  const unread =
    getUnreadCount(
      currentNotifications
    );


  count.textContent =
    unread === 1
      ? '1 unread'
      : `${unread} unread`;


  markAllButton.style.display =
    unread > 0
      ? 'inline-flex'
      : 'none';


  if (
    !currentNotifications.length
  ) {

    list.innerHTML = `
      <div
        class="notifications-empty"
      >
        <h2>
          You're all caught up.
        </h2>

        <p>
          New DWM activity will
          appear here.
        </p>
      </div>
    `;

    return;

  }


  list.innerHTML =
    currentNotifications
      .map(
        (notification) => {

          const unreadClass =
            notification.read === true
              ? ''
              : ' unread';


          const type =
            notification.type ||
            'Update';


          const title =
            notification.title ||
            'DWM Update';


          const message =
            notification.message ||
            notification.body ||
            'You have a new notification.';


          const link =
            typeof notification.link ===
              'string' &&
            notification.link.trim()
              ? notification.link.trim()
              : '';


          const openHtml =
            link
              ? `
                <a
                  class="notification-open"
                  href="${escapeHtml(link)}"
                  data-notification-open="${escapeHtml(notification.id)}"
                >
                  Open
                </a>
              `
              : '';


          const readHtml =
            notification.read === true
              ? ''
              : `
                <button
                  type="button"
                  class="notification-read"
                  data-notification-read="${escapeHtml(notification.id)}"
                >
                  Mark Read
                </button>
              `;


          return `
            <article
              class="notification-card${unreadClass}"
            >

              ${
                notification.read === true
                  ? ''
                  : `
                    <span
                      class="notification-unread-dot"
                      aria-hidden="true"
                    ></span>
                  `
              }

              <div
                class="notification-icon"
                aria-hidden="true"
              >
                ${getIcon(type)}
              </div>


              <div>

                <div
                  class="notification-type"
                >
                  ${escapeHtml(type)}
                </div>

                <h2
                  class="notification-title"
                >
                  ${escapeHtml(title)}
                </h2>

                <div
                  class="notification-message"
                >
                  ${escapeHtml(message)}
                </div>

                <div
                  class="notification-time"
                >
                  ${escapeHtml(
                    formatDate(
                      notification.createdAt
                    )
                  )}
                </div>

              </div>


              <div
                class="notification-actions"
              >
                ${openHtml}
                ${readHtml}
              </div>

            </article>
          `;

        }
      )
      .join('');

}


list.addEventListener(
  'click',
  async (event) => {

    const readButton =
      event.target.closest(
        '[data-notification-read]'
      );


    if (readButton) {

      const id =
        readButton.getAttribute(
          'data-notification-read'
        );


      readButton.disabled =
        true;


      try {

        await markNotificationRead(
          id
        );

      } catch (error) {

        console.error(
          '[notifications-page] mark read error:',
          error
        );


        readButton.disabled =
          false;

      }


      return;

    }


    const openLink =
      event.target.closest(
        '[data-notification-open]'
      );


    if (openLink) {

      const id =
        openLink.getAttribute(
          'data-notification-open'
        );


      try {

        await markNotificationRead(
          id
        );

      } catch (error) {

        console.warn(
          '[notifications-page] unable to mark opened notification:',
          error
        );

      }

    }

  }
);


markAllButton.addEventListener(
  'click',
  async () => {

    markAllButton.disabled =
      true;

    markAllButton.textContent =
      'Marking...';


    try {

      await markAllNotificationsRead(
        currentNotifications
      );

    } catch (error) {

      console.error(
        '[notifications-page] mark all error:',
        error
      );

    } finally {

      markAllButton.disabled =
        false;

      markAllButton.textContent =
        'Mark All Read';

    }

  }
);


requireAuth(
  (user) => {

    if (unsubscribe) {
      unsubscribe();
    }


    unsubscribe =
      subscribeToNotifications(
        user.uid,
        (
          notifications
        ) => {

          currentNotifications =
            notifications;

          render();

        }
      );

  }
);


window.addEventListener(
  'beforeunload',
  () => {

    unsubscribe?.();

  }
);
