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
