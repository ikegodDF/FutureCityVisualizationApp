import { flyToRegion } from '../../utils/camera.js';
import { generateBuildings } from '../../construction/generateBuildings.js';
import {
  getConstructionSettings,
  setConstructionZoneSource,
} from '../../construction/constructionState.js';
import { appState, setResult } from '../../state/appState.js';
import { toPayload } from '../../domain/buildings/toPayload.js';

/**
 * 設定済みゾーン内に新築建物を生成し appState を更新する。
 */
export async function runConstructionPreview(viewer, models = []) {
  flyToRegion(viewer);
  const currentParams = appState.result?.[appState.appliedPolicy]?.[appState.year]?.[appState.disasterState] ?? [];
  const updatedModels = await generateBuildings(viewer, models, {
    idSources: currentParams,
  });
  setResult(updatedModels.map(toPayload));
  return updatedModels;
}

/**
 * 建物生成ゾーンの参照元を切り替える。
 * @param {'config'|'rangeSelect'|'roadBlocks'|'custom'} source
 */
export function setBuildingGenerationZoneSource(source) {
  setConstructionZoneSource(source);
}

export function getBuildingGenerationSettings() {
  return getConstructionSettings();
}
