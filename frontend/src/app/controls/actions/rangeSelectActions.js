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
let committedRangeSelection = [];
let committedRangePolygon = [];

const RANGE_PANEL_ID = 'rangeSelectPanel';

const toHierarchyDegreesArray = (points) => points.flatMap((p) => [p.lon, p.lat]);

const getSelectedBuildingLabel = (entity, index) => (
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

const getRangeSelectPanel = () => document.getElementById(RANGE_PANEL_ID);

const ensureRangeSelectPanel = () => {
  const existing = getRangeSelectPanel();
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = RANGE_PANEL_ID;
  panel.className = 'range-select-panel';
  panel.innerHTML = `
    <div class="range-select-title">範囲選択</div>
    <div class="range-select-status"></div>
    <div class="range-select-actions">
      <button type="button" data-role="reset">リセット</button>
      <button type="button" data-role="finish">終了</button>
    </div>
    <div class="range-select-list-title">選択建物</div>
    <ol class="range-select-list"></ol>
  `;
  document.body.appendChild(panel);
  return panel;
};

const setPanelStatus = (message) => {
  const panel = ensureRangeSelectPanel();
  const status = panel.querySelector('.range-select-status');
  if (status) status.textContent = message;
};

const renderSelectedList = (entities = committedRangeSelection) => {
  const panel = ensureRangeSelectPanel();
  const list = panel.querySelector('.range-select-list');
  if (!list) return;

  list.innerHTML = '';

  if (!entities.length) {
    const empty = document.createElement('li');
    empty.textContent = 'まだ建物は選択されていません。';
    list.appendChild(empty);
    return;
  }

  entities.forEach((entity, index) => {
    const item = document.createElement('li');
    item.textContent = getSelectedBuildingLabel(entity, index);
    list.appendChild(item);
  });
};

const destroyPanel = () => {
  getRangeSelectPanel()?.remove();
};

const clearCommittedSelection = () => {
  committedRangeSelection = [];
  committedRangePolygon = [];
};

const clearRangeSession = ({ preservePanel = false } = {}) => {
  if (!activeRangeSession) return;
  const {
    viewer,
    handler,
    pointEntities,
    polygonEntity,
    committedPolygonEntities,
  } = activeRangeSession;
  if (handler && !handler.isDestroyed()) handler.destroy();
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  if (polygonEntity) viewer.entities.remove(polygonEntity);
  committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
  activeRangeSession = null;
  if (!preservePanel) destroyPanel();
};

const resetCurrentPolygon = () => {
  if (!activeRangeSession) return;
  const {
    viewer,
    pointEntities,
    polygonEntity,
    committedPolygonEntities,
  } = activeRangeSession;
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  committedPolygonEntities.forEach((entity) => viewer.entities.remove(entity));
  activeRangeSession.pointEntities = [];
  activeRangeSession.points = [];
  activeRangeSession.committedPolygonEntities = [];
  if (polygonEntity) {
    viewer.entities.remove(polygonEntity);
    activeRangeSession.polygonEntity = null;
  }
  clearCommittedSelection();
  renderSelectedList([]);
  setPanelStatus('選択範囲と選択建物をリセットしました。クリックして点を打ち直してください。');
};

const finalizeCurrentPolygon = () => {
  if (!activeRangeSession) return;
  const { points, viewer } = activeRangeSession;
  if (points.length < 3) {
    setPanelStatus('点が3つ未満のため確定できません。3点以上を選択してください。');
    return;
  }

  const selectedEntities = viewer.entities.values.filter((entity) => {
    const [lat, lon] = entity?.latlon ?? [];
    if (lat == null || lon == null) return false;
    return isPointInPolygon({ lat, lon }, points);
  });

  const polygonPoints = points.map((point) => ({ ...point }));
  committedRangePolygon.push(polygonPoints);

  const selectionMap = new Map(
    committedRangeSelection.map((entity, index) => [entity?.id ?? `index-${index}`, entity]),
  );
  selectedEntities.forEach((entity, index) => {
    selectionMap.set(entity?.id ?? `selected-${index}`, entity);
  });
  committedRangeSelection = Array.from(selectionMap.values());

  activeRangeSession.pointEntities.forEach((entity) => viewer.entities.remove(entity));

  if (activeRangeSession.polygonEntity) {
    activeRangeSession.polygonEntity.polygon.material = Color.CYAN.withAlpha(0.12);
    activeRangeSession.polygonEntity.polygon.outlineColor = Color.CYAN.withAlpha(0.55);
    activeRangeSession.committedPolygonEntities.push(activeRangeSession.polygonEntity);
    activeRangeSession.polygonEntity = null;
  }

  activeRangeSession.pointEntities = [];
  activeRangeSession.points = [];

  renderSelectedList(committedRangeSelection);
  setPanelStatus(`領域を追加しました。現在 ${committedRangePolygon.length} 領域、${committedRangeSelection.length} 件の建物を保持しています。`);

  console.log('範囲選択結果', {
    selectedCountInCurrentPolygon: selectedEntities.length,
    selectedCount: committedRangeSelection.length,
    polygonCount: committedRangePolygon.length,
    selectedNames: selectedEntities.map((e) => e.name),
    year: appState.year,
    policy: appState.appliedPolicy,
    disasterState: appState.disasterState,
  });
};

const finishRangeSelectionMode = () => {
  if (!activeRangeSession) return;
  clearRangeSession();
};

export const startRangeSelection = (viewer) => {
  if (activeRangeSession) {
    clearRangeSession();
    return;
  }

  clearCommittedSelection();

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
    committedPolygonEntities: [],
  };

  const panel = ensureRangeSelectPanel();
  const resetButton = panel.querySelector('[data-role="reset"]');
  const finishButton = panel.querySelector('[data-role="finish"]');
  if (resetButton) resetButton.onclick = resetCurrentPolygon;
  if (finishButton) finishButton.onclick = finishRangeSelectionMode;
  renderSelectedList([]);
  setPanelStatus('範囲選択モードです。地図をクリックして点を追加し、ダブルクリックで1領域を確定します。');

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

    setPanelStatus(`点を ${activeRangeSession.points.length} 個追加しました。`);
  };

  handler.setInputAction(addPointFromClick, ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(finalizeCurrentPolygon, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
};

export const getCommittedRangeSelection = () => committedRangeSelection;
export const getCommittedRangePolygon = () => committedRangePolygon;

