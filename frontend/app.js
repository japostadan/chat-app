import { attachBubbleRowHover } from './hoverActions.js';
import { getActiveRoom, setActiveRoom, clearActiveRoom } from './roomState.js';
import { escapeHtml, formatTime, formatGroupTime, buildGroupMetaHtml } from './formatting.js';
import { getClearedBefore, setClearedBefore, filterClearedMessages } from './viewClear.js';
import { getVoterId } from './voter.js';
import { getReaction, setReaction } from './reactions.js';
import { renderPresence } from './presence.js';

const API = import.meta.env.VITE_API_URL ?? '';
const GROUP_GAP_MS = 5 * 60 * 1000;

// ── Active room ───────────────────────────────────────────────────────────────

let activeRoom = getActiveRoom();

function updateRoomUI() {
  const isInRoom = Boolean(activeRoom);
  document.getElementById('room-global-actions').style.display = isInRoom ? 'none' : '';
  document.getElementById('room-indicator').style.display = isInRoom ? 'flex' : 'none';
  if (isInRoom) {
    document.getElementById('room-code-display').textContent = activeRoom;
  }
}

async function createRoom() {
  const res = await fetch(`${API}/rooms`, { method: 'POST' });
  if (!res.ok) { alert('Could not create room. Please try again.'); return; }
  const { code } = await res.json();
  enterRoom(code);
}

async function joinRoom() {
  const code = document.getElementById('join-input').value.trim().toUpperCase();
  if (!code) return;
  const res = await fetch(`${API}/messages?room=${encodeURIComponent(code)}`);
  if (res.status === 404) {
    document.getElementById('join-error').textContent = 'Room not found.';
    return;
  }
  document.getElementById('join-error').textContent = '';
  document.getElementById('join-input').value = '';
  enterRoom(code);
}

function enterRoom(code) {
  activeRoom = code;
  setActiveRoom(code);
  updateRoomUI();
  connectSSE();
}

function leaveRoom() {
  activeRoom = null;
  clearActiveRoom();
  updateRoomUI();
  connectSSE();
}

// ── View Clear ────────────────────────────────────────────────────────────────

let lastMessages = [];

document.getElementById('clear-btn').addEventListener('click', () => {
  setClearedBefore(Date.now(), activeRoom || 'global');
  renderMessages(lastMessages);
});

document.getElementById('room-create').addEventListener('click', createRoom);
document.getElementById('join-btn').addEventListener('click', joinRoom);
document.getElementById('join-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); joinRoom(); }
});
document.getElementById('room-copy').addEventListener('click', () => {
  navigator.clipboard.writeText(activeRoom);
  const btn = document.getElementById('room-copy');
  btn.textContent = '✓';
  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
});
document.getElementById('room-leave').addEventListener('click', leaveRoom);

// ── Username ──────────────────────────────────────────────────────────────────

function getAuthor() {
  return localStorage.getItem('chat_author') || '';
}

function setAuthor(name) {
  localStorage.setItem('chat_author', name);
  document.getElementById('username-display').textContent = name;
  connectSSE();
}

function showUsernameOverlay() {
  const overlay = document.getElementById('username-overlay');
  overlay.classList.add('visible');
  document.getElementById('username-input').value = getAuthor();
  document.getElementById('username-input').focus();
}

function hideUsernameOverlay() {
  document.getElementById('username-overlay').classList.remove('visible');
}

document.getElementById('username-save').addEventListener('click', () => {
  const name = document.getElementById('username-input').value.trim();
  if (!name) return;
  setAuthor(name);
  hideUsernameOverlay();
});

document.getElementById('username-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('username-save').click();
  }
});

document.getElementById('username-display').addEventListener('click', showUsernameOverlay);

document.getElementById('username-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) hideUsernameOverlay();
});

// ── Scheduled toggle ──────────────────────────────────────────────────────────

const scheduleToggle = document.getElementById('schedule-toggle');
const scheduleStrip  = document.getElementById('schedule-strip');

