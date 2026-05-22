import * as Cesium from 'cesium'; // 💡 環境に合わせて const Cesium = window.Cesium; に変えてください
import { appState } from '../state/appState.js';

// 描画したエンティティを、地震と津波で別々に管理する（クリア用）
let seismicEntities = [];
let tsunamiEntities = [];

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
        if (tsunamiEntities.length > 0) {
            console.log(`🧹 古い津波モデルを削除中... (${tsunamiEntities.length}件)`);
            tsunamiEntities.forEach(entity => viewer.entities.remove(entity));
            tsunamiEntities.length = 0;
        }
    }
};

/**
 * 🚀 指定されたモードのポリゴンを描画する（地震は平面、津波は3D高さ有）
 * @param {Object} viewer - Cesium Viewer インスタンス
 * @param {string} mode - 'seismic' または 'tsunami'
 */
export const addDistributionModel = (viewer, mode) => {
    if (!viewer) {
        console.error('❌ 描画エラー: Cesiumの viewer オブジェクトが関数に渡されていません。');
        return false;
    }

    if (!appState || !appState.distribution) {
        console.error('❌ 描画エラー: appState.distribution が空です。');
        return false;
    }

    const { seismic, tsunami } = appState.distribution;
    
    // パフォーマンス向上のため、描画イベントを一時停止
    viewer.entities.suspendEvents();

    // 描画する前に、指定されたモードの古いポリゴンを自動クリア
    clearDistributionModels(viewer, mode);

    // --------------------------------------------------
    // 🔥 【地震（震度メッシュ）の平面描画】
    // --------------------------------------------------
    if (mode === 'earthquake' && seismic && seismic.length > 0) {
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
        console.log(`✅ 震度マッピング完了: ${seismicEntities.length} 件`);
    }

    // --------------------------------------------------
    // 🔥 【津波浸水域の3D高さ有描画】
    // --------------------------------------------------
    if ((mode === 'tsunami' || mode === 'tsunami') && tsunami && tsunami.length > 0) {
        console.log(`⏳ 津波浸水域 (${tsunami.length}件) のマッピングを開始...`);
        
        tsunami.forEach((item, index) => {
            if (index > 0 && index % 1000 === 0) {
                console.log(` 👀 津波処理中... ${index}/${tsunami.length} 件完了`);
            }
            
            const lat = item.latitude;
            const lon = item.longitude;
            const depth = item.depth;

            if (isNaN(lat) || isNaN(lon) || depth === undefined) return;

            const color = getTsunamiColor(depth);
            
            // 💡 1度あたりの正確なメートル数（地球の形に基づく計算）
            const meterPerLat = 111111; // 緯度1度 ≒ 約111.1km
            // 経度は赤道から離れる（緯度が上がる）ほど1度あたりのメートルが狭くなるため、cos(lat) をかける
            const meterPerLon = 111111 * Math.cos(lat * Math.PI / 180); 

            // 💡 「10メートル」を「度（Degrees）」の単位に変換する
            const sizeInMeter = 10.0; 
            const deltaLatDeg = sizeInMeter / meterPerLat; // 10mの縦幅（度）
            const deltaLonDeg = sizeInMeter / meterPerLon; // 10mの横幅（度）

            // 浸水深（m）をそのまま高さとして適用
            const extrudedHeightValue = depth > 0 ? depth : 0.1;

            const entity = viewer.entities.add({
                id: `tsunami_${lat}_${lon}_${index}`,
                description: `<h3>津波浸水情報</h3><p>緯度: ${lat}</p><p>経度: ${lon}</p><p>浸水深: ${depth.toFixed(2)}m</p>`,
                rectangle: {
                    // 💡 中心座標（lat, lon）から、上下左右に「10mの半分（5m分）」ずつ広げる
                    coordinates: Cesium.Rectangle.fromDegrees(
                        lon - deltaLonDeg / 2, // 西端
                        lat - deltaLatDeg / 2, // 南端
                        lon + deltaLonDeg / 2, // 東端
                        lat + deltaLatDeg / 2  // 北端
                    ),
                    material: color,
                    extrudedHeight: extrudedHeightValue, // 高さは「m」
                    outline: false
                }
            });
            tsunamiEntities.push(entity);
        });
        
        console.log(`✅ 津波マッピング完了: ${tsunamiEntities.length} 件`);
    }

    // まとめて画面を更新
    viewer.entities.resumeEvents();
    return true;
};