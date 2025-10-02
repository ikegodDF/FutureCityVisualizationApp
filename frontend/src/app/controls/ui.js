import { flyToJapan } from '../utils/camera.js';
import '../../styles/ui.css';
import { prediction, result, restore} from './handlers.js';
import { openModal, closeModal, openResultPicker } from './modal.js';
import { resetResult, appState, setAppliedPolicy, setYear, setDisasterState } from '../state/appState.js';
import { renew3DModels } from '../tiles/renew3DModels.js';
import { exportResultSerializable } from '../utils/export.js';

let outputContainer;

export function initUI(viewer, models) {
  if (document.getElementById('uiControls')) return;

  outputContainer = document.createElement('div');
  outputContainer.id = 'outputContainer';
  document.body.appendChild(outputContainer);

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', () => flyToJapan(viewer));

  const btnPrediction = document.createElement('button');
  btnPrediction.textContent = '予測';
  btnPrediction.addEventListener('click', async () => {
    await prediction(viewer, models);
    result(viewer, models, outputContainer);
  });

  const btnreturn = document.createElement('button');
  btnreturn.textContent = '5年前';
  btnreturn.addEventListener('click', async () => {
    await restore(viewer);
    result(viewer, models, outputContainer);
  });

  const btnreset = document.createElement('button');
  btnreset.textContent = 'リセット';
  btnreset.addEventListener('click', async () => {
    resetResult(viewer);
    result(viewer, models, outputContainer);
  });

  const btnExport = document.createElement('button');
  btnExport.textContent = '予測結果の出力';
  btnExport.addEventListener('click', async () => {
    const filename = `result_${Date.now()}.json`;
    exportResultSerializable(filename, appState.result);
  });

  const btnInputappState = document.createElement('button');
  btnInputappState.textContent = '予測結果の呼び出し';
  btnInputappState.addEventListener('click', async () => {
    openResultPicker(viewer, models, outputContainer);
  });
  

  const lineBreak = document.createElement('span');
  lineBreak.className = 'break';



  container.appendChild(btnFlyJapan);
  container.appendChild(lineBreak);
  container.appendChild(btnPrediction);
  container.appendChild(btnreturn);
  container.appendChild(btnreset);
  container.appendChild(lineBreak);
  container.appendChild(btnExport);
  container.appendChild(btnInputappState);
  document.body.appendChild(container);
}

export { outputContainer };


