import { flyToRegion } from '../../utils/camera.js';
import '../../../styles/ui.css';
import { appState, setResult } from '../../state/appState.js';
import { toPayload } from '../../tiles/toPayload.js';
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
  btnFlyJapan.addEventListener('click', async () => {
    flyToRegion(viewer);
    
    const rawCoordinates = [
      { lon: 141.92531154028777, lat: 42.584757821772705 },
      { lon: 141.92471171164863, lat: 42.58461238232443 },
      { lon: 141.9237744998619, lat: 42.582880922752956 },
      { lon: 141.92062856438028, lat: 42.583891873592215 },
      { lon: 141.91832398308716, lat: 42.57967442213749 },
      { lon: 141.9149443891981, lat: 42.58052694440173 },
      { lon: 141.91421648949603, lat: 42.579168653506365 },
      { lon: 141.9200117498631, lat: 42.577397542918774 },
      { lon: 141.9197056939536, lat: 42.576801879889516 },
      { lon: 141.91386645487324, lat: 42.57854821289387 },
      { lon: 141.91284647895057, lat: 42.57676895514808 },
      { lon: 141.91602409012765, lat: 42.57577108392012 },
      { lon: 141.92086126962838, lat: 42.574206339197154 },
      { lon: 141.9235215961746, lat: 42.57338518065725 },
      { lon: 141.92624801925973, lat: 42.57294897953972 },
      { lon: 141.92940993155298, lat: 42.5726947468682 },
      { lon: 141.93075769191174, lat: 42.57259623946901 },
      { lon: 141.9324663366165, lat: 42.572878951246565 },
      { lon: 141.93450446046444, lat: 42.57363209111042 },
      { lon: 141.934351650481, lat: 42.57461123184347 },
      { lon: 141.93373002092108, lat: 42.5751923431551 },
      { lon: 141.93265396636136, lat: 42.57602314905493 },
      { lon: 141.93132133017298, lat: 42.57642332265203 },
      { lon: 141.93179034104577, lat: 42.57734361532766 },
      { lon: 141.93184548361174, lat: 42.578147956725125 },
      { lon: 141.93243849787368, lat: 42.579927475032804 },
      { lon: 141.93083821597548, lat: 42.58049366242949 },
      { lon: 141.9303241489657, lat: 42.581002534396994 },
      { lon: 141.93001377871747, lat: 42.58111720416394 },
      { lon: 141.92602388182638, lat: 42.5822015251931 },
      { lon: 141.92528206646455, lat: 42.58453434812359 }
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

    models = await addNewBuildings(viewer, models, {
      count: 100,
      zones: [customZone],
      roadSpatial: appState.road.spatial,
      targetYear: appState.year, // 現在選択中の年度
      minArea: 40,
      maxArea: 2000
    });
    setResult(models.map(toPayload));

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
