import { Cartesian3, Math as CesiumMath } from 'cesium';
import { getActiveRegion } from '../region/regionState.js';

function setFreeCameraControls(viewer) {
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableLook = true;
}

function getCameraConfig(region = getActiveRegion()) {
  return region?.camera ?? {
    longitude: 141.925,
    latitude: 42.563,
    height: 500,
    twoDLongitude: 141.925,
    twoDLatitude: 42.575,
    twoDHeight: 1500,
  };
}

export function flyToRegion(viewer, region = getActiveRegion()) {
  const camera = getCameraConfig(region);
  setFreeCameraControls(viewer);
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.height),
    orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 },
    duration: 2,
  });
}

export function flyToMukawa(viewer) {
  flyToRegion(viewer);
}

export function lookDown(viewer, lon, lat, height = 2500) {
  setFreeCameraControls(viewer);
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: { heading: CesiumMath.toRadians(15), pitch: -1.4, roll: 0 },
  });
}

export function twoDView(viewer, region = getActiveRegion()) {
  const camera = getCameraConfig(region);
  const controller = viewer.scene.screenSpaceCameraController;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.enableRotate = true;
  controller.enableTilt = false;
  controller.enableLook = false;

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      camera.twoDLongitude ?? camera.longitude,
      camera.twoDLatitude ?? camera.latitude,
      camera.twoDHeight ?? 1500,
    ),
    orientation: { heading: 0, pitch: -90 * CesiumMath.PI / 180, roll: 0 },
  });
}

export function setInitialCamera(viewer, region = getActiveRegion()) {
  const camera = getCameraConfig(region);
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(camera.longitude, camera.latitude, camera.height),
    orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 },
  });
}
