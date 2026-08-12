import * as turf from '@turf/turf';
import { createConstructionZone } from './constructionZoneUtils.js';

const TYPE_WEIGHTS = {
  residential: 1.0,
  commercial: 0.6,
  selected: 1.0,
};

function collectLineFeatures(geoJson) {
  if (!geoJson) {
    return [];
  }

  if (geoJson.type === 'FeatureCollection') {
    return geoJson.features.flatMap((feature) => collectLineFeatures(feature));
  }

  if (geoJson.type === 'Feature') {
    return collectLineFeatures(geoJson.geometry);
  }

  if (geoJson.type === 'LineString') {
    return [turf.lineString(geoJson.coordinates)];
  }

  if (geoJson.type === 'MultiLineString') {
    return geoJson.coordinates.map((coordinates) => turf.lineString(coordinates));
  }

  return [];
}

function buildPolygonizeInput(boundaryPolygon, roadSpatial) {
  const boundaryLine = turf.polygonToLine(boundaryPolygon);
  const boundarySegments = turf.lineSegment(boundaryLine).features;
  const roadLines = collectLineFeatures(roadSpatial?.rawGeoJson);
  const clippedRoadSegments = roadLines.flatMap((line) => {
    try {
      return turf.lineSegment(line).features;
    } catch {
      return [];
    }
  });

  return turf.featureCollection([
    ...boundarySegments,
    ...clippedRoadSegments,
  ]);
}

function resolveBlockWeight(feature, area, options) {
  if (typeof options.weightResolver === 'function') {
    return options.weightResolver(feature, area);
  }

  const type = options.type ?? 'residential';
  const baseWeight = TYPE_WEIGHTS[type] ?? 1;
  const areaFactor = Math.max(area / 1000, 0.1);
  return baseWeight * areaFactor;
}

/**
 * 道路ネットワークと外周ポリゴンから街区ゾーンを生成する。
 * polygonize が失敗した場合は外周1ゾーンにフォールバックする。
 */
export function deriveRoadBlockZones(boundaryPolygon, roadSpatial, options = {}) {
  const {
    minAreaSqM = 200,
    type = 'residential',
    fallbackName = '道路区切り未分割エリア',
  } = options;

  if (!boundaryPolygon) {
    return [];
  }

  try {
    const polygonizeInput = buildPolygonizeInput(boundaryPolygon, roadSpatial);
    const polygonized = turf.polygonize(polygonizeInput);
    const zones = [];

    turf.featureEach(polygonized, (feature, index) => {
      const centroid = turf.centroid(feature);
      if (!turf.booleanPointInPolygon(centroid, boundaryPolygon)) {
        return;
      }

      const area = turf.area(feature);
      if (area < minAreaSqM) {
        return;
      }

      zones.push(createConstructionZone({
        id: `road-block-${index}`,
        name: `街区 ${zones.length + 1}`,
        type,
        weight: resolveBlockWeight(feature, area, { ...options, type }),
        polygon: feature,
      }));
    });

    if (zones.length > 0) {
      return zones.filter(Boolean);
    }
  } catch (error) {
    console.warn('道路区切りゾーンの生成に失敗しました。外周ゾーンにフォールバックします。', error);
  }

  return [
    createConstructionZone({
      id: 'road-block-fallback',
      name: fallbackName,
      type,
      weight: 1,
      polygon: boundaryPolygon,
    }),
  ].filter(Boolean);
}
