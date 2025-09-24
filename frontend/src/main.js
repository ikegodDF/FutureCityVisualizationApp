import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Cartesian3, JulianDate, Math as CesiumMath } from 'cesium';
import { createViewer } from './app/viewer.js';
import { initUI } from './app/controls/ui.js';
import { loadCityTiles } from './app/tiles/cityTiles.js';
import { setupIon } from './app/services/ion.js';
import { add3DModels } from './app/tiles/add3DModels.js';

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

  initUI(viewer);
  const models = await add3DModels(viewer, { outputDiv: document.getElementById('outputContainer') });
  console.log("Models", models);
  return viewer;

}());