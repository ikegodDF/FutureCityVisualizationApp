import { Viewer } from 'cesium';

export function createViewer(containerId) {
  return new Viewer(containerId, {
    // 残す: クレジット表示、クリック時のプロパティ表示（InfoBox）
    infoBox: true,

    // 消す: CesiumデフォルトUI
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    selectionIndicator: false,
    vrButton: false,
  });
}


