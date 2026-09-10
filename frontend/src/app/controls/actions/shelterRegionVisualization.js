import { Cartesian3, Color, PolygonHierarchy } from 'cesium';
import { appState } from '../../state/appState.js';
import { resolveBuildingId } from '../../domain/buildings/buildingId.js';
import {
  getShelterBuildingIds,
  getShelterRegionMappings,
} from '../../state/shelters.js';
import { renew3DModels } from '../../tiles/renew3DModels.js';

const MUTED_BUILDING_COLOR = Color.fromCssColorString('#B0BEC5');

/** 避難所専用パレット（灰色・くすんだ色は使わない） */
const SHELTER_PALETTE = [
  '#E53935',
  '#1E88E5',
  '#43A047',
  '#FB8C00',
  '#8E24AA',
  '#00ACC1',
  '#FDD835',
  '#FF5722',
  '#D81B60',
  '#3949AB',
  '#00897B',
  '#C0CA33',
];

/** @type {{ active: boolean, regionEntities: import('cesium').Entity[] }} */
const visualizationState = {
  active: false,
  regionEntities: [],
};

function getCurrentResultPayloads() {
  const { appliedPolicy, year, disasterState } = appState;
  return appState.result?.[appliedPolicy]?.[year]?.[disasterState] ?? [];
}

/**
 * @returns {Record<number, import('cesium').Color>}
 */
function buildShelterColorMap() {
  const shelterIds = [...getShelterBuildingIds()].sort((a, b) => a - b);
  return Object.fromEntries(
    shelterIds.map((id, index) => [
      id,
      Color.fromCssColorString(SHELTER_PALETTE[index % SHELTER_PALETTE.length]),
    ]),
  );
}

/**
 * @param {import('@turf/turf').Feature<import('@turf/turf').Polygon>} polygonFeature
 * @returns {number[]}
 */
function turfRingToDegreesArray(polygonFeature) {
  const ring = polygonFeature?.geometry?.coordinates?.[0] ?? [];
  return ring.flatMap(([lon, lat]) => [lon, lat]);
}

function applyBuildingColorsForVisualization(viewer, colorByShelterId) {
  const shelterIdSet = new Set(Object.keys(colorByShelterId).map(Number));

  viewer.entities.values.forEach((entity) => {
    const id = resolveBuildingId(entity);
    if (id == null) {
      return;
    }

    const color = shelterIdSet.has(id)
      ? colorByShelterId[id]
      : MUTED_BUILDING_COLOR;

    if (entity.model) {
      entity.model.color = color;
      return;
    }
    if (entity.polygon) {
      entity.polygon.material = color;
      return;
    }
    if (entity.box) {
      entity.box.material = color;
    }
  });
}

function clearRegionEntities(viewer) {
  visualizationState.regionEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  visualizationState.regionEntities = [];
}

export function clearShelterRegionVisualization(viewer) {
  clearRegionEntities(viewer);
  visualizationState.active = false;

  const payloads = getCurrentResultPayloads();
  if (payloads.length > 0) {
    renew3DModels(viewer, payloads);
  }
}

export function showShelterRegionVisualization(viewer) {
  clearRegionEntities(viewer);

  const colorByShelterId = buildShelterColorMap();
  if (Object.keys(colorByShelterId).length === 0) {
    console.warn('避難所が未登録のため、色分け表示をスキップします');
    return false;
  }

  appState.shelter.colorByShelterId = Object.fromEntries(
    Object.entries(colorByShelterId).map(([id, color]) => [id, color.toCssColorString()]),
  );

  applyBuildingColorsForVisualization(viewer, colorByShelterId);

  const mappings = getShelterRegionMappings();
  for (const mapping of mappings) {
    if (mapping.shelterId == null) {
      continue;
    }

    const region = appState.blockRegions.find((item) => item.id === mapping.regionId);
    const color = colorByShelterId[mapping.shelterId];
    if (!region?.polygon || !color) {
      continue;
    }

    const degreesArray = turfRingToDegreesArray(region.polygon);
    if (degreesArray.length < 6) {
      continue;
    }

    const entity = viewer.entities.add({
      name: `${mapping.regionName} → 避難所 ${mapping.shelterId}`,
      polygon: {
        hierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(degreesArray)),
        material: color.withAlpha(0.32),
        clampToGround: true,
        outline: true,
        outlineColor: color.withAlpha(0.92),
        perPositionHeight: false,
      },
    });
    visualizationState.regionEntities.push(entity);
  }

  visualizationState.active = true;
  console.log(
    `避難所・領域の色分け表示: 避難所 ${Object.keys(colorByShelterId).length} 件 / 領域 ${visualizationState.regionEntities.length} 区画`,
  );
  return true;
}

export function refreshShelterRegionVisualization(viewer) {
  const payloads = getCurrentResultPayloads();
  if (payloads.length > 0) {
    renew3DModels(viewer, payloads);
  }
  return showShelterRegionVisualization(viewer);
}

export function isShelterRegionVisualizationActive() {
  return visualizationState.active;
}
