/**
 * 札幌のCityGMLファイルを読み込むためのヘルパー関数
 */

import { add3DModelsFromCityGML } from './addCityGmlModels.js';

// 読み込むCityGMLディレクトリ名はここで一括定義
const CITY_GML_DIR = 'sapporo_cityGML';
const BASE_PATH = `/models/${CITY_GML_DIR}/`;

/**
 * メッシュコードからGMLファイル名を生成
 * ファイル名形式: {メッシュコード}_bldg_6697_op.gml
 * @param {string} meshCode - 第3次メッシュコード
 * @returns {string} - GMLファイル名
 */
function generateGMLFileName(meshCode) {
  return `${meshCode}_bldg_6697_op.gml`;
}

/**
 * バックエンドAPIからGMLファイルのリストを取得（旧方式・コメントアウト）
 * @param {string} directory - ディレクトリ名（デフォルト: CITY_GML_DIR）
 * @returns {Promise<Array<string>>} - GMLファイル名の配列
 */
/*
export async function getAllGMLFileNames(directory = CITY_GML_DIR) {
  try {
    // バックエンドAPIからファイルリストを取得
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/api/v1/files/gml?directory=${directory}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    const fileNames = await response.json();
    console.log(`${fileNames.length}件のGMLファイルを検出しました`);
    return fileNames;
  } catch (error) {
    console.error('ファイルリストの取得に失敗しました:', error);
    // APIが利用できない場合は空配列を返す
    return [];
  }
}
*/

/**
 * JSONファイルからメッシュコードを読み込んでGMLファイル名のリストを生成
 * @param {string} jsonPath - JSONファイルのパス（例: /models/json/shiroishi.json）
 * @returns {Promise<Array<string>>} - GMLファイル名の配列
 */
export async function getGMLFileNamesFromJSON(jsonPath) {
  try {
    const response = await fetch(jsonPath);
    if (!response.ok) {
      throw new Error(`JSONファイルの読み込みに失敗: ${response.statusText}`);
    }
    
    const data = await response.json();
    const meshCodes = data.mesh_codes || [];
    
    if (meshCodes.length === 0) {
      console.warn('メッシュコードが見つかりませんでした');
      return [];
    }
    
    // メッシュコードからGMLファイル名を生成
    const fileNames = meshCodes.map(meshCode => generateGMLFileName(meshCode));
    console.log(`${meshCodes.length}件のメッシュコードから${fileNames.length}件のGMLファイル名を生成しました`);
    console.log(`対象地域: ${data.city || '不明'}`);
    
    return fileNames;
  } catch (error) {
    console.error('JSONファイルの読み込みエラー:', error);
    return [];
  }
}

/**
 * すべてのGMLファイルを読み込む
 * @param {Object} viewer - Cesium viewerインスタンス
 * @param {Object} options - オプション
 * @param {number} options.batchSize - バッチサイズ（デフォルト: 100）
 * @param {string} options.jsonPath - メッシュコードを含むJSONファイルのパス（例: /models/json/shiroishi.json）
 * @param {number} options.sampleRate - サンプリング率（0.0-1.0、デフォルト: 1.0 = 100%）
 * @param {boolean} options.useGeometry - CityGMLのジオメトリを直接使用するか（デフォルト: true）
 * @param {Function} options.onProgress - 進捗コールバック関数
 * @returns {Promise<Array>} - 読み込まれたモデルの配列
 */
export async function loadAllSapporoCityGML(viewer, options = {}) {
  const {
    batchSize = 100,
    useGeometry = true, // CityGMLのジオメトリを直接使用（GLTFファイルがないため）
    jsonPath = '/models/json/shiroishi.json', // デフォルトは白石区
    sampleRate = 0.3, // デフォルトは100%（すべて読み込む）
    onProgress = null
  } = options;
  
  // JSONファイルからメッシュコードを読み込んでGMLファイル名を生成
  const allFileNames = await getGMLFileNamesFromJSON(jsonPath);
  
  // 旧方式: バックエンドAPIから取得する場合（コメントアウト）
  // const allFileNames = await getAllGMLFileNames(directory);
  
  if (allFileNames.length === 0) {
    console.warn('GMLファイルが見つかりませんでした');
    return [];
  }
  
  // サンプリング処理（何%に絞るか）
  const fileCount = Math.max(1, Math.floor(allFileNames.length * sampleRate));
  
  let fileNames;
  // 無作為に抽出する場合
  if (sampleRate < 1.0) {
    const shuffled = [...allFileNames].sort(() => Math.random() - 0.5);
    fileNames = shuffled.slice(0, fileCount);
    console.log(`${allFileNames.length}件のGMLファイルから${fileNames.length}件（約${(sampleRate * 100).toFixed(0)}%）を読み込みます`);
  } else {
    // すべて読み込む場合
    fileNames = allFileNames;
    console.log(`${allFileNames.length}件のGMLファイルから${fileNames.length}件を読み込みます`);
  }
  
  const allModels = [];
  const totalFiles = fileNames.length;
  
  // バッチ処理で読み込む
  for (let i = 0; i < fileNames.length; i += batchSize) {
    const batch = fileNames.slice(i, i + batchSize);
    const urls = batch.map(fileName => `${BASE_PATH}${fileName}`);
    
    try {
      if (onProgress) {
        onProgress(Math.min(i + batchSize, totalFiles), totalFiles);
      }
      
      const models = await add3DModelsFromCityGML(viewer, urls, {
        useGeometry: useGeometry,
        gltfBasePath: BASE_PATH
      });
      
      allModels.push(...models);
      console.log(`バッチ ${Math.floor(i / batchSize) + 1} 完了: ${models.length}件のモデルを読み込みました`);
    } catch (error) {
      console.error(`バッチ ${Math.floor(i / batchSize) + 1} の読み込みエラー:`, error);
      // エラーが発生しても続行
    }
  }
  
  console.log(`合計 ${allModels.length}件のCityGMLモデルを読み込みました`);
  return allModels;
}
