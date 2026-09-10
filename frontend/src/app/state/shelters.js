import { TEMP_SHELTER_BUILDING_IDS } from '../config/shelterConfig.js';
import { appState } from './appState.js';
import {
  buildShelterRegionMappings,
  indexShelterRegionMappings,
} from './shelterRegionMapping.js';

/**
 * @typedef {import('../domain/buildings/toPayload.js').ModelPayload} ModelPayload
 * @typedef {import('./shelterRegionMapping.js').ShelterRegionMapping} ShelterRegionMapping
 * @typedef {{
 *   ids: number[],
 *   buildings: ModelPayload[],
 *   regionMappings: ShelterRegionMapping[],
 *   byRegion: Record<string, ShelterRegionMapping>,
 *   colorByShelterId: Record<number, string>,
 * }} ShelterState
 */

/**
 * @param {ModelPayload[]} payloads
 * @param {number[]} [shelterIds]
 * @returns {ShelterState}
 */
export function buildShelterState(
  payloads = [],
  shelterIds = TEMP_SHELTER_BUILDING_IDS,
) {
  const idSet = new Set(shelterIds.map((id) => Number(id)));
  const buildings = payloads.filter((payload) => idSet.has(Number(payload.id)));
  const foundIdSet = new Set(buildings.map((payload) => Number(payload.id)));
  const missingIds = shelterIds.filter((id) => !foundIdSet.has(Number(id)));

  if (missingIds.length > 0) {
    console.warn('避難所 ID が見つかりません:', missingIds);
  }

  return {
    ids: buildings.map((payload) => Number(payload.id)),
    buildings: structuredClone(buildings),
    regionMappings: [],
    byRegion: {},
    colorByShelterId: {},
  };
}

/**
 * 街区領域ごとに最寄り避難所を割り当てる。
 * @param {import('./blockRegions.js').BlockRegion[]} [blockRegions]
 * @param {ModelPayload[]} [shelterBuildings]
 * @returns {ShelterRegionMapping[]}
 */
export function mapNearestSheltersToRegions(
  blockRegions = appState.blockRegions,
  shelterBuildings = appState.shelter?.buildings ?? [],
) {
  const regionMappings = buildShelterRegionMappings(blockRegions, shelterBuildings);
  appState.shelter.regionMappings = regionMappings;
  appState.shelter.byRegion = indexShelterRegionMappings(regionMappings);
  console.log(
    `避難所マッピング: ${regionMappings.length} 区画`,
    regionMappings,
  );
  return regionMappings;
}

/**
 * @param {ModelPayload[]} payloads
 * @param {number[]} [shelterIds]
 * @returns {ShelterState}
 */
export function setShelters(payloads = [], shelterIds = TEMP_SHELTER_BUILDING_IDS) {
  appState.shelter = buildShelterState(payloads, shelterIds);
  console.log(`避難所: ${appState.shelter.ids.length} 件`, appState.shelter.ids);
  if (appState.blockRegions.length > 0) {
    mapNearestSheltersToRegions();
  }
  return appState.shelter;
}

export function getShelters() {
  return appState.shelter;
}

export function getShelterBuildingIds() {
  return appState.shelter?.ids ?? [];
}

export function getShelterRegionMappings() {
  return appState.shelter?.regionMappings ?? [];
}

/**
 * @param {string} regionId
 * @returns {ShelterRegionMapping|null}
 */
export function getShelterMappingForRegion(regionId) {
  return appState.shelter?.byRegion?.[regionId] ?? null;
}
