import { flyToRegion } from '../../utils/camera.js';
import '../../../styles/ui.css';
import { appState } from '../../state/appState.js';
import { startRangeSelection } from '../actions/index.js';
import { getDistribution } from '../actions/getDistribution.js';
import { createTimelineView } from '../components/general/timeline/timelineView.js';
import { createTimelineController, TIMELINE_MAX_YEARS, TIMELINE_STEP_YEARS } from '../components/general/timeline/timelineController.js';
import { createEditMenuBar } from '../components/general/editMenu/editMenuBar.js';
import { createBuildingAgeLegend } from '../components/shared/scales/buildingAgeLegend.js';
import { createDistributionLegend, updateLegendContent } from '../components/shared/scales/distributionLegend.js';
import { exportResultSerializable } from '../../utils/export.js';
import { analysis } from '../actions/analysisActions.js';
import { addNewBuildings } from '../../tiles/addRandomConstruction.js'
import * as turf from "@turf/turf";
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
  btnFlyJapan.addEventListener('click', () => {
    flyToRegion(viewer);
    
    const rawCoordinates = [
      {lon: 141.91740315160806, lat: 42.585991400262934},
      {lon: 141.90966064713453, lat: 42.57690458996496},
      {lon: 141.92520841900705, lat: 42.57106929002629},
      {lon: 141.93360123618373, lat: 42.56989895924605},
      {lon: 141.93624813137941, lat: 42.5775554956855},
      {lon: 141.93008710853925, lat: 42.58300074630031},
      {lon: 141.92850269190967, lat: 42.58396709426695},
      {lon: 141.92850269190967, lat: 42.58396709426695}
      // ※重複している最後の要素は除外してOK
    ];
    
    
    /**
     * {lon, lat} 配列を Turf.js 用の GeoJSON Polygon に変換する関数
     */
    function createTurfPolygonFromPoints(points) {
      // 1. [lon, lat] の二次元配列に変換
      const ring = points.map(pt => [pt.lon, pt.lat]);
      
      // 2. 多角形を閉じるため、始点の座標を末尾に追加する
      ring.push([points[0].lon, points[0].lat]);
    
      // 3. Turf Polygon の生成 (二重配列 [[ [lon, lat], ... ]] にする必要があります)
      return turf.polygon([ring]);
    }
    
    // ゾーンデータとして定義
    const customZone = {
      name: "むかわ町指定エリア",
      type: "residential",
      weight: 1.0,
      maxBuildingCoverageRatio: 0.6,
      polygon: createTurfPolygonFromPoints(rawCoordinates) // ★ここで変換して渡す
    };

    const currentAllModels = addNewBuildings(viewer, models, {
      count: 1000,
      zones: [customZone],
      targetYear: appState.year, // 現在選択中の年度
    });

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
  btnAnalyze.addEventListener('click', () => {
    analysis(viewer, models);
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

  const row = document.createElement('div');
  row.className = 'control-row';
  row.appendChild(btnFlyJapan);
  row.appendChild(btnRangeSelect);
  row.appendChild(btnAddDistribution);
  row.appendChild(btnAnalyze);
  container.appendChild(row);
  container.appendChild(createBuildingAgeLegend());
  container.appendChild(legendElement);
  
  const editMenuBar = createEditMenuBar({ title: 'モデル編集' });
  editMenuBar.content.appendChild(timeline.element);
  container.appendChild(editMenuBar.element);

  document.body.appendChild(container);

  timelineController.syncResult();
}

export { outputContainer };
