const STORAGE_KEY = 'chat_room';

export function getActiveRoom() {
  return sessionStorage.getItem(STORAGE_KEY) || null;
}

export function setActiveRoom(code) {
  sessionStorage.setItem(STORAGE_KEY, code);
}

export function clearActiveRoom() {
  sessionStorage.removeItem(STORAGE_KEY);
}
