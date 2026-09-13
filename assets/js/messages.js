import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';

import {
  db
} from './firebase-config.js';


export function conversationIdFor(
  buyerUid,
  sellerUid,
  storeId
) {

  return [
    String(buyerUid),
    String(sellerUid),
    String(storeId)
  ]
    .sort()
    .join('__');

}


export async function getOrCreateConversation({
  buyerUid,
  sellerUid,
  storeId,
  storeName = '',
  productId = '',
  productName = '',
  buyerName = 'DWM Customer'
}) {

  if (
    !buyerUid ||
    !sellerUid ||
    !storeId
  ) {
    throw new Error(
      'Missing conversation participants.'
    );
  }


  const conversationId =
    conversationIdFor(
      buyerUid,
      sellerUid,
      storeId
    );


  const ref =
    doc(
      db,
      'conversations',
      conversationId
    );


  const snapshot =
    await getDoc(ref);


  if (!snapshot.exists()) {

    await setDoc(
      ref,
      {
        participants: [
          buyerUid,
          sellerUid
        ],

        buyerUid,
        buyerName,
        sellerUid,
        storeId,
        storeName,

        productId:
          productId || '',

        productName:
          productName || '',

        lastMessage:
          '',

        lastSenderUid:
          '',

        lastMessageAt:
          serverTimestamp(),

        unreadByBuyer:
          0,

        unreadBySeller:
          0,

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );

  }


  return conversationId;

}


export function subscribeToConversations(
  userUid,
  callback
) {

  if (!userUid) {
    callback([]);
    return () => {};
  }


  const q =
    query(
      collection(
        db,
        'conversations'
      ),
      where(
        'participants',
        'array-contains',
        userUid
      )
    );


  return onSnapshot(
    q,
    (snapshot) => {

      const rows =
        snapshot.docs
          .map(
            (item) => ({
              id: item.id,
              ...item.data()
            })
          )
          .sort(
            (a, b) => {

              const aTime =
                a.lastMessageAt
                  ?.toMillis?.() || 0;

              const bTime =
                b.lastMessageAt
                  ?.toMillis?.() || 0;

              return bTime - aTime;

            }
          );


      callback(rows);

    },
    (error) => {

      console.error(
        '[messages] conversations listener:',
        error
      );

      callback([]);

    }
  );

}


export function subscribeToMessages(
  conversationId,
  callback
) {

  const q =
    query(
      collection(
        db,
        'conversations',
        conversationId,
        'messages'
      ),
      orderBy(
        'createdAt',
        'asc'
      ),
      limit(250)
    );


  return onSnapshot(
    q,
    (snapshot) => {

      callback(
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
        '[messages] message listener:',
        error
      );

      callback([]);

    }
  );

}


export async function sendMessage({
  conversationId,
  senderUid,
  text
}) {

  const clean =
    String(text || '')
      .trim();


  if (!clean) {
    return;
  }


  if (clean.length > 2000) {
    throw new Error(
      'Message is too long.'
    );
  }


  const conversationRef =
    doc(
      db,
      'conversations',
      conversationId
    );


  const conversationSnapshot =
    await getDoc(
      conversationRef
    );


  if (
    !conversationSnapshot.exists()
  ) {
    throw new Error(
      'Conversation not found.'
    );
  }


  const conversation =
    conversationSnapshot.data();


  if (
    !Array.isArray(
      conversation.participants
    ) ||
    !conversation.participants.includes(
      senderUid
    )
  ) {
    throw new Error(
      'You are not part of this conversation.'
    );
  }


  await addDoc(
    collection(
      conversationRef,
      'messages'
    ),
    {
      senderUid,
      text: clean,
      createdAt:
        serverTimestamp()
    }
  );


  const senderIsBuyer =
    senderUid ===
    conversation.buyerUid;


  await updateDoc(
    conversationRef,
    {
      lastMessage:
        clean,

      lastSenderUid:
        senderUid,

      lastMessageAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      ...(senderIsBuyer
        ? {
            unreadBySeller:
              Number(
                conversation
                  .unreadBySeller || 0
              ) + 1
          }
        : {
            unreadByBuyer:
              Number(
                conversation
                  .unreadByBuyer || 0
              ) + 1
          })
    }
  );

}


export async function markConversationRead(
  conversationId,
  userUid
) {

  const ref =
    doc(
      db,
      'conversations',
      conversationId
    );


  const snapshot =
    await getDoc(ref);


  if (!snapshot.exists()) {
    return;
  }


  const data =
    snapshot.data();


  if (
    data.buyerUid === userUid
  ) {

    await updateDoc(
      ref,
      {
        unreadByBuyer: 0
      }
    );

  } else if (
    data.sellerUid === userUid
  ) {

    await updateDoc(
      ref,
      {
        unreadBySeller: 0
      }
    );

  }

}


export function unreadConversationCount(
  conversations,
  userUid
) {

  return conversations.reduce(
    (total, conversation) => {

      const unread =
        conversation.buyerUid ===
        userUid
          ? Number(
              conversation
                .unreadByBuyer || 0
            )
          : Number(
              conversation
                .unreadBySeller || 0
            );


      return total + unread;

    },
    0
  );

}


// ============================================================
// DWM VOICE MESSAGES
// ============================================================

export async function sendVoiceMessage(
  conversationId,
  senderUid,
  {
    audioUrl,
    duration = 0
  }
) {

  if (!conversationId || !senderUid || !audioUrl) {
    throw new Error('Missing voice-message data.');
  }


  const conversationRef =
    doc(
      db,
      'conversations',
      conversationId
    );


  const conversationSnap =
    await getDoc(
      conversationRef
    );


  if (!conversationSnap.exists()) {
    throw new Error(
      'Conversation does not exist.'
    );
  }


  const conversation =
    conversationSnap.data();


  if (
    !Array.isArray(
      conversation.participants
    ) ||
    !conversation.participants.includes(
      senderUid
    )
  ) {
    throw new Error(
      'You are not part of this conversation.'
    );
  }


  await addDoc(
    collection(
      db,
      'conversations',
      conversationId,
      'messages'
    ),
    {
      senderUid,

      type: 'voice',

      audioUrl,

      duration:
        Number.isFinite(duration)
          ? Math.max(
              0,
              Math.round(duration)
            )
          : 0,

      createdAt:
        serverTimestamp()
    }
  );


  const isBuyer =
    senderUid ===
    conversation.buyerUid;


  await updateDoc(
    conversationRef,
    {
      lastMessage:
        '🎤 Voice note',

      lastSenderUid:
        senderUid,

      lastMessageAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      ...(isBuyer
        ? {
            unreadBySeller:
              Number(
                conversation.unreadBySeller ||
                0
              ) + 1
          }
        : {
            unreadByBuyer:
              Number(
                conversation.unreadByBuyer ||
                0
              ) + 1
          })
    }
  );

}
