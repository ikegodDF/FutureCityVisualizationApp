import {
  appState,
  appendSelectedRange,
  getCommittedRangePolygon as getCommittedRangePolygonFromState,
  getCommittedRangeSelection as getCommittedRangeSelectionFromState,
  getSelectedRangesForYear,
  hasAnySelectedRanges,
  resetSelectedRanges,
} from '../../state/appState.js';
import {
  bindRangeSelectPanelActions,
  destroyRangeSelectPanel,
  ensureRangeSelectPanel,
  renderRangeSelectedList,
  setRangePanelStatus,
  updateRangeClearButtonVisibility as syncRangeClearButtonVisibility,
} from '../components/shared/rangeSelect/rangeSelectPanel.js';
import { openRangeOrderModal } from '../components/shared/rangeSelect/rangeOrderModal.js';
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
let persistentRangeEntities = [];
let persistentRangeViewer = null;
const RANGE_POLYGON_BASE_HEIGHT = 0;
const RANGE_POLYGON_EXTRUDED_HEIGHT = 30;
const RANGE_POLYGON_LAYER_COUNT = 14;
const RANGE_ORDER_COLORS = {
  1: Color.fromCssColorString('#B388FF'),
  2: Color.fromCssColorString('#00E5FF'),
  3: Color.fromCssColorString('#FF4FD8'),
};

const toHierarchyDegreesArray = (points) => points.flatMap((p) => [p.lon, p.lat]);

const getModelName = (entity, index) => (
  entity?.name
  ?? entity?.id
  ?? entity?.properties?.name?.getValue?.()
  ?? `建物 ${index + 1}`
);

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

const hasSelectedRanges = () => hasAnySelectedRanges();

const clearSelectedRangeSettings = () => {
  const viewer = activeRangeSession?.viewer ?? persistentRangeViewer;

  resetSelectedRanges();

  if (viewer) {
    persistentRangeEntities.forEach((entity) => viewer.entities.remove(entity));
  }
  persistentRangeEntities = [];
  persistentRangeViewer = null;
  console.log("範囲選択解除", appState)

  if (activeRangeSession) {
    const { viewer, committedPolygonEntities } = activeRangeSession;
    committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
    activeRangeSession.committedPolygonEntities = [];
    clearActiveDraftPolygon();
    renderRangeSelectedList([]);
    setRangePanelStatus('選択済みの範囲設定を解除しました。');
  }

  updateRangeClearButtonVisibility();

};

const updateRangeClearButtonVisibility = () => {
  syncRangeClearButtonVisibility({
    visible: hasSelectedRanges(),
    onClear: clearSelectedRangeSettings,
  });
};

const clearCommittedSelection = () => {
  resetSelectedRanges();
  const viewer = activeRangeSession?.viewer ?? persistentRangeViewer;
  if (viewer) {
    persistentRangeEntities.forEach((entity) => viewer.entities.remove(entity));
  }
  persistentRangeEntities = [];
  persistentRangeViewer = null;
  updateRangeClearButtonVisibility();
};

const clearActiveDraftPolygon = () => {
  if (!activeRangeSession) return;
  const { viewer, pointEntities, polygonEntity } = activeRangeSession;
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  activeRangeSession.pointEntities = [];
  activeRangeSession.points = [];
  if (polygonEntity) {
    viewer.entities.remove(polygonEntity);
    activeRangeSession.polygonEntity = null;
  }
};

