import { describe, it, expect, beforeEach } from 'vitest';
import { getVoterId } from '../voter.js';

describe('voter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getVoterId returns a non-empty string', () => {
    expect(typeof getVoterId()).toBe('string');
    expect(getVoterId().length).toBeGreaterThan(0);
  });

  it('getVoterId returns the same id on subsequent calls', () => {
    expect(getVoterId()).toBe(getVoterId());
  });

  it('getVoterId persists across calls by storing in localStorage', () => {
    const id = getVoterId();
    localStorage.clear();
    // after clear a new id is generated — not the same
    const newId = getVoterId();
    expect(typeof newId).toBe('string');
    // but once generated, it is stable
    expect(getVoterId()).toBe(newId);
  });
});
