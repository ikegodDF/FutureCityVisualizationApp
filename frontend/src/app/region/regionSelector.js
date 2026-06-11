import { fetchRegions, restoreActiveRegion, setActiveRegion } from './regionState.js';

const OVERLAY_ID = 'regionSelectorOverlay';

const createRegionCard = (region, onSelect) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'region-card';
  button.innerHTML = `
    <span class="region-card-label">${region.label}</span>
    <span class="region-card-description">${region.description ?? ''}</span>
  `;
  button.addEventListener('click', () => onSelect(region));
  return button;
};

export async function promptRegionSelection({ forcePrompt = false } = {}) {
  const regions = await fetchRegions();

  if (!forcePrompt) {
    const savedRegionId = sessionStorage.getItem('activeRegionId');
    const savedRegion = regions.find((region) => region.id === savedRegionId);
    if (savedRegion) {
      setActiveRegion(savedRegion);
      return savedRegion;
    }
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'region-selector-overlay';

    const panel = document.createElement('div');
    panel.className = 'region-selector-panel';

    const title = document.createElement('h1');
    title.className = 'region-selector-title';
    title.textContent = '予測対象地域を選択';

    const description = document.createElement('p');
    description.className = 'region-selector-description';
    description.textContent = '選択した地域の3Dモデルと地震・津波データが読み込まれます。';

    const list = document.createElement('div');
    list.className = 'region-selector-list';

    regions.forEach((region) => {
      list.appendChild(createRegionCard(region, (selectedRegion) => {
        setActiveRegion(selectedRegion);
        overlay.remove();
        resolve(selectedRegion);
      }));
    });

    panel.append(title, description, list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

export function initRegionFromStorage() {
  return restoreActiveRegion();
}
