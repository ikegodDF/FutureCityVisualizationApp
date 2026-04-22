import { flyToJapan } from '../../utils/camera.js';
import '../../../styles/ui.css';
import { result } from '../actions/index.js';
import { createBuildingAgeLegend } from '../components/scales/buildingAgeLegend.js';

let outputContainer;

export function initGeneralLayout(viewer, models) {
  if (document.getElementById('uiControls')) return;

  outputContainer = document.createElement('div');
  outputContainer.id = 'outputContainer';
  document.body.appendChild(outputContainer);

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', () => flyToJapan(viewer));

  const btnRefreshResult = document.createElement('button');
  btnRefreshResult.textContent = '表示更新';
  btnRefreshResult.addEventListener('click', () => {
    result(viewer, models, outputContainer);
  });

  const row = document.createElement('div');
  row.className = 'control-row';
  row.appendChild(btnFlyJapan);
  row.appendChild(btnRefreshResult);
  container.appendChild(row);

  container.appendChild(createBuildingAgeLegend());
  document.body.appendChild(container);
}

export { outputContainer };
