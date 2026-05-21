import { escapeHtml } from './formatting.js';

export function renderPresence(players, currentVoterId) {
  const list = document.getElementById('player-list');
  if (!list) return;
  list.innerHTML = players.map(({ voterId, author }) => {
    const isSelf = voterId === currentVoterId;
    return `<li class="player-entry${isSelf ? ' self' : ''}">${escapeHtml(author)}</li>`;
  }).join('');
}
