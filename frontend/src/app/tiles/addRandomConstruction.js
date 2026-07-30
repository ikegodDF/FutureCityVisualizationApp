import * as turf from "@turf/turf";
import { Cartesian3, Color } from "cesium";
import { getModelColor } from "./getModelColor.js";

function calculateRectDimensions(area, aspect) {
    const width = Math.sqrt(area * aspect);
    const depth = area / width;
    return { width, depth };
}

function createRectanglePolygon(centerLngLat, widthMeters, depthMeters, rotationDeg = 0) {
    const center = turf.point(centerLngLat);
    const halfW = widthMeters / 2;
    const halfD = depthMeters / 2;

    const p1 = turf.destination(turf.destination(center, halfW, 90, { units: "meters" }), halfD, 0, { units: "meters" });
    const p2 = turf.destination(turf.destination(center, halfW, 90, { units: "meters" }), halfD, 180, { units: "meters" });
    const p3 = turf.destination(turf.destination(center, halfW, -90, { units: "meters" }), halfD, 180, { units: "meters" });
    const p4 = turf.destination(turf.destination(center, halfW, -90, { units: "meters" }), halfD, 0, { units: "meters" });

    const poly = turf.polygon([[
        p1.geometry.coordinates,
        p2.geometry.coordinates,
        p3.geometry.coordinates,
        p4.geometry.coordinates,
        p1.geometry.coordinates
    ]]);

    if (rotationDeg !== 0) {
        return turf.transformRotate(poly, rotationDeg, { pivot: centerLngLat });
    }
    return poly;
}

function getNearestRoadBearingFast(centerLngLat, roadSegments) {
    if (!roadSegments || !roadSegments.features || roadSegments.features.length === 0) return 0;

    const pt = turf.point(centerLngLat);
    const searchBbox = turf.bbox(turf.buffer(pt, 100, { units: "meters" }));

    let minDistance = Infinity;
    let nearestBearing = 0;

    for (let i = 0; i < roadSegments.features.length; i++) {
        const segment = roadSegments.features[i];
        const segBbox = turf.bbox(segment);

        if (
            segBbox[0] > searchBbox[2] || segBbox[2] < searchBbox[0] ||
            segBbox[1] > searchBbox[3] || segBbox[3] < searchBbox[1]
        ) {
            continue;
        }

        const dist = turf.pointToLineDistance(pt, segment, { units: "meters" });
        if (dist < minDistance) {
            minDistance = dist;
            const coords = segment.geometry.coordinates;
            nearestBearing = turf.bearing(turf.point(coords[0]), turf.point(coords[1]));
        }
    }

    return nearestBearing;
}

function isPolygonIntersectingRoadFast(poly, roadBufferPolygon) {
    if (!roadBufferPolygon) return false;

    const features = roadBufferPolygon.type === "FeatureCollection"
        ? roadBufferPolygon.features
        : [roadBufferPolygon];

    const polyBbox = turf.bbox(poly);

    for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const featBbox = turf.bbox(feature);

        if (
            polyBbox[0] > featBbox[2] || polyBbox[2] < featBbox[0] ||
            polyBbox[1] > featBbox[3] || featBbox[3] < polyBbox[1]
        ) {
            continue;
        }

        if (turf.booleanIntersects(poly, feature)) {
            return true;
        }
    }
    return false;
}

