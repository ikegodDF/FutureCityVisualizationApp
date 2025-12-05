import { appState } from '../../state/appState.js';

export const result = (viewer, models, outputContainer) => {
  const resultYear = appState.year;
  const modelNames = new Set((models || []).map(m => m && m.name));
  const visibleEntityCount = viewer.entities.values.filter(entity => modelNames.has(entity.name) && entity.show === true).length;
  const disasterStateDisplay = appState.disasterState !== '被災前' 
    ? `<br>被害状況:${appState.disasterState}` 
    : '';
  outputContainer.innerHTML = `施策:${appState.appliedPolicy}　　年度:${resultYear} 　　建物数:${visibleEntityCount}${disasterStateDisplay}`;
};

