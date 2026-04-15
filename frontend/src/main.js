import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Cartesian3, JulianDate, Math as CesiumMath, CesiumTerrainProvider } from 'cesium';
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
import { Cesium3DTileset } from 'cesium';
import { Cesium3DTileStyle } from 'cesium';
import { Matrix4 } from 'cesium';

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

  // むかわ町モデルの読み込み
  const models = await addGltfModels(viewer);

  // 札幌市のCityGMLモデルの読み込み
  // const models = await loadAllSapporoCityGML(viewer);

  // 地形データ
  // const terrain = await CesiumTerrainProvider.fromIonAssetId(2767062);
  // viewer.scene.globe.depthTestAgainstTerrain = true;
  // viewer.terrainProvider = terrain;

  // const tileset = viewer.scene.primitives.add(
  //   await Cesium3DTileset.fromIonAssetId(2602291), {
  //     // キャッシュサイズを増やす（例：512MB = 512 * 1024 * 1024）
  //     cacheBytes: 512 * 1024 * 1024, 
  //     maximumCacheOverflowBytes: 256 * 1024 * 1024,
  //     maximumScreenSpaceError: 16
  //   }
  // );
  // console.log("Tileset", tileset);

  
  
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
  console.log("AppState", appState);
  result(viewer, models, outputContainer, appState);
  return viewer;

}());