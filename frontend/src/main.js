import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles/components/shared/region-selector.css';
import { Cartesian3, JulianDate, Math as CesiumMath } from 'cesium';
import { createViewer } from './app/viewer.js';
import { initUI, outputContainer } from './app/controls/index.js';
import { setupIon } from './app/services/ion.js';
import { addGltfModels } from './app/tiles/addGltfModels.js';
import { addPopulationMesh } from './app/tiles/addPopulationMesh.js';
import { addRoad } from './app/tiles/addRoad.js';
import { result } from './app/controls/actions/index.js';
import { appState, setRegion, setResult, setRoad } from './app/state/appState.js';
import { toPayload } from './app/tiles/toPayload.js';
import { promptRegionSelection } from './app/region/regionSelector.js';
import { getActiveRegion } from './app/region/regionState.js';
import { setInitialCamera } from './app/utils/camera.js';
import { mountRegionBadge } from './app/region/regionBadge.js';
import { Terrain, CesiumTerrainProvider } from 'cesium';
import { renewBuildingPopulation } from './app/controls/actions/renewBuildingPopulationAction.js';

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

  await addPopulationMesh(viewer, region);
  const models = await addGltfModels(viewer, region);
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const road = await addRoad(viewer);
  setRoad(road)

  setResult(models.map(toPayload));
  await renewBuildingPopulation(viewer);
  initUI(viewer, models);
  console.log('Region', getActiveRegion());
  console.log('Models', models);
  console.log('AppState', appState);
  result(viewer, models, outputContainer, appState);
  return viewer;
}());

export default viewer;
