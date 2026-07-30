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

/**
 * 高速版：付近(約100m圏内)の道路だけを絞り込んで角度を計算
 */
function getNearestRoadBearingFast(centerLngLat, roadSegments) {
    if (!roadSegments || roadSegments.features.length === 0) return 0;

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

/**
 * 高速版：道路バッファとの判定を「点 in ポリゴン」で処理
 */
function isPolygonIntersectingRoadFast(poly, roadBufferPolygon) {
    if (!roadBufferPolygon) return false;

    const coords = poly.geometry.coordinates[0];
    for (let i = 0; i < coords.length; i++) {
        const pt = turf.point(coords[i]);
        if (turf.booleanPointInPolygon(pt, roadBufferPolygon)) {
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
        maxArea = 200,
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
            const side = Math.sqrt(ent.buildingArea || 100);
            return {
                pt: turf.point([lon, lat]),
                radius: side * 0.8,
                poly: createRectanglePolygon([lon, lat], side, side, 0)
            };
        })
        .filter(Boolean);

    const newEntities = [];
    let attempts = 0;
    const maxAttempts = count * 50;

    while (newEntities.length < count && attempts < maxAttempts) {
        attempts++;

        const selectedZone = zones.length > 0 ? zones[0] : null;
        if (!selectedZone?.polygon) continue;

        const bbox = turf.bbox(selectedZone.polygon);
        const pt = turf.randomPoint(1, { bbox }).features[0];
        if (!turf.booleanPointInPolygon(pt, selectedZone.polygon)) continue;

        const [lon, lat] = pt.geometry.coordinates;

        const area = minArea + Math.random() * (maxArea - minArea);
        const aspect = minAspect + Math.random() * (maxAspect - minAspect);
        const { width, depth } = calculateRectDimensions(area, aspect);

        let rotation = 0;
        if (roadSegments) {
            const roadBearing = getNearestRoadBearingFast([lon, lat], roadSegments);
            rotation = Math.random() < 0.5 ? roadBearing : roadBearing + 180;
        } else {
            rotation = Math.floor(Math.random() * 4) * 90;
        }

        const newPoly = createRectanglePolygon([lon, lat], width, depth, rotation);
        const currentPt = turf.point([lon, lat]);

        // 衝突判定①：既存建物
        const isOverlapBuilding = existingBuildings.some((item) => {
            const dist = turf.distance(currentPt, item.pt, { units: "meters" });
            if (dist > 30) return false;
            return turf.booleanIntersects(newPoly, item.poly);
        });
        if (isOverlapBuilding) continue;

        // 衝突判定②：道路回避
        if (isPolygonIntersectingRoadFast(newPoly, roadBufferPolygon)) {
            continue;
        }

        // Cesium Entity の作成
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
            radius: Math.sqrt(area) * 0.8,
            poly: newPoly
        });

        newEntities.push(entity);
    }

    console.log(`⚡️ 高速生成完了: ${newEntities.length} 軒追加（試行回数: ${attempts}）`);
    return [...currentModels, ...newEntities];
}