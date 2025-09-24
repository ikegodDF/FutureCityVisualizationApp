import 'cesium/Build/Cesium/Widgets/widgets.css';
import { Viewer, Ion, Cartesian3, JulianDate, Math as CesiumMath } from 'cesium';

// Viteの公開アセット（frontend/public/cesium に Build/Cesium の中身を配置）
// 例: cp -r node_modules/cesium/Build/Cesium frontend/public/cesium
window.CESIUM_BASE_URL = '/cesium';

// Cesium IONアクセストークンを環境変数から設定
Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_ION_TOKEN;

const viewer = (function() { 
  const viewer = new Viewer('cesiumContainer'); 

  // カメラの初期位置を設定(俯瞰)
  viewer.camera.setView({ 
    destination: Cartesian3.fromDegrees(141.925, 42.563, 500),  //日本全体(138, 29, 4000000)
    orientation: { 
      heading: 0, // 視点の向き
      pitch: -20 * CesiumMath.PI / 180, // 視点のピッチ
      roll: 0 
    } 
  });

// UTCで2025年1月1日0時を設定
const targetTime = new Date(Date.UTC(2025, 0, 1, 0, 0, 0)); // UTCの0時
viewer.clock.currentTime = JulianDate.fromDate(targetTime);

    return viewer;

}());