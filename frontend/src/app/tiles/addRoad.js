import { GeoJsonDataSource, Color, Cartesian3, Cartographic } from 'cesium';

// 座標系のエラー対策
GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6668'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];
GeoJsonDataSource.crsNames['urn:ogc:def:crs:EPSG::6680'] = GeoJsonDataSource.crsNames['urn:ogc:def:crs:OGC:1.3:CRS84'];

export const addRoad = async (viewer) => {
    // 1. 交差点（座標）にIDを振るためのマップ
    const coordinateToNodeId = new Map();
    let nodeIdCounter = 1;

    // 2. ダイクストラ用のグラフ構造（隣接リスト）
    const adjacencyList = {};

    try {
        // --- 🔷 1. CesiumにGeoJSONをロードして描画 ---
        const dataSource = await viewer.dataSources.add(
            await GeoJsonDataSource.load('/models/N13-24_6340.geojson', {
                stroke: Color.YELLOW,
                strokeWidth: 4,
                clampToGround: true
            })
        );

        // --- 🔷 2. 描画されたエンティティを巡回しつつ、ネットワーク構造を構築 ---
        const entities = dataSource.entities.values;
        
        entities.forEach((entity) => {
            // ランダム着色（粒度確認用）
            if (entity.polyline) {
                entity.polyline.material = Color.YELLOW;
            }

            // ⚠️ 描画されたEntityから元のGeoJSONのジオメトリや属性を取得する
            // CesiumがGeoJSONをパースした際のオリジナルデータにアクセスします
            const rawFeature = entity.properties;
            
            // entity.polyline.positions から座標配列を取得（CesiumのCartesian3形式）
            const positions = entity.polyline.positions.getValue(viewer.clock.currentTime);
            
            if (positions && positions.length >= 2) {
                // 始点と終点の座標を文字列化（トポロジー用）
                // ※CesiumのCartesian3を固定文字列表現にしてキーにします
                const startCoordStr = `${positions[0].x},${positions[0].y},${positions[0].z}`;
                const endCoordStr = `${positions[positions.length - 1].x},${positions[positions.length - 1].y},${positions[positions.length - 1].z}`;

                // 座標にまだIDがなければ新規発行
                if (!coordinateToNodeId.has(startCoordStr)) coordinateToNodeId.set(startCoordStr, nodeIdCounter++);
                if (!coordinateToNodeId.has(endCoordStr)) coordinateToNodeId.set(endCoordStr, nodeIdCounter++);

                const startNodeId = coordinateToNodeId.get(startCoordStr);
                const endNodeId = coordinateToNodeId.get(endCoordStr);

                // 属性情報の取得（N13_006などの幅員情報）
                // entity.propertiesから実際の値を抽出
                const properties = {};
                if (rawFeature) {
                    rawFeature.propertyNames.forEach(name => {
                        properties[name] = rawFeature[name].getValue(viewer.clock.currentTime);
                    });
                }

                // 隣接リスト（グラフ）の構築
                if (!adjacencyList[startNodeId]) adjacencyList[startNodeId] = [];
                adjacencyList[startNodeId].push({ 
                    to: endNodeId, 
                    properties: properties,
                    positions: positions,
                    entity: entity // 経路描画用にCesiumの座標群も持たせておくと便利です
                });
                
                // 双方向通行として処理
                if (!adjacencyList[endNodeId]) adjacencyList[endNodeId] = [];
                adjacencyList[endNodeId].push({ 
                    to: startNodeId, 
                    properties: properties,
                    positions: [...positions].reverse(),
                    entity: entity // 逆方向
                });
            }
        });

        console.log(`✅ 道路データ描画完了（${entities.length}本）`);
        console.log(`📐 ネットワーク構築完了: 総ノード数（交差点）: ${nodeIdCounter - 1}`);
        console.log('📦 隣接リスト（グラフ構造）:', adjacencyList);


        // あとでダイクストラ関数に渡せるように、構築したデータを返す
        return {
            adjacencyList,
            coordinateToNodeId
        };

    } catch (error) {
        console.error('道路データの読み込みまたはネットワーク構築に失敗しました:', error);
        throw error;
    }
};



