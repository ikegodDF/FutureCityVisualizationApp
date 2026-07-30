import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles/components/shared/region-selector.css';
import { Cartesian3, JulianDate, Color,  Math as CesiumMath } from 'cesium';
import { createViewer } from './app/viewer.js';
import { initUI, outputContainer } from './app/controls/index.js';
import { setupIon } from './app/services/ion.js';
import { addGltfModels } from './app/tiles/addGltfModels.js';
import { addRoad, findAndDrawMultipleRoutes, findAndDrawRoute, extractEnclosedRegions} from './app/tiles/addRoad.js';
import { result } from './app/controls/actions/index.js';
import { appState, setRegion, setResult } from './app/state/appState.js';
import { toPayload } from './app/tiles/toPayload.js';
import { promptRegionSelection } from './app/region/regionSelector.js';
import { getActiveRegion } from './app/region/regionState.js';
import { setInitialCamera } from './app/utils/camera.js';
import { mountRegionBadge } from './app/region/regionBadge.js';
import { Terrain, CesiumTerrainProvider } from 'cesium';

window.CESIUM_BASE_URL = '/cesium';
setupIon();

const viewer = (async function bootstrap() {
  const region = await promptRegionSelection();
  setRegion(region);

  const viewer = createViewer('cesiumContainer');
  setInitialCamera(viewer, region);
  mountRegionBadge(async () => {
    window.location.reload();
  });
  

  const targetTime = new Date(Date.UTC(2025, 0, 1, 0, 0, 0));
  viewer.clock.currentTime = JulianDate.fromDate(targetTime);

  viewer.scene.setTerrain(
    new Terrain(
      CesiumTerrainProvider.fromIonAssetId(2767062),
    ),
  );

  const models = await addGltfModels(viewer, region);
  const road = await addRoad(viewer);
  const enclosedRegions = extractEnclosedRegions(road.adjacencyList);
  const colorPalette = [
    Color.RED.withAlpha(0.4),
    Color.BLUE.withAlpha(0.4),
    Color.GREEN.withAlpha(0.4),
    Color.YELLOW.withAlpha(0.4),
    Color.ORANGE.withAlpha(0.4),
    Color.PURPLE.withAlpha(0.4),
    Color.CYAN.withAlpha(0.4),
    Color.MAGENTA.withAlpha(0.4),
    Color.LIME.withAlpha(0.4),
    Color.TEAL.withAlpha(0.4)
];

enclosedRegions.forEach((positions, index) => {
    // パレットから順番に取得（末尾までいったら最初に戻る）
    const fillColor = colorPalette[index % colorPalette.length];

    viewer.entities.add({
        name: `区画_${index + 1}`,
        polygon: {
            hierarchy: positions,
            material: fillColor,
            outline: true,
            outlineColor: Color.WHITE.withAlpha(0.8) // 境界線は白で見やすく
        }
    });
});
  // const buildingA_Position = Cartesian3.fromDegrees(140.724535,  42.585048); // 東京駅付近
  // const buildingB_Position = Cartesian3.fromDegrees(140.701832, 42.587170);
  // findAndDrawRoute(viewer, road, buildingA_Position, buildingB_Position);

  viewer.scene.globe.depthTestAgainstTerrain = true;

  setResult(models.map(toPayload));
  initUI(viewer, models);
  console.log('Region', getActiveRegion());
  console.log('Models', models);
  console.log('AppState', appState);
  result(viewer, models, outputContainer, appState);
  return viewer;
}());

export default viewer;
