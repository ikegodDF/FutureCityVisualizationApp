/**
 * Cesium の Entity 追加・更新後、指定フレーム数だけ postRender を待つ。
 * @param {import('cesium').Viewer} viewer
 * @param {number} [frames=2]
 */
export function waitForViewerRender(viewer, frames = 2) {
  if (!viewer?.scene || frames <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let remaining = frames;

    const removeListener = viewer.scene.postRender.addEventListener(() => {
      remaining -= 1;
      if (remaining <= 0) {
        removeListener();
        resolve();
      }
    });

    viewer.scene.requestRender();
  });
}

/** DOM 更新（タイムライン等）の描画反映を待つ */
export function waitForDomPaint(frames = 2) {
  return new Promise((resolve) => {
    const step = (remaining) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(frames);
  });
}
