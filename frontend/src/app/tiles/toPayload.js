export const toPayload = (e) => {
    const id = Number(String(e?.name ?? '').replace('model_', ''));
    const [lat, lon] = e?.latlon ?? [];
    return {
        id,
        name: e?.name ?? String(id),
        latitude: lat,
        longitude: lon,
        year: e?.year ?? null,
        show: e?.show === true,
        buildingUsage: e?.buildingUsage ?? null,
        buildingStructureType: e?.buildingStructureType ?? null,
        buildingArea: e?.buildingArea ?? null,
        buildingHeight: e?.buildingHeight ?? null,
        storeysAboveGround: e?.storeysAboveGround ?? null,
    };
};


