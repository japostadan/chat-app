const STORAGE_KEY = 'chat_cleared_before';

export function getClearedBefore() {
  const val = localStorage.getItem(STORAGE_KEY);
  return val !== null ? Number(val) : null;
}

export function setClearedBefore(ts) {
  localStorage.setItem(STORAGE_KEY, String(ts));
}

export function filterClearedMessages(messages, clearedBefore) {
  if (clearedBefore === null) return messages;
  return messages.filter(m => m.createdAt > clearedBefore);
}