scheduleToggle.addEventListener('click', () => {
  const active = scheduleStrip.style.display === 'flex';
  scheduleStrip.style.display = active ? 'none' : 'flex';
  scheduleToggle.classList.toggle('active', !active);
  if (!active) document.getElementById('scheduled-for').focus();
});

// ── Reply state ───────────────────────────────────────────────────────────────

let replyingTo = null;

function setReply(id, author, text) {
  replyingTo = id;
  const strip = document.getElementById('reply-strip');
  strip.style.display = 'flex';
  strip.querySelector('.strip-author').textContent = author;
  strip.querySelector('.strip-text').textContent = text;
  document.getElementById('text').focus();
}

function cancelReply() {
  replyingTo = null;
  const strip = document.getElementById('reply-strip');
  strip.style.display = 'none';
}

document.getElementById('reply-cancel').addEventListener('click', cancelReply);

// ── Textarea auto-grow ────────────────────────────────────────────────────────

const textarea = document.getElementById('text');

textarea.addEventListener('input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Send ──────────────────────────────────────────────────────────────────────

document.getElementById('send-btn').addEventListener('click', sendMessage);

async function sendMessage() {
  const author = getAuthor();
  if (!author) { showUsernameOverlay(); return; }

  const text = textarea.value.trim();
  if (!text) return;

  const scheduledForEl = document.getElementById('scheduled-for');
  const body = { author, text };
  if (replyingTo) body.replyTo = replyingTo;
  if (scheduledForEl.value) body.scheduledFor = new Date(scheduledForEl.value).getTime();

  const roomParam = activeRoom ? `?room=${encodeURIComponent(activeRoom)}` : '';
  const res = await fetch(`${API}/messages${roomParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    textarea.value = '';
    textarea.style.height = 'auto';
    scheduledForEl.value = '';
    scheduleStrip.style.display = 'none';
    scheduleToggle.classList.remove('active');
    cancelReply();
  } else {
    alert('Failed to send. Please try again.');
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderMessages(messages) {
  lastMessages = messages;
  messages = filterClearedMessages(messages, getClearedBefore(activeRoom || 'global'));
  const me = getAuthor();
  const byId = Object.fromEntries(messages.map(m => [m.id, m]));
  const container = document.getElementById('messages-area');

  // Preserve scroll position: auto-scroll only if near bottom
  const wasAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  // Build groups: consecutive same-author within GROUP_GAP_MS
  const groups = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const sameAuthor = last && last.author === msg.author;
    const closeInTime = last && (msg.createdAt - last.messages[last.messages.length - 1].createdAt) < GROUP_GAP_MS;
    if (sameAuthor && closeInTime) {
      last.messages.push(msg);
    } else {
      groups.push({ author: msg.author, messages: [msg] });
    }
  }

  const html = groups.map(group => {
    const isMine = group.author === me;
    const side = isMine ? 'mine' : 'theirs';
    const firstMsg = group.messages[0];

    const metaHtml = buildGroupMetaHtml(group.author, firstMsg.createdAt);

    const bubblesHtml = group.messages.map((m, idx) => {
      const isGrouped = idx > 0;

      const quoteHtml = m.replyTo && byId[m.replyTo]
        ? `<div class="reply-quote">
             <span class="quote-author">${escapeHtml(byId[m.replyTo].author)}</span>
             <div class="quote-text">${escapeHtml(byId[m.replyTo].text)}</div>
           </div>`
        : '';

      const myReaction = getReaction(m.id);
      const actionsHtml = `
        <div class="actions">
          <button class="action-btn${myReaction === 'like' ? ' active' : ''}" data-action="like" data-id="${escapeHtml(m.id)}" title="Like">👍</button>
          <button class="action-btn${myReaction === 'dislike' ? ' active' : ''}" data-action="dislike" data-id="${escapeHtml(m.id)}" title="Dislike">👎</button>
          <button class="action-btn" data-action="reply" data-id="${escapeHtml(m.id)}" data-author="${escapeHtml(m.author)}" data-text="${escapeHtml(m.text)}" title="Reply">↩</button>
        </div>`;

      const reactionsHtml = (m.likes > 0 || m.dislikes > 0)
        ? `<div class="reactions">
             ${m.likes > 0 ? `<span class="reaction-badge${myReaction === 'like' ? ' active' : ''}" data-action="like" data-id="${escapeHtml(m.id)}">👍 ${m.likes}</span>` : ''}
             ${m.dislikes > 0 ? `<span class="reaction-badge${myReaction === 'dislike' ? ' active' : ''}" data-action="dislike" data-id="${escapeHtml(m.id)}">👎 ${m.dislikes}</span>` : ''}
           </div>`
        : '';

      return `
        <div class="bubble-row ${isGrouped ? 'grouped ' : ''}${side}">
          <div class="bubble" data-time="${escapeHtml(formatTime(m.createdAt))}">
            ${quoteHtml}
            ${escapeHtml(m.text)}
          </div>
          ${actionsHtml}
        </div>
        ${reactionsHtml}`;
    }).join('');

    return `<div class="msg-group ${side}">${metaHtml}${bubblesHtml}</div>`;
  }).join('');

  const emptyState = document.getElementById('empty-state');
  container.innerHTML = html || '';
  container.appendChild(emptyState);
  emptyState.classList.toggle('visible', messages.length === 0);

  container.querySelectorAll('.bubble-row').forEach(row => {
    const actionsEl = row.querySelector('.actions');
    if (actionsEl) attachBubbleRowHover(row, actionsEl);
  });

  if (wasAtBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

// ── Event delegation ──────────────────────────────────────────────────────────

document.getElementById('messages-area').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, id, author, text } = btn.dataset;

  if (action === 'reply') {
    setReply(id, author, text);
    return;
  }

  if (action === 'like' || action === 'dislike') {
    const roomParam = activeRoom ? `?room=${encodeURIComponent(activeRoom)}` : '';
    const voterId = getVoterId();
    try {
      const res = await fetch(`${API}/messages/${id}/react${roomParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId, reaction: action }),
      });
      if (!res.ok) throw new Error('failed');
      setReaction(id, action);
    } catch {
      alert('Could not update. Please try again.');
    }
  }
});

