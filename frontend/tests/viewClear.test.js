import { describe, it, expect, beforeEach } from 'vitest';
import { getClearedBefore, setClearedBefore, filterClearedMessages } from '../viewClear.js';

describe('viewClear localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getClearedBefore returns null when nothing is stored for that key', () => {
    expect(getClearedBefore('global')).toBeNull();
  });

  it('setClearedBefore stores a timestamp; getClearedBefore returns it for the same key', () => {
    setClearedBefore(1234567890000, 'global');
    expect(getClearedBefore('global')).toBe(1234567890000);
  });

  it('setClearedBefore overwrites a previous value for the same key', () => {
    setClearedBefore(1000, 'global');
    setClearedBefore(2000, 'global');
    expect(getClearedBefore('global')).toBe(2000);
  });

  it('clear for one room does not affect another room', () => {
    setClearedBefore(5000, 'ABC123');
    expect(getClearedBefore('global')).toBeNull();
    expect(getClearedBefore('XYZ789')).toBeNull();
  });

  it('global and room clears are independent', () => {
    setClearedBefore(1000, 'global');
    setClearedBefore(9000, 'ABC123');
    expect(getClearedBefore('global')).toBe(1000);
    expect(getClearedBefore('ABC123')).toBe(9000);
  });
});

describe('filterClearedMessages', () => {
  const messages = [
    { id: '1', createdAt: 1000 },
    { id: '2', createdAt: 2000 },
    { id: '3', createdAt: 3000 },
  ];

  it('returns all messages when clearedBefore is null', () => {
    expect(filterClearedMessages(messages, null)).toHaveLength(3);
  });

  it('hides messages at or before the threshold', () => {
    const result = filterClearedMessages(messages, 2000);
    expect(result.map(m => m.id)).toEqual(['3']);
  });

  it('keeps messages strictly after the threshold', () => {
    const result = filterClearedMessages(messages, 999);
    expect(result).toHaveLength(3);
  });

  it('returns empty array when all messages are cleared', () => {
    const result = filterClearedMessages(messages, 5000);
    expect(result).toHaveLength(0);
  });
});
