import { Cartographic, sampleTerrainMostDetailed } from 'cesium';

export const TERRAIN_SAMPLE_BATCH = 500;

function normalizePosition(item) {
  const latitude = item?.latitude ?? item?.lat;
  const longitude = item?.longitude ?? item?.lon;
  return { latitude, longitude };
}

/**
 * 描画時に一度だけ地形高を取得する（CLAMP_TO_GROUND の毎フレーム追従より軽い）。
 * @param {import('cesium').Viewer} viewer
 * @param {Array<{ latitude?: number, longitude?: number, lat?: number, lon?: number }>} positions
 * @param {{ batchSize?: number, onProgress?: (done: number, total: number) => void }} [options]
 * @returns {Promise<number[]>}
 */
export async function sampleTerrainHeights(viewer, positions, options = {}) {
  const batchSize = options.batchSize ?? TERRAIN_SAMPLE_BATCH;

  if (!positions.length) {
    return [];
  }

  const terrainProvider = viewer?.terrainProvider;
  if (!terrainProvider) {
    return positions.map(() => 0);
  }

  if (terrainProvider.readyPromise) {
    await terrainProvider.readyPromise;
  }

  const cartographics = positions.map((item) => {
    const { latitude, longitude } = normalizePosition(item);
    return Cartographic.fromDegrees(longitude, latitude);
  });

  for (let i = 0; i < cartographics.length; i += batchSize) {
    const batch = cartographics.slice(i, i + batchSize);
    await sampleTerrainMostDetailed(terrainProvider, batch);
    options.onProgress?.(Math.min(i + batch.length, cartographics.length), cartographics.length);
  }

  return cartographics.map((cartographic) =>
    Number.isFinite(cartographic.height) ? cartographic.height : 0,
  );
}

/**
 * 単一点の地形高を取得する。
 */
export async function sampleTerrainHeightAt(viewer, longitude, latitude) {
  const [height] = await sampleTerrainHeights(viewer, [{ latitude, longitude }]);
  return height ?? 0;
}
