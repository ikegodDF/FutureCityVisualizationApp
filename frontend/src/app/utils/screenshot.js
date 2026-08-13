import html2canvas from 'html2canvas';
import { appState } from '../state/appState.js';
import { getActiveRegion } from '../region/regionState.js';

export const SCREENSHOT_SCALE = 4;

const DISASTER_LABELS = {
  被災前: '被害前',
  地震発生後: '地震被害',
  津波発生後: '津波被害',
};

function resolveRegionLabel() {
  return getActiveRegion()?.label
    ?? appState.region?.label
    ?? '不明';
}

function buildScreenshotFilename() {
  const disasterLabel = DISASTER_LABELS[appState.disasterState] ?? appState.disasterState;
  const regionLabel = resolveRegionLabel();
  return `政策:${appState.appliedPolicy},${appState.year},${disasterLabel},${regionLabel}.png`;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * 現在の画面（Cesium シーン + UI）の高解像度 PNG を 1 枚保存する。
 * @param {import('cesium').Viewer} viewer
 * @param {number} [scale=4]
 * @returns {Promise<{ filename: string, dataUrl: string }>}
 */
export async function takeHighResScreenshot(viewer, scale = SCREENSHOT_SCALE) {
  viewer.scene.requestRender();
  viewer.scene.render();

  const { width: originalWidth, height: originalHeight } = viewer.scene.canvas;

  const canvas = document.createElement('canvas');
  canvas.width = originalWidth * scale;
  canvas.height = originalHeight * scale;

  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(viewer.scene.canvas, 0, 0, canvas.width, canvas.height);

  const uiCanvas = await html2canvas(document.body, { scale });
  context.drawImage(uiCanvas, 0, 0, canvas.width, canvas.height);

  const filename = buildScreenshotFilename();
  const dataUrl = canvas.toDataURL('image/png', 1.0);
  downloadDataUrl(dataUrl, filename);

  return { filename, dataUrl };
}
