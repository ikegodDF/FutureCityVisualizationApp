import { appState, setDisasterState, setYear, setResult } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';
import { refreshRangeVisibility } from './rangeSelectActions.js';
import { buildComputePayload } from '../../region/regionState.js';
import { generateBuildingsByCategory } from '../../construction/generateBuildings.js';
import { toPayload, resolveBuildingId } from '../../domain/buildings/index.js';

const removeBuildingEntity = (viewer, models, deleteId) => {
  const entity = viewer.entities.getById(deleteId)
    ?? models.find((model) => resolveBuildingId(model) === deleteId);
  if (entity) {
    viewer.entities.remove(entity);
  }
};

export const newPrediction = async (viewer, models = [], addYear = 5) => {
  if (appState.disasterState !== '被災前') {
    setDisasterState('被災前');
  }

  if (appState.result[appState.appliedPolicy][appState.year + addYear]) {
    setYear(appState.year + addYear);
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
    refreshRangeVisibility(viewer);
    return true;
  }

  const payload = buildComputePayload({
    method: 'building_retention_rate',
    appStateYear: appState.year,
    addYear,
    percentage: 50,
    disasterState: appState.disasterState,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    selectedRanges: appState.selectedRanges[appState.year],
  });

  console.log('new_prediction payload:', payload);

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/calculate/new_prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`new_prediction API Error (${res.status}):`, errorText);
      return false;
    }

    const data = await res.json();
    console.log('new_prediction response:', data);

    const previousYear = appState.year;
    const policy = appState.appliedPolicy;
    const disaster = appState.disasterState;
    const currentParams = appState.result[policy][previousYear][disaster];
    const deleteSet = new Set(data.deletes ?? []);

    for (const deleteId of deleteSet) {
      removeBuildingEntity(viewer, models, deleteId);
    }

    let nextResult = currentParams.filter((model) => !deleteSet.has(model.id));
    if (Array.isArray(data.models) && data.models.length > 0) {
      nextResult = [...nextResult, ...data.models];
    }

    const addCount = (data.add_num ?? []).reduce((sum, count) => sum + (Number(count) || 0), 0);
    const targetAppStateYear = previousYear + addYear;
    if (addCount > 0) {
      const remainingModels = models.filter((model) => !deleteSet.has(resolveBuildingId(model) ?? -1));
      const updatedModels = await generateBuildingsByCategory(
        viewer,
        remainingModels,
        data.add_num ?? [],
        {
          idSources: currentParams,
          targetAppStateYear,
        },
      );
      const existingIds = new Set(nextResult.map((model) => model.id));
      updatedModels
        .filter((entity) => {
          const entityId = resolveBuildingId(entity);
          return entityId != null && !existingIds.has(entityId);
        })
        .forEach((entity) => nextResult.push(toPayload(entity)));
    }

    setYear(previousYear + addYear);
    setResult(nextResult, 0);
    await renew3DModels(viewer, nextResult);
    refreshRangeVisibility(viewer);
    console.log(appState);
    return true;
  } catch (error) {
    console.error('new_prediction error:', error);
    return false;
  }
};
