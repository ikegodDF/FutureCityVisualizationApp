/**
 * 築年数区分ロジック。
 *
 * 【既存建物の API 区分（バックエンドと同じ）】
 *   building_age = appStateYear - 5 - year
 *
 * 【新築建物の year 逆算（目標年時点の暦年齢）】
 *   age = targetYear - year  →  year = targetYear - age
 *   例: 2031年時点の 0~5年区分 → year は 2026~2031
 */

export const CATEGORY_COUNT = 10;
export const OVER46_CATEGORY_INDEX = CATEGORY_COUNT - 1;

export const CATEGORY_LABELS = [
  '0~5年',
  '6~10年',
  '11~15年',
  '16~20年',
  '21~25年',
  '26~30年',
  '31~35年',
  '36~40年',
  '41~45年',
  '46年~',
];

/** バックエンド new_prediction / 旧存続率 API 用 */
export function buildingAgeFromYear(year, appStateYear) {
  if (year == null || year === 0) {
    return null;
  }
  return appStateYear - 5 - year;
}

/** 目標年時点の暦年齢（新築 year 逆算用） */
export function calendarAgeFromYear(year, targetYear) {
  if (year == null || year === 0) {
    return null;
  }
  return targetYear - year;
}

export function resolveCategoryIndex(buildingAge) {
  if (buildingAge >= 46) {
    return OVER46_CATEGORY_INDEX;
  }
  if (buildingAge <= 5) {
    return 0;
  }
  return Math.floor((buildingAge - 6) / 5) + 1;
}

export function categoryAgeRange(categoryIndex) {
  if (categoryIndex <= 0) {
    return { min: 0, max: 5 };
  }
  if (categoryIndex >= OVER46_CATEGORY_INDEX) {
    return { min: 46, max: 46 };
  }
  const min = 6 + 5 * (categoryIndex - 1);
  const max = 10 + 5 * (categoryIndex - 1);
  return { min, max };
}

/** バックエンド区分式から year を逆算（既存建物の読み取り用） */
export function yearFromBuildingAge(buildingAge, appStateYear) {
  return appStateYear - 5 - buildingAge;
}

/** 目標年時点の暦年齢から year を逆算（新築用） */
export function yearFromCalendarAge(buildingAge, targetYear) {
  return targetYear - buildingAge;
}

/**
 * 目標年時点で区分 index に属する築年（year）を返す（新築用）。
 * 例: targetYear=2031, index=0 → year は 2026~2031
 */
export function yearFromCategoryIndexAtTarget(
  categoryIndex,
  targetYear,
  { random = true } = {},
) {
  const { min, max } = categoryAgeRange(categoryIndex);
  const buildingAge = random
    ? min + Math.floor(Math.random() * (max - min + 1))
    : Math.floor((min + max) / 2);
  return yearFromCalendarAge(buildingAge, targetYear);
}

/** @deprecated 新築には yearFromCategoryIndexAtTarget を使う */
export function yearFromCategoryIndex(
  categoryIndex,
  appStateYear,
  options = {},
) {
  return yearFromCategoryIndexAtTarget(categoryIndex, appStateYear, options);
}

export function resolveConstructionYear(buildingOptions = {}, fallbackAppStateYear) {
  const targetYear = buildingOptions.targetAppStateYear ?? fallbackAppStateYear;
  const categoryIndex = buildingOptions.categoryIndex ?? 0;
  return yearFromCategoryIndexAtTarget(categoryIndex, targetYear);
}
