import { Color, Cartesian3, Transforms, HeadingPitchRoll, Math as CesiumMath } from 'cesium';
import { getModelColor } from './getModelColor.js';
import { setResult } from '../state/appState.js';
import { toPayload } from './toPayload.js';
import { loadCityGMLFromURL, parseCityGML } from './cityGmlParser.js';

// getModelColorは別ファイルへ切り出し

export async function add3DModels(viewer) {
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

    correctNumbers.forEach(modelNumber => {
        const targetName = `model_${modelNumber}`;
        const entity = viewer.entities.values.find(e => e.name === targetName);
        if (entity) {
            viewer.entities.remove(entity);
        }
        const idx = models.findIndex(e => e.name === targetName);
        if (idx !== -1) {
            models.splice(idx, 1);
        }
    })
    
    setResult(models.map(toPayload));

    return models;
}

/**
 * PLATEAUのCityGMLデータを読み込んで3Dモデルとして追加
 * 既存のadd3DModelsと同じ形式で扱えるようにする
 * 
 * @param {Object} viewer - Cesium viewerインスタンス
 * @param {string|Array<string>} cityGmlUrls - CityGMLファイルのURL（文字列または配列）
 * @param {Object} options - オプション
 * @param {string} options.gltfBasePath - GLTFファイルのベースパス（CityGMLのIDと組み合わせて使用）
 * @param {boolean} options.useGeometry - CityGMLのジオメトリを直接使用するか（デフォルト: false）
 * @param {Function} options.idMapper - CityGMLのIDをGLTFファイル名に変換する関数
 * @returns {Promise<Array>} - 追加されたモデルの配列
 */
export async function add3DModelsFromCityGML(viewer, cityGmlUrls, options = {}) {
    const {
        gltfBasePath = '/models/citygml/',
        useGeometry = false,
        idMapper = null
    } = options;

    const urls = Array.isArray(cityGmlUrls) ? cityGmlUrls : [cityGmlUrls];
    const models = [];
    let modelIndex = 10000; // 既存のモデルIDと重複しないように開始インデックスを設定

    // 各CityGMLファイルを読み込む
    for (const url of urls) {
        try {
            console.log(`CityGMLファイルを読み込み中: ${url}`);
            const buildings = await loadCityGMLFromURL(url);
            console.log(`${buildings.length}件の建物データを取得しました`);

            // 各建物を処理
            for (const building of buildings) {
                try {
                    const lat = building.center.lat;
                    const lon = building.center.lon;
                    const alt = building.center.alt || 0;
                    const year = building.year || null;
                    const buildingId = building.id || `citygml_${modelIndex}`;
                    const buildingName = building.name || buildingId;

                    if (lat == null || lon == null) {
                        console.warn(`建物の座標が取得できませんでした: ${buildingId}`);
                        continue;
                    }

                    const modelColor = getModelColor(year);
                    const modelPosition = Cartesian3.fromDegrees(lon, lat, alt);

                    let entity = null;

                    if (useGeometry && building.positions.length > 0) {
                        // CityGMLのジオメトリを直接使用（Boxで簡易表示）
                        // より詳細な表示が必要な場合は、PolygonやPolylineVolumeを使用
                        const height = building.height || 10;
                        
                        entity = viewer.entities.add({
                            name: `citygml_${modelIndex}`,
                            position: modelPosition,
                            box: {
                                dimensions: new Cartesian3(20, 20, height), // 簡易的なサイズ
                                material: modelColor,
                                outline: true,
                                outlineColor: Color.BLACK
                            },
                            year: year,
                            latlon: [lat, lon],
                            citygmlData: building // 元のCityGMLデータを保持
                        });
                    } else {
                        // GLTFファイルを使用（IDマッパーまたはデフォルトパス）
                        let gltfPath = null;
                        
                        if (idMapper && typeof idMapper === 'function') {
                            gltfPath = idMapper(buildingId, building);
                        } else if (gltfBasePath) {
                            // デフォルト: /models/citygml/{buildingId}/model.gltf のような形式
                            gltfPath = `${gltfBasePath}${buildingId}/model.gltf`;
                        }

                        if (!gltfPath) {
                            console.warn(`GLTFパスが設定されていません: ${buildingId}`);
                            // GLTFパスがない場合、簡易的なBoxで表示
                            const height = building.height || 10;
                            entity = viewer.entities.add({
                                name: `citygml_${modelIndex}`,
                                position: modelPosition,
                                box: {
                                    dimensions: new Cartesian3(20, 20, height),
                                    material: modelColor,
                                    outline: true,
                                    outlineColor: Color.BLACK
                                },
                                year: year,
                                latlon: [lat, lon],
                                citygmlData: building
                            });
                        } else {
                            // GLTFファイルを使用
                            const modelOrientation = Transforms.headingPitchRollQuaternion(
                                modelPosition,
                                new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0)
                            );

                            entity = viewer.entities.add({
                                name: `citygml_${modelIndex}`,
                                position: modelPosition,
                                orientation: modelOrientation,
                                model: { uri: gltfPath, scale: 1 },
                                year: year,
                                latlon: [lat, lon],
                                citygmlData: building
                            });
                            entity.model.color = modelColor;
                        }
                    }

                    if (entity) {
                        models.push(entity);
                        modelIndex++;
                    }
                } catch (error) {
                    console.error(`建物の処理中にエラーが発生しました:`, error);
                    continue;
                }
            }
        } catch (error) {
            console.error(`CityGMLファイルの読み込みエラー (${url}):`, error);
            continue;
        }
    }

    // 結果をappStateに保存（既存の形式と統合）
    const existingResults = models.map(toPayload);
    // 既存の結果と統合する場合は、setResultを呼び出す前に既存データを取得
    // ここでは新しいデータのみを追加する形にしています
    if (existingResults.length > 0) {
        // 既存の結果に追加する場合は、appState.resultを更新
        // 現在の実装では、新しいデータのみを返します
        console.log(`${models.length}件のCityGMLモデルを追加しました`);
    }

    return models;
}