export async function addNewBuildings(viewer, currentModels = [], config = {}) {
    const {
        count = 50,
        zones = [],
        roadSpatial = null,
        targetYear = new Date().getFullYear(),
        minArea = 40,
        maxArea = 2000,
        minAspect = 1.0,
        maxAspect = 2.2,
    } = config;

    const roadSegments = roadSpatial?.roadSegments || null;
    const roadBufferPolygon = roadSpatial?.roadBuffer || null;

    const existingBuildings = currentModels
        .map((ent) => {
            const lat = ent.latitude || ent.latlon?.[0];
            const lon = ent.longitude || ent.latlon?.[1];
            if (!lat || !lon) return null;

            const area = ent.buildingArea || 100;
            const side = Math.sqrt(area);
            const radius = Math.hypot(side / 2, side / 2);

            return {
                pt: turf.point([lon, lat]),
                radius: radius,
                poly: createRectanglePolygon([lon, lat], side, side, 0)
            };
        })
        .filter(Boolean);

    const newEntities = [];
    let totalAttempts = 0;
    let buildingAttempts = 0;
    const maxAttempts = count * 100;

    // 現在作成を試みている建物の形状データ
    let currentBuildingShape = null;

    console.time("⏱ 生成所要時間");

    while (newEntities.length < count && totalAttempts < maxAttempts) {
        totalAttempts++;
        buildingAttempts++;

        // ★ 最初の試行、または 100回試しても建たない場合は建物の形を作り直す
        if (!currentBuildingShape || buildingAttempts % 100 === 1) {
            // 100回を超えるたびに、入りやすいように最大面積を徐々に小さくする (例: 100回超で最大サイズ50%, 200回超で25%...)
            const shrinkFactor = Math.pow(0.5, Math.floor((buildingAttempts - 1) / 100));
            const effectiveMaxArea = Math.max(minArea, maxArea * shrinkFactor);

            const area = minArea + Math.random() * (effectiveMaxArea - minArea);
            const aspect = minAspect + Math.random() * (maxAspect - minAspect);
            const { width, depth } = calculateRectDimensions(area, aspect);

            currentBuildingShape = { area, aspect, width, depth };

            if (buildingAttempts > 1) {
                console.warn(
                    `🔄 [試行 ${buildingAttempts} 回目] 建つ場所が見つからないため、建物の形を作り直しました ` +
                    `(目標面積: ${Math.round(area)}㎡, サイズ: ${Math.round(width)}m × ${Math.round(depth)}m)`
                );
            }
        }

        const selectedZone = zones.length > 0 ? zones[0] : null;
        if (!selectedZone?.polygon) continue;

        const bbox = turf.bbox(selectedZone.polygon);
        const pt = turf.randomPoint(1, { bbox }).features[0];
        if (!turf.booleanPointInPolygon(pt, selectedZone.polygon)) continue;

        const [lon, lat] = pt.geometry.coordinates;

        const { area, width, depth } = currentBuildingShape;

        let rotation = 0;
        if (roadSegments) {
            const roadBearing = getNearestRoadBearingFast([lon, lat], roadSegments);
            rotation = Math.random() < 0.5 ? roadBearing : roadBearing + 180;
        } else {
            rotation = Math.floor(Math.random() * 4) * 90;
        }

        const newPoly = createRectanglePolygon([lon, lat], width, depth, rotation);
        const currentPt = turf.point([lon, lat]);
        const newRadius = Math.hypot(width / 2, depth / 2);

        // 衝突判定①：建物
        const isOverlapBuilding = existingBuildings.some((item) => {
            const dist = turf.distance(currentPt, item.pt, { units: "meters" });
            if (dist > (newRadius + item.radius)) return false;
            return turf.booleanIntersects(newPoly, item.poly);
        });
        if (isOverlapBuilding) continue;

        // 衝突判定②：道路
        if (isPolygonIntersectingRoadFast(newPoly, roadBufferPolygon)) {
            continue;
        }

        // Cesium Entity 生成
        const storeys = Math.random() < 0.7 ? 2 : (Math.random() < 0.5 ? 1 : 3);
        const buildingHeight = storeys * 3.2;
        const baseHeight = 33.7;
        const topHeight = baseHeight + buildingHeight;

        const flatCoordinates = newPoly.geometry.coordinates[0].flatMap((c) => [c[0], c[1]]);
        const modelColor = getModelColor(targetYear);

        const entityId = `new_building_${Date.now()}_${newEntities.length}`;
        const entity = viewer.entities.add({
            id: entityId,
            name: entityId,
            polygon: {
                hierarchy: Cartesian3.fromDegreesArray(flatCoordinates),
                height: baseHeight,
                extrudedHeight: topHeight,
                material: modelColor,
                outline: true,
                outlineColor: Color.BLACK,
            },
            isNewBuilding: true,
            year: targetYear,
            latlon: [lat, lon],
            latitude: lat,
            longitude: lon,
            buildingArea: Math.round(area),
            buildingHeight: buildingHeight,
            storeysAboveGround: storeys,
            buildingPopulation: Math.floor(area / 30) * storeys,
        });

        existingBuildings.push({
            pt: currentPt,
            radius: newRadius,
            poly: newPoly
        });

        newEntities.push(entity);

        console.log(
            `🏠 建物 #${newEntities.length} 配置成功 | ` +
            `試行: ${buildingAttempts} 回 | ` +
            `面積: ${Math.round(area)}㎡ (${Math.round(width)}m × ${Math.round(depth)}m)`
        );

        // 次の建物のためにリセット
        buildingAttempts = 0;
        currentBuildingShape = null;
    }

    const avgAttempts = newEntities.length > 0 
        ? (totalAttempts / newEntities.length).toFixed(1) 
        : 0;

    console.log("--------------------------------------------------");
    console.log(`📊 【生成完了レポート】`);
    console.log(`・生成目標: ${count} 軒 / 達成: ${newEntities.length} 軒`);
    console.log(`・総試行回数: ${totalAttempts} 回`);
    console.log(`・1軒あたりの平均試行回数: ${avgAttempts} 回`);
    if (newEntities.length < count) {
        console.warn(`⚠️ 空きスペース不足のため ${count - newEntities.length} 軒の生成を諦めました。`);
    }
    console.log("--------------------------------------------------");
    console.timeEnd("⏱ 生成所要時間");

    return [...currentModels, ...newEntities];
}