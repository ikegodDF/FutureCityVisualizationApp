/**
 * 既存建物（むかわ町初期 GLTF 等）の面積・高さから
 * 対数正規分布を推定し、新築建物のサイズを乱数生成する。
 */

const DEFAULT_SIZE = {
  area: 100,
  height: 9,
  storeys: 2,
};

export const STOREY_HEIGHT_M = 4.5;
const DEFAULT_COMPACT_AREA_THRESHOLD = 50;
const DEFAULT_COMPACT_MAX_STOREYS = 1;

function inferHeight(storeys) {
  if (Number.isFinite(storeys) && storeys > 0) {
    return storeys * STOREY_HEIGHT_M;
  }
  return DEFAULT_SIZE.height;
}

function inferStoreys(height) {
  if (Number.isFinite(height) && height > 0) {
    return Math.max(1, Math.round(height / STOREY_HEIGHT_M));
  }
  return DEFAULT_SIZE.storeys;
}

function sampleStandardNormal() {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) {
    u1 = Math.random();
  }
  while (u2 === 0) {
    u2 = Math.random();
  }
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pickQuantile(sortedValues, q) {
  if (!sortedValues.length) {
    return null;
  }
  const index = Math.min(
    sortedValues.length - 1,
    Math.floor(q * (sortedValues.length - 1)),
  );
  return sortedValues[index];
}

function summarizeNumeric(values = []) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round((sum / sorted.length) * 10) / 10,
    median: pickQuantile(sorted, 0.5),
    p10: pickQuantile(sorted, 0.1),
    p25: pickQuantile(sorted, 0.25),
    p75: pickQuantile(sorted, 0.75),
    p90: pickQuantile(sorted, 0.9),
  };
}

/**
 * 正の値列から対数正規分布を最大尤度法（log 空間の平均・標準偏差）で推定する。
 * @param {number[]} values
 * @returns {object | null}
 */
export function fitLogNormalDistribution(values = []) {
  const positive = values.filter((value) => Number.isFinite(value) && value > 0);
  if (positive.length < 5) {
    return null;
  }

  const logs = positive.map(Math.log);
  const n = logs.length;
  const mu = logs.reduce((sum, value) => sum + value, 0) / n;
  const variance = logs.reduce((sum, value) => sum + (value - mu) ** 2, 0) / n;
  const sigma = Math.sqrt(Math.max(variance, 1e-6));
  const sorted = [...positive].sort((a, b) => a - b);

  return {
    type: 'lognormal',
    mu: Math.round(mu * 1000) / 1000,
    sigma: Math.round(sigma * 1000) / 1000,
    median: Math.round(Math.exp(mu) * 10) / 10,
    mean: Math.round(Math.exp(mu + (sigma ** 2) / 2) * 10) / 10,
    sampleCount: n,
    sampleMin: sorted[0],
    sampleMax: sorted[sorted.length - 1],
    sampleP5: pickQuantile(sorted, 0.05),
    sampleP95: pickQuantile(sorted, 0.95),
  };
}

/**
 * 推定した対数正規分布から乱数を生成する。
 * 既存データの p5–p95 にクリップし、極端な外挿を抑える。
 */
export function sampleLogNormalDistribution(fit, maxValue = Infinity) {
  const MAX_ATTEMPTS = 32;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const z = sampleStandardNormal();
    let value = Math.exp(fit.mu + fit.sigma * z);
    value = Math.min(fit.sampleP95, Math.max(fit.sampleP5, value));

    if (value <= maxValue) {
      return value;
    }
  }

  return Math.min(maxValue, fit.sampleP95);
}

/**
 * @param {Array} sources entity / payload / appState params
 */
