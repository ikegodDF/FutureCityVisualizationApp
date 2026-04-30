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
import {
  clearActiveDraftPolygon,
  getModelName,
  isPointInPolygon,
  rebuildPersistentRangePolygons,
} from './rangeSelectVisualization.js';
import {
  appState,
  appendSelectedRange,
  getCommittedRangePolygon as getCommittedRangePolygonFromState,
  getCommittedRangeSelection as getCommittedRangeSelectionFromState,
  getSelectedRangesForYear,
  hasAnySelectedRanges,
  resetSelectedRanges,
} from '../../state/appState.js';

let activeRangeSession = null;
let persistentRangeEntities = [];
let persistentRangeViewer = null;

const collectPendingSelectionNames = (pendingRanges = []) => {
  const nameSet = new Set();
  pendingRanges.forEach((range) => {
    (range.models ?? []).forEach((modelName) => {
      if (typeof modelName === 'string' && modelName.trim()) nameSet.add(modelName);
    });
  });
  return Array.from(nameSet);
};

const setControlsVisibilityForRangeMode = (hidden, previousStates = []) => {
  const controls = document.getElementById('uiControls');
  if (!controls) return [];

  const targets = Array.from(controls.querySelectorAll('button, .edit-menu-bar'));
  if (!hidden) {
    previousStates.forEach(({ element, display }) => {
      if (element) element.style.display = display;
    });
    return [];
  }

  const states = targets.map((element) => ({ element, display: element.style.display }));
  targets.forEach((element) => {
    element.style.display = 'none';
  });
  return states;
};

const updateRangeClearButtonVisibility = () => {
  syncRangeClearButtonVisibility({
    visible: hasAnySelectedRanges(),
    onClear: clearSelectedRangeSettings,
  });
};

const rebuildPersistentRangePolygonsFromState = (viewer) => {
  const { entities, viewer: nextViewer } = rebuildPersistentRangePolygons({
    viewer,
    currentYear: appState.year,
    ranges: getSelectedRangesForYear(),
    existingEntities: persistentRangeEntities,
    existingViewer: persistentRangeViewer,
  });
  persistentRangeEntities = entities;
  persistentRangeViewer = nextViewer;
};

const clearSelectedRangeSettings = () => {
  const viewer = activeRangeSession?.viewer ?? persistentRangeViewer;
  resetSelectedRanges();

  if (viewer) {
    persistentRangeEntities.forEach((entity) => viewer.entities.remove(entity));
  }
  persistentRangeEntities = [];
  persistentRangeViewer = null;

  if (activeRangeSession) {
    const { committedPolygonEntities } = activeRangeSession;
    committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
    activeRangeSession.committedPolygonEntities = [];
    clearActiveDraftPolygon(activeRangeSession);
    activeRangeSession.pendingRanges = [];
    renderRangeSelectedList([]);
    setRangePanelStatus('選択済みの範囲設定を解除しました。');
  }

  updateRangeClearButtonVisibility();
};

const clearRangeSession = ({ preservePanel = false } = {}) => {
  if (!activeRangeSession) return;
  const {
    viewer,
    handler,
    pointEntities,
    polygonEntity,
    committedPolygonEntities,
    originalHiddenControls,
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
  setControlsVisibilityForRangeMode(false, originalHiddenControls);
  if (!preservePanel) destroyRangeSelectPanel();
};

const resetCurrentPolygon = () => {
  if (!activeRangeSession) return;
  const { viewer, committedPolygonEntities } = activeRangeSession;
  clearActiveDraftPolygon(activeRangeSession);
  committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
  activeRangeSession.committedPolygonEntities = [];
  activeRangeSession.pendingRanges = [];
  renderRangeSelectedList([]);
  setRangePanelStatus('このモード内で設定中の範囲をリセットしました。');
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
    clearActiveDraftPolygon(activeRangeSession);
    setRangePanelStatus('処理の選択がキャンセルされました。現在の範囲は保存していません。');
    return;
  }

  const { order: selectedOrder, period } = selectedOrderConfig;
  if (!period || Number(period.start) < appState.year || Number(period.end) < appState.year) {
    clearActiveDraftPolygon(activeRangeSession);
    setRangePanelStatus('現在年より前の年代は選択できません。');
    return;
  }

  activeRangeSession.pendingRanges.push({
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

  const pendingSelection = collectPendingSelectionNames(activeRangeSession.pendingRanges);
  renderRangeSelectedList(pendingSelection);
  setRangePanelStatus(`領域を追加しました。現在 ${activeRangeSession.pendingRanges.length} 領域、${pendingSelection.length} 件を一時保持しています。`);
};

const finishRangeSelectionMode = () => {
  if (!activeRangeSession) return;
  activeRangeSession.pendingRanges.forEach((range) => appendSelectedRange(range));
  rebuildPersistentRangePolygonsFromState(activeRangeSession.viewer);
  clearRangeSession();
  updateRangeClearButtonVisibility();
};

export const refreshRangeVisibility = (viewer) => {
  if (!viewer) return;
  rebuildPersistentRangePolygonsFromState(viewer);
  updateRangeClearButtonVisibility();
};

export const startRangeSelection = (viewer) => {
  if (activeRangeSession) {
    clearRangeSession();
    return;
  }

  const controller = viewer.scene.screenSpaceCameraController;
  const previousCameraFlags = {
    enableRotate: controller.enableRotate,
    enableTilt: controller.enableTilt,
    enableLook: controller.enableLook,
  };

  twoDView(viewer);
  controller.enableRotate = true;
  controller.enableTilt = false;
  controller.enableLook = false;

  const defaultHandler = viewer.cesiumWidget?.screenSpaceEventHandler;
  const defaultLeftDoubleClickAction = defaultHandler
    ? defaultHandler.getInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    : null;
  defaultHandler?.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  const originalHiddenControls = setControlsVisibilityForRangeMode(true);
  activeRangeSession = {
    viewer,
    handler,
    points: [],
    pointEntities: [],
    polygonEntity: null,
    committedPolygonEntities: [],
    pendingRanges: [],
    originalHiddenControls,
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
      Cartesian3.fromDegreesArray(activeRangeSession.points.flatMap((p) => [p.lon, p.lat])),
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
