import { newPrediction } from './newPredictionAction.js';
import { restoreInitialScene } from './restoreInitialSceneAction.js';
import { refreshRangeVisibility } from './rangeSelectActions.js';
import { takeHighResScreenshot } from '../../utils/screenshot.js';
import { waitForDomPaint, waitForViewerRender } from '../../utils/waitForViewerRender.js';

/** 一時設定: スクショ前に newPrediction する目標年（順番に実行） */
export const SCREENSHOT_PREDICTION_TARGET_YEARS = [2036, 2051];
export const SCREENSHOT_PREDICTION_PERCENTAGE = 50;

const PREDICTION_OPTIONS = { forceRefresh: true };
const RANGE_RENDER_FRAMES = 4;

async function waitForRangePolygons(viewer) {
  refreshRangeVisibility(viewer);
  await waitForViewerRender(viewer, RANGE_RENDER_FRAMES);
  await waitForDomPaint();
}

async function runSingleScreenshotPrediction({
  viewer,
  models,
  baseYear,
  targetYear,
  onSyncUi,
  onBeforeScreenshotUi,
}) {
  const addYear = targetYear - baseYear;
  if (addYear <= 0) {
    console.error(
      `スクショ用 newPrediction: 目標年 ${targetYear} が基準年 ${baseYear} 以下です`,
    );
    return false;
  }

  if (!await restoreInitialScene(viewer, models)) {
    console.error(`スクショ用 newPrediction (${targetYear}年): 基準シーンの復元に失敗しました`);
    return false;
  }
  onSyncUi?.();

  const ok = await newPrediction(
    viewer,
    models,
    addYear,
    SCREENSHOT_PREDICTION_PERCENTAGE,
    PREDICTION_OPTIONS,
  );
  if (!ok) {
    console.error(`スクショ用 newPrediction (${targetYear}年): 将来予測に失敗しました`);
    await restoreInitialScene(viewer, models);
    onSyncUi?.();
    return false;
  }

  onSyncUi?.();
  await waitForRangePolygons(viewer);

  await takeHighResScreenshot(viewer, undefined, undefined, {
    // 撮影直前に範囲ポリゴンを再生成しない（DOM のみ同期）
    onBeforeCapture: onBeforeScreenshotUi ?? onSyncUi,
  });

  if (!await restoreInitialScene(viewer, models)) {
    console.warn(`スクショ後 (${targetYear}年) の基準シーン復元に失敗しました`);
  }
  onSyncUi?.();
  return true;
}

/**
 * 各目標年について 基準シーン → newPrediction → スクショ → 基準シーン復元（一時フロー）
 * @returns {Promise<boolean>}
 */
export async function runScreenshotWithPrediction({
  viewer,
  models,
  baseYear,
  onSyncUi,
  onBeforeScreenshotUi,
}) {
  let allSucceeded = true;

  for (const targetYear of SCREENSHOT_PREDICTION_TARGET_YEARS) {
    const ok = await runSingleScreenshotPrediction({
      viewer,
      models,
      baseYear,
      targetYear,
      onSyncUi,
      onBeforeScreenshotUi,
    });
    if (!ok) {
      allSucceeded = false;
      break;
    }
  }

  return allSucceeded;
}
