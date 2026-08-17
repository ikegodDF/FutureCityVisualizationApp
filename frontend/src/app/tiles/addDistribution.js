import * as Cesium from 'cesium'; // 💡 環境に合わせて const Cesium = window.Cesium; に変えてください
import { appState } from '../state/appState.js';
import { sampleTerrainHeights } from '../terrain/sampleTerrainHeights.js';

// 描画したオブジェクトを、地震と津波で別々に管理する（クリア用）
let seismicEntities = [];
let tsunamiPrimitives = [];

const TSUNAMI_PRIMITIVE_BATCH = 4000;

/**
 * ==================================================
 * 🎨 1. 色決定 ＆ メッシュデコード（内部ユーティリティ）
 * ==================================================
 */

/**
 * 計測震度（SI）に応じた色を取得
 */
/**
 * 震度（si）に応じた色を取得
 * 💡 気象庁の計測震度の正確な区切りに修正し、カラーパレットをパターン1(調整版)に更新しました
 */
function getSindoColor(si) {
    const alpha = 0.6; // 少し透けさせて下の地図が見えるようにする

    if (si < 0.5)  return Cesium.Color.WHITE.withAlpha(alpha); // 震度0
    if (si < 1.5)  return Cesium.Color.fromCssColorString('#A0F080').withAlpha(alpha); // 震度1
    if (si < 2.5)  return Cesium.Color.fromCssColorString('#00D000').withAlpha(alpha); // 震度2
    if (si < 3.5)  return Cesium.Color.fromCssColorString('#1040FF').withAlpha(alpha); // 震度3
    if (si < 4.5)  return Cesium.Color.fromCssColorString('#FFFF00').withAlpha(alpha); // 震度4
    if (si < 5.0)  return Cesium.Color.fromCssColorString('#FFD700').withAlpha(alpha); // 震度5弱 (4.5〜4.9)
    if (si < 5.5)  return Cesium.Color.fromCssColorString('#FF9900').withAlpha(alpha); // 震度5強 (5.0〜5.4)
    if (si < 6.0)  return Cesium.Color.fromCssColorString('#FF3300').withAlpha(alpha); // 震度6弱 (5.5〜5.9)
    if (si < 6.5)  return Cesium.Color.fromCssColorString('#99001A').withAlpha(alpha); // 👑震度6強 (6.0〜6.4)
    return Cesium.Color.fromCssColorString('#4A0010').withAlpha(alpha);                // 👑震度7   (6.5以上)
}

/**
 * 津波浸水深（depth）に応じた色を取得
 * 💡 凡例のカラーパレットと100%一致するように色コードを同期しました
 */
function getTsunamiColor(depth) {
    const alpha = 0.7; // 水の表現なので少し不透明度を上げる

    if (depth <= 0.01) return Cesium.Color.fromCssColorString('#A0F080').withAlpha(alpha);
    if (depth <= 0.3)  return Cesium.Color.fromCssColorString('#00D000').withAlpha(alpha);
    if (depth <= 1.0)  return Cesium.Color.fromCssColorString('#1040FF').withAlpha(alpha);
    if (depth <= 2.0)  return Cesium.Color.fromCssColorString('#FFFF00').withAlpha(alpha);
    if (depth <= 4.0)  return Cesium.Color.fromCssColorString('#FFD700').withAlpha(alpha);
    if (depth <= 6.0)  return Cesium.Color.fromCssColorString('#FF9900').withAlpha(alpha);
    if (depth <= 8.0)  return Cesium.Color.fromCssColorString('#FF3300').withAlpha(alpha);
    if (depth <= 10.0) return Cesium.Color.fromCssColorString('#99001A').withAlpha(alpha);
    return Cesium.Color.fromCssColorString('#4A0010').withAlpha(alpha);
}

/**
 * 📐 Python側のエンコードロジックと完全連動するメッシュデコード関数
 */