export function extractBuildingSizeSamplesDetailed(sources = []) {
  const seen = new Set();
  const samples = [];
  const extraction = {
    inputCount: sources.length,
    accepted: 0,
    skippedNewBuilding: 0,
    skippedDuplicate: 0,
    skippedInvalidArea: 0,
  };

  for (const source of sources) {
    if (!source) {
      continue;
    }

    if (source.isNewBuilding) {
      extraction.skippedNewBuilding += 1;
      continue;
    }

    const id = source.id ?? source.name;
    if (id != null) {
      const key = String(id);
      if (seen.has(key)) {
        extraction.skippedDuplicate += 1;
        continue;
      }
      seen.add(key);
    }

    const detail = source.buildingDetail ?? source.BuildingDetail ?? {};
    const area = Number(detail.buildingArea ?? source.buildingArea);
    let height = Number(detail.buildingHeight ?? source.buildingHeight);
    let storeys = Number(detail.storeysAboveGround ?? source.storeysAboveGround);

    if (!Number.isFinite(area) || area <= 0) {
      extraction.skippedInvalidArea += 1;
      continue;
    }

    if (!Number.isFinite(storeys) || storeys <= 0) {
      storeys = inferStoreys(height);
    }
    if (!Number.isFinite(height) || height <= 0) {
      height = inferHeight(storeys);
    }

    samples.push({ area, height, storeys });
    extraction.accepted += 1;
  }

  return { samples, extraction };
}

export function extractBuildingSizeSamples(sources = []) {
  return extractBuildingSizeSamplesDetailed(sources).samples;
}

export function summarizeAreaDistribution(samples = []) {
  return summarizeNumeric(samples.map((sample) => sample.area));
}

/**
 * 既存建物サンプルから面積・高さの対数正規分布を推定する。
 * 小規模建物（面積 < compactAreaThreshold）は別途高さ分布を推定する。
 */
export function fitBuildingSizeDistributions(samples = [], options = {}) {
  const {
    minSamples = 5,
    compactAreaThreshold = DEFAULT_COMPACT_AREA_THRESHOLD,
    compactMaxStoreys = DEFAULT_COMPACT_MAX_STOREYS,
  } = options;

  if (!Array.isArray(samples) || samples.length < minSamples) {
    return null;
  }

  const areaFit = fitLogNormalDistribution(samples.map((sample) => sample.area));
  const heightFit = fitLogNormalDistribution(samples.map((sample) => sample.height));

  if (!areaFit || !heightFit) {
    return null;
  }

  const compactSamples = samples.filter((sample) => sample.area < compactAreaThreshold);
  const compactHeightFit = fitLogNormalDistribution(
    compactSamples.map((sample) => sample.height),
  );

  return {
    area: areaFit,
    height: heightFit,
    compact: {
      areaThreshold: compactAreaThreshold,
      maxStoreys: compactMaxStoreys,
      maxHeight: inferHeight(compactMaxStoreys),
      height: compactHeightFit,
      sampleCount: compactSamples.length,
      observed: summarizeNumeric(compactSamples.map((sample) => sample.height)),
    },
  };
}

function sampleHeightForArea(area, fitted) {
  const { compact, height: generalHeight } = fitted;

  if (area >= compact.areaThreshold) {
    return sampleLogNormalDistribution(generalHeight, Infinity);
  }

  const maxHeight = compact.maxHeight;

  if (compact.height) {
    return sampleLogNormalDistribution(compact.height, maxHeight);
  }

  // 小規模建物のサンプル不足時: 1階建て固定
  return inferHeight(1);
}

function finalizeBuildingSize(area, rawHeight, fitted) {
  const { compact } = fitted;

  if (area < compact.areaThreshold) {
    const storeys = compact.maxStoreys;
    const height = inferHeight(storeys);
    return { area, height, storeys };
  }

  const height = Math.round(rawHeight * 10) / 10;
  const storeys = inferStoreys(height);
  return { area, height, storeys };
}

/**
 * 推定した対数正規分布から新築建物のサイズを生成する。
 * @returns {(maxArea?: number) => { area: number, height: number, storeys: number }}
 */
export function createBuildingSizeSampler(samples = [], options = {}) {
  const {
    minSamples = 5,
    compactAreaThreshold = DEFAULT_COMPACT_AREA_THRESHOLD,
    compactMaxStoreys = DEFAULT_COMPACT_MAX_STOREYS,
    fallback = DEFAULT_SIZE,
  } = options;

  const fitted = fitBuildingSizeDistributions(samples, {
    minSamples,
    compactAreaThreshold,
    compactMaxStoreys,
  });
  if (!fitted) {
    return () => ({ ...fallback });
  }

  return (maxArea = Infinity) => {
    const area = Math.max(
      1,
      Math.round(sampleLogNormalDistribution(fitted.area, maxArea)),
    );
    const rawHeight = sampleHeightForArea(area, fitted);
    return finalizeBuildingSize(area, rawHeight, fitted);
  };
}
