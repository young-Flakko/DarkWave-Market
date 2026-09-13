import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';

import {
  db
} from './firebase-config.js';


export const NOTIFICATIONS_EVENT =
  'dwm:notifications-changed';


function timestampValue(value) {

  if (
    value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis();
  }

  return 0;

}


export function subscribeToNotifications(
  userId,
  callback
) {

  if (!userId) {
    callback?.([]);
    return () => {};
  }


  const q =
    query(
      collection(
        db,
        'notifications'
      ),
      where(
        'recipientUid',
        '==',
        String(userId)
      )
    );


  return onSnapshot(
    q,
    (snapshot) => {

      const notifications =
        snapshot.docs
          .map(
            (snap) => ({
              id: snap.id,
              ...snap.data()
            })
          )
          .sort(
            (a, b) =>
              timestampValue(
                b.createdAt
              ) -
              timestampValue(
                a.createdAt
              )
          );


      callback?.(
        notifications
      );


      window.dispatchEvent(
        new CustomEvent(
          NOTIFICATIONS_EVENT,
          {
            detail: {
              notifications
            }
          }
        )
      );

    },
    (error) => {

      console.error(
        '[notifications] listener error:',
        error
      );

      callback?.([]);

    }
  );

}


export function getUnreadCount(
  notifications = []
) {

  return notifications.filter(
    (item) =>
      item?.read !== true
  ).length;

}


export async function markNotificationRead(
  notificationId
) {

  if (!notificationId) {
    return;
  }

  await updateDoc(
    doc(
      db,
      'notifications',
      notificationId
    ),
    {
      read: true
    }
  );

}


export async function markAllNotificationsRead(
  notifications = []
) {

  const unread =
    notifications.filter(
      (item) =>
        item?.id &&
        item?.read !== true
    );


  if (!unread.length) {
    return;
  }


  const batch =
    writeBatch(db);


  for (
    const item of unread
  ) {

    batch.update(
      doc(
        db,
        'notifications',
        item.id
      ),
      {
        read: true
      }
    );

  }


  await batch.commit();

}
