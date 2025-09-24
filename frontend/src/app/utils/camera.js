import { Cartesian3, Math as CesiumMath } from 'cesium';

export function flyToJapan(viewer) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(141.925, 42.563, 500),
    orientation: { heading: 0, pitch: -20 * CesiumMath.PI / 180, roll: 0 },
    duration: 2
  });
}

export function lookDown(viewer, lon, lat, height = 2500) {
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, height),
    orientation: { heading: CesiumMath.toRadians(15), pitch: -1.4, roll: 0 }
  });
}


