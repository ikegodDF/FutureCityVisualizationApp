import { appState, setDisasterState, setYear, setResult, removeModelsFromSelectedRanges } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';
import { refreshRangeVisibility } from './rangeSelectActions.js';
import { buildComputePayload } from '../../region/regionState.js';
import { generateBuildingsByCategory } from '../../construction/generateBuildings.js';
import { toPayload, resolveBuildingId } from '../../domain/buildings/index.js';

/** 共有 models 配列の中身を差し替える（参照は維持） */
export const replaceSceneModels = (models, nextModels) => {
  models.length = 0;
  models.push(...nextModels);
};

const syncSceneModelsFromResult = (viewer, resultPayloads) => {
  const resultIds = new Set(resultPayloads.map((model) => model.id));
  return viewer.entities.values.filter((entity) => {
    const id = resolveBuildingId(entity);
    return id != null && resultIds.has(id);
  });
};

const removeBuildingEntity = (viewer, models, deleteId) => {
  const entity = viewer.entities.getById(deleteId)
    ?? models.find((model) => resolveBuildingId(model) === deleteId);
  if (entity) {
    viewer.entities.remove(entity);
  }
};

const applyCachedYear = async (viewer, models, addYear) => {
  setYear(appState.year + addYear);
  const nextResult = appState.result[appState.appliedPolicy][appState.year][appState.disasterState];
  await renew3DModels(viewer, nextResult);
  refreshRangeVisibility(viewer);
  return syncSceneModelsFromResult(viewer, nextResult);
};

const fetchNewPrediction = async (payload) => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  const res = await fetch(`${apiBaseUrl}/api/v1/calculate/new_prediction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`new_prediction API Error (${res.status}):`, errorText);
    return null;
  }

  return res.json();
};

const collectDeletedIdsFromResults = (previousResult = [], nextResult = []) => {
  const nextIds = new Set(nextResult.map((model) => model.id));
  return previousResult
    .filter((model) => !nextIds.has(model.id))
    .map((model) => model.id);
};

const applyPredictionToScene = async (
  viewer,
  models,
  data,
  { previousYear, addYear, currentParams },
) => {
  const deleteSet = new Set(data.deletes ?? []);
  removeModelsFromSelectedRanges([...deleteSet]);

  for (const deleteId of deleteSet) {
    removeBuildingEntity(viewer, models, deleteId);
  }

  let sceneModels = models.filter(
    (model) => !deleteSet.has(resolveBuildingId(model) ?? -1),
  );

  const addCount = (data.add_num ?? []).reduce(
    (sum, count) => sum + (Number(count) || 0),
    0,
  );
  const targetAppStateYear = previousYear + addYear;

  if (addCount > 0) {
    sceneModels = await generateBuildingsByCategory(
      viewer,
      sceneModels,
      data.add_num ?? [],
      {
        idSources: currentParams,
        targetAppStateYear,
      },
    );
  }

  // バックエンド生成 models が将来追加された場合の逃がし
  if (Array.isArray(data.models) && data.models.length > 0) {
    console.warn('new_prediction: data.models は未対応のためスキップしました');
  }

  return sceneModels;
};

const commitTimelineAdvance = async (viewer, sceneModels, targetYear) => {
  const nextResult = sceneModels.map(toPayload);
  setYear(targetYear);
  setResult(nextResult, 0);
  await renew3DModels(viewer, nextResult);
  refreshRangeVisibility(viewer);
  return nextResult;
};

/**
 * 新将来予測: API で削除・新築数を取得し、appState / 3D シーンを更新する。
 * UI 同期は generalLayout（タイムラインスライダー）側で行う。
 * @returns {Promise<boolean>}
 */
export const newPrediction = async (viewer, models = [], addYear = 5) => {
  if (appState.disasterState !== '被災前') {
    setDisasterState('被災前');
  }

  const policy = appState.appliedPolicy;
  const disaster = appState.disasterState;
  const previousYear = appState.year;

  const finish = (sceneModels) => {
    replaceSceneModels(models, sceneModels);
    console.log(appState);
    return true;
  };

  if (appState.result[policy]?.[previousYear + addYear]) {
    const previousResult = appState.result[policy][previousYear][disaster];
    const cachedResult = appState.result[policy][previousYear + addYear][disaster];
    removeModelsFromSelectedRanges(
      collectDeletedIdsFromResults(previousResult, cachedResult),
    );
    const sceneModels = await applyCachedYear(viewer, models, addYear);
    return finish(sceneModels);
  }

  const payload = buildComputePayload({
    method: 'building_retention_rate',
    appStateYear: previousYear,
    addYear,
    percentage: 50,
    disasterState: disaster,
    params: appState.result[policy][previousYear][disaster],
    selectedRanges: appState.selectedRanges[previousYear],
  });

  console.log('new_prediction payload:', payload);

  try {
    const data = await fetchNewPrediction(payload);
    if (!data) {
      return false;
    }

    console.log('new_prediction response:', data);

    const currentParams = appState.result[policy][previousYear][disaster];
    const sceneModels = await applyPredictionToScene(viewer, models, data, {
      previousYear,
      addYear,
      currentParams,
    });

    await commitTimelineAdvance(viewer, sceneModels, previousYear + addYear);
    return finish(sceneModels);
  } catch (error) {
    console.error('new_prediction error:', error);
    return false;
  }
};
