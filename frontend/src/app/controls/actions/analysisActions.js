import { appState } from '../../state/appState.js';
import { analysisExportJSON } from '../../utils/analysisExport.js';
import { buildComputePayload } from '../../region/regionState.js';

export const analysis = async (viewer, models = []) => {
  // 💡 prediction関数と同じプロパティ（disasterState, selectedRanges）を追加
  const payload = buildComputePayload({
    method: 'building_retention_rate',
    appStateYear: appState.year, // analysisは現在の年を起点にするため +5 は不要と推測
    disasterState: appState.disasterState,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    selectedRanges: appState.selectedRanges[appState.year] 
  });

  console.log('analysis payload:', payload);

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/analysis/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 💡 422エラーの詳細な理由をコンソールに出力する処理を追加（デバッグ用）
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API Error (${res.status}):`, errorText);
      return [];
    }

    const data = await res.json();
    analysisExportJSON('analysis_result.json', data.result);
    console.log('analysis response:', data);
    return data.result;
  } catch (error) {
    console.error('analysis error:', error);
    return [];
  }
};