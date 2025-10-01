import { flyToJapan } from '../utils/camera.js';
import '../../styles/ui.css';
import { prediction, result } from './handlers.js';

export function initUI(viewer, models) {
  if (document.getElementById('uiControls')) return;

  const outputContainer = document.createElement('div');
  outputContainer.id = 'outputContainer';
  document.body.appendChild(outputContainer);

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', () => flyToJapan(viewer));

  const btnPrediction = document.createElement('button');
  btnPrediction.textContent = '予測';
  btnPrediction.addEventListener('click', () => 
    prediction(viewer, models),
    result(viewer, models, outputContainer)
  );


  container.appendChild(btnFlyJapan);
  container.appendChild(btnPrediction);
  document.body.appendChild(container);
}


