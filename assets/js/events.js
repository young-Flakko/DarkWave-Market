import { db } from './firebase-config.js';

import {
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

import { renderNav } from './nav.js';

renderNav('nav');

const grid =
  document.getElementById('eventsGrid');

const statusEl =
  document.getElementById('eventsStatus');

function esc(value = '') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function formatDate(timestamp) {
  const date =
    timestamp?.toDate?.();

  if (!date)
    return 'Date TBA';

  return new Intl.DateTimeFormat(
    'en-ZA',
    {
      dateStyle:'long',
      timeStyle:'short'
    }
  ).format(date);
}

async function loadEvents() {
  try {
    const snap =
      await getDocs(
        query(
          collection(db,'events'),
          where(
            'status',
            '==',
            'published'
          )
        )
      );

    const events =
      snap.docs
        .map(d => ({
          id:d.id,
          ...d.data()
        }))
        .sort((a,b) =>
          (a.eventDate?.toMillis?.() || 0) -
          (b.eventDate?.toMillis?.() || 0)
        );

    if (!events.length) {
      statusEl.textContent =
        'No upcoming events announced yet. Stay close to the Wave.';

      grid.innerHTML = '';
      return;
    }

    statusEl.textContent = '';

    grid.innerHTML =
      events.map(event => {

        const location =
          [
            event.city,
            event.venue
          ]
          .filter(Boolean)
          .join(' · ');

        const link =
          event.ticketUrl
            ? `
              <a
                href="${esc(event.ticketUrl)}"
                target="_blank"
                rel="noopener"
                class="badge-coming"
                style="text-decoration:none"
              >
                More Info
              </a>
            `
            : `
              <span class="badge-coming">
                ${esc(event.type || 'DWM Event')}
              </span>
            `;

        return `
          <div class="placeholder-card">

            ${
              event.imageUrl
                ? `
                  <img
                    src="${esc(event.imageUrl)}"
                    alt="${esc(event.title || 'DWM Event')}"
                    style="
                      width:100%;
                      aspect-ratio:16/9;
                      object-fit:cover;
                      margin-bottom:16px;
                    "
                  >
                `
                : ''
            }

            <h3>
              📍 ${esc(location || 'Location TBA')}
            </h3>

            <h3 style="margin-top:10px">
              ${esc(event.title || 'DWM Event')}
            </h3>

            <p>
              ${esc(formatDate(event.eventDate))}
            </p>

            ${
              event.description
                ? `
                  <p style="margin-top:10px">
                    ${esc(event.description)}
                  </p>
                `
                : ''
            }

            ${link}

          </div>
        `;
      }).join('');

  } catch (err) {
    console.error('[events]',err);

    statusEl.textContent =
      'Unable to load events right now.';
  }
}

loadEvents();