const clearRangeSession = ({ preservePanel = false } = {}) => {
  if (!activeRangeSession) return;
  const {
    viewer,
    handler,
    pointEntities,
    polygonEntity,
    committedPolygonEntities,
    previousCameraFlags,
    defaultLeftDoubleClickAction,
  } = activeRangeSession;
  if (handler && !handler.isDestroyed()) handler.destroy();
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  if (polygonEntity) viewer.entities.remove(polygonEntity);
  committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));

  if (previousCameraFlags) {
    const controller = viewer.scene.screenSpaceCameraController;
    controller.enableRotate = previousCameraFlags.enableRotate;
    controller.enableTilt = previousCameraFlags.enableTilt;
    controller.enableLook = previousCameraFlags.enableLook;
  }

  const defaultHandler = viewer.cesiumWidget?.screenSpaceEventHandler;
  if (defaultHandler) {
    if (defaultLeftDoubleClickAction) {
      defaultHandler.setInputAction(defaultLeftDoubleClickAction, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    } else {
      defaultHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
  }

  activeRangeSession = null;
  if (!preservePanel) destroyRangeSelectPanel();
};

const getRangeColorByOrder = (order) => RANGE_ORDER_COLORS[order] ?? Color.fromCssColorString('#B388FF');

const createPersistentRangeFlatPolygon = (viewer, points, order) => {
  const hierarchy = new PolygonHierarchy(
    Cartesian3.fromDegreesArray(toHierarchyDegreesArray(points)),
  );
  const rangeColor = getRangeColorByOrder(order);

  return viewer.entities.add({
    polygon: {
      hierarchy,
      material: rangeColor.withAlpha(0.28),
      outline: true,
      outlineColor: rangeColor.withAlpha(0.95),
      height: RANGE_POLYGON_BASE_HEIGHT,
      perPositionHeight: false,
    },
  });
};

const createPersistentRangePolygon = (viewer, points, order) => {
  const hierarchy = new PolygonHierarchy(
    Cartesian3.fromDegreesArray(toHierarchyDegreesArray(points)),
  );
  const rangeColor = getRangeColorByOrder(order);

  const layerHeight = (RANGE_POLYGON_EXTRUDED_HEIGHT - RANGE_POLYGON_BASE_HEIGHT) / RANGE_POLYGON_LAYER_COUNT;
  const entities = [];

  for (let i = 0; i < RANGE_POLYGON_LAYER_COUNT; i += 1) {
    const layerBottom = RANGE_POLYGON_BASE_HEIGHT + layerHeight * i;
    const layerTop = layerBottom + layerHeight;
    // 上に行くほど透明になるように段ごとにアルファを下げる
    const alpha = 0.9 * (1 - (i / (RANGE_POLYGON_LAYER_COUNT - 1 || 1)));

    entities.push(viewer.entities.add({
      polygon: {
        hierarchy,
        material: rangeColor.withAlpha(Math.max(0, alpha)),
        outline: false,
        closeTop: false,
        closeBottom: false,
        height: layerBottom,
        extrudedHeight: layerTop,
        perPositionHeight: false,
      },
    }));
  }

  return entities;
};

const rebuildPersistentRangePolygonsFromState = (viewer) => {
  const removeTargetViewer = persistentRangeViewer ?? viewer;
  persistentRangeEntities.forEach((entity) => removeTargetViewer.entities.remove(entity));
  persistentRangeEntities = [];
  persistentRangeViewer = null;

  getSelectedRangesForYear().forEach((range) => {
    const polygonPoints = range.polygon ?? [];
    const startYear = Number(range?.period?.start);
    const isStartYearRange = Number.isFinite(startYear) && startYear === appState.year;

    if (isStartYearRange) {
      const flatEntity = createPersistentRangeFlatPolygon(viewer, polygonPoints, range.order);
      persistentRangeEntities.push(flatEntity);
      return;
    }

    const entities = createPersistentRangePolygon(viewer, polygonPoints, range.order);
    persistentRangeEntities.push(...entities);
  });
  if (persistentRangeEntities.length > 0) {
    persistentRangeViewer = viewer;
  }
};

export const refreshRangeVisibility = (viewer) => {
  if (!viewer) return;
  rebuildPersistentRangePolygonsFromState(viewer);
  updateRangeClearButtonVisibility();
};

const resetCurrentPolygon = () => {
  if (!activeRangeSession) return;
  const {
    viewer,
    committedPolygonEntities,
  } = activeRangeSession;
  clearActiveDraftPolygon();
  committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
  activeRangeSession.committedPolygonEntities = [];
  clearCommittedSelection();
  renderRangeSelectedList([]);
  setRangePanelStatus('選択範囲と選択建物をリセットしました。クリックして点を打ち直してください。');
};

const finalizeCurrentPolygon = async () => {
  if (!activeRangeSession) return;
  const { points, viewer } = activeRangeSession;
  if (points.length < 3) {
    setRangePanelStatus('点が3つ未満のため確定できません。3点以上を選択してください。');
    return;
  }

  const selectedEntities = viewer.entities.values.filter((entity) => {
    const [lat, lon] = entity?.latlon ?? [];
    if (lat == null || lon == null) return false;
    return isPointInPolygon({ lat, lon }, points);
  });

  const polygonPoints = points.map((point) => ({ ...point }));
  const selectedModelNames = selectedEntities.map((entity, index) => getModelName(entity, index));
  const selectedOrderConfig = await openRangeOrderModal({ currentYear: appState.year });
  if (selectedOrderConfig == null) {
    clearActiveDraftPolygon();
    setRangePanelStatus('処理の選択がキャンセルされました。現在の範囲は保存していません。');
    return;
  }
  const { order: selectedOrder, period } = selectedOrderConfig;
  appendSelectedRange({
    polygon: polygonPoints,
    models: selectedModelNames,
    order: selectedOrder,
    period,
  });

  activeRangeSession.pointEntities.forEach((entity) => viewer.entities.remove(entity));
  if (activeRangeSession.polygonEntity) {
    activeRangeSession.polygonEntity.polygon.material = Color.CYAN.withAlpha(0.12);
    activeRangeSession.polygonEntity.polygon.outlineColor = Color.CYAN.withAlpha(0.55);
    activeRangeSession.committedPolygonEntities.push(activeRangeSession.polygonEntity);
    activeRangeSession.polygonEntity = null;
  }

  activeRangeSession.pointEntities = [];
  activeRangeSession.points = [];

  const committedRangePolygon = getCommittedRangePolygonFromState();
  const committedRangeSelection = getCommittedRangeSelectionFromState();
  renderRangeSelectedList(committedRangeSelection);
  setRangePanelStatus(`領域を追加しました。現在 ${committedRangePolygon.length} 領域、${committedRangeSelection.length} 件の建物を保持しています。`);
  updateRangeClearButtonVisibility();

  console.log('範囲選択結果', {
    selectedCountInCurrentPolygon: selectedEntities.length,
    selectedCount: committedRangeSelection.length,
    polygonCount: committedRangePolygon.length,
    order: selectedOrder,
    period,
    selectedNames: selectedModelNames,
    year: appState.year,
    policy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  });
  console.log(appState)
};

const finishRangeSelectionMode = () => {
  if (!activeRangeSession) return;
  rebuildPersistentRangePolygonsFromState(activeRangeSession.viewer);
  clearRangeSession();
  updateRangeClearButtonVisibility();
};

export const startRangeSelection = (viewer) => {
  if (activeRangeSession) {
    clearRangeSession();
    return;
  }

  console.log('範囲選択モード開始', {
    year: appState.year,
    policy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  });
  const controller = viewer.scene.screenSpaceCameraController;
  const previousCameraFlags = {
    enableRotate: controller.enableRotate,
    enableTilt: controller.enableTilt,
    enableLook: controller.enableLook,
  };

  twoDView(viewer);

  // 範囲選択モード中は上空固定を維持しつつ、横移動は許可する
  controller.enableRotate = true;
  controller.enableTilt = false;
  controller.enableLook = false;

  const defaultHandler = viewer.cesiumWidget?.screenSpaceEventHandler;
  const defaultLeftDoubleClickAction = defaultHandler
    ? defaultHandler.getInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    : null;
  defaultHandler?.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  activeRangeSession = {
    viewer,
    handler,
    points: [],
    pointEntities: [],
    polygonEntity: null,
    committedPolygonEntities: [],
    previousCameraFlags,
    defaultLeftDoubleClickAction,
  };

  ensureRangeSelectPanel();
  bindRangeSelectPanelActions({ onReset: resetCurrentPolygon, onFinish: finishRangeSelectionMode });
  renderRangeSelectedList([]);
  setRangePanelStatus('範囲選択モードです。地図をクリックして点を追加し、ダブルクリックで1領域を確定します。');
  updateRangeClearButtonVisibility();

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

    setRangePanelStatus(`点を ${activeRangeSession.points.length} 個追加しました。`);
  };

  handler.setInputAction(addPointFromClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(finalizeCurrentPolygon, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
};

export const getCommittedRangeSelection = () => getCommittedRangeSelectionFromState();
export const getCommittedRangePolygon = () => getCommittedRangePolygonFromState();

