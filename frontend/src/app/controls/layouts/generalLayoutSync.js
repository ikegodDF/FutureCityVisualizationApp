export function syncGeneralLeftStackLayout() {
  const operatorUi = document.getElementById('operator-ui');
  if (!operatorUi) return;

  const gap = 8;
  const bottom = operatorUi.getBoundingClientRect().bottom + gap;
  document.body.style.setProperty('--general-left-stack-offset', `${bottom}px`);
}

export function bindGeneralLeftStackLayoutSync() {
  const operatorUi = document.getElementById('operator-ui');
  if (!operatorUi) return;

  const sync = () => syncGeneralLeftStackLayout();
  sync();

  window.addEventListener('resize', sync);

  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(sync);
    observer.observe(operatorUi);
  }
}
