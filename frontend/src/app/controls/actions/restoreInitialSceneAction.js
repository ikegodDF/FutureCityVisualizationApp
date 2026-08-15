import {
  getBaselinePayloads,
  getBaselineSceneRef,
  resetAppStateToBaseline,
} from '../../state/baselineScene.js';
import { resolveBuildingId } from '../../domain/buildings/index.js';
import { getActiveRegion } from '../../region/regionState.js';
import { createGltfEntityFromPayload } from '../../tiles/createGltfEntityFromPayload.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';
import { renewBuildingPopulation } from './renewBuildingPopulationAction.js';
import { refreshRangeVisibility } from './rangeSelectActions.js';
import { replaceSceneModels } from './newPredictionAction.js';

const syncSceneModelsFromBaseline = (viewer, baselineIds) => (
  viewer.entities.values.filter((entity) => {
    const id = resolveBuildingId(entity);
    return id != null && baselineIds.has(id);
  })
);

/**
 * appState.result の基準年データから 3D シーンと state を復元する。
 * @returns {Promise<boolean>}
 */
export async function restoreInitialScene(viewer, models = []) {
  const ref = getBaselineSceneRef();
  const baselinePayloads = getBaselinePayloads();
  if (!ref || !baselinePayloads?.length) {
    console.warn('基準シーン（appState.result の基準年）がありません');
    return false;
  }

  const baselineIds = new Set(baselinePayloads.map((payload) => payload.id));
  const region = getActiveRegion();

  [...viewer.entities.values].forEach((entity) => {
    const id = resolveBuildingId(entity);
    if (id == null) {
      return;
    }
    if (!baselineIds.has(id) || entity.isNewBuilding) {
      viewer.entities.remove(entity);
    }
  });

  const existingIds = new Set(
    viewer.entities.values
      .map((entity) => resolveBuildingId(entity))
      .filter((id) => id != null),
  );

  for (const payload of baselinePayloads) {
    if (existingIds.has(payload.id)) {
      continue;
    }
    const entity = createGltfEntityFromPayload(viewer, payload, region);
    if (entity) {
      existingIds.add(payload.id);
    }
  }

  if (!resetAppStateToBaseline()) {
    console.warn('appState の基準年への復元に失敗しました');
    return false;
  }

  const restoredPayloads = getBaselinePayloads();
  await renew3DModels(viewer, restoredPayloads);
  const populationOk = await renewBuildingPopulation(viewer);
  if (!populationOk) {
    console.warn('restoreInitialScene: 人口按分に失敗しました');
  }
  refreshRangeVisibility(viewer);

  replaceSceneModels(models, syncSceneModelsFromBaseline(viewer, baselineIds));

  console.log(
    `初期シーンを復元しました: ${restoredPayloads.length} 棟（${ref.year}年・result 基準）`,
  );
  return true;
}
