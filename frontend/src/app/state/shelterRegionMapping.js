import * as turf from '@turf/turf';

/**
 * @typedef {import('../domain/buildings/toPayload.js').ModelPayload} ModelPayload
 * @typedef {import('./blockRegions.js').BlockRegion} BlockRegion
 * @typedef {Object} ShelterRegionMapping
 * @property {string} regionId
 * @property {string} regionName
 * @property {number|null} shelterId
 * @property {number|null} distanceM
 */

/**
 * @param {ModelPayload} building
 * @returns {import('@turf/turf').Feature<import('@turf/turf').Point>|null}
 */
function toShelterPoint(building) {
  const lat = building?.latitude;
  const lon = building?.longitude;
  if (lat == null || lon == null) {
    return null;
  }
  return turf.point([lon, lat]);
}

/**
 * @param {import('@turf/turf').Feature<import('@turf/turf').Point>} originPoint
 * @param {ModelPayload[]} shelterBuildings
 * @returns {{ shelterId: number, distanceM: number }|null}
 */
export function findNearestShelter(originPoint, shelterBuildings = []) {
  let nearest = null;

  for (const building of shelterBuildings) {
    const shelterPoint = toShelterPoint(building);
    if (!shelterPoint) {
      continue;
    }

    const distanceM = turf.distance(originPoint, shelterPoint, { units: 'meters' });
    if (!nearest || distanceM < nearest.distanceM) {
      nearest = {
        shelterId: Number(building.id),
        distanceM,
      };
    }
  }

  return nearest;
}

/**
 * 街区領域の重心から最寄り避難所を求める。
 * @param {BlockRegion[]} blockRegions
 * @param {ModelPayload[]} shelterBuildings
 * @returns {ShelterRegionMapping[]}
 */
export function buildShelterRegionMappings(
  blockRegions = [],
  shelterBuildings = [],
) {
  if (!blockRegions.length || !shelterBuildings.length) {
    return [];
  }

  return blockRegions
    .filter((region) => region?.polygon)
    .map((region) => {
      const centroid = turf.centroid(region.polygon);
      const nearest = findNearestShelter(centroid, shelterBuildings);

      return {
        regionId: region.id,
        regionName: region.name ?? region.id,
        shelterId: nearest?.shelterId ?? null,
        distanceM: nearest?.distanceM ?? null,
      };
    });
}

/**
 * @param {ShelterRegionMapping[]} regionMappings
 * @returns {Record<string, ShelterRegionMapping>}
 */
export function indexShelterRegionMappings(regionMappings = []) {
  return Object.fromEntries(
    regionMappings.map((mapping) => [mapping.regionId, mapping]),
  );
}
