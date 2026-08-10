import { appState, setDisasterState, setYear, setResult } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';
import { refreshRangeVisibility } from './rangeSelectActions.js';
import { buildComputePayload } from '../../region/regionState.js';

export const prediction = async (viewer, models = [], addYear = 5) => {
  if (appState.disasterState !== '被災前') {
    setDisasterState('被災前');
  }

  if (appState.result[appState.appliedPolicy][appState.year + addYear]) {
    setYear(appState.year + addYear);
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year + addYear][appState.disasterState]);
    refreshRangeVisibility(viewer);
    return true;
  }

  const payload = buildComputePayload({
    method: 'building_retention_rate',
    appStateYear: appState.year + addYear,
    disasterState: appState.disasterState,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    selectedRanges: appState.selectedRanges[appState.year]
  });
  
  console.log(payload);

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/calculate/new_prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('calculate response:', data);
    setYear(appState.year + addYear);
    setResult(data.result, data.total_victims ?? 0);

    for (let i = 0; i < data.deletes.length; i++){
        const deleteModel = models.find(model => model.id === data.deletes[i]);
        viewer.entities.remove(deleteModel);
    }

    addNewBuildings(viewer, models, data.add_num);

    const nextModels = Array.isArray(data.models)
      ? data.models
      : appState.result?.[appState.appliedPolicy]?.[appState.year]?.[appState.disasterState];
    await renew3DModels(viewer, nextModels);
    refreshRangeVisibility(viewer);
    console.log(appState);
    return true;
  } catch (error) {
    console.error('calculate error:', error);
    return false;
  }
};