import { renew3DModels } from '../tiles/renew3DModels.js';
import { toPayload } from '../domain/buildings/toPayload.js';

export const appState = {
  year: new Date().getFullYear(),
  appliedPolicy: '施策なし',
  disasterState:"被災前",
  region: null,
  result: {},
  road: {},
  /** @type {import('./blockRegions.js').BlockRegion[]} */
  blockRegions: [],
  totalVictims: {},
  selectedRanges: {},
  distribution: null,
  /** @type {import('../controls/components/shared/scales/distributionConfig.js').DistributionMode|null} */
  distributionLegendMode: null,
  population: null,
  /** @type {import('./baselineScene.js').BaselineSceneRef|null} */
  baselineScene: null,
  /** @type {import('./shelters.js').ShelterState} */
  shelter: {
    ids: [],
    buildings: [],
    regionMappings: [],
    byRegion: {},
    colorByShelterId: {},
  },
};

export const setYear = (year) => {
  appState.year = year;
}

export const setAppliedPolicy = (appliedPolicy) => {
  appState.appliedPolicy = appliedPolicy;
}

export const setDisasterState = (disasterState) => {
  appState.disasterState = disasterState;
}

export const setRegion = (region) => {
  appState.region = region;
}

export const setResult = (result, totalVictims = 0) => {
  const policyKey = String(appState.appliedPolicy);
  const yearKey = appState.year;
  if (!appState.result[policyKey]) appState.result[policyKey] = {};
  if (!appState.result[policyKey][yearKey]) appState.result[policyKey][yearKey] = {};
  appState.result[policyKey][yearKey][appState.disasterState] = result;
  
  if (!appState.totalVictims[policyKey]) appState.totalVictims[policyKey] = {};
  if (!appState.totalVictims[policyKey][yearKey]) appState.totalVictims[policyKey][yearKey] = {};
  appState.totalVictims[policyKey][yearKey][appState.disasterState] = totalVictims;
}

export const setDistribution = (distribution) => {
  appState.distribution = distribution;
}

export const setPopulation = (population) => {
  appState.population = population;
}

export const resetResult = (viewer) => {
  Object.keys(appState.result).forEach(policyKey => {
    Object.keys(appState.result[policyKey]).forEach(yearKey => {
      if (yearKey > appState.year) {
        delete appState.result[policyKey][yearKey];
      }
    });
  });
  renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
  console.log(appState);
}

export const allResetResult = async (viewer, models = []) => {
  const { getBaselineSceneRef } = await import('./baselineScene.js');
  if (getBaselineSceneRef()) {
    const { restoreInitialScene } = await import('../controls/actions/restoreInitialSceneAction.js');
    return restoreInitialScene(viewer, models);
  }

  const initialYear = new Date().getFullYear();
  const initialPolicy = '施策なし';
  const initialDisasterState = '被災前';
  
  // 2025年・施策なし・被災前のデータ以外を削除
  const newResult = {};
  let initialData = null;
  
  if (appState.result[initialPolicy] && 
      appState.result[initialPolicy][initialYear] && 
      appState.result[initialPolicy][initialYear][initialDisasterState]) {
    // 保存されている初期データを使用
    newResult[initialPolicy] = {};
    newResult[initialPolicy][initialYear] = {};
    newResult[initialPolicy][initialYear][initialDisasterState] = 
      appState.result[initialPolicy][initialYear][initialDisasterState];
    initialData = newResult[initialPolicy][initialYear][initialDisasterState];
  } else {
    // 初期データが存在しない場合、エンティティから再構築
    const entities = Array.from(viewer.entities.values);
    initialData = entities.map(toPayload);
    newResult[initialPolicy] = {};
    newResult[initialPolicy][initialYear] = {};
    newResult[initialPolicy][initialYear][initialDisasterState] = initialData;
  }
  
  appState.result = newResult;
  appState.year = initialYear;
  appState.appliedPolicy = initialPolicy;
  appState.disasterState = initialDisasterState;
  
  // 初期状態のデータでモデルを更新
  if (initialData) {
    renew3DModels(viewer, initialData);
  }
  
  console.log('全リセット完了:', appState);
}

export const resetSelectedRanges = () => {
  appState.selectedRanges = {};
};

export const appendSelectedRange = ({ polygon, models, order, period }) => {
  const startYear = Number(period?.start ?? appState.year);
  const endYear = Number(period?.end ?? startYear);
  const [fromYear, toYear] = startYear <= endYear ? [startYear, endYear] : [endYear, startYear];
  const stepYears = 5;

  for (let year = fromYear; year <= toYear; year += stepYears) {
    const yearKey = String(year);
    if (!appState.selectedRanges[yearKey]) appState.selectedRanges[yearKey] = [];
    appState.selectedRanges[yearKey].push({ polygon, models, order, period });
  }
};

export const getSelectedRangesForYear = (year = appState.year) => {
  const yearKey = String(year);
  return appState.selectedRanges[yearKey] ?? [];
};

export const hasAnySelectedRanges = () => (
  Object.values(appState.selectedRanges).some((ranges) => Array.isArray(ranges) && ranges.length > 0)
);

export const getCommittedRangePolygon = (year = appState.year) => (
  getSelectedRangesForYear(year).map((range) => range.polygon)
);

export const getCommittedRangeSelection = (year = appState.year) => {
  const selectionSet = new Set();
  getSelectedRangesForYear(year).forEach((range) => {
    (range.models ?? []).forEach((modelId) => {
      const id = normalizeSelectedModelId(modelId);
      if (id != null) selectionSet.add(id);
    });
  });
  return Array.from(selectionSet);
};

const normalizeSelectedModelId = (modelId) => {
  if (typeof modelId === 'number' && Number.isFinite(modelId)) {
    return modelId;
  }
  const parsed = Number(String(modelId ?? '').replace(/^model_/, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

/** 範囲選択から削除された建物 ID を除去する（全年の selectedRanges を走査） */
export const removeModelsFromSelectedRanges = (deleteIds = []) => {
  const deleteSet = new Set(
    deleteIds
      .map((id) => normalizeSelectedModelId(id))
      .filter((id) => id != null),
  );
  if (deleteSet.size === 0) return;

  Object.keys(appState.selectedRanges).forEach((yearKey) => {
    const ranges = appState.selectedRanges[yearKey];
    if (!Array.isArray(ranges)) return;

    appState.selectedRanges[yearKey] = ranges
      .map((range) => ({
        ...range,
        models: (range.models ?? []).filter((modelId) => {
          const id = normalizeSelectedModelId(modelId);
          return id != null && !deleteSet.has(id);
        }),
      }))
      .filter((range) => Array.isArray(range.models) && range.models.length > 0);
  });
};

export const setRoad = (road) => {
  appState.road = road
}

/** @param {import('./blockRegions.js').BlockRegion[]} regions */
export const setBlockRegions = (regions) => {
  appState.blockRegions = Array.isArray(regions) ? regions.map((region) => ({ ...region })) : [];
}

export const getBlockRegions = () => appState.blockRegions;

export const getBlockRegionById = (id) => (
  appState.blockRegions.find((region) => region.id === id) ?? null
);

/** @param {string} id @param {Partial<import('./blockRegions.js').BlockRegion>} patch */
export const updateBlockRegion = (id, patch = {}) => {
  const index = appState.blockRegions.findIndex((region) => region.id === id);
  if (index === -1) {
    return null;
  }

  appState.blockRegions[index] = {
    ...appState.blockRegions[index],
    ...patch,
  };
  return appState.blockRegions[index];
}

export const clearBlockRegions = () => {
  appState.blockRegions = [];
}

