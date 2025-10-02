import { renew3DModels } from '../tiles/renew3DModels.js';

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


