import { Color, Cartesian3, Transforms, HeadingPitchRoll, Math as CesiumMath } from 'cesium';
import { getModelColor } from './getModelColor.js';
import { loadCityGMLFromURL, parseCityGML } from './cityGmlParser.js';
import { structureTypes, usages } from './PLATEAUData.js';

/**
 * PLATEAUのCityGMLデータを読み込んで3Dモデルとして追加
 * 既存のaddGltfModelsと同じ形式で扱えるようにする
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
                    // cityGmlParser側で座標順は補正済み（lon, lat）
                    const lat = building.center.lat;
                    const lon = building.center.lon;
                    // groundAltitude: 建物が建つ高度（地盤高, m）。今回は地形を使わないので常に0。
                    const groundAltitude = 0;
                    const year = building.year || null;
                    const usage = building.usage || building.attributes?.usage || null;
                    const structureType = building.attributes?.buildingStructureType || null;
                    const buildingArea =
                        building.attributes?.buildingFootprintArea ??
                        building.attributes?.totalFloorArea ??
                        null;
                    // buildingHeightRaw: データから取得した建物の高さ（物理的な高さ, m）
                    const rawBuildingHeight =
                        building.attributes?.buildingHeight ??
                        building.height ??
                        null;
                    const storeysAboveGround = building.storeysAboveGround ?? null;
                    // 建物高さの決定ロジック:
                    // 1. 高さが妥当ならそれを使用
                    // 2. 高さが不明で階数があれば「階数 × 3m」
                    // 3. それもなければ「1階相当 = 3m」とみなす
                    let buildingHeight = null;
                    if (rawBuildingHeight != null && rawBuildingHeight > 0 && rawBuildingHeight !== -9999) {
                        buildingHeight = rawBuildingHeight;
                    } else if (storeysAboveGround != null && storeysAboveGround > 0 && storeysAboveGround !== 9999) {
                        buildingHeight = storeysAboveGround * 3;
                    } else {
                        buildingHeight = 3;
                    }
                    const buildingId = building.id || `citygml_${modelIndex}`;

                    if (lat == null || lon == null) {
                        console.warn(`建物の座標が取得できませんでした: ${buildingId}`);
                        continue;
                    }

                    const modelColor = getModelColor(year);
                    const modelPosition = Cartesian3.fromDegrees(lon, lat, groundAltitude);

                    let entity = null;

                    if (useGeometry && (building.geometry?.lod0RoofEdge?.length || building.positions.length > 0)) {
                        // CityGMLの形状データから建物の平面形状をポリゴンとして描画する
                        // 優先: lod0RoofEdge（屋根端線）→ なければ positions（Solid からの代表面）
                        const footprint = (building.geometry?.lod0RoofEdge && building.geometry.lod0RoofEdge.length > 0)
                            ? building.geometry.lod0RoofEdge
                            : building.positions;

                        if (footprint && footprint.length >= 3) {
                            const height = buildingHeight;

                            // lon,lat の配列に変換
                            const coords = [];
                            footprint.forEach(p => {
                                coords.push(p.lon, p.lat);
                            });

                            entity = viewer.entities.add({
                                name: `model_${modelIndex}`,
                                polygon: {
                                    hierarchy: Cartesian3.fromDegreesArray(coords),
                                    height: 0,                 // 底面高さ0
                                    extrudedHeight: height,    // 建物高さ分だけ押し出し
                                    material: modelColor,      // 不透明色
                                    outline: true,
                                    outlineColor: Color.BLACK
                                },
                                year: year,
                                latlon: [lat, lon],
                                latitude: lat,
                                longitude: lon,
                                buildingUsage: usage,
                                buildingStructureType: structureType,
                                buildingArea,
                                buildingHeight,
                                storeysAboveGround,
                                citygmlData: building, // 元のCityGMLデータを保持
                                description: "緯度: " + lat.toFixed(6) + " 経度: " + lon.toFixed(6) + "<br>" + 
                                "建物用途: " + usages[usage] + "<br>" +
                                "建物構造: " + structureTypes[structureType] + "<br>" +
                                "建物面積: " + buildingArea + " m2<br>" +
                                "建物高さ: " + buildingHeight + " m<br>" +
                                "建物階数: " + storeysAboveGround + "階<br>" +
                                "建物年: " + year + "<br>" ,
                            });
                        } else {
                            // 形状が取れない場合はフォールバックとしてBox
                            const height = buildingHeight;
                            const boxCenterAlt = height / 2;
                            const modelPosition = Cartesian3.fromDegrees(lon, lat, boxCenterAlt);

                            entity = viewer.entities.add({
                                name: `model_${modelIndex}`,
                                position: modelPosition,
                                box: {
                                    dimensions: new Cartesian3(20, 20, height),
                                    material: modelColor,
                                    outline: true,
                                    outlineColor: Color.BLACK
                                },
                                year: year,
                                latlon: [lat, lon],
                                latitude: lat,
                                longitude: lon,
                                buildingUsage: usage,
                                buildingStructureType: structureType,
                                buildingArea,
                                buildingHeight,
                                storeysAboveGround,
                                citygmlData: building,
                                description: building.description
                            });
                        }
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
                            const height = getValidHeight(building.height);
                            // Boxのpositionは中心位置なので、底面が高さ0に来るように高さの半分だけ上にずらす
                            const boxCenterAlt = height / 2;
                            const boxPosition = Cartesian3.fromDegrees(lon, lat, boxCenterAlt);
                            entity = viewer.entities.add({
                                name: `model_${modelIndex}`,
                                position: boxPosition,
                                box: {
                                    dimensions: new Cartesian3(20, 20, height),
                                    material: modelColor,
                                    outline: true,
                                    outlineColor: Color.BLACK
                                },
                                year: year,
                                latlon: [lat, lon],
                                latitude: lat,
                                longitude: lon,
                                buildingUsage: usage,
                                buildingStructureType: structureType,
                                buildingArea,
                                buildingHeight,
                                storeysAboveGround,
                                citygmlData: building,
                                description: building.description
                            });
                        } else {
                            // GLTFファイルを使用
                            // GLTFモデルの場合も、底面が高さ0に来るように調整が必要な場合はここで処理
                            // ただし、GLTFモデルはモデル自体の原点位置に依存するため、ここではそのまま使用
                            const modelOrientation = Transforms.headingPitchRollQuaternion(
                                modelPosition,
                                new HeadingPitchRoll(CesiumMath.toRadians(90), 0, 0)
                            );

                            entity = viewer.entities.add({
                                name: `model_${modelIndex}`,
                                position: modelPosition,
                                orientation: modelOrientation,
                                model: { uri: gltfPath, scale: 1 },
                                year: year,
                                latlon: [lat, lon],
                                latitude: lat,
                                longitude: lon,
                                buildingUsage: usage,
                                buildingStructureType: structureType,
                                buildingArea,
                                buildingHeight,
                                storeysAboveGround,
                                citygmlData: building,
                                description: building.description
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

    return models;
}
