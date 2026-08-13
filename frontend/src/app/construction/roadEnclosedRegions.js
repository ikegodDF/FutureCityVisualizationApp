import { Cartographic } from 'cesium';

/**
 * 道路協会 GeoJSON から構築した隣接リストから、
 * 四方を道路で囲まれた閉領域（街区ポリゴン）を抽出する。
 * feature/road ブランチの extractEnclosedRegions をベースにしている。
 */

function pruneDeadEnds(adjacencyList) {
  const graph = {};
  for (const node in adjacencyList) {
    graph[node] = adjacencyList[node].map((edge) => ({ ...edge }));
  }

  const queue = [];
  for (const node in graph) {
    if (graph[node].length <= 1) {
      queue.push(Number(node));
    }
  }

  while (queue.length > 0) {
    const deadNode = queue.shift();
    const edges = graph[deadNode] || [];

    if (edges.length === 0) {
      delete graph[deadNode];
      continue;
    }

    const neighborNode = edges[0].to;
    delete graph[deadNode];

    if (graph[neighborNode]) {
      graph[neighborNode] = graph[neighborNode].filter((edge) => edge.to !== deadNode);

      if (graph[neighborNode].length <= 1 && !queue.includes(neighborNode)) {
        queue.push(neighborNode);
      }
    }
  }

  return graph;
}

function getAngle(fromPos, toPos) {
  const fromCarto = Cartographic.fromCartesian(fromPos);
  const toCarto = Cartographic.fromCartesian(toPos);

  const dLon = toCarto.longitude - fromCarto.longitude;
  const dLat = toCarto.latitude - fromCarto.latitude;

  return Math.atan2(dLat, dLon);
}

/**
 * @param {Record<string, Array<{ to: number, positions: import('cesium').Cartesian3[] }>>} rawAdjacencyList
 * @returns {import('cesium').Cartesian3[][]}
 */
export function extractEnclosedRegions(rawAdjacencyList) {
  const adjacencyList = pruneDeadEnds(rawAdjacencyList);
  const sortedGraph = {};

  for (const nodeId in adjacencyList) {
    const edges = adjacencyList[nodeId];
    if (edges.length < 2) {
      continue;
    }

    const basePos = edges[0].positions[0];
    const edgesWithAngle = edges.map((edge) => {
      const nextPos = edge.positions[edge.positions.length - 1];
      const angle = getAngle(basePos, nextPos);
      return { ...edge, angle };
    });

    edgesWithAngle.sort((a, b) => a.angle - b.angle);
    sortedGraph[nodeId] = edgesWithAngle;
  }

  const visitedEdges = new Set();
  const regions = [];

  for (const u in sortedGraph) {
    const fromNode = Number(u);
    const edges = sortedGraph[fromNode];

    for (const edge of edges) {
      const toNode = edge.to;
      const edgeKey = `${fromNode}->${toNode}`;

      if (visitedEdges.has(edgeKey)) {
        continue;
      }

      const polygonPositions = [];
      let curr = fromNode;
      let next = toNode;
      let isClosed = false;

      while (true) {
        const key = `${curr}->${next}`;
        if (visitedEdges.has(key)) {
          break;
        }

        visitedEdges.add(key);

        const currentEdges = sortedGraph[curr];
        const activeEdge = currentEdges?.find((item) => item.to === next);
        if (activeEdge) {
          polygonPositions.push(...activeEdge.positions.slice(0, -1));
        }

        if (next === fromNode) {
          isClosed = true;
          break;
        }

        const nextNodeEdges = sortedGraph[next];
        if (!nextNodeEdges || nextNodeEdges.length === 0) {
          break;
        }

        const incomingIndex = nextNodeEdges.findIndex((item) => item.to === curr);
        if (incomingIndex === -1) {
          break;
        }

        const nextEdgeIndex = (incomingIndex - 1 + nextNodeEdges.length) % nextNodeEdges.length;
        const nextEdge = nextNodeEdges[nextEdgeIndex];

        curr = next;
        next = nextEdge.to;

        if (polygonPositions.length > 5000) {
          break;
        }
      }

      if (isClosed && polygonPositions.length >= 3) {
        polygonPositions.push(polygonPositions[0]);
        regions.push(polygonPositions);
      }
    }
  }

  console.log(`道路協会データから抽出した閉領域: ${regions.length} 区画`);
  return regions;
}
