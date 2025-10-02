export const appState = {
  year: new Date().getFullYear(),
  appliedPolicy:[],
  disasterState:[],
  selectedLayer: null,
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

export const setSelectedLayer = (selectedLayer) => {
  appState.selectedLayer = selectedLayer;
}


