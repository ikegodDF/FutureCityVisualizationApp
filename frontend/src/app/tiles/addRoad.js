import { GeoJsonDataSource, Color } from 'cesium';
import * as turf from '@turf/turf'; // ★ Turf.js をインポート

GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6668'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];
GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6680'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];

export const addRoad = async (viewer) => {
    const coordinateToNodeId = new Map();
    let nodeIdCounter = 1;
    const adjacencyList = {};

    try {
        // ★ 1. 先に fetch で GeoJSON データを取得する（これで手元に生データが入る！）
        const response = await fetch('/models/mukawaroad.geojson');
        const rawGeoJson = await response.json();

        // ★ 2. 新築機能で使うための Turf.js 空間データを生成する
        const roadSegments = turf.lineSegment(rawGeoJson);
        const roadBuffer = turf.buffer(rawGeoJson, 4.5, { units: 'meters' }); // 道路幅6m + セットバック1.5m想定

        // --- 🔷 3. CesiumにGeoJSONオブジェクトを渡して描画 ---
        const dataSource = await viewer.dataSources.add(
            await GeoJsonDataSource.load(rawGeoJson, { // パスではなく読み込んだオブジェクトを渡す
                stroke: Color.YELLOW,
                strokeWidth: 1,
                clampToGround: true
            })
        );

        // --- 🔷 4. ダイクストラ用ネットワークの構築 (既存処理のまま) ---
        const entities = dataSource.entities.values;
        
        entities.forEach((entity) => {
            if (entity.polyline) {
                entity.polyline.material = Color.YELLOW;
            }

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
                    rawFeature.propertyNames.forEach(name => {
                        properties[name] = rawFeature[name].getValue(viewer.clock.currentTime);
                    });
                }

                if (!adjacencyList[startNodeId]) adjacencyList[startNodeId] = [];
                adjacencyList[startNodeId].push({ 
                    to: endNodeId, 
                    properties: properties,
                    positions: positions,
                    entity: entity 
                });
                
                if (!adjacencyList[endNodeId]) adjacencyList[endNodeId] = [];
                adjacencyList[endNodeId].push({ 
                    to: startNodeId, 
                    properties: properties,
                    positions: [...positions].reverse(),
                    entity: entity 
                });
            }
        });

        console.log(`✅ 道路データ描画完了（${entities.length}本）`);

        // ★ 5. ダイクストラ用と新築用の両方のデータを返却する
        return {
            graph: {
                adjacencyList,
                coordinateToNodeId
            },
            spatial: {
                rawGeoJson,
                roadSegments,
                roadBuffer
            }
        };

    } catch (error) {
        console.error('道路データの読み込みに失敗しました:', error);
        throw error;
    }
};