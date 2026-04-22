import { appState, setDisasterState, setResult } from '../../state/appState.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

const runDamageAssessment = async (viewer, disasterState, { expectedAfterState, method, apiPath }) => {
  if (appState.disasterState !== '被災前') {
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year]['被災前']);

    if (appState.disasterState === expectedAfterState) {
      setDisasterState('被災前');
      return;
    }
    setDisasterState('被災前');
  }

  const payload = {
    method,
    appStateYear: appState.year,
    disasterState,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
  };

  setDisasterState(disasterState);
  if (appState.result[appState.appliedPolicy][appState.year][appState.disasterState]) {
    console.log(appState);
    renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
    return;
  }

  try {
    console.log(payload);
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}${apiPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(appState);
    setResult(data.result);
    renew3DModels(viewer, data.result);
  } catch (error) {
    console.error('damage assessment error:', error);
    return [];
  }
};

export const earthquakeDamageAssessment = async (viewer, models = [], disasterState) => runDamageAssessment(viewer, disasterState, {
  expectedAfterState: '地震発生後',
  method: 'earthquake_damage_assessment',
  apiPath: '/api/v1/damage_prediction/earthquake',
});

export const tsunamiDamageAssessment = async (viewer, models = [], disasterState) => runDamageAssessment(viewer, disasterState, {
  expectedAfterState: '津波発生後',
  method: 'thunami_damage_assessment',
  apiPath: '/api/v1/damage_prediction/thunami',
});
