import { appState } from '../../state/appState.js';
import { analysisExportJSON } from '../../utils/analysisExport.js';

export const analysis = async (viewer, models = []) => {
  const payload = {
    method: 'building_retention_rate',
    appStateYear: appState.year,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
  };

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/analysis/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    analysisExportJSON('analysis_result.json', data.result);
    console.log('analysis response:', data);
    return data.result;
  } catch (error) {
    console.error('analysis error:', error);
    return [];
  }
};

