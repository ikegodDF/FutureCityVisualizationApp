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
import { appState, setRegion, setResult, setRoad, setBlockRegions } from './app/state/appState.js';
import { setBaselineSceneRef } from './app/state/baselineScene.js';
import { blockRegionsFromConstructionZones } from './app/state/blockRegions.js';
import { buildZonesFromConfig, buildZonesFromRoadBlocks } from './app/construction/constructionZoneUtils.js';
import { getActiveRegionId } from './app/region/regionState.js';
import { toPayload } from './app/domain/buildings/toPayload.js';
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
  let models = await addGltfModels(viewer, region);
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const road = await addRoad(viewer);
  setRoad(road);

  const configZones = buildZonesFromConfig(getActiveRegionId());
  setBlockRegions(blockRegionsFromConstructionZones(
    buildZonesFromRoadBlocks(road, configZones),
  ));
  console.log(`街区領域: ${appState.blockRegions.length} 区画（地図非表示・appState のみ保持）`);

  setResult(models.map(toPayload));
  await renewBuildingPopulation(viewer);
  setBaselineSceneRef();
  initUI(viewer, models);
  console.log('Region', getActiveRegion());
  console.log('Models', models);
  console.log('AppState', appState);
  result(viewer, models, outputContainer, appState);
  return viewer;
}());

export default viewer;
