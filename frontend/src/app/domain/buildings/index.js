export {
  createBuildingIdAllocator,
  getMaxBuildingId,
  resolveBuildingId,
  toModelName,
} from './buildingId.js';

export {
  DEFAULT_ARCHITECTURAL_PERIOD,
  DEFAULT_BUILDING_STRUCTURE_TYPE,
  DEFAULT_BUILDING_USAGE,
  DEFAULT_NEW_BUILDING_DETAIL,
} from './defaultAttributes.js';

export { createNewBuildingRecord } from './createNewBuildingRecord.js';
export { buildBuildingDetail, toPayload } from './toPayload.js';
export {
  CATEGORY_COUNT,
  CATEGORY_LABELS,
  OVER46_CATEGORY_INDEX,
  buildingAgeFromYear,
  calendarAgeFromYear,
  categoryAgeRange,
  resolveCategoryIndex,
  resolveConstructionYear,
  yearFromBuildingAge,
  yearFromCalendarAge,
  yearFromCategoryIndex,
  yearFromCategoryIndexAtTarget,
} from './buildingAge.js';

export {
  createBuildingSizeSampler,
  extractBuildingSizeSamples,
  summarizeAreaDistribution,
  fitLogNormalDistribution,
  fitBuildingSizeDistributions,
  sampleLogNormalDistribution,
  STOREY_HEIGHT_M,
} from './buildingSizeDistribution.js';
