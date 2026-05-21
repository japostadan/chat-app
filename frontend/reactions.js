const STORAGE_KEY = 'chat_reactions';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function save(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getReaction(messageId) {
  return load()[messageId] || null;
}

export function setReaction(messageId, reaction) {
  const map = load();
  map[messageId] = reaction;
  save(map);
}

export function clearReaction(messageId) {
  const map = load();
  delete map[messageId];
  save(map);
}
