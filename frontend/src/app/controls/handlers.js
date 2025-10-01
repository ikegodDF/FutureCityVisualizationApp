// クリックなどのイベントハンドラ群を配置

export const prediction = async (viewer, models = []) => {
    const toPayload = (e) => {
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

    const payload = {
        method: 'building_retention_rate',
        params: models.map(toPayload),
    };

    try {
        const res = await fetch('http://localhost:8000/api/v1/calculate/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log('calculate response:', data);
    } catch (error) {
        console.error('calculate error:', error);
    }
}

export const result = (viewer, models, outputContainer) => {
    const resultYear = new Date().getFullYear();
    const visibleEntityCount = viewer.entities.values.slice().reverse().filter(entity => models.includes(entity) && entity.show === true).length
    outputContainer.innerHTML = `施策:今は空　　年度:${resultYear} 　　建物数:${visibleEntityCount}`;
}