/**
 * 2点間の距離（メートル）を計算するヘルパー
 */
const getDistance = (pos1, pos2) => {
    return Cartesian3.distance(pos1, pos2);
};

/**
 * 道路全体の長さ（全座標の合計距離）を計算するヘルパー
 */
const getEdgeLength = (positions) => {
    let length = 0;
    for (let i = 0; i < positions.length - 1; i++) {
        length += getDistance(positions[i], positions[i + 1]);
    }
    return length;
};

/**
 * 📌 1. ダイクストラ法アルゴリズム本体
 * @param {Object} adjacencyList - 隣接リスト（グラフ構造）
 * @param {number} startNode - 始点ノードID
 * @param {number} endNode - 終点ノードID
 * @returns {number[]} 経路となったノードIDの配列
 */
export const dijkstra = (adjacencyList, startNode, endNode) => {
    const distances = {};
    const previous = {};
    const queue = [];

    // 初期化処理
    for (const node in adjacencyList) {
        const nodeId = Number(node);
        distances[nodeId] = Infinity;
        previous[nodeId] = null;
        queue.push(nodeId);
    }
    distances[startNode] = 0;

    while (queue.length > 0) {
        // 未訪問の中で最もコスト（距離）が小さいノードを選択
        queue.sort((a, b) => distances[a] - distances[b]);
        const currentNode = queue.shift();

        // ゴールに到達した、またはこれ以上進めるノードがない場合
        if (currentNode === endNode || distances[currentNode] === Infinity) {
            break;
        }

        const neighbors = adjacencyList[currentNode] || [];
        for (const neighbor of neighbors) {
            if (!queue.includes(neighbor.to)) continue;

            // 道路の距離を移動コストとして計算
            const edgeLength = getEdgeLength(neighbor.positions);
            const alt = distances[currentNode] + edgeLength;

            // より短いルートが見つかったら更新
            if (alt < distances[neighbor.to]) {
                distances[neighbor.to] = alt;
                previous[neighbor.to] = currentNode;
            }
        }
    }

    // ゴールからスタートへ遡って経路を復元
    const path = [];
    let curr = endNode;
    while (curr !== null) {
        path.unshift(curr);
        curr = previous[curr];
    }

    // スタートとゴールが繋がっていれば経路配列を返し、繋がっていなければ空配列を返す
    return path[0] === startNode ? path : [];
};

/**
 * 指定した建物（座標）に最も近い道路のノードIDを探す
 */
const findClosestNode = (targetPos, coordinateToNodeId) => {
    let closestNodeId = -1;
    let minDistance = Infinity;

    coordinateToNodeId.forEach((nodeId, coordStr) => {
        // 文字列からX,Y,Z座標を復元
        const [x, y, z] = coordStr.split(',').map(Number);
        const nodePos = new Cartesian3(x, y, z);
        const dist = Cartesian3.distance(targetPos, nodePos);

        if (dist < minDistance) {
            minDistance = dist;
            closestNodeId = nodeId;
        }
    });

    return closestNodeId;
};

/**
 * 📌 2. 2つの建物間の最短経路を探し、Cesium上の既存道路の色を変えるメイン関数
 * @param {Viewer} viewer - CesiumのViewerインスタンス
 * @param {Object} networkData - addRoadAndBuildNetworkが返したデータ（隣接リストとマップ）
 * @param {Cartesian3} buildingAPos - 建物Aの座標
 * @param {Cartesian3} buildingBPos - 建物Bの座標
 */
