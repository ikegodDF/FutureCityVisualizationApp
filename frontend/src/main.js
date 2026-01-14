import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Cartesian3, JulianDate, Math as CesiumMath } from 'cesium';
import { createViewer } from './app/viewer.js';
import { initUI } from './app/controls/ui.js';
import { loadCityTiles } from './app/tiles/cityTiles.js';
import { setupIon } from './app/services/ion.js';
import { addGltfModels } from './app/tiles/addGltfModels.js';
import { loadAllSapporoCityGML } from './app/tiles/loadSapporoCityGML.js';
import { result } from './app/controls/handlers.js';
import { appState, setResult } from './app/state/appState.js';
import { outputContainer } from './app/controls/ui.js';
import { toPayload } from './app/tiles/toPayload.js';

// 公開アセットのベースURL
window.CESIUM_BASE_URL = '/cesium';
setupIon();

const viewer = (async function() { 
  const viewer = createViewer('cesiumContainer'); 

  // カメラの初期位置を設定(俯瞰)
  viewer.camera.setView({ 
    destination: Cartesian3.fromDegrees(141.925, 42.563, 500),
    orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 }
  });

// UTCで2025年1月1日0時を設定
const targetTime = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
viewer.clock.currentTime = JulianDate.fromDate(targetTime);

  const models = await loadAllSapporoCityGML(viewer);
  
  // モデルが読み込まれた後、画角はそのままに緯度経度だけ移動
  if (models.length > 0) {
    // 緯度経度が設定されている最初のモデルを使用
    const target = models.find(m => m.latitude != null && m.longitude != null);
    if (target) {
      const { latitude, longitude } = target;
      // 画角はそのままに、緯度経度だけ移動
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(longitude, latitude, 500),
        orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 }
      });
    }
  }
  
  setResult(models.map(toPayload));
  initUI(viewer, models);
  console.log("Models", models);
  result(viewer, models, outputContainer, appState);
  return viewer;

}());