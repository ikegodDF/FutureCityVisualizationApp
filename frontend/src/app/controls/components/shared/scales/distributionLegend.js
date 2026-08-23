import { appState } from '../../../../state/appState.js';
import { DISTRIBUTION_MODES } from './distributionConfig.js';

function renderLegendItems(items) {
  return items.map(([color, label]) => `
    <div class="legend-item">
      <span class="legend-swatch" style="background-color:${color}"></span>
      <span class="legend-label">${label}</span>
    </div>
  `).join('');
}

export function createDistributionLegend() {
  const el = document.createElement('div');
  el.id = 'distributionLegend';
  el.className = 'distribution-legend';
  syncDistributionLegend(el);
  return el;
}

/** 分布スケールの表示を appState.distributionLegendMode に合わせて更新 */
export function syncDistributionLegend(el = document.getElementById('distributionLegend')) {
  if (!el) return;

  const config = DISTRIBUTION_MODES[appState.distributionLegendMode];
  if (!config) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  el.style.display = 'flex';
  el.innerHTML = `<div class="legend-title">${config.title}</div>${renderLegendItems(config.items)}`;
}

/** @param {import('./distributionConfig.js').DistributionMode|null} mode */
export function setDistributionLegendMode(mode) {
  appState.distributionLegendMode = mode ?? null;
  syncDistributionLegend();
}

export function clearDistributionLegend() {
  setDistributionLegendMode(null);
}

export function isDistributionLegendVisible() {
  return appState.distributionLegendMode != null;
}
