import {
  ZONE_SOURCES,
  buildZonesFromConfig,
  buildZonesFromRoadBlocks,
  buildZonesFromSelectedRanges,
  getConstructionDefaults,
  getRegionConstructionConfig,
} from './constructionZoneUtils.js';
import { getActiveRegionId } from '../region/regionState.js';
import { appState } from '../state/appState.js';

const STORAGE_KEY = 'constructionZoneSource';

let customZones = null;
let zoneSource = restoreZoneSource();

function restoreZoneSource() {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (saved && ZONE_SOURCES.includes(saved)) {
    return saved;
  }
  return 'config';
}

export function getConstructionZoneSource() {
  return zoneSource;
}

export function setConstructionZoneSource(source) {
  if (!ZONE_SOURCES.includes(source)) {
    throw new Error(`未知の zoneSource です: ${source}`);
  }

  zoneSource = source;
  customZones = null;
  sessionStorage.setItem(STORAGE_KEY, source);
}

export function setCustomConstructionZones(zones) {
  customZones = Array.isArray(zones) ? zones : [];
  zoneSource = 'custom';
  sessionStorage.setItem(STORAGE_KEY, 'custom');
}

export function getDefaultBuildingCount(regionId = getActiveRegionId()) {
  const defaults = getConstructionDefaults();
  const regionConfig = getRegionConstructionConfig(regionId);
  return regionConfig?.defaultCount ?? defaults.defaultCount ?? 100;
}

export function resolveConstructionZones(appState, regionId = getActiveRegionId()) {
  if (customZones?.length) {
    return customZones;
  }

  const regionConfig = getRegionConstructionConfig(regionId);
  const configZones = buildZonesFromConfig(regionId);
  const activeSource = zoneSource === 'config' && regionConfig?.zoneSource
    ? regionConfig.zoneSource
    : zoneSource;

  switch (activeSource) {
    case 'rangeSelect': {
      const selectedRanges = appState.selectedRanges?.[appState.year] ?? [];
      const selectedZones = buildZonesFromSelectedRanges(selectedRanges, appState.year);
      return selectedZones.length > 0 ? selectedZones : configZones;
    }
    case 'roadBlocks': {
      const roadBlockZones = buildZonesFromRoadBlocks(appState.road, configZones);
      return roadBlockZones.length > 0 ? roadBlockZones : configZones;
    }
    case 'custom':
      return customZones ?? [];
    case 'config':
    default:
      return configZones;
  }
}

export function getConstructionSettings(regionId = getActiveRegionId()) {
  return {
    defaults: getConstructionDefaults(),
    regionConfig: getRegionConstructionConfig(regionId),
    zoneSource: getConstructionZoneSource(),
    zones: resolveConstructionZones(appState, regionId),
  };
}