export const findAndDrawRoute = (viewer, networkData, buildingAPos, buildingBPos) => {
    const { adjacencyList, coordinateToNodeId } = networkData;

    // 1. 各建物に一番近い「道路網の端点（ノード）」を見つける
    const startNode = findClosestNode(buildingAPos, coordinateToNodeId);
    const endNode = findClosestNode(buildingBPos, coordinateToNodeId);

    if (startNode === -1 || endNode === -1) {
        console.error('建物の近くに道路データが見つかりませんでした。');
        return;
    }

    console.log(`経路探索を開始します: Node ${startNode} ➡️ Node ${endNode}`);
    
    // 2. ダイクストラ法を実行
    const routeNodes = dijkstra(adjacencyList, startNode, endNode);

    if (routeNodes.length === 0) {
        console.warn('ルートが見つかりませんでした（道路が物理的に孤立しています）。');
        return;
    }

    console.log('経路の算出に成功しました！通過ノード:', routeNodes);

    // 3. 経路上の既存道路（Entity）の色と太さを変更する
    const pathEntities = [];
    
    for (let i = 0; i < routeNodes.length - 1; i++) {
        const fromNode = routeNodes[i];
        const toNode = routeNodes[i + 1];

        const edges = adjacencyList[fromNode] || [];
        const targetEdge = edges.find(e => e.to === toNode);

        if (targetEdge && targetEdge.entity) {
            const originalEntity = targetEdge.entity;
            
            if (originalEntity.polyline) {
                // 既存の線を「編集」して青色の太線にする
                originalEntity.polyline.material = Color.BLUE;
                originalEntity.polyline.width = 8;
                pathEntities.push(originalEntity);
            }
        }
    }

    // 4. 計算された経路全体が綺麗に見える位置へカメラを移動
    if (pathEntities.length > 0) {
        viewer.flyTo(pathEntities);
    }
};

/**
 * 📌 Yen's Algorithm を用いて複数の代替経路（上位K個）を探す関数
 * @param {Object} adjacencyList - 隣接リスト
 * @param {number} startNode - 始点ノード
 * @param {number} endNode - 終点ノード
 * @param {number} K - 見つけたい経路の数（例: 3）
 * @returns {number[][]} 経路（ノードID配列）の配列
 */
export const kShortestPaths = (adjacencyList, startNode, endNode, K = 3) => {
    // ディープコピーで、通行止め（エッジ削除）をシミュレートするための作業用グラフを作る
    // 各ノードの配列（エッジのリスト）だけを安全にコピーする
    const cloneGraph = () => {
        const newGraph = {};
        for (const node in adjacencyList) {
            // 配列の中身（edge）オブジェクトを新しく作り直してコピー
            newGraph[node] = adjacencyList[node].map(edge => ({
                to: edge.to,
                properties: edge.properties,
                positions: edge.positions,
                entity: edge.entity // 参照だけをコピーするので循環参照エラーにならない
            }));
    }
    return newGraph;
};

    // 第1の最短経路（通常のダイクストラ）
    const firstPath = dijkstra(adjacencyList, startNode, endNode);
    if (firstPath.length === 0) return [];

    const A = [firstPath]; // 確定した経路リスト
    const B = [];          // 候補となる経路リスト（重複除外用）

    for (let k = 1; k < K; k++) {
        const previousPath = A[k - 1];
        if (!previousPath) break;

        // 前回の経路のノードを1つずつ「分岐点」としてループ
        for (let i = 0; i < previousPath.length - 1; i++) {
            const spurNode = previousPath[i];
            const rootPath = previousPath.slice(0, i + 1);

            // 作業用にグラフをリセット
            const workingGraph = cloneGraph();

            // 1. 既存の確定経路群と重複する道路を一時的に削除（通行止め）
            A.forEach(path => {
                if (path.slice(0, i + 1).join(',') === rootPath.join(',')) {
                    const u = path[i];
                    const v = path[i + 1];
                    if (workingGraph[u]) {
                        workingGraph[u] = workingGraph[u].filter(edge => edge.to !== v);
                    }
                    if (workingGraph[v]) {
                        workingGraph[v] = workingGraph[v].filter(edge => edge.to !== u);
                    }
                }
            });

            // 2. 分岐点（spurNode）からゴールまでの新しいルートをダイクストラで計算
            const spurPath = dijkstra(workingGraph, spurNode, endNode);

            if (spurPath.length > 0) {
                // ルートパスと繋げて1つの候補経路にする
                const totalPath = [...rootPath.slice(0, -1), ...spurPath];
                
                // 候補リストBにまだなければ追加
                if (!B.some(p => p.join(',') === totalPath.join(','))) {
                    B.push(totalPath);
                }
            }
        }

        if (B.length === 0) break;

        // 候補リストBの中で、最も「総距離」が短いものを次の確定経路とする
        // （※簡易的にノード数ではなく、実際の距離でソートするのが理想ですが、ここでは選択してAに移動）
        B.sort((path1, path2) => path1.length - path2.length); // 簡易的にノードの短さでソート
        const nextBestPath = B.shift();
        A.push(nextBestPath);
    }

    return A;
};

