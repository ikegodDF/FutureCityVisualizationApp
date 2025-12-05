import { renew3DModels } from '../tiles/renew3DModels.js';
import { toPayload } from '../tiles/toPayload.js';

export const appState = {
  year: new Date().getFullYear(),
  appliedPolicy: '施策なし',
  disasterState:"被災前",
  result: {},
};

export const setYear = (year) => {
  appState.year = year;
}

export const setAppliedPolicy = (appliedPolicy) => {
  appState.appliedPolicy = appliedPolicy;
}

export const setDisasterState = (disasterState) => {
  appState.disasterState = disasterState;
}

export const setResult = (result) => {
  const policyKey = String(appState.appliedPolicy);
  const yearKey = appState.year;
  if (!appState.result[policyKey]) appState.result[policyKey] = {};
  if (!appState.result[policyKey][yearKey]) appState.result[policyKey][yearKey] = {};
  appState.result[policyKey][yearKey][appState.disasterState] = result;
}

export const resetResult = (viewer) => {
  Object.keys(appState.result).forEach(policyKey => {
    Object.keys(appState.result[policyKey]).forEach(yearKey => {
      if (yearKey > appState.year) {
        delete appState.result[policyKey][yearKey];
      }
    });
  });
  renew3DModels(viewer, appState.result[appState.appliedPolicy][appState.year][appState.disasterState]);
  console.log(appState);
}

export const allResetResult = (viewer) => {
  const initialYear = new Date().getFullYear();
  const initialPolicy = '施策なし';
  const initialDisasterState = '被災前';
  
  // 2025年・施策なし・被災前のデータ以外を削除
  const newResult = {};
  let initialData = null;
  
  if (appState.result[initialPolicy] && 
      appState.result[initialPolicy][initialYear] && 
      appState.result[initialPolicy][initialYear][initialDisasterState]) {
    // 保存されている初期データを使用
    newResult[initialPolicy] = {};
    newResult[initialPolicy][initialYear] = {};
    newResult[initialPolicy][initialYear][initialDisasterState] = 
      appState.result[initialPolicy][initialYear][initialDisasterState];
    initialData = newResult[initialPolicy][initialYear][initialDisasterState];
  } else {
    // 初期データが存在しない場合、エンティティから再構築
    const entities = Array.from(viewer.entities.values);
    initialData = entities.map(toPayload);
    newResult[initialPolicy] = {};
    newResult[initialPolicy][initialYear] = {};
    newResult[initialPolicy][initialYear][initialDisasterState] = initialData;
  }
  
  appState.result = newResult;
  appState.year = initialYear;
  appState.appliedPolicy = initialPolicy;
  appState.disasterState = initialDisasterState;
  
  // 初期状態のデータでモデルを更新
  if (initialData) {
    renew3DModels(viewer, initialData);
  }
  
  console.log('全リセット完了:', appState);
}