function decodeJapanMeshFromPython(meshcode) {
    const str = String(meshcode).trim();
    
    if (str.length < 10) {
        console.warn(`⚠️ 無効な桁数のメッシュコードです: ${meshcode}`);
        return null;
    }

    const m1_lat = parseInt(str.slice(0, 2));
    const m1_lon = parseInt(str.slice(2, 4));
    const m2_lat = parseInt(str.slice(4, 5));
    const m2_lon = parseInt(str.slice(5, 6));
    const m3_lat = parseInt(str.slice(6, 7));
    const m3_lon = parseInt(str.slice(7, 8));

    const m4 = parseInt(str.slice(8, 9));
    const m5 = parseInt(str.slice(9, 10));

    let lat = m1_lat / 1.5 + m2_lat / 12 + m3_lat / 120;
    let lon = m1_lon + 100 + m2_lon * 0.125 + m3_lon * 0.0125;

    const m4_idx = m4 - 1;
    const m4_lat_offset = Math.floor(m4_idx / 2);
    const m4_lon_offset = m4_idx % 2;

    lat += m4_lat_offset * (1 / 240);
    lon += m4_lon_offset * (1 / 160);

    const m5_idx = m5 - 1;
    const m5_lat_offset = Math.floor(m5_idx / 2);
    const m5_lon_offset = m5_idx % 2;

    lat += m5_lat_offset * (1 / 480);
    lon += m5_lon_offset * (1 / 320);

    const deltaLat = 1 / 480; 
    const deltaLon = 1 / 320; 

    return { lat, lon, deltaLat, deltaLon };
}

function getTsunamiCellDeltas(lat) {
    const meterPerLat = 111111;
    const meterPerLon = 111111 * Math.cos(lat * Math.PI / 180);
    const sizeInMeter = 10.0;
    return {
        deltaLatDeg: sizeInMeter / meterPerLat,
        deltaLonDeg: sizeInMeter / meterPerLon,
    };
}

function buildTsunamiInstances(items, terrainHeights) {
    const instances = [];

    items.forEach((item, index) => {
        const lat = item.latitude;
        const lon = item.longitude;
        const depth = item.depth;
        const { deltaLatDeg, deltaLonDeg } = getTsunamiCellDeltas(lat);
        const waterDepth = depth > 0 ? depth : 0.1;
        const groundHeight = terrainHeights[index] ?? 0;
        const color = getTsunamiColor(depth);

        instances.push(new Cesium.GeometryInstance({
            id: `tsunami_${lat}_${lon}_${index}`,
            geometry: new Cesium.RectangleGeometry({
                rectangle: Cesium.Rectangle.fromDegrees(
                    lon - deltaLonDeg / 2,
                    lat - deltaLatDeg / 2,
                    lon + deltaLonDeg / 2,
                    lat + deltaLatDeg / 2,
                ),
                height: groundHeight,
                extrudedHeight: groundHeight + waterDepth,
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
            },
        }));
    });

    return instances;
}

function addTsunamiPrimitiveBatches(viewer, instances) {
    for (let i = 0; i < instances.length; i += TSUNAMI_PRIMITIVE_BATCH) {
        const batch = instances.slice(i, i + TSUNAMI_PRIMITIVE_BATCH);
        const primitive = viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: batch,
            appearance: new Cesium.PerInstanceColorAppearance({
                closed: true,
                translucent: true,
            }),
            asynchronous: true,
            releaseGeometryInstances: true,
        }));
        tsunamiPrimitives.push(primitive);
    }
}

async function renderTsunamiDistribution(viewer, tsunami) {
    const validItems = tsunami.filter((item) =>
        !Number.isNaN(item.latitude)
        && !Number.isNaN(item.longitude)
        && item.depth !== undefined,
    );

    if (validItems.length === 0) {
        return;
    }

    console.log(`⏳ 津波浸水域 (${validItems.length}件) の地形サンプリング開始...`);
    const terrainHeights = await sampleTerrainHeights(viewer, validItems, {
        onProgress: (done, total) => {
            if (done > 0 && done % 10000 === 0) {
                console.log(` 👀 地形サンプリング... ${done}/${total} 件`);
            }
        },
    });

    console.log(`⏳ 津波ポリゴン生成中...`);
    const instances = buildTsunamiInstances(validItems, terrainHeights);
    addTsunamiPrimitiveBatches(viewer, instances);

    console.log(`✅ 津波マッピング完了: ${instances.length} 件 (${tsunamiPrimitives.length} プリミティブ)`);
}


