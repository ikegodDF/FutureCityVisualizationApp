import { resolveBuildingId, toModelName } from './buildingId.js';

function resolveShow(source) {
  if (typeof source?.show === 'boolean') {
    return source.show;
  }
  return true;
}

export function buildBuildingDetail(source, detail = {}) {
  return {
    buildingUsage: detail.buildingUsage ?? source?.buildingUsage ?? null,
    buildingStructureType: detail.buildingStructureType ?? source?.buildingStructureType ?? null,
    buildingArea: detail.buildingArea ?? source?.buildingArea ?? null,
    buildingHeight: detail.buildingHeight ?? source?.buildingHeight ?? null,
    storeysAboveGround: detail.storeysAboveGround ?? source?.storeysAboveGround ?? null,
    architecturalPeriod: detail.architecturalPeriod ?? source?.architecturalPeriod ?? null,
    buildingPopulation: detail.buildingPopulation ?? source?.buildingPopulation ?? null,
  };
}

export const toPayload = (source) => {
  const id = resolveBuildingId(source);
  const [lat, lon] = source?.latlon ?? [];
  const detail = source?.buildingDetail ?? source?.BuildingDetail ?? {};

  const payload = {
    id,
    name: source?.name ?? (id != null ? toModelName(id) : String(source?.id ?? '')),
    latitude: lat ?? source?.latitude ?? null,
    longitude: lon ?? source?.longitude ?? null,
    year: source?.year ?? null,
    show: resolveShow(source),
    buildingDetail: buildBuildingDetail(source, detail),
  };

  if (typeof source?.isDamage === 'boolean') {
    payload.isDamage = source.isDamage;
  }

  return payload;
};
