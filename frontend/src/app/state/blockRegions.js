import * as turf from '@turf/turf';

/**
 * 用途地域の候補（将来 UI から選択する想定）
 */
export const LAND_USE_TYPES = [
  '第一種低層住居専用地域',
  '第二種低層住居専用地域',
  '第一種中高層住居専用地域',
  '第二種中高層住居専用地域',
  '第一種住居地域',
  '第二種住居地域',
  '準住居地域',
  '近隣商業地域',
  '商業地域',
  '準工業地域',
  '工業地域',
  '工業専用地域',
];

/**
 * @typedef {Object} BlockRegion
 * @property {string} id
 * @property {string} name
 * @property {import('@turf/turf').Feature<import('@turf/turf').Polygon>} polygon GeoJSON Polygon Feature
 * @property {string|null} landUseType 用途地域（未設定は null）
 * @property {number} areaSqM
 */

/**
 * @param {Partial<BlockRegion> & { id: string, polygon: import('@turf/turf').Feature<import('@turf/turf').Polygon> }} source
 * @returns {BlockRegion}
 */
export function createBlockRegionRecord({
  id,
  name,
  polygon,
  landUseType = null,
  areaSqM,
}) {
  const resolvedArea = areaSqM ?? (polygon ? turf.area(polygon) : 0);

  return {
    id,
    name: name ?? id,
    polygon,
    landUseType: landUseType ?? null,
    areaSqM: resolvedArea,
  };
}

/**
 * 建物生成ゾーン（ConstructionZone）から BlockRegion 配列を作る。
 * @param {Array<{ id: string, name?: string, polygon: import('@turf/turf').Feature<import('@turf/turf').Polygon>, type?: string }>} zones
 * @returns {BlockRegion[]}
 */
export function blockRegionsFromConstructionZones(zones = []) {
  return zones
    .filter((zone) => zone?.polygon)
    .map((zone) => createBlockRegionRecord({
      id: zone.id,
      name: zone.name ?? zone.id,
      polygon: zone.polygon,
      areaSqM: turf.area(zone.polygon),
    }));
}
