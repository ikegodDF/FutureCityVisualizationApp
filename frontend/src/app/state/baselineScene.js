import { appState } from './appState.js';
import { clearDistributionLegend } from '../controls/components/shared/scales/distributionLegend.js';
import { setShelters } from './shelters.js';

/**
 * @typedef {Object} BaselineSceneRef
 * @property {number} year
 * @property {string} appliedPolicy
 * @property {string} disasterState
 */

export function clonePayloads(payloads = []) {
  return structuredClone(payloads);
}

/** @type {import('../domain/buildings/toPayload.js').ModelPayload[]|null} */
let baselinePayloadsSnapshot = null;

/**
 * ロード完了時の appState.result 位置を記録する（ペイロードはスナップショットとして固定）。
 */
export function setBaselineSceneRef() {
  const { year, appliedPolicy, disasterState } = appState;
  const payloads = appState.result?.[appliedPolicy]?.[year]?.[disasterState];
  baselinePayloadsSnapshot = Array.isArray(payloads) ? clonePayloads(payloads) : null;

  appState.baselineScene = {
    year,
    appliedPolicy,
    disasterState,
  };

  const count = baselinePayloadsSnapshot?.length ?? 0;
  console.log(
    `基準シーンを記録: result[${appliedPolicy}][${year}][${disasterState}]（${count} 棟）`,
  );

  return appState.baselineScene;
}

/** @returns {BaselineSceneRef|null} */
export function getBaselineSceneRef() {
  return appState.baselineScene ?? null;
}

/** @returns {import('../domain/buildings/toPayload.js').ModelPayload[]|null} */
export function getBaselinePayloads() {
  if (!baselinePayloadsSnapshot?.length) {
    return null;
  }
  return clonePayloads(baselinePayloadsSnapshot);
}

/**
 * 基準年の result を起点に appState を初期化する（Entity 復元は別処理）。
 * @returns {boolean}
 */
export function resetAppStateToBaseline() {
  const ref = getBaselineSceneRef();
  const source = getBaselinePayloads();
  if (!ref || !source?.length) {
    return false;
  }

  const payloads = clonePayloads(source);
  const { appliedPolicy, disasterState, year } = ref;

  appState.year = year;
  appState.appliedPolicy = appliedPolicy;
  appState.disasterState = disasterState;
  appState.result = {
    [appliedPolicy]: {
      [year]: {
        [disasterState]: payloads,
      },
    },
  };
  appState.totalVictims = {
    [appliedPolicy]: {
      [year]: {
        [disasterState]: 0,
      },
    },
  };
  appState.selectedRanges = {};
  appState.distribution = null;
  setShelters(payloads);
  clearDistributionLegend();
  return true;
}
