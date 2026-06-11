import regionsData from '../config/regions.json';

const STORAGE_KEY = 'activeRegionId';

let activeRegion = null;

const getApiBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const getFallbackRegions = () => regionsData.regions;

export async function fetchRegions() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/regions/`);
    if (!res.ok) throw new Error(`regions API failed: ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data.regions) && data.regions.length > 0) {
      return data.regions;
    }
  } catch (error) {
    console.warn('地域一覧の取得に失敗したため、ローカル設定を使用します:', error);
  }
  return getFallbackRegions();
}

export function findRegionById(regionId, regions = getFallbackRegions()) {
  return regions.find((region) => region.id === regionId) ?? null;
}

export function setActiveRegion(region) {
  activeRegion = region;
  if (region?.id) {
    sessionStorage.setItem(STORAGE_KEY, region.id);
  }
}

export function getActiveRegion() {
  return activeRegion;
}

export function getActiveRegionId() {
  return activeRegion?.id ?? sessionStorage.getItem(STORAGE_KEY) ?? getFallbackRegions()[0]?.id ?? 'mukawa';
}

export function restoreActiveRegion(regions = getFallbackRegions()) {
  const regionId = sessionStorage.getItem(STORAGE_KEY);
  const region = findRegionById(regionId, regions) ?? regions[0] ?? null;
  activeRegion = region;
  return region;
}

export function buildComputePayload(basePayload) {
  return {
    ...basePayload,
    region: getActiveRegionId(),
  };
}
