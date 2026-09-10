import { GeoJsonDataSource, Color } from 'cesium';
import * as turf from '@turf/turf';

GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6668'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];
GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6680'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];

function createEmptyRoadData() {
  return {
    graph: {
      adjacencyList: {},
      coordinateToNodeId: new Map(),
    },
    spatial: null,
  };
}

export const addRoad = async (viewer, regionConfig) => {
  const geojsonPath = regionConfig?.road?.geojsonPath;
  if (!geojsonPath) {
    console.warn(`道路データのパスが未設定です (region: ${regionConfig?.id ?? 'unknown'})`);
    return createEmptyRoadData();
  }

  const coordinateToNodeId = new Map();
  let nodeIdCounter = 1;
  const adjacencyList = {};

  try {
    const response = await fetch(geojsonPath);
    if (!response.ok) {
      console.warn(`道路データの取得に失敗しました: ${geojsonPath} (${response.status})`);
      return createEmptyRoadData();
    }

    const rawGeoJson = await response.json();
    const roadSegments = turf.lineSegment(rawGeoJson);
    const roadBuffer = turf.buffer(rawGeoJson, 4.0, { units: 'meters' });

    const dataSource = await viewer.dataSources.add(
      await GeoJsonDataSource.load(rawGeoJson, {
        stroke: Color.YELLOW,
        strokeWidth: 1,
        clampToGround: true,
      }),
    );

    const entities = dataSource.entities.values;

    entities.forEach((entity) => {
      if (!entity.polyline) {
        return;
      }

      entity.polyline.material = Color.YELLOW;

      const rawFeature = entity.properties;
      const positions = entity.polyline.positions.getValue(viewer.clock.currentTime);

      if (positions && positions.length >= 2) {
        const startCoordStr = `${positions[0].x},${positions[0].y},${positions[0].z}`;
        const endCoordStr = `${positions[positions.length - 1].x},${positions[positions.length - 1].y},${positions[positions.length - 1].z}`;

        if (!coordinateToNodeId.has(startCoordStr)) coordinateToNodeId.set(startCoordStr, nodeIdCounter++);
        if (!coordinateToNodeId.has(endCoordStr)) coordinateToNodeId.set(endCoordStr, nodeIdCounter++);

        const startNodeId = coordinateToNodeId.get(startCoordStr);
        const endNodeId = coordinateToNodeId.get(endCoordStr);

        const properties = {};
        if (rawFeature) {
          rawFeature.propertyNames.forEach((name) => {
            properties[name] = rawFeature[name].getValue(viewer.clock.currentTime);
          });
        }

        if (!adjacencyList[startNodeId]) adjacencyList[startNodeId] = [];
        adjacencyList[startNodeId].push({
          to: endNodeId,
          properties,
          positions,
          entity,
        });

        if (!adjacencyList[endNodeId]) adjacencyList[endNodeId] = [];
        adjacencyList[endNodeId].push({
          to: startNodeId,
          properties,
          positions: [...positions].reverse(),
          entity,
        });
      }
    });

    console.log(`道路データ描画完了（${entities.length}本）: ${geojsonPath}`);

    return {
      graph: {
        adjacencyList,
        coordinateToNodeId,
      },
      spatial: {
        rawGeoJson,
        roadSegments,
        roadBuffer,
      },
    };
  } catch (error) {
    console.error(`道路データの読み込みに失敗しました (${geojsonPath}):`, error);
    return createEmptyRoadData();
  }
};
