import { Cartesian3, Math as CesiumMath } from 'cesium';

function setFreeCameraControls(viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableLook = true;
}

export function flyToMukawa(viewer) {
  setFreeCameraControls(viewer);
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(141.925, 42.563, 500),
    orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 },
    duration: 2
  });
}

export function lookDown(viewer, lon, lat, height = 2500) {
  setFreeCameraControls(viewer);
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: { heading: CesiumMath.toRadians(15), pitch: -1.4, roll: 0 }
  });
}

export function twoDView(viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = false;
  controller.enableLook = false;

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(141.925, 42.575, 1500),
    orientation: { heading: 0, pitch: -90 * CesiumMath.PI / 180, roll: 0 }
  });
}

