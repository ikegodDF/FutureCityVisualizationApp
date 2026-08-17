import { appState, setDisasterState } from '../../state/appState.js';
import { analysisExportJSON } from '../../utils/analysisExport.js';
import { exportResult } from '../../utils/export.js';
import { buildComputePayload } from '../../region/regionState.js';
import { newPrediction } from './newPredictionAction.js';
import { restoreInitialScene } from './restoreInitialSceneAction.js';
import { earthquakeDamageAssessment, tsunamiDamageAssessment } from './damageAssessmentActions.js';
import { takeHighResScreenshot } from '../../utils/screenshot.js';
import { waitForDomPaint, waitForViewerRender } from '../../utils/waitForViewerRender.js';

export const ANALYSIS_TRIALS_PER_CASE = 30;

export const ANALYSIS_PERCENTILE_CASES = [
  { label: '上位10%', percentage: 90 },
  { label: '平均', percentage: 50 },
  { label: '下位10%', percentage: 10 },
];

const EARTHQUAKE_DISASTER_STATE = '地震発生後';
const TSUNAMI_DISASTER_STATE = '津波発生後';

function recordDamageMetrics(disasterState) {
  const { appliedPolicy, year } = appState;
  const policyKey = String(appliedPolicy);
  const payloads = appState.result?.[policyKey]?.[year]?.[disasterState];
  const totalCollapseBuildings = Array.isArray(payloads)
    ? payloads.filter((model) => model?.isDamage === true).length
    : 0;
  const totalVictims = appState.totalVictims?.[policyKey]?.[year]?.[disasterState] ?? 0;

  return { totalCollapseBuildings, totalVictims };
}

const ANALYSIS_REFRESH_OPTIONS = { forceRefresh: true };

async function prepareAnalysisTrial(viewer, models) {
  const restored = await restoreInitialScene(viewer, models);
  if (!restored) {
    console.error('分析試行の開始に失敗しました: 基準シーンを復元できません');
    return false;
  }

  setDisasterState('被災前');
  return true;
}

/** 地震・津波それぞれの全壊建物数と被災者数を返す */
export function recordEarthquakeAndTsunamiDamageMetrics() {
  return {
    earthquake: recordDamageMetrics(EARTHQUAKE_DISASTER_STATE),
    tsunami: recordDamageMetrics(TSUNAMI_DISASTER_STATE),
  };
}

export function buildAnalysisTargetYears(baseYear, { maxYears, stepYears }) {
  const years = [];
  const endYear = baseYear + maxYears;
  for (let year = baseYear + stepYears; year <= endYear; year += stepYears) {
    years.push(year);
  }
  return years;
}

export function buildAnalysisCaseExportFilename(targetYear, caseLabel) {
  return `analysis_${targetYear}_${caseLabel}_damage_records.json`;
}

/** 被害記録配列を JSON でダウンロードする */
export function exportDamageAssessmentRecords(
  records,
  filename = 'analysis_damage_records.json',
) {
  exportResult(filename, records);
}

async function runSingleAnalysisTrial({
  viewer,
  models,
  addYear,
  percentage,
  targetYear,
  caseLabel,
  trialIndex,
  onSyncUi,
}) {
  if (!await prepareAnalysisTrial(viewer, models)) {
    return null;
  }

  onSyncUi?.();

  const ok = await newPrediction(viewer, models, addYear, percentage, ANALYSIS_REFRESH_OPTIONS);
  if (!ok) {
    return null;
  }

  onSyncUi?.();
  await waitForViewerRender(viewer);
  await waitForDomPaint();

  const filePrefix = `${targetYear}${caseLabel}_case${trialIndex + 1}`;

  await takeHighResScreenshot(viewer, filePrefix, undefined, { onBeforeCapture: onSyncUi });

  await earthquakeDamageAssessment(viewer, models, '地震発生後', ANALYSIS_REFRESH_OPTIONS);
  onSyncUi?.();
  await waitForViewerRender(viewer);
  await waitForDomPaint();
  await takeHighResScreenshot(viewer, `${filePrefix}地震後`, undefined, { onBeforeCapture: onSyncUi });

  await tsunamiDamageAssessment(viewer, models, '津波発生後', ANALYSIS_REFRESH_OPTIONS);
  onSyncUi?.();
  await waitForViewerRender(viewer);
  await waitForDomPaint();
  await takeHighResScreenshot(viewer, `${filePrefix}津波後`, undefined, { onBeforeCapture: onSyncUi });

  const metrics = recordEarthquakeAndTsunamiDamageMetrics();

  if (!await prepareAnalysisTrial(viewer, models)) {
    console.warn('分析試行後の基準シーン復元に失敗しました');
  }
  onSyncUi?.();

  return metrics;
}

/**
 * タイムライン範囲（baseYear+step 〜 baseYear+maxYears）× 上位10%/平均/下位10% × 試行数の分析バッチ。
 * ケース（年×パーセンタイル）ごとに JSON を出力する。
 */
export async function runAnalysisBatch({
  viewer,
  models,
  baseYear,
  maxYears,
  stepYears,
  onSyncUi,
}) {
  const targetYears = [2046, 2051];

  for (const targetYear of targetYears) {
    const addYear = targetYear - baseYear;

    for (const { label, percentage } of ANALYSIS_PERCENTILE_CASES) {
      const damageRecords = [];

      for (let trial = 0; trial < ANALYSIS_TRIALS_PER_CASE; trial++) {
        const metrics = await runSingleAnalysisTrial({
          viewer,
          models,
          addYear,
          percentage,
          targetYear,
          caseLabel: label,
          trialIndex: trial,
          onSyncUi,
        });

        if (!metrics) {
          break;
        }

        damageRecords.push(metrics);
      }

      if (damageRecords.length > 0) {
        exportDamageAssessmentRecords(
          damageRecords,
          buildAnalysisCaseExportFilename(targetYear, label),
        );
      }
    }
  }
}

export const analysis = async (viewer, models = []) => {
  const payload = buildComputePayload({
    method: 'building_retention_rate',
    appStateYear: appState.year,
    disasterState: appState.disasterState,
    params: appState.result[appState.appliedPolicy][appState.year][appState.disasterState],
    selectedRanges: appState.selectedRanges[appState.year],
  });

  console.log('analysis payload:', payload);

  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${apiBaseUrl}/api/v1/analysis/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

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
