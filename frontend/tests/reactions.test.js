import { describe, it, expect, beforeEach } from 'vitest';
import { getReaction, setReaction, clearReaction } from '../reactions.js';

describe('reactions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getReaction returns null for a message with no reaction', () => {
    expect(getReaction('msg-1')).toBeNull();
  });

  it('setReaction stores a like; getReaction returns it', () => {
    setReaction('msg-1', 'like');
    expect(getReaction('msg-1')).toBe('like');
  });

  it('setReaction stores a dislike; getReaction returns it', () => {
    setReaction('msg-1', 'dislike');
    expect(getReaction('msg-1')).toBe('dislike');
  });

  it('setReaction overwrites a previous reaction', () => {
    setReaction('msg-1', 'like');
    setReaction('msg-1', 'dislike');
    expect(getReaction('msg-1')).toBe('dislike');
  });

  it('clearReaction removes the stored reaction', () => {
    setReaction('msg-1', 'like');
    clearReaction('msg-1');
    expect(getReaction('msg-1')).toBeNull();
  });

  it('reactions for different messages are independent', () => {
    setReaction('msg-1', 'like');
    setReaction('msg-2', 'dislike');
    expect(getReaction('msg-1')).toBe('like');
    expect(getReaction('msg-2')).toBe('dislike');
  });
});
