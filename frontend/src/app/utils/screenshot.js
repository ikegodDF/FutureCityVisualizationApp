import html2canvas from 'html2canvas';
import { appState } from '../state/appState.js';
import { getActiveRegion } from '../region/regionState.js';
import { syncGeneralLeftStackLayout } from '../controls/layouts/generalLayoutSync.js';
import { getOutputDisplayContent, renderOutputContainerHtml } from './outputDisplay.js';
import { waitForDomPaint, waitForViewerRender } from './waitForViewerRender.js';

export const SCREENSHOT_SCALE = 4;

const DISASTER_LABELS = {
  被災前: '被害前',
  地震発生後: '地震被害',
  津波発生後: '津波被害',
};

const SCREENSHOT_OVERLAYS = [
  { selector: '#buildingAgeLegend', anchor: 'top-left' },
  { selector: '#outputContainer', anchor: 'center' },
];

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

function resolveScreenshotFilename(filename) {
  if (filename == null || String(filename).trim() === '') {
    return buildScreenshotFilename();
  }

  const trimmed = String(filename).trim();
  return trimmed.toLowerCase().endsWith('.png') ? trimmed : `${trimmed}.png`;
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function resolveOverlaySnapshots(canvasRect) {
  return SCREENSHOT_OVERLAYS
    .map(({ selector, anchor }) => {
      const element = document.querySelector(selector);
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        element,
        anchor,
        rect: {
          width: rect.width,
          height: rect.height,
          relLeft: rect.left - canvasRect.left,
          relTop: rect.top - canvasRect.top,
        },
      };
    })
    .filter(Boolean);
}

function resolveScreenshotLayout(cesiumCanvas, outputScale) {
  const canvasRect = cesiumCanvas.getBoundingClientRect();
  const displayWidth = canvasRect.width || cesiumCanvas.clientWidth || window.innerWidth;
  const mapScale = (cesiumCanvas.width * outputScale) / displayWidth;

  return {
    canvasRect,
    width: cesiumCanvas.width * outputScale,
    height: cesiumCanvas.height * outputScale,
    mapScale,
  };
}

function resolveOverlayDestination(rect, mapScale, anchor) {
  const baseX = rect.relLeft * mapScale;
  const baseY = rect.relTop * mapScale;
  const destW = rect.width * mapScale;
  const destH = rect.height * mapScale;

  if (anchor === 'top-left') {
    return { destX: baseX, destY: baseY, destW, destH };
  }

  return {
    destX: baseX,
    destY: baseY,
    destW,
    destH,
  };
}

async function drawDomOverlay(ctx, snapshot, mapScale) {
  const { element, rect, anchor } = snapshot;
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const { destX, destY, destW, destH } = resolveOverlayDestination(rect, mapScale, anchor);

  try {
    const captureScale = Math.max(window.devicePixelRatio || 1, mapScale);
    const overlayCanvas = await html2canvas(element, {
      scale: captureScale,
      backgroundColor: null,
      logging: false,
      useCORS: true,
    });
    ctx.drawImage(overlayCanvas, destX, destY, destW, destH);
  } catch (error) {
    console.warn('UI オーバーレイの描画に失敗しました:', element, error);
  }
}

function syncOutputContainerDom() {
  const outputContainer = document.getElementById('outputContainer');
  if (!outputContainer) {
    return;
  }

  const { lines } = getOutputDisplayContent(appState);
  outputContainer.innerHTML = renderOutputContainerHtml(lines);
}

/**
 * Cesium + 築年数スケール + 上部の施策・年度表示 の PNG を保存する。
 * UI は DOM から取得。モデル編集パネルは screenshot.css で非表示。
 *
 * @param {import('cesium').Viewer} viewer
 * @param {string} [filename] 保存ファイル名。省略時は施策・年度などから自動生成
 * @param {number} [scale=SCREENSHOT_SCALE]
 * @param {{ onBeforeCapture?: () => void | Promise<void> }} [options]
 */
export async function takeHighResScreenshot(
  viewer,
  filename,
  scale = SCREENSHOT_SCALE,
  options = {},
) {
  const { onBeforeCapture } = options;

  await waitForViewerRender(viewer);

  syncGeneralLeftStackLayout();
  await waitForDomPaint();

  const cesiumCanvas = viewer.scene.canvas;
  const layout = resolveScreenshotLayout(cesiumCanvas, scale);

  document.body.classList.add('screenshot-capture');
  try {
    await onBeforeCapture?.();
    syncOutputContainerDom();
    syncGeneralLeftStackLayout();
    await waitForDomPaint();
    document.body.offsetHeight;

    viewer.scene.render();

    const canvasRect = cesiumCanvas.getBoundingClientRect();
    const overlaySnapshots = resolveOverlaySnapshots(canvasRect);

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = layout.width;
    compositeCanvas.height = layout.height;

    const context = compositeCanvas.getContext('2d');
    context.drawImage(cesiumCanvas, 0, 0, layout.width, layout.height);

    for (const snapshot of overlaySnapshots) {
      await drawDomOverlay(context, snapshot, layout.mapScale);
    }

    const resolvedFilename = resolveScreenshotFilename(filename);
    const dataUrl = compositeCanvas.toDataURL('image/png', 1.0);
    downloadDataUrl(dataUrl, resolvedFilename);

    return { filename: resolvedFilename, dataUrl, width: layout.width, height: layout.height };
  } finally {
    document.body.classList.remove('screenshot-capture');
  }
}
