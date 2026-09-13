import {
  renderNav
} from './nav.js';

import {
  db
} from './firebase-config.js';

import {
  doc,
  getDoc
} from 'firebase/firestore';

import {
  requireAuth
} from './auth.js';

import {
  markConversationRead,
  sendMessage,
  sendVoiceMessage,
  subscribeToConversations,
  subscribeToMessages
} from './messages.js';


renderNav('nav');


const conversationList =
  document.getElementById(
    'conversationList'
  );

const chatHead =
  document.getElementById(
    'chatHead'
  );

const chatMessages =
  document.getElementById(
    'chatMessages'
  );

const messageForm =
  document.getElementById(
    'messageForm'
  );

const messageInput =
  document.getElementById(
    'messageInput'
  );

const sendButton =
  document.getElementById(
    'sendMessageButton'
  );


let currentUid = '';
let conversations = [];
let activeConversationId = '';
let unsubscribeConversations = null;
let unsubscribeMessages = null;


function esc(value = '') {

  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

}


function messageTime(timestamp) {

  if (
    !timestamp ||
    typeof timestamp.toDate !==
      'function'
  ) {
    return '';
  }

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      hour:'2-digit',
      minute:'2-digit',
      day:'2-digit',
      month:'short'
    }
  ).format(
    timestamp.toDate()
  );

}


function unreadFor(
  conversation
) {

  return conversation.buyerUid ===
    currentUid
      ? Number(
          conversation
            .unreadByBuyer || 0
        )
      : Number(
          conversation
            .unreadBySeller || 0
        );

}


function otherName(
  conversation
) {

  if (
    conversation.sellerUid ===
    currentUid
  ) {

    return conversation.buyerName ||
      'DWM Customer';

  }

  return conversation.storeName ||
    'DWM Seller';

}


function renderConversationList() {

  if (!conversations.length) {

    conversationList.innerHTML = `
      <div class="messages-empty">
        No conversations yet.
      </div>
    `;

    return;

  }


  conversationList.innerHTML =
    conversations.map(
      (conversation) => {

        const unread =
          unreadFor(
            conversation
          );

        return `
          <button
            type="button"
            class="conversation-row ${
              conversation.id ===
              activeConversationId
                ? 'active'
                : ''
            } ${
              unread > 0
                ? 'has-unread'
                : ''
            }"
            data-conversation-id="${esc(conversation.id)}"
          >

            <div class="conversation-name">

              <span>
                ${esc(
                  otherName(
                    conversation
                  )
                )}
              </span>

              ${
                unread > 0
                  ? `
                    <span class="message-unread">
                      ${unread}
                    </span>
                  `
                  : ''
              }

            </div>

            <div class="conversation-preview">
              ${esc(
                conversation.lastMessage ||
                'New conversation'
              )}
            </div>

            ${
              conversation.productName
                ? `
                  <div class="conversation-context">
                    ${esc(
                      conversation.productName
                    )}
                  </div>
                `
                : ''
            }

          </button>
        `;

      }
    ).join('');


  hydrateConversationAvatars();
}


async function openConversation(
  conversationId
) {

  const conversation =
    conversations.find(
      (item) =>
        item.id === conversationId
    );


  if (!conversation) {
    return;
  }


  activeConversationId =
    conversationId;


  renderConversationList();


  chatHead.innerHTML = `
    <div>

      <div class="chat-head-title">
        ${esc(
          otherName(
            conversation
          )
        )}
      </div>

      <div class="chat-head-context">
        ${
          conversation.productName
            ? `
                <div>
                  About ${esc(
                    conversation.productName
                  )}
                </div>

                ${
                  conversation.productId
                    ? `
                        <a
                          class="product-chat-link"
                          href="/product.html?id=${encodeURIComponent(
                            conversation.productId
                          )}"
                        >
                          VIEW PRODUCT →
                        </a>
                      `
                    : ''
                }
              `
            : esc(
                conversation.storeName ||
                'DWM conversation'
              )
        }
      </div>

    </div>
  `;


  messageForm.style.display =
    'grid';


  unsubscribeMessages?.();


  unsubscribeMessages =
    subscribeToMessages(
      conversationId,
      (messages) => {

        if (!messages.length) {

          chatMessages.innerHTML = `
            <div class="messages-empty">
              No messages yet.
              Say what's up 👋
            </div>
          `;

          return;

        }


        chatMessages.innerHTML =
          messages.map(
            (message) => {

              const content =
                message.type === 'voice' &&
                message.audioUrl
                  ? `
                      <div class="voice-message">
                        <audio
                          controls
                          preload="metadata"
                          src="${esc(
                            message.audioUrl
                          )}"
                        ></audio>
                      </div>
                    `
                  : `
                      <div>
                        ${esc(
                          message.text || ''
                        )}
                      </div>
                    `;


              return `

                <div
                  class="message ${
                    message.senderUid ===
                    currentUid
                      ? 'mine'
                      : 'theirs'
                  }"
                >

                  ${content}

                  <div class="message-time">
                    ${esc(
                      messageTime(
                        message.createdAt
                      )
                    )}
                  </div>

                </div>

              `;

            }
          ).join('');


        chatMessages.scrollTop =
          chatMessages.scrollHeight;

      }
    );


  try {

    await markConversationRead(
      conversationId,
      currentUid
    );

  } catch (error) {

    console.warn(
      '[messages-page] mark read:',
      error
    );

  }

}


