const STORAGE_KEY = 'chat_cleared_before';

function loadMap() {
  try {
    const val = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
  } catch {
    return {};
  }
}

export function getClearedBefore(roomKey) {
  const map = loadMap();
  return roomKey in map ? map[roomKey] : null;
}

export function setClearedBefore(ts, roomKey) {
  const map = loadMap();
  map[roomKey] = ts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function filterClearedMessages(messages, clearedBefore) {
  if (clearedBefore === null) return messages;
  return messages.filter(m => m.createdAt > clearedBefore);
}
