/**
 * 札幌のCityGMLファイルを読み込むためのヘルパー関数
 */

import { add3DModelsFromCityGML } from './add3DModels.js';

const BASE_PATH = '/models/sapporo_cityGML/';

/**
 * バックエンドAPIからGMLファイルのリストを取得
 * @param {string} directory - ディレクトリ名（デフォルト: sapporo_cityGML）
 * @returns {Promise<Array<string>>} - GMLファイル名の配列
 */
export async function getAllGMLFileNames(directory = 'sapporo_cityGML') {
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

/**
 * すべてのGMLファイルを読み込む
 * @param {Object} viewer - Cesium viewerインスタンス
 * @param {Object} options - オプション
 * @param {number} options.batchSize - バッチサイズ（デフォルト: 10）
 * @param {string} options.directory - ディレクトリ名（デフォルト: sapporo_cityGML）
 * @param {Function} options.onProgress - 進捗コールバック関数
 * @returns {Promise<Array>} - 読み込まれたモデルの配列
 */
export async function loadAllSapporoCityGML(viewer, options = {}) {
  const {
    batchSize = 10,
    useGeometry = true,
    directory = 'sapporo_cityGML',
    onProgress = null
  } = options;
  
  // バックエンドAPIからファイルリストを取得
  const fileNames = await getAllGMLFileNames(directory);
  
  if (fileNames.length === 0) {
    console.warn('GMLファイルが見つかりませんでした');
    return [];
  }
  
  const allModels = [];
  const totalFiles = fileNames.length;
  
  console.log(`${totalFiles}件のCityGMLファイルを読み込みます`);
  
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
