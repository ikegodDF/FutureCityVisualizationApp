import { flyToJapan } from '../utils/camera.js';
import '../../styles/ui.css';

export function initUI(viewer) {
  if (document.getElementById('uiControls')) return;

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', () => flyToJapan(viewer));

  container.appendChild(btnFlyJapan);
  document.body.appendChild(container);
}


