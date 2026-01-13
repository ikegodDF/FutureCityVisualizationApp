/**
 * CityGMLデータの読み込み使用例
 * 
 * このファイルは使用例を示すためのサンプルコードです。
 * 実際の使用時は、main.jsや適切な場所でインポートして使用してください。
 */

import { add3DModelsFromCityGML, add3DModelsFromCityGMLContent } from './add3DModels.js';

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

/**
 * 使用例4: ファイル内容を直接指定する
 */
export async function exampleLoadFromContent(viewer, cityGmlFileContent) {
  // ファイル選択などで取得したCityGMLの内容を直接パース
  const models = await add3DModelsFromCityGMLContent(viewer, cityGmlFileContent, {
    gltfBasePath: '/models/citygml/',
    useGeometry: false
  });
  
  return models;
}

/**
 * 使用例5: ファイル選択ダイアログからCityGMLを読み込む
 */
export function exampleLoadFromFileInput(viewer) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.gml,.xml';
  input.onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const cityGmlContent = e.target.result;
        const models = await add3DModelsFromCityGMLContent(viewer, cityGmlContent, {
          useGeometry: true // GLTFファイルがない場合はジオメトリを使用
        });
        console.log(`${models.length}件の建物を読み込みました`);
      } catch (error) {
        console.error('CityGMLファイルの読み込みに失敗しました:', error);
        alert('CityGMLファイルの読み込みに失敗しました: ' + error.message);
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