/**
 * 📌 2地区間の「複数ルート」を同時にCesium上に色分け表示するメイン関数
 */
export const findAndDrawMultipleRoutes = (viewer, networkData, buildingAPos, buildingBPos, K = 3) => {
    const { adjacencyList, coordinateToNodeId } = networkData;

    const startNode = findClosestNode(buildingAPos, coordinateToNodeId);
    const endNode = findClosestNode(buildingBPos, coordinateToNodeId);

    if (startNode === -1 || endNode === -1) {
        console.error('近くに道路データが見つかりませんでした。');
        return;
    }

    console.log(`🔷 複数経路探索を開始 (${K}つのルート): Node ${startNode} ➡️ Node ${endNode}`);
    const routes = kShortestPaths(adjacencyList, startNode, endNode, K);

    if (routes.length === 0) {
        console.warn('経路が見つかりませんでした。');
        return;
    }

    // ルートごとの色（1番目：青、2番目：緑、3番目：紫）
    const routeColors = [Color.BLUE, Color.GREEN, Color.PURPLE, Color.ORANGE];
    const pathEntities = [];

    routes.forEach((route, routeIndex) => {
        const color = routeColors[routeIndex] || Color.CYAN;
        console.log(`➔ ルート [${routeIndex + 1}]: ノード数 ${route.length}`);

        for (let i = 0; i < route.length - 1; i++) {
            const fromNode = route[i];
            const toNode = route[i + 1];

            const edges = adjacencyList[fromNode] || [];
            const targetEdge = edges.find(e => e.to === toNode);

            if (targetEdge && targetEdge.entity) {
                const originalEntity = targetEdge.entity;
                if (originalEntity.polyline) {
                    // 既存の道路をルートの色に上書き（太さは順位ごとに少し細くすると重ね書きで見やすい）
                    originalEntity.polyline.material = color;
                    originalEntity.polyline.width = 8 - (routeIndex * 2); // 1位:8, 2位:6, 3位:4
                    pathEntities.push(originalEntity);
                }
            }
        }
    });

    // 全ての経路が収まるようにカメラを移動
    if (pathEntities.length > 0) {
        viewer.flyTo(pathEntities);
    }
};

/**
 * 道路網（隣接リスト）から行き止まり（ヒゲ状の道路）を連鎖的に除去する関数
 */
const pruneDeadEnds = (adjacencyList) => {
    // グラフの構造を作業用にコピー
    const graph = {};
    for (const node in adjacencyList) {
        graph[node] = adjacencyList[node].map(edge => ({ ...edge }));
    }

    // 次数が1以下のノード（行き止まり）を初期キューに登録
    const queue = [];
    for (const node in graph) {
        if (graph[node].length <= 1) {
            queue.push(Number(node));
        }
    }

    // キューが空になるまで連鎖的に行き止まりノード・エッジを削る
    while (queue.length > 0) {
        const deadNode = queue.shift();
        const edges = graph[deadNode] || [];

        if (edges.length === 0) {
            delete graph[deadNode];
            continue;
        }

        // 行き止まりノードから伸びている接続先ノード
        const neighborNode = edges[0].to;

        // 行き止まりノード自体を削除
        delete graph[deadNode];

        // 接続先ノード側のリストから、削除したノードへのエッジを取り除く
        if (graph[neighborNode]) {
            graph[neighborNode] = graph[neighborNode].filter(edge => edge.to !== deadNode);

            // エッジ削除の結果、接続先ノードも行き止まり（次数1以下）になったらキューに追加
            if (graph[neighborNode].length <= 1 && !queue.includes(neighborNode)) {
                queue.push(neighborNode);
            }
        }
    }

    return graph;
};

