/**
 * CityGMLデータの読み込み使用例
 * 
 * このファイルは使用例を示すためのサンプルコードです。
 * 実際の使用時は、main.jsや適切な場所でインポートして使用してください。
 */

import { add3DModelsFromCityGML } from './addCityGmlModels.js';

/**
 * 使用例1: URLからCityGMLファイルを読み込む
 */
export async function exampleLoadFromURL(viewer) {
  // 単一のCityGMLファイルを読み込む
  const models = await add3DModelsFromCityGML(viewer, '/data/citygml/buildings.gml');
  
  // 複数のCityGMLファイルを読み込む
  const models2 = await add3DModelsFromCityGML(viewer, [
    '/data/citygml/buildings_part1.gml',
    '/data/citygml/buildings_part2.gml',
    '/data/citygml/buildings_part3.gml'
  ]);
  
  return models;
}

/**
 * 使用例2: GLTFファイルのパスをカスタマイズする
 */
export async function exampleWithCustomGLTFPath(viewer) {
  const models = await add3DModelsFromCityGML(viewer, '/data/citygml/buildings.gml', {
    gltfBasePath: '/models/plateau/', // GLTFファイルのベースパス
    idMapper: (buildingId, building) => {
      // カスタムIDマッパー: CityGMLのIDをGLTFファイル名に変換
      // 例: "bldg_12345" -> "/models/plateau/bldg_12345/model.gltf"
      return `/models/plateau/${buildingId}/model.gltf`;
    }
  });
  
  return models;
}

/**
 * 使用例3: CityGMLのジオメトリを直接使用する（GLTFファイルなし）
 */
export async function exampleUseGeometry(viewer) {
  const models = await add3DModelsFromCityGML(viewer, '/data/citygml/buildings.gml', {
    useGeometry: true // CityGMLのジオメトリを直接使用（簡易的なBoxで表示）
  });
  
  return models;
}