conversationList.addEventListener(
  'click',
  (event) => {

    const button =
      event.target.closest(
        '[data-conversation-id]'
      );


    if (!button) {
      return;
    }


    openConversation(
      button.getAttribute(
        'data-conversation-id'
      )
    );

  }
);


messageForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();


    const text =
      messageInput.value.trim();


    if (
      !text ||
      !activeConversationId
    ) {
      return;
    }


    sendButton.disabled = true;
    sendButton.textContent =
      'Sending...';


    try {

      await sendMessage({
        conversationId:
          activeConversationId,

        senderUid:
          currentUid,

        text
      });


      messageInput.value = '';

      messageInput.focus();

    } catch (error) {

      console.error(
        '[messages-page] send:',
        error
      );

      alert(
        'Unable to send message.'
      );

    } finally {

      sendButton.disabled = false;
      sendButton.textContent =
        'Send';

    }

  }
);


requireAuth(
  (user) => {

    currentUid =
      user.uid;


    unsubscribeConversations?.();


    unsubscribeConversations =
      subscribeToConversations(
        currentUid,
        (rows) => {

          conversations =
            rows;


          renderConversationList();


          const params =
            new URLSearchParams(
              window.location.search
            );


          const requested =
            params.get(
              'conversation'
            );


          if (
            requested &&
            !activeConversationId &&
            conversations.some(
              (item) =>
                item.id === requested
            )
          ) {

            openConversation(
              requested
            );

          }

        }
      );

  }
);


window.addEventListener(
  'beforeunload',
  () => {

    unsubscribeConversations?.();
    unsubscribeMessages?.();

  }
);


// ============================================================
// PHASE 3C — CHAT UX + VOICE NOTES
// ============================================================

const DWM_CLOUDINARY_CLOUD =
  'slhbj15c';

const DWM_CLOUDINARY_PRESET =
  'dwm_products';


let voiceRecorder =
  null;

let voiceChunks =
  [];

let voiceStartedAt =
  0;


function getComposerTextarea() {

  return document.querySelector(
    '.chat-compose textarea'
  );

}


function getMessagesLayout() {

  return document.querySelector(
    '.messages-layout'
  );

}


// ------------------------------------------------------------
// ENTER = SEND
// SHIFT + ENTER = NEW LINE
// ------------------------------------------------------------

document.addEventListener(
  'keydown',
  (event) => {

    const textarea =
      getComposerTextarea();


    if (
      !textarea ||
      event.target !== textarea
    ) {
      return;
    }


    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {

      event.preventDefault();


      const form =
        textarea.closest('form');


      if (form) {

        form.requestSubmit();

      }

    }

  }
);


// ------------------------------------------------------------
// MOBILE CHAT VIEW
// ------------------------------------------------------------

document.addEventListener(
  'click',
  (event) => {

    const conversation =
      event.target.closest(
        '.conversation-row'
      );


    if (conversation) {

      getMessagesLayout()
        ?.classList
        .add('chat-open');

    }


    if (
      event.target.closest(
        '#mobileChatBack'
      )
    ) {

      getMessagesLayout()
        ?.classList
        .remove('chat-open');

    }

  }
);


if (
  new URLSearchParams(
    location.search
  ).get('conversation')
) {

  getMessagesLayout()
    ?.classList
    .add('chat-open');

}


// ------------------------------------------------------------
// CLOUDINARY AUDIO UPLOAD
// ------------------------------------------------------------

