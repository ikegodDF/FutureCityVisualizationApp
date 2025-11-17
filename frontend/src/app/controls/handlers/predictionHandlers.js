import { appState, setYear, setResult } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

export const prediction = async (viewer, models = []) => {
  if (appState.result[appState.appliedPolicy][appState.year + 5]) {
    setYear(appState.year + 5);
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year + 5][appState.disasterState]);
    return;
  }

  const payload = {
    method: 'building_retention_rate',
    appStateYear: appState.year + 5,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
  };

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/calculate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('calculate response:', data);
    setYear(appState.year + 5);
    setResult(data.result);
    await renew3DModels(viewer, data.result);
    console.log(appState);
    return;
  } catch (error) {
    console.error('calculate error:', error);
    return;
  }
};

export const restore = async (viewer) => {
  setYear(appState.year - 5);
  renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
  return;
};

