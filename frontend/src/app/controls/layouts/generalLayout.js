import '../../../styles/ui.css';
import { appState } from '../../state/appState.js';
import { startRangeSelection } from '../actions/index.js';
import { getDistribution } from '../actions/getDistribution.js';
import { createTimelineView } from '../components/general/timeline/timelineView.js';
import { createTimelineController, TIMELINE_MAX_YEARS, TIMELINE_STEP_YEARS } from '../components/general/timeline/timelineController.js';
import { createEditMenuBar } from '../components/general/editMenu/editMenuBar.js';
import { createBuildingAgeLegend } from '../components/shared/scales/buildingAgeLegend.js';
import { createDistributionLegend, updateLegendContent } from '../components/shared/scales/distributionLegend.js';
import { runConstructionPreview } from '../actions/constructionActions.js';
import { newPrediction } from '../actions/newPredictionAction.js';
import { takeHighResScreenshot } from '../../utils/screenshot.js';
let outputContainer;

export function initGeneralLayout(viewer, models) {
  if (document.getElementById('uiControls')) return;
  document.body.classList.add('ui-mode-general');
  document.body.classList.remove('ui-mode-editor');
  const baseYear = appState.year;

  outputContainer = document.createElement('div');
  outputContainer.id = 'outputContainer';
  document.body.appendChild(outputContainer);

  const container = document.createElement('div');
  container.id = 'uiControls';

  const btnFlyJapan = document.createElement('button');
  btnFlyJapan.textContent = '初期位置へ';
  btnFlyJapan.addEventListener('click', async () => {
    models = await runConstructionPreview(viewer, models);

    // 建物データ取得
    // const filename = `result_${Date.now()}.json`;
    // exportResultSerializable(filename, appState.result);
  });


  const btnRangeSelect = document.createElement('button');
  btnRangeSelect.textContent = '範囲選択して編集';
  btnRangeSelect.addEventListener('click', () => {
    startRangeSelection(viewer);
  })

  const btnAddDistribution = document.createElement('button');
  btnAddDistribution.textContent = '分布取得';
  btnAddDistribution.addEventListener('click', () => {
    getDistribution(viewer);
  });

  const btnAnalyze = document.createElement('button');
  btnAnalyze.textContent = '分析';

  const btnScreenshot = document.createElement('button');
  btnScreenshot.textContent = 'スクリーンショット';
  btnScreenshot.addEventListener('click', async () => {
    btnScreenshot.disabled = true;
    try {
      await takeHighResScreenshot(viewer);
    } catch (error) {
      console.error('スクリーンショット取得に失敗しました:', error);
    } finally {
      btnScreenshot.disabled = false;
    }
  });

  const timelineController = createTimelineController({
    viewer,
    models,
    outputContainer,
    baseYear,
  });

  const legendElement = createDistributionLegend();

  const timeline = createTimelineView({
    baseYear,
    currentYear: appState.year,
    currentDisasterState: appState.disasterState,
    currentPolicy: appState.appliedPolicy,
    maxYears: TIMELINE_MAX_YEARS,
    stepYears: TIMELINE_STEP_YEARS,
    onApplyYear: async (selectedYear) => {
      await timelineController.moveToYear(selectedYear);
      timeline.setYear(appState.year);
      timeline.setDisasterState(appState.disasterState);
    },
    onDisasterChange: async (disasterState) => {
      await timelineController.applyDisasterState(disasterState);
      timeline.setDisasterState(appState.disasterState);
      updateLegendContent(legendElement)
    },
    onPolicyChange: async (policyName) => {
      await timelineController.applyPolicy(policyName);
    },
    onTrimFuture: async (selectedYear) => {
      await timelineController.trimFutureFromYear(selectedYear);
      timeline.setYear(appState.year);
    },
  });

  btnAnalyze.addEventListener('click', async () => {
    const ok = await newPrediction(viewer, models, 25);
    if (!ok) return;
    timeline.setYear(appState.year);
    timeline.setDisasterState(appState.disasterState);
    timelineController.syncResult();
  });

  const row = document.createElement('div');
  row.className = 'control-row';
  row.appendChild(btnFlyJapan);
  row.appendChild(btnRangeSelect);
  row.appendChild(btnAddDistribution);
  row.appendChild(btnAnalyze);

  const rowSecondary = document.createElement('div');
  rowSecondary.className = 'control-row';
  rowSecondary.appendChild(btnScreenshot);

  container.appendChild(row);
  container.appendChild(rowSecondary);
  container.appendChild(createBuildingAgeLegend());
  container.appendChild(legendElement);
  
  const editMenuBar = createEditMenuBar({ title: 'モデル編集' });
  editMenuBar.content.appendChild(timeline.element);
  container.appendChild(editMenuBar.element);

  document.body.appendChild(container);

  timelineController.syncResult();
}

export { outputContainer };
