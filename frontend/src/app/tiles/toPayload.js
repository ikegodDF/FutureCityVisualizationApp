import { resolveBuildingId, toModelName } from './buildingId.js';

export const toPayload = (e) => {
    const id = resolveBuildingId(e);
    const [lat, lon] = e?.latlon ?? [];

    // 元データ内の buildingDetail を参照する（なければ直下も探す）
    const detail = e?.buildingDetail ?? e?.BuildingDetail ?? {};

    return {
        id,
        name: e?.name ?? (id != null ? toModelName(id) : String(e?.id ?? '')),
        latitude: lat ?? e?.latitude ?? null,
        longitude: lon ?? e?.longitude ?? null,
        year: e?.year ?? null,
        show: e?.show === true,
        buildingDetail: {
        buildingUsage: detail.buildingUsage ?? e?.buildingUsage ?? null,
        buildingStructureType: detail.buildingStructureType ?? e?.buildingStructureType ?? null,
        buildingArea: detail.buildingArea ?? e?.buildingArea ?? null,
        buildingHeight: detail.buildingHeight ?? e?.buildingHeight ?? null,
        storeysAboveGround: detail.storeysAboveGround ?? e?.storeysAboveGround ?? null,
        architecturalPeriod: detail.architecturalPeriod ?? e?.architecturalPeriod ?? null,
        },
    };
};
