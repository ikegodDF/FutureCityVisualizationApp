import { Color, Cartesian3, Transforms, HeadingPitchRoll, Math as CesiumMath } from 'cesium';

export async function add3DModels(viewer, options = {}) {
    const { outputDiv } = options;
    const modelNumber = 2356;

    const models = [];

    const correctNumbers = [
        48, 77,
        132,
        395,
        430, 472,
        501, 585, 599,
        657,
        721, 722, 723, 724, 725, 774,
        840, 841, 846, 852, 855, 856, 876, 878, 886, 889, 896, 899,
        900, 902, 903, 928, 961, 983,
        1003, 1005, 1007, 1013, 1014, 1015, 1016, 1023, 1024, 1025, 1026, 1027, 1030, 1046, 1049, 1056, 1057,
        1110, 1121, 1122, 1138, 1155, 1172, 1181,
        1229, 1248, 1249, 1289,
        1315, 1321, 1322, 1373, 1387,
        1412, 1430, 1434, 1435, 1466, 1496, 1497,
        1502, 1503, 1540, 1560,
        1605, 1613, 1633, 1634, 1644, 1645, 1646, 1647, 1650, 1653, 1654, 1681, 1689, 1696, 1697, 1699,
        1700, 1701, 1723, 1725,
        1878, 1879,
        1907, 1915, 1916, 1927, 1937, 1980,
        2020,
        2138,
        2254, 2255
    ];

    const getModelColor = (year) => {
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;

        // 色のマッピング
        if (age < 6) {
            return Color.fromCssColorString("#8BC34A"); // ~5  黄緑
        } else if (age < 16) {
            return Color.fromCssColorString("#A5D6A7"); // 6~15  緑
        } else if (age < 26) {
            return Color.fromCssColorString("#FFEB3B"); // 16~25  黄色
        } else if (age < 36) {
            return Color.fromCssColorString("#FF9800"); // 26~35  オレンジ
        } else if (age < 46) {
            return Color.fromCssColorString("#F44336"); // 36~45  赤
        } else if (age < 2000){
            return Color.fromCssColorString("#B71C1C"); // 46~55  濃い赤
        } else {
            return Color.fromCssColorString("#1976D2"); // 年度データなし  青
        }
    }

    const setModelColor = (model, color) => {
        model.model.color = color;
    }

    // バッチ並列実行
    const batchSize = 500;
    for (let start = 1; start <= modelNumber; start += batchSize) {
        const end = Math.min(start + batchSize - 1, modelNumber);
        const tasks = [];
        for (let i = start; i <= end; i++) {
            const task = (async () => {
                const base = `/models/施策適応前/OID_${i}/`;
                const jsonPath = `${base}esriGeometryMultiPatch_ESRI3DO.json`;
                const gltfPath = `${base}esriGeometryMultiPatch.gltf`;

                try {
                    const res = await fetch(jsonPath);
                    if (!res.ok) return null;
                    const data = await res.json();

                    const attrs = data?.attributes ?? {};
                    const lat = attrs?.緯度;
                    const lon = attrs?.経度;
                    const alt = attrs?.高度 ?? 0;
                    const year = attrs?.k14_Nendo;

                    if (lat == null || lon == null) return null;

                    const modelColor = getModelColor(year);

                    const modelPosition = Cartesian3.fromDegrees(lon, lat, 0);
                    const modelOrientation = Transforms.headingPitchRollQuaternion(
                        modelPosition,
                        new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0)
                    );

                    const model = viewer.entities.add({
                        name: `model_${i}`,
                        position: modelPosition,
                        orientation: modelOrientation,
                        model: { uri: gltfPath, scale: 1 },
                        year: year,
                        latlon: [lat, lon]
                    });
                    setModelColor(model, modelColor);
                    return model;
                } catch {
                    return null;
                }
            })();
            tasks.push(task);
        }
        const results = await Promise.all(tasks);
        for (const ent of results) if (ent) models.push(ent);
    }

    correctNumbers.forEach(modelNumber => {
        const model = viewer.entities.values.find(model => model.name === `model_${modelNumber}`);
        if (model) {
            viewer.entities.remove(model);
        }
    })

    const resultYear = new Date().getFullYear();
    const visibleEntityCount = viewer.entities.values.slice().reverse().filter(entity => models.includes(entity) && entity.show === true).length
    outputDiv.innerHTML = `施策:今は空　　年度:${resultYear} 　　建物数:${visibleEntityCount}`;

    return models;
}