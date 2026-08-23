import { appState } from '../state/appState.js';
import { addNewBuildings } from '../tiles/addRandomConstruction.js';
import { createBuildingIdAllocator } from '../domain/buildings/buildingId.js';
import {
  getDefaultBuildingCount,
  resolveConstructionZones,
} from './constructionState.js';
import {
  buildZonesFromSelectedRangesByOrder,
  getConstructionDefaults,
} from './constructionZoneUtils.js';
import { getActiveRegionId } from '../region/regionState.js';

/** order=2（範囲内新築化）の範囲に集中させる新築比率 */
export const ORDER_2_NEW_BUILDING_RATIO = 0.8;

function splitBuildingCount(total, ratio) {
  if (total <= 0) {
    return { focused: 0, rest: 0 };
  }

  const focused = Math.min(total, Math.max(0, Math.round(total * ratio)));
  return { focused, rest: total - focused };
}

async function addNewBuildingsForCategory(
  viewer,
  currentModels,
  count,
  zones,
  buildingOptions,
  categoryIndex,
) {
  if (count <= 0 || !zones.length) {
    return currentModels;
  }

  return addNewBuildings(viewer, currentModels, count, zones, {
    ...buildingOptions,
    categoryIndex,
  });
}

/**
 * 建物生成ゾーンを解決し、新築建物を配置する統合エントリ。
 *
 * @param {import('cesium').Viewer} viewer
 * @param {Array} currentModels
 * @param {{ count?: number, zones?: Array, updateResult?: boolean }} [options]
 */
export async function generateBuildings(viewer, currentModels = [], options = {}) {
  const regionId = getActiveRegionId();
  const zones = options.zones ?? resolveConstructionZones(appState, regionId);
  if (!zones.length) {
    throw new Error('建物生成ゾーンが未設定です。config または範囲選択でゾーンを指定してください。');
  }

  const count = options.count ?? getDefaultBuildingCount(regionId);
  const buildingOptions = {
    ...getConstructionDefaults(),
    ...options.buildingOptions,
    categoryIndex: options.categoryIndex ?? 0,
    targetAppStateYear: options.targetAppStateYear ?? appState.year,
    idSources: [
      ...currentModels,
      ...(options.idSources ?? []),
    ],
    idAllocator: createBuildingIdAllocator([
      ...currentModels,
      ...(options.idSources ?? []),
    ]),
  };

  return addNewBuildings(viewer, currentModels, count, zones, buildingOptions);
}

/**
 * 区分別新築数（add_num 配列）に応じて建物を追加する。
 */
export async function generateBuildingsByCategory(viewer, currentModels = [], addNum = [], options = {}) {
  const regionId = getActiveRegionId();
  const defaultZones = options.zones ?? resolveConstructionZones(appState, regionId);
  if (!defaultZones.length) {
    console.warn('建物生成ゾーンが未設定のため新築をスキップしました');
    return currentModels;
  }

  const sourceYear = options.sourceYear ?? appState.year;
  const order2Zones = buildZonesFromSelectedRangesByOrder(
    appState.selectedRanges?.[sourceYear] ?? [],
    2,
    sourceYear,
    sourceYear,
  );

  const buildingOptions = {
    ...getConstructionDefaults(),
    ...options.buildingOptions,
    targetAppStateYear: options.targetAppStateYear ?? appState.year,
    idSources: [
      ...currentModels,
      ...(options.idSources ?? []),
    ],
    idAllocator: createBuildingIdAllocator([
      ...currentModels,
      ...(options.idSources ?? []),
    ]),
  };

  let updatedModels = currentModels;
  for (let categoryIndex = 0; categoryIndex < addNum.length; categoryIndex += 1) {
    const categoryCount = Number(addNum[categoryIndex]) || 0;
    if (categoryCount <= 0) {
      continue;
    }

    const { focused, rest } = order2Zones.length > 0
      ? splitBuildingCount(categoryCount, ORDER_2_NEW_BUILDING_RATIO)
      : { focused: 0, rest: categoryCount };

    updatedModels = await addNewBuildingsForCategory(
      viewer,
      updatedModels,
      focused,
      order2Zones,
      buildingOptions,
      categoryIndex,
    );
    updatedModels = await addNewBuildingsForCategory(
      viewer,
      updatedModels,
      rest,
      defaultZones,
      buildingOptions,
      categoryIndex,
    );
  }

  return updatedModels;
}
