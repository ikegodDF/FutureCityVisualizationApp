import { appState } from './appState.js';

/**
 * @typedef {Object} BaselineSceneRef
 * @property {number} year
 * @property {string} appliedPolicy
 * @property {string} disasterState
 */

export function clonePayloads(payloads = []) {
  return structuredClone(payloads);
}

/**
 * ロード完了時の appState.result 位置を記録する（ペイロード本体は result に保持）。
 */
export function setBaselineSceneRef() {
  appState.baselineScene = {
    year: appState.year,
    appliedPolicy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  };

  const count = getBaselinePayloads()?.length ?? 0;
  console.log(
    `基準シーンを記録: result[${appState.appliedPolicy}][${appState.year}][${appState.disasterState}]（${count} 棟）`,
  );

  return appState.baselineScene;
}

/** @returns {BaselineSceneRef|null} */
export function getBaselineSceneRef() {
  return appState.baselineScene ?? null;
}

/** @returns {import('../domain/buildings/toPayload.js').ModelPayload[]|null} */
export function getBaselinePayloads() {
  const ref = getBaselineSceneRef();
  if (!ref) {
    return null;
  }

  const payloads = appState.result?.[ref.appliedPolicy]?.[ref.year]?.[ref.disasterState];
  return Array.isArray(payloads) ? payloads : null;
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
  return true;
}
