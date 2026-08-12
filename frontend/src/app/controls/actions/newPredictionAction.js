import { appState } from '../../state/appState.js';
import { buildComputePayload } from '../../region/regionState.js';

export const newPrediction = async (viewer, models = [], addYear = 5) => {
  // if (appState.disasterState !== '被災前') {
  //   setDisasterState('被災前');
  // }

  // if (appState.result[appState.appliedPolicy][appState.year + addYear]) {
  //   setYear(appState.year + addYear);
  //   renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year + addYear][appState.disasterState]);
  //   refreshRangeVisibility(viewer);
  //   return true;
  // }

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
    return true;

    // setYear(appState.year + addYear);
    // setResult(data.result, data.total_victims ?? 0);

    // for (let i = 0; i < data.deletes.length; i++) {
    //   const deleteModel = models.find((model) => model.id === data.deletes[i]);
    //   viewer.entities.remove(deleteModel);
    // }

    // addNewBuildings(viewer, models, data.add_num);

    // const nextModels = Array.isArray(data.models)
    //   ? data.models
    //   : appState.result?.[appState.appliedPolicy]?.[appState.year]?.[appState.disasterState];
    // await renew3DModels(viewer, nextModels);
    // refreshRangeVisibility(viewer);
    // console.log(appState);
  } catch (error) {
    console.error('new_prediction error:', error);
    return false;
  }
};
