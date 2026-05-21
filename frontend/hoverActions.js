const HIDE_DELAY_MS = 150;

export function attachBubbleRowHover(row, actionsEl) {
  let hideTimer = null;

  function show() {
    clearTimeout(hideTimer);
    actionsEl.style.display = 'flex';
  }

  function scheduleHide() {
    hideTimer = setTimeout(() => {
      actionsEl.style.display = 'none';
    }, HIDE_DELAY_MS);
  }

  row.addEventListener('mouseenter', show);
  row.addEventListener('mouseleave', scheduleHide);
  actionsEl.addEventListener('mouseenter', show);
  actionsEl.addEventListener('mouseleave', scheduleHide);
}
