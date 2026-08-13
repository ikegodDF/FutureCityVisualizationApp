import * as turf from "@turf/turf";
import { Cartesian3 } from "cesium";
import { getModelColor } from "./getModelColor.js";
import { createModelDescription } from "./modelDescription.js";
import { appState } from "../state/appState.js";
import { pickWeightedZone } from "../construction/constructionZoneUtils.js";
import {
  createBuildingIdAllocator,
  createBuildingSizeSampler,
  createNewBuildingRecord,
  extractBuildingSizeSamples,
  resolveConstructionYear,
} from "../domain/buildings/index.js";

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

export async function addNewBuildings(viewer, currentModels = [], count, zones, buildingOptions = {}) {
    const targetAppStateYear = buildingOptions.targetAppStateYear ?? appState.year;
    const constructionYear = resolveConstructionYear(buildingOptions, appState.year);

    const config = {
        count: count,
        zones: zones,
        roadSpatial: appState.road.spatial,
        targetAppStateYear,
        constructionYear,
        minArea: buildingOptions.minArea ?? 50,
        maxArea: buildingOptions.maxArea ?? 500,
        minAspect: buildingOptions.minAspect ?? 1.0,
        maxAspect: buildingOptions.maxAspect ?? 2.2,
    }

    const roadSegments = config.roadSpatial?.roadSegments || null;
    const roadBufferPolygon = config.roadSpatial?.roadBuffer || null;
    const idAllocator = buildingOptions.idAllocator
        ?? createBuildingIdAllocator([
            ...currentModels,
            ...(buildingOptions.idSources ?? []),
        ]);

    const sizeSampleSources = [
        ...currentModels,
        ...(buildingOptions.idSources ?? []),
    ];
    const buildingSizeSamples = extractBuildingSizeSamples(sizeSampleSources);
    const sampleBuildingSize = createBuildingSizeSampler(buildingSizeSamples, {
        compactAreaThreshold: buildingOptions.compactAreaThresholdSqM ?? 50,
        compactMaxStoreys: buildingOptions.compactMaxStoreys ?? 1,
        fallback: {
            area: Math.round((config.minArea + config.maxArea) / 2),
            height: 9,
            storeys: 2,
        },
    });

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

    let currentBuildingShape = null;

    while (newEntities.length < count && totalAttempts < maxAttempts) {
        totalAttempts++;
        buildingAttempts++;

        if (!currentBuildingShape || buildingAttempts % 100 === 1) {
            const shrinkFactor = Math.pow(0.5, Math.floor((buildingAttempts - 1) / 100));
            const effectiveMaxArea = Math.max(config.minArea, config.maxArea * shrinkFactor);

            const { area, height: sampledHeight, storeys: sampledStoreys } = sampleBuildingSize(effectiveMaxArea);
            const aspect = config.minAspect + Math.random() * (config.maxAspect - config.minAspect);
            const { width, depth } = calculateRectDimensions(area, aspect);

            currentBuildingShape = {
                area,
                aspect,
                width,
                depth,
                buildingHeight: sampledHeight,
                storeys: sampledStoreys,
            };
        }

        const selectedZone = pickWeightedZone(zones);
        if (!selectedZone?.polygon) continue;

        const bbox = turf.bbox(selectedZone.polygon);
        const pt = turf.randomPoint(1, { bbox }).features[0];
        if (!turf.booleanPointInPolygon(pt, selectedZone.polygon)) continue;

        const [lon, lat] = pt.geometry.coordinates;

        const { area, width, depth, buildingHeight, storeys } = currentBuildingShape;

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

        // 1m のバッファ（離隔距離）を設定して判定用ポリゴンを作成
        const bufferDistance = 1; // 1メートル
        const newPolyBuffered = turf.buffer(newPoly, bufferDistance, { units: "meters" });

        // 衝突判定①：建物同士（1mのスキマを確保）
        const isOverlapBuilding = existingBuildings.some((item) => {
            const dist = turf.distance(currentPt, item.pt, { units: "meters" });
            
            // スキップ判定にもバッファ分を加算
            if (dist > (newRadius + item.radius + bufferDistance * 2)) return false;

            // 膨らませたポリゴンで交差チェック
            return turf.booleanIntersects(newPolyBuffered, item.poly);
        });
        if (isOverlapBuilding) continue;

        // 衝突判定②：道路
        if (isPolygonIntersectingRoadFast(newPoly, roadBufferPolygon)) {
            continue;
        }

        // Cesium Entity 生成
        const baseHeight = 33.7;
        const topHeight = baseHeight + buildingHeight;

        const flatCoordinates = newPoly.geometry.coordinates[0].flatMap((c) => [c[0], c[1]]);
        const modelColor = getModelColor(config.constructionYear);

        const buildingId = idAllocator.next();
        const buildingPopulation = 0;
        const record = createNewBuildingRecord({
            id: buildingId,
            lat,
            lon,
            year: config.constructionYear,
            buildingArea: Math.round(area),
            buildingHeight,
            storeysAboveGround: storeys,
            buildingPopulation,
        });

        const entity = viewer.entities.add({
            id: record.id,
            name: record.name,
            show: record.show,
            polygon: {
                hierarchy: Cartesian3.fromDegreesArray(flatCoordinates),
                height: baseHeight,
                extrudedHeight: topHeight,
                material: modelColor,
                outline: false,
            },
            isNewBuilding: record.isNewBuilding,
            isEstimatedYear: record.isEstimatedYear,
            isDamage: record.isDamage,
            year: record.year,
            latlon: record.latlon,
            latitude: record.latitude,
            longitude: record.longitude,
            buildingUsage: record.buildingUsage,
            buildingStructureType: record.buildingStructureType,
            architecturalPeriod: record.architecturalPeriod,
            buildingArea: record.buildingArea,
            buildingHeight: record.buildingHeight,
            storeysAboveGround: record.storeysAboveGround,
            buildingPopulation: record.buildingPopulation,
            buildingDetail: record.buildingDetail,
            description: createModelDescription({
                lat: record.latitude,
                lon: record.longitude,
                year: record.year,
                isEstimatedYear: record.isEstimatedYear,
                buildingUsage: record.buildingUsage,
                buildingStructureType: record.buildingStructureType,
                buildingArea: record.buildingArea,
                buildingHeight: record.buildingHeight,
                storeysAboveGround: record.storeysAboveGround,
                architecturalPeriod: record.architecturalPeriod,
                buildingPopulation: record.buildingPopulation,
            }),
        });

        existingBuildings.push({
            pt: currentPt,
            radius: newRadius,
            poly: newPoly
        });

        newEntities.push(entity);

        buildingAttempts = 0;
        currentBuildingShape = null;
    }

    return [...currentModels, ...newEntities];
}