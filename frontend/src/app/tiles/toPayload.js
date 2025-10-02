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
    };
};