// ── SSE ───────────────────────────────────────────────────────────────────────

const connBanner = document.getElementById('conn-banner');
let es = null;

async function connectSSE() {
  if (es) {
    es.close();
    es = null;
  }

  if (activeRoom) {
    const res = await fetch(`${API}/messages?room=${encodeURIComponent(activeRoom)}`);
    if (res.status === 404) { leaveRoom(); return; }
  }

  const author = getAuthor();
  const voterId = getVoterId();
  const params = new URLSearchParams();
  if (activeRoom) params.set('room', activeRoom);
  if (author) params.set('author', author);
  if (voterId) params.set('voterId', voterId);
  const url = `${API}/events?${params.toString()}`;
  es = new EventSource(url);
  es.onmessage = (e) => {
    connBanner.classList.remove('visible');
    const { messages, presence } = JSON.parse(e.data);
    renderMessages(messages);
    renderPresence(presence, voterId);
  };
  es.onerror = async () => {
    connBanner.classList.add('visible');
    if (activeRoom && es.readyState === EventSource.CLOSED) {
      const res = await fetch(`${API}/messages?room=${encodeURIComponent(activeRoom)}`);
      if (res.status === 404) leaveRoom();
    }
  };
}

// ── Boot ──────────────────────────────────────────────────────────────────────

(function init() {
  const author = getAuthor();
  if (!author) {
    showUsernameOverlay();
  } else {
    document.getElementById('username-display').textContent = author;
  }
  updateRoomUI();
  connectSSE();
})();
