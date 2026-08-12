import { toModelName } from './buildingId.js';
import { DEFAULT_NEW_BUILDING_DETAIL } from './defaultAttributes.js';

/**
 * 新築建物 1 棟分の属性（entity / API payload 共通）を生成する。
 */
export function createNewBuildingRecord({
  id,
  lat,
  lon,
  year,
  buildingArea,
  buildingHeight,
  storeysAboveGround,
  buildingPopulation,
  show = true,
  isDamage = false,
  detailOverrides = {},
}) {
  const buildingDetail = {
    ...DEFAULT_NEW_BUILDING_DETAIL,
    buildingArea,
    buildingHeight,
    storeysAboveGround,
    buildingPopulation,
    ...detailOverrides,
  };

  return {
    id,
    name: toModelName(id),
    year,
    latitude: lat,
    longitude: lon,
    latlon: [lat, lon],
    show,
    isDamage,
    isEstimatedYear: true,
    isNewBuilding: true,
    buildingUsage: buildingDetail.buildingUsage,
    buildingStructureType: buildingDetail.buildingStructureType,
    architecturalPeriod: buildingDetail.architecturalPeriod,
    buildingArea,
    buildingHeight,
    storeysAboveGround,
    buildingPopulation,
    buildingDetail,
  };
}
