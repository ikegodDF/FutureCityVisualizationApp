import { appState } from '../../state/appState.js';
import { twoDView } from '../../utils/camera.js';
import {
  Cartesian3,
  Color,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  defined,
  Math as CesiumMath,
} from 'cesium';

let activeRangeSession = null;

const toHierarchyDegreesArray = (points) => points.flatMap((p) => [p.lon, p.lat]);

const isPointInPolygon = (point, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lon;
    const yi = polygon[i].lat;
    const xj = polygon[j].lon;
    const yj = polygon[j].lat;

    const intersects = ((yi > point.lat) !== (yj > point.lat))
      && (point.lon < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
};

const clearRangeSession = () => {
  if (!activeRangeSession) return;
  const { viewer, handler, pointEntities, polygonEntity } = activeRangeSession;
  if (handler && !handler.isDestroyed()) handler.destroy();
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  if (polygonEntity) viewer.entities.remove(polygonEntity);
  activeRangeSession = null;
};

const finalizeSelection = () => {
  if (!activeRangeSession) return;
  const { viewer, points } = activeRangeSession;
  if (points.length < 3) {
    console.warn('範囲選択: 点が3つ未満のため確定できません。');
    clearRangeSession();
    return;
  }

  const selectedEntities = viewer.entities.values.filter((entity) => {
    const [lat, lon] = entity?.latlon ?? [];
    if (lat == null || lon == null) return false;
    return isPointInPolygon({ lat, lon }, points);
  });

  console.log('範囲選択結果', {
    selectedCount: selectedEntities.length,
    selectedNames: selectedEntities.map((e) => e.name),
    year: appState.year,
    policy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  });

  clearRangeSession();
};

export const startRangeSelection = (viewer) => {
  // 同じボタンで ON/OFF できるようにする
  if (activeRangeSession) {
    clearRangeSession();
    console.log('範囲選択モード解除');
    return;
  }

  console.log('範囲選択モード開始', {
    year: appState.year,
    policy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  });
  twoDView(viewer);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  activeRangeSession = {
    viewer,
    handler,
    points: [],
    pointEntities: [],
    polygonEntity: null,
  };

  const addPointFromClick = (click) => {
    if (!activeRangeSession) return;
    const cartesian = viewer.camera.pickEllipsoid(click.position, viewer.scene.globe.ellipsoid);
    if (!defined(cartesian)) return;

    const asCartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian);
    const lon = CesiumMath.toDegrees(asCartographic.longitude);
    const lat = CesiumMath.toDegrees(asCartographic.latitude);

    activeRangeSession.points.push({ lon, lat });

    const pointEntity = viewer.entities.add({
      position: Cartesian3.fromDegrees(lon, lat, 0),
      point: {
        pixelSize: 8,
        color: Color.CYAN,
        outlineColor: Color.BLACK,
        outlineWidth: 1,
      },
    });
    activeRangeSession.pointEntities.push(pointEntity);

    const hierarchy = new PolygonHierarchy(
      Cartesian3.fromDegreesArray(toHierarchyDegreesArray(activeRangeSession.points)),
    );

    if (!activeRangeSession.polygonEntity && activeRangeSession.points.length >= 3) {
      activeRangeSession.polygonEntity = viewer.entities.add({
        polygon: {
          hierarchy,
          material: Color.CYAN.withAlpha(0.2),
          outline: true,
          outlineColor: Color.CYAN.withAlpha(0.9),
          perPositionHeight: false,
        },
      });
    } else if (activeRangeSession.polygonEntity) {
      activeRangeSession.polygonEntity.polygon.hierarchy = hierarchy;
    }
  };

  handler.setInputAction(addPointFromClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(finalizeSelection, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
  handler.setInputAction(finalizeSelection, ScreenSpaceEventType.RIGHT_CLICK);
};

