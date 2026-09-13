import { db } from './firebase-config.js';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc
} from 'firebase/firestore';

import { requireAdmin } from './auth.js';
import { renderNav } from './nav.js';

renderNav('nav');

let events = [];

const $ = id => document.getElementById(id);

function esc(value = '') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function formatDate(value) {
  const date =
    value?.toDate?.() ||
    (value ? new Date(value) : null);

  if (!date || Number.isNaN(date.getTime()))
    return 'Date TBA';

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle:'medium',
    timeStyle:'short'
  }).format(date);
}

function toInputValue(timestamp) {
  const date = timestamp?.toDate?.();

  if (!date) return '';

  const local = new Date(
    date.getTime() -
    date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0,16);
}

function updateStats() {
  $('statTotal').textContent = events.length;

  $('statPublished').textContent =
    events.filter(e => e.status === 'published').length;

  $('statDraft').textContent =
    events.filter(e => e.status === 'draft').length;

  $('statCancelled').textContent =
    events.filter(e => e.status === 'cancelled').length;
}

function filteredEvents() {
  const term =
    $('eventSearch').value.trim().toLowerCase();

  const status =
    $('statusFilter').value;

  return events.filter(event => {
    const haystack = [
      event.title,
      event.city,
      event.venue,
      event.type
    ].join(' ').toLowerCase();

    if (term && !haystack.includes(term))
      return false;

    if (status && event.status !== status)
      return false;

    return true;
  });
}

function render() {
  updateStats();

  const rows = filteredEvents();

  if (!rows.length) {
    $('eventsGrid').innerHTML = `
      <div class="empty">
        No events match the current filters.
      </div>
    `;
    return;
  }

  $('eventsGrid').innerHTML =
    rows.map(event => {

      const image =
        event.imageUrl ||
        '/assets/img/dwm-logo-new.webp';

      return `
        <article class="event-card">

          <img
            class="event-image"
            src="${esc(image)}"
            alt="${esc(event.title || 'Event')}"
            onerror="this.onerror=null;this.src='/assets/img/dwm-logo-new.webp'"
          >

          <div class="event-body">

            <div class="event-top">

              <div>
                <div class="event-title">
                  ${esc(event.title || 'Untitled Event')}
                </div>

                <div class="event-location">
                  📍 ${esc(event.city || 'TBA')}
                  ${event.venue ? ` · ${esc(event.venue)}` : ''}
                </div>
              </div>

              <span class="badge badge-${esc(event.status || 'draft')}">
                ${esc(event.status || 'draft')}
              </span>

            </div>

            <div class="event-date">
              ${esc(formatDate(event.eventDate))}
            </div>

            <div class="event-desc">
              ${esc(event.description || event.type || '')}
            </div>

            <div class="card-actions">

              <button
                class="admin-btn"
                data-edit="${esc(event.id)}"
              >
                Edit
              </button>

              <button
                class="admin-btn danger"
                data-delete="${esc(event.id)}"
              >
                Delete
              </button>

            </div>

          </div>

        </article>
      `;
    }).join('');
}

async function loadEvents() {
  $('eventsStatus').textContent =
    'Loading events...';

  try {
    const snap =
      await getDocs(
        collection(db,'events')
      );

    events =
      snap.docs.map(d => ({
        id:d.id,
        ...d.data()
      }));

    events.sort((a,b) => {
      const aTime =
        a.eventDate?.toMillis?.() || 0;

      const bTime =
        b.eventDate?.toMillis?.() || 0;

      return aTime - bTime;
    });

    render();

    $('eventsStatus').textContent = '';

  } catch (err) {
    console.error('[admin-events]', err);

    $('eventsStatus').textContent =
      err.message ||
      'Unable to load events.';
  }
}

function resetForm() {
  $('eventForm').reset();
  $('editingEventId').value = '';
  $('eventStatus').value = 'draft';
  $('formStatus').textContent = '';
}

function openCreate() {
  resetForm();
  $('modalTitle').textContent = 'Add Event';
  $('eventModal').classList.add('open');
}

function openEdit(id) {
  const event =
    events.find(e => e.id === id);

  if (!event) return;

  resetForm();

  $('editingEventId').value = event.id;
  $('eventTitle').value = event.title || '';
  $('eventCity').value = event.city || '';
  $('eventVenue').value = event.venue || '';
  $('eventType').value = event.type || 'Other';
  $('eventStatus').value = event.status || 'draft';
  $('eventImage').value = event.imageUrl || '';
  $('eventLink').value = event.ticketUrl || '';
  $('eventDescription').value = event.description || '';
  $('eventDate').value = toInputValue(event.eventDate);

  $('modalTitle').textContent = 'Edit Event';
  $('eventModal').classList.add('open');
}

function closeModal() {
  $('eventModal').classList.remove('open');
}

$('eventForm').addEventListener(
  'submit',
  async event => {

    event.preventDefault();

    const id =
      $('editingEventId').value.trim();

    const date =
      new Date($('eventDate').value);

    if (Number.isNaN(date.getTime())) {
      $('formStatus').textContent =
        'Choose a valid event date.';
      return;
    }

    const payload = {
      title:
        $('eventTitle').value.trim(),

      city:
        $('eventCity').value.trim(),

      venue:
        $('eventVenue').value.trim(),

      type:
        $('eventType').value,

      status:
        $('eventStatus').value,

      description:
        $('eventDescription').value.trim(),

      imageUrl:
        $('eventImage').value.trim(),

      ticketUrl:
        $('eventLink').value.trim(),

      eventDate:
        Timestamp.fromDate(date),

      updatedAt:
        serverTimestamp()
    };

    const button =
      $('saveEvent');

    try {
      button.disabled = true;
      button.textContent = 'Saving...';

      if (id) {
        await updateDoc(
          doc(db,'events',id),
          payload
        );
      } else {
        await addDoc(
          collection(db,'events'),
          {
            ...payload,
            createdAt:
              serverTimestamp()
          }
        );
      }

      await loadEvents();
      closeModal();

    } catch (err) {
      console.error(
        '[admin-events] save',
        err
      );

      $('formStatus').textContent =
        err.message ||
        'Unable to save event.';

    } finally {
      button.disabled = false;
      button.textContent = 'Save Event';
    }
  }
);

$('eventsGrid').addEventListener(
  'click',
  async event => {

    const edit =
      event.target.closest('[data-edit]');

    if (edit) {
      openEdit(edit.dataset.edit);
      return;
    }

    const del =
      event.target.closest('[data-delete]');

    if (!del) return;

    const item =
      events.find(
        e => e.id === del.dataset.delete
      );

    if (!item) return;

    if (!window.confirm(
      `Delete "${item.title}" permanently?`
    )) {
      return;
    }

    try {
      await deleteDoc(
        doc(db,'events',item.id)
      );

      await loadEvents();

    } catch (err) {
      alert(
        err.message ||
        'Unable to delete event.'
      );
    }
  }
);

$('addEvent').addEventListener(
  'click',
  openCreate
);

$('closeModal').addEventListener(
  'click',
  closeModal
);

$('cancelForm').addEventListener(
  'click',
  closeModal
);

$('refreshEvents').addEventListener(
  'click',
  loadEvents
);

$('eventSearch').addEventListener(
  'input',
  render
);

$('statusFilter').addEventListener(
  'change',
  render
);

$('eventModal').addEventListener(
  'click',
  event => {
    if (event.target === $('eventModal'))
      closeModal();
  }
);

requireAdmin(loadEvents);
