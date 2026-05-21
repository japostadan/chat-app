import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { attachBubbleRowHover } from '../hoverActions.js';

describe('attachBubbleRowHover', () => {
  let row, actions;

  beforeEach(() => {
    row = document.createElement('div');
    actions = document.createElement('div');
    actions.style.display = 'none';
    row.appendChild(actions);
    document.body.appendChild(row);
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.removeChild(row);
    vi.useRealTimers();
  });

  it('shows actions panel on mouseenter of bubble row', () => {
    attachBubbleRowHover(row, actions);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(actions.style.display).toBe('flex');
  });

  it('hides actions panel after 150ms on mouseleave of bubble row', () => {
    attachBubbleRowHover(row, actions);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    row.dispatchEvent(new MouseEvent('mouseleave'));
    expect(actions.style.display).toBe('flex'); // still visible before delay
    vi.advanceTimersByTime(150);
    expect(actions.style.display).toBe('none');
  });

  it('cancels hide timer when pointer enters the actions panel', () => {
    attachBubbleRowHover(row, actions);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    row.dispatchEvent(new MouseEvent('mouseleave'));
    actions.dispatchEvent(new MouseEvent('mouseenter')); // cancel the timer
    vi.advanceTimersByTime(300);
    expect(actions.style.display).toBe('flex');
  });

  it('hides actions panel after 150ms on mouseleave of actions panel', () => {
    attachBubbleRowHover(row, actions);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    actions.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(150);
    expect(actions.style.display).toBe('none');
  });

  it('panel stays hidden when pointer never enters row', () => {
    attachBubbleRowHover(row, actions);
    expect(actions.style.display).toBe('none');
  });
});
