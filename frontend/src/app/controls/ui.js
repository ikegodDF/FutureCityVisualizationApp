import { flyToJapan } from '../utils/camera.js';
import '../../styles/ui.css';
import { prediction, result, restore, analysis} from './handlers.js';
import { openModal, closeModal, openResultPicker } from './modal.js';
import { resetResult, appState, setAppliedPolicy, setYear, setDisasterState } from '../state/appState.js';
import { renew3DModels } from '../tiles/renew3DModels.js';
import { exportResultSerializable } from '../utils/export.js';
import { damageAssessment } from './handlers/damageAssessmentHandlers.js';

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

  const btnAnalysis = document.createElement('button');
  btnAnalysis.textContent = '分析';
  btnAnalysis.addEventListener('click', async () => {
    await analysis(viewer, models);
  });
  
  const btnDamageAssessment = document.createElement('button');
  btnDamageAssessment.textContent = '地震被害予測';
  btnDamageAssessment.addEventListener('click', async () => {
    await damageAssessment(viewer, models, '地震発生後');
  });

  const layoutSequence = [
    btnFlyJapan,
    'break',
    btnPrediction,
    btnreturn,
    btnreset,
    'break',
    btnExport,
    btnInputappState,
    'break',
    btnAnalysis,
    btnDamageAssessment,
  ];

  const createRow = () => {
    const row = document.createElement('div');
    row.className = 'control-row';
    return row;
  };

  let currentRow = createRow();
  layoutSequence.forEach((item) => {
    if (item === 'break') {
      if (currentRow.childElementCount > 0) {
        container.appendChild(currentRow);
        currentRow = createRow();
      }
      return;
    }
    currentRow.appendChild(item);
  });

  if (currentRow.childElementCount > 0) {
    container.appendChild(currentRow);
  }
  document.body.appendChild(container);
}

export { outputContainer };