async function uploadVoiceBlob(
  blob
) {

  const formData =
    new FormData();


  formData.append(
    'file',
    blob,
    `dwm-vn-${Date.now()}.webm`
  );


  formData.append(
    'upload_preset',
    DWM_CLOUDINARY_PRESET
  );


  const response =
    await fetch(
      `https://api.cloudinary.com/v1_1/${DWM_CLOUDINARY_CLOUD}/video/upload`,
      {
        method:'POST',
        body:formData
      }
    );


  if (!response.ok) {

    throw new Error(
      'Voice note upload failed.'
    );

  }


  const result =
    await response.json();


  if (!result.secure_url) {

    throw new Error(
      'Cloudinary returned no audio URL.'
    );

  }


  return result.secure_url;

}


// ------------------------------------------------------------
// RECORD / STOP VOICE NOTE
// ------------------------------------------------------------

document.addEventListener(
  'click',
  async (event) => {

    const button =
      event.target.closest(
        '#voiceNoteButton'
      );


    if (!button) {
      return;
    }


    if (
      !window.MediaRecorder ||
      !navigator.mediaDevices
        ?.getUserMedia
    ) {

      alert(
        'Voice recording is not supported in this browser.'
      );

      return;

    }


    if (
      voiceRecorder &&
      voiceRecorder.state ===
      'recording'
    ) {

      voiceRecorder.stop();

      button.disabled =
        true;

      button.textContent =
        '…';

      return;

    }


    try {

      const stream =
        await navigator.mediaDevices
          .getUserMedia({
            audio:true
          });


      voiceChunks =
        [];


      let mimeType =
        'audio/webm';


      if (
        MediaRecorder
          .isTypeSupported(
            'audio/webm;codecs=opus'
          )
      ) {

        mimeType =
          'audio/webm;codecs=opus';

      }


      voiceRecorder =
        new MediaRecorder(
          stream,
          {
            mimeType
          }
        );


      voiceStartedAt =
        Date.now();


      voiceRecorder.addEventListener(
        'dataavailable',
        (e) => {

          if (
            e.data &&
            e.data.size > 0
          ) {

            voiceChunks.push(
              e.data
            );

          }

        }
      );


      voiceRecorder.addEventListener(
        'stop',
        async () => {

          try {

            const duration =
              Math.min(
                300,
                Math.max(
                  1,
                  Math.round(
                    (
                      Date.now() -
                      voiceStartedAt
                    ) / 1000
                  )
                )
              );


            const blob =
              new Blob(
                voiceChunks,
                {
                  type:
                    voiceRecorder
                      .mimeType ||
                    'audio/webm'
                }
              );


            stream
              .getTracks()
              .forEach(
                track =>
                  track.stop()
              );


            if (
              blob.size <
              1000
            ) {

              throw new Error(
                'Voice note was too short.'
              );

            }


            const conversationId =
              activeConversationId ||
              new URLSearchParams(
                location.search
              ).get(
                'conversation'
              );


            if (!conversationId) {

              throw new Error(
                'Open a conversation first.'
              );

            }


            const audioUrl =
              await uploadVoiceBlob(
                blob
              );


            const senderUid =
              currentUid;


            if (!senderUid) {

              throw new Error(
                'You must be signed in.'
              );

            }


            await sendVoiceMessage(
              conversationId,
              senderUid,
              {
                audioUrl,
                duration
              }
            );

          } catch (error) {

            console.error(
              '[messages] voice note:',
              error
            );


            alert(
              error.message ||
              'Unable to send voice note.'
            );

          } finally {

            button.disabled =
              false;

            button.textContent =
              '🎤';

            button.classList
              .remove(
                'recording'
              );


            voiceRecorder =
              null;

            voiceChunks =
              [];

          }

        }
      );


      voiceRecorder.start();


      button.textContent =
        '■';

      button.classList
        .add('recording');


      // Hard cap at 5 minutes.

      setTimeout(
        () => {

          if (
            voiceRecorder &&
            voiceRecorder.state ===
            'recording'
          ) {

            voiceRecorder.stop();

          }

        },
        300000
      );

    } catch (error) {

      console.error(
        '[messages] microphone:',
        error
      );


      alert(
        'Microphone permission is required to record a voice note.'
      );

    }

  }
);



// ============================================================
// DWM MESSAGE AVATARS
// ============================================================

const dwmAvatarCache =
  new Map();


function dwmInitials(value = '') {

  const parts =
    String(value)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (!parts.length) {
    return 'DW';
  }

  return parts
    .slice(0, 2)
    .map(
      part =>
        part.charAt(0).toUpperCase()
    )
    .join('');
}