/**
 * CityGMLファイルを直接パースしてモデルを追加（URLではなくファイル内容を直接指定）
 * 
 * @param {Object} viewer - Cesium viewerインスタンス
 * @param {string} cityGmlContent - CityGMLファイルの内容（XML文字列）
 * @param {Object} options - オプション（add3DModelsFromCityGMLと同じ）
 * @returns {Promise<Array>} - 追加されたモデルの配列
 */
export async function add3DModelsFromCityGMLContent(viewer, cityGmlContent, options = {}) {
    try {
        const buildings = parseCityGML(cityGmlContent);
        console.log(`${buildings.length}件の建物データを取得しました`);

        const {
            gltfBasePath = '/models/citygml/',
            useGeometry = false,
            idMapper = null
        } = options;

        const models = [];
        let modelIndex = 10000;

        for (const building of buildings) {
            try {
                const lat = building.center.lat;
                const lon = building.center.lon;
                const alt = building.center.alt || 0;
                const year = building.year || null;
                const buildingId = building.id || `citygml_${modelIndex}`;

                if (lat == null || lon == null) continue;

                const modelColor = getModelColor(year);
                const modelPosition = Cartesian3.fromDegrees(lon, lat, alt);

                let entity = null;

                if (useGeometry && building.positions.length > 0) {
                    const height = building.height || 10;
                    entity = viewer.entities.add({
                        name: `citygml_${modelIndex}`,
                        position: modelPosition,
                        box: {
                            dimensions: new Cartesian3(20, 20, height),
                            material: modelColor,
                            outline: true,
                            outlineColor: Color.BLACK
                        },
                        year: year,
                        latlon: [lat, lon],
                        citygmlData: building
                    });
                } else {
                    let gltfPath = null;
                    if (idMapper && typeof idMapper === 'function') {
                        gltfPath = idMapper(buildingId, building);
                    } else if (gltfBasePath) {
                        gltfPath = `${gltfBasePath}${buildingId}/model.gltf`;
                    }

                    if (!gltfPath) {
                        const height = building.height || 10;
                        entity = viewer.entities.add({
                            name: `citygml_${modelIndex}`,
                            position: modelPosition,
                            box: {
                                dimensions: new Cartesian3(20, 20, height),
                                material: modelColor,
                                outline: true,
                                outlineColor: Color.BLACK
                            },
                            year: year,
                            latlon: [lat, lon],
                            citygmlData: building
                        });
                    } else {
                        const modelOrientation = Transforms.headingPitchRollQuaternion(
                            modelPosition,
                            new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0)
                        );

                        entity = viewer.entities.add({
                            name: `citygml_${modelIndex}`,
                            position: modelPosition,
                            orientation: modelOrientation,
                            model: { uri: gltfPath, scale: 1 },
                            year: year,
                            latlon: [lat, lon],
                            citygmlData: building
                        });
                        entity.model.color = modelColor;
                    }
                }

                if (entity) {
                    models.push(entity);
                    modelIndex++;
                }
            } catch (error) {
                console.error(`建物の処理中にエラーが発生しました:`, error);
                continue;
            }
        }

        console.log(`${models.length}件のCityGMLモデルを追加しました`);
        return models;
    } catch (error) {
        console.error('CityGMLコンテンツのパースエラー:', error);
        throw error;
    }
}