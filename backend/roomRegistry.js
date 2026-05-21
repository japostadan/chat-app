const { randomBytes } = require('crypto');
const { createStore } = require('./store');
const { createBroadcaster } = require('./broadcaster');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LENGTH = 6;

function generateCode() {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
}

function createRoom() {
  return { store: createStore(), broadcaster: createBroadcaster() };
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

    create() {
      let code;
      do { code = generateCode(); } while (rooms.has(code));
      rooms.set(code, createRoom());
      return code;
    },
  };
}

module.exports = { createRoomRegistry };
