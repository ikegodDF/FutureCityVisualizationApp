import {
    Cartesian3,
    Color,
  } from "cesium";
  import * as turf from "@turf/turf";
  import { getModelColor } from "./getModelColor.js";
  import { createModelDescription } from "./modelDescription.js";
  
  /**
   * 面積とアスペクト比（長短比）から四角形の幅と奥行きを計算する
   */
  function calculateRectDimensions(areaSquareMeters, aspectRatio) {
    const width = Math.sqrt(areaSquareMeters * aspectRatio);
    const depth = areaSquareMeters / width;
    return { width, depth };
  }
  
  /**
   * 指定の中心座標・幅・奥行き・回転角から Turf.js の四角形ポリゴンを作る
   */
  function createRectanglePolygon(centerLngLat, widthMeters, depthMeters, rotationDeg = 0) {
    const point = turf.point(centerLngLat);
    const halfW = (widthMeters / 2) / 1000; // km単位
    const halfD = (depthMeters / 2) / 1000;
  
    const bbox = [
      turf.destination(point, halfW, -90).geometry.coordinates[0], // 西
      turf.destination(point, halfD, 180).geometry.coordinates[1], // 南
      turf.destination(point, halfW, 90).geometry.coordinates[0],  // 東
      turf.destination(point, halfD, 0).geometry.coordinates[1],   // 北
    ];
  
    let poly = turf.bboxPolygon(bbox);
    if (rotationDeg !== 0) {
      poly = turf.transformRotate(poly, rotationDeg, { pivot: centerLngLat });
    }
    return poly;
  }
  
  /**
   * 新築建物を動的追加するメイン関数
   */
  export async function addNewBuildings(viewer, currentModels = [], config = {}) {
    const {
      count = 50,
      zones = [],
      targetYear = new Date().getFullYear(),
      // ★ 設定用パラメータ（ここでお好みで調整できます）
      minArea = 40,        // 最小面積 (㎡)
      maxArea = 200,       // 最大面積 (㎡)
      minAspect = 1.0,     // 最小アスペクト比 (1.0 = 正方形)
      maxAspect = 2.2,     // 最大アスペクト比 (2.2 = 細長い長方形)
    } = config;
  
    // 1. 既存建物の衝突用マップを作成
    const existingPolygons = currentModels
      .map((ent) => {
        const lat = ent.latitude || ent.latlon?.[0];
        const lon = ent.longitude || ent.latlon?.[1];
        if (!lat || !lon) return null;
        const side = Math.sqrt(ent.buildingArea || 100);
        return createRectanglePolygon([lon, lat], side, side, 0);
      })
      .filter(Boolean);
  
    const newEntities = [];
    let attempts = 0;
    const maxAttempts = count * 50;
  
    while (newEntities.length < count && attempts < maxAttempts) {
      attempts++;
  
      // 2. エリア指定
      const selectedZone = zones.length > 0 ? zones[0] : null;
      if (!selectedZone?.polygon) continue;
  
      const bbox = turf.bbox(selectedZone.polygon);
      const pt = turf.randomPoint(1, { bbox }).features[0];
      if (!turf.booleanPointInPolygon(pt, selectedZone.polygon)) continue;
  
      const [lon, lat] = pt.geometry.coordinates;
  
      // 3. ★ 大きさ（面積）と長短比（アスペクト比）をランダム決定
      const area = minArea + Math.random() * (maxArea - minArea);
      const aspect = minAspect + Math.random() * (maxAspect - minAspect);
  
      // 4. 幅と奥行きを算出して四角形ポリゴン作成
      const { width, depth } = calculateRectDimensions(area, aspect);
      const rotation = Math.floor(Math.random() * 4) * 90; // 0, 90, 180, 270度で配置
  
      const newPoly = createRectanglePolygon([lon, lat], width, depth, rotation);
  
      // 衝突判定
      const isOverlapped = existingPolygons.some((poly) => turf.booleanIntersects(newPoly, poly));
      if (isOverlapped) continue;
  
      // 5. 階数と高さの決定（例: 階数 1〜3階、1階あたり3.2m）
      // 5. 階数と高さの決定
    const storeys = Math.random() < 0.7 ? 2 : (Math.random() < 0.5 ? 1 : 3);
    const buildingHeight = storeys * 3.2; // 建物の全高（例: 6.4m）

    // ★ 基準となる標高オフセットを設定 (33.7m)
    const baseHeight = 33.7; // 底面の高さ
    const topHeight = baseHeight + 20; // 上面の高さ（底面 + 建物の高さ）

    // Cesium用座標配列に変換
    const flatCoordinates = newPoly.geometry.coordinates[0].flatMap((c) => [c[0], c[1]]);
    const modelColor = getModelColor(targetYear);

    // 6. Cesium に立体四角形として描画
    const entityId = `new_building_${Date.now()}_${newEntities.length}`;
    const entity = viewer.entities.add({
      id: entityId,
      name: entityId,
      polygon: {
        hierarchy: Cartesian3.fromDegreesArray(flatCoordinates),
        
        // ★ 33.7m の高度（標高）をセット
        height: baseHeight,          // 底面の標高 (33.7m)
        extrudedHeight: topHeight,   // 上面の標高 (33.7m + 建物の高さ)
        
        material: modelColor,
        outline: true,
        outlineColor: Color.BLACK,
      },
      // 管理用プロパティ（既存モデルと統一）
      isNewBuilding: true,
      year: targetYear,
      isEstimatedYear: false,
      latlon: [lat, lon],
      latitude: lat,
      longitude: lon,
      altitude: baseHeight,
      buildingUsage: 1,
      buildingStructureType: 1,
      buildingArea: Math.round(area),
      buildingHeight: buildingHeight,
      storeysAboveGround: storeys,
      architecturalPeriod: 4,
      buildingPopulation: Math.floor(area / 30) * storeys,
    });
  
      existingPolygons.push(newPoly);
      newEntities.push(entity);
    }
  
    console.log(`四角形の新築建物を ${newEntities.length} 軒追加しました。`);
    return [...currentModels, ...newEntities];
  }