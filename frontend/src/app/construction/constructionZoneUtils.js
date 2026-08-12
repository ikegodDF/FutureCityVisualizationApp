import * as turf from '@turf/turf';
import constructionConfig from '../config/constructionConfig.json';
import { deriveRoadBlockZones } from './roadBlockZones.js';

/**
 * @typedef {Object} ConstructionZone
 * @property {string} id
 * @property {string} name
 * @property {string} type
 * @property {number} weight
 * @property {import('@turf/turf').Feature<import('@turf/turf').Polygon>} polygon
 * @property {number} [maxBuildingCoverageRatio]
 */

export const ZONE_SOURCES = ['config', 'rangeSelect', 'roadBlocks', 'custom'];

export function createTurfPolygonFromPoints(points = []) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  const ring = points.map((point) => [
    point.lon ?? point.longitude,
    point.lat ?? point.latitude,
  ]);
  ring.push(ring[0]);
  return turf.polygon([ring]);
}

export function createConstructionZone({
  id,
  name,
  type = 'residential',
  weight = 1,
  polygon,
  maxBuildingCoverageRatio,
}) {
  if (!polygon) {
    return null;
  }

  return {
    id,
    name,
    type,
    weight,
    polygon,
    ...(maxBuildingCoverageRatio != null ? { maxBuildingCoverageRatio } : {}),
  };
}

export function buildZoneFromConfigEntry(zoneConfig) {
  const polygon = createTurfPolygonFromPoints(zoneConfig.coordinates);
  return createConstructionZone({
    id: zoneConfig.id,
    name: zoneConfig.name,
    type: zoneConfig.type,
    weight: zoneConfig.weight ?? 1,
    polygon,
    maxBuildingCoverageRatio: zoneConfig.maxBuildingCoverageRatio,
  });
}

export function getRegionConstructionConfig(regionId) {
  return constructionConfig.regions?.[regionId] ?? null;
}

export function getConstructionDefaults() {
  return constructionConfig.defaults ?? {};
}

export function buildZonesFromConfig(regionId) {
  const regionConfig = getRegionConstructionConfig(regionId);
  if (!regionConfig?.zones?.length) {
    return [];
  }

  return regionConfig.zones
    .map((zoneConfig) => buildZoneFromConfigEntry(zoneConfig))
    .filter(Boolean);
}

export function buildZonesFromSelectedRanges(selectedRanges = [], year = null) {
  if (!Array.isArray(selectedRanges) || selectedRanges.length === 0) {
    return [];
  }

  return selectedRanges
    .map((range, index) => {
      const polygon = createTurfPolygonFromPoints(range.polygon);
      return createConstructionZone({
        id: `selected-range-${year ?? 'current'}-${index}`,
        name: `選択範囲 ${index + 1}`,
        type: 'selected',
        weight: range.weight ?? 1,
        polygon,
      });
    })
    .filter(Boolean);
}

export function buildZonesFromRoadBlocks(roadSpatial, boundaryZones = [], options = {}) {
  const boundaryPolygon = boundaryZones[0]?.polygon;
  if (!boundaryPolygon) {
    return [];
  }

  return deriveRoadBlockZones(boundaryPolygon, roadSpatial, {
    ...getConstructionDefaults(),
    ...options,
  });
}

export function pickWeightedZone(zones = []) {
  if (!zones.length) {
    return null;
  }

  const totalWeight = zones.reduce((sum, zone) => sum + (zone.weight ?? 1), 0);
  if (totalWeight <= 0) {
    return zones[0];
  }

  let remaining = Math.random() * totalWeight;
  for (const zone of zones) {
    remaining -= zone.weight ?? 1;
    if (remaining <= 0) {
      return zone;
    }
  }

  return zones[zones.length - 1];
}
