import { describe, it, expect, beforeEach } from 'vitest';
import { getActiveRoom, setActiveRoom, clearActiveRoom } from '../roomState.js';

describe('roomState', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('getActiveRoom returns null when nothing is stored', () => {
    expect(getActiveRoom()).toBeNull();
  });

  it('setActiveRoom stores the code; getActiveRoom returns it', () => {
    setActiveRoom('ABC123');
    expect(getActiveRoom()).toBe('ABC123');
  });

  it('clearActiveRoom removes the stored code', () => {
    setActiveRoom('ABC123');
    clearActiveRoom();
    expect(getActiveRoom()).toBeNull();
  });

  it('setActiveRoom overwrites a previous code', () => {
    setActiveRoom('AAAAAA');
    setActiveRoom('BBBBBB');
    expect(getActiveRoom()).toBe('BBBBBB');
  });
});
