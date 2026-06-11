import { getActiveRegion } from './regionState.js';

export function mountRegionBadge(onChangeRegion) {
  const existing = document.getElementById('regionCurrentLabel');
  if (existing) existing.remove();

  const region = getActiveRegion();
  if (!region) return;

  const badge = document.createElement('div');
  badge.id = 'regionCurrentLabel';
  badge.className = 'region-current-label';
  badge.innerHTML = `
    <span>地域: ${region.label}</span>
    <button type="button" class="region-change-button">変更</button>
  `;

  badge.querySelector('.region-change-button')?.addEventListener('click', () => {
    sessionStorage.removeItem('activeRegionId');
    onChangeRegion?.();
  });

  document.body.appendChild(badge);
}