async function avatarForConversation(
  conversation
) {

  if (
    dwmAvatarCache.has(
      conversation.id
    )
  ) {
    return dwmAvatarCache.get(
      conversation.id
    );
  }

  let url = '';

  try {

    // Seller is looking at customer.
    if (
      conversation.sellerUid === currentUid &&
      conversation.buyerUid
    ) {

      const userSnap =
        await getDoc(
          doc(
            db,
            'users',
            conversation.buyerUid
          )
        );

      if (userSnap.exists()) {
        url =
          userSnap.data()?.photoUrl || '';
      }

    }

    // Customer is looking at seller/store.
    else if (
      conversation.storeId
    ) {

      const storeSnap =
        await getDoc(
          doc(
            db,
            'stores',
            conversation.storeId
          )
        );

      if (storeSnap.exists()) {
        url =
          storeSnap.data()?.logoUrl || '';
      }

    }

  } catch (error) {

    console.warn(
      '[messages] avatar lookup failed:',
      error
    );

  }

  dwmAvatarCache.set(
    conversation.id,
    url
  );

  return url;
}


async function applyAvatarToElement(
  element,
  conversation
) {

  if (!element) return;

  element.textContent =
    dwmInitials(
      otherName(conversation)
    );

  const url =
    await avatarForConversation(
      conversation
    );

  if (
    !url ||
    !element.isConnected
  ) {
    return;
  }

  element.innerHTML = '';

  const img =
    document.createElement('img');

  img.src = url;
  img.alt = '';
  img.style.cssText =
    'width:100%;height:100%;object-fit:cover;display:block;';

  element.appendChild(img);
}


async function hydrateConversationAvatars() {

  for (
    const conversation
    of conversations
  ) {

    const row =
      document.querySelector(
        `[data-conversation-id="${CSS.escape(
          conversation.id
        )}"]`
      );

    if (!row) {
      continue;
    }

    let avatar =
      row.querySelector(
        '.conversation-avatar'
      );

    if (!avatar) {

      avatar =
        document.createElement('div');

      avatar.className =
        'conversation-avatar';

      row.prepend(avatar);
    }

    await applyAvatarToElement(
      avatar,
      conversation
    );
  }
}


async function hydrateChatAvatar(
  conversation
) {

  const avatar =
    document.getElementById(
      'chatAvatar'
    );

  if (!avatar) return;

  await applyAvatarToElement(
    avatar,
    conversation
  );
}



// ============================================================
// DWM DIRECT — SEARCH + START CHAT UI
// ============================================================

const conversationSearch =
  document.getElementById(
    'conversationSearch'
  );

const newChatButton =
  document.getElementById(
    'newChatButton'
  );

const startChatOverlay =
  document.getElementById(
    'startChatOverlay'
  );

const startChatClose =
  document.getElementById(
    'startChatClose'
  );

const startChatInput =
  document.getElementById(
    'startChatInput'
  );


function openStartChat() {

  if (!startChatOverlay) return;

  startChatOverlay.classList.add(
    'open'
  );

  startChatOverlay.setAttribute(
    'aria-hidden',
    'false'
  );

  setTimeout(
    () => startChatInput?.focus(),
    40
  );
}


function closeStartChat() {

  if (!startChatOverlay) return;

  startChatOverlay.classList.remove(
    'open'
  );

  startChatOverlay.setAttribute(
    'aria-hidden',
    'true'
  );

  if (startChatInput) {
    startChatInput.value = '';
  }
}


newChatButton?.addEventListener(
  'click',
  openStartChat
);


startChatClose?.addEventListener(
  'click',
  closeStartChat
);


startChatOverlay?.addEventListener(
  'click',
  (event) => {

    if (
      event.target ===
      startChatOverlay
    ) {
      closeStartChat();
    }

  }
);


document.addEventListener(
  'keydown',
  (event) => {

    if (
      event.key === 'Escape' &&
      startChatOverlay?.classList.contains(
        'open'
      )
    ) {
      closeStartChat();
    }

  }
);


conversationSearch?.addEventListener(
  'input',
  () => {

    const query =
      conversationSearch.value
        .trim()
        .toLowerCase();

    document
      .querySelectorAll(
        '.conversation-row'
      )
      .forEach(
        row => {

          const text =
            row.textContent
              .toLowerCase();

          row.style.display =
            !query ||
            text.includes(query)
              ? ''
              : 'none';

        }
      );

  }
);

