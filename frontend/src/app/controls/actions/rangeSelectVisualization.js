import { Cartesian3, Color, PolygonHierarchy } from 'cesium';

const RANGE_POLYGON_BASE_HEIGHT = 0;
const RANGE_POLYGON_EXTRUDED_HEIGHT = 30;
const RANGE_POLYGON_LAYER_COUNT = 14;
const RANGE_ORDER_COLORS = {
  1: Color.fromCssColorString('#B388FF'),
  2: Color.fromCssColorString('#00E5FF'),
  3: Color.fromCssColorString('#FF4FD8'),
};

const toHierarchyDegreesArray = (points) => points.flatMap((p) => [p.lon, p.lat]);

export const getModelName = (entity, index) => (
  entity?.name
  ?? entity?.id
  ?? entity?.properties?.name?.getValue?.()
  ?? `建物 ${index + 1}`
);

export const isPointInPolygon = (point, polygon) => {
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

export const clearActiveDraftPolygon = (session) => {
  if (!session) return;
  const { viewer, pointEntities, polygonEntity } = session;
  pointEntities.forEach((entity) => viewer.entities.remove(entity));
  session.pointEntities = [];
  session.points = [];
  if (polygonEntity) {
    viewer.entities.remove(polygonEntity);
    session.polygonEntity = null;
  }
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

export const rebuildPersistentRangePolygons = ({
  viewer,
  currentYear,
  ranges,
  existingEntities,
  existingViewer,
}) => {
  const removeTargetViewer = existingViewer ?? viewer;
  existingEntities.forEach((entity) => removeTargetViewer.entities.remove(entity));

  const nextEntities = [];
  ranges.forEach((range) => {
    const polygonPoints = range.polygon ?? [];
    const startYear = Number(range?.period?.start);
    const isStartYearRange = Number.isFinite(startYear) && startYear === currentYear;

    if (isStartYearRange) {
      const flatEntity = createPersistentRangeFlatPolygon(viewer, polygonPoints, range.order);
      nextEntities.push(flatEntity);
      return;
    }

    const entities = createPersistentRangePolygon(viewer, polygonPoints, range.order);
    nextEntities.push(...entities);
  });

  return {
    entities: nextEntities,
    viewer: nextEntities.length > 0 ? viewer : null,
  };
};
