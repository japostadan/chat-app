import { describe, it, expect } from 'vitest';
import { buildGroupMetaHtml, escapeHtml } from '../formatting.js';

describe('escapeHtml', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('buildGroupMetaHtml', () => {
  it('always includes the author name', () => {
    const html = buildGroupMetaHtml('alice', 1000000000000);
    expect(html).toContain('alice');
  });

  it('includes the author name even when the author is the current user', () => {
    const html = buildGroupMetaHtml('me', 1000000000000);
    expect(html).toContain('me');
  });

  it('escapes HTML in the author name', () => {
    const html = buildGroupMetaHtml('<evil>', 1000000000000);
    expect(html).not.toContain('<evil>');
    expect(html).toContain('&lt;evil&gt;');
  });

  it('contains author · timestamp format', () => {
    const html = buildGroupMetaHtml('alice', 1000000000000);
    expect(html).toMatch(/alice\s*·/);
  });
});