/**
 * ==================================================
 * 🔓 2. 外部に公開する操作関数（消去 ＆ 描画）
 * ==================================================
 */

/**
 * 🧹 指定されたモード（'seismic' または 'tsunami'）のポリゴンを画面から消去する
 */
export const clearDistributionModels = (viewer, mode) => {
    if (!viewer) return;

    if (mode === 'earthquake' || !mode) {
        if (seismicEntities.length > 0) {
            console.log(`🧹 古い震度モデルを削除中... (${seismicEntities.length}件)`);
            seismicEntities.forEach(entity => viewer.entities.remove(entity));
            seismicEntities.length = 0;
        }
    }
    
    if (mode === 'tsunami' || !mode) {
        if (tsunamiPrimitives.length > 0) {
            console.log(`🧹 古い津波モデルを削除中... (${tsunamiPrimitives.length}件)`);
            tsunamiPrimitives.forEach((primitive) => viewer.scene.primitives.remove(primitive));
            tsunamiPrimitives.length = 0;
        }
    }
};

/**
 * 🚀 指定されたモードのポリゴンを描画する（地震は平面、津波は3D高さ有）
 * @param {Object} viewer - Cesium Viewer インスタンス
 * @param {string} mode - 'seismic' または 'tsunami'
 */
export const addDistributionModel = async (viewer, mode) => {
    if (!viewer) {
        console.error('❌ 描画エラー: Cesiumの viewer オブジェクトが関数に渡されていません。');
        return false;
    }

    if (!appState || !appState.distribution) {
        console.error('❌ 描画エラー: appState.distribution が空です。');
        return false;
    }

    const { seismic, tsunami } = appState.distribution;
    
    // 描画する前に、指定されたモードの古いポリゴンを自動クリア
    clearDistributionModels(viewer, mode);

    // --------------------------------------------------
    // 🔥 【地震（震度メッシュ）の平面描画】
    // --------------------------------------------------
    if (mode === 'earthquake' && seismic && seismic.length > 0) {
        viewer.entities.suspendEvents();

        console.log(`⏳ 震度メッシュ (${seismic.length}件) のマッピングを開始...`);
        
        seismic.forEach((item, index) => {
            if (index > 0 && index % 1000 === 0) {
                console.log(` 👀 震度処理中... ${index}/${seismic.length} 件完了`);
            }
            
            if (!item.meshcode || item.SI === undefined) return;

            const meshData = decodeJapanMeshFromPython(item.meshcode);
            if (!meshData) return;

            const { lat, lon, deltaLat, deltaLon } = meshData;
            const color = getSindoColor(item.SI);

            const entity = viewer.entities.add({
                id: `seismic_${item.meshcode}_${index}`,
                description: `<h3>地震情報</h3><p>メッシュ: ${item.meshcode}</p><p>計測震度: ${item.SI.toFixed(2)}</p>`,
                rectangle: {
                    coordinates: Cesium.Rectangle.fromDegrees(lon, lat, lon + deltaLon, lat + deltaLat),
                    material: color,
                    // 💡 地震は「平べったく」：extrudedHeight（高さ）はなし
                    outline: false
                }
            });
            seismicEntities.push(entity);
        });

        viewer.entities.resumeEvents();
        console.log(`✅ 震度マッピング完了: ${seismicEntities.length} 件`);
    }

    // --------------------------------------------------
    // 🔥 【津波浸水域の3D高さ有描画】
    // 地形追従の見た目を保ちつつ、描画時サンプリング + Primitive バッチで軽量化
    // --------------------------------------------------
    if (mode === 'tsunami' && tsunami && tsunami.length > 0) {
        await renderTsunamiDistribution(viewer, tsunami);
    }

    return true;
};
