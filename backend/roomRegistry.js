const { randomBytes } = require('crypto');
const { createStore } = require('./store');
const { createBroadcaster } = require('./broadcaster');
const { createPresenceTracker } = require('./presence');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

function generateCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

function createRoom() {
  return { store: createStore(), broadcaster: createBroadcaster(), presence: createPresenceTracker() };
}

function createRoomRegistry() {
  const global = createRoom();
  const rooms = new Map();

  return {
    getGlobal() {
      return global;
    },

    get(code) {
      return rooms.get(code);
    },

    getAll() {
      return [global, ...rooms.values()];
    },

    create() {
      let code;
      do { code = generateCode(); } while (rooms.has(code));
      rooms.set(code, createRoom());
      return code;
    },
  };
}

module.exports = { createRoomRegistry };
