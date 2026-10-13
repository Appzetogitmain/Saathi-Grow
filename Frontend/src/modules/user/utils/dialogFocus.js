export const trapDialogFocus = (dialog, close) => {
  if (!dialog) return () => {};
  const previous = document.activeElement;
  const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
    .filter(node => node.getClientRects().length > 0 && !node.hidden);
  const focusFirst = () => (focusable()[0] || dialog).focus();
  focusFirst();
  const keydown = event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const nodes = focusable();
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { event.preventDefault(); dialog.focus(); }
    else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };
  const focusin = event => { if (!dialog.contains(event.target)) focusFirst(); };
  document.addEventListener('keydown', keydown, true);
  document.addEventListener('focusin', focusin);
  return () => {
    document.removeEventListener('keydown', keydown, true);
    document.removeEventListener('focusin', focusin);
    if (previous?.isConnected && (dialog.contains(document.activeElement) || document.activeElement === document.body)) previous.focus();
  };
};