/**
 * Cartesian3 座標から 2D 平面上の角度（ラジアン）を計算する
 */
const getAngle = (fromPos, toPos) => {
    const fromCarto = Cartographic.fromCartesian(fromPos);
    const toCarto = Cartographic.fromCartesian(toPos);
    
    const dLon = toCarto.longitude - fromCarto.longitude;
    const dLat = toCarto.latitude - fromCarto.latitude;
    
    return Math.atan2(dLat, dLon);
};

/**
 * 道路網（隣接リスト）から四方を囲まれた閉領域（Polygon）の配列を抽出する
 */
export const extractEnclosedRegions = (rawAdjacencyList) => {
    // 0. 🌟 前処理：領域の内外にある「行き止まり道路（ヒゲ）」を連鎖的に削除
    const adjacencyList = pruneDeadEnds(rawAdjacencyList);

    // 1. 各ノードからの接続エッジを、角度順（反時計回り）にソートする
    const sortedGraph = {};
    
    for (const nodeId in adjacencyList) {
        const edges = adjacencyList[nodeId];
        if (edges.length < 2) continue; // 行き止まりは前処理で消えているが念のため

        const basePos = edges[0].positions[0];

        const edgesWithAngle = edges.map(edge => {
            const nextPos = edge.positions[edge.positions.length - 1];
            const angle = getAngle(basePos, nextPos);
            return { ...edge, angle };
        });

        edgesWithAngle.sort((a, b) => a.angle - b.angle);
        sortedGraph[nodeId] = edgesWithAngle;
    }

    const visitedEdges = new Set();
    const regions = [];

    // 2. すべての有向エッジを起点にして最小サイクルを探索
    for (const u in sortedGraph) {
        const fromNode = Number(u);
        const edges = sortedGraph[fromNode];

        for (const edge of edges) {
            const toNode = edge.to;
            const edgeKey = `${fromNode}->${toNode}`;

            if (visitedEdges.has(edgeKey)) continue;

            const currentPath = [fromNode];
            const polygonPositions = [];
            
            let curr = fromNode;
            let next = toNode;
            let isClosed = false;

            while (true) {
                const key = `${curr}->${next}`;
                if (visitedEdges.has(key)) break;

                visitedEdges.add(key);
                currentPath.push(next);

                const currentEdges = sortedGraph[curr];
                const activeEdge = currentEdges?.find(e => e.to === next);
                if (activeEdge) {
                    polygonPositions.push(...activeEdge.positions.slice(0, -1));
                }

                if (next === fromNode) {
                    isClosed = true;
                    break;
                }

                const nextNodeEdges = sortedGraph[next];
                if (!nextNodeEdges || nextNodeEdges.length === 0) break;

                const incomingIndex = nextNodeEdges.findIndex(e => e.to === curr);
                if (incomingIndex === -1) break;

                // 時計回りに一番近い「次のエッジ」を選択
                const nextEdgeIndex = (incomingIndex - 1 + nextNodeEdges.length) % nextNodeEdges.length;
                const nextEdge = nextNodeEdges[nextEdgeIndex];

                curr = next;
                next = nextEdge.to;

                if (currentPath.length > 500) break;
            }

            if (isClosed && polygonPositions.length >= 3) {
                polygonPositions.push(polygonPositions[0]);
                regions.push(polygonPositions);
            }
        }
    }

    console.log(`🗺️ 抽出された閉領域の数: ${regions.length} 区画`);
    return regions;
};