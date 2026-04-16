import { Cartesian3, Transforms, HeadingPitchRoll, Math as CesiumMath, ShadowMode } from 'cesium';
import { getModelColor } from './getModelColor.js';
import { createModelYear } from './createModelDetails.js';

// glTFモデル（施策適用前の3Dモデル）を読み込んで追加する
// 役割は addCityGmlModels の GLTF版
export async function addGltfModels(viewer) {
    const modelNumber = 2246;

    const models = [];

    // 全モデルで同じ姿勢指定なので、HeadingPitchRoll 自体は使い回す（ループ内の new を削減）
    const fixedHeadingPitchRoll = new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0);

    // バッチ並列実行
    const batchSize = 500;
    for (let start = 1; start <= modelNumber; start += batchSize) {
        const end = Math.min(start + batchSize - 1, modelNumber);
        const tasks = [];
        for (let i = start; i <= end; i++) {
            const task = (async () => {
                const base = `/models/mukawa3D/mukawa3D/OID_${i}/`;
                const jsonPath = `${base}esriGeometryMultiPatch_ESRI3DO.json`;
                const gltfPath = `${base}esriGeometryMultiPatch.glb`;

                try {
                    const res = await fetch(jsonPath);
                    if (!res.ok) return null;
                    const data = await res.json();

                    const attrs = data?.attributes ?? {};
                    const lat = attrs?.緯度;
                    const lon = attrs?.経度;
                    const alt = attrs?.高度 ?? 0;
                    const year = createModelYear();
                    const buildingUsage = attrs?.用途区_ ?? null;
                    const buildingStructureType = attrs?.建築構_ ?? null;
                    const buildingArea = attrs?.面積 ?? null;
                    const buildingHeight = attrs?.k25_Tatemo ?? null;
                    const storeysAboveGround = attrs?.k15_Chijou ?? null;
                    const architecturalPeriod = attrs?.建築年_ ?? null;


                    if (lat == null || lon == null) return null;

                    const modelColor = getModelColor(year);

                    const modelPosition = Cartesian3.fromDegrees(lon, lat, 0);
                    const modelOrientation = Transforms.headingPitchRollQuaternion(
                        modelPosition,
                        fixedHeadingPitchRoll
                    );

                    const model = viewer.entities.add({
                        name: `model_${i}`,
                        position: modelPosition,
                        orientation: modelOrientation,
                        model: {
                            uri: gltfPath,
                            scale: 1,
                            shadows: ShadowMode.DISABLED
                        },
                        year: year,
                        latlon: [lat, lon],
                        buildingUsage,
                        buildingStructureType,
                        buildingArea,
                        buildingHeight,
                        storeysAboveGround,
                        architecturalPeriod
                    });
                    model.model.color = modelColor;
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
    

    return models;
}

